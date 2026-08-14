# Generated for P7-024: login throttle audit action

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0012_alter_auditlog_action_logout"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("login", "ログイン"),
                    ("logout", "ログアウト"),
                    ("login_throttled", "ログイン試行制限"),
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
                    ("line_broadcast_created", "LINE配信作成"),
                    ("line_broadcast_sent", "LINE配信実行"),
                    ("line_broadcast_started", "LINE配信開始"),
                    ("line_broadcast_batch_failed", "LINE配信バッチ失敗"),
                    ("line_broadcast_rate_limited", "LINE配信レート制限"),
                    ("line_broadcast_completed", "LINE配信完了"),
                    ("line_broadcast_failed", "LINE配信失敗"),
                    ("line_broadcast_draft_rollback", "LINE配信DRAFT差し戻し"),
                    ("line_broadcast_retry_queued", "LINE配信リトライ実行"),
                    ("line_scenario_created", "LINEシナリオ作成"),
                    ("line_scenario_activated", "LINEシナリオ有効化"),
                    ("line_scenario_paused", "LINEシナリオ一時停止"),
                    ("line_scenario_enrolled", "LINEシナリオ登録"),
                    ("line_scenario_step_sent", "LINEシナリオステップ送信"),
                    ("line_scenario_completed", "LINEシナリオ完了"),
                    ("line_auto_reply_rule_created", "LINE自動応答ルール作成"),
                    ("line_auto_reply_rule_updated", "LINE自動応答ルール更新"),
                    ("line_auto_reply_rule_deleted", "LINE自動応答ルール削除"),
                    ("line_auto_reply_sent", "LINE自動応答送信"),
                    ("line_auto_reply_failed", "LINE自動応答送信失敗"),
                    ("line_account_credentials_updated", "LINEアカウント認証情報更新"),
                    ("line_broadcast_partial_failed", "LINE配信一部失敗"),
                    ("line_broadcast_unknown_detected", "LINE配信送信結果不明検出"),
                    ("line_broadcast_duplicate_task_skipped", "LINE配信重複タスクスキップ"),
                    ("line_broadcast_retry_disabled", "LINE配信β再送無効"),
                    ("line_broadcast_existing_batch_skipped", "LINE配信既存バッチスキップ"),
                    ("csv_target_exported", "施策対象者CSVエクスポート"),
                    ("csv_target_export_denied", "施策対象者CSVエクスポート拒否"),
                    ("csv_excluded_exported", "施策除外者CSVエクスポート"),
                    ("csv_excluded_export_denied", "施策除外者CSVエクスポート拒否"),
                    ("content_approved", "文案承認"),
                    ("content_rejected", "文案差戻し"),
                    ("customer_anonymized", "顧客匿名化"),
                ],
                max_length=50,
            ),
        ),
    ]
