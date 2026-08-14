from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle

from apps.audit.services import _client_ip


class LoginRateThrottle(SimpleRateThrottle):
    """IP-based rate limit for the login endpoint only."""

    scope = "login"

    def get_rate(self):
        # Read directly from api_settings so override_settings in tests takes effect.
        # SimpleRateThrottle.THROTTLE_RATES is a class attribute frozen at import time
        # and does not respond to override_settings.
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)

    def get_cache_key(self, request, view):
        ip = _client_ip(request)
        return self.cache_format % {"scope": self.scope, "ident": ip}
