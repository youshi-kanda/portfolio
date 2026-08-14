import uuid

from django.db import models


class Reservation(models.Model):
    class Status(models.TextChoices):
        RESERVED  = "reserved",  "予約済み"
        VISITED   = "visited",   "来店済み"
        CANCELLED = "cancelled", "キャンセル"
        NO_SHOW   = "no_show",   "無断キャンセル"

    class Channel(models.TextChoices):
        OFFICIAL_LINE = "official_line", "公式LINE"
        PHONE         = "phone",         "電話"
        HPB           = "hpb",           "ホットペッパービューティー"
        INSTAGRAM     = "instagram",     "Instagram"
        WEB           = "web",           "Webサイト"
        OTHER         = "other",         "その他"

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store                   = models.ForeignKey("stores.Store", on_delete=models.CASCADE, related_name="reservations")
    customer                = models.ForeignKey(
        "customers.Customer", on_delete=models.SET_NULL, related_name="reservations",
        null=True, blank=True,
    )
    external_reservation_id = models.CharField(max_length=255, null=True, blank=True)
    reservation_created_at  = models.DateTimeField(null=True, blank=True)
    scheduled_start_at      = models.DateTimeField()
    scheduled_end_at        = models.DateTimeField(null=True, blank=True)
    visited_at              = models.DateTimeField(null=True, blank=True)
    menu                    = models.ForeignKey(
        "stores.Menu", on_delete=models.SET_NULL, related_name="reservations",
        null=True, blank=True,
    )
    menu_name_snapshot      = models.CharField(max_length=255, null=True, blank=True)
    staff_user_id           = models.UUIDField(null=True, blank=True)
    channel                 = models.CharField(max_length=20, choices=Channel.choices, null=True, blank=True)
    status                  = models.CharField(max_length=20, choices=Status.choices, default=Status.RESERVED)
    cancellation_reason     = models.TextField(null=True, blank=True)
    has_next_reservation    = models.BooleanField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    deleted_at              = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reservations"
        indexes  = [
            models.Index(fields=["store_id", "scheduled_start_at"]),
            models.Index(fields=["customer_id", "scheduled_start_at"]),
        ]

    def __str__(self) -> str:
        return f"Reservation({self.store_id}, {self.scheduled_start_at})"
