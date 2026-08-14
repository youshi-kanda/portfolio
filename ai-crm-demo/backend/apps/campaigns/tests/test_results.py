import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store

from ..models import Campaign, CampaignResult

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
        status=Campaign.Status.EXECUTED,
    )


@pytest.fixture
def other_campaign(other_store, other_user) -> Campaign:
    return Campaign.objects.create(
        store=other_store,
        owner_user=other_user,
        name="別店舗の施策",
        purpose=Campaign.Purpose.REPEAT,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )


def _result_url(store_id, campaign_id) -> str:
    return reverse("stores:campaigns:result", kwargs={
        "store_id": store_id,
        "campaign_id": campaign_id,
    })


# ---------------------------------------------------------------------------
# GET /campaigns/{id}/result/
# ---------------------------------------------------------------------------


class TestCampaignResultGet:
    def test_get_no_result_returns_none(self, auth_client, store, campaign):
        res = auth_client.get(_result_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"] is None

    def test_get_existing_result(self, auth_client, store, campaign, user):
        CampaignResult.objects.create(
            campaign=campaign,
            store_id=store.id,
            sent_count=100,
            reply_count=10,
            visit_count=5,
            revenue_amount=50000,
            recorded_by=user,
        )
        res = auth_client.get(_result_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert data["sent_count"] == 100
        assert data["reply_count"] == 10
        assert data["visit_count"] == 5
        assert data["revenue_amount"] == "50000"

    def test_get_unauthenticated(self, client, store, campaign):
        res = client.get(_result_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_other_store_forbidden(self, auth_client, other_store, other_campaign):
        res = auth_client.get(_result_url(other_store.id, other_campaign.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_get_nonexistent_campaign(self, auth_client, store):
        import uuid
        res = auth_client.get(_result_url(store.id, uuid.uuid4()))
        assert res.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# POST /campaigns/{id}/result/
# ---------------------------------------------------------------------------


class TestCampaignResultPost:
    def test_create_result(self, auth_client, store, campaign):
        payload = {
            "sent_count": 200,
            "reply_count": 20,
            "click_count": 15,
            "reservation_count": 8,
            "visit_count": 6,
            "revenue_amount": 72000,
            "memo": "反応良好でした",
        }
        res = auth_client.post(_result_url(store.id, campaign.id), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]
        assert data["sent_count"] == 200
        assert data["reply_count"] == 20
        assert data["memo"] == "反応良好でした"

        campaign.refresh_from_db()
        assert campaign.status == Campaign.Status.REVIEWED

    def test_create_result_partial(self, auth_client, store, campaign):
        payload = {"sent_count": 50}
        res = auth_client.post(_result_url(store.id, campaign.id), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["data"]["sent_count"] == 50

    def test_update_existing_result(self, auth_client, store, campaign, user):
        CampaignResult.objects.create(
            campaign=campaign,
            store_id=store.id,
            sent_count=100,
            recorded_by=user,
        )
        payload = {"sent_count": 120, "reply_count": 12}
        res = auth_client.post(_result_url(store.id, campaign.id), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]
        assert data["sent_count"] == 120
        assert data["reply_count"] == 12
        assert CampaignResult.objects.filter(campaign=campaign).count() == 1

    def test_post_unauthenticated(self, client, store, campaign):
        res = client.post(_result_url(store.id, campaign.id), {}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_post_other_store_forbidden(self, auth_client, other_store, other_campaign):
        res = auth_client.post(
            _result_url(other_store.id, other_campaign.id),
            {"sent_count": 10},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_post_nonexistent_campaign(self, auth_client, store):
        import uuid
        res = auth_client.post(
            _result_url(store.id, uuid.uuid4()),
            {"sent_count": 10},
            format="json",
        )
        assert res.status_code == status.HTTP_404_NOT_FOUND
