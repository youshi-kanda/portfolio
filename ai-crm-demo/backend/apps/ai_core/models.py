import uuid

from django.db import models


class AIPromptTemplate(models.Model):
    """施策目的・チャネル別のプロンプトテンプレート。バージョン管理用。"""

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name     = models.CharField(max_length=100, unique=True)
    version  = models.PositiveIntegerField(default=1)
    purpose  = models.CharField(max_length=50)   # campaign purpose or "all"
    channel  = models.CharField(max_length=50)   # campaign channel or "all"
    system_prompt         = models.TextField()
    user_prompt_template  = models.TextField()
    is_active             = models.BooleanField(default=True)
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_prompt_templates"
        indexes  = [models.Index(fields=["purpose", "channel", "is_active"])]

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"


class AIGenerationLog(models.Model):
    """AI文案生成の試行ログ。成否問わず記録する。"""

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store_id         = models.UUIDField()
    campaign         = models.ForeignKey(
        "campaigns.Campaign", null=True, on_delete=models.SET_NULL,
        related_name="generation_logs",
    )
    campaign_content = models.OneToOneField(
        "campaigns.CampaignContent", null=True, on_delete=models.SET_NULL,
        related_name="generation_log",
    )
    template_name    = models.CharField(max_length=100)
    template_version = models.PositiveIntegerField(default=1)
    model_used       = models.CharField(max_length=100)
    input_tokens     = models.PositiveIntegerField(null=True, blank=True)
    output_tokens    = models.PositiveIntegerField(null=True, blank=True)
    success          = models.BooleanField()
    error_message    = models.TextField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_generation_logs"
        indexes  = [
            models.Index(fields=["store_id", "created_at"]),
            models.Index(fields=["campaign_id"]),
        ]

    def __str__(self) -> str:
        status = "OK" if self.success else "NG"
        return f"GenerationLog({self.campaign_id}, {status}, {self.created_at:%Y-%m-%d})"


class AIExpressionCheckLog(models.Model):
    """広告表現チェックの試行ログ。本文は保存しない（文字数・件数・レベルのみ）。"""

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store_id     = models.UUIDField()
    content_type = models.CharField(max_length=30)
    industry     = models.CharField(max_length=50)
    body_length  = models.PositiveIntegerField()
    risk_level   = models.CharField(max_length=20)
    risk_score   = models.PositiveIntegerField()
    issues_count = models.PositiveIntegerField()
    model_used   = models.CharField(max_length=100)
    input_tokens  = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_expression_check_logs"
        indexes  = [models.Index(fields=["store_id", "created_at"])]

    def __str__(self) -> str:
        return f"ExpressionCheckLog({self.store_id}, {self.risk_level}, {self.created_at:%Y-%m-%d})"


class AgencyDiagnosisLog(models.Model):
    """代理店診断の実行ログ。集計値のみ保存し個人情報は含めない。"""

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store_id        = models.UUIDField()
    performed_by    = models.ForeignKey(
        "accounts.User", null=True, on_delete=models.SET_NULL,
        related_name="agency_diagnosis_logs",
    )
    overall_score   = models.PositiveIntegerField()
    issues_count    = models.PositiveIntegerField()
    model_used      = models.CharField(max_length=100)
    input_tokens    = models.PositiveIntegerField(null=True, blank=True)
    output_tokens   = models.PositiveIntegerField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_agency_diagnosis_logs"
        indexes  = [models.Index(fields=["store_id", "created_at"])]

    def __str__(self) -> str:
        return f"AgencyDiagnosisLog({self.store_id}, score={self.overall_score}, {self.created_at:%Y-%m-%d})"


class AIImprovementLog(models.Model):
    """施策改善AI提案の試行ログ。成否問わず記録する。"""

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store_id    = models.UUIDField()
    campaign    = models.ForeignKey(
        "campaigns.Campaign", null=True, on_delete=models.SET_NULL,
        related_name="improvement_logs",
    )
    model_used    = models.CharField(max_length=100)
    confidence    = models.CharField(max_length=10, null=True, blank=True)
    input_tokens  = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    success       = models.BooleanField()
    error_message = models.TextField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_improvement_logs"
        indexes  = [
            models.Index(fields=["store_id", "created_at"]),
            models.Index(fields=["campaign_id"]),
        ]

    def __str__(self) -> str:
        status = "OK" if self.success else "NG"
        return f"ImprovementLog({self.campaign_id}, {status}, {self.created_at:%Y-%m-%d})"
