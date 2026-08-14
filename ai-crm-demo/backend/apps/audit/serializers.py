from rest_framework import serializers

from .models import AuditLog, IncidentReport


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "tenant_id",
            "store_id",
            "user_id",
            "action",
            "target_type",
            "target_id",
            "before_snapshot",
            "after_snapshot",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields


class IncidentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "store_id",
            "incident_type",
            "severity",
            "status",
            "title",
            "description",
            "action_note",
            "created_by_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "store_id", "created_by_id", "created_at", "updated_at"]


class IncidentReportCreateSerializer(serializers.Serializer):
    incident_type = serializers.ChoiceField(choices=IncidentReport.IncidentType.choices)
    severity = serializers.ChoiceField(choices=IncidentReport.Severity.choices, required=False, default=IncidentReport.Severity.LOW)
    title = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    action_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_title(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("タイトルを入力してください。")
        return value.strip()


class IncidentReportUpdateSerializer(serializers.Serializer):
    severity = serializers.ChoiceField(choices=IncidentReport.Severity.choices, required=False)
    status = serializers.ChoiceField(choices=IncidentReport.Status.choices, required=False)
    title = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    action_note = serializers.CharField(required=False, allow_blank=True)

    def validate_title(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("タイトルを入力してください。")
        return value.strip()
