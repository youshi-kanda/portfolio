"""
AI CRM Demo - Root URL Configuration
All API endpoints are versioned under /api/v1/.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health(request):
    return JsonResponse({"status": "ok"})


api_v1_patterns = [
    path("health/", health, name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("stores/", include("apps.stores.urls")),
    path("reservations/", include("apps.reservations.urls")),
    path("sales/", include("apps.sales.urls")),
    path("imports/", include("apps.imports.urls")),
    path("insights/", include("apps.insights.urls")),
    path("campaigns/", include("apps.campaigns.urls")),
    path("ai/", include("apps.ai_core.urls")),
    path("reports/", include("apps.reports.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]
