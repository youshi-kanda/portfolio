import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.models import User


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _make_refresh(user: User) -> RefreshToken:
    """Return a RefreshToken with token_version claim matching user.token_version."""
    refresh = RefreshToken.for_user(user)
    refresh["token_version"] = user.token_version
    return refresh


def _make_access_str(user: User) -> str:
    """Return a signed access-token string with token_version claim.

    SimpleJWT's RefreshToken.access_token property copies all non-standard
    claims (everything except token_type / exp / iat / jti) from the refresh
    payload to the access token, so setting token_version once on the refresh
    token is sufficient.
    """
    return str(_make_refresh(user).access_token)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def active_user(db) -> User:
    return User.objects.create_user(
        email="test@example.com",
        name="テストユーザー",
        password="StrongPass123!",
    )


@pytest.fixture
def suspended_user(db) -> User:
    return User.objects.create_user(
        email="suspended@example.com",
        name="停止ユーザー",
        password="StrongPass123!",
        status=User.Status.SUSPENDED,
    )


@pytest.fixture
def inactive_user(db) -> User:
    return User.objects.create_user(
        email="inactive@example.com",
        name="非アクティブユーザー",
        password="StrongPass123!",
        is_active=False,
    )


@pytest.fixture
def auth_client(client: APIClient, active_user: User) -> APIClient:
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_make_access_str(active_user)}")
    return client


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_login_success(client: APIClient, active_user: User):
    url = reverse("auth:login")
    resp = client.post(url, {"email": "test@example.com", "password": "StrongPass123!"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["user"]["email"] == "test@example.com"
    assert "request_id" in data["meta"]


@pytest.mark.django_db
def test_login_wrong_password(client: APIClient, active_user: User):
    url = reverse("auth:login")
    resp = client.post(url, {"email": "test@example.com", "password": "WrongPassword!"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.django_db
def test_login_unknown_email(client: APIClient, db):
    url = reverse("auth:login")
    resp = client.post(url, {"email": "nobody@example.com", "password": "AnyPass123!"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.django_db
def test_login_suspended_user(client: APIClient, suspended_user: User):
    url = reverse("auth:login")
    resp = client.post(url, {"email": "suspended@example.com", "password": "StrongPass123!"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.django_db
def test_login_inactive_user(client: APIClient, inactive_user: User):
    url = reverse("auth:login")
    resp = client.post(url, {"email": "inactive@example.com", "password": "StrongPass123!"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# ---------------------------------------------------------------------------
# token_version: login endpoint embeds claim
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_login_tokens_carry_token_version(client: APIClient, active_user: User):
    """Both access and refresh tokens returned by /login/ must contain token_version."""
    url = reverse("auth:login")
    resp = client.post(url, {"email": "test@example.com", "password": "StrongPass123!"})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()["data"]

    access = AccessToken(data["access_token"])
    refresh = RefreshToken(data["refresh_token"])
    assert access.payload.get("token_version") == active_user.token_version
    assert refresh.payload.get("token_version") == active_user.token_version


# ---------------------------------------------------------------------------
# GET /api/v1/auth/me/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_me_authenticated(auth_client: APIClient, active_user: User):
    url = reverse("auth:me")
    resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["data"]["user"]["email"] == "test@example.com"
    assert data["data"]["user"]["name"] == "テストユーザー"
    assert data["data"]["stores"] == []


@pytest.mark.django_db
def test_me_unauthenticated(client: APIClient, db):
    url = reverse("auth:me")
    resp = client.get(url)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# ---------------------------------------------------------------------------
# token_version: access token guards
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_me_suspended_user_with_is_active_true_denied(client: APIClient, db):
    """
    A SUSPENDED user whose is_active=True must be rejected by access token auth.

    Standard JWTAuthentication only checks is_active, so without the custom
    class a suspended user with is_active=True could call any API endpoint
    for up to one hour using their existing access token.
    """
    user = User.objects.create_user(
        email="willsuspend@example.com",
        name="停止予定ユーザー",
        password="StrongPass123!",
    )
    # Issue the token while the user is still ACTIVE.
    access_str = _make_access_str(user)

    # Suspend AFTER issuing (is_active stays True).
    user.status = User.Status.SUSPENDED
    user.save(update_fields=["status"])

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_str}")
    resp = client.get(reverse("auth:me"))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_me_token_version_mismatch_denied(client: APIClient, active_user: User):
    """Access token with a stale token_version must be rejected on the next API call."""
    access_str = _make_access_str(active_user)

    # Simulate password change / forced-logout by incrementing token_version.
    active_user.token_version += 1
    active_user.save(update_fields=["token_version"])

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_str}")
    resp = client.get(reverse("auth:me"))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_me_access_token_invalid_version_type_returns_401(client: APIClient, active_user: User):
    """Non-numeric token_version in access token must return 401, not 500."""
    token = _make_refresh(active_user).access_token
    token["token_version"] = "invalid"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
    resp = client.get(reverse("auth:me"))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_me_access_token_list_version_returns_401(client: APIClient, active_user: User):
    """List-typed token_version in access token must return 401, not 500."""
    token = _make_refresh(active_user).access_token
    token["token_version"] = []
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
    resp = client.get(reverse("auth:me"))
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# POST /api/v1/auth/logout/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_logout_authenticated(auth_client: APIClient):
    url = reverse("auth:logout")
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(auth_client: APIClient, active_user: User):
    refresh = _make_refresh(active_user)
    url_logout = reverse("auth:logout")
    resp = auth_client.post(url_logout, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK

    # Blacklisted refresh token must be rejected by /refresh
    url_refresh = reverse("auth:refresh")
    resp2 = APIClient().post(url_refresh, {"refresh": str(refresh)})
    assert resp2.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_logout_without_refresh_token_still_succeeds(auth_client: APIClient):
    url = reverse("auth:logout")
    resp = auth_client.post(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["data"]["message"] == "ログアウトしました。"


# ---------------------------------------------------------------------------
# POST /api/v1/auth/refresh/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_refresh_valid_token(client: APIClient, active_user: User):
    refresh = _make_refresh(active_user)
    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "access_token" in data["data"]


@pytest.mark.django_db
def test_refresh_returns_new_refresh_token(client: APIClient, active_user: User):
    refresh = _make_refresh(active_user)
    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "refresh_token" in data["data"]
    assert data["data"]["refresh_token"] != str(refresh)


@pytest.mark.django_db
def test_refresh_rotates_token_invalidates_old(client: APIClient, active_user: User):
    refresh = _make_refresh(active_user)
    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK

    # Original token is now blacklisted; cannot be reused
    resp2 = client.post(url, {"refresh": str(refresh)})
    assert resp2.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_blacklisted_refresh_token_cannot_refresh(client: APIClient, active_user: User):
    refresh = _make_refresh(active_user)
    refresh.blacklist()

    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_inactive_user_denied(client: APIClient, inactive_user: User):
    refresh = _make_refresh(inactive_user)
    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.django_db
def test_refresh_suspended_user_denied(client: APIClient, suspended_user: User):
    refresh = _make_refresh(suspended_user)
    url = reverse("auth:refresh")
    resp = client.post(url, {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# ---------------------------------------------------------------------------
# token_version: refresh endpoint guards
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_refresh_token_version_mismatch_denied(client: APIClient, active_user: User):
    """
    A refresh token with a stale token_version must not issue new access tokens.

    This closes the multi-device attack vector: after a password change or
    forced logout, incrementing User.token_version invalidates every outstanding
    refresh token across all sessions on the very next refresh attempt.
    """
    refresh = _make_refresh(active_user)

    # Simulate password change / forced-logout.
    active_user.token_version += 1
    active_user.save(update_fields=["token_version"])

    resp = client.post(reverse("auth:refresh"), {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_new_access_token_carries_token_version(client: APIClient, active_user: User):
    """New access token issued by /refresh/ must include the correct token_version."""
    refresh = _make_refresh(active_user)
    resp = client.post(reverse("auth:refresh"), {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK

    new_access = AccessToken(resp.json()["data"]["access_token"])
    assert new_access.payload.get("token_version") == active_user.token_version


@pytest.mark.django_db
def test_refresh_new_refresh_token_preserves_token_version(client: APIClient, active_user: User):
    """After token rotation the new refresh token must retain the same token_version."""
    refresh = _make_refresh(active_user)
    resp = client.post(reverse("auth:refresh"), {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_200_OK

    new_refresh = RefreshToken(resp.json()["data"]["refresh_token"])
    assert new_refresh.payload.get("token_version") == active_user.token_version


@pytest.mark.django_db
def test_refresh_then_old_access_token_still_rejected_after_version_increment(
    client: APIClient, active_user: User
):
    """
    Full attack scenario: user has device A and device B.

    1. Both hold refresh tokens at token_version=1.
    2. Password changes → token_version incremented to 2.
    3. Device A tries to refresh: token_version=1 ≠ DB(2) → 401.
    4. Device B already had a valid access token (token_version=1): 401 on next call.
    """
    refresh_a = _make_refresh(active_user)
    access_b_str = _make_access_str(active_user)

    # Increment token_version (password change / forced-logout).
    active_user.token_version += 1
    active_user.save(update_fields=["token_version"])

    # Device A: refresh attempt is rejected.
    resp_a = client.post(reverse("auth:refresh"), {"refresh": str(refresh_a)})
    assert resp_a.status_code == status.HTTP_401_UNAUTHORIZED

    # Device B: existing access token is rejected.
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_b_str}")
    resp_b = client.get(reverse("auth:me"))
    assert resp_b.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_invalid_token_version_type_returns_401(client: APIClient, active_user: User):
    """Non-numeric token_version in refresh token must return 401, not 500."""
    refresh = _make_refresh(active_user)
    refresh["token_version"] = "invalid"
    resp = client.post(reverse("auth:refresh"), {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_dict_token_version_returns_401(client: APIClient, active_user: User):
    """Dict-typed token_version in refresh token must return 401, not 500."""
    refresh = _make_refresh(active_user)
    refresh["token_version"] = {}
    resp = client.post(reverse("auth:refresh"), {"refresh": str(refresh)})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# Login throttle (P7-024)
# ---------------------------------------------------------------------------

@pytest.fixture
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _low_rate_rf():
    return {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"login": "3/min"}}


@pytest.mark.django_db
def test_login_throttle_returns_429(client: APIClient, active_user: User, clear_cache):
    url = reverse("auth:login")
    with override_settings(REST_FRAMEWORK=_low_rate_rf()):
        for _ in range(3):
            client.post(url, {"email": "test@example.com", "password": "wrong"})
        resp = client.post(url, {"email": "test@example.com", "password": "wrong"})
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
def test_login_throttle_success_within_limit(client: APIClient, active_user: User, clear_cache):
    url = reverse("auth:login")
    with override_settings(REST_FRAMEWORK=_low_rate_rf()):
        resp = client.post(url, {"email": "test@example.com", "password": "StrongPass123!"})
    assert resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_me_not_throttled_by_login_limit(auth_client: APIClient, clear_cache):
    """LoginRateThrottle must not affect endpoints other than /login/."""
    url = reverse("auth:me")
    with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"login": "1/min"}}):
        for _ in range(5):
            resp = auth_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
