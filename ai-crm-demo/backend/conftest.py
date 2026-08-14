import django
import pytest
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def pytest_configure():
    if not settings.configured:
        django.setup()


# ---------------------------------------------------------------------------
# token_version compatibility shim
#
# TokenVersionJWTAuthentication requires every JWT to carry a `token_version`
# claim that matches User.token_version in the DB.  Tests that call
# RefreshToken.for_user() directly (bypassing LoginView) would otherwise
# produce tokens without this claim and receive 401 from every endpoint.
#
# Patching for_user here is simpler than touching ~45 individual test files
# and is exactly what conftest.py is for: shared test infrastructure.
# The monkeypatch is function-scoped, so it reverts cleanly after each test.
# ---------------------------------------------------------------------------

_orig_for_user = RefreshToken.for_user.__func__


def _for_user_with_token_version(cls, user, *args, **kwargs):
    token = _orig_for_user(cls, user, *args, **kwargs)
    token["token_version"] = getattr(user, "token_version", 1)
    return token


@pytest.fixture(autouse=True)
def _patch_refresh_token_for_user(monkeypatch):
    monkeypatch.setattr(
        RefreshToken,
        "for_user",
        classmethod(_for_user_with_token_version),
    )
