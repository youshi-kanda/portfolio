import uuid

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer
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


@pytest.fixture
def customer(db, store: Store) -> Customer:
    return Customer.objects.create(store=store, display_name="テスト顧客")


@pytest.fixture
def reservation(db, store: Store) -> Reservation:
    return Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")


def _list_url(store):
    return reverse("stores:sales:list-create", kwargs={"store_id": store.id})


def _detail_url(store, sale):
    return reverse("stores:sales:detail", kwargs={"store_id": store.id, "sale_id": sale.id})


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/sales/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_sale_required_only(auth_client: APIClient, store: Store):
    payload = {"sale_date": "2026-06-01", "amount": 5000}
    resp = auth_client.post(_list_url(store), payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["store_id"] == str(store.id)
    assert data["amount"] == 5000
    assert data["sale_date"] == "2026-06-01"
    assert data["customer_id"] is None
    assert data["item_category"] is None


@pytest.mark.django_db
def test_create_sale_all_fields(auth_client: APIClient, store: Store, customer: Customer, reservation: Reservation):
    payload = {
        "customer_id": str(customer.id),
        "reservation_id": str(reservation.id),
        "sale_date": "2026-06-01",
        "amount": 12000,
        "item_name_snapshot": "フェイシャルコース",
        "item_category": "service",
        "payment_method": "card",
        "ticket_remaining_count": 4,
        "contract_status": "active",
    }
    resp = auth_client.post(_list_url(store), payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["customer_id"] == str(customer.id)
    assert data["reservation_id"] == str(reservation.id)
    assert data["item_category"] == "service"
    assert data["payment_method"] == "card"
    assert data["ticket_remaining_count"] == 4
    assert data["contract_status"] == "active"
    assert data["item_name_snapshot"] == "フェイシャルコース"


@pytest.mark.django_db
def test_create_sale_missing_sale_date(auth_client: APIClient, store: Store):
    resp = auth_client.post(_list_url(store), {"amount": 5000}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_sale_missing_amount(auth_client: APIClient, store: Store):
    resp = auth_client.post(_list_url(store), {"sale_date": "2026-06-01"}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_sale_unauthenticated(client: APIClient, store: Store):
    resp = client.post(_list_url(store), {"sale_date": "2026-06-01", "amount": 5000}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_sale_other_store_forbidden(auth_client: APIClient, other_store: Store):
    resp = auth_client.post(
        _list_url(other_store),
        {"sale_date": "2026-06-01", "amount": 5000},
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/sales/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_sales_own_store_only(auth_client: APIClient, store: Store, other_store: Store):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    Sale.objects.create(store=other_store, sale_date="2026-06-01", amount=8000)
    resp = auth_client.get(_list_url(store))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_excludes_deleted(auth_client: APIClient, store: Store):
    from django.utils import timezone
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000, deleted_at=timezone.now())
    resp = auth_client.get(_list_url(store))
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_customer_id(auth_client: APIClient, store: Store, customer: Customer):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, customer=customer)
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000)
    resp = auth_client.get(_list_url(store), {"customer_id": str(customer.id)})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_reservation_id(auth_client: APIClient, store: Store, reservation: Reservation):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, reservation=reservation)
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000)
    resp = auth_client.get(_list_url(store), {"reservation_id": str(reservation.id)})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_item_category(auth_client: APIClient, store: Store):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, item_category="service")
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000, item_category="product")
    resp = auth_client.get(_list_url(store), {"item_category": "service"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["item_category"] == "service"


@pytest.mark.django_db
def test_list_sales_filter_payment_method(auth_client: APIClient, store: Store):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, payment_method="cash")
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000, payment_method="card")
    resp = auth_client.get(_list_url(store), {"payment_method": "cash"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_contract_status(auth_client: APIClient, store: Store):
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, contract_status="active")
    Sale.objects.create(store=store, sale_date="2026-06-02", amount=3000, contract_status="ended")
    resp = auth_client.get(_list_url(store), {"contract_status": "active"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_sale_from(auth_client: APIClient, store: Store):
    Sale.objects.create(store=store, sale_date="2026-05-01", amount=5000)
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=3000)
    resp = auth_client.get(_list_url(store), {"sale_from": "2026-06-01"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_filter_sale_to(auth_client: APIClient, store: Store):
    Sale.objects.create(store=store, sale_date="2026-05-01", amount=5000)
    Sale.objects.create(store=store, sale_date="2026-06-01", amount=3000)
    resp = auth_client.get(_list_url(store), {"sale_to": "2026-05-31"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_sales_unauthenticated(client: APIClient, store: Store):
    resp = client.get(_list_url(store))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/sales/{sale_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_sale_detail(auth_client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000, payment_method="cash")
    resp = auth_client.get(_detail_url(store, s))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["id"] == str(s.id)
    assert data["payment_method"] == "cash"


@pytest.mark.django_db
def test_get_sale_other_store_forbidden(auth_client: APIClient, other_store: Store):
    s = Sale.objects.create(store=other_store, sale_date="2026-06-01", amount=5000)
    url = reverse("stores:sales:detail", kwargs={"store_id": other_store.id, "sale_id": s.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_nonexistent_sale_404(auth_client: APIClient, store: Store):
    url = reverse("stores:sales:detail", kwargs={"store_id": store.id, "sale_id": uuid.uuid4()})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/{store_id}/sales/{sale_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_sale_amount(auth_client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    resp = auth_client.patch(_detail_url(store, s), {"amount": 8000}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["amount"] == 8000


@pytest.mark.django_db
def test_update_sale_multiple_fields(auth_client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    resp = auth_client.patch(
        _detail_url(store, s),
        {"item_category": "ticket", "ticket_remaining_count": 8, "contract_status": "active"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["item_category"] == "ticket"
    assert data["ticket_remaining_count"] == 8
    assert data["contract_status"] == "active"


@pytest.mark.django_db
def test_update_sale_unauthenticated(client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    resp = client.patch(_detail_url(store, s), {"amount": 8000}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_update_sale_other_store_forbidden(auth_client: APIClient, other_store: Store):
    s = Sale.objects.create(store=other_store, sale_date="2026-06-01", amount=5000)
    url = reverse("stores:sales:detail", kwargs={"store_id": other_store.id, "sale_id": s.id})
    resp = auth_client.patch(url, {"amount": 8000}, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# DELETE /api/v1/stores/{store_id}/sales/{sale_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_sale_soft_deletes(auth_client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    resp = auth_client.delete(_detail_url(store, s))
    assert resp.status_code == status.HTTP_200_OK
    s.refresh_from_db()
    assert s.deleted_at is not None


@pytest.mark.django_db
def test_deleted_sale_not_accessible(auth_client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    auth_client.delete(_detail_url(store, s))
    resp = auth_client.get(_detail_url(store, s))
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_delete_sale_unauthenticated(client: APIClient, store: Store):
    s = Sale.objects.create(store=store, sale_date="2026-06-01", amount=5000)
    resp = client.delete(_detail_url(store, s))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
