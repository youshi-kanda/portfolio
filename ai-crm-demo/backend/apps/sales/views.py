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

from .models import Sale
from .serializers import SaleCreateSerializer, SaleSerializer, SaleUpdateSerializer


def _get_sale_or_404(store, sale_id: uuid.UUID) -> Sale:
    try:
        return Sale.objects.get(id=sale_id, store=store, deleted_at__isnull=True)
    except Sale.DoesNotExist:
        raise NotFound("売上が見つかりません。") from None


class SaleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("customer_id",    str, description="顧客ID"),
            OpenApiParameter("reservation_id", str, description="予約ID"),
            OpenApiParameter("item_category",  str, description="service / product / ticket / subscription / other"),
            OpenApiParameter("payment_method", str, description="cash / card / qr / bank / other"),
            OpenApiParameter("contract_status",str, description="active / ended / renewal_due"),
            OpenApiParameter("sale_from",      str, description="売上日（開始）YYYY-MM-DD"),
            OpenApiParameter("sale_to",        str, description="売上日（終了）YYYY-MM-DD"),
        ],
        responses={200: SaleSerializer(many=True)},
        tags=["sales"],
        summary="売上一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = Sale.objects.filter(store=store, deleted_at__isnull=True)

        customer_id = request.query_params.get("customer_id", "").strip()
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        reservation_id = request.query_params.get("reservation_id", "").strip()
        if reservation_id:
            qs = qs.filter(reservation_id=reservation_id)

        item_category = request.query_params.get("item_category", "").strip()
        if item_category in Sale.ItemCategory.values:
            qs = qs.filter(item_category=item_category)

        payment_method = request.query_params.get("payment_method", "").strip()
        if payment_method in Sale.PaymentMethod.values:
            qs = qs.filter(payment_method=payment_method)

        contract_status = request.query_params.get("contract_status", "").strip()
        if contract_status in Sale.ContractStatus.values:
            qs = qs.filter(contract_status=contract_status)

        sale_from = request.query_params.get("sale_from", "").strip()
        if sale_from:
            qs = qs.filter(sale_date__gte=sale_from)

        sale_to = request.query_params.get("sale_to", "").strip()
        if sale_to:
            qs = qs.filter(sale_date__lte=sale_to)

        qs = qs.order_by("sale_date")
        return _ok_list(SaleSerializer(qs, many=True).data, total=qs.count())

    @extend_schema(
        request=SaleCreateSerializer,
        responses={201: SaleSerializer},
        tags=["sales"],
        summary="売上登録",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        sale = Sale.objects.create(store=store, **data)

        return _ok(SaleSerializer(sale).data, http_status=status.HTTP_201_CREATED)


class SaleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: SaleSerializer},
        tags=["sales"],
        summary="売上詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, sale_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        sale = _get_sale_or_404(store, sale_id)
        return _ok(SaleSerializer(sale).data)

    @extend_schema(
        request=SaleUpdateSerializer,
        responses={200: SaleSerializer},
        tags=["sales"],
        summary="売上更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID, sale_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        sale = _get_sale_or_404(store, sale_id)

        serializer = SaleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(sale, field, value)
        sale.save()

        return _ok(SaleSerializer(sale).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="論理削除成功")},
        tags=["sales"],
        summary="売上削除（論理削除）",
    )
    def delete(self, request: Request, store_id: uuid.UUID, sale_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        sale = _get_sale_or_404(store, sale_id)
        sale.deleted_at = timezone.now()
        sale.save(update_fields=["deleted_at"])
        return _ok({"message": "売上を削除しました。"})
