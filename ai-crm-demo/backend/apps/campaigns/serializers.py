from rest_framework import serializers

from .models import Campaign, CampaignContent, CampaignResult, CampaignTarget


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Campaign
        fields = [
            "id", "name", "purpose", "channel", "status",
            "scheduled_at", "executed_at", "target_count",
            "caution_summary", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CampaignCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Campaign
        fields = ["name", "purpose", "channel", "scheduled_at", "caution_summary"]

    def validate_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("施策名を入力してください。")
        return value


class CampaignUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Campaign
        fields = [
            "name", "purpose", "channel", "status",
            "scheduled_at", "executed_at", "target_count", "caution_summary",
        ]


class CampaignContentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CampaignContent
        fields = [
            "id", "content_type", "title", "body", "cta", "tone",
            "generated_by_ai", "expression_risk_level", "expression_check_result",
            "approval_status", "approved_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "generated_by_ai", "approved_at", "created_at", "updated_at"]


class CampaignTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CampaignTarget
        fields = [
            "id", "customer_id", "target_reason",
            "excluded", "exclusion_reason", "delivery_status", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CampaignResultSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CampaignResult
        fields = [
            "id", "campaign_id",
            "sent_count", "reply_count", "click_count",
            "reservation_count", "visit_count", "revenue_amount",
            "memo", "recorded_by_id", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "campaign_id", "recorded_by_id", "created_at", "updated_at"]


class CampaignResultCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CampaignResult
        fields = [
            "sent_count", "reply_count", "click_count",
            "reservation_count", "visit_count", "revenue_amount", "memo",
        ]


class CampaignContentListSerializer(serializers.Serializer):
    id              = serializers.UUIDField()
    campaign_id     = serializers.UUIDField(allow_null=True)
    campaign_title  = serializers.SerializerMethodField()
    title           = serializers.CharField(allow_null=True)
    channel         = serializers.SerializerMethodField()
    approval_status = serializers.CharField()
    expression_risk_level = serializers.CharField(allow_null=True)
    content_text    = serializers.CharField(source="body")
    created_at      = serializers.DateTimeField()
    updated_at      = serializers.DateTimeField()

    def get_campaign_title(self, obj) -> str | None:
        return obj.campaign.name if obj.campaign_id and obj.campaign else None

    def get_channel(self, obj) -> str | None:
        return obj.campaign.channel if obj.campaign_id and obj.campaign else None
