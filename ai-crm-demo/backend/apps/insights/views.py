import uuid
from datetime import date

from django.db.models import Count, Exists, OuterRef, Subquery, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log
from apps.customers.models import Customer
from apps.reservations.models import Reservation
from apps.sales.models import Sale
from apps.stores.views import _get_store_or_404, _ok, _ok_list

from .models import CustomerInsight
from .serializers import CustomerInsightReviewUpdateSerializer, CustomerInsightSerializer
from .services import (
    build_dashboard_ai_diagnosis,
    build_monthly_focus,
    build_weekly_actions,
    calculate_customer_state,
)

_ACTIVE_STATES = {
    CustomerInsight.CustomerState.NEW_LEAD,
    CustomerInsight.CustomerState.FIRST_RESERVED,
    CustomerInsight.CustomerState.AFTER_FIRST_VISIT,
    CustomerInsight.CustomerState.REPEATER,
    CustomerInsight.CustomerState.VIP_CANDIDATE,
}
_AT_RISK_STATES = {
    CustomerInsight.CustomerState.PRE_DORMANT,
    CustomerInsight.CustomerState.HIGH_RISK,
}
_DORMANT_STATES = {CustomerInsight.CustomerState.DORMANT}


def _get_customer_or_404(store, customer_id: uuid.UUID) -> Customer:
    try:
        return Customer.objects.select_related("profile").get(
            id=customer_id, store=store, deleted_at__isnull=True
        )
    except Customer.DoesNotExist:
        raise NotFound("顧客が見つかりません。") from None


class CustomerInsightListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        qs      = CustomerInsight.objects.filter(customer=customer).order_by("-insight_date", "-created_at")
        total   = qs.count()
        insights = qs[:10]

        data = CustomerInsightSerializer(insights, many=True).data
        return _ok_list(list(data), total=total)


class CustomerInsightRecalculateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, customer_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        try:
            store_settings = store.settings
        except Exception:
            store_settings = None

        result = calculate_customer_state(customer, store_settings)

        insight = CustomerInsight.objects.create(
            store_id           = store.id,
            customer           = customer,
            insight_date       = date.today(),
            customer_state     = result["customer_state"],
            priority           = result["priority"],
            evidence_summary   = result["evidence_summary"],
            ai_confidence      = result["ai_confidence"],
            inferred_needs     = result["inferred_needs"],
            blocking_factors   = result["blocking_factors"],
            recommended_action = result["recommended_action"],
            created_by_ai      = True,
        )

        data = CustomerInsightSerializer(insight).data
        return _ok(dict(data))


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        base_customers = Customer.objects.filter(store=store, deleted_at__isnull=True)
        total_customers = base_customers.count()
        new_customers_this_month = base_customers.filter(created_at__gte=month_start).count()

        # 最新インサイトで顧客状態を集計
        latest_insight_subquery = (
            CustomerInsight.objects
            .filter(store_id=store.id, customer=OuterRef("pk"))
            .order_by("-insight_date", "-created_at")
            .values("customer_state")[:1]
        )
        future_reservation_subquery = Reservation.objects.filter(
            store=store,
            customer=OuterRef("pk"),
            status=Reservation.Status.RESERVED,
            scheduled_start_at__gte=now,
            deleted_at__isnull=True,
        )
        customers_with_state = base_customers.annotate(
            latest_state=Subquery(latest_insight_subquery),
            has_future_reservation=Exists(future_reservation_subquery),
        )

        active_customers  = customers_with_state.filter(latest_state__in=_ACTIVE_STATES).count()
        at_risk_customers = customers_with_state.filter(latest_state__in=_AT_RISK_STATES).count()
        dormant_customers = customers_with_state.filter(latest_state__in=_DORMANT_STATES).count()
        pre_dormant_customers = customers_with_state.filter(
            latest_state=CustomerInsight.CustomerState.PRE_DORMANT
        ).count()
        repeat_customers = customers_with_state.filter(
            latest_state=CustomerInsight.CustomerState.REPEATER
        ).count()
        after_first_visit_follow_targets = customers_with_state.filter(
            latest_state=CustomerInsight.CustomerState.AFTER_FIRST_VISIT,
            has_future_reservation=False,
        ).count()

        # 今月の売上合計
        sales_agg = Sale.objects.filter(
            store=store, sale_date__gte=month_start.date(), deleted_at__isnull=True
        ).aggregate(total=Sum("amount"))
        total_sales_this_month = sales_agg["total"] or 0

        # 今月の来店件数
        visit_count_this_month = Reservation.objects.filter(
            store=store,
            status=Reservation.Status.VISITED,
            visited_at__gte=month_start,
            deleted_at__isnull=True,
        ).count()
        average_spend_per_visit = (
            total_sales_this_month // visit_count_this_month
            if visit_count_this_month
            else 0
        )

        # 人気メニュー上位3件（今月の予約から）
        top_menus_qs = (
            Reservation.objects.filter(
                store=store,
                scheduled_start_at__gte=month_start,
                deleted_at__isnull=True,
            )
            .exclude(menu_name_snapshot__isnull=True)
            .exclude(menu_name_snapshot="")
            .values("menu_name_snapshot")
            .annotate(count=Count("id"))
            .order_by("-count")[:3]
        )
        top_menus = [{"name": row["menu_name_snapshot"], "count": row["count"]} for row in top_menus_qs]

        dashboard_data = {
            "total_customers":         total_customers,
            "active_customers":        active_customers,
            "at_risk_customers":       at_risk_customers,
            "dormant_customers":       dormant_customers,
            "pre_dormant_customers":   pre_dormant_customers,
            "repeat_customers":        repeat_customers,
            "after_first_visit_follow_targets": after_first_visit_follow_targets,
            "new_customers_this_month": new_customers_this_month,
            "total_sales_this_month":  total_sales_this_month,
            "visit_count_this_month":  visit_count_this_month,
            "average_spend_per_visit": average_spend_per_visit,
            "top_menus":               top_menus,
        }
        dashboard_data["monthly_focus"] = build_monthly_focus(dashboard_data)
        dashboard_data["ai_diagnosis"] = build_dashboard_ai_diagnosis(dashboard_data)
        dashboard_data["weekly_actions"] = build_weekly_actions(dashboard_data)
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.AI_DIAGNOSIS_EXECUTED,
            target_type="dashboard",
            target_id=store.id,
            after_snapshot={
                "diagnosis_type": "dashboard_mock",
                "reference_period": month_start.date().isoformat(),
                "main_issue": dashboard_data["ai_diagnosis"]["main_issue"],
                "priority": dashboard_data["ai_diagnosis"]["priority"],
                "weekly_action_count": len(dashboard_data["weekly_actions"]),
            },
        )

        return _ok(dashboard_data)


class CustomerInsightDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(
        self,
        request: Request,
        store_id: uuid.UUID,
        customer_id: uuid.UUID,
        insight_id: uuid.UUID,
    ) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        customer = _get_customer_or_404(store, customer_id)

        try:
            insight = CustomerInsight.objects.get(
                id=insight_id, customer=customer, store_id=store.id
            )
        except CustomerInsight.DoesNotExist:
            raise NotFound("インサイトが見つかりません。") from None

        serializer = CustomerInsightReviewUpdateSerializer(insight, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        data = CustomerInsightSerializer(insight).data
        return _ok(dict(data))
