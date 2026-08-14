"""
AI CRM Demo - Portfolio Demo Settings

Load with:

    DJANGO_SETTINGS_MODULE=config.settings.demo python manage.py runserver

Assumptions:
  - Runs against a local PostgreSQL (or SQLite if DB_ENGINE=sqlite).
  - AI provider is forced to "mock" so no external API keys are required.
  - No LINE credentials, no Celery, no Redis, no production domain.
  - DEBUG is on for readable error pages during the demo walkthrough.

Never deploy this file to a real production environment.
"""
import os

from .base import *  # noqa: F401, F403

DEBUG = True

DEMO_MODE = True

# The demo intentionally forces the AI provider to mock, even if the
# operator leaves ANTHROPIC_API_KEY in their environment.
AI_PROVIDER = "mock"

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Optional: SQLite fallback so recruiters can spin up the demo without
# provisioning PostgreSQL.
if os.environ.get("DB_ENGINE", "").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "demo.sqlite3",  # noqa: F405
        }
    }
