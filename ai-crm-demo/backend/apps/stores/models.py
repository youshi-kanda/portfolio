import uuid

from django.db import models


class Store(models.Model):
    class Industry(models.TextChoices):
        ESTHETIC  = "esthetic",  "エステ"
        BODYCARE  = "bodycare",  "ボディケア"
        GYM       = "gym",       "ジム"
        NAIL      = "nail",      "ネイル"
        HAIR      = "hair",      "ヘアサロン"
        OTHER     = "other",     "その他"

    class Status(models.TextChoices):
        ACTIVE   = "active",   "稼働中"
        INACTIVE = "inactive", "停止中"

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Phase1: tenant_id = creating user's id. Multi-tenant support is Phase2+.
    tenant_id      = models.UUIDField()
    name           = models.CharField(max_length=255)
    industry       = models.CharField(max_length=50, choices=Industry.choices)
    sub_industry   = models.CharField(max_length=100, null=True, blank=True)
    prefecture     = models.CharField(max_length=50, null=True, blank=True)
    city           = models.CharField(max_length=100, null=True, blank=True)
    area_label     = models.CharField(max_length=100)
    address        = models.CharField(max_length=255, null=True, blank=True)
    phone          = models.CharField(max_length=20, null=True, blank=True)
    website_url    = models.URLField(null=True, blank=True)
    business_hours = models.JSONField(null=True, blank=True)
    closed_days    = models.JSONField(null=True, blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by     = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="owned_stores",
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    deleted_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "stores"
        indexes  = [models.Index(fields=["tenant_id"])]

    def __str__(self) -> str:
        return self.name


class StoreSettings(models.Model):
    class MainGoal(models.TextChoices):
        NEW_CUSTOMERS        = "new_customers",        "新規獲得"
        REPEAT               = "repeat",               "リピート促進"
        LTV                  = "ltv",                  "LTV向上"
        DORMANT_REACTIVATION = "dormant_reactivation", "休眠復帰"

    class Tone(models.TextChoices):
        POLITE       = "polite",       "丁寧"
        FRIENDLY     = "friendly",     "フレンドリー"
        PROFESSIONAL = "professional", "プロフェッショナル"

    class AISuggestionLevel(models.TextChoices):
        CONSERVATIVE = "conservative", "控えめ"
        STANDARD     = "standard",     "標準"
        AGGRESSIVE   = "aggressive",   "積極的"

    id                            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store                         = models.OneToOneField(Store, on_delete=models.CASCADE, related_name="settings")
    main_goal                     = models.CharField(max_length=50, choices=MainGoal.choices, null=True, blank=True)
    tone                          = models.CharField(max_length=20, choices=Tone.choices, null=True, blank=True)
    ai_suggestion_level           = models.CharField(max_length=20, choices=AISuggestionLevel.choices, null=True, blank=True)
    require_approval_for_external = models.BooleanField(default=True)
    default_dormant_days          = models.IntegerField(null=True, blank=True)
    default_pre_dormant_days      = models.IntegerField(null=True, blank=True)
    created_at                    = models.DateTimeField(auto_now_add=True)
    updated_at                    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_settings"

    def __str__(self) -> str:
        return f"Settings({self.store})"


class StoreTool(models.Model):
    class ToolType(models.TextChoices):
        OFFICIAL_LINE   = "official_line",   "公式LINE"
        LSTEP           = "lstep",           "Lステップ"
        LMESSAGE        = "lmessage",        "Lメッセージ"
        INSTAGRAM       = "instagram",       "Instagram"
        GOOGLE_BUSINESS = "google_business", "Googleビジネス"
        RESERVATION     = "reservation",     "予約システム"
        POS             = "pos",             "POS"
        SPREADSHEET     = "spreadsheet",     "スプレッドシート"

    class UsageStatus(models.TextChoices):
        USING       = "using",       "利用中"
        CONSIDERING = "considering", "検討中"
        NOT_USING   = "not_using",   "未利用"

    class ConnectionStatus(models.TextChoices):
        NOT_CONNECTED = "not_connected", "未接続"
        CONNECTED     = "connected",     "接続済"
        ERROR         = "error",         "エラー"

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store               = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="tools")
    tool_type           = models.CharField(max_length=50, choices=ToolType.choices)
    tool_name           = models.CharField(max_length=100, null=True, blank=True)
    usage_status        = models.CharField(max_length=20, choices=UsageStatus.choices)
    external_account_id = models.CharField(max_length=255, null=True, blank=True)
    connection_status   = models.CharField(max_length=20, choices=ConnectionStatus.choices, null=True, blank=True)
    notes               = models.TextField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_tools"
        indexes  = [models.Index(fields=["store_id"])]

    def __str__(self) -> str:
        return f"{self.get_tool_type_display()}({self.store})"


class StoreCollaborator(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="collaborators")
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="collaborations",
    )
    can_view = models.BooleanField(default=True, verbose_name="閲覧権限")
    can_edit_campaigns = models.BooleanField(default=False, verbose_name="施策編集権限")
    can_approve_contents = models.BooleanField(default=False, verbose_name="文案承認権限")
    can_view_personal_info = models.BooleanField(default=False, verbose_name="個人情報閲覧権限")
    can_export_csv = models.BooleanField(default=False, verbose_name="CSV出力権限")
    invited_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invitations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_collaborators"
        unique_together = [("store", "user")]
        indexes = [models.Index(fields=["store_id"])]

    def __str__(self) -> str:
        return f"Collab({self.user} → {self.store})"


class Menu(models.Model):
    class Status(models.TextChoices):
        ACTIVE   = "active",   "有効"
        INACTIVE = "inactive", "無効"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store            = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="menus")
    name             = models.CharField(max_length=255)
    category         = models.CharField(max_length=100, null=True, blank=True)
    price            = models.IntegerField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    is_main          = models.BooleanField(default=False)
    is_high_value    = models.BooleanField(default=False)
    description      = models.TextField(null=True, blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
    deleted_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "menus"
        indexes  = [models.Index(fields=["store_id"])]

    def __str__(self) -> str:
        return f"{self.name}({self.store})"
