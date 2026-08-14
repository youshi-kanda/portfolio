import uuid

from django.db import models


class ImportJob(models.Model):
    class ImportType(models.TextChoices):
        CUSTOMERS        = "customers",        "顧客"
        RESERVATIONS     = "reservations",     "予約/来店"
        SALES            = "sales",            "売上"
        CAMPAIGN_RESULTS = "campaign_results", "施策結果"

    class SourceType(models.TextChoices):
        CSV         = "csv",         "CSV"
        SPREADSHEET = "spreadsheet", "スプレッドシート"
        MANUAL      = "manual",      "手動"
        API         = "api",         "API"

    class Status(models.TextChoices):
        PENDING    = "pending",    "待機中"
        PROCESSING = "processing", "処理中"
        COMPLETED  = "completed",  "完了"
        FAILED     = "failed",     "失敗"

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store        = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="import_jobs")
    import_type  = models.CharField(max_length=20, choices=ImportType.choices)
    source_type  = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.CSV)
    file_name    = models.CharField(max_length=255, null=True, blank=True)
    file         = models.FileField(upload_to="imports/%Y/%m/", null=True, blank=True)
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_rows   = models.IntegerField(null=True, blank=True)
    success_rows = models.IntegerField(null=True, blank=True)
    error_rows   = models.IntegerField(null=True, blank=True)
    executed_by  = models.UUIDField(null=True, blank=True)
    started_at   = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "import_jobs"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ImportJob({self.store_id}, {self.import_type}, {self.status})"


class ImportError(models.Model):
    class ErrorType(models.TextChoices):
        MISSING_REQUIRED = "missing_required", "必須項目欠損"
        INVALID_FORMAT   = "invalid_format",   "フォーマット不正"
        DUPLICATED       = "duplicated",        "重複"
        MAPPING_ERROR    = "mapping_error",     "マッピングエラー"
        UNKNOWN          = "unknown",           "不明"

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    import_job     = models.ForeignKey(ImportJob, on_delete=models.CASCADE, related_name="errors")
    store_id       = models.UUIDField()
    row_number     = models.IntegerField(null=True, blank=True)
    field_name     = models.CharField(max_length=100, null=True, blank=True)
    error_type     = models.CharField(max_length=30, choices=ErrorType.choices)
    error_message  = models.TextField()
    raw_data       = models.JSONField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "import_errors"
        ordering = ["row_number"]

    def __str__(self) -> str:
        return f"ImportError(job={self.import_job_id}, row={self.row_number}, {self.error_type})"
