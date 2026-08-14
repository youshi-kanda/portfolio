from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import User


class TokenVersionJWTAuthentication(JWTAuthentication):
    """
    JWTAuthentication with two additional guards applied on every API request:

    1. status check — rejects SUSPENDED/INVITED users even when is_active=True.
       Standard JWTAuthentication only checks is_active, so a suspended user whose
       is_active was not explicitly set to False could use a valid access token.

    2. token_version check — rejects tokens whose version claim no longer matches
       the value stored in the DB.  Incrementing User.token_version (on password
       change, forced logout, or suspension) invalidates all outstanding tokens
       immediately on the next API call, without a full blacklist scan.

    Both access tokens and refresh tokens carry the token_version claim (set in
    LoginView, preserved through rotation in RefreshView).  This ensures that an
    attacker with a stolen refresh token cannot obtain a new access token once the
    victim's token_version has been incremented.
    """

    def get_user(self, validated_token):
        # Standard lookup + is_active check (raises AuthenticationFailed on failure).
        user = super().get_user(validated_token)

        if user.status != User.Status.ACTIVE:
            raise InvalidToken("このアカウントは現在利用できません。")

        token_version = validated_token.get("token_version")
        try:
            if token_version is None or int(token_version) != user.token_version:
                raise InvalidToken("トークンが無効です。再ログインしてください。")
        except (TypeError, ValueError):
            raise InvalidToken("トークンが無効です。再ログインしてください。")

        return user
