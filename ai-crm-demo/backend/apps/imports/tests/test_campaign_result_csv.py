import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.campaigns.models import Campaign, CampaignResult
from apps.imports.models import ImportError, ImportJob
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
        email="owner@example.com", name="オーナー", password="StrongPass123!"
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
def other_store(db) -> Store:
    other = User.objects.create_user(
        email="other@example.com", name="別オーナー", password="StrongPass123!"
    )
    return Store.objects.create(
        tenant_id=other.id,
        name="別の店舗",
        industry=Store.Industry.HAIR,
        area_label="難波",
        created_by=other,
    )


@pytest.fixture
def campaign(store: Store, user: User) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="休眠復帰LINE施策",
        purpose=Campaign.Purpose.DORMANT_REACTIVATION,
        channel=Campaign.Channel.OFFICIAL_LINE,
        status=Campaign.Status.EXECUTED,
    )


def _pending_job(store: Store, content: str) -> ImportJob:
    f = SimpleUploadedFile(
        "campaign_results.csv", content.encode("utf-8"), content_type="text/csv"
    )
    return ImportJob.objects.create(
        store=store,
        import_type=ImportJob.ImportType.CAMPAIGN_RESULTS,
        source_type=ImportJob.SourceType.CSV,
        file_name="campaign_results.csv",
        file=f,
        status=ImportJob.Status.PENDING,
    )


def _execute_url(store: Store, job: ImportJob) -> str:
    return reverse(
        "stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id}
    )


# ---------------------------------------------------------------------------
# 正常系
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_result_from_csv(auth_client: APIClient, store: Store, campaign: Campaign):
    csv = (
        "campaign_id,campaign_name,delivered_count,reply_count,reservation_count,"
        "visit_count,sales_amount,memo\n"
        f"{campaign.id},休眠復帰LINE施策,30,6,4,3,36000,季節訴求の反応良好\n"
    )
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["success_rows"] == 1
    assert data["error_rows"] == 0

    result = CampaignResult.objects.get(campaign=campaign)
    assert result.sent_count == 30
    assert result.reply_count == 6
    assert result.reservation_count == 4
    assert result.visit_count == 3
    assert int(result.revenue_amount) == 36000
    assert result.memo == "季節訴求の反応良好"

    campaign.refresh_from_db()
    assert campaign.status == Campaign.Status.REVIEWED


@pytest.mark.django_db
def test_partial_columns_only(auth_client: APIClient, store: Store, campaign: Campaign):
    csv = f"campaign_id,visit_count\n{campaign.id},5\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["success_rows"] == 1

    result = CampaignResult.objects.get(campaign=campaign)
    assert result.visit_count == 5
    assert result.sent_count is None


@pytest.mark.django_db
def test_update_existing_result(auth_client: APIClient, store: Store, campaign: Campaign):
    CampaignResult.objects.create(
        campaign=campaign, store_id=store.id, sent_count=20, visit_count=2
    )
    csv = f"campaign_id,delivered_count,visit_count\n{campaign.id},50,10\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK

    assert CampaignResult.objects.filter(campaign=campaign).count() == 1
    result = CampaignResult.objects.get(campaign=campaign)
    assert result.sent_count == 50
    assert result.visit_count == 10


@pytest.mark.django_db
def test_multiple_rows(auth_client: APIClient, store: Store, user: User):
    c1 = Campaign.objects.create(
        store=store, owner_user=user, name="施策A",
        purpose=Campaign.Purpose.REPEAT, channel=Campaign.Channel.OFFICIAL_LINE,
    )
    c2 = Campaign.objects.create(
        store=store, owner_user=user, name="施策B",
        purpose=Campaign.Purpose.FIRST_FOLLOWUP, channel=Campaign.Channel.OFFICIAL_LINE,
    )
    csv = (
        "campaign_id,visit_count\n"
        f"{c1.id},3\n"
        f"{c2.id},7\n"
    )
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["success_rows"] == 2
    assert data["error_rows"] == 0
    assert CampaignResult.objects.filter(campaign__store=store).count() == 2


# ---------------------------------------------------------------------------
# エラー系
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_missing_campaign_id(auth_client: APIClient, store: Store):
    csv = "visit_count,memo\n5,テスト\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0
    err = ImportError.objects.get(import_job__id=job.id)
    assert err.field_name == "campaign_id"
    assert "必須" in err.error_message


@pytest.mark.django_db
def test_unknown_campaign_id(auth_client: APIClient, store: Store):
    import uuid
    csv = f"campaign_id,visit_count\n{uuid.uuid4()},5\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    err = ImportError.objects.get(import_job__id=job.id)
    assert err.field_name == "campaign_id"
    assert "見つかりません" in err.error_message


@pytest.mark.django_db
def test_invalid_uuid_format(auth_client: APIClient, store: Store):
    csv = "campaign_id,visit_count\nnot-a-uuid,5\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["error_rows"] == 1


@pytest.mark.django_db
def test_other_store_campaign_not_found(
    auth_client: APIClient, store: Store, other_store: Store
):
    other_user = other_store.created_by
    other_campaign = Campaign.objects.create(
        store=other_store, owner_user=other_user, name="他店舗施策",
        purpose=Campaign.Purpose.REPEAT, channel=Campaign.Channel.OFFICIAL_LINE,
    )
    csv = f"campaign_id,visit_count\n{other_campaign.id},5\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["error_rows"] == 1
    assert not CampaignResult.objects.filter(campaign=other_campaign).exists()
