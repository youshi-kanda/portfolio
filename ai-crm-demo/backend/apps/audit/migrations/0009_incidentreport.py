import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("stores", "0004_storecollaborator_can_approve_contents"),
        ("audit", "0008_alter_auditlog_action"),
    ]

    operations = [
        migrations.CreateModel(
            name="IncidentReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "incident_type",
                    models.CharField(
                        choices=[
                            ("inquiry", "問い合わせ"),
                            ("near_miss", "ヒヤリハット"),
                            ("operation_note", "運用メモ"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[("low", "低"), ("medium", "中"), ("high", "高")],
                        default="low",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("open", "未対応"), ("in_progress", "対応中"), ("resolved", "解決済み")],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True, default="")),
                ("action_note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_incident_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "store",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incident_reports",
                        to="stores.store",
                    ),
                ),
            ],
            options={
                "db_table": "incident_reports",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="incidentreport",
            index=models.Index(fields=["store", "status", "created_at"], name="incident_re_store_i_bbdbb7_idx"),
        ),
        migrations.AddIndex(
            model_name="incidentreport",
            index=models.Index(fields=["store", "incident_type", "created_at"], name="incident_re_store_i_356de0_idx"),
        ),
    ]
