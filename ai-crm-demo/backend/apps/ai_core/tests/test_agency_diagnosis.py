"""P4-003: 代理店診断機能のテスト。

- ユニット: run_agency_diagnosis のルールベースロジック
- API: POST /api/v1/ai/stores/{store_id}/agency-diagnosis/
  - オーナー → 200
  - collaborator (can_view=True) → 200
  - collaborator (can_view=False) → 403
  - 未招待ユーザー → 403
  - 未認証 → 401
  - ログが記録される
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.ai_core.models import AgencyDiagnosisLog
from apps.ai_core.services.agency_diagnosis import run_agency_diagnosis
from apps.customers.models import Customer, CustomerConsent, CustomerProfile
from apps.stores.models import Store, StoreCollaborator, StoreSettings, StoreTool

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(email="owner@example.com", name="オーナー", password="Pass123!")


@pytest.fixture
def collab_user(db):
    return User.objects.create_user(email="collab@example.com", name="支援者", password="Pass123!")


@pytest.fixture
def outsider(db):
    return User.objects.create_user(email="outsider@example.com", name="無関係", password="Pass123!")


def _auth(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def store(db, owner):
    s = Store.objects.create(
        tenant_id=owner.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=owner,
    )
    StoreSettings.objects.create(store=s)
    return s


@pytest.fixture
def store_with_customers(db, store, owner):
    """顧客・同意・ツールを持つ店舗フィクスチャ。"""
    # アクティブ顧客 3件
    for i in range(3):
        c = Customer.objects.create(
            store=store,
            display_name=f"顧客{i}",
            full_name=f"テスト {i}",
            status=Customer.Status.ACTIVE,
        )
        CustomerProfile.objects.create(customer=c, store_id=store.id)
        CustomerConsent.objects.create(
            customer=c,
            store_id=store.id,
            contact_line_allowed=True,
            is_unsubscribed=False,
        )
    # 非アクティブ顧客 1件
    c = Customer.objects.create(
        store=store,
        display_name="休眠顧客",
        full_name="休眠 太郎",
        status=Customer.Status.INACTIVE,
    )
    CustomerProfile.objects.create(customer=c, store_id=store.id)
    # LINE公式ツール
    StoreTool.objects.create(
        store=store,
        tool_type=StoreTool.ToolType.OFFICIAL_LINE,
        usage_status=StoreTool.UsageStatus.USING,
    )
    return store


def _diagnosis_url(store):
    return reverse("ai_core:agency-diagnosis", kwargs={"store_id": store.id})


# ---------------------------------------------------------------------------
# Unit tests: run_agency_diagnosis
# ---------------------------------------------------------------------------


def test_diagnosis_no_customers():
    from apps.stores.models import Store as S
    store_mock = type("Store", (), {"id": "mock"})()
    result = run_agency_diagnosis(
        store=store_mock,
        customer_stats={"total": 0, "active": 0, "dormant": 0, "at_risk": 0,
                        "line_consent": 0, "unsubscribed": 0},
        tool_types=[],
    )
    assert result.overall_score < 60
    assert any(i.category == "no_customers" for i in result.issues)
    assert result.confidence == "low"
    assert result.requires_human_review is True


def test_diagnosis_healthy_store():
    store_mock = type("Store", (), {"id": "mock"})()
    result = run_agency_diagnosis(
        store=store_mock,
        customer_stats={"total": 100, "active": 80, "dormant": 10, "at_risk": 10,
                        "line_consent": 70, "unsubscribed": 3},
        tool_types=["official_line"],
    )
    assert result.overall_score >= 60
    assert any(s.category == "active_rate" for s in result.strengths)
    assert any(s.category == "line_consent" for s in result.strengths)
    assert result.model_used == "mock"


def test_diagnosis_high_dormant():
    store_mock = type("Store", (), {"id": "mock"})()
    result = run_agency_diagnosis(
        store=store_mock,
        customer_stats={"total": 100, "active": 40, "dormant": 50, "at_risk": 10,
                        "line_consent": 20, "unsubscribed": 15},
        tool_types=[],
    )
    assert any(i.category == "dormant_customers" and i.severity == "high" for i in result.issues)
    assert any(i.category == "low_line_consent" for i in result.issues)
    assert any(i.category == "no_line_official" for i in result.issues)


def test_diagnosis_lstep_strength():
    store_mock = type("Store", (), {"id": "mock"})()
    result = run_agency_diagnosis(
        store=store_mock,
        customer_stats={"total": 50, "active": 40, "dormant": 5, "at_risk": 5,
                        "line_consent": 35, "unsubscribed": 2},
        tool_types=["official_line", "lstep"],
    )
    assert any(s.category == "lstep" for s in result.strengths)


def test_tool_notes_no_line():
    store_mock = type("Store", (), {"id": "mock"})()
    result = run_agency_diagnosis(
        store=store_mock,
        customer_stats={"total": 10, "active": 8, "dormant": 1, "at_risk": 1,
                        "line_consent": 5, "unsubscribed": 0},
        tool_types=[],
    )
    assert any("LINE公式アカウントが未登録" in note for note in result.tool_notes)


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_owner_can_run_diagnosis(client, owner, store_with_customers):
    _auth(client, owner)
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_200_OK
    data = res.data["data"]
    assert "diagnosis_id" in data
    assert "overall_score" in data
    assert isinstance(data["issues"], list)
    assert isinstance(data["strengths"], list)
    assert data["requires_human_review"] is True


@pytest.mark.django_db
def test_collab_with_view_can_run_diagnosis(db, client, collab_user, store_with_customers):
    StoreCollaborator.objects.create(
        store=store_with_customers,
        user=collab_user,
        can_view=True,
    )
    _auth(client, collab_user)
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_200_OK
    assert "overall_score" in res.data["data"]


@pytest.mark.django_db
def test_collab_without_view_is_forbidden(db, client, collab_user, store_with_customers):
    StoreCollaborator.objects.create(
        store=store_with_customers,
        user=collab_user,
        can_view=False,
    )
    _auth(client, collab_user)
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_outsider_is_forbidden(client, outsider, store_with_customers):
    _auth(client, outsider)
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_unauthenticated_returns_401(client, store_with_customers):
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_diagnosis_log_is_created(client, owner, store_with_customers):
    _auth(client, owner)
    before = AgencyDiagnosisLog.objects.filter(store_id=store_with_customers.id).count()
    client.post(_diagnosis_url(store_with_customers))
    after = AgencyDiagnosisLog.objects.filter(store_id=store_with_customers.id).count()
    assert after == before + 1


@pytest.mark.django_db
def test_response_structure(client, owner, store_with_customers):
    _auth(client, owner)
    res = client.post(_diagnosis_url(store_with_customers))
    assert res.status_code == status.HTTP_200_OK
    data = res.data["data"]
    # store_overview フィールド確認
    overview = data["store_overview"]
    assert "total_customers" in overview
    assert "active_rate" in overview
    assert "line_consent_rate" in overview
    # スコアは 0-100 の範囲
    assert 0 <= data["overall_score"] <= 100
    # モデル使用情報
    assert data["model_used"] == "mock"
