import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer, CustomerConsent, CustomerProfile
from apps.imports.models import ImportError, ImportJob
from apps.stores.models import Store, StoreSettings

# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------


def _csv_upload(content: str, name: str = "customers.csv") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content.encode("utf-8"), content_type="text/csv")


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


def _pending_job(store: Store, content: str = "a,b\n1,2") -> ImportJob:
    f = SimpleUploadedFile("customers.csv", content.encode("utf-8"), content_type="text/csv")
    return ImportJob.objects.create(
        store=store,
        import_type=ImportJob.ImportType.CUSTOMERS,
        source_type=ImportJob.SourceType.CSV,
        file_name="customers.csv",
        file=f,
        status=ImportJob.Status.PENDING,
    )


def _execute_url(store: Store, job: ImportJob) -> str:
    return reverse("stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id})


# ---------------------------------------------------------------------------
# Execute endpoint — auth / permission checks
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_execute_unauthenticated(client: APIClient, store: Store):
    job  = _pending_job(store)
    resp = client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_execute_other_store_forbidden(auth_client: APIClient, other_store: Store):
    job  = _pending_job(other_store)
    url  = reverse(
        "stores:imports:execute",
        kwargs={"store_id": other_store.id, "job_id": job.id},
    )
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_execute_not_found(auth_client: APIClient, store: Store):
    url  = reverse(
        "stores:imports:execute",
        kwargs={"store_id": store.id, "job_id": uuid.uuid4()},
    )
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_execute_already_completed_returns_400(auth_client: APIClient, store: Store):
    job        = _pending_job(store)
    job.status = ImportJob.Status.COMPLETED
    job.save()
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Successful customer CSV import
# ---------------------------------------------------------------------------

VALID_CSV = """\
external_customer_id,full_name,kana,phone,email,acquisition_channel,\
first_visit_date,last_visit_date,visit_count,total_sales,\
contact_line_allowed,is_unsubscribed,note
C001,山田花子,ヤマダハナコ,090-1234-5678,hanako@example.com,Instagram,\
2026-02-10,2026-05-01,4,58000,はい,いいえ,常連さん
C002,佐藤美咲,,080-1111-2222,,紹介,2026-04-12,2026-04-12,1,9800,はい,いいえ,
"""


@pytest.mark.django_db
def test_execute_creates_customers(auth_client: APIClient, store: Store):
    job  = _pending_job(store, VALID_CSV)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["status"] == "completed"
    assert data["total_rows"] == 2
    assert data["success_rows"] == 2
    assert data["error_rows"] == 0

    assert Customer.objects.filter(store=store).count() == 2


@pytest.mark.django_db
def test_execute_customer_fields_mapped(auth_client: APIClient, store: Store):
    job = _pending_job(store, VALID_CSV)
    auth_client.post(_execute_url(store, job))

    c = Customer.objects.get(store=store, external_customer_id="C001")
    assert c.full_name == "山田花子"
    assert c.kana == "ヤマダハナコ"
    assert c.phone == "090-1234-5678"
    assert c.email == "hanako@example.com"
    assert c.acquisition_channel == "Instagram"

    profile = c.profile
    assert str(profile.first_visit_date) == "2026-02-10"
    assert str(profile.last_visit_date) == "2026-05-01"
    assert profile.visit_count == 4
    assert profile.total_sales == 58000
    assert profile.note == "常連さん"

    consent = c.consent
    assert consent.contact_line_allowed is True
    assert consent.is_unsubscribed is False


@pytest.mark.django_db
def test_execute_creates_consent_for_unsubscribed(auth_client: APIClient, store: Store):
    csv_content = (
        "external_customer_id,phone,is_unsubscribed\n"
        "C010,090-9999-0001,はい\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    c       = Customer.objects.get(store=store, external_customer_id="C010")
    consent = c.consent
    assert consent.is_unsubscribed is True
    assert consent.unsubscribed_at is not None


# ---------------------------------------------------------------------------
# Deduplication (upsert)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_execute_updates_existing_customer_by_external_id(auth_client: APIClient, store: Store):
    Customer.objects.create(
        store=store, external_customer_id="C001", full_name="旧名", phone="090-0000-0000"
    )
    csv_content = (
        "external_customer_id,full_name,phone\n"
        "C001,山田花子,090-1234-5678\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    assert Customer.objects.filter(store=store).count() == 1
    c = Customer.objects.get(store=store, external_customer_id="C001")
    assert c.full_name == "山田花子"
    assert c.phone == "090-1234-5678"


@pytest.mark.django_db
def test_execute_updates_existing_customer_by_phone(auth_client: APIClient, store: Store):
    Customer.objects.create(store=store, phone="090-1234-5678", full_name="旧名")
    csv_content = (
        "full_name,phone\n"
        "新名,090-1234-5678\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    assert Customer.objects.filter(store=store).count() == 1
    assert Customer.objects.get(store=store, phone="090-1234-5678").full_name == "新名"


@pytest.mark.django_db
def test_execute_updates_existing_customer_by_email(auth_client: APIClient, store: Store):
    Customer.objects.create(store=store, email="test@example.com", full_name="旧名")
    csv_content = (
        "full_name,email\n"
        "新名,test@example.com\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    assert Customer.objects.filter(store=store).count() == 1
    assert Customer.objects.get(store=store, email="test@example.com").full_name == "新名"


# ---------------------------------------------------------------------------
# Identifier missing → error row
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_execute_missing_identifier_records_error(auth_client: APIClient, store: Store):
    csv_content = (
        "full_name,note\n"
        ",メモだけ\n"
    )
    job  = _pending_job(store, csv_content)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.MISSING_REQUIRED
    assert err.row_number == 2


# ---------------------------------------------------------------------------
# Boolean & date parsing
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_bool_parsing_various_formats(auth_client: APIClient, store: Store):
    csv_content = (
        "phone,contact_line_allowed,contact_email_allowed,contact_sms_allowed\n"
        "090-1111-0001,1,FALSE,いいえ\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    c       = Customer.objects.get(store=store, phone="090-1111-0001")
    consent = c.consent
    assert consent.contact_line_allowed is True
    assert consent.contact_email_allowed is False
    assert consent.contact_sms_allowed is False


@pytest.mark.django_db
def test_date_parsing_slash_format(auth_client: APIClient, store: Store):
    csv_content = (
        "phone,first_visit_date,last_visit_date\n"
        "090-2222-0001,2026/02/10,2026/05/01\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    c = Customer.objects.get(store=store, phone="090-2222-0001")
    assert str(c.profile.first_visit_date) == "2026-02-10"
    assert str(c.profile.last_visit_date) == "2026-05-01"


@pytest.mark.django_db
def test_amount_parsing_with_comma_and_yen(auth_client: APIClient, store: Store):
    csv_content = (
        "phone,total_sales\n"
        '090-3333-0001,"¥58,000"\n'
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    c = Customer.objects.get(store=store, phone="090-3333-0001")
    assert c.profile.total_sales == 58000


# ---------------------------------------------------------------------------
# Mixed valid + error rows
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_execute_partial_success(auth_client: APIClient, store: Store):
    csv_content = (
        "external_customer_id,full_name,phone\n"
        "C001,山田,090-1234-5678\n"
        ",,\n"                      # no identifier → error
        "C003,田中,090-9999-9999\n"
    )
    job  = _pending_job(store, csv_content)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["total_rows"] == 3
    assert data["success_rows"] == 2
    assert data["error_rows"] == 1
    assert Customer.objects.filter(store=store).count() == 2


# ---------------------------------------------------------------------------
# Store isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_execute_does_not_affect_other_store(
    auth_client: APIClient, store: Store, other_store: Store
):
    Customer.objects.create(
        store=other_store, phone="090-1234-5678", full_name="他店顧客"
    )
    csv_content = (
        "phone,full_name\n"
        "090-1234-5678,自店顧客\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))

    # own store gets a new customer
    assert Customer.objects.filter(store=store).count() == 1
    assert Customer.objects.get(store=store).full_name == "自店顧客"
    # other store is untouched
    assert Customer.objects.get(store=other_store).full_name == "他店顧客"


# ---------------------------------------------------------------------------
# Gender mapping
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_gender_mapping_japanese(auth_client: APIClient, store: Store):
    csv_content = (
        "phone,gender\n"
        "090-4444-0001,女性\n"
    )
    job = _pending_job(store, csv_content)
    auth_client.post(_execute_url(store, job))
    c = Customer.objects.get(store=store, phone="090-4444-0001")
    assert c.profile.gender == "female"
