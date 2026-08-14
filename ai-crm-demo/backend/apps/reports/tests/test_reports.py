import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store

from ..models import Report

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
def report(store, user) -> Report:
    return Report.objects.create(
        store=store,
        report_type=Report.ReportType.MONTHLY,
        title="2026年4月 月次レポート",
        period_start="2026-04-01",
        period_end="2026-04-30",
        summary="4月の月次レポートです。",
        body_markdown="## 4月レポート\n\nテスト内容",
        generated_by_ai=True,
        status=Report.Status.DRAFT,
        contains_personal_data=False,
        created_by=user,
    )


def _list_url(store_id) -> str:
    return reverse("stores:reports:list", kwargs={"store_id": store_id})


def _detail_url(store_id, report_id) -> str:
    return reverse("stores:reports:detail", kwargs={"store_id": store_id, "report_id": report_id})


def _generate_url(store_id) -> str:
    return reverse("stores:reports:monthly-generate", kwargs={"store_id": store_id})


# ---------------------------------------------------------------------------
# GET /reports/
# ---------------------------------------------------------------------------


class TestReportList:
    @pytest.mark.django_db
    def test_list_empty(self, auth_client, store):
        res = auth_client.get(_list_url(store.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"] == []
        assert res.data["meta"]["total"] == 0

    @pytest.mark.django_db
    def test_list_returns_reports(self, auth_client, store, report):
        res = auth_client.get(_list_url(store.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.data["meta"]["total"] == 1
        assert res.data["data"][0]["title"] == report.title

    @pytest.mark.django_db
    def test_list_unauthenticated(self, client, store):
        res = client.get(_list_url(store.id))
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_list_other_store_forbidden(self, auth_client, other_store):
        res = auth_client.get(_list_url(other_store.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /reports/{report_id}/
# ---------------------------------------------------------------------------


class TestReportDetail:
    @pytest.mark.django_db
    def test_get_detail(self, auth_client, store, report):
        res = auth_client.get(_detail_url(store.id, report.id))
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert data["id"] == str(report.id)
        assert data["body_markdown"] == report.body_markdown

    @pytest.mark.django_db
    def test_get_nonexistent(self, auth_client, store):
        import uuid
        res = auth_client.get(_detail_url(store.id, uuid.uuid4()))
        assert res.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_get_other_store_forbidden(self, auth_client, other_store):
        other_report = Report.objects.create(
            store=other_store,
            report_type=Report.ReportType.MONTHLY,
            title="別店舗レポート",
            generated_by_ai=False,
            status=Report.Status.DRAFT,
            contains_personal_data=False,
        )
        res = auth_client.get(_detail_url(other_store.id, other_report.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# POST /reports/monthly/generate/
# ---------------------------------------------------------------------------


class TestMonthlyReportGenerate:
    @pytest.mark.django_db
    def test_generate_creates_report(self, auth_client, store):
        payload = {"period_start": "2026-04-01", "period_end": "2026-04-30"}
        res = auth_client.post(_generate_url(store.id), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]
        assert data["report_type"] == Report.ReportType.MONTHLY
        assert data["generated_by_ai"] is True
        assert "summary" in data
        assert "highlights" in data
        assert isinstance(data["highlights"], list)
        assert isinstance(data["next_month_actions"], list)
        assert data["confidence"] in ("high", "medium", "low")

    @pytest.mark.django_db
    def test_generate_saves_to_db(self, auth_client, store):
        payload = {"period_start": "2026-04-01", "period_end": "2026-04-30"}
        res = auth_client.post(_generate_url(store.id), payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert Report.objects.filter(store=store, report_type=Report.ReportType.MONTHLY).exists()

    @pytest.mark.django_db
    def test_generate_invalid_period(self, auth_client, store):
        payload = {"period_start": "2026-04-30", "period_end": "2026-04-01"}
        res = auth_client.post(_generate_url(store.id), payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_generate_missing_fields(self, auth_client, store):
        res = auth_client.post(_generate_url(store.id), {}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_generate_unauthenticated(self, client, store):
        payload = {"period_start": "2026-04-01", "period_end": "2026-04-30"}
        res = client.post(_generate_url(store.id), payload, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_generate_other_store_forbidden(self, auth_client, other_store):
        payload = {"period_start": "2026-04-01", "period_end": "2026-04-30"}
        res = auth_client.post(_generate_url(other_store.id), payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
