"""
AIコンサルCRM - Test Settings
Used in CI and local test runs. SQLite in-memory to avoid PostgreSQL dependency.
"""
from .base import *  # noqa: F401, F403

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Disable password hashing to speed up tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Suppress logging noise in tests
LOGGING: dict = {}

# Celery: テスト中はタスクを同期実行してブローカー不要にする
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Raise login throttle limit so existing tests are unaffected.
# Throttle tests use override_settings + cache.clear() to test the limit itself.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {"login": "1000/min"},
}

# Use in-memory file storage to avoid leaving files on disk after tests
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
