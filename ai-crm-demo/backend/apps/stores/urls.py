from django.urls import include, path

from apps.audit.views import IncidentReportDetailView, IncidentReportListCreateView
from apps.ai_core.views import ExpressionCheckView
from apps.campaigns.views import CampaignContentStoreListView
from apps.insights.views import DashboardView

from .views import (
    CollaboratorDetailView,
    CollaboratorListCreateView,
    MenuDetailView,
    MenuListCreateView,
    MyStorePermissionsView,
    StoreDetailView,
    StoreListCreateView,
    StoreSettingsView,
    StoreToolDetailView,
    StoreToolListCreateView,
)

app_name = "stores"

urlpatterns = [
    path("", StoreListCreateView.as_view(), name="list-create"),
    path("<uuid:store_id>/", StoreDetailView.as_view(), name="detail"),
    path("<uuid:store_id>/settings/", StoreSettingsView.as_view(), name="settings"),
    path("<uuid:store_id>/tools/", StoreToolListCreateView.as_view(), name="tools-list-create"),
    path("<uuid:store_id>/tools/<uuid:tool_id>/", StoreToolDetailView.as_view(), name="tools-detail"),
    path("<uuid:store_id>/menus/", MenuListCreateView.as_view(), name="menus-list-create"),
    path("<uuid:store_id>/menus/<uuid:menu_id>/", MenuDetailView.as_view(), name="menus-detail"),
    path("<uuid:store_id>/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("<uuid:store_id>/customers/", include("apps.customers.urls")),
    path("<uuid:store_id>/reservations/", include("apps.reservations.urls")),
    path("<uuid:store_id>/sales/", include("apps.sales.urls")),
    path("<uuid:store_id>/imports/", include("apps.imports.urls")),
    path("<uuid:store_id>/audit-logs/", include("apps.audit.urls")),
    path("<uuid:store_id>/incidents/", IncidentReportListCreateView.as_view(), name="incidents-list-create"),
    path("<uuid:store_id>/incidents/<uuid:incident_id>/", IncidentReportDetailView.as_view(), name="incidents-detail"),
    path("<uuid:store_id>/campaigns/", include("apps.campaigns.urls")),
    path("<uuid:store_id>/campaign-contents/", CampaignContentStoreListView.as_view(), name="campaign-contents-list"),
    path("<uuid:store_id>/ai/expression-check/", ExpressionCheckView.as_view(), name="ai-expression-check"),
    path("<uuid:store_id>/reports/", include("apps.reports.urls")),
    path("<uuid:store_id>/my-permissions/", MyStorePermissionsView.as_view(), name="my-permissions"),
    path("<uuid:store_id>/collaborators/", CollaboratorListCreateView.as_view(), name="collaborators-list-create"),
    path("<uuid:store_id>/collaborators/<uuid:collab_id>/", CollaboratorDetailView.as_view(), name="collaborators-detail"),
]
