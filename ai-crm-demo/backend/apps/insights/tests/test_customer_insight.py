from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer, CustomerProfile
from apps.insights.models import CustomerInsight
from apps.reservations.models import Reservation
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


@pytest.fixture
def customer(db, store: Store) -> Customer:
    c = Customer.objects.create(store=store, full_name="山田花子")
    CustomerProfile.objects.create(customer=c, store_id=store.id)
    return c


def _recalculate_url(store: Store, customer: Customer) -> str:
    return reverse(
        "stores:customers:insights:recalculate",
        kwargs={"store_id": store.id, "customer_id": customer.id},
    )


def _list_url(store: Store, customer: Customer) -> str:
    return reverse(
        "stores:customers:insights:list",
        kwargs={"store_id": store.id, "customer_id": customer.id},
    )


def _detail_url(store: Store, customer: Customer, insight: CustomerInsight) -> str:
    return reverse(
        "stores:customers:insights:detail",
        kwargs={"store_id": store.id, "customer_id": customer.id, "insight_id": insight.id},
    )


# ---------------------------------------------------------------------------
# calculate_customer_state: unit tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_state_new_lead_no_profile(store: Store):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    c = Customer.objects.create(store=store, full_name="新規")
    # プロフィールなし
    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(c, settings)
    assert result["customer_state"] == "new_lead"


@pytest.mark.django_db
def test_state_new_lead_zero_visits(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "new_lead"


@pytest.mark.django_db
def test_state_first_reserved(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    # 来店なし + 予約あり
    Reservation.objects.create(
        store=store,
        customer=customer,
        scheduled_start_at="2099-01-01T10:00:00+09:00",
        status=Reservation.Status.RESERVED,
    )
    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "first_reserved"


@pytest.mark.django_db
def test_state_after_first_visit(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 1
    customer.profile.last_visit_date = date.today() - timedelta(days=10)
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "after_first_visit"


@pytest.mark.django_db
def test_state_repeater(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 3
    customer.profile.last_visit_date = date.today() - timedelta(days=15)
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "repeater"


@pytest.mark.django_db
def test_state_pre_dormant(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 3
    customer.profile.last_visit_date = date.today() - timedelta(days=70)
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "pre_dormant"
    assert result["priority"] == "high"


@pytest.mark.django_db
def test_state_dormant(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 3
    customer.profile.last_visit_date = date.today() - timedelta(days=100)
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "dormant"
    assert result["priority"] == "high"


@pytest.mark.django_db
def test_state_vip_by_sales(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 5
    customer.profile.last_visit_date = date.today() - timedelta(days=10)
    customer.profile.total_sales    = 150_000
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "vip_candidate"


@pytest.mark.django_db
def test_state_vip_by_visit_count(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    customer.profile.visit_count    = 10
    customer.profile.last_visit_date = date.today() - timedelta(days=10)
    customer.profile.save()

    settings = StoreSettings.objects.get(store=store)
    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "vip_candidate"


@pytest.mark.django_db
def test_custom_dormant_threshold(store: Store, customer: Customer):
    from apps.insights.services import calculate_customer_state
    from apps.stores.models import StoreSettings

    # dormant_days=30 に設定
    settings = StoreSettings.objects.get(store=store)
    settings.default_dormant_days = 30
    settings.save()

    customer.profile.visit_count    = 2
    customer.profile.last_visit_date = date.today() - timedelta(days=35)
    customer.profile.save()

    result = calculate_customer_state(customer, settings)
    assert result["customer_state"] == "dormant"


# ---------------------------------------------------------------------------
# API: recalculate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_recalculate_creates_insight(auth_client: APIClient, store: Store, customer: Customer):
    resp = auth_client.post(_recalculate_url(store, customer))
    assert resp.status_code == status.HTTP_200_OK

    data = resp.json()["data"]
    assert data["customer_state"] == "new_lead"
    assert data["review_status"] == "unreviewed"
    assert data["created_by_ai"] is True
    assert CustomerInsight.objects.filter(customer=customer).count() == 1


@pytest.mark.django_db
def test_recalculate_multiple_times_creates_multiple_records(
    auth_client: APIClient, store: Store, customer: Customer
):
    auth_client.post(_recalculate_url(store, customer))
    auth_client.post(_recalculate_url(store, customer))
    assert CustomerInsight.objects.filter(customer=customer).count() == 2


@pytest.mark.django_db
def test_recalculate_401(client: APIClient, store: Store, customer: Customer):
    resp = client.post(_recalculate_url(store, customer))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_recalculate_403_other_store(
    auth_client: APIClient, other_store: Store, customer: Customer
):
    url = reverse(
        "stores:customers:insights:recalculate",
        kwargs={"store_id": other_store.id, "customer_id": customer.id},
    )
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_recalculate_404_unknown_customer(auth_client: APIClient, store: Store):
    import uuid

    url = reverse(
        "stores:customers:insights:recalculate",
        kwargs={"store_id": store.id, "customer_id": uuid.uuid4()},
    )
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# API: list
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_returns_insights(auth_client: APIClient, store: Store, customer: Customer):
    auth_client.post(_recalculate_url(store, customer))
    auth_client.post(_recalculate_url(store, customer))

    resp = auth_client.get(_list_url(store, customer))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["meta"]["total"] == 2
    assert len(body["data"]) == 2


@pytest.mark.django_db
def test_list_401(client: APIClient, store: Store, customer: Customer):
    resp = client.get(_list_url(store, customer))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# API: patch review_status
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_review_status(auth_client: APIClient, store: Store, customer: Customer):
    auth_client.post(_recalculate_url(store, customer))
    insight = CustomerInsight.objects.get(customer=customer)

    resp = auth_client.patch(
        _detail_url(store, customer, insight),
        data={"review_status": "confirmed"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    insight.refresh_from_db()
    assert insight.review_status == CustomerInsight.ReviewStatus.CONFIRMED


@pytest.mark.django_db
def test_patch_404_wrong_insight(
    auth_client: APIClient, store: Store, customer: Customer, other_store: Store
):
    import uuid

    url = reverse(
        "stores:customers:insights:detail",
        kwargs={"store_id": store.id, "customer_id": customer.id, "insight_id": uuid.uuid4()},
    )
    resp = auth_client.patch(url, data={"review_status": "confirmed"}, format="json")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Store isolation: customer from other store
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_recalculate_customer_from_other_store_returns_404(
    auth_client: APIClient, store: Store, other_store: Store
):
    other_customer = Customer.objects.create(store=other_store, full_name="他店顧客")
    url = reverse(
        "stores:customers:insights:recalculate",
        kwargs={"store_id": store.id, "customer_id": other_customer.id},
    )
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND
