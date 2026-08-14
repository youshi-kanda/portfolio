import uuid

from django.db.models import Count, Max, OuterRef, Prefetch, Q, Subquery, Sum
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log
from apps.insights.models import CustomerInsight
from apps.stores.views import _get_store_or_404, _get_store_or_404_with_collab, _ok, _ok_list
from config.demo_guard import deny_if_demo

from .models import Customer, CustomerConsent, CustomerProfile
from .serializers import (
    CustomerConsentSerializer,
    CustomerConsentUpdateSerializer,
    CustomerCreateSerializer,
    CustomerListMaskedSerializer,
    CustomerListSerializer,
    CustomerMaskedSerializer,
    CustomerSerializer,
    CustomerUpdateSerializer,
)


def _get_customer_or_404(store, customer_id: uuid.UUID) -> Customer:
    try:
        return Customer.objects.select_related("profile", "consent").get(
            id=customer_id, store=store, deleted_at__isnull=True
        )
    except Customer.DoesNotExist:
        raise NotFound("顧客が見つかりません。") from None


class CustomerListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, description="display_name / full_name / phone / email 部分一致"),
            OpenApiParameter("status", str, description="active / inactive"),
            OpenApiParameter("customer_state", str, description="顧客状態フィルタ"),
            OpenApiParameter("is_unsubscribed", str, description="配信停止フィルタ (true/false)"),
            OpenApiParameter("page", int, description="ページ番号 (1始まり)"),
        ],
        responses={200: CustomerListSerializer(many=True)},
        tags=["customers"],
        summary="顧客一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store, collab = _get_store_or_404_with_collab(store_id, request.user)
        mask = collab is not None and not collab.can_view_personal_info

        latest_state_subq = (
            CustomerInsight.objects.filter(customer_id=OuterRef("pk"))
            .order_by("-insight_date", "-created_at")
            .values("customer_state")[:1]
        )

        qs = (
            Customer.objects.select_related("profile", "consent")
            .prefetch_related(
                Prefetch(
                    "insights",
                    queryset=CustomerInsight.objects.order_by("-insight_date", "-created_at"),
                    to_attr="prefetched_insights",
                )
            )
            .filter(store=store, deleted_at__isnull=True)
            .annotate(
                visit_count=Count(
                    "reservations", filter=Q(reservations__visited_at__isnull=False)
                ),
                last_visit_date=Max(
                    "reservations__visited_at",
                    filter=Q(reservations__visited_at__isnull=False),
                ),
                ltv=Sum("sales__amount"),
                _customer_state=Subquery(latest_state_subq),
            )
        )

        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(display_name__icontains=q)
                | Q(full_name__icontains=q)
                | Q(phone__icontains=q)
                | Q(email__icontains=q)
            )

        status_filter = request.query_params.get("status", "").strip()
        if status_filter in Customer.Status.values:
            qs = qs.filter(status=status_filter)

        customer_state_filter = request.query_params.get("customer_state", "").strip()
        if customer_state_filter:
            qs = qs.filter(_customer_state=customer_state_filter)

        is_unsub_raw = request.query_params.get("is_unsubscribed", "").strip().lower()
        if is_unsub_raw == "true":
            qs = qs.filter(consent__is_unsubscribed=True)
        elif is_unsub_raw == "false":
            qs = qs.filter(consent__is_unsubscribed=False)

        qs = qs.order_by("created_at")
        total = qs.count()

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        per_page = 50
        offset = (page - 1) * per_page

        list_serializer = CustomerListMaskedSerializer if mask else CustomerListSerializer
        return _ok_list(
            list_serializer(qs[offset : offset + per_page], many=True).data,
            total=total,
            page=page,
            per_page=per_page,
        )

    @extend_schema(
        request=CustomerCreateSerializer,
        responses={201: CustomerSerializer},
        tags=["customers"],
        summary="顧客作成",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = CustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_data, profile_data = serializer.split()
        customer = Customer.objects.create(store=store, **customer_data)
        CustomerProfile.objects.create(customer=customer, store_id=store.id, **profile_data)
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CUSTOMER_CREATED,
            target_type="customer",
            target_id=customer.id,
            after_snapshot={
                "customer_fields": sorted(customer_data.keys()),
                "profile_fields": sorted(profile_data.keys()),
            },
        )

        customer.refresh_from_db()
        return _ok(
            CustomerSerializer(Customer.objects.select_related("profile", "consent").get(id=customer.id)).data,
            http_status=status.HTTP_201_CREATED,
        )


class CustomerDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerSerializer},
        tags=["customers"],
        summary="顧客詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store, collab = _get_store_or_404_with_collab(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)
        mask = collab is not None and not collab.can_view_personal_info
        detail_serializer = CustomerMaskedSerializer if mask else CustomerSerializer
        return _ok(detail_serializer(customer).data)

    @extend_schema(
        request=CustomerUpdateSerializer,
        responses={200: CustomerSerializer},
        tags=["customers"],
        summary="顧客更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        serializer = CustomerUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_data, profile_data = serializer.split()
        changed_customer_fields = sorted(customer_data.keys())
        changed_profile_fields = sorted(profile_data.keys())

        for field, value in customer_data.items():
            setattr(customer, field, value)
        if customer_data:
            customer.save()

        if profile_data:
            profile, _ = CustomerProfile.objects.get_or_create(
                customer=customer, defaults={"store_id": store.id}
            )
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()
        if changed_customer_fields or changed_profile_fields:
            write_audit_log(
                request=request,
                store=store,
                action=AuditLog.Action.CUSTOMER_UPDATED,
                target_type="customer",
                target_id=customer.id,
                before_snapshot={
                    "customer_fields": changed_customer_fields,
                    "profile_fields": changed_profile_fields,
                },
                after_snapshot={
                    "customer_fields": changed_customer_fields,
                    "profile_fields": changed_profile_fields,
                },
            )

        return _ok(CustomerSerializer(Customer.objects.select_related("profile", "consent").get(id=customer.id)).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="論理削除成功")},
        tags=["customers"],
        summary="顧客削除（論理削除）",
    )
    def delete(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        now = timezone.now()

        # 論理削除 + PII anonymize
        customer.deleted_at = now
        customer.status = Customer.Status.INACTIVE
        customer.line_user_id = None
        customer.display_name = None
        customer.full_name = None
        customer.kana = None
        customer.phone = None
        customer.email = None
        customer.external_customer_id = None
        customer.save(update_fields=[
            "deleted_at", "status",
            "line_user_id", "display_name", "full_name", "kana",
            "phone", "email", "external_customer_id",
        ])

        # CustomerProfile PII anonymize
        try:
            profile = customer.profile
            profile.note = None
            profile.birth_date = None
            profile.residential_area = None
            profile.occupation = None
            profile.preferences = None
            profile.save(update_fields=[
                "note", "birth_date", "residential_area", "occupation", "preferences",
            ])
        except CustomerProfile.DoesNotExist:
            pass

        # CustomerConsent: 配信停止・全同意失効
        consent, _ = CustomerConsent.objects.get_or_create(
            customer=customer,
            defaults={"store_id": store.id},
        )
        consent.contact_line_allowed = False
        consent.contact_email_allowed = False
        consent.contact_sms_allowed = False
        consent.analysis_allowed = False
        consent.external_integration_allowed = False
        consent.is_unsubscribed = True
        if not consent.unsubscribed_at:
            consent.unsubscribed_at = now
        consent.save(update_fields=[
            "contact_line_allowed", "contact_email_allowed", "contact_sms_allowed",
            "analysis_allowed", "external_integration_allowed",
            "is_unsubscribed", "unsubscribed_at", "updated_at",
        ])

        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CUSTOMER_DELETED,
            target_type="customer",
            target_id=customer.id,
            after_snapshot={"status": customer.status},
        )
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CUSTOMER_ANONYMIZED,
            target_type="customer",
            target_id=customer.id,
            after_snapshot={"anonymized": True, "consent_revoked": True},
        )
        return _ok({"message": "顧客を削除しました。"})


class CustomerConsentView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerConsentSerializer},
        tags=["customers"],
        summary="同意状態取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)
        try:
            consent = customer.consent
        except CustomerConsent.DoesNotExist:
            raise NotFound("同意情報が見つかりません。") from None
        return _ok(CustomerConsentSerializer(consent).data)

    @extend_schema(
        request=CustomerConsentUpdateSerializer,
        responses={200: CustomerConsentSerializer},
        tags=["customers"],
        summary="同意状態更新（なければ作成）",
    )
    def patch(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        serializer = CustomerConsentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        consent, _ = CustomerConsent.objects.get_or_create(
            customer=customer,
            defaults={"store_id": store.id},
        )
        changed_fields = sorted(serializer.validated_data.keys())
        for field, value in serializer.validated_data.items():
            setattr(consent, field, value)
        consent.save()
        if changed_fields:
            write_audit_log(
                request=request,
                store=store,
                action=AuditLog.Action.CONSENT_UPDATED,
                target_type="customer_consent",
                target_id=consent.id,
                before_snapshot={"changed_fields": changed_fields},
                after_snapshot={"changed_fields": changed_fields},
            )

        return _ok(CustomerConsentSerializer(consent).data)


class CustomerUnsubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerConsentSerializer},
        tags=["customers"],
        summary="配信停止",
    )
    def post(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        consent, _ = CustomerConsent.objects.get_or_create(
            customer=customer,
            defaults={"store_id": store.id},
        )
        consent.is_unsubscribed = True
        consent.unsubscribed_at = timezone.now()
        consent.save(update_fields=["is_unsubscribed", "unsubscribed_at", "updated_at"])
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.UNSUBSCRIBED,
            target_type="customer_consent",
            target_id=consent.id,
            after_snapshot={"is_unsubscribed": True},
        )

        return _ok(CustomerConsentSerializer(consent).data)


class CustomerResubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: CustomerConsentSerializer},
        tags=["customers"],
        summary="配信停止解除",
    )
    def post(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        consent, _ = CustomerConsent.objects.get_or_create(
            customer=customer,
            defaults={"store_id": store.id},
        )
        consent.is_unsubscribed = False
        consent.unsubscribed_at = None
        consent.save(update_fields=["is_unsubscribed", "unsubscribed_at", "updated_at"])
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.RESUBSCRIBED,
            target_type="customer_consent",
            target_id=consent.id,
            after_snapshot={"is_unsubscribed": False},
        )

        return _ok(CustomerConsentSerializer(consent).data)
