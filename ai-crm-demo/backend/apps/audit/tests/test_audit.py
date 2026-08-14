import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.audit.models import AuditLog, IncidentReport
from apps.customers.models import Customer
from apps.imports.models import ImportJob
from apps.stores.models import Store, StoreSettings


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
    store = Store.objects.create(
        tenant_id=user.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )
    StoreSettings.objects.create(store=store)
    return store


@pytest.fixture
def other_store(db, other_user: User) -> Store:
    return Store.objects.create(
        tenant_id=other_user.id,
        name="他社サロン",
        industry=Store.Industry.HAIR,
        area_label="難波",
        created_by=other_user,
    )


def _audit_list_url(store: Store):
    return reverse("stores:audit:list", kwargs={"store_id": store.id})


def _audit_detail_url(store: Store, audit_log: AuditLog):
    return reverse(
        "stores:audit:detail",
        kwargs={"store_id": store.id, "audit_log_id": audit_log.id},
    )


def _imports_url(store: Store):
    return reverse("stores:imports:list-create", kwargs={"store_id": store.id})


def _import_execute_url(store: Store, job: ImportJob):
    return reverse("stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id})


def _dashboard_url(store: Store):
    return reverse("stores:dashboard", kwargs={"store_id": store.id})


def _incidents_url(store: Store):
    return reverse("stores:incidents-list-create", kwargs={"store_id": store.id})


def _incident_detail_url(store: Store, incident: IncidentReport):
    return reverse("stores:incidents-detail", kwargs={"store_id": store.id, "incident_id": incident.id})


def _customer_consent_url(store: Store, customer: Customer):
    return reverse("stores:customers:consents", kwargs={"store_id": store.id, "customer_id": customer.id})


def _csv_file(name: str, content: bytes) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type="text/csv")


@pytest.mark.django_db
def test_list_audit_logs_is_scoped_to_store(auth_client: APIClient, store: Store, other_store: Store, user: User):
    own_log = AuditLog.objects.create(
        tenant_id=store.tenant_id,
        store=store,
        user=user,
        action=AuditLog.Action.CSV_UPLOADED,
        target_type="import_job",
    )
    AuditLog.objects.create(
        tenant_id=other_store.tenant_id,
        store=other_store,
        action=AuditLog.Action.CSV_UPLOADED,
        target_type="import_job",
    )

    resp = auth_client.get(_audit_list_url(store))

    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["id"] == str(own_log.id)


@pytest.mark.django_db
def test_get_audit_log_detail(auth_client: APIClient, store: Store, user: User):
    audit_log = AuditLog.objects.create(
        tenant_id=store.tenant_id,
        store=store,
        user=user,
        action=AuditLog.Action.STORE_UPDATED,
        target_type="store",
        target_id=store.id,
    )

    resp = auth_client.get(_audit_detail_url(store, audit_log))

    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["id"] == str(audit_log.id)


@pytest.mark.django_db
def test_csv_upload_and_execute_create_audit_logs(auth_client: APIClient, store: Store):
    payload = {
        "file": _csv_file("customers.csv", b"external_customer_id,display_name\nc001,Test Customer\n"),
        "import_type": "customers",
    }
    upload_resp = auth_client.post(_imports_url(store), payload, format="multipart")
    assert upload_resp.status_code == status.HTTP_201_CREATED
    job = ImportJob.objects.get(id=upload_resp.json()["data"]["id"])

    execute_resp = auth_client.post(_import_execute_url(store, job))
    assert execute_resp.status_code == status.HTTP_200_OK

    actions = list(AuditLog.objects.filter(store=store).values_list("action", flat=True))
    assert AuditLog.Action.CSV_UPLOADED in actions
    assert AuditLog.Action.CSV_IMPORT_EXECUTED in actions

    execute_log = AuditLog.objects.get(store=store, action=AuditLog.Action.CSV_IMPORT_EXECUTED)
    assert execute_log.after_snapshot["success_rows"] == 1
    assert execute_log.after_snapshot["error_rows"] == 0


@pytest.mark.django_db
def test_dashboard_creates_ai_diagnosis_audit_log(auth_client: APIClient, store: Store):
    resp = auth_client.get(_dashboard_url(store))

    assert resp.status_code == status.HTTP_200_OK
    audit_log = AuditLog.objects.get(store=store, action=AuditLog.Action.AI_DIAGNOSIS_EXECUTED)
    assert audit_log.target_type == "dashboard"
    assert audit_log.after_snapshot["diagnosis_type"] == "dashboard_mock"
    assert "main_issue" in audit_log.after_snapshot


@pytest.mark.django_db
def test_consent_update_creates_audit_log_without_personal_values(
    auth_client: APIClient,
    store: Store,
):
    customer = Customer.objects.create(
        store=store,
        display_name="テスト顧客",
        full_name="山田 太郎",
    )

    resp = auth_client.patch(
        _customer_consent_url(store, customer),
        {"contact_line_allowed": True, "analysis_allowed": False},
        format="json",
    )

    assert resp.status_code == status.HTTP_200_OK
    audit_log = AuditLog.objects.get(store=store, action=AuditLog.Action.CONSENT_UPDATED)
    assert audit_log.target_type == "customer_consent"
    assert audit_log.after_snapshot == {
        "changed_fields": ["analysis_allowed", "contact_line_allowed"]
    }
    assert "山田" not in str(audit_log.after_snapshot)


@pytest.mark.django_db
def test_incident_create_and_list_are_scoped_to_store(
    auth_client: APIClient,
    store: Store,
    other_store: Store,
):
    IncidentReport.objects.create(
        store=other_store,
        incident_type=IncidentReport.IncidentType.NEAR_MISS,
        severity=IncidentReport.Severity.HIGH,
        title="他店舗の記録",
    )
    resp = auth_client.post(
        _incidents_url(store),
        {
            "incident_type": "near_miss",
            "severity": "medium",
            "title": "配信前確認で対象者設定ミスを発見",
            "description": "個人情報を含まない運用記録",
            "action_note": "配信前チェックを追加",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["data"]["created_by_id"]

    list_resp = auth_client.get(_incidents_url(store))
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.json()["meta"]["total"] == 1
    assert list_resp.json()["data"][0]["title"] == "配信前確認で対象者設定ミスを発見"


@pytest.mark.django_db
def test_incident_update_status(auth_client: APIClient, store: Store):
    incident = IncidentReport.objects.create(
        store=store,
        incident_type=IncidentReport.IncidentType.INQUIRY,
        severity=IncidentReport.Severity.LOW,
        title="問い合わせ",
    )

    resp = auth_client.patch(
        _incident_detail_url(store, incident),
        {"status": "resolved", "action_note": "対応済み"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    incident.refresh_from_db()
    assert incident.status == IncidentReport.Status.RESOLVED
