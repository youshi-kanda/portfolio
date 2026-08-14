from django.contrib import admin

from .models import Store, StoreCollaborator, StoreSettings, StoreTool


class StoreSettingsInline(admin.StackedInline):
    model = StoreSettings
    extra = 0


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display   = ["name", "industry", "status", "created_by", "created_at"]
    list_filter    = ["status", "industry"]
    search_fields  = ["name"]
    readonly_fields = ["id", "tenant_id", "created_at", "updated_at", "deleted_at"]
    inlines        = [StoreSettingsInline]


@admin.register(StoreTool)
class StoreToolAdmin(admin.ModelAdmin):
    list_display  = ["store", "tool_type", "usage_status", "connection_status"]
    list_filter   = ["tool_type", "usage_status"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(StoreCollaborator)
class StoreCollaboratorAdmin(admin.ModelAdmin):
    list_display    = ["store", "user", "can_view", "can_edit_campaigns", "can_approve_contents", "can_view_personal_info", "can_export_csv", "created_at"]
    list_filter     = ["can_view_personal_info", "can_export_csv", "can_approve_contents"]
    search_fields   = ["store__name", "user__email"]
    readonly_fields = ["id", "invited_by", "created_at", "updated_at"]
