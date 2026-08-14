"""P4-002: 個人情報マスキングのテスト。

- 店舗オーナー → 全フィールドがフル表示
- can_view_personal_info=True の collaborator → フル表示
- can_view_personal_info=False の collaborator → マスキング済み表示
- 未招待ユーザー → 403
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.customers.models import Customer, CustomerProfile
from apps.customers.utils import mask_email, mask_name, mask_phone
from apps.stores.models import Store, StoreCollaborator, StoreSettings

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(email="owner@example.com", name="オーナー", password="Pass123!")


@pytest.fixture
def collaborator_user(db):
    return User.objects.create_user(email="collab@example.com", name="支援者", password="Pass123!")


@pytest.fixture
def outsider(db):
    return User.objects.create_user(email="outsider@example.com", name="無関係", password="Pass123!")


def _auth(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def store(db, owner):
    s = Store.objects.create(
        tenant_id=owner.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=owner,
    )
    StoreSettings.objects.create(store=s)
    return s


@pytest.fixture
def customer(db, store):
    c = Customer.objects.create(
        store=store,
        display_name="山田花子",
        full_name="山田 花子",
        phone="090-1234-5678",
        email="hanako@example.com",
    )
    CustomerProfile.objects.create(customer=c, store_id=store.id)
    return c


def _collab(db_marker, store, user, can_view_personal_info):
    return StoreCollaborator.objects.create(
        store=store,
        user=user,
        can_view=True,
        can_view_personal_info=can_view_personal_info,
    )


# ---------------------------------------------------------------------------
# utils unit tests
# ---------------------------------------------------------------------------


def test_mask_name_full():
    assert mask_name("山田花子") == "山田○○"


def test_mask_name_short():
    assert mask_name("田中") == "田○"


def test_mask_name_single():
    assert mask_name("花") == "花"


def test_mask_name_none():
    assert mask_name(None) is None


def test_mask_name_empty():
    assert mask_name("") == ""


def test_mask_phone_hyphen():
    assert mask_phone("090-1234-5678") == "090-****-5678"


def test_mask_phone_none():
    assert mask_phone(None) is None


def test_mask_email_standard():
    assert mask_email("hanako@example.com") == "h***@example.com"


def test_mask_email_none():
    assert mask_email(None) is None


def test_mask_email_no_at():
    assert mask_email("invalid") == "***"


# ---------------------------------------------------------------------------
# API: 顧客詳細 GET /stores/{id}/customers/{id}/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_owner_gets_full_detail(client, owner, store, customer):
    _auth(client, owner)
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.data["data"]
    assert data["full_name"] == "山田 花子"
    assert data["phone"] == "090-1234-5678"
    assert data["email"] == "hanako@example.com"


@pytest.mark.django_db
def test_collab_with_personal_info_gets_full_detail(db, client, collaborator_user, store, customer):
    _collab(db, store, collaborator_user, can_view_personal_info=True)
    _auth(client, collaborator_user)
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.data["data"]
    assert data["full_name"] == "山田 花子"
    assert data["phone"] == "090-1234-5678"
    assert data["email"] == "hanako@example.com"


@pytest.mark.django_db
def test_collab_without_personal_info_gets_masked_detail(db, client, collaborator_user, store, customer):
    _collab(db, store, collaborator_user, can_view_personal_info=False)
    _auth(client, collaborator_user)
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.data["data"]
    assert data["full_name"] == "山田○○○"
    assert data["phone"] == "090-****-5678"
    assert data["email"] == "h***@example.com"


@pytest.mark.django_db
def test_outsider_detail_returns_403(client, outsider, store, customer):
    _auth(client, outsider)
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# API: 顧客一覧 GET /stores/{id}/customers/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_owner_gets_full_list(client, owner, store, customer):
    _auth(client, owner)
    url = reverse("stores:customers:list-create", kwargs={"store_id": store.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    item = res.data["data"][0]
    assert item["display_name"] == "山田花子"
    assert item["full_name"] == "山田 花子"


@pytest.mark.django_db
def test_collab_without_personal_info_gets_masked_list(db, client, collaborator_user, store, customer):
    _collab(db, store, collaborator_user, can_view_personal_info=False)
    _auth(client, collaborator_user)
    url = reverse("stores:customers:list-create", kwargs={"store_id": store.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    item = res.data["data"][0]
    assert item["display_name"] == "山田○○"
    assert item["full_name"] == "山田○○○"


@pytest.mark.django_db
def test_outsider_list_returns_403(client, outsider, store, customer):
    _auth(client, outsider)
    url = reverse("stores:customers:list-create", kwargs={"store_id": store.id})
    res = client.get(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# API: POST/PATCH/DELETE は collaborator 不可（owner のみ）
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_collab_cannot_create_customer(db, client, collaborator_user, store):
    _collab(db, store, collaborator_user, can_view_personal_info=True)
    _auth(client, collaborator_user)
    url = reverse("stores:customers:list-create", kwargs={"store_id": store.id})
    res = client.post(url, {"display_name": "新規顧客"}, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_collab_cannot_delete_customer(db, client, collaborator_user, store, customer):
    _collab(db, store, collaborator_user, can_view_personal_info=True)
    _auth(client, collaborator_user)
    url = reverse("stores:customers:detail", kwargs={"store_id": store.id, "customer_id": customer.id})
    res = client.delete(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN
