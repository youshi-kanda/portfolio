import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("stores", "0002_menu_model"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id", models.UUIDField(blank=True, null=True)),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("login", "ログイン"),
                            ("store_updated", "店舗情報更新"),
                            ("customer_created", "顧客作成"),
                            ("customer_updated", "顧客更新"),
                            ("customer_deleted", "顧客削除"),
                            ("consent_updated", "同意状態更新"),
                            ("unsubscribed", "配信停止"),
                            ("resubscribed", "配信停止解除"),
                            ("csv_uploaded", "CSVアップロード"),
                            ("csv_import_executed", "CSV取込実行"),
                            ("ai_diagnosis_executed", "AI診断実行"),
                        ],
                        max_length=50,
                    ),
                ),
                ("target_type", models.CharField(blank=True, max_length=100, null=True)),
                ("target_id", models.UUIDField(blank=True, null=True)),
                ("before_snapshot", models.JSONField(blank=True, null=True)),
                ("after_snapshot", models.JSONField(blank=True, null=True)),
                ("ip_address", models.CharField(blank=True, max_length=45, null=True)),
                ("user_agent", models.TextField(blank=True, null=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "store",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="audit_logs",
                        to="stores.store",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_logs",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "db_table": "audit_logs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["tenant_id", "created_at"], name="audit_logs_tenant__0b1a88_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["store", "created_at"], name="audit_logs_store_i_ee5681_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["action", "created_at"], name="audit_logs_action_391715_idx"),
        ),
    ]
