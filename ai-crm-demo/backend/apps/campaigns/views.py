import csv
import io
import uuid

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.stores.views import _get_store_or_404, _get_store_or_404_with_collab, _ok, _ok_list
from config.demo_guard import deny_if_demo


# ---------------------------------------------------------------------------
# Masking helpers (CLAUDE.md Section 6.3)
# ---------------------------------------------------------------------------

def _mask_name(name: str | None) -> str:
    if not name:
        return ""
    if len(name) <= 1:
        return name
    return name[0] + "〇" * (len(name) - 1)


def _mask_phone(phone: str | None) -> str:
    if not phone:
        return ""
    parts = phone.split("-")
    if len(parts) == 3:
        return f"{parts[0]}-****-{parts[2]}"
    return phone[:3] + "****" + phone[-4:] if len(phone) >= 7 else "****"


def _mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    return local[0] + "***@" + domain


class _CsvStreamWriter:
    """StreamingHttpResponse 用の write-buffer アダプタ。"""

    def __init__(self):
        self._buf = io.StringIO()

    def write(self, value: str):
        self._buf.write(value)

    def getvalue(self) -> str:
        v = self._buf.getvalue()
        self._buf = io.StringIO()
        return v

from .models import Campaign, CampaignContent, CampaignResult, CampaignTarget
from .serializers import (
    CampaignContentListSerializer,
    CampaignContentSerializer,
    CampaignCreateSerializer,
    CampaignResultCreateSerializer,
    CampaignResultSerializer,
    CampaignSerializer,
    CampaignTargetSerializer,
    CampaignUpdateSerializer,
)


def _get_campaign_or_404(store, campaign_id: uuid.UUID) -> Campaign:
    try:
        return Campaign.objects.get(id=campaign_id, store=store, deleted_at__isnull=True)
    except Campaign.DoesNotExist:
        raise NotFound("施策が見つかりません。") from None


class CampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = (
            Campaign.objects.filter(store=store, deleted_at__isnull=True)
            .order_by("-created_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        purpose_filter = request.query_params.get("purpose")
        if purpose_filter:
            qs = qs.filter(purpose=purpose_filter)

        total = qs.count()
        try:
            page     = max(1, int(request.query_params.get("page", 1)))
            per_page = min(100, max(1, int(request.query_params.get("per_page", 50))))
        except (TypeError, ValueError):
            page, per_page = 1, 50
        offset = (page - 1) * per_page

        campaigns = qs[offset: offset + per_page]
        data = CampaignSerializer(campaigns, many=True).data
        return _ok_list(list(data), total=total, page=page, per_page=per_page)

    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = serializer.save(store=store, owner_user=request.user)
        return _ok(CampaignSerializer(campaign).data, http_status=201)


class CampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        return _ok(CampaignSerializer(campaign).data)

    def patch(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        serializer = CampaignUpdateSerializer(campaign, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return _ok(CampaignSerializer(campaign).data)

    def delete(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        deny_if_demo()
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        campaign.deleted_at = timezone.now()
        campaign.save(update_fields=["deleted_at"])
        return Response(status=204)


class CampaignContentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        qs = CampaignContent.objects.filter(campaign=campaign, store=store).order_by("-created_at")
        total    = qs.count()
        data     = CampaignContentSerializer(qs, many=True).data
        return _ok_list(list(data), total=total)


class CampaignContentGenerateView(APIView):
    """AI による発信文案生成。生成結果は CampaignContent として保存され承認待ち状態になる。"""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        from apps.ai_core.models import AIGenerationLog
        from apps.ai_core.services.copy_generator import generate_copy

        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)

        tone = request.data.get("tone", "warm")

        try:
            result = generate_copy(campaign, store, tone=tone)
        except RuntimeError as exc:
            AIGenerationLog.objects.create(
                store_id=store.id,
                campaign=campaign,
                template_name="unknown",
                template_version=1,
                model_used="unknown",
                success=False,
                error_message=str(exc),
            )
            return Response(
                {"error": {"code": "AI_PROVIDER_ERROR", "message": str(exc)}, "meta": {}},
                status=502,
            )

        expression_risk_level = _normalize_expression_risk_level(result.expression_risk_level)

        content = CampaignContent.objects.create(
            campaign=campaign,
            store=store,
            content_type=_channel_to_content_type(campaign.channel),
            title=result.title,
            body=result.body,
            cta=result.cta,
            tone=tone,
            generated_by_ai=True,
            expression_risk_level=expression_risk_level,
            expression_check_result={
                "reasoning":   result.reasoning,
                "cautions":    result.cautions,
                "confidence":  result.confidence,
            },
            approval_status=CampaignContent.ApprovalStatus.DRAFT,
        )

        AIGenerationLog.objects.create(
            store_id=store.id,
            campaign=campaign,
            campaign_content=content,
            template_name=result.template_name,
            template_version=result.template_version,
            model_used=result.model_used,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            success=True,
        )

        return _ok(
            {
                **CampaignContentSerializer(content).data,
                "generation": {
                    "reasoning":  result.reasoning,
                    "confidence": result.confidence,
                    "cautions":   result.cautions,
                    "model_used": result.model_used,
                },
            },
            http_status=201,
        )


def _channel_to_content_type(channel: str) -> str:
    mapping = {
        "official_line": "line",
        "lstep":         "line",
        "instagram":     "instagram",
        "google_business": "google",
        "email":         "email",
        "sms":           "sms",
    }
    return mapping.get(channel, "other")


def _normalize_expression_risk_level(value: str | None) -> str:
    mapping = {
        "safe": CampaignContent.ExpressionRiskLevel.NONE,
        "caution": CampaignContent.ExpressionRiskLevel.MEDIUM,
        "high_risk": CampaignContent.ExpressionRiskLevel.HIGH,
    }
    canonical = {choice.value for choice in CampaignContent.ExpressionRiskLevel}
    normalized = mapping.get(value or "", value)
    return normalized if normalized in canonical else CampaignContent.ExpressionRiskLevel.MEDIUM


class CampaignTargetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        qs = CampaignTarget.objects.filter(campaign=campaign, store=store).order_by("created_at")
        excluded_filter = request.query_params.get("excluded")
        if excluded_filter is not None:
            qs = qs.filter(excluded=(excluded_filter.lower() == "true"))
        total = qs.count()
        data  = CampaignTargetSerializer(qs, many=True).data
        return _ok_list(list(data), total=total)


class CampaignTargetExportView(APIView):
    """配信対象者CSV（excluded=False のみ）。個人情報はマスキング出力。"""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> StreamingHttpResponse:
        from apps.audit.services import write_audit_log

        store, collab = _get_store_or_404_with_collab(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)

        if collab is not None and not collab.can_export_csv:
            write_audit_log(
                request=request,
                store=store,
                action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORT_DENIED,
                target_type="campaign",
                target_id=str(campaign.id),
                after_snapshot={
                    "campaign_id": str(campaign.id),
                    "export_type": "targets",
                    "reason": "permission_denied",
                },
            )
            raise PermissionDenied("CSV出力の権限がありません。")

        qs = (
            CampaignTarget.objects.filter(
                campaign=campaign, store=store, excluded=False,
                customer__isnull=False, customer__deleted_at__isnull=True,
            )
            .select_related("customer")
            .order_by("created_at")
        )

        target_count = qs.count()

        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORTED,
            target_type="campaign",
            target_id=str(campaign.id),
            after_snapshot={
                "campaign_id": str(campaign.id),
                "export_type": "targets",
                "target_count": target_count,
            },
        )

        def _rows():
            buf = _CsvStreamWriter()
            writer = csv.writer(buf)
            writer.writerow([
                "campaign_id", "campaign_name",
                "customer_id", "external_customer_id",
                "display_name", "customer_state", "target_reason",
            ])
            yield buf.getvalue()

            for t in qs.iterator():
                c = t.customer
                writer.writerow([
                    str(campaign.id),
                    campaign.name,
                    str(c.id) if c else "",
                    c.external_customer_id or "" if c else "",
                    _mask_name(c.display_name or c.full_name) if c else "",
                    t.target_reason or "",
                    t.target_reason or "",
                ])
                yield buf.getvalue()

        filename = f"targets_{campaign.id}.csv"
        res = StreamingHttpResponse(_rows(), content_type="text/csv; charset=utf-8-sig")
        res["Content-Disposition"] = f'attachment; filename="{filename}"'
        return res


class CampaignTargetExportExcludedView(APIView):
    """除外者CSV（excluded=True のみ）。個人情報はマスキング出力。"""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> StreamingHttpResponse:
        from apps.audit.services import write_audit_log

        store, collab = _get_store_or_404_with_collab(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)

        if collab is not None and not collab.can_export_csv:
            write_audit_log(
                request=request,
                store=store,
                action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORT_DENIED,
                target_type="campaign",
                target_id=str(campaign.id),
                after_snapshot={
                    "campaign_id": str(campaign.id),
                    "export_type": "excluded",
                    "reason": "permission_denied",
                },
            )
            raise PermissionDenied("CSV出力の権限がありません。")

        qs = (
            CampaignTarget.objects.filter(
                campaign=campaign, store=store, excluded=True,
                customer__isnull=False, customer__deleted_at__isnull=True,
            )
            .select_related("customer")
            .order_by("created_at")
        )

        excluded_count = qs.count()

        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORTED,
            target_type="campaign",
            target_id=str(campaign.id),
            after_snapshot={
                "campaign_id": str(campaign.id),
                "export_type": "excluded",
                "target_count": excluded_count,
            },
        )

        def _rows():
            buf = _CsvStreamWriter()
            writer = csv.writer(buf)
            writer.writerow([
                "campaign_id", "customer_id",
                "display_name", "exclusion_reason",
            ])
            yield buf.getvalue()

            for t in qs.iterator():
                c = t.customer
                writer.writerow([
                    str(campaign.id),
                    str(c.id) if c else "",
                    _mask_name(c.display_name or c.full_name) if c else "",
                    t.exclusion_reason or "",
                ])
                yield buf.getvalue()

        filename = f"excluded_{campaign.id}.csv"
        res = StreamingHttpResponse(_rows(), content_type="text/csv; charset=utf-8-sig")
        res["Content-Disposition"] = f'attachment; filename="{filename}"'
        return res


class CampaignTargetGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        from apps.insights.segment_service import generate_targets

        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        result   = generate_targets(store, campaign)
        return _ok(
            {
                "total_candidates": result.total_candidates,
                "total_included":   result.total_included,
                "total_excluded":   result.total_excluded,
                "purpose":          result.purpose,
                "generated_at":     result.generated_at,
                "cautions": [
                    "この対象者リストはルールベースによる自動抽出です。",
                    "配信前に必ず内容を人間が確認してください。",
                ],
            }
        )


# ---------------------------------------------------------------------------
# Content approval views (P2-006)
# ---------------------------------------------------------------------------

def _get_content_or_404(campaign: Campaign, content_id: uuid.UUID) -> CampaignContent:
    try:
        return CampaignContent.objects.get(id=content_id, campaign=campaign)
    except CampaignContent.DoesNotExist:
        raise NotFound("文案が見つかりません。") from None


def _get_store_for_content_approval(store_id: uuid.UUID, user):
    store, collab = _get_store_or_404_with_collab(
        store_id,
        user,
        required_perm="can_approve_contents",
    )
    if collab is not None and not collab.can_approve_contents:
        raise PermissionDenied("文案を承認する権限がありません。")
    return store


class CampaignContentSubmitView(APIView):
    """draft → approval_pending: 承認申請"""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID, content_id: uuid.UUID) -> Response:
        from apps.audit.services import write_audit_log

        store   = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        content  = _get_content_or_404(campaign, content_id)

        if content.approval_status != CampaignContent.ApprovalStatus.DRAFT:
            return Response(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "下書き状態の文案のみ承認申請できます。",
                    },
                    "meta": {},
                },
                status=422,
            )

        before = {"approval_status": content.approval_status}
        content.approval_status = CampaignContent.ApprovalStatus.APPROVAL_PENDING
        content.save(update_fields=["approval_status", "updated_at"])

        write_audit_log(
            request=request,
            store=store,
            action="content_submitted",
            target_type="campaign_content",
            target_id=str(content.id),
            before_snapshot=before,
            after_snapshot={"approval_status": content.approval_status},
        )

        return _ok(CampaignContentSerializer(content).data)


class CampaignContentApproveView(APIView):
    """approval_pending → approved: 承認"""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID, content_id: uuid.UUID) -> Response:
        from django.utils import timezone

        from apps.audit.services import write_audit_log

        store    = _get_store_for_content_approval(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        content  = _get_content_or_404(campaign, content_id)

        if content.approval_status != CampaignContent.ApprovalStatus.APPROVAL_PENDING:
            return Response(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "承認待ち状態の文案のみ承認できます。",
                    },
                    "meta": {},
                },
                status=422,
            )

        before = {"approval_status": content.approval_status}
        content.approval_status = CampaignContent.ApprovalStatus.APPROVED
        content.approved_by = request.user
        content.approved_at = timezone.now()
        content.save(update_fields=["approval_status", "approved_by", "approved_at", "updated_at"])

        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CONTENT_APPROVED,
            target_type="campaign_content",
            target_id=str(content.id),
            before_snapshot=before,
            after_snapshot={"approval_status": content.approval_status},
        )

        return _ok(CampaignContentSerializer(content).data)


class CampaignContentRejectView(APIView):
    """approval_pending → rejected: 差戻し"""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID, content_id: uuid.UUID) -> Response:
        from apps.audit.services import write_audit_log

        store    = _get_store_for_content_approval(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        content  = _get_content_or_404(campaign, content_id)

        if content.approval_status != CampaignContent.ApprovalStatus.APPROVAL_PENDING:
            return Response(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "承認待ち状態の文案のみ差戻しできます。",
                    },
                    "meta": {},
                },
                status=422,
            )

        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "差戻し理由を入力してください。",
                        "details": [{"field": "reason", "message": "差戻し理由は必須です。"}],
                    },
                    "meta": {},
                },
                status=400,
            )

        before = {"approval_status": content.approval_status}
        content.approval_status = CampaignContent.ApprovalStatus.REJECTED
        result = content.expression_check_result or {}
        result["rejection_reason"] = reason
        content.expression_check_result = result
        content.save(update_fields=["approval_status", "expression_check_result", "updated_at"])

        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CONTENT_REJECTED,
            target_type="campaign_content",
            target_id=str(content.id),
            before_snapshot=before,
            after_snapshot={"approval_status": content.approval_status, "rejection_reason": reason},
        )

        return _ok(CampaignContentSerializer(content).data)


# ---------------------------------------------------------------------------
# Campaign Result
# ---------------------------------------------------------------------------

class CampaignResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)
        try:
            result = campaign.result
        except CampaignResult.DoesNotExist:
            return _ok(None)
        return _ok(CampaignResultSerializer(result).data)

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)

        if hasattr(campaign, "result"):
            ser = CampaignResultCreateSerializer(campaign.result, data=request.data, partial=True)
        else:
            ser = CampaignResultCreateSerializer(data=request.data)

        ser.is_valid(raise_exception=True)

        if hasattr(campaign, "result"):
            result = campaign.result
            for field, value in ser.validated_data.items():
                setattr(result, field, value)
            result.recorded_by = request.user
            result.save()
        else:
            result = CampaignResult.objects.create(
                campaign=campaign,
                store_id=store.id,
                recorded_by=request.user,
                **ser.validated_data,
            )
            campaign.status = Campaign.Status.REVIEWED
            campaign.save(update_fields=["status", "updated_at"])

        from apps.audit.services import write_audit_log
        write_audit_log(
            request=request,
            store=store,
            action="campaign_result_recorded",
            target_type="campaign_result",
            target_id=str(result.id),
            after_snapshot={
                "sent_count": result.sent_count,
                "reply_count": result.reply_count,
                "visit_count": result.visit_count,
                "revenue_amount": str(result.revenue_amount) if result.revenue_amount is not None else None,
            },
        )

        return _ok(CampaignResultSerializer(result).data, http_status=201)


# ---------------------------------------------------------------------------
# Campaign Improvement AI (AI-07)
# ---------------------------------------------------------------------------

class CampaignImprovementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, store_id: uuid.UUID, campaign_id: uuid.UUID) -> Response:
        import logging as _logging
        from rest_framework import status
        from apps.ai_core.models import AIImprovementLog
        from apps.ai_core.services.improvement_advisor import advise_improvement

        _logger = _logging.getLogger(__name__)

        store    = _get_store_or_404(store_id, request.user)
        campaign = _get_campaign_or_404(store, campaign_id)

        try:
            result = campaign.result
        except CampaignResult.DoesNotExist:
            return Response(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "施策結果が記録されていません。先に結果を登録してください。",
                        "details": [],
                    },
                    "meta": {},
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            advice = advise_improvement(campaign, result)
        except RuntimeError as exc:
            _logger.error("improvement_advisor failed store=%s campaign=%s: %s", store.id, campaign.id, exc)
            AIImprovementLog.objects.create(
                store_id=store.id,
                campaign=campaign,
                model_used="unknown",
                success=False,
                error_message=str(exc),
            )
            return Response(
                {
                    "error": {
                        "code": "AI_PROVIDER_ERROR",
                        "message": "AI改善提案の生成に失敗しました。しばらくしてから再試行してください。",
                        "details": [],
                    },
                    "meta": {},
                },
                status=502,
            )

        AIImprovementLog.objects.create(
            store_id=store.id,
            campaign=campaign,
            model_used=advice.model_used,
            confidence=advice.confidence,
            input_tokens=advice.input_tokens,
            output_tokens=advice.output_tokens,
            success=True,
        )

        return _ok({
            "summary":          advice.summary,
            "good_points":      advice.good_points,
            "issues":           advice.issues,
            "improvements":     advice.improvements,
            "next_target_hint": advice.next_target_hint,
            "next_copy_hint":   advice.next_copy_hint,
            "confidence":       advice.confidence,
            "cautions":         advice.cautions,
        })


class CampaignContentStoreListView(APIView):
    """店舗横断の文案一覧。LINE配信作成時の文案選択用。"""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        from django.db.models import Q

        store = _get_store_or_404(store_id, request.user)
        qs = (
            CampaignContent.objects.filter(store=store)
            .select_related("campaign")
            .order_by("-created_at")
        )

        approval_status = request.query_params.get("approval_status")
        if approval_status:
            qs = qs.filter(approval_status=approval_status)

        channel = request.query_params.get("channel")
        if channel:
            qs = qs.filter(campaign__channel=channel)

        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(body__icontains=q) | Q(campaign__name__icontains=q)
            )

        try:
            page     = max(1, int(request.query_params.get("page", 1)))
            per_page = min(100, max(1, int(request.query_params.get("per_page", 50))))
        except (TypeError, ValueError):
            page, per_page = 1, 50

        total  = qs.count()
        offset = (page - 1) * per_page
        items  = list(qs[offset: offset + per_page])
        data   = CampaignContentListSerializer(items, many=True).data
        return _ok_list(list(data), total=total, page=page, per_page=per_page)
