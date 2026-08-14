from django.urls import path

from .views import ReservationDetailView, ReservationListCreateView

app_name = "reservations"

urlpatterns = [
    path("", ReservationListCreateView.as_view(), name="list-create"),
    path("<uuid:reservation_id>/", ReservationDetailView.as_view(), name="detail"),
]
