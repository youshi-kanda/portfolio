"""
AIコンサルCRM - Custom Exception Handler
Converts DRF exceptions to the unified error response format defined in CLAUDE.md section 9/10.
"""
import logging
import uuid

from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from config.demo_guard import DemoModeDisabled

logger = logging.getLogger(__name__)

_STATUS_TO_CODE = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: "FILE_TOO_LARGE",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_FILE_TYPE",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "BUSINESS_RULE_ERROR",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_ERROR",
}


def _make_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def _flatten_validation_errors(detail, field_prefix: str = "") -> list[dict]:
    """Recursively flatten DRF ValidationError detail into a flat list of field errors."""
    errors: list[dict] = []
    if isinstance(detail, list):
        for item in detail:
            if isinstance(item, dict):
                errors.extend(_flatten_validation_errors(item, field_prefix))
            else:
                errors.append({"field": field_prefix or "non_field_errors", "message": str(item)})
    elif isinstance(detail, dict):
        for key, value in detail.items():
            full_key = f"{field_prefix}.{key}" if field_prefix else key
            errors.extend(_flatten_validation_errors(value, full_key))
    else:
        errors.append({"field": field_prefix or "non_field_errors", "message": str(detail)})
    return errors


def custom_exception_handler(exc, context):
    request_id = _make_request_id()

    # Let DRF build the base response first
    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled server-side error — do not leak internals
        logger.exception("Unhandled exception in view %s", context.get("view"))
        return Response(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "サーバーエラーが発生しました。時間をおいて再度お試しください。",
                    "details": [],
                },
                "meta": {"request_id": request_id},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Map exception type to code + user-facing message
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        code = "UNAUTHORIZED"
        message = "認証が必要です。ログインしてください。"
        # DRF maps AuthenticationFailed to 403 by default; normalize to 401.
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, DemoModeDisabled):
        code = "DEMO_MODE_DISABLED"
        message = str(exc.detail)
    elif isinstance(exc, PermissionDenied):
        code = "FORBIDDEN"
        message = "この操作を実行する権限がありません。"
    elif isinstance(exc, NotFound):
        code = "NOT_FOUND"
        message = "指定されたリソースが見つかりません。"
    elif isinstance(exc, ValidationError):
        code = "VALIDATION_ERROR"
        message = "入力内容に誤りがあります。"
    else:
        code = _STATUS_TO_CODE.get(response.status_code, "INTERNAL_ERROR")
        message = str(exc.detail) if hasattr(exc, "detail") else "エラーが発生しました。"

    details: list[dict] = []
    if isinstance(exc, ValidationError):
        details = _flatten_validation_errors(exc.detail)

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "meta": {"request_id": request_id},
    }
    return response
