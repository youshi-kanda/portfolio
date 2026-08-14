import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.stores.models import Store, StoreCollaborator

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def owner(db) -> User:
    return User.objects.create_user(
        email="owner@example.com",
        name="オーナー",
        password="StrongPass123!",
    )


@pytest.fixture
def supporter(db) -> User:
    return User.objects.create_user(
        email="supporter@example.com",
        name="外部支援者",
        password="StrongPass123!",
        role=User.Role.SUPPORTER,
    )


@pytest.fixture
def other_owner(db) -> User:
    return User.objects.create_user(
        email="other@example.com",
        name="別オーナー",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(client: APIClient, owner: User) -> APIClient:
    refresh = RefreshToken.for_user(owner)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def supporter_client(client: APIClient, supporter: User) -> APIClient:
    c = APIClient()
    refresh = RefreshToken.for_user(supporter)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return c


@pytest.fixture
def store(db, owner: User) -> Store:
    return Store.objects.create(
        tenant_id=owner.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="渋谷",
        created_by=owner,
    )


@pytest.fixture
def collab(db, store: Store, supporter: User, owner: User) -> StoreCollaborator:
    return StoreCollaborator.objects.create(
        store=store,
        user=supporter,
        can_view=True,
        can_edit_campaigns=False,
        can_view_personal_info=False,
        can_export_csv=False,
        invited_by=owner,
    )


# ---------------------------------------------------------------------------
# GET /stores/{store_id}/collaborators/
# ---------------------------------------------------------------------------


class TestCollaboratorList:
    def test_owner_can_list(self, auth_client: APIClient, store: Store, collab: StoreCollaborator):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["meta"]["total"] == 1

    def test_unauthenticated_returns_401(self, client: APIClient, store: Store):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        res = client.get(url)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_owner_returns_403(self, other_owner: User, store: Store):
        c = APIClient()
        refresh = RefreshToken.for_user(other_owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        res = c.get(url)
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# POST /stores/{store_id}/collaborators/
# ---------------------------------------------------------------------------


class TestCollaboratorInvite:
    def test_owner_can_invite(self, auth_client: APIClient, store: Store, supporter: User):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        payload = {
            "user_email": supporter.email,
            "can_view": True,
            "can_edit_campaigns": True,
            "can_approve_contents": True,
            "can_view_personal_info": False,
            "can_export_csv": False,
        }
        res = auth_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["data"]["can_edit_campaigns"] is True
        assert res.data["data"]["can_approve_contents"] is True
        assert StoreCollaborator.objects.filter(store=store, user=supporter).exists()

    def test_invite_nonexistent_user_returns_404(self, auth_client: APIClient, store: Store):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        payload = {"user_email": "notexist@example.com"}
        res = auth_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_invite_self_returns_422(self, auth_client: APIClient, store: Store, owner: User):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        payload = {"user_email": owner.email}
        res = auth_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_duplicate_invite_returns_409(
        self, auth_client: APIClient, store: Store, supporter: User, collab: StoreCollaborator
    ):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        payload = {"user_email": supporter.email}
        res = auth_client.post(url, payload, format="json")
        assert res.status_code == status.HTTP_409_CONFLICT

    def test_unauthenticated_returns_401(self, client: APIClient, store: Store, supporter: User):
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        res = client.post(url, {"user_email": supporter.email}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_owner_cannot_invite(self, other_owner: User, store: Store, supporter: User):
        c = APIClient()
        refresh = RefreshToken.for_user(other_owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("stores:collaborators-list-create", kwargs={"store_id": store.id})
        res = c.post(url, {"user_email": supporter.email}, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# PATCH /stores/{store_id}/collaborators/{collab_id}/
# ---------------------------------------------------------------------------


class TestCollaboratorUpdate:
    def test_owner_can_update_permissions(
        self, auth_client: APIClient, store: Store, collab: StoreCollaborator
    ):
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = auth_client.patch(
            url,
            {"can_edit_campaigns": True, "can_approve_contents": True},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        collab.refresh_from_db()
        assert collab.can_edit_campaigns is True
        assert collab.can_approve_contents is True

    def test_unauthenticated_returns_401(self, client: APIClient, store: Store, collab: StoreCollaborator):
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = client.patch(url, {"can_edit_campaigns": True}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_owner_returns_403(
        self, other_owner: User, store: Store, collab: StoreCollaborator
    ):
        c = APIClient()
        refresh = RefreshToken.for_user(other_owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = c.patch(url, {"can_edit_campaigns": True}, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# DELETE /stores/{store_id}/collaborators/{collab_id}/
# ---------------------------------------------------------------------------


class TestCollaboratorDelete:
    def test_owner_can_delete(self, auth_client: APIClient, store: Store, collab: StoreCollaborator):
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = auth_client.delete(url)
        assert res.status_code == status.HTTP_200_OK
        assert not StoreCollaborator.objects.filter(id=collab.id).exists()

    def test_unauthenticated_returns_401(self, client: APIClient, store: Store, collab: StoreCollaborator):
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = client.delete(url)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_owner_returns_403(
        self, other_owner: User, store: Store, collab: StoreCollaborator
    ):
        c = APIClient()
        refresh = RefreshToken.for_user(other_owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse(
            "stores:collaborators-detail",
            kwargs={"store_id": store.id, "collab_id": collab.id},
        )
        res = c.delete(url)
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# GET /stores/{store_id}/my-permissions/
# ---------------------------------------------------------------------------


class TestMyStorePermissions:
    def test_owner_returns_is_owner_true(self, auth_client: APIClient, store: Store):
        url = reverse("stores:my-permissions", kwargs={"store_id": store.id})
        res = auth_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_owner"] is True
        assert res.data["data"]["can_approve_contents"] is True

    def test_collab_with_approve_permission_returns_true(
        self, supporter_client: APIClient, store: Store, supporter: User, owner: User
    ):
        StoreCollaborator.objects.create(
            store=store,
            user=supporter,
            can_view=True,
            can_approve_contents=True,
            invited_by=owner,
        )
        url = reverse("stores:my-permissions", kwargs={"store_id": store.id})
        res = supporter_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_owner"] is False
        assert res.data["data"]["can_approve_contents"] is True

    def test_collab_without_approve_permission_returns_false(
        self, supporter_client: APIClient, store: Store, supporter: User, owner: User
    ):
        StoreCollaborator.objects.create(
            store=store,
            user=supporter,
            can_view=True,
            can_approve_contents=False,
            invited_by=owner,
        )
        url = reverse("stores:my-permissions", kwargs={"store_id": store.id})
        res = supporter_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_owner"] is False
        assert res.data["data"]["can_approve_contents"] is False

    def test_unrelated_user_returns_403(self, other_owner: User, store: Store):
        c = APIClient()
        refresh = RefreshToken.for_user(other_owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        url = reverse("stores:my-permissions", kwargs={"store_id": store.id})
        res = c.get(url)
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# User.Role テスト
# ---------------------------------------------------------------------------


class TestUserRole:
    def test_default_role_is_owner(self, db):
        user = User.objects.create_user(
            email="new@example.com",
            name="新規",
            password="Pass123!",
        )
        assert user.role == User.Role.OWNER

    def test_supporter_role(self, supporter: User):
        assert supporter.role == User.Role.SUPPORTER
