import uuid

from django.conf import settings
from django.db import models


class Campaign(models.Model):
    class Purpose(models.TextChoices):
        NEW_CUSTOMER         = "new_customer",         "新規獲得"
        REPEAT               = "repeat",               "再来店"
        FIRST_FOLLOWUP       = "first_followup",       "初回フォロー"
        DORMANT_REACTIVATION = "dormant_reactivation", "休眠復帰"
        UPSELL               = "upsell",               "アップセル"
        RENEWAL              = "renewal",              "更新・回数券"
        AWARENESS            = "awareness",            "認知拡大"
        CUSTOM               = "custom",               "カスタム"

    class Channel(models.TextChoices):
        OFFICIAL_LINE    = "official_line",    "公式LINE"
        LSTEP            = "lstep",            "Lステップ"
        INSTAGRAM        = "instagram",        "Instagram"
        GOOGLE_BUSINESS  = "google_business",  "Googleビジネス"
        EMAIL            = "email",            "メール"
        SMS              = "sms",              "SMS"
        PHONE            = "phone",            "電話"
        IN_STORE         = "in_store",         "店頭"
        FLYER            = "flyer",            "チラシ"

    class Status(models.TextChoices):
        PROPOSED        = "proposed",        "提案"
        DRAFT           = "draft",           "下書き"
        APPROVAL_PENDING = "approval_pending", "承認待ち"
        APPROVED        = "approved",        "承認済み"
        EXECUTED        = "executed",        "実行済み"
        RESULT_PENDING  = "result_pending",  "結果入力待ち"
        REVIEWED        = "reviewed",        "振り返り完了"
        ON_HOLD         = "on_hold",         "保留"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store            = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="campaigns")
    name             = models.CharField(max_length=255)
    purpose          = models.CharField(max_length=50, choices=Purpose.choices)
    channel          = models.CharField(max_length=50, choices=Channel.choices)
    status           = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    scheduled_at     = models.DateTimeField(null=True, blank=True)
    executed_at      = models.DateTimeField(null=True, blank=True)
    owner_user       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="owned_campaigns",
    )
    target_count     = models.PositiveIntegerField(null=True, blank=True)
    caution_summary  = models.TextField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
    deleted_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "campaigns"
        indexes  = [models.Index(fields=["store_id", "status"])]

    def __str__(self) -> str:
        return self.name


class CampaignContent(models.Model):
    class ContentType(models.TextChoices):
        LINE             = "line",             "LINE"
        INSTAGRAM        = "instagram",        "Instagram"
        GOOGLE_BUSINESS  = "google_business",  "Googleビジネス"
        EMAIL            = "email",            "メール"
        POP              = "pop",              "POP"
        FLYER            = "flyer",            "チラシ"

    class Tone(models.TextChoices):
        POLITE       = "polite",       "丁寧"
        FRIENDLY     = "friendly",     "フレンドリー"
        PROFESSIONAL = "professional", "プロフェッショナル"

    class ApprovalStatus(models.TextChoices):
        DRAFT            = "draft",            "下書き"
        APPROVAL_PENDING = "approval_pending", "承認待ち"
        APPROVED         = "approved",         "承認済み"
        REJECTED         = "rejected",         "差戻し"

    class ExpressionRiskLevel(models.TextChoices):
        NONE   = "none",   "なし"
        LOW    = "low",    "低"
        MEDIUM = "medium", "中"
        HIGH   = "high",   "高"

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign                = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="contents", null=True, blank=True,
    )
    store                   = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="campaign_contents")
    content_type            = models.CharField(max_length=30, choices=ContentType.choices)
    title                   = models.CharField(max_length=255, null=True, blank=True)
    body                    = models.TextField()
    cta                     = models.TextField(null=True, blank=True)
    tone                    = models.CharField(max_length=20, choices=Tone.choices, null=True, blank=True)
    generated_by_ai         = models.BooleanField(default=False)
    expression_risk_level   = models.CharField(
        max_length=10, choices=ExpressionRiskLevel.choices, null=True, blank=True,
    )
    expression_check_result = models.JSONField(null=True, blank=True)
    approval_status         = models.CharField(
        max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.DRAFT,
    )
    approved_by             = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="approved_contents",
    )
    approved_at             = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_contents"
        indexes  = [models.Index(fields=["store_id", "approval_status"])]

    def __str__(self) -> str:
        return self.title or f"Content({self.id})"


class CampaignTarget(models.Model):
    class DeliveryStatus(models.TextChoices):
        PENDING     = "pending",     "未送信"
        SENT        = "sent",        "送信済み"
        FAILED      = "failed",      "失敗"
        MANUAL_DONE = "manual_done", "手動実施済み"
        SKIPPED     = "skipped",     "スキップ"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign         = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="targets")
    store            = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="campaign_targets")
    customer         = models.ForeignKey(
        "customers.Customer", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="campaign_targets",
    )
    target_reason    = models.TextField(null=True, blank=True)
    excluded         = models.BooleanField(default=False)
    exclusion_reason = models.CharField(max_length=100, null=True, blank=True)
    delivery_status  = models.CharField(
        max_length=20, choices=DeliveryStatus.choices, null=True, blank=True,
    )
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "campaign_targets"
        indexes  = [models.Index(fields=["campaign_id", "excluded"])]

    def __str__(self) -> str:
        return f"Target({self.campaign_id}, {self.customer_id})"


class CampaignResult(models.Model):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign           = models.OneToOneField(Campaign, on_delete=models.CASCADE, related_name="result")
    store_id           = models.UUIDField(db_index=True)
    sent_count         = models.PositiveIntegerField(null=True, blank=True)
    reply_count        = models.PositiveIntegerField(null=True, blank=True)
    click_count        = models.PositiveIntegerField(null=True, blank=True)
    reservation_count  = models.PositiveIntegerField(null=True, blank=True)
    visit_count        = models.PositiveIntegerField(null=True, blank=True)
    revenue_amount     = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    memo               = models.TextField(blank=True, default="")
    recorded_by        = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="recorded_campaign_results",
    )
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "campaign_results"

    def __str__(self) -> str:
        return f"Result({self.campaign_id})"
