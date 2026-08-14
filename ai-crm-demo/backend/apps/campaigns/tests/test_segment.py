import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.campaigns.models import Campaign, CampaignTarget
from apps.customers.models import Customer, CustomerConsent
from apps.insights.models import CustomerInsight
from apps.stores.models import Store

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="owner@example.com", name="オーナー", password="StrongPass123!"
    )


@pytest.fixture
def auth_client(client, user) -> APIClient:
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def store(db, user) -> Store:
    return Store.objects.create(
        tenant_id=user.id,
        name="テスト店舗",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )


@pytest.fixture
def campaign(store, user) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="休眠復帰施策",
        purpose=Campaign.Purpose.DORMANT_REACTIVATION,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )


def _customer(store: Store, name: str = "顧客") -> Customer:
    return Customer.objects.create(store=store, display_name=name, status="active")


def _consent(customer: Customer, store: Store, *, line_allowed=True, unsubscribed=False) -> CustomerConsent:
    return CustomerConsent.objects.create(
        customer=customer,
        store_id=store.id,
        contact_line_allowed=line_allowed,
        is_unsubscribed=unsubscribed,
    )


def _insight(store: Store, customer: Customer, state: str) -> CustomerInsight:
    return CustomerInsight.objects.create(
        store_id=store.id,
        customer=customer,
        insight_date=timezone.now().date(),
        customer_state=state,
        priority=CustomerInsight.Priority.MEDIUM,
        evidence_summary="テスト",
        ai_confidence=CustomerInsight.Confidence.MEDIUM,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestTargetGenerate:
    def _url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-generate",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_generate_dormant_includes_dormant_customers(self, auth_client, store, campaign):
        c_dormant = _customer(store, "休眠")
        c_repeater = _customer(store, "リピーター")
        _consent(c_dormant, store)
        _consent(c_repeater, store)
        _insight(store, c_dormant, "dormant")
        _insight(store, c_repeater, "repeater")

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert data["total_included"] == 1
        assert data["total_excluded"] >= 1
        # campaign.target_count が更新されていること
        campaign.refresh_from_db()
        assert campaign.target_count == 1

    def test_generate_excludes_unsubscribed(self, auth_client, store, campaign):
        c = _customer(store, "配信停止")
        _consent(c, store, unsubscribed=True)
        _insight(store, c, "dormant")

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["total_included"] == 0
        target = CampaignTarget.objects.get(campaign=campaign, customer=c)
        assert target.excluded is True
        assert target.exclusion_reason == "配信停止"

    def test_generate_excludes_no_line_consent(self, auth_client, store, campaign):
        c = _customer(store, "LINE未同意")
        _consent(c, store, line_allowed=False)
        _insight(store, c, "dormant")

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.data["data"]["total_included"] == 0
        target = CampaignTarget.objects.get(campaign=campaign, customer=c)
        assert target.exclusion_reason == "LINE連絡同意なし"

    def test_generate_excludes_no_consent_record(self, auth_client, store, campaign):
        c = _customer(store, "同意なし")
        _insight(store, c, "dormant")
        # consent レコードを作らない

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.data["data"]["total_included"] == 0
        target = CampaignTarget.objects.get(campaign=campaign, customer=c)
        assert target.exclusion_reason == "同意情報なし"

    def test_generate_excludes_wrong_state(self, auth_client, store, campaign):
        # campaign は dormant_reactivation → dormant のみ対象
        c = _customer(store, "初回来店")
        _consent(c, store)
        _insight(store, c, "after_first_visit")

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.data["data"]["total_included"] == 0
        target = CampaignTarget.objects.get(campaign=campaign, customer=c)
        assert target.excluded is True

    def test_generate_replaces_existing_targets(self, auth_client, store, campaign):
        c = _customer(store, "既存ターゲット")
        _consent(c, store)
        _insight(store, c, "dormant")
        # 事前にターゲットを作っておく
        CampaignTarget.objects.create(campaign=campaign, store=store, customer=c)

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_200_OK
        # 重複なく1件だけになること
        assert CampaignTarget.objects.filter(campaign=campaign, customer=c).count() == 1

    def test_generate_awareness_includes_all_consented(self, auth_client, store, user):
        campaign = Campaign.objects.create(
            store=store, owner_user=user,
            name="認知拡大施策", purpose=Campaign.Purpose.AWARENESS,
            channel=Campaign.Channel.OFFICIAL_LINE,
        )
        c1 = _customer(store, "顧客A")
        c2 = _customer(store, "顧客B")
        _consent(c1, store)
        _consent(c2, store)
        _insight(store, c1, "dormant")
        _insight(store, c2, "repeater")

        res = auth_client.post(self._url(store.id, campaign.id))

        assert res.data["data"]["total_included"] == 2

    def test_response_has_cautions(self, auth_client, store, campaign):
        res = auth_client.post(self._url(store.id, campaign.id))
        assert "cautions" in res.data["data"]
        assert len(res.data["data"]["cautions"]) > 0

    def test_401_unauthenticated(self, client, store, campaign):
        url = self._url(store.id, campaign.id)
        assert client.post(url).status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(self, auth_client, db):
        other_user = User.objects.create_user(
            email="other@example.com", name="他ユーザー", password="StrongPass123!"
        )
        other_store = Store.objects.create(
            tenant_id=other_user.id, name="他店舗",
            industry=Store.Industry.HAIR, area_label="難波", created_by=other_user,
        )
        other_campaign = Campaign.objects.create(
            store=other_store, owner_user=other_user,
            name="他店舗施策", purpose="repeat", channel="in_store",
        )
        url = self._url(other_store.id, other_campaign.id)
        assert auth_client.post(url).status_code == status.HTTP_403_FORBIDDEN
