import uuid

from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "login", "ログイン"
        LOGOUT = "logout", "ログアウト"
        LOGIN_THROTTLED = "login_throttled", "ログイン試行制限"
        STORE_UPDATED = "store_updated", "店舗情報更新"
        CUSTOMER_CREATED = "customer_created", "顧客作成"
        CUSTOMER_UPDATED = "customer_updated", "顧客更新"
        CUSTOMER_DELETED = "customer_deleted", "顧客削除"
        CONSENT_UPDATED = "consent_updated", "同意状態更新"
        UNSUBSCRIBED = "unsubscribed", "配信停止"
        RESUBSCRIBED = "resubscribed", "配信停止解除"
        CSV_UPLOADED = "csv_uploaded", "CSVアップロード"
        CSV_IMPORT_EXECUTED = "csv_import_executed", "CSV取込実行"
        AI_DIAGNOSIS_EXECUTED = "ai_diagnosis_executed", "AI診断実行"
        LINE_BROADCAST_CREATED = "line_broadcast_created", "LINE配信作成"
        LINE_BROADCAST_SENT = "line_broadcast_sent", "LINE配信実行"
        LINE_BROADCAST_STARTED = "line_broadcast_started", "LINE配信開始"
        LINE_BROADCAST_BATCH_FAILED = "line_broadcast_batch_failed", "LINE配信バッチ失敗"
        LINE_BROADCAST_RATE_LIMITED = "line_broadcast_rate_limited", "LINE配信レート制限"
        LINE_BROADCAST_COMPLETED = "line_broadcast_completed", "LINE配信完了"
        LINE_BROADCAST_FAILED = "line_broadcast_failed", "LINE配信失敗"
        LINE_BROADCAST_DRAFT_ROLLBACK = "line_broadcast_draft_rollback", "LINE配信DRAFT差し戻し"
        LINE_BROADCAST_RETRY_QUEUED = "line_broadcast_retry_queued", "LINE配信リトライ実行"
        LINE_SCENARIO_CREATED = "line_scenario_created", "LINEシナリオ作成"
        LINE_SCENARIO_ACTIVATED = "line_scenario_activated", "LINEシナリオ有効化"
        LINE_SCENARIO_PAUSED = "line_scenario_paused", "LINEシナリオ一時停止"
        LINE_SCENARIO_ENROLLED = "line_scenario_enrolled", "LINEシナリオ登録"
        LINE_SCENARIO_STEP_SENT = "line_scenario_step_sent", "LINEシナリオステップ送信"
        LINE_SCENARIO_COMPLETED = "line_scenario_completed", "LINEシナリオ完了"
        LINE_AUTO_REPLY_RULE_CREATED = "line_auto_reply_rule_created", "LINE自動応答ルール作成"
        LINE_AUTO_REPLY_RULE_UPDATED = "line_auto_reply_rule_updated", "LINE自動応答ルール更新"
        LINE_AUTO_REPLY_RULE_DELETED = "line_auto_reply_rule_deleted", "LINE自動応答ルール削除"
        LINE_AUTO_REPLY_SENT = "line_auto_reply_sent", "LINE自動応答送信"
        LINE_AUTO_REPLY_FAILED = "line_auto_reply_failed", "LINE自動応答送信失敗"
        LINE_ACCOUNT_CREDENTIALS_UPDATED = (
            "line_account_credentials_updated",
            "LINEアカウント認証情報更新",
        )
        LINE_BROADCAST_PARTIAL_FAILED = "line_broadcast_partial_failed", "LINE配信一部失敗"
        LINE_BROADCAST_UNKNOWN_DETECTED = "line_broadcast_unknown_detected", "LINE配信送信結果不明検出"
        LINE_BROADCAST_DUPLICATE_TASK_SKIPPED = "line_broadcast_duplicate_task_skipped", "LINE配信重複タスクスキップ"
        LINE_BROADCAST_RETRY_DISABLED = "line_broadcast_retry_disabled", "LINE配信β再送無効"
        LINE_BROADCAST_EXISTING_BATCH_SKIPPED = "line_broadcast_existing_batch_skipped", "LINE配信既存バッチスキップ"
        CAMPAIGN_TARGET_CSV_EXPORTED = "csv_target_exported", "施策対象者CSVエクスポート"
        CAMPAIGN_TARGET_CSV_EXPORT_DENIED = "csv_target_export_denied", "施策対象者CSVエクスポート拒否"
        CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORTED = "csv_excluded_exported", "施策除外者CSVエクスポート"
        CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORT_DENIED = "csv_excluded_export_denied", "施策除外者CSVエクスポート拒否"
        CONTENT_APPROVED = "content_approved", "文案承認"
        CONTENT_REJECTED = "content_rejected", "文案差戻し"
        CUSTOMER_ANONYMIZED = "customer_anonymized", "顧客匿名化"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True)
    store = models.ForeignKey(
        "stores.Store",
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=50, choices=Action.choices)
    target_type = models.CharField(max_length=100, null=True, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    before_snapshot = models.JSONField(null=True, blank=True)
    after_snapshot = models.JSONField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "created_at"]),
            models.Index(fields=["store", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"AuditLog({self.action}, {self.target_type}, {self.target_id})"


class IncidentReport(models.Model):
    class IncidentType(models.TextChoices):
        INQUIRY = "inquiry", "問い合わせ"
        NEAR_MISS = "near_miss", "ヒヤリハット"
        OPERATION_NOTE = "operation_note", "運用メモ"

    class Severity(models.TextChoices):
        LOW = "low", "低"
        MEDIUM = "medium", "中"
        HIGH = "high", "高"

    class Status(models.TextChoices):
        OPEN = "open", "未対応"
        IN_PROGRESS = "in_progress", "対応中"
        RESOLVED = "resolved", "解決済み"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        "stores.Store",
        on_delete=models.CASCADE,
        related_name="incident_reports",
    )
    incident_type = models.CharField(max_length=30, choices=IncidentType.choices)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.LOW)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    action_note = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_incident_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "incident_reports"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["store", "status", "created_at"]),
            models.Index(fields=["store", "incident_type", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"IncidentReport({self.store_id}, {self.incident_type}, {self.status})"
