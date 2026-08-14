"""
Portfolio Demo safety guard.

When DEMO_MODE=true, certain destructive or account-shape mutations are
blocked at the handler entry point so that visitors to the public demo
cannot wipe seed data, invite real collaborators, or execute bulk CSV
imports against the shared demo database.

Guarded operations return HTTP 403 with a machine-parseable error code
and a Japanese/English message. DEMO_MODE=false (the default in
local.py / test.py) leaves behavior identical to production.
"""
from django.conf import settings
from rest_framework.exceptions import PermissionDenied


class DemoModeDisabled(PermissionDenied):
    default_detail = "This operation is disabled in portfolio demo mode."
    default_code = "demo_mode_disabled"


def deny_if_demo() -> None:
    """Raise 403 DemoModeDisabled when settings.DEMO_MODE is truthy."""
    if getattr(settings, "DEMO_MODE", False):
        raise DemoModeDisabled()
