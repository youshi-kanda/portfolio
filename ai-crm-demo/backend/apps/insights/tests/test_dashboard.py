from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.insights.models import CustomerInsight
from apps.reservations.models import Reservation
from apps.sales.models import Sale
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


def _customer(store: Store, **kwargs) -> Customer:
    return Customer.objects.create(store=store, display_name="テスト顧客", **kwargs)


def _insight(store: Store, customer: Customer, state: str) -> CustomerInsight:
    return CustomerInsight.objects.create(
        store_id=store.id,
        customer=customer,
        insight_date=date.today(),
        customer_state=state,
        priority=CustomerInsight.Priority.MEDIUM,
        evidence_summary="テスト",
        ai_confidence=CustomerInsight.Confidence.MEDIUM,
    )


def _sale(store: Store, customer: Customer, amount: int, sale_date=None) -> Sale:
    return Sale.objects.create(
        store=store,
        customer=customer,
        sale_date=sale_date or date.today(),
        amount=amount,
    )


def _reservation(
    store: Store,
    customer: Customer,
    visited: bool = True,
    menu_name: str = "",
    scheduled_start_at=None,
) -> Reservation:
    now = timezone.now()
    scheduled_at = scheduled_start_at or now
    return Reservation.objects.create(
        store=store,
        customer=customer,
        scheduled_start_at=scheduled_at,
        status=Reservation.Status.VISITED if visited else Reservation.Status.RESERVED,
        visited_at=now if visited else None,
        menu_name_snapshot=menu_name or None,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDashboardView:
    url_name = "stores:dashboard"

    def _url(self, store_id) -> str:
        return reverse(self.url_name, kwargs={"store_id": store_id})

    # --- 正常系 ---

    def test_empty_store(self, auth_client: APIClient, store: Store) -> None:
        resp = auth_client.get(self._url(store.id))
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert data["total_customers"] == 0
        assert data["active_customers"] == 0
        assert data["at_risk_customers"] == 0
        assert data["dormant_customers"] == 0
        assert data["pre_dormant_customers"] == 0
        assert data["repeat_customers"] == 0
        assert data["after_first_visit_follow_targets"] == 0
        assert data["new_customers_this_month"] == 0
        assert data["total_sales_this_month"] == 0
        assert data["visit_count_this_month"] == 0
        assert data["average_spend_per_visit"] == 0
        assert data["top_menus"] == []
        assert data["ai_diagnosis"]["main_issue"] == "顧客データ不足"
        assert data["ai_diagnosis"]["confidence"] == "low"
        assert data["weekly_actions"][0]["id"] == "import_customer_data"

    def test_customer_counts(self, auth_client: APIClient, store: Store) -> None:
        c1 = _customer(store)
        c2 = _customer(store)
        c3 = _customer(store)
        c4 = _customer(store)
        c5 = _customer(store)

        _insight(store, c1, CustomerInsight.CustomerState.REPEATER)
        _insight(store, c2, CustomerInsight.CustomerState.HIGH_RISK)
        _insight(store, c3, CustomerInsight.CustomerState.DORMANT)
        _insight(store, c5, CustomerInsight.CustomerState.PRE_DORMANT)
        # c4 has no insight

        resp = auth_client.get(self._url(store.id))
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert data["total_customers"] == 5
        assert data["active_customers"] == 1
        assert data["at_risk_customers"] == 2
        assert data["dormant_customers"] == 1
        assert data["pre_dormant_customers"] == 1
        assert data["repeat_customers"] == 1

    def test_deleted_customers_excluded(self, auth_client: APIClient, store: Store) -> None:
        _customer(store)
        _customer(store, deleted_at=timezone.now())

        resp = auth_client.get(self._url(store.id))
        assert resp.json()["data"]["total_customers"] == 1

    def test_sales_and_visits_this_month(self, auth_client: APIClient, store: Store) -> None:
        c = _customer(store)
        _sale(store, c, 10000)
        _sale(store, c, 20000)
        # 先月分は集計されない
        last_month = date.today().replace(day=1) - timedelta(days=1)
        _sale(store, c, 99999, sale_date=last_month)

        _reservation(store, c, visited=True)
        _reservation(store, c, visited=False)  # 予約済み（来店なし）

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        assert data["total_sales_this_month"] == 30000
        assert data["visit_count_this_month"] == 1
        assert data["average_spend_per_visit"] == 30000

    def test_average_spend_per_visit_zero_without_visits(
        self, auth_client: APIClient, store: Store
    ) -> None:
        c = _customer(store)
        _sale(store, c, 10000)

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        assert data["total_sales_this_month"] == 10000
        assert data["visit_count_this_month"] == 0
        assert data["average_spend_per_visit"] == 0

    def test_after_first_visit_follow_targets(
        self, auth_client: APIClient, store: Store
    ) -> None:
        target = _customer(store)
        reserved = _customer(store)
        repeater = _customer(store)

        _insight(store, target, CustomerInsight.CustomerState.AFTER_FIRST_VISIT)
        _insight(store, reserved, CustomerInsight.CustomerState.AFTER_FIRST_VISIT)
        _insight(store, repeater, CustomerInsight.CustomerState.REPEATER)
        _reservation(
            store,
            reserved,
            visited=False,
            scheduled_start_at=timezone.now() + timedelta(days=7),
        )

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        assert data["after_first_visit_follow_targets"] == 1
        assert data["ai_diagnosis"]["priority"] == "high"
        assert data["weekly_actions"][0]["id"] == "follow_after_first_visit"
        assert data["weekly_actions"][0]["priority"] == "high"
        assert "同意状態と配信停止状態を確認してください。" in data["weekly_actions"][0]["cautions"]

    def test_top_menus(self, auth_client: APIClient, store: Store) -> None:
        c = _customer(store)
        for _ in range(3):
            _reservation(store, c, menu_name="60分コース")
        for _ in range(2):
            _reservation(store, c, menu_name="30分コース")
        _reservation(store, c, menu_name="90分コース")

        resp = auth_client.get(self._url(store.id))
        top = resp.json()["data"]["top_menus"]
        assert len(top) <= 3
        assert top[0]["name"] == "60分コース"
        assert top[0]["count"] == 3

    def test_store_isolation(
        self, auth_client: APIClient, store: Store, other_store: Store
    ) -> None:
        _customer(other_store)
        _customer(other_store)
        other_customer = _customer(other_store)
        _insight(other_store, other_customer, CustomerInsight.CustomerState.DORMANT)

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        assert data["total_customers"] == 0
        assert data["dormant_customers"] == 0
        assert data["ai_diagnosis"]["main_issue"] == "顧客データ不足"

    def test_dormant_and_pre_dormant_actions_include_cautions(
        self, auth_client: APIClient, store: Store
    ) -> None:
        dormant = _customer(store)
        pre_dormant = _customer(store)
        _insight(store, dormant, CustomerInsight.CustomerState.DORMANT)
        _insight(store, pre_dormant, CustomerInsight.CustomerState.PRE_DORMANT)

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        action_ids = [action["id"] for action in data["weekly_actions"]]
        assert "reactivate_dormant_customers" in action_ids
        assert "follow_pre_dormant_customers" in action_ids
        dormant_action = next(
            action for action in data["weekly_actions"]
            if action["id"] == "reactivate_dormant_customers"
        )
        assert "同意状態と配信停止状態を確認してください。" in dormant_action["cautions"]
        assert "顧客向け文案は人間確認を行ってください。" in dormant_action["cautions"]
        assert "LINE自動配信は行わず、手動確認を前提にしてください。" in dormant_action["cautions"]

    def test_ai_diagnosis_and_weekly_actions_do_not_include_personal_field_names(
        self, auth_client: APIClient, store: Store
    ) -> None:
        c = _customer(
            store,
            full_name="氏名",
            phone="09000000000",
            email="person@example.com",
            line_user_id="line-user-id",
        )
        _insight(store, c, CustomerInsight.CustomerState.AFTER_FIRST_VISIT)

        resp = auth_client.get(self._url(store.id))
        data = resp.json()["data"]
        ai_payload = {
            "ai_diagnosis": data["ai_diagnosis"],
            "weekly_actions": data["weekly_actions"],
        }
        payload_text = str(ai_payload)
        for field_name in ("display_name", "full_name", "phone", "email", "line_user_id"):
            assert field_name not in payload_text
        for personal_value in ("個人名", "氏名", "09000000000", "person@example.com", "line-user-id"):
            assert personal_value not in payload_text

    # --- 認証 / 権限 ---

    def test_401_unauthenticated(self, client: APIClient, store: Store) -> None:
        resp = client.get(self._url(store.id))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(
        self, auth_client: APIClient, other_store: Store
    ) -> None:
        resp = auth_client.get(self._url(other_store.id))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_404_unknown_store(self, auth_client: APIClient) -> None:
        import uuid
        resp = auth_client.get(self._url(uuid.uuid4()))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    # --- レスポンス構造 ---

    def test_response_has_meta(self, auth_client: APIClient, store: Store) -> None:
        resp = auth_client.get(self._url(store.id))
        assert "meta" in resp.json()
        assert "request_id" in resp.json()["meta"]
