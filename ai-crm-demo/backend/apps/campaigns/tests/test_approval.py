import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store, StoreCollaborator

from ..models import Campaign, CampaignContent

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
def supporter(db) -> User:
    return User.objects.create_user(
        email="supporter@example.com",
        name="外部支援者",
        password="StrongPass123!",
        role=User.Role.SUPPORTER,
    )


@pytest.fixture
def auth_client(client, user) -> APIClient:
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def supporter_client(supporter) -> APIClient:
    c = APIClient()
    token = RefreshToken.for_user(supporter).access_token
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


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


@pytest.fixture
def draft_content(campaign, store) -> CampaignContent:
    return CampaignContent.objects.create(
        campaign=campaign,
        store=store,
        content_type=CampaignContent.ContentType.LINE,
        body="ご無沙汰しています。ぜひまたお越しください。",
        approval_status=CampaignContent.ApprovalStatus.DRAFT,
    )


@pytest.fixture
def pending_content(campaign, store) -> CampaignContent:
    return CampaignContent.objects.create(
        campaign=campaign,
        store=store,
        content_type=CampaignContent.ContentType.LINE,
        body="再来店お待ちしております。",
        approval_status=CampaignContent.ApprovalStatus.APPROVAL_PENDING,
    )


@pytest.fixture
def approving_collaborator(store, supporter, user) -> StoreCollaborator:
    return StoreCollaborator.objects.create(
        store=store,
        user=supporter,
        can_view=True,
        can_approve_contents=True,
        invited_by=user,
    )


@pytest.fixture
def viewing_collaborator(store, supporter, user) -> StoreCollaborator:
    return StoreCollaborator.objects.create(
        store=store,
        user=supporter,
        can_view=True,
        can_approve_contents=False,
        invited_by=user,
    )


# ---------------------------------------------------------------------------
# submit (draft → approval_pending)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_success(auth_client, store, campaign, draft_content):
    url = reverse(
        "stores:campaigns:contents-submit",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": draft_content.id,
        },
    )
    res = auth_client.post(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert data["approval_status"] == "approval_pending"

    draft_content.refresh_from_db()
    assert draft_content.approval_status == CampaignContent.ApprovalStatus.APPROVAL_PENDING


@pytest.mark.django_db
def test_submit_requires_auth(client, store, campaign, draft_content):
    url = reverse(
        "stores:campaigns:contents-submit",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": draft_content.id,
        },
    )
    res = client.post(url)
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_submit_other_store_forbidden(auth_client, other_store, campaign, draft_content):
    url = reverse(
        "stores:campaigns:contents-submit",
        kwargs={
            "store_id": other_store.id,
            "campaign_id": campaign.id,
            "content_id": draft_content.id,
        },
    )
    res = auth_client.post(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_submit_wrong_status_returns_422(auth_client, store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-submit",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = auth_client.post(url)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "BUSINESS_RULE_ERROR"


# ---------------------------------------------------------------------------
# approve (approval_pending → approved)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_approve_success(auth_client, store, campaign, pending_content, user):
    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = auth_client.post(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert data["approval_status"] == "approved"

    pending_content.refresh_from_db()
    assert pending_content.approval_status == CampaignContent.ApprovalStatus.APPROVED
    assert pending_content.approved_by_id == user.id
    assert pending_content.approved_at is not None


@pytest.mark.django_db
def test_approve_requires_auth(client, store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = client.post(url)
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_approve_collaborator_with_permission_success(
    supporter_client, store, campaign, pending_content, supporter, approving_collaborator
):
    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = supporter_client.post(url)
    assert res.status_code == status.HTTP_200_OK

    pending_content.refresh_from_db()
    assert pending_content.approval_status == CampaignContent.ApprovalStatus.APPROVED
    assert pending_content.approved_by_id == supporter.id


@pytest.mark.django_db
def test_approve_collaborator_without_permission_forbidden(
    supporter_client, store, campaign, pending_content, viewing_collaborator
):
    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = supporter_client.post(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_approve_wrong_status_returns_422(auth_client, store, campaign, draft_content):
    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": draft_content.id,
        },
    )
    res = auth_client.post(url)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "BUSINESS_RULE_ERROR"


@pytest.mark.django_db
def test_approve_content_not_found(auth_client, store, campaign):
    import uuid

    url = reverse(
        "stores:campaigns:contents-approve",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": uuid.uuid4(),
        },
    )
    res = auth_client.post(url)
    assert res.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# reject (approval_pending → rejected)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_reject_success(auth_client, store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = auth_client.post(url, {"reason": "効果断定表現が含まれています。"}, format="json")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert data["approval_status"] == "rejected"

    pending_content.refresh_from_db()
    assert pending_content.approval_status == CampaignContent.ApprovalStatus.REJECTED
    assert pending_content.expression_check_result["rejection_reason"] == "効果断定表現が含まれています。"


@pytest.mark.django_db
def test_reject_requires_reason(auth_client, store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = auth_client.post(url, {}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_reject_requires_auth(client, store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = client.post(url, {"reason": "差戻し"}, format="json")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_reject_collaborator_with_permission_success(
    supporter_client, store, campaign, pending_content, approving_collaborator
):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = supporter_client.post(url, {"reason": "表現を再確認してください。"}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["approval_status"] == "rejected"


@pytest.mark.django_db
def test_reject_wrong_status_returns_422(auth_client, store, campaign, draft_content):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": store.id,
            "campaign_id": campaign.id,
            "content_id": draft_content.id,
        },
    )
    res = auth_client.post(url, {"reason": "差戻し理由"}, format="json")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "BUSINESS_RULE_ERROR"


@pytest.mark.django_db
def test_reject_other_store_forbidden(auth_client, other_store, campaign, pending_content):
    url = reverse(
        "stores:campaigns:contents-reject",
        kwargs={
            "store_id": other_store.id,
            "campaign_id": campaign.id,
            "content_id": pending_content.id,
        },
    )
    res = auth_client.post(url, {"reason": "差戻し"}, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN
