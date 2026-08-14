import uuid

from django.db import models


class CustomerInsight(models.Model):
    class CustomerState(models.TextChoices):
        NEW_LEAD          = "new_lead",          "新規リード"
        FIRST_RESERVED    = "first_reserved",    "初回予約済"
        AFTER_FIRST_VISIT = "after_first_visit", "初回来店後"
        REPEATER          = "repeater",          "リピーター"
        PRE_DORMANT       = "pre_dormant",       "休眠予備軍"
        DORMANT           = "dormant",           "休眠顧客"
        VIP_CANDIDATE     = "vip_candidate",     "VIP候補"
        HIGH_RISK         = "high_risk",         "離脱リスク高"

    class Priority(models.TextChoices):
        HIGH   = "high",   "高"
        MEDIUM = "medium", "中"
        LOW    = "low",    "低"

    class Confidence(models.TextChoices):
        HIGH   = "high",   "高"
        MEDIUM = "medium", "中"
        LOW    = "low",    "低"

    class ReviewStatus(models.TextChoices):
        UNREVIEWED = "unreviewed", "未確認"
        CONFIRMED  = "confirmed",  "確認済み"
        MODIFIED   = "modified",   "修正済み"

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store_id           = models.UUIDField()
    customer           = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="insights"
    )
    insight_date       = models.DateField()
    customer_state     = models.CharField(max_length=30, choices=CustomerState.choices)
    inferred_needs     = models.JSONField(default=list)
    blocking_factors   = models.JSONField(default=list)
    recommended_action = models.CharField(max_length=30, null=True, blank=True)
    priority           = models.CharField(max_length=10, choices=Priority.choices)
    evidence_summary   = models.TextField()
    ai_confidence      = models.CharField(max_length=10, choices=Confidence.choices)
    valid_until        = models.DateField(null=True, blank=True)
    review_status      = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.UNREVIEWED
    )
    created_by_ai      = models.BooleanField(default=True)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_insights"
        indexes  = [
            models.Index(fields=["store_id", "customer_state"]),
            models.Index(fields=["customer_id", "insight_date"]),
        ]

    def __str__(self) -> str:
        return f"Insight({self.customer_id}, {self.customer_state}, {self.insight_date})"
