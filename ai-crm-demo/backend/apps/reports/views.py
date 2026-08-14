import logging
import uuid

from django.db.models import Q, Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stores.views import _get_store_or_404, _ok, _ok_list

from .models import Report
from .serializers import MonthlyReportGenerateSerializer, ReportSerializer

logger = logging.getLogger(__name__)


def _get_report_or_404(store, report_id: uuid.UUID) -> Report:
    try:
        return Report.objects.get(id=report_id, store=store)
    except Report.DoesNotExist:
        from rest_framework.exceptions import NotFound
        raise NotFound("レポートが見つかりません。")


class ReportListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = Report.objects.filter(store=store)

        report_type = request.query_params.get("report_type")
        if report_type:
            qs = qs.filter(report_type=report_type)

        page     = max(1, int(request.query_params.get("page", 1)))
        per_page = min(50, max(1, int(request.query_params.get("per_page", 20))))
        total    = qs.count()
        reports  = qs[(page - 1) * per_page : page * per_page]

        return _ok_list(ReportSerializer(reports, many=True).data, total, page, per_page)


class ReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, report_id: uuid.UUID) -> Response:
        store  = _get_store_or_404(store_id, request.user)
        report = _get_report_or_404(store, report_id)
        return _ok(ReportSerializer(report).data)


class MonthlyReportGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        from apps.ai_core.services.report_generator import MonthlyReportContext, generate_monthly_report
        from apps.audit.services import write_audit_log

        store = _get_store_or_404(store_id, request.user)

        ser = MonthlyReportGenerateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "入力内容に誤りがあります。",
                        "details": [
                            {"field": f, "message": msgs[0]}
                            for f, msgs in ser.errors.items()
                        ],
                    },
                    "meta": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        period_start = ser.validated_data["period_start"]
        period_end   = ser.validated_data["period_end"]

        ctx = _build_context(store, period_start, period_end)

        try:
            content = generate_monthly_report(ctx)
        except RuntimeError as exc:
            logger.error("report_generator failed store=%s: %s", store.id, exc)
            return Response(
                {
                    "error": {
                        "code": "AI_PROVIDER_ERROR",
                        "message": "月次レポートの生成に失敗しました。しばらくしてから再試行してください。",
                        "details": [],
                    },
                    "meta": {},
                },
                status=502,
            )

        report = Report.objects.create(
            store=store,
            report_type=Report.ReportType.MONTHLY,
            title=content.title,
            period_start=period_start,
            period_end=period_end,
            summary=content.summary,
            body_markdown=content.body_markdown,
            generated_by_ai=True,
            status=Report.Status.DRAFT,
            contains_personal_data=False,
            created_by=request.user,
        )

        write_audit_log(
            request=request,
            store=store,
            action="monthly_report_generated",
            target_type="report",
            target_id=str(report.id),
            after_snapshot={
                "period_start": str(period_start),
                "period_end":   str(period_end),
                "model_used":   content.model_used,
                "confidence":   content.confidence,
            },
        )

        return _ok(
            {
                **ReportSerializer(report).data,
                "highlights":          content.highlights,
                "issues":              content.issues,
                "next_month_actions":  content.next_month_actions,
                "confidence":          content.confidence,
            },
            http_status=201,
        )


# ---------------------------------------------------------------------------
# Context builder (collects aggregated stats — no personal data)
# ---------------------------------------------------------------------------


def _build_context(store, period_start, period_end) -> "MonthlyReportContext":
    from apps.ai_core.services.report_generator import MonthlyReportContext
    from apps.customers.models import Customer
    from apps.insights.models import CustomerInsight
    from apps.sales.models import Sale
    from apps.campaigns.models import Campaign, CampaignResult

    # Customer stats
    total_customers  = Customer.objects.filter(store=store, deleted_at__isnull=True).count()
    new_customers    = Customer.objects.filter(
        store=store, deleted_at__isnull=True,
        created_at__date__gte=period_start, created_at__date__lte=period_end,
    ).count()

    insight_qs = CustomerInsight.objects.filter(store_id=store.id)
    active_customers  = insight_qs.filter(customer_state="active").count()
    dormant_customers = insight_qs.filter(customer_state="dormant").count()

    # Sales stats
    sales_qs = Sale.objects.filter(
        store=store, deleted_at__isnull=True,
        sale_date__gte=period_start, sale_date__lte=period_end,
    )
    sales_count   = sales_qs.count()
    total_revenue = int(sales_qs.aggregate(t=Sum("amount"))["t"] or 0)
    avg_revenue   = total_revenue // sales_count if sales_count else 0

    # Campaign stats
    campaigns = Campaign.objects.filter(
        store=store,
        created_at__date__gte=period_start,
        created_at__date__lte=period_end,
    )
    campaign_count = campaigns.count()
    results = CampaignResult.objects.filter(campaign__in=campaigns)
    total_sent    = sum(r.sent_count or 0 for r in results)
    total_visits  = sum(r.visit_count or 0 for r in results)
    campaign_revenue = int(sum(r.revenue_amount or 0 for r in results))

    industry_display = dict(store.__class__.Industry.choices).get(store.industry, store.industry)

    return MonthlyReportContext(
        store_name=store.name,
        industry=industry_display,
        area_label=store.area_label or "",
        period_start=period_start,
        period_end=period_end,
        total_customers=total_customers,
        new_customers=new_customers,
        active_customers=active_customers,
        dormant_customers=dormant_customers,
        total_revenue=total_revenue,
        sales_count=sales_count,
        avg_revenue=avg_revenue,
        campaign_count=campaign_count,
        total_sent=total_sent,
        total_visits=total_visits,
        campaign_revenue=campaign_revenue,
    )
