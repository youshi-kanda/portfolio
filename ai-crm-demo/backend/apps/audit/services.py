from __future__ import annotations

from typing import Any

from .models import AuditLog


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def write_audit_log(
    *,
    request=None,
    user=None,
    store=None,
    action: str,
    target_type: str | None = None,
    target_id=None,
    before_snapshot: dict[str, Any] | None = None,
    after_snapshot: dict[str, Any] | None = None,
) -> AuditLog:
    if request is not None:
        user = user or getattr(request, "user", None)

    tenant_id = getattr(store, "tenant_id", None)
    if tenant_id is None and user is not None and getattr(user, "is_authenticated", False):
        tenant_id = user.id

    ip_address = _client_ip(request) if request is not None else ""
    user_agent = request.META.get("HTTP_USER_AGENT", "") if request is not None else ""

    return AuditLog.objects.create(
        tenant_id=tenant_id,
        store=store,
        user=user if user is not None and getattr(user, "is_authenticated", False) else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
        ip_address=ip_address or None,
        user_agent=user_agent or None,
    )
