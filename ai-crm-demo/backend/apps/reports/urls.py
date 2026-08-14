from django.urls import path

from .views import MonthlyReportGenerateView, ReportDetailView, ReportListView

app_name = "reports"

urlpatterns = [
    path("", ReportListView.as_view(), name="list"),
    path("<uuid:report_id>/", ReportDetailView.as_view(), name="detail"),
    path("monthly/generate/", MonthlyReportGenerateView.as_view(), name="monthly-generate"),
]
