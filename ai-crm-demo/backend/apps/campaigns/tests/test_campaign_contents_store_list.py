import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store

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


@pytest.fixture
def instagram_campaign(store, user) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="Instagram認知施策",
        purpose=Campaign.Purpose.AWARENESS,
        channel=Campaign.Channel.INSTAGRAM,
    )


def _url(store_id, **params):
    url = reverse("stores:campaign-contents-list", kwargs={"store_id": store_id})
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return url


# ---------------------------------------------------------------------------
# 一覧取得
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_returns_store_contents(auth_client, store, campaign):
    approved = CampaignContent.objects.create(
        campaign=campaign,
        store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="再来店メッセージ",
        body="またお越しください。",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(approved.id) in ids


@pytest.mark.django_db
def test_list_response_fields(auth_client, store, campaign):
    content = CampaignContent.objects.create(
        campaign=campaign,
        store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="タイトル",
        body="本文テスト",
        expression_risk_level=CampaignContent.ExpressionRiskLevel.HIGH,
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id))
    assert res.status_code == status.HTTP_200_OK
    item = next(i for i in res.json()["data"] if i["id"] == str(content.id))
    assert item["campaign_id"] == str(campaign.id)
    assert item["campaign_title"] == campaign.name
    assert item["title"] == "タイトル"
    assert item["channel"] == Campaign.Channel.OFFICIAL_LINE
    assert item["approval_status"] == CampaignContent.ApprovalStatus.APPROVED
    assert item["expression_risk_level"] == CampaignContent.ExpressionRiskLevel.HIGH
    assert item["content_text"] == "本文テスト"


# ---------------------------------------------------------------------------
# approval_status 絞り込み
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_filter_approval_status_approved(auth_client, store, campaign):
    approved = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="承認済み",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    draft = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="下書き",
        approval_status=CampaignContent.ApprovalStatus.DRAFT,
    )
    res = auth_client.get(_url(store.id, approval_status="approved"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(approved.id) in ids
    assert str(draft.id) not in ids


@pytest.mark.django_db
def test_filter_approval_status_draft(auth_client, store, campaign):
    CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="承認済み",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    draft = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="下書き",
        approval_status=CampaignContent.ApprovalStatus.DRAFT,
    )
    res = auth_client.get(_url(store.id, approval_status="draft"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(draft.id) in ids
    assert len(ids) == 1


# ---------------------------------------------------------------------------
# channel 絞り込み
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_filter_channel_official_line(auth_client, store, campaign, instagram_campaign):
    line_content = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="LINE用",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    ig_content = CampaignContent.objects.create(
        campaign=instagram_campaign, store=store,
        content_type=CampaignContent.ContentType.INSTAGRAM, body="Instagram用",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id, channel="official_line"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(line_content.id) in ids
    assert str(ig_content.id) not in ids


# ---------------------------------------------------------------------------
# 店舗越境データ除外
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_cross_store_isolation(auth_client, store, other_store, other_user, campaign):
    other_campaign = Campaign.objects.create(
        store=other_store,
        owner_user=other_user,
        name="別店舗の施策",
        purpose=Campaign.Purpose.REPEAT,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )
    own_content = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="自店舗",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    other_content = CampaignContent.objects.create(
        campaign=other_campaign, store=other_store,
        content_type=CampaignContent.ContentType.LINE, body="他店舗",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(own_content.id) in ids
    assert str(other_content.id) not in ids


@pytest.mark.django_db
def test_cross_store_returns_403(auth_client, other_store):
    res = auth_client.get(_url(other_store.id))
    assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# 未認証拒否
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unauthenticated_returns_401(client, store):
    res = client.get(_url(store.id))
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# ページネーション
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_pagination(auth_client, store, campaign):
    for i in range(5):
        CampaignContent.objects.create(
            campaign=campaign, store=store,
            content_type=CampaignContent.ContentType.LINE,
            body=f"本文{i}",
            approval_status=CampaignContent.ApprovalStatus.APPROVED,
        )
    res = auth_client.get(_url(store.id, per_page=2, page=1))
    assert res.status_code == status.HTTP_200_OK
    body = res.json()
    assert len(body["data"]) == 2
    assert body["meta"]["total"] == 5
    assert body["meta"]["page"] == 1
    assert body["meta"]["per_page"] == 2

    res2 = auth_client.get(_url(store.id, per_page=2, page=2))
    assert res2.status_code == status.HTTP_200_OK
    assert len(res2.json()["data"]) == 2


# ---------------------------------------------------------------------------
# q検索
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_q_search_by_title(auth_client, store, campaign):
    matched = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="再来店キャンペーン", body="こちらは本文です。",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    unmatched = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="別のタイトル", body="別の本文。",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id, q="再来店"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(matched.id) in ids
    assert str(unmatched.id) not in ids


@pytest.mark.django_db
def test_q_search_by_body(auth_client, store, campaign):
    matched = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="タイトルA", body="ぜひご来店ください。",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    unmatched = CampaignContent.objects.create(
        campaign=campaign, store=store,
        content_type=CampaignContent.ContentType.LINE,
        title="タイトルB", body="お知らせです。",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id, q="ご来店"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(matched.id) in ids
    assert str(unmatched.id) not in ids


@pytest.mark.django_db
def test_q_search_by_campaign_name(auth_client, store, user):
    special_campaign = Campaign.objects.create(
        store=store, owner_user=user,
        name="特別夏キャンペーン",
        purpose=Campaign.Purpose.REPEAT,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )
    matched = CampaignContent.objects.create(
        campaign=special_campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="夏限定",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    other_campaign = Campaign.objects.create(
        store=store, owner_user=user,
        name="通常施策",
        purpose=Campaign.Purpose.REPEAT,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )
    unmatched = CampaignContent.objects.create(
        campaign=other_campaign, store=store,
        content_type=CampaignContent.ContentType.LINE, body="通常案内",
        approval_status=CampaignContent.ApprovalStatus.APPROVED,
    )
    res = auth_client.get(_url(store.id, q="特別夏"))
    assert res.status_code == status.HTTP_200_OK
    ids = [item["id"] for item in res.json()["data"]]
    assert str(matched.id) in ids
    assert str(unmatched.id) not in ids
