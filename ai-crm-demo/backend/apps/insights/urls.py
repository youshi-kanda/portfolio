from django.urls import path

from .views import CustomerInsightDetailView, CustomerInsightListView, CustomerInsightRecalculateView

app_name = "insights"

urlpatterns = [
    path("", CustomerInsightListView.as_view(), name="list"),
    path("recalculate/", CustomerInsightRecalculateView.as_view(), name="recalculate"),
    path("<uuid:insight_id>/", CustomerInsightDetailView.as_view(), name="detail"),
]
