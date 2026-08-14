import logging
import uuid

from django.contrib.auth import authenticate
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log
from apps.stores.models import Store
from apps.stores.serializers import StoreBasicSerializer

from .models import User
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    MeResponseSerializer,
    TokenRefreshBodySerializer,
    UserSerializer,
)
from .throttles import LoginRateThrottle

logger = logging.getLogger(__name__)


def _request_id() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def _ok(data: dict, http_status: int = status.HTTP_200_OK) -> Response:
    return Response({"data": data, "meta": {"request_id": _request_id()}}, status=http_status)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def throttled(self, request, wait):
        try:
            write_audit_log(
                request=request,
                user=None,
                action=AuditLog.Action.LOGIN_THROTTLED,
                target_type="login_attempt",
                target_id=None,
            )
        except Exception:
            logger.exception("Failed to write LOGIN_THROTTLED audit log")
        super().throttled(request, wait)

    @extend_schema(
        request=LoginSerializer,
        responses={200: OpenApiResponse(description="JWT tokens + user info")},
        tags=["auth"],
        summary="ログイン",
    )
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email: str = serializer.validated_data["email"]
        password: str = serializer.validated_data["password"]

        user = authenticate(request, username=email, password=password)

        if user is None:
            raise AuthenticationFailed("メールアドレスまたはパスワードが正しくありません。")

        if user.status != user.Status.ACTIVE:
            raise AuthenticationFailed("このアカウントは現在利用できません。")

        # Update last login timestamp
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])
        write_audit_log(
            request=request,
            user=user,
            action=AuditLog.Action.LOGIN,
            target_type="user",
            target_id=user.id,
        )

        refresh = RefreshToken.for_user(user)
        # Embed token_version in the refresh token.  SimpleJWT's access_token
        # property copies all non-standard claims (everything except token_type,
        # exp, iat, jti) to the derived access token, so the claim propagates
        # automatically without a separate set on the access token.
        refresh["token_version"] = user.token_version
        return _ok({
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=LogoutSerializer,
        responses={200: OpenApiResponse(description="ログアウト成功")},
        tags=["auth"],
        summary="ログアウト",
    )
    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_str = serializer.validated_data.get("refresh")
        if refresh_str:
            try:
                token = RefreshToken(refresh_str)
                token.blacklist()
            except TokenError:
                # Already expired / invalid / blacklisted — logout proceeds.
                pass

        write_audit_log(
            request=request,
            user=request.user,
            action=AuditLog.Action.LOGOUT,
            target_type="user",
            target_id=request.user.id,
        )
        return _ok({"message": "ログアウトしました。"})


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=TokenRefreshBodySerializer,
        responses={200: OpenApiResponse(description="新しいアクセストークン")},
        tags=["auth"],
        summary="トークンリフレッシュ",
    )
    def post(self, request: Request) -> Response:
        serializer = TokenRefreshBodySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            refresh = RefreshToken(serializer.validated_data["refresh"])

            # Deny refresh if the user account has been deactivated or suspended.
            user_id = refresh.payload.get(jwt_settings.USER_ID_CLAIM)
            if not user_id:
                raise InvalidToken("トークンが無効です。")

            user_obj = User.objects.filter(pk=user_id).first()
            if user_obj is None or not user_obj.is_active or user_obj.status != User.Status.ACTIVE:
                raise InvalidToken("このアカウントは現在利用できません。")

            # Reject refresh tokens whose token_version no longer matches the DB.
            # This closes the multi-device gap: after a password change or forced
            # logout, incrementing User.token_version invalidates every outstanding
            # refresh token across all devices on the very next refresh attempt.
            token_version = refresh.payload.get("token_version")
            try:
                if token_version is None or int(token_version) != user_obj.token_version:
                    raise InvalidToken("トークンが無効です。再ログインしてください。")
            except (TypeError, ValueError):
                raise InvalidToken("トークンが無効です。再ログインしてください。")

            # Build the new access token.  token_version is already in refresh.payload
            # and gets copied automatically by SimpleJWT's access_token property.
            data: dict = {"access_token": str(refresh.access_token)}

            if jwt_settings.ROTATE_REFRESH_TOKENS:
                if jwt_settings.BLACKLIST_AFTER_ROTATION:
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        pass
                # set_jti / set_exp / set_iat only update those three fields;
                # token_version remains in the payload and carries over to the
                # rotated refresh token automatically.
                refresh.set_jti()
                refresh.set_exp()
                refresh.set_iat()
                data["refresh_token"] = str(refresh)

            return _ok(data)
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: MeResponseSerializer},
        tags=["auth"],
        summary="ログインユーザー情報取得",
    )
    def get(self, request: Request) -> Response:
        stores = Store.objects.filter(created_by=request.user, deleted_at__isnull=True)
        return _ok({
            "user": UserSerializer(request.user).data,
            "stores": StoreBasicSerializer(stores, many=True).data,
        })
