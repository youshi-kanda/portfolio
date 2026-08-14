import uuid

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stores.views import _get_store_or_404, _ok, _ok_list
from config.demo_guard import deny_if_demo

from .models import Reservation
from .serializers import ReservationCreateSerializer, ReservationSerializer, ReservationUpdateSerializer


def _get_reservation_or_404(store, reservation_id: uuid.UUID) -> Reservation:
    try:
        return Reservation.objects.get(id=reservation_id, store=store, deleted_at__isnull=True)
    except Reservation.DoesNotExist:
        raise NotFound("予約が見つかりません。") from None


class ReservationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("customer_id", str, description="顧客ID"),
            OpenApiParameter("status", str, description="reserved / visited / cancelled / no_show"),
            OpenApiParameter("channel", str, description="予約経路"),
            OpenApiParameter("scheduled_from", str, description="来店予定日時（開始）ISO8601"),
            OpenApiParameter("scheduled_to", str, description="来店予定日時（終了）ISO8601"),
        ],
        responses={200: ReservationSerializer(many=True)},
        tags=["reservations"],
        summary="予約一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = Reservation.objects.filter(store=store, deleted_at__isnull=True)

        customer_id = request.query_params.get("customer_id", "").strip()
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        status_filter = request.query_params.get("status", "").strip()
        if status_filter in Reservation.Status.values:
            qs = qs.filter(status=status_filter)

        channel_filter = request.query_params.get("channel", "").strip()
        if channel_filter in Reservation.Channel.values:
            qs = qs.filter(channel=channel_filter)

        scheduled_from = request.query_params.get("scheduled_from", "").strip()
        if scheduled_from:
            qs = qs.filter(scheduled_start_at__gte=scheduled_from)

        scheduled_to = request.query_params.get("scheduled_to", "").strip()
        if scheduled_to:
            qs = qs.filter(scheduled_start_at__lte=scheduled_to)

        qs = qs.order_by("scheduled_start_at")
        return _ok_list(ReservationSerializer(qs, many=True).data, total=qs.count())

    @extend_schema(
        request=ReservationCreateSerializer,
        responses={201: ReservationSerializer},
        tags=["reservations"],
        summary="予約登録",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = ReservationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        reservation = Reservation.objects.create(store=store, **data)

        return _ok(ReservationSerializer(reservation).data, http_status=status.HTTP_201_CREATED)


class ReservationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ReservationSerializer},
        tags=["reservations"],
        summary="予約詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, reservation_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        reservation = _get_reservation_or_404(store, reservation_id)
        return _ok(ReservationSerializer(reservation).data)

    @extend_schema(
        request=ReservationUpdateSerializer,
        responses={200: ReservationSerializer},
        tags=["reservations"],
        summary="予約更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID, reservation_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        reservation = _get_reservation_or_404(store, reservation_id)

        serializer = ReservationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(reservation, field, value)
        reservation.save()

        return _ok(ReservationSerializer(reservation).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="論理削除成功")},
        tags=["reservations"],
        summary="予約削除（論理削除）",
    )
    def delete(self, request: Request, store_id: uuid.UUID, reservation_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        reservation = _get_reservation_or_404(store, reservation_id)
        reservation.deleted_at = timezone.now()
        reservation.save(update_fields=["deleted_at"])
        return _ok({"message": "予約を削除しました。"})
