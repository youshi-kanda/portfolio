from rest_framework import serializers

from .models import Customer, CustomerConsent, CustomerProfile
from .utils import mask_email, mask_name, mask_phone


class CustomerListSerializer(serializers.ModelSerializer):
    """顧客一覧用: 同意状態フラット + 最新インサイト + 来店/売上集計を含む。"""

    contact_line_allowed = serializers.SerializerMethodField()
    is_unsubscribed = serializers.SerializerMethodField()
    customer_state = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()
    visit_count = serializers.SerializerMethodField()
    last_visit_date = serializers.SerializerMethodField()
    ltv = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "display_name",
            "full_name",
            "status",
            "customer_state",
            "priority",
            "next_action",
            "last_visit_date",
            "visit_count",
            "ltv",
            "contact_line_allowed",
            "is_unsubscribed",
        ]

    def _latest_insight(self, obj):
        insights = getattr(obj, "prefetched_insights", [])
        return insights[0] if insights else None

    def get_contact_line_allowed(self, obj):
        try:
            return obj.consent.contact_line_allowed
        except Exception:
            return None

    def get_is_unsubscribed(self, obj):
        try:
            return obj.consent.is_unsubscribed
        except Exception:
            return False

    def get_customer_state(self, obj):
        insight = self._latest_insight(obj)
        return insight.customer_state if insight else None

    def get_priority(self, obj):
        insight = self._latest_insight(obj)
        return insight.priority if insight else None

    def get_next_action(self, obj):
        insight = self._latest_insight(obj)
        return insight.recommended_action if insight else None

    def get_visit_count(self, obj):
        return getattr(obj, "visit_count", 0) or 0

    def get_last_visit_date(self, obj):
        dt = getattr(obj, "last_visit_date", None)
        if dt is None:
            return None
        return dt.date().isoformat() if hasattr(dt, "date") else str(dt)[:10]

    def get_ltv(self, obj):
        val = getattr(obj, "ltv", None)
        return val if val is not None else 0


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomerProfile
        fields = [
            "gender",
            "age_group",
            "residential_area",
            "occupation",
            "preferences",
        ]
        read_only_fields = fields


class CustomerConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomerConsent
        fields = [
            "id",
            "contact_line_allowed",
            "contact_email_allowed",
            "contact_sms_allowed",
            "analysis_allowed",
            "external_integration_allowed",
            "is_unsubscribed",
            "unsubscribed_at",
            "consent_source",
            "consented_at",
            "updated_at",
        ]
        read_only_fields = fields


class CustomerSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)
    consent = CustomerConsentSerializer(read_only=True)

    class Meta:
        model  = Customer
        fields = [
            "id",
            "store_id",
            "external_customer_id",
            "display_name",
            "full_name",
            "phone",
            "email",
            "first_contact_date",
            "acquisition_channel",
            "status",
            "profile",
            "consent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


_PROFILE_FIELDS = {"gender", "age_group", "residential_area", "occupation", "preferences"}


class CustomerCreateSerializer(serializers.Serializer):
    external_customer_id = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    display_name         = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    full_name            = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    phone                = serializers.CharField(max_length=20, required=False, allow_blank=True, default=None)
    email                = serializers.EmailField(required=False, allow_blank=True, default=None)
    first_contact_date   = serializers.DateField(required=False, allow_null=True, default=None)
    acquisition_channel  = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    status               = serializers.ChoiceField(choices=Customer.Status.choices, required=False, default=Customer.Status.ACTIVE)
    gender               = serializers.ChoiceField(choices=CustomerProfile.Gender.choices, required=False, allow_null=True, default=None)
    age_group            = serializers.CharField(max_length=20, required=False, allow_blank=True, default=None)
    residential_area     = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    occupation           = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    preferences          = serializers.JSONField(required=False, allow_null=True, default=None)

    def split(self) -> tuple[dict, dict]:
        data = self.validated_data
        customer_data = {k: v for k, v in data.items() if k not in _PROFILE_FIELDS}
        profile_data  = {k: v for k, v in data.items() if k in _PROFILE_FIELDS}
        return customer_data, profile_data


class CustomerUpdateSerializer(serializers.Serializer):
    external_customer_id = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    display_name         = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    full_name            = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    phone                = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    email                = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    first_contact_date   = serializers.DateField(required=False, allow_null=True)
    acquisition_channel  = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    status               = serializers.ChoiceField(choices=Customer.Status.choices, required=False)
    gender               = serializers.ChoiceField(choices=CustomerProfile.Gender.choices, required=False, allow_null=True)
    age_group            = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    residential_area     = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    occupation           = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    preferences          = serializers.JSONField(required=False, allow_null=True)

    def split(self) -> tuple[dict, dict]:
        data = self.validated_data
        customer_data = {k: v for k, v in data.items() if k not in _PROFILE_FIELDS}
        profile_data  = {k: v for k, v in data.items() if k in _PROFILE_FIELDS}
        return customer_data, profile_data


class CustomerListMaskedSerializer(CustomerListSerializer):
    """個人情報閲覧権限なし collaborator 向け: 氏名をマスキングして返す。"""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["display_name"] = mask_name(data.get("display_name"))
        data["full_name"] = mask_name(data.get("full_name"))
        return data


class CustomerMaskedSerializer(CustomerSerializer):
    """個人情報閲覧権限なし collaborator 向け: 個人情報フィールドをマスキングして返す。"""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["display_name"] = mask_name(data.get("display_name"))
        data["full_name"] = mask_name(data.get("full_name"))
        data["phone"] = mask_phone(data.get("phone"))
        data["email"] = mask_email(data.get("email"))
        return data


class CustomerConsentUpdateSerializer(serializers.Serializer):
    contact_line_allowed         = serializers.BooleanField(required=False)
    contact_email_allowed        = serializers.BooleanField(required=False)
    contact_sms_allowed          = serializers.BooleanField(required=False)
    analysis_allowed             = serializers.BooleanField(required=False)
    external_integration_allowed = serializers.BooleanField(required=False)
    consent_source               = serializers.CharField(max_length=100, required=False, allow_null=True)
    consented_at                 = serializers.DateTimeField(required=False, allow_null=True)
