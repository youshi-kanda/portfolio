from django.contrib import admin

from .models import AuditLog, IncidentReport


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "store", "user", "target_type", "target_id")
    list_filter = ("action", "created_at")
    search_fields = ("target_type", "target_id")
    readonly_fields = [field.name for field in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(IncidentReport)
class IncidentReportAdmin(admin.ModelAdmin):
    list_display    = ["created_at", "store", "incident_type", "severity", "status", "title", "created_by"]
    list_filter     = ["incident_type", "severity", "status"]
    search_fields   = ["title"]
    # status と action_note のみ編集可（対応進捗の更新・解決メモの追記が目的）
    # それ以外はインシデント記録の改ざん防止のため readonly
    readonly_fields = [
        "id", "store", "incident_type", "severity",
        "title", "description", "created_by", "created_at", "updated_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
