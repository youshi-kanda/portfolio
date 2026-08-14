import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
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
        email="owner@example.com",
        name="オーナー",
        password="StrongPass123!",
    )


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create_user(
        email="other@example.com",
        name="別ユーザー",
        password="StrongPass123!",
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


def _csv_file(name: str = "test.csv", content: bytes = b"col1,col2\nval1,val2") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type="text/csv")


def _list_url(store):
    return reverse("stores:imports:list-create", kwargs={"store_id": store.id})


def _detail_url(store, job):
    return reverse("stores:imports:detail", kwargs={"store_id": store.id, "job_id": job.id})


def _errors_url(store, job):
    return reverse("stores:imports:errors", kwargs={"store_id": store.id, "job_id": job.id})


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/imports/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_import_job_customers(auth_client: APIClient, store: Store, user: User):
    payload = {
        "file": _csv_file("customers.csv"),
        "import_type": "customers",
    }
    resp = auth_client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["store_id"] == str(store.id)
    assert data["import_type"] == "customers"
    assert data["source_type"] == "csv"
    assert data["status"] == "pending"
    assert data["file_name"] == "customers.csv"
    assert data["executed_by"] == str(user.id)


@pytest.mark.django_db
def test_create_import_job_reservations(auth_client: APIClient, store: Store):
    payload = {
        "file": _csv_file("reservations.csv"),
        "import_type": "reservations",
    }
    resp = auth_client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["data"]["import_type"] == "reservations"


@pytest.mark.django_db
def test_create_import_job_sales(auth_client: APIClient, store: Store):
    payload = {
        "file": _csv_file("sales.csv"),
        "import_type": "sales",
    }
    resp = auth_client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["data"]["import_type"] == "sales"


@pytest.mark.django_db
def test_create_import_job_invalid_file_type(auth_client: APIClient, store: Store):
    excel_file = SimpleUploadedFile("data.xlsx", b"dummy", content_type="application/vnd.openxmlformats")
    payload = {"file": excel_file, "import_type": "customers"}
    resp = auth_client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_import_job_missing_file(auth_client: APIClient, store: Store):
    resp = auth_client.post(_list_url(store), {"import_type": "customers"}, format="multipart")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_import_job_missing_import_type(auth_client: APIClient, store: Store):
    payload = {"file": _csv_file()}
    resp = auth_client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_import_job_unauthenticated(client: APIClient, store: Store):
    payload = {"file": _csv_file(), "import_type": "customers"}
    resp = client.post(_list_url(store), payload, format="multipart")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_import_job_other_store_forbidden(auth_client: APIClient, other_store: Store):
    payload = {"file": _csv_file(), "import_type": "customers"}
    resp = auth_client.post(_list_url(other_store), payload, format="multipart")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/imports/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_import_jobs_own_store_only(auth_client: APIClient, store: Store, other_store: Store):
    ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    ImportJob.objects.create(store=other_store, import_type="sales", source_type="csv")
    resp = auth_client.get(_list_url(store))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_import_jobs_filter_import_type(auth_client: APIClient, store: Store):
    ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    ImportJob.objects.create(store=store, import_type="sales", source_type="csv")
    resp = auth_client.get(_list_url(store), {"import_type": "customers"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["import_type"] == "customers"


@pytest.mark.django_db
def test_list_import_jobs_filter_status(auth_client: APIClient, store: Store):
    ImportJob.objects.create(store=store, import_type="customers", source_type="csv", status="pending")
    ImportJob.objects.create(store=store, import_type="sales", source_type="csv", status="completed")
    resp = auth_client.get(_list_url(store), {"status": "completed"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["status"] == "completed"


@pytest.mark.django_db
def test_list_import_jobs_unauthenticated(client: APIClient, store: Store):
    resp = client.get(_list_url(store))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/imports/{job_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_import_job_detail(auth_client: APIClient, store: Store):
    job = ImportJob.objects.create(
        store=store, import_type="customers", source_type="csv", status="completed",
        total_rows=10, success_rows=9, error_rows=1,
    )
    resp = auth_client.get(_detail_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["id"] == str(job.id)
    assert data["total_rows"] == 10
    assert data["success_rows"] == 9
    assert data["error_rows"] == 1


@pytest.mark.django_db
def test_get_import_job_other_store_forbidden(auth_client: APIClient, other_store: Store):
    job = ImportJob.objects.create(store=other_store, import_type="customers", source_type="csv")
    url = reverse("stores:imports:detail", kwargs={"store_id": other_store.id, "job_id": job.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_nonexistent_import_job_404(auth_client: APIClient, store: Store):
    url = reverse("stores:imports:detail", kwargs={"store_id": store.id, "job_id": uuid.uuid4()})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_get_import_job_unauthenticated(client: APIClient, store: Store):
    job = ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    resp = client.get(_detail_url(store, job))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/imports/{job_id}/errors/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_import_errors(auth_client: APIClient, store: Store):
    job = ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        row_number=2,
        field_name="display_name",
        error_type="missing_required",
        error_message="display_nameは必須です。",
        raw_data={"raw": ",,090-0000-0001"},
    )
    ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        row_number=5,
        error_type="invalid_format",
        error_message="日付フォーマットが不正です。",
    )
    resp = auth_client.get(_errors_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 2
    errors = resp.json()["data"]
    assert errors[0]["row_number"] == 2
    assert errors[0]["error_type"] == "missing_required"
    assert errors[0]["raw_data"] == {"raw": ",,090-0000-0001"}


@pytest.mark.django_db
def test_get_import_errors_empty(auth_client: APIClient, store: Store):
    job = ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    resp = auth_client.get(_errors_url(store, job))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 0


@pytest.mark.django_db
def test_get_import_errors_other_store_forbidden(auth_client: APIClient, other_store: Store):
    job = ImportJob.objects.create(store=other_store, import_type="customers", source_type="csv")
    url = reverse("stores:imports:errors", kwargs={"store_id": other_store.id, "job_id": job.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_import_errors_unauthenticated(client: APIClient, store: Store):
    job = ImportJob.objects.create(store=store, import_type="customers", source_type="csv")
    resp = client.get(_errors_url(store, job))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
