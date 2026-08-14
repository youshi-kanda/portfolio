import uuid

from django.db import models


class Sale(models.Model):
    class ItemCategory(models.TextChoices):
        SERVICE      = "service",      "施術・サービス"
        PRODUCT      = "product",      "物販"
        TICKET       = "ticket",       "回数券"
        SUBSCRIPTION = "subscription", "定期契約"
        OTHER        = "other",        "その他"

    class PaymentMethod(models.TextChoices):
        CASH  = "cash",  "現金"
        CARD  = "card",  "カード"
        QR    = "qr",    "QRコード"
        BANK  = "bank",  "銀行振込"
        OTHER = "other", "その他"

    class ContractStatus(models.TextChoices):
        ACTIVE       = "active",       "契約中"
        ENDED        = "ended",        "終了"
        RENEWAL_DUE  = "renewal_due",  "更新期限近い"

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store                   = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="sales")
    customer                = models.ForeignKey(
        "customers.Customer", on_delete=models.SET_NULL, related_name="sales",
        null=True, blank=True,
    )
    reservation             = models.ForeignKey(
        "reservations.Reservation", on_delete=models.SET_NULL, related_name="sales",
        null=True, blank=True,
    )
    sale_date               = models.DateField()
    amount                  = models.IntegerField()
    menu                    = models.ForeignKey(
        "stores.Menu", on_delete=models.SET_NULL, related_name="sales",
        null=True, blank=True,
    )
    item_name_snapshot      = models.CharField(max_length=255, null=True, blank=True)
    item_category           = models.CharField(max_length=20, choices=ItemCategory.choices, null=True, blank=True)
    payment_method          = models.CharField(max_length=20, choices=PaymentMethod.choices, null=True, blank=True)
    ticket_remaining_count  = models.IntegerField(null=True, blank=True)
    contract_status         = models.CharField(max_length=20, choices=ContractStatus.choices, null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    deleted_at              = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sales"
        indexes  = [
            models.Index(fields=["store_id", "sale_date"]),
            models.Index(fields=["customer_id", "sale_date"]),
        ]

    def __str__(self) -> str:
        return f"Sale({self.store_id}, {self.sale_date}, {self.amount})"
