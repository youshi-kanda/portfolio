import logging
import uuid

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_core.models import AgencyDiagnosisLog, AIExpressionCheckLog
from apps.ai_core.serializers import ExpressionCheckRequestSerializer
from apps.ai_core.services.agency_diagnosis import run_agency_diagnosis
from apps.ai_core.services.expression_checker import check_expression
from apps.customers.models import Customer, CustomerConsent
from apps.stores.models import StoreTool
from apps.stores.views import _get_store_or_404, _get_store_or_404_with_collab, _ok

logger = logging.getLogger(__name__)


class ExpressionCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, store_id):
        store = _get_store_or_404(store_id, request.user)

        serializer = ExpressionCheckRequestSerializer(data=request.data)
        if not serializer.is_valid():
            from rest_framework import status
            from rest_framework.response import Response
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "入力内容に誤りがあります。",
                        "details": [
                            {"field": field, "message": msgs[0]}
                            for field, msgs in serializer.errors.items()
                        ],
                    },
                    "meta": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        body         = serializer.validated_data["body"]
        industry     = serializer.validated_data["industry"]
        content_type = serializer.validated_data["content_type"]

        try:
            result = check_expression(body=body, industry=industry, content_type=content_type)
        except RuntimeError as exc:
            logger.error("expression_check failed store=%s: %s", store.id, exc)
            from rest_framework import status
            from rest_framework.response import Response
            return Response(
                {
                    "error": {
                        "code": "AI_PROVIDER_ERROR",
                        "message": "AIによる表現チェックに失敗しました。しばらくしてから再試行してください。",
                        "details": [],
                    },
                    "meta": {},
                },
                status=502,
            )

        AIExpressionCheckLog.objects.create(
            store_id=store.id,
            content_type=content_type,
            industry=industry,
            body_length=len(body),
            risk_level=result.risk_level,
            risk_score=result.risk_score,
            issues_count=len(result.issues),
            model_used=result.model_used,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )

        return _ok({
            "risk_level": result.risk_level,
            "risk_score": result.risk_score,
            "issues": [
                {
                    "text":       issue.text,
                    "category":   issue.category,
                    "reason":     issue.reason,
                    "severity":   issue.severity,
                    "suggestion": issue.suggestion,
                }
                for issue in result.issues
            ],
            "overall_comment":       result.overall_comment,
            "requires_human_approval": result.requires_human_approval,
        })


class AgencyDiagnosisView(APIView):
    """店舗の代理店診断を実行する。オーナーまたは can_view=True の collaborator が実行可能。"""

    permission_classes = [IsAuthenticated]

    def post(self, request, store_id: uuid.UUID) -> Response:
        store, _collab = _get_store_or_404_with_collab(store_id, request.user)

        # --- 顧客集計 (個人情報は含めない) ---
        qs = Customer.objects.filter(store=store, deleted_at__isnull=True)
        total   = qs.count()
        active  = qs.filter(status=Customer.Status.ACTIVE).count()
        dormant = 0
        at_risk = 0

        # 最新インサイトを使った状態別カウント
        from apps.insights.models import CustomerInsight
        from django.db.models import OuterRef, Subquery
        latest_state_subq = (
            CustomerInsight.objects.filter(customer_id=OuterRef("pk"))
            .order_by("-insight_date", "-created_at")
            .values("customer_state")[:1]
        )
        state_qs = qs.annotate(_state=Subquery(latest_state_subq))
        dormant = state_qs.filter(_state="dormant").count()
        at_risk = state_qs.filter(_state="at_risk").count()

        # LINE同意・配信停止カウント
        consent_qs = CustomerConsent.objects.filter(store_id=store.id)
        line_consent = consent_qs.filter(contact_line_allowed=True, is_unsubscribed=False).count()
        unsubscribed = consent_qs.filter(is_unsubscribed=True).count()

        customer_stats = {
            "total":        total,
            "active":       active,
            "dormant":      dormant,
            "at_risk":      at_risk,
            "line_consent": line_consent,
            "unsubscribed": unsubscribed,
        }

        # --- ツール種別一覧 ---
        tool_types = list(
            StoreTool.objects.filter(store=store)
            .values_list("tool_type", flat=True)
        )

        # --- 診断実行 ---
        try:
            result = run_agency_diagnosis(store=store, customer_stats=customer_stats, tool_types=tool_types)
        except Exception as exc:
            logger.error("agency_diagnosis failed store=%s: %s", store.id, exc)
            return Response(
                {
                    "error": {
                        "code": "AI_PROVIDER_ERROR",
                        "message": "診断の実行に失敗しました。しばらくしてから再試行してください。",
                        "details": [],
                    },
                    "meta": {},
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # --- ログ記録 ---
        diagnosis_log = AgencyDiagnosisLog.objects.create(
            store_id=store.id,
            performed_by=request.user,
            overall_score=result.overall_score,
            issues_count=len(result.issues),
            model_used=result.model_used,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )

        return _ok({
            "diagnosis_id":   str(diagnosis_log.id),
            "diagnosis_date": diagnosis_log.created_at.date().isoformat(),
            "store_overview": {
                "total_customers":   result.overview.total_customers,
                "active_customers":  result.overview.active_customers,
                "dormant_customers": result.overview.dormant_customers,
                "at_risk_customers": result.overview.at_risk_customers,
                "active_rate":       result.overview.active_rate,
                "line_consent_rate": result.overview.line_consent_rate,
                "unsubscribe_rate":  result.overview.unsubscribe_rate,
            },
            "issues": [
                {
                    "category":       i.category,
                    "severity":       i.severity,
                    "title":          i.title,
                    "detail":         i.detail,
                    "recommendation": i.recommendation,
                }
                for i in result.issues
            ],
            "strengths": [
                {
                    "category": s.category,
                    "title":    s.title,
                    "detail":   s.detail,
                }
                for s in result.strengths
            ],
            "tool_notes":          result.tool_notes,
            "overall_score":       result.overall_score,
            "overall_comment":     result.overall_comment,
            "confidence":          result.confidence,
            "requires_human_review": result.requires_human_review,
            "model_used":          result.model_used,
        })
