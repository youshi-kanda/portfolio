import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.imports.models import ImportError, ImportJob
from apps.sales.models import Sale
from apps.stores.models import Store, StoreSettings

# ---------------------------------------------------------------------------
# Helpers / Fixtures
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
    f = SimpleUploadedFile("sales.csv", content.encode("utf-8"), content_type="text/csv")
    return ImportJob.objects.create(
        store=store,
        import_type=ImportJob.ImportType.SALES,
        source_type=ImportJob.SourceType.CSV,
        file_name="sales.csv",
        file=f,
        status=ImportJob.Status.PENDING,
    )


def _execute_url(store: Store, job: ImportJob) -> str:
    return reverse("stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id})


# ---------------------------------------------------------------------------
# Normal: minimal row (sale_date + amount only)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_minimal_row_creates_sale(auth_client: APIClient, store: Store):
    csv = "sale_date,amount\n2026-05-01,5000\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["success_rows"] == 1
    assert data["error_rows"] == 0
    s = Sale.objects.get(store=store)
    assert s.sale_date.isoformat() == "2026-05-01"
    assert s.amount == 5000
    assert s.customer is None


# ---------------------------------------------------------------------------
# Normal: customer lookup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_lookup_by_external_customer_id(
    auth_client: APIClient, store: Store, customer: Customer
):
    csv = "external_customer_id,sale_date,amount\nC001,2026-05-01,8000\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.customer_id == customer.id


@pytest.mark.django_db
def test_customer_lookup_by_phone(
    auth_client: APIClient, store: Store, customer: Customer
):
    csv = "phone,sale_date,amount\n090-1234-5678,2026-05-01,3000\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.customer_id == customer.id


@pytest.mark.django_db
def test_unknown_customer_creates_sale_with_null_customer(
    auth_client: APIClient, store: Store
):
    csv = "external_customer_id,sale_date,amount\nUNKNOWN,2026-05-01,5000\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["success_rows"] == 1
    assert data["error_rows"] == 0
    s = Sale.objects.get(store=store)
    assert s.customer is None


# ---------------------------------------------------------------------------
# Normal: optional fields mapped
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_optional_fields_mapped(auth_client: APIClient, store: Store):
    csv = (
        "sale_date,amount,payment_method,item_category,item_name_snapshot,"
        "ticket_remaining_count,contract_status\n"
        "2026-05-01,12000,card,service,フェイシャル60分,5,active\n"
    )
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.payment_method == Sale.PaymentMethod.CARD
    assert s.item_category == Sale.ItemCategory.SERVICE
    assert s.item_name_snapshot == "フェイシャル60分"
    assert s.ticket_remaining_count == 5
    assert s.contract_status == Sale.ContractStatus.ACTIVE


@pytest.mark.django_db
def test_payment_method_japanese_cash(auth_client: APIClient, store: Store):
    csv = "sale_date,amount,payment_method\n2026-05-01,3000,現金\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.payment_method == Sale.PaymentMethod.CASH


@pytest.mark.django_db
def test_item_category_japanese_回数券(auth_client: APIClient, store: Store):
    csv = "sale_date,amount,item_category\n2026-05-01,30000,回数券\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.item_category == Sale.ItemCategory.TICKET


@pytest.mark.django_db
def test_amount_with_yen_symbol_and_comma(auth_client: APIClient, store: Store):
    csv = 'sale_date,amount\n2026-05-01,"¥12,000"\n'
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))
    s = Sale.objects.get(store=store)
    assert s.amount == 12000


# ---------------------------------------------------------------------------
# Error: missing sale_date
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_missing_sale_date_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount\n,5000\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0
    assert Sale.objects.filter(store=store).count() == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.MISSING_REQUIRED
    assert err.field_name == "sale_date"
    assert err.row_number == 2


@pytest.mark.django_db
def test_invalid_sale_date_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount\nnot-a-date,5000\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert Sale.objects.filter(store=store).count() == 0


# ---------------------------------------------------------------------------
# Error: missing amount
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_missing_amount_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount\n2026-05-01,\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.MISSING_REQUIRED
    assert err.field_name == "amount"


@pytest.mark.django_db
def test_invalid_amount_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount\n2026-05-01,abc\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert Sale.objects.filter(store=store).count() == 0


# ---------------------------------------------------------------------------
# Error: invalid payment_method
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_invalid_payment_method_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount,payment_method\n2026-05-01,5000,bitcoin\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1
    assert data["success_rows"] == 0

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.INVALID_FORMAT
    assert err.field_name == "payment_method"


# ---------------------------------------------------------------------------
# Error: invalid item_category
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_invalid_item_category_records_error(auth_client: APIClient, store: Store):
    csv = "sale_date,amount,item_category\n2026-05-01,5000,invalid_cat\n"
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["error_rows"] == 1

    err = ImportError.objects.get(import_job=job)
    assert err.error_type == ImportError.ErrorType.INVALID_FORMAT
    assert err.field_name == "item_category"


# ---------------------------------------------------------------------------
# Mixed valid + error rows
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_partial_success(auth_client: APIClient, store: Store):
    csv = (
        "sale_date,amount\n"
        "2026-05-01,5000\n"
        ",3000\n"               # missing date → error
        "2026-05-03,8000\n"
    )
    job  = _pending_job(store, csv)
    resp = auth_client.post(_execute_url(store, job))
    data = resp.json()["data"]
    assert data["total_rows"] == 3
    assert data["success_rows"] == 2
    assert data["error_rows"] == 1
    assert Sale.objects.filter(store=store).count() == 2


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
    csv = "external_customer_id,sale_date,amount\nC001,2026-05-01,5000\n"
    job  = _pending_job(store, csv)
    auth_client.post(_execute_url(store, job))

    s = Sale.objects.get(store=store)
    assert s.customer is None  # other_store's customer must not be linked
