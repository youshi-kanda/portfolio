from rest_framework import serializers

from .models import Reservation


class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Reservation
        fields = [
            "id",
            "store_id",
            "customer_id",
            "external_reservation_id",
            "reservation_created_at",
            "scheduled_start_at",
            "scheduled_end_at",
            "visited_at",
            "menu_id",
            "menu_name_snapshot",
            "staff_user_id",
            "channel",
            "status",
            "cancellation_reason",
            "has_next_reservation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ReservationCreateSerializer(serializers.Serializer):
    customer_id             = serializers.UUIDField(required=False, allow_null=True, default=None)
    external_reservation_id = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    reservation_created_at  = serializers.DateTimeField(required=False, allow_null=True, default=None)
    scheduled_start_at      = serializers.DateTimeField()
    scheduled_end_at        = serializers.DateTimeField(required=False, allow_null=True, default=None)
    visited_at              = serializers.DateTimeField(required=False, allow_null=True, default=None)
    menu_id                 = serializers.UUIDField(required=False, allow_null=True, default=None)
    menu_name_snapshot      = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    channel                 = serializers.ChoiceField(choices=Reservation.Channel.choices, required=False, allow_null=True, default=None)
    status                  = serializers.ChoiceField(choices=Reservation.Status.choices, required=False, default=Reservation.Status.RESERVED)
    cancellation_reason     = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    has_next_reservation    = serializers.BooleanField(required=False, allow_null=True, default=None)


class ReservationUpdateSerializer(serializers.Serializer):
    customer_id             = serializers.UUIDField(required=False, allow_null=True)
    external_reservation_id = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    reservation_created_at  = serializers.DateTimeField(required=False, allow_null=True)
    scheduled_start_at      = serializers.DateTimeField(required=False)
    scheduled_end_at        = serializers.DateTimeField(required=False, allow_null=True)
    visited_at              = serializers.DateTimeField(required=False, allow_null=True)
    menu_id                 = serializers.UUIDField(required=False, allow_null=True)
    menu_name_snapshot      = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    channel                 = serializers.ChoiceField(choices=Reservation.Channel.choices, required=False, allow_null=True)
    status                  = serializers.ChoiceField(choices=Reservation.Status.choices, required=False)
    cancellation_reason     = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    has_next_reservation    = serializers.BooleanField(required=False, allow_null=True)
