import uuid

from django.db import models


class Customer(models.Model):
    class Status(models.TextChoices):
        ACTIVE   = "active",   "有効"
        INACTIVE = "inactive", "無効"

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store                = models.ForeignKey(
        "stores.Store", on_delete=models.CASCADE, related_name="customers"
    )
    external_customer_id = models.CharField(max_length=255, null=True, blank=True)
    line_user_id         = models.CharField(max_length=255, null=True, blank=True)
    display_name         = models.CharField(max_length=255, null=True, blank=True)
    full_name            = models.CharField(max_length=255, null=True, blank=True)
    kana                 = models.CharField(max_length=255, null=True, blank=True)
    phone                = models.CharField(max_length=20, null=True, blank=True)
    email                = models.EmailField(null=True, blank=True)
    first_contact_date   = models.DateField(null=True, blank=True)
    acquisition_channel  = models.CharField(max_length=100, null=True, blank=True)
    status               = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)
    deleted_at           = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "customers"
        indexes  = [models.Index(fields=["store_id"])]

    def __str__(self) -> str:
        return self.display_name or self.full_name or str(self.id)


class CustomerProfile(models.Model):
    class Gender(models.TextChoices):
        FEMALE  = "female",  "女性"
        MALE    = "male",    "男性"
        OTHER   = "other",   "その他"
        UNKNOWN = "unknown", "不明"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer         = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="profile")
    store_id         = models.UUIDField()
    gender            = models.CharField(max_length=20, choices=Gender.choices, null=True, blank=True)
    age_group         = models.CharField(max_length=20, null=True, blank=True)
    birth_date        = models.DateField(null=True, blank=True)
    residential_area  = models.CharField(max_length=100, null=True, blank=True)
    occupation        = models.CharField(max_length=100, null=True, blank=True)
    preferences       = models.JSONField(null=True, blank=True)
    first_visit_date  = models.DateField(null=True, blank=True)
    last_visit_date   = models.DateField(null=True, blank=True)
    visit_count       = models.PositiveIntegerField(null=True, blank=True)
    total_sales       = models.PositiveIntegerField(null=True, blank=True)
    note              = models.TextField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_profiles"

    def __str__(self) -> str:
        return f"Profile({self.customer})"


class CustomerConsent(models.Model):
    id                           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer                     = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="consent")
    store_id                     = models.UUIDField()
    contact_line_allowed         = models.BooleanField(default=True)
    contact_email_allowed        = models.BooleanField(default=True)
    contact_sms_allowed          = models.BooleanField(default=True)
    analysis_allowed             = models.BooleanField(default=True)
    external_integration_allowed = models.BooleanField(default=True)
    is_unsubscribed              = models.BooleanField(default=False)
    unsubscribed_at              = models.DateTimeField(null=True, blank=True)
    consent_source               = models.CharField(max_length=100, null=True, blank=True)
    consented_at                 = models.DateTimeField(null=True, blank=True)
    updated_at                   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_consents"

    def __str__(self) -> str:
        return f"Consent({self.customer})"
