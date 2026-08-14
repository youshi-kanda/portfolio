import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerConsent, CustomerProfile
from apps.stores.models import Store, StoreSettings

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="owner@example.com",
        name="オーナー",
        password="StrongPass123!",
    )


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create_user(
        email="other@example.com",
        name="別ユーザー",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(client: APIClient, user: User) -> APIClient:
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def store(db, user: User) -> Store:
    s = Store.objects.create(
        tenant_id=user.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )
    StoreSettings.objects.create(store=s)
    return s


@pytest.fixture
def other_store(db, other_user: User) -> Store:
    return Store.objects.create(
        tenant_id=other_user.id,
        name="他社サロン",
        industry=Store.Industry.HAIR,
        area_label="難波",
        created_by=other_user,
    )


def _list_url(store):
    return reverse("stores:customers:list-create", kwargs={"store_id": store.id})


def _detail_url(store, customer):
    return reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})


def _consent_url(store, customer):
    return reverse("stores:customers:consents", kwargs={"store_id": store.id, "customer_id": customer.id})


def _unsubscribe_url(store, customer):
    return reverse("stores:customers:unsubscribe", kwargs={"store_id": store.id, "customer_id": customer.id})


def _resubscribe_url(store, customer):
    return reverse("stores:customers:resubscribe", kwargs={"store_id": store.id, "customer_id": customer.id})


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/customers/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_customer_empty_body(auth_client: APIClient, store: Store):
    resp = auth_client.post(_list_url(store), {}, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["store_id"] == str(store.id)
    assert data["status"] == "active"
    assert data["profile"] is not None


@pytest.mark.django_db
def test_create_customer_all_fields(auth_client: APIClient, store: Store):
    payload = {
        "display_name": "山田様",
        "full_name": "山田 花子",
        "phone": "090-1234-5678",
        "email": "hanako@example.com",
        "first_contact_date": "2026-01-15",
        "acquisition_channel": "instagram",
        "external_customer_id": "EXT-001",
        "gender": "female",
        "age_group": "30s",
        "residential_area": "大阪市",
        "occupation": "会社員",
    }
    resp = auth_client.post(_list_url(store), payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["display_name"] == "山田様"
    assert data["full_name"] == "山田 花子"
    assert data["profile"]["gender"] == "female"
    assert data["profile"]["age_group"] == "30s"


@pytest.mark.django_db
def test_create_customer_unauthenticated(client: APIClient, store: Store):
    resp = client.post(_list_url(store), {}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_customer_other_store_forbidden(auth_client: APIClient, other_store: Store):
    resp = auth_client.post(_list_url(other_store), {}, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/customers/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_customers_own_store_only(auth_client: APIClient, store: Store, other_store: Store):
    Customer.objects.create(store=store, display_name="自店顧客")
    Customer.objects.create(store=other_store, display_name="他店顧客")
    resp = auth_client.get(_list_url(store))
    assert resp.status_code == status.HTTP_200_OK
    names = [c["display_name"] for c in resp.json()["data"]]
    assert "自店顧客" in names
    assert "他店顧客" not in names
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_customers_excludes_deleted(auth_client: APIClient, store: Store):
    from django.utils import timezone

    Customer.objects.create(store=store, display_name="有効顧客")
    Customer.objects.create(store=store, display_name="削除済み", deleted_at=timezone.now())
    resp = auth_client.get(_list_url(store))
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["display_name"] == "有効顧客"


@pytest.mark.django_db
def test_list_customers_search_q(auth_client: APIClient, store: Store):
    Customer.objects.create(store=store, display_name="山田様")
    Customer.objects.create(store=store, display_name="佐藤様")
    resp = auth_client.get(_list_url(store), {"q": "山田"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["display_name"] == "山田様"


@pytest.mark.django_db
def test_list_customers_filter_status(auth_client: APIClient, store: Store):
    Customer.objects.create(store=store, display_name="有効", status="active")
    Customer.objects.create(store=store, display_name="無効", status="inactive")
    resp = auth_client.get(_list_url(store), {"status": "inactive"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["display_name"] == "無効"


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/customers/{customer_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_customer_detail(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="詳細テスト")
    CustomerProfile.objects.create(customer=c, store_id=store.id, gender="female")
    resp = auth_client.get(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["id"] == str(c.id)
    assert data["profile"]["gender"] == "female"


@pytest.mark.django_db
def test_get_customer_other_store_forbidden(auth_client: APIClient, store: Store, other_store: Store):
    c = Customer.objects.create(store=other_store, display_name="他店顧客")
    url = reverse("stores:customers:detail", kwargs={"store_id": other_store.id, "customer_id": c.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_nonexistent_customer_404(auth_client: APIClient, store: Store):
    import uuid
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": uuid.uuid4()})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/{store_id}/customers/{customer_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_customer_fields(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="旧名前")
    resp = auth_client.patch(_detail_url(store, c), {"display_name": "新名前", "status": "inactive"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["display_name"] == "新名前"
    assert data["status"] == "inactive"


@pytest.mark.django_db
def test_update_customer_profile_fields(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="プロフィール更新")
    CustomerProfile.objects.create(customer=c, store_id=store.id)
    resp = auth_client.patch(_detail_url(store, c), {"gender": "male", "age_group": "40s"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["profile"]["gender"] == "male"
    assert data["profile"]["age_group"] == "40s"


# ---------------------------------------------------------------------------
# DELETE /api/v1/stores/{store_id}/customers/{customer_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_customer_soft_deletes(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="削除対象")
    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    c.refresh_from_db()
    assert c.deleted_at is not None
    assert c.status == Customer.Status.INACTIVE


@pytest.mark.django_db
def test_deleted_customer_not_accessible(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="削除後アクセス")
    auth_client.delete(_detail_url(store, c))
    resp = auth_client.get(_detail_url(store, c))
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# CustomerSerializer に consent フィールドが含まれること
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_detail_consent_null_when_not_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意なし顧客")
    resp = auth_client.get(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["consent"] is None


@pytest.mark.django_db
def test_customer_detail_consent_data_when_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意あり顧客")
    CustomerConsent.objects.create(customer=c, store_id=store.id, contact_line_allowed=False)
    resp = auth_client.get(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    consent = resp.json()["data"]["consent"]
    assert consent is not None
    assert consent["contact_line_allowed"] is False
    assert consent["is_unsubscribed"] is False


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/customers/{customer_id}/consents/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_consent_not_found(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意なし")
    resp = auth_client.get(_consent_url(store, c))
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_get_consent_success(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意あり")
    CustomerConsent.objects.create(
        customer=c, store_id=store.id,
        contact_line_allowed=True,
        contact_email_allowed=False,
        is_unsubscribed=False,
    )
    resp = auth_client.get(_consent_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["contact_line_allowed"] is True
    assert data["contact_email_allowed"] is False
    assert data["is_unsubscribed"] is False


@pytest.mark.django_db
def test_get_consent_unauthenticated(client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    resp = client.get(_consent_url(store, c))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_get_consent_other_store_forbidden(auth_client: APIClient, other_store: Store):
    c = Customer.objects.create(store=other_store)
    resp = auth_client.get(_consent_url(other_store, c))
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_consent_nonexistent_customer(auth_client: APIClient, store: Store):
    import uuid as _uuid
    url = reverse(
        "stores:customers:consents",
        kwargs={"store_id": store.id, "customer_id": _uuid.uuid4()},
    )
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/{store_id}/customers/{customer_id}/consents/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_consent_creates_if_not_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="新規同意")
    assert not CustomerConsent.objects.filter(customer=c).exists()
    resp = auth_client.patch(
        _consent_url(store, c),
        {"contact_line_allowed": False},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert CustomerConsent.objects.filter(customer=c).exists()
    assert resp.json()["data"]["contact_line_allowed"] is False


@pytest.mark.django_db
def test_patch_consent_updates_existing(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意更新")
    CustomerConsent.objects.create(customer=c, store_id=store.id, contact_email_allowed=True)
    resp = auth_client.patch(
        _consent_url(store, c),
        {"contact_email_allowed": False},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["contact_email_allowed"] is False


@pytest.mark.django_db
def test_patch_consent_partial_update(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    CustomerConsent.objects.create(
        customer=c, store_id=store.id,
        contact_line_allowed=True,
        contact_email_allowed=True,
    )
    resp = auth_client.patch(
        _consent_url(store, c),
        {"contact_line_allowed": False},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["contact_line_allowed"] is False
    assert data["contact_email_allowed"] is True


@pytest.mark.django_db
def test_patch_consent_unauthenticated(client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    resp = client.patch(_consent_url(store, c), {}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_patch_consent_other_store_forbidden(auth_client: APIClient, other_store: Store):
    c = Customer.objects.create(store=other_store)
    resp = auth_client.patch(_consent_url(other_store, c), {}, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_patch_consent_cannot_set_is_unsubscribed(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    CustomerConsent.objects.create(customer=c, store_id=store.id, is_unsubscribed=False)
    resp = auth_client.patch(
        _consent_url(store, c),
        {"is_unsubscribed": True},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_unsubscribed"] is False


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/customers/{customer_id}/unsubscribe/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unsubscribe_sets_flag_and_timestamp(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    CustomerConsent.objects.create(customer=c, store_id=store.id)
    resp = auth_client.post(_unsubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["is_unsubscribed"] is True
    assert data["unsubscribed_at"] is not None


@pytest.mark.django_db
def test_unsubscribe_creates_consent_if_not_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    assert not CustomerConsent.objects.filter(customer=c).exists()
    resp = auth_client.post(_unsubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_unsubscribed"] is True
    assert CustomerConsent.objects.filter(customer=c).exists()


@pytest.mark.django_db
def test_unsubscribe_idempotent(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    auth_client.post(_unsubscribe_url(store, c))
    resp = auth_client.post(_unsubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_unsubscribed"] is True


@pytest.mark.django_db
def test_unsubscribe_unauthenticated(client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    resp = client.post(_unsubscribe_url(store, c))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_unsubscribe_other_store_forbidden(auth_client: APIClient, other_store: Store):
    c = Customer.objects.create(store=other_store)
    resp = auth_client.post(_unsubscribe_url(other_store, c))
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/customers/{customer_id}/resubscribe/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resubscribe_clears_flag_and_timestamp(auth_client: APIClient, store: Store):
    from django.utils import timezone as _tz
    c = Customer.objects.create(store=store)
    CustomerConsent.objects.create(
        customer=c, store_id=store.id,
        is_unsubscribed=True, unsubscribed_at=_tz.now(),
    )
    resp = auth_client.post(_resubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["is_unsubscribed"] is False
    assert data["unsubscribed_at"] is None


@pytest.mark.django_db
def test_resubscribe_creates_consent_if_not_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    assert not CustomerConsent.objects.filter(customer=c).exists()
    resp = auth_client.post(_resubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_unsubscribed"] is False
    assert CustomerConsent.objects.filter(customer=c).exists()


@pytest.mark.django_db
def test_resubscribe_idempotent(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    auth_client.post(_resubscribe_url(store, c))
    resp = auth_client.post(_resubscribe_url(store, c))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["is_unsubscribed"] is False


@pytest.mark.django_db
def test_resubscribe_unauthenticated(client: APIClient, store: Store):
    c = Customer.objects.create(store=store)
    resp = client.post(_resubscribe_url(store, c))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_resubscribe_other_store_forbidden(auth_client: APIClient, other_store: Store):
    c = Customer.objects.create(store=other_store)
    resp = auth_client.post(_resubscribe_url(other_store, c))
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# P7-022: 顧客削除時の anonymize / right-to-erasure 対応
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_anonymizes_customer_pii(auth_client: APIClient, store: Store):
    c = Customer.objects.create(
        store=store,
        display_name="山田様",
        full_name="山田花子",
        kana="ヤマダハナコ",
        phone="090-1234-5678",
        email="hanako@example.com",
        line_user_id="Uabc123",
        external_customer_id="EXT-001",
    )
    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK

    c.refresh_from_db()
    assert c.deleted_at is not None
    assert c.status == Customer.Status.INACTIVE
    assert c.display_name is None
    assert c.full_name is None
    assert c.kana is None
    assert c.phone is None
    assert c.email is None
    assert c.line_user_id is None
    assert c.external_customer_id is None


@pytest.mark.django_db
def test_delete_anonymizes_profile_pii(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="プロフィール削除")
    CustomerProfile.objects.create(
        customer=c,
        store_id=store.id,
        note="接客メモ：花粉症あり",
        residential_area="大阪市",
        occupation="会社員",
        preferences={"favorite": "フェイシャル"},
    )
    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK

    profile = CustomerProfile.objects.get(customer_id=c.id)
    assert profile.note is None
    assert profile.residential_area is None
    assert profile.occupation is None
    assert profile.preferences is None


@pytest.mark.django_db
def test_delete_revokes_all_consents(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意失効テスト")
    CustomerConsent.objects.create(
        customer=c,
        store_id=store.id,
        contact_line_allowed=True,
        contact_email_allowed=True,
        contact_sms_allowed=True,
        analysis_allowed=True,
        external_integration_allowed=True,
        is_unsubscribed=False,
    )
    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK

    consent = CustomerConsent.objects.get(customer_id=c.id)
    assert consent.contact_line_allowed is False
    assert consent.contact_email_allowed is False
    assert consent.contact_sms_allowed is False
    assert consent.analysis_allowed is False
    assert consent.external_integration_allowed is False
    assert consent.is_unsubscribed is True
    assert consent.unsubscribed_at is not None


@pytest.mark.django_db
def test_delete_creates_consent_and_revokes_if_not_exists(auth_client: APIClient, store: Store):
    c = Customer.objects.create(store=store, display_name="同意なし顧客削除")
    assert not CustomerConsent.objects.filter(customer=c).exists()

    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK

    consent = CustomerConsent.objects.get(customer_id=c.id)
    assert consent.is_unsubscribed is True
    assert consent.contact_line_allowed is False
    assert consent.analysis_allowed is False


@pytest.mark.django_db
def test_delete_writes_anonymized_audit_log_without_pii(auth_client: APIClient, store: Store):
    c = Customer.objects.create(
        store=store,
        display_name="山田様",
        phone="090-1234-5678",
        email="hanako@example.com",
    )
    resp = auth_client.delete(_detail_url(store, c))
    assert resp.status_code == status.HTTP_200_OK

    anon_log = AuditLog.objects.get(
        store=store,
        action=AuditLog.Action.CUSTOMER_ANONYMIZED,
        target_id=c.id,
    )
    snapshot_str = str(anon_log.after_snapshot)
    assert "山田" not in snapshot_str
    assert "090-" not in snapshot_str
    assert "hanako" not in snapshot_str
    assert anon_log.after_snapshot["anonymized"] is True
    assert anon_log.after_snapshot["consent_revoked"] is True

    del_log = AuditLog.objects.get(
        store=store,
        action=AuditLog.Action.CUSTOMER_DELETED,
        target_id=c.id,
    )
    snapshot_str = str(del_log.after_snapshot)
    assert "山田" not in snapshot_str
    assert "090-" not in snapshot_str


@pytest.mark.django_db
def test_deleted_customer_excluded_from_list(auth_client: APIClient, store: Store):
    active = Customer.objects.create(store=store, display_name="有効顧客")
    to_delete = Customer.objects.create(store=store, display_name="削除顧客", phone="080-9999-0000")

    auth_client.delete(_detail_url(store, to_delete))

    resp = auth_client.get(_list_url(store))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1
    ids = [c["id"] for c in resp.json()["data"]]
    assert str(active.id) in ids
    assert str(to_delete.id) not in ids
