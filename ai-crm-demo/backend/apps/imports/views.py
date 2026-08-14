import uuid

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log
from apps.stores.views import _get_store_or_404, _ok, _ok_list
from config.demo_guard import deny_if_demo

from .models import ImportError, ImportJob
from .processors import get_processor
from .serializers import ImportErrorSerializer, ImportJobCreateSerializer, ImportJobSerializer


def _get_job_or_404(store, job_id: uuid.UUID) -> ImportJob:
    try:
        return ImportJob.objects.get(id=job_id, store=store)
    except ImportJob.DoesNotExist:
        raise NotFound("インポートジョブが見つかりません。") from None


class ImportJobListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("import_type", str, description="customers / reservations / sales"),
            OpenApiParameter("status",      str, description="pending / processing / completed / failed"),
        ],
        responses={200: ImportJobSerializer(many=True)},
        tags=["imports"],
        summary="インポートジョブ一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        qs = ImportJob.objects.filter(store=store)

        import_type = request.query_params.get("import_type", "").strip()
        if import_type in ImportJob.ImportType.values:
            qs = qs.filter(import_type=import_type)

        status_filter = request.query_params.get("status", "").strip()
        if status_filter in ImportJob.Status.values:
            qs = qs.filter(status=status_filter)

        return _ok_list(ImportJobSerializer(qs, many=True).data, total=qs.count())

    @extend_schema(
        request=ImportJobCreateSerializer,
        responses={201: ImportJobSerializer},
        tags=["imports"],
        summary="CSVアップロード・インポートジョブ作成",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        serializer = ImportJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file        = serializer.validated_data["file"]
        import_type = serializer.validated_data["import_type"]
        source_type = serializer.validated_data.get("source_type", ImportJob.SourceType.CSV)

        job = ImportJob.objects.create(
            store=store,
            import_type=import_type,
            source_type=source_type,
            file_name=file.name,
            file=file,
            executed_by=request.user.id,
            status=ImportJob.Status.PENDING,
        )
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CSV_UPLOADED,
            target_type="import_job",
            target_id=job.id,
            after_snapshot={
                "import_type": job.import_type,
                "source_type": job.source_type,
                "file_name": job.file_name,
                "status": job.status,
            },
        )

        return _ok(ImportJobSerializer(job).data, http_status=status.HTTP_201_CREATED)


class ImportJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ImportJobSerializer},
        tags=["imports"],
        summary="インポートジョブ詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, job_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        job = _get_job_or_404(store, job_id)
        return _ok(ImportJobSerializer(job).data)


class ImportJobExecuteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: ImportJobSerializer},
        tags=["imports"],
        summary="CSVインポート実行",
    )
    def post(self, request: Request, store_id: uuid.UUID, job_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        job   = _get_job_or_404(store, job_id)

        if job.status != ImportJob.Status.PENDING:
            raise ValidationError(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": (
                            f"このジョブは実行できません（現在のステータス: {job.status}）。"
                            " ステータスが pending のジョブのみ実行できます。"
                        ),
                    }
                }
            )

        if not job.file:
            raise ValidationError(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "アップロードされたファイルが見つかりません。",
                    }
                }
            )

        try:
            processor = get_processor(job)
        except ValueError as exc:
            raise ValidationError(
                {"error": {"code": "BUSINESS_RULE_ERROR", "message": str(exc)}}
            ) from exc

        processor.run()
        job.refresh_from_db()
        write_audit_log(
            request=request,
            store=store,
            action=AuditLog.Action.CSV_IMPORT_EXECUTED,
            target_type="import_job",
            target_id=job.id,
            after_snapshot={
                "import_type": job.import_type,
                "status": job.status,
                "total_rows": job.total_rows,
                "success_rows": job.success_rows,
                "error_rows": job.error_rows,
            },
        )
        return _ok(ImportJobSerializer(job).data)


class ImportJobErrorListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ImportErrorSerializer(many=True)},
        tags=["imports"],
        summary="インポートエラー一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, job_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        job = _get_job_or_404(store, job_id)
        errors = ImportError.objects.filter(import_job=job)
        return _ok_list(ImportErrorSerializer(errors, many=True).data, total=errors.count())
