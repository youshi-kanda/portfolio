import uuid

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer
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


def _list_url(store):
    return reverse("stores:reservations:list-create", kwargs={"store_id": store.id})


def _detail_url(store, reservation):
    return reverse("stores:reservations:detail", kwargs={"store_id": store.id, "reservation_id": reservation.id})


# ---------------------------------------------------------------------------
# POST /api/v1/stores/{store_id}/reservations/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_reservation_required_only(auth_client: APIClient, store: Store):
    payload = {"scheduled_start_at": "2026-06-01T14:00:00+09:00"}
    resp = auth_client.post(_list_url(store), payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["store_id"] == str(store.id)
    assert data["status"] == "reserved"
    assert data["customer_id"] is None


@pytest.mark.django_db
def test_create_reservation_all_fields(auth_client: APIClient, store: Store, customer: Customer):
    payload = {
        "customer_id": str(customer.id),
        "scheduled_start_at": "2026-06-01T14:00:00+09:00",
        "scheduled_end_at": "2026-06-01T15:00:00+09:00",
        "channel": "official_line",
        "status": "reserved",
        "menu_name_snapshot": "フェイシャル",
        "has_next_reservation": True,
    }
    resp = auth_client.post(_list_url(store), payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["customer_id"] == str(customer.id)
    assert data["channel"] == "official_line"
    assert data["menu_name_snapshot"] == "フェイシャル"
    assert data["has_next_reservation"] is True


@pytest.mark.django_db
def test_create_reservation_missing_scheduled_start_at(auth_client: APIClient, store: Store):
    resp = auth_client.post(_list_url(store), {}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_reservation_unauthenticated(client: APIClient, store: Store):
    resp = client.post(_list_url(store), {"scheduled_start_at": "2026-06-01T14:00:00+09:00"}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_reservation_other_store_forbidden(auth_client: APIClient, other_store: Store):
    resp = auth_client.post(
        _list_url(other_store),
        {"scheduled_start_at": "2026-06-01T14:00:00+09:00"},
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/reservations/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_reservations_own_store_only(auth_client: APIClient, store: Store, other_store: Store):
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    Reservation.objects.create(store=other_store, scheduled_start_at="2026-06-01T15:00:00+09:00")
    resp = auth_client.get(_list_url(store))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_excludes_deleted(auth_client: APIClient, store: Store):
    from django.utils import timezone
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-02T14:00:00+09:00", deleted_at=timezone.now())
    resp = auth_client.get(_list_url(store))
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_filter_status(auth_client: APIClient, store: Store):
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00", status="reserved")
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-02T14:00:00+09:00", status="visited")
    resp = auth_client.get(_list_url(store), {"status": "visited"})
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["status"] == "visited"


@pytest.mark.django_db
def test_list_reservations_filter_customer_id(auth_client: APIClient, store: Store, customer: Customer):
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00", customer=customer)
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-02T14:00:00+09:00")
    resp = auth_client.get(_list_url(store), {"customer_id": str(customer.id)})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_filter_channel(auth_client: APIClient, store: Store):
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00", channel="phone")
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-02T14:00:00+09:00", channel="web")
    resp = auth_client.get(_list_url(store), {"channel": "phone"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_filter_scheduled_from(auth_client: APIClient, store: Store):
    Reservation.objects.create(store=store, scheduled_start_at="2026-05-01T14:00:00+09:00")
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.get(_list_url(store), {"scheduled_from": "2026-06-01T00:00:00+09:00"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_filter_scheduled_to(auth_client: APIClient, store: Store):
    Reservation.objects.create(store=store, scheduled_start_at="2026-05-01T14:00:00+09:00")
    Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.get(_list_url(store), {"scheduled_to": "2026-05-31T23:59:59+09:00"})
    assert resp.json()["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_reservations_unauthenticated(client: APIClient, store: Store):
    resp = client.get(_list_url(store))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/v1/stores/{store_id}/reservations/{reservation_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_reservation_detail(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00", channel="phone")
    resp = auth_client.get(_detail_url(store, r))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["id"] == str(r.id)
    assert data["channel"] == "phone"


@pytest.mark.django_db
def test_get_reservation_other_store_forbidden(auth_client: APIClient, other_store: Store):
    r = Reservation.objects.create(store=other_store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    url = reverse("stores:reservations:detail", kwargs={"store_id": other_store.id, "reservation_id": r.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_nonexistent_reservation_404(auth_client: APIClient, store: Store):
    url = reverse("stores:reservations:detail", kwargs={"store_id": store.id, "reservation_id": uuid.uuid4()})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/{store_id}/reservations/{reservation_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_reservation_status(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.patch(_detail_url(store, r), {"status": "visited"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["status"] == "visited"


@pytest.mark.django_db
def test_update_reservation_visited_at(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.patch(
        _detail_url(store, r),
        {"status": "visited", "visited_at": "2026-06-01T14:30:00+09:00"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["visited_at"] is not None


@pytest.mark.django_db
def test_update_reservation_cancellation(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.patch(
        _detail_url(store, r),
        {"status": "cancelled", "cancellation_reason": "体調不良"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["status"] == "cancelled"
    assert data["cancellation_reason"] == "体調不良"


@pytest.mark.django_db
def test_update_reservation_unauthenticated(client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = client.patch(_detail_url(store, r), {"status": "visited"}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_update_reservation_other_store_forbidden(auth_client: APIClient, other_store: Store):
    r = Reservation.objects.create(store=other_store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    url = reverse("stores:reservations:detail", kwargs={"store_id": other_store.id, "reservation_id": r.id})
    resp = auth_client.patch(url, {"status": "visited"}, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# DELETE /api/v1/stores/{store_id}/reservations/{reservation_id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_reservation_soft_deletes(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = auth_client.delete(_detail_url(store, r))
    assert resp.status_code == status.HTTP_200_OK
    r.refresh_from_db()
    assert r.deleted_at is not None


@pytest.mark.django_db
def test_deleted_reservation_not_accessible(auth_client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    auth_client.delete(_detail_url(store, r))
    resp = auth_client.get(_detail_url(store, r))
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_delete_reservation_unauthenticated(client: APIClient, store: Store):
    r = Reservation.objects.create(store=store, scheduled_start_at="2026-06-01T14:00:00+09:00")
    resp = client.delete(_detail_url(store, r))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
