from django.urls import include, path

from .views import (
    CustomerConsentView,
    CustomerDetailView,
    CustomerListCreateView,
    CustomerResubscribeView,
    CustomerUnsubscribeView,
)

app_name = "customers"

urlpatterns = [
    path("", CustomerListCreateView.as_view(), name="list-create"),
    path("<uuid:customer_id>/", CustomerDetailView.as_view(), name="detail"),
    path("<uuid:customer_id>/consents/", CustomerConsentView.as_view(), name="consents"),
    path("<uuid:customer_id>/unsubscribe/", CustomerUnsubscribeView.as_view(), name="unsubscribe"),
    path("<uuid:customer_id>/resubscribe/", CustomerResubscribeView.as_view(), name="resubscribe"),
    path("<uuid:customer_id>/insights/", include("apps.insights.urls")),
]
