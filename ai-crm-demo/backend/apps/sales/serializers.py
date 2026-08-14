from rest_framework import serializers

from .models import Sale


class SaleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Sale
        fields = [
            "id",
            "store_id",
            "customer_id",
            "reservation_id",
            "sale_date",
            "amount",
            "menu_id",
            "item_name_snapshot",
            "item_category",
            "payment_method",
            "ticket_remaining_count",
            "contract_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SaleCreateSerializer(serializers.Serializer):
    customer_id            = serializers.UUIDField(required=False, allow_null=True, default=None)
    reservation_id         = serializers.UUIDField(required=False, allow_null=True, default=None)
    sale_date              = serializers.DateField()
    amount                 = serializers.IntegerField(min_value=0)
    menu_id                = serializers.UUIDField(required=False, allow_null=True, default=None)
    item_name_snapshot     = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    item_category          = serializers.ChoiceField(choices=Sale.ItemCategory.choices, required=False, allow_null=True, default=None)
    payment_method         = serializers.ChoiceField(choices=Sale.PaymentMethod.choices, required=False, allow_null=True, default=None)
    ticket_remaining_count = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    contract_status        = serializers.ChoiceField(choices=Sale.ContractStatus.choices, required=False, allow_null=True, default=None)


class SaleUpdateSerializer(serializers.Serializer):
    customer_id            = serializers.UUIDField(required=False, allow_null=True)
    reservation_id         = serializers.UUIDField(required=False, allow_null=True)
    sale_date              = serializers.DateField(required=False)
    amount                 = serializers.IntegerField(min_value=0, required=False)
    menu_id                = serializers.UUIDField(required=False, allow_null=True)
    item_name_snapshot     = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    item_category          = serializers.ChoiceField(choices=Sale.ItemCategory.choices, required=False, allow_null=True)
    payment_method         = serializers.ChoiceField(choices=Sale.PaymentMethod.choices, required=False, allow_null=True)
    ticket_remaining_count = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    contract_status        = serializers.ChoiceField(choices=Sale.ContractStatus.choices, required=False, allow_null=True)
