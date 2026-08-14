import uuid

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stores.views import _get_store_or_404, _ok, _ok_list

from .models import AuditLog, IncidentReport
from .serializers import (
    AuditLogSerializer,
    IncidentReportCreateSerializer,
    IncidentReportSerializer,
    IncidentReportUpdateSerializer,
)


class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("action", str, description="操作種別"),
            OpenApiParameter("target_type", str, description="対象種別"),
        ],
        responses={200: AuditLogSerializer(many=True)},
        tags=["audit"],
        summary="監査ログ一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = AuditLog.objects.filter(store=store, is_deleted=False)

        action = request.query_params.get("action", "").strip()
        if action in AuditLog.Action.values:
            qs = qs.filter(action=action)

        target_type = request.query_params.get("target_type", "").strip()
        if target_type:
            qs = qs.filter(target_type=target_type)

        return _ok_list(AuditLogSerializer(qs[:50], many=True).data, total=qs.count())


class AuditLogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: AuditLogSerializer},
        tags=["audit"],
        summary="監査ログ詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, audit_log_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        try:
            audit_log = AuditLog.objects.get(id=audit_log_id, store=store, is_deleted=False)
        except AuditLog.DoesNotExist:
            raise NotFound("監査ログが見つかりません。") from None
        return _ok(AuditLogSerializer(audit_log).data)


class IncidentReportListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = IncidentReport.objects.filter(store=store)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        incident_type = request.query_params.get("incident_type")
        if incident_type:
            qs = qs.filter(incident_type=incident_type)

        return _ok_list(IncidentReportSerializer(qs[:50], many=True).data, total=qs.count())

    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = IncidentReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = IncidentReport.objects.create(
            store=store,
            created_by=request.user,
            **serializer.validated_data,
        )
        return _ok(IncidentReportSerializer(incident).data, http_status=201)


class IncidentReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_incident(self, store, incident_id: uuid.UUID) -> IncidentReport:
        try:
            return IncidentReport.objects.get(store=store, id=incident_id)
        except IncidentReport.DoesNotExist:
            raise NotFound("問い合わせ・ヒヤリハット記録が見つかりません。") from None

    def get(self, request: Request, store_id: uuid.UUID, incident_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        return _ok(IncidentReportSerializer(self._get_incident(store, incident_id)).data)

    def patch(self, request: Request, store_id: uuid.UUID, incident_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        incident = self._get_incident(store, incident_id)
        serializer = IncidentReportUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(incident, field, value)
        incident.save()
        return _ok(IncidentReportSerializer(incident).data)
