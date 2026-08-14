from django.urls import path

from .views import AuditLogDetailView, AuditLogListView

app_name = "audit"

urlpatterns = [
    path("", AuditLogListView.as_view(), name="list"),
    path("<uuid:audit_log_id>/", AuditLogDetailView.as_view(), name="detail"),
]
