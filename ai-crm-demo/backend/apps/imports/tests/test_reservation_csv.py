import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils.timezone import localtime
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.imports.models import ImportError, ImportJob
from apps.reservations.models import Reservation
from apps.stores.models import Store, StoreSettings

# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------


def _csv_upload(content: str, name: str = "reservations.csv") -> SimpleUploadedFile:
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


@pytest.fixture
def customer(db, store: Store) -> Customer:
    return Customer.objects.create(
        store=store,
        external_customer_id="C001",
        full_name="山田花子",
        phone="090-1234-5678",
    )


def _pending_job(store: Store, content: str) -> ImportJob:
    f = SimpleUploadedFile("reservations.csv", content.encode("utf-8"), content_type="text/csv")
    return ImportJob.objects.create(
        store=store,
        import_type=ImportJob.ImportType.RESERVATIONS,
        source_type=ImportJob.SourceType.CSV,
        file_name="reservations.csv",
        file=f,
        status=ImportJob.Status.PENDING,
    )


def _execute_url(store: Store, job: ImportJob) -> str:
    return reverse("stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id})


# ---------------------------------------------------------------------------
# Normal: status mapping (Japanese → internal value)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_status_visited_japanese(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-01,来店済み\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.VISITED


@pytest.mark.django_db
def test_status_reserved_japanese(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-10,予約済み\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.RESERVED


@pytest.mark.django_db
def test_status_cancelled_japanese(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-10,キャンセル\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.CANCELLED


@pytest.mark.django_db
def test_status_no_show_japanese(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-10,無断キャンセル\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.NO_SHOW


@pytest.mark.django_db
def test_status_施術済み_maps_to_visited(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-10,施術済み\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.VISITED


@pytest.mark.django_db
def test_status_未来予約_maps_to_reserved(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-10,未来予約\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.status == Reservation.Status.RESERVED


# ---------------------------------------------------------------------------
# Normal: customer lookup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_lookup_by_external_customer_id(
    auth_client: APIClient, store: Store, customer: Customer
):
    csv = "external_customer_id,reservation_date,status\nC001,2026-05-01,visited\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.customer_id == customer.id


@pytest.mark.django_db
def test_customer_lookup_by_phone(
    auth_client: APIClient, store: Store, customer: Customer
):
    csv = "phone,reservation_date,status\n090-1234-5678,2026-05-01,visited\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.customer_id == customer.id


@pytest.mark.django_db
def test_customer_not_found_creates_reservation_with_null_customer(
    auth_client: APIClient, store: Store
):
    csv = "external_customer_id,reservation_date,status\nUNKNOWN_ID,2026-05-01,visited\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["success_rows"] == 1
    assert data["error_rows"] == 0
    r = Reservation.objects.get(store=store)
    assert r.customer is None


# ---------------------------------------------------------------------------
# Normal: datetime parsing
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_datetime_with_time(auth_client: APIClient, store: Store):
    csv = "reservation_date,visit_date,status\n2026-05-01 14:00,2026-05-01 14:30,visited\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    local_start = localtime(r.scheduled_start_at)
    assert local_start.hour == 14
    assert local_start.minute == 0
    assert r.visited_at is not None
    assert localtime(r.visited_at).minute == 30


@pytest.mark.django_db
def test_datetime_date_only(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-01,reserved\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    local_start = localtime(r.scheduled_start_at)
    assert local_start.year == 2026
    assert local_start.month == 5
    assert local_start.day == 1


@pytest.mark.django_db
def test_datetime_slash_format(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026/05/01 10:00,reserved\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert localtime(r.scheduled_start_at).hour == 10


# ---------------------------------------------------------------------------
# Normal: optional fields mapped
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_optional_fields_mapped(auth_client: APIClient, store: Store):
    csv = (
        "external_reservation_id,reservation_date,status,"
        "menu_name,cancel_reason,next_reservation_date\n"
        "R001,2026-05-01,キャンセル,フェイシャル60分,都合が合わず,2026-06-01\n"
    )
    job = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    r = Reservation.objects.get(store=store)
    assert r.external_reservation_id == "R001"
    assert r.menu_name_snapshot == "フェイシャル60分"
    assert r.cancellation_reason == "都合が合わず"
    assert r.has_next_reservation is True


# ---------------------------------------------------------------------------
# Duplicate skip
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_duplicate_external_reservation_id_skipped(auth_client: APIClient, store: Store):
    Reservation.objects.create(
        store=store,
        external_reservation_id="R001",
        scheduled_start_at="2026-05-01T10:00:00+09:00",
        status=Reservation.Status.VISITED,
    )
    csv = "external_reservation_id,reservation_date,status\nR001,2026-05-02,reserved\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0
    assert Reservation.objects.filter(store=store).count() == 1

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.DUPLICATED
    assert err.field_name == "external_reservation_id"


# ---------------------------------------------------------------------------
# Missing required: reservation_date
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_missing_reservation_date_records_error(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n,visited\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0
    assert Reservation.objects.filter(store=store).count() == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.MISSING_REQUIRED
    assert err.field_name == "reservation_date"
    assert err.row_number == 2


@pytest.mark.django_db
def test_invalid_reservation_date_records_error(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\nnot-a-date,visited\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert Reservation.objects.filter(store=store).count() == 0


# ---------------------------------------------------------------------------
# Missing required: status
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_missing_status_records_error(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-01,\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.MISSING_REQUIRED
    assert err.field_name == "status"


# ---------------------------------------------------------------------------
# Invalid status value
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_invalid_status_value_records_error(auth_client: APIClient, store: Store):
    csv = "reservation_date,status\n2026-05-01,invalid_status\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0
    assert Reservation.objects.filter(store=store).count() == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.INVALID_FORMAT
    assert err.field_name == "status"


# ---------------------------------------------------------------------------
# Mixed valid + error rows
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_partial_success(auth_client: APIClient, store: Store):
    csv = (
        "reservation_date,status\n"
        "2026-05-01,visited\n"
        ",visited\n"          # missing date → error
        "2026-05-03,reserved\n"
    )
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["total_rows"] == 3
    assert data["success_rows"] == 2
    assert data["error_rows"] == 1
    assert Reservation.objects.filter(store=store).count() == 2


# ---------------------------------------------------------------------------
# Store isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_lookup_does_not_cross_stores(
    auth_client: APIClient, store: Store, other_store: Store
):
    Customer.objects.create(
        store=other_store,
        external_customer_id="C001",
        full_name="他店顧客",
    )
    csv = "external_customer_id,reservation_date,status\nC001,2026-05-01,visited\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))

    r = Reservation.objects.get(store=store)
    assert r.customer is None  # other_store's customer must not be linked
