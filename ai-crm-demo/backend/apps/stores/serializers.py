from rest_framework import serializers

from .models import Menu, Store, StoreCollaborator, StoreSettings, StoreTool


class StoreBasicSerializer(serializers.ModelSerializer):
    """Minimal store info used in /auth/me response."""

    class Meta:
        model = Store
        fields = ["id", "name", "status"]
        read_only_fields = fields


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = [
            "id",
            "tenant_id",
            "name",
            "industry",
            "sub_industry",
            "prefecture",
            "city",
            "area_label",
            "address",
            "phone",
            "website_url",
            "business_hours",
            "closed_days",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StoreCreateSerializer(serializers.Serializer):
    name           = serializers.CharField(max_length=255)
    industry       = serializers.ChoiceField(choices=Store.Industry.choices)
    sub_industry   = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    prefecture     = serializers.CharField(max_length=50, required=False, allow_blank=True, default=None)
    city           = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    area_label     = serializers.CharField(max_length=100)
    address        = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    phone          = serializers.CharField(max_length=20, required=False, allow_blank=True, default=None)
    website_url    = serializers.URLField(required=False, allow_blank=True, default=None)
    business_hours = serializers.JSONField(required=False, default=None)
    closed_days    = serializers.JSONField(required=False, default=None)


class StoreUpdateSerializer(serializers.Serializer):
    name           = serializers.CharField(max_length=255, required=False)
    industry       = serializers.ChoiceField(choices=Store.Industry.choices, required=False)
    sub_industry   = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    prefecture     = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    city           = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    area_label     = serializers.CharField(max_length=100, required=False)
    address        = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    phone          = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    website_url    = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    business_hours = serializers.JSONField(required=False, allow_null=True)
    closed_days    = serializers.JSONField(required=False, allow_null=True)
    status         = serializers.ChoiceField(choices=Store.Status.choices, required=False)


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = [
            "id",
            "main_goal",
            "tone",
            "ai_suggestion_level",
            "require_approval_for_external",
            "default_dormant_days",
            "default_pre_dormant_days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StoreToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreTool
        fields = [
            "id",
            "tool_type",
            "tool_name",
            "usage_status",
            "external_account_id",
            "connection_status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StoreToolCreateSerializer(serializers.Serializer):
    tool_type           = serializers.ChoiceField(choices=StoreTool.ToolType.choices)
    tool_name           = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    usage_status        = serializers.ChoiceField(choices=StoreTool.UsageStatus.choices)
    external_account_id = serializers.CharField(max_length=255, required=False, allow_blank=True, default=None)
    connection_status   = serializers.ChoiceField(
        choices=StoreTool.ConnectionStatus.choices, required=False, default=None, allow_null=True
    )
    notes               = serializers.CharField(required=False, allow_blank=True, default=None)


class StoreToolUpdateSerializer(serializers.Serializer):
    tool_name           = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    usage_status        = serializers.ChoiceField(choices=StoreTool.UsageStatus.choices, required=False)
    external_account_id = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    connection_status   = serializers.ChoiceField(
        choices=StoreTool.ConnectionStatus.choices, required=False, allow_null=True
    )
    notes               = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class MenuSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Menu
        fields = [
            "id",
            "store_id",
            "name",
            "category",
            "price",
            "duration_minutes",
            "is_main",
            "is_high_value",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MenuCreateSerializer(serializers.Serializer):
    name             = serializers.CharField(max_length=255)
    category         = serializers.CharField(max_length=100, required=False, allow_blank=True, default=None)
    price            = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=0)
    duration_minutes = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=1)
    is_main          = serializers.BooleanField(required=False, default=False)
    is_high_value    = serializers.BooleanField(required=False, default=False)
    description      = serializers.CharField(required=False, allow_blank=True, default=None)
    status           = serializers.ChoiceField(choices=Menu.Status.choices, required=False, default=Menu.Status.ACTIVE)


class MenuUpdateSerializer(serializers.Serializer):
    name             = serializers.CharField(max_length=255, required=False)
    category         = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    price            = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    duration_minutes = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    is_main          = serializers.BooleanField(required=False)
    is_high_value    = serializers.BooleanField(required=False)
    description      = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status           = serializers.ChoiceField(choices=Menu.Status.choices, required=False)


class StoreCollaboratorSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name  = serializers.CharField(source="user.name", read_only=True)
    user_role  = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model  = StoreCollaborator
        fields = [
            "id",
            "user_id",
            "user_email",
            "user_name",
            "user_role",
            "can_view",
            "can_edit_campaigns",
            "can_approve_contents",
            "can_view_personal_info",
            "can_export_csv",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StoreCollaboratorInviteSerializer(serializers.Serializer):
    user_email             = serializers.EmailField()
    can_view               = serializers.BooleanField(default=True)
    can_edit_campaigns     = serializers.BooleanField(default=False)
    can_approve_contents   = serializers.BooleanField(default=False)
    can_view_personal_info = serializers.BooleanField(default=False)
    can_export_csv         = serializers.BooleanField(default=False)


class StoreCollaboratorUpdateSerializer(serializers.Serializer):
    can_view               = serializers.BooleanField(required=False)
    can_edit_campaigns     = serializers.BooleanField(required=False)
    can_approve_contents   = serializers.BooleanField(required=False)
    can_view_personal_info = serializers.BooleanField(required=False)
    can_export_csv         = serializers.BooleanField(required=False)
