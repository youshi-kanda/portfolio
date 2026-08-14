import importlib

import pytest
from django.apps import apps
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store

from ..models import Campaign, CampaignContent, CampaignTarget

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
    )


# ---------------------------------------------------------------------------
# Campaign list / create
# ---------------------------------------------------------------------------


class TestCampaignListCreate:
    def test_list_empty(self, auth_client, store):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"] == []
        assert res.data["meta"]["total"] == 0

    def test_create(self, auth_client, store):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        payload = {
            "name": "5月休眠復帰施策",
            "purpose": "dormant_reactivation",
            "channel": "official_line",
        }
        res = auth_client.post(url, data=payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["data"]["name"] == "5月休眠復帰施策"
        assert res.data["data"]["status"] == "draft"

    def test_list_returns_own_campaigns(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["meta"]["total"] == 1

    def test_filter_by_status(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        res = auth_client.get(url, {"status": "draft"})
        assert res.data["meta"]["total"] == 1
        res2 = auth_client.get(url, {"status": "approved"})
        assert res2.data["meta"]["total"] == 0

    def test_create_validation_empty_name(self, auth_client, store):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        res = auth_client.post(url, data={"name": "  ", "purpose": "repeat", "channel": "in_store"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_401_unauthenticated(self, client, store):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": store.id})
        assert client.get(url).status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(self, auth_client, other_store):
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": other_store.id})
        assert auth_client.get(url).status_code == status.HTTP_403_FORBIDDEN

    def test_404_unknown_store(self, auth_client):
        import uuid
        url = reverse("stores:campaigns:list-create", kwargs={"store_id": uuid.uuid4()})
        assert auth_client.get(url).status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Campaign detail (get / patch / delete)
# ---------------------------------------------------------------------------


class TestCampaignDetail:
    def test_get(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["id"] == str(campaign.id)

    def test_patch_name(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.patch(url, data={"name": "更新後の施策名"})
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["name"] == "更新後の施策名"

    def test_patch_status(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.patch(url, data={"status": "approved"})
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["status"] == "approved"

    def test_delete(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.delete(url)
        assert res.status_code == status.HTTP_204_NO_CONTENT
        campaign.refresh_from_db()
        assert campaign.deleted_at is not None

    def test_deleted_campaign_returns_404(self, auth_client, store, campaign):
        from django.utils import timezone
        campaign.deleted_at = timezone.now()
        campaign.save()
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        assert auth_client.get(url).status_code == status.HTTP_404_NOT_FOUND

    def test_403_other_store(self, auth_client, other_store, other_user):
        other_campaign = Campaign.objects.create(
            store=other_store, owner_user=other_user,
            name="別店舗施策", purpose="repeat", channel="in_store",
        )
        url = reverse("stores:campaigns:detail", kwargs={"store_id": other_store.id, "campaign_id": other_campaign.id})
        assert auth_client.get(url).status_code == status.HTTP_403_FORBIDDEN

    def test_response_has_meta(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:detail", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.get(url)
        assert "meta" in res.data
        assert "request_id" in res.data["meta"]


# ---------------------------------------------------------------------------
# Campaign contents list
# ---------------------------------------------------------------------------


class TestCampaignContentList:
    def test_list_empty(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:contents-list", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["meta"]["total"] == 0

    def test_list_with_content(self, auth_client, store, campaign):
        CampaignContent.objects.create(
            campaign=campaign, store=store,
            content_type="line", body="こんにちは、季節の肌ケアのご案内です。",
        )
        url = reverse("stores:campaigns:contents-list", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.get(url)
        assert res.data["meta"]["total"] == 1

    def test_401_unauthenticated(self, client, store, campaign):
        url = reverse("stores:campaigns:contents-list", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        assert client.get(url).status_code == status.HTTP_401_UNAUTHORIZED


def test_expression_risk_level_data_migration_normalizes_legacy_values(store, campaign):
    CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type="line", body="safe legacy", expression_risk_level="safe",
    )
    CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type="line", body="caution legacy", expression_risk_level="caution",
    )
    CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type="line", body="high risk legacy", expression_risk_level="high_risk",
    )

    migration = importlib.import_module("apps.campaigns.migrations.0003_normalize_expression_risk_level")
    migration.normalize_expression_risk_level(apps, None)

    assert not CampaignContent.objects.filter(
        expression_risk_level__in=["safe", "caution", "high_risk"]
    ).exists()
    assert CampaignContent.objects.filter(expression_risk_level="none").count() == 1
    assert CampaignContent.objects.filter(expression_risk_level="medium").count() == 1
    assert CampaignContent.objects.filter(expression_risk_level="high").count() == 1


# ---------------------------------------------------------------------------
# Campaign targets list
# ---------------------------------------------------------------------------


class TestCampaignTargetList:
    def test_list_empty(self, auth_client, store, campaign):
        url = reverse("stores:campaigns:targets-list", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["meta"]["total"] == 0

    def test_filter_excluded(self, auth_client, store, campaign):
        CampaignTarget.objects.create(campaign=campaign, store=store, excluded=False)
        CampaignTarget.objects.create(
            campaign=campaign, store=store, excluded=True,
            exclusion_reason="配信停止",
        )
        url = reverse("stores:campaigns:targets-list", kwargs={"store_id": store.id, "campaign_id": campaign.id})
        res_all = auth_client.get(url)
        assert res_all.data["meta"]["total"] == 2

        res_excl = auth_client.get(url, {"excluded": "true"})
        assert res_excl.data["meta"]["total"] == 1

        res_incl = auth_client.get(url, {"excluded": "false"})
        assert res_incl.data["meta"]["total"] == 1
