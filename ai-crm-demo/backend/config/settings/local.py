"""
AIコンサルCRM - Local Development Settings
Copy backend/.env.example to backend/.env and edit DB credentials.
"""
from .base import *  # noqa: F401, F403

DEBUG = True

CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
