import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Menu, Store, StoreSettings, StoreTool

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


# ---------------------------------------------------------------------------
# POST /api/v1/stores/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_store_success(auth_client: APIClient, user: User):
    url = reverse("stores:list-create")
    resp = auth_client.post(
        url,
        {
            "name": "新サロン",
            "industry": "esthetic",
            "area_label": "心斎橋",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["data"]["name"] == "新サロン"
    assert data["data"]["industry"] == "esthetic"
    assert "request_id" in data["meta"]

    store_id = data["data"]["id"]
    assert StoreSettings.objects.filter(store_id=store_id).exists()


@pytest.mark.django_db
def test_create_store_validation_error(auth_client: APIClient):
    url = reverse("stores:list-create")
    resp = auth_client.post(url, {}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    data = resp.json()
    assert data["error"]["code"] in ("VALIDATION_ERROR", "BAD_REQUEST")


@pytest.mark.django_db
def test_create_store_unauthenticated(client: APIClient):
    url = reverse("stores:list-create")
    resp = client.post(url, {"name": "x", "industry": "esthetic", "area_label": "y"}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# GET /api/v1/stores/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_stores_returns_own_stores(auth_client: APIClient, store: Store, other_store: Store):
    url = reverse("stores:list-create")
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    ids = [s["id"] for s in data["data"]]
    assert str(store.id) in ids
    assert str(other_store.id) not in ids
    assert data["meta"]["total"] == 1


@pytest.mark.django_db
def test_list_stores_excludes_deleted(auth_client: APIClient, user: User):
    from django.utils import timezone

    s = Store.objects.create(
        tenant_id=user.id, name="削除済み", industry="gym", area_label="x", created_by=user,
        deleted_at=timezone.now(),
    )
    url = reverse("stores:list-create")
    resp = auth_client.get(url)
    ids = [item["id"] for item in resp.json()["data"]]
    assert str(s.id) not in ids


# ---------------------------------------------------------------------------
# GET /api/v1/stores/<id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_store_detail(auth_client: APIClient, store: Store):
    url = reverse("stores:detail", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["id"] == str(store.id)


@pytest.mark.django_db
def test_get_other_user_store_forbidden(auth_client: APIClient, other_store: Store):
    url = reverse("stores:detail", kwargs={"store_id": other_store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_nonexistent_store_404(auth_client: APIClient):
    import uuid
    url = reverse("stores:detail", kwargs={"store_id": uuid.uuid4()})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/<id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_store(auth_client: APIClient, store: Store):
    url = reverse("stores:detail", kwargs={"store_id": store.id})
    resp = auth_client.patch(url, {"name": "リニューアルサロン"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["name"] == "リニューアルサロン"


# ---------------------------------------------------------------------------
# DELETE /api/v1/stores/<id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_store_soft_deletes(auth_client: APIClient, store: Store):
    url = reverse("stores:detail", kwargs={"store_id": store.id})
    resp = auth_client.delete(url)
    assert resp.status_code == status.HTTP_200_OK
    store.refresh_from_db()
    assert store.deleted_at is not None


@pytest.mark.django_db
def test_deleted_store_not_found(auth_client: APIClient, store: Store):
    from django.utils import timezone
    store.deleted_at = timezone.now()
    store.save()
    url = reverse("stores:detail", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# GET / PATCH /api/v1/stores/<id>/settings/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_settings(auth_client: APIClient, store: Store):
    url = reverse("stores:settings", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert "require_approval_for_external" in data
    assert data["require_approval_for_external"] is True


@pytest.mark.django_db
def test_update_settings(auth_client: APIClient, store: Store):
    url = reverse("stores:settings", kwargs={"store_id": store.id})
    resp = auth_client.patch(
        url,
        {
            "tone": "friendly",
            "main_goal": "repeat",
            "require_approval_for_external": False,
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["tone"] == "friendly"
    assert data["main_goal"] == "repeat"
    assert data["require_approval_for_external"] is False


# ---------------------------------------------------------------------------
# GET / POST /api/v1/stores/<id>/tools/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_add_tool(auth_client: APIClient, store: Store):
    url = reverse("stores:tools-list-create", kwargs={"store_id": store.id})
    resp = auth_client.post(
        url,
        {"tool_type": "official_line", "usage_status": "using"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["tool_type"] == "official_line"
    assert data["usage_status"] == "using"


@pytest.mark.django_db
def test_list_tools(auth_client: APIClient, store: Store):
    StoreTool.objects.create(store=store, tool_type="pos", usage_status="considering")
    url = reverse("stores:tools-list-create", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 1


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/<id>/tools/<tool_id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_tool(auth_client: APIClient, store: Store):
    tool = StoreTool.objects.create(store=store, tool_type="spreadsheet", usage_status="considering")
    url = reverse("stores:tools-detail", kwargs={"store_id": store.id, "tool_id": tool.id})
    resp = auth_client.patch(url, {"usage_status": "using"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["usage_status"] == "using"


# ---------------------------------------------------------------------------
# GET /api/v1/auth/me/ — stores フィールド確認
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_returns_stores(auth_client: APIClient, store: Store):
    url = reverse("auth:me")
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    stores = resp.json()["data"]["stores"]
    assert any(s["id"] == str(store.id) for s in stores)


# ---------------------------------------------------------------------------
# POST /api/v1/stores/<id>/menus/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_menu_required_fields_only(auth_client: APIClient, store: Store):
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    resp = auth_client.post(url, {"name": "フェイシャルコース"}, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["name"] == "フェイシャルコース"
    assert data["status"] == "active"
    assert data["is_main"] is False
    assert data["is_high_value"] is False
    assert data["store_id"] == str(store.id)


@pytest.mark.django_db
def test_create_menu_all_fields(auth_client: APIClient, store: Store):
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    payload = {
        "name": "プレミアムフェイシャル",
        "category": "フェイシャル",
        "price": 15000,
        "duration_minutes": 90,
        "is_main": True,
        "is_high_value": True,
        "description": "最上級のフェイシャルコース",
        "status": "active",
    }
    resp = auth_client.post(url, payload, format="json")
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()["data"]
    assert data["name"] == "プレミアムフェイシャル"
    assert data["price"] == 15000
    assert data["duration_minutes"] == 90
    assert data["is_main"] is True
    assert data["is_high_value"] is True


@pytest.mark.django_db
def test_create_menu_unauthenticated(client: APIClient, store: Store):
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    resp = client.post(url, {"name": "テスト"}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_create_menu_other_store_forbidden(auth_client: APIClient, other_store: Store):
    url = reverse("stores:menus-list-create", kwargs={"store_id": other_store.id})
    resp = auth_client.post(url, {"name": "テスト"}, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_create_menu_missing_name(auth_client: APIClient, store: Store):
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    resp = auth_client.post(url, {"category": "フェイシャル"}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# GET /api/v1/stores/<id>/menus/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_menus(auth_client: APIClient, store: Store):
    Menu.objects.create(store=store, name="コース A")
    Menu.objects.create(store=store, name="コース B")
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["meta"]["total"] == 2


@pytest.mark.django_db
def test_list_menus_excludes_deleted(auth_client: APIClient, store: Store):
    from django.utils import timezone

    Menu.objects.create(store=store, name="有効メニュー")
    Menu.objects.create(store=store, name="削除済みメニュー", deleted_at=timezone.now())
    url = reverse("stores:menus-list-create", kwargs={"store_id": store.id})
    resp = auth_client.get(url)
    assert resp.json()["meta"]["total"] == 1
    assert resp.json()["data"][0]["name"] == "有効メニュー"


# ---------------------------------------------------------------------------
# GET /api/v1/stores/<id>/menus/<menu_id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_menu_detail(auth_client: APIClient, store: Store):
    menu = Menu.objects.create(store=store, name="詳細テストメニュー", price=5000)
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["id"] == str(menu.id)
    assert data["price"] == 5000


@pytest.mark.django_db
def test_get_deleted_menu_not_found(auth_client: APIClient, store: Store):
    from django.utils import timezone

    menu = Menu.objects.create(store=store, name="削除済み", deleted_at=timezone.now())
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# PATCH /api/v1/stores/<id>/menus/<menu_id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_menu(auth_client: APIClient, store: Store):
    menu = Menu.objects.create(store=store, name="元のメニュー", price=3000)
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    resp = auth_client.patch(url, {"name": "更新後メニュー", "price": 4000}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]
    assert data["name"] == "更新後メニュー"
    assert data["price"] == 4000


@pytest.mark.django_db
def test_update_menu_status(auth_client: APIClient, store: Store):
    menu = Menu.objects.create(store=store, name="テスト", status="active")
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    resp = auth_client.patch(url, {"status": "inactive"}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["status"] == "inactive"


# ---------------------------------------------------------------------------
# DELETE /api/v1/stores/<id>/menus/<menu_id>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_delete_menu_soft_deletes(auth_client: APIClient, store: Store):
    menu = Menu.objects.create(store=store, name="削除対象")
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    resp = auth_client.delete(url)
    assert resp.status_code == status.HTTP_200_OK
    menu.refresh_from_db()
    assert menu.deleted_at is not None


@pytest.mark.django_db
def test_deleted_menu_not_accessible(auth_client: APIClient, store: Store):
    menu = Menu.objects.create(store=store, name="削除対象")
    url = reverse("stores:menus-detail", kwargs={"store_id": store.id, "menu_id": menu.id})
    auth_client.delete(url)
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND
