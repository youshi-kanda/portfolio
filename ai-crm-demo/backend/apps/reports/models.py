import uuid

from django.conf import settings
from django.db import models


class Report(models.Model):
    class ReportType(models.TextChoices):
        INITIAL_DIAGNOSIS = "initial_diagnosis", "初期診断"
        MONTHLY           = "monthly",           "月次レポート"
        CUSTOMER_STATE    = "customer_state",     "顧客状態"
        DORMANT           = "dormant",            "休眠分析"
        CAMPAIGN_RESULT   = "campaign_result",    "施策結果"
        LSTEP_JUDGEMENT   = "lstep_judgement",    "Lステップ要否診断"
        AGENCY_PROPOSAL   = "agency_proposal",    "代理店提案"

    class Status(models.TextChoices):
        DRAFT    = "draft",    "下書き"
        SHARED   = "shared",   "共有済み"
        ARCHIVED = "archived", "アーカイブ"

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store                = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="reports")
    report_type          = models.CharField(max_length=30, choices=ReportType.choices)
    title                = models.CharField(max_length=255)
    period_start         = models.DateField(null=True, blank=True)
    period_end           = models.DateField(null=True, blank=True)
    body_markdown        = models.TextField(blank=True, default="")
    summary              = models.TextField(blank=True, default="")
    generated_by_ai      = models.BooleanField(default=False)
    status               = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    contains_personal_data = models.BooleanField(default=False)
    created_by           = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="created_reports",
    )
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports"
        indexes  = [
            models.Index(fields=["store", "report_type", "period_start"]),
            models.Index(fields=["store", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Report({self.store_id}, {self.report_type}, {self.period_start})"
