from django.urls import path

from .views import SaleDetailView, SaleListCreateView

app_name = "sales"

urlpatterns = [
    path("", SaleListCreateView.as_view(), name="list-create"),
    path("<uuid:sale_id>/", SaleDetailView.as_view(), name="detail"),
]
