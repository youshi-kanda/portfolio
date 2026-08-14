from rest_framework import serializers

from .models import ImportError, ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ImportJob
        fields = [
            "id",
            "store_id",
            "import_type",
            "source_type",
            "file_name",
            "status",
            "total_rows",
            "success_rows",
            "error_rows",
            "executed_by",
            "started_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = fields


class ImportJobCreateSerializer(serializers.Serializer):
    file        = serializers.FileField()
    import_type = serializers.ChoiceField(choices=ImportJob.ImportType.choices)
    source_type = serializers.ChoiceField(
        choices=ImportJob.SourceType.choices,
        default=ImportJob.SourceType.CSV,
        required=False,
    )

    def validate_file(self, value):
        name = value.name or ""
        if not name.lower().endswith(".csv"):
            raise serializers.ValidationError("CSVファイル（.csv）のみアップロードできます。")
        return value


class ImportErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ImportError
        fields = [
            "id",
            "import_job_id",
            "store_id",
            "row_number",
            "field_name",
            "error_type",
            "error_message",
            "raw_data",
            "created_at",
        ]
        read_only_fields = fields
