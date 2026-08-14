from rest_framework import serializers

from .models import CustomerInsight


class CustomerInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomerInsight
        fields = [
            "id", "store_id", "customer_id", "insight_date", "customer_state",
            "inferred_needs", "blocking_factors", "recommended_action",
            "priority", "evidence_summary", "ai_confidence", "valid_until",
            "review_status", "created_by_ai", "created_at", "updated_at",
        ]


class CustomerInsightReviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomerInsight
        fields = ["review_status"]
