import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.campaigns.models import Campaign, CampaignResult
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
def other_user(db) -> User:
    return User.objects.create_user(
        email="other@example.com", name="別ユーザー", password="StrongPass123!"
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
def other_store(db, other_user) -> Store:
    return Store.objects.create(
        tenant_id=other_user.id,
        name="別の店舗",
        industry=Store.Industry.HAIR,
        area_label="難波",
        created_by=other_user,
    )


@pytest.fixture
def campaign(store, user) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="休眠復帰LINE施策",
        purpose=Campaign.Purpose.DORMANT_REACTIVATION,
        channel=Campaign.Channel.OFFICIAL_LINE,
        status=Campaign.Status.REVIEWED,
    )


@pytest.fixture
def other_campaign(other_store, other_user) -> Campaign:
    return Campaign.objects.create(
        store=other_store,
        owner_user=other_user,
        name="別店舗の施策",
        purpose=Campaign.Purpose.REPEAT,
        channel=Campaign.Channel.OFFICIAL_LINE,
        status=Campaign.Status.REVIEWED,
    )


@pytest.fixture
def campaign_result(campaign, store, user) -> CampaignResult:
    return CampaignResult.objects.create(
        campaign=campaign,
        store_id=store.id,
        sent_count=100,
        reply_count=15,
        click_count=10,
        reservation_count=5,
        visit_count=4,
        revenue_amount=40000,
        memo="反応は良かったが予約につながらなかった",
        recorded_by=user,
    )


def _improvement_url(store_id, campaign_id) -> str:
    return reverse("stores:campaigns:improvement", kwargs={
        "store_id": store_id,
        "campaign_id": campaign_id,
    })


# ---------------------------------------------------------------------------
# POST /campaigns/{id}/improvement/
# ---------------------------------------------------------------------------


class TestCampaignImprovementPost:
    @pytest.mark.django_db
    def test_post_returns_improvement(self, auth_client, store, campaign, campaign_result):
        res = auth_client.post(_improvement_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert "summary" in data
        assert isinstance(data["good_points"], list)
        assert isinstance(data["issues"], list)
        assert isinstance(data["improvements"], list)
        assert "next_target_hint" in data
        assert "next_copy_hint" in data
        assert data["confidence"] in ("high", "medium", "low")
        assert isinstance(data["cautions"], list)

    @pytest.mark.django_db
    def test_post_logs_improvement(self, auth_client, store, campaign, campaign_result):
        from apps.ai_core.models import AIImprovementLog
        res = auth_client.post(_improvement_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        log = AIImprovementLog.objects.get(campaign=campaign)
        assert log.success is True
        assert log.model_used == "mock"
        assert str(log.store_id) == str(store.id)

    @pytest.mark.django_db
    def test_post_no_result_returns_422(self, auth_client, store, campaign):
        res = auth_client.post(_improvement_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert res.data["error"]["code"] == "BUSINESS_RULE_ERROR"

    @pytest.mark.django_db
    def test_post_unauthenticated(self, client, store, campaign, campaign_result):
        res = client.post(_improvement_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_post_other_store_forbidden(self, auth_client, other_store, other_campaign):
        CampaignResult.objects.create(
            campaign=other_campaign,
            store_id=other_store.id,
            sent_count=50,
        )
        res = auth_client.post(_improvement_url(other_store.id, other_campaign.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_post_nonexistent_campaign(self, auth_client, store):
        import uuid
        res = auth_client.post(_improvement_url(store.id, uuid.uuid4()))
        assert res.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_post_partial_result_still_works(self, auth_client, store, campaign, user):
        CampaignResult.objects.create(
            campaign=campaign,
            store_id=store.id,
            visit_count=3,
            recorded_by=user,
        )
        res = auth_client.post(_improvement_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["confidence"] in ("high", "medium", "low")
