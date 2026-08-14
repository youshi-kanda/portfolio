from django.contrib import admin

from .models import ImportError, ImportJob


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display    = ["id", "store", "import_type", "status", "total_rows", "success_rows", "error_rows", "created_at"]
    list_filter     = ["import_type", "status"]
    search_fields   = ["store__name"]
    readonly_fields = ["id", "store", "import_type", "source_type", "file_name", "file", "status", "total_rows", "success_rows", "error_rows", "executed_by", "started_at", "completed_at", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ImportError)
class ImportErrorAdmin(admin.ModelAdmin):
    list_display    = ["import_job", "row_number", "field_name", "error_type", "created_at"]
    list_filter     = ["error_type"]
    search_fields   = ["import_job__id"]
    readonly_fields = [field.name for field in ImportError._meta.fields]
    exclude         = ["raw_data"]  # マスク済みだが admin では非表示

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
