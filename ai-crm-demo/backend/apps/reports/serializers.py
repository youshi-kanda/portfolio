from rest_framework import serializers

from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Report
        fields = [
            "id", "report_type", "title", "period_start", "period_end",
            "summary", "body_markdown", "generated_by_ai", "status",
            "contains_personal_data", "created_by_id", "created_at", "updated_at",
        ]
        read_only_fields = fields


class MonthlyReportGenerateSerializer(serializers.Serializer):
    period_start = serializers.DateField()
    period_end   = serializers.DateField()

    def validate(self, data):
        if data["period_end"] < data["period_start"]:
            raise serializers.ValidationError(
                {"period_end": "終了日は開始日以降を指定してください。"}
            )
        return data
