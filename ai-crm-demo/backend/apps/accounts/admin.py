from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "name", "status", "is_staff", "last_login_at", "created_at"]
    list_filter = ["status", "is_staff", "is_superuser"]
    search_fields = ["email", "name"]
    ordering = ["-created_at"]
    readonly_fields = ["id", "last_login_at", "created_at", "updated_at"]

    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("基本情報", {"fields": ("name", "status")}),
        ("権限", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("日時", {"fields": ("last_login_at", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "name", "password1", "password2", "status"),
        }),
    )
    # Override username_field reference from BaseUserAdmin
    filter_horizontal = ("groups", "user_permissions")
