"""
import_errors レコードを保存期間経過後に削除する管理コマンド。

P7-020 方針: import_errors は 30 日以上経過したレコードを定期的に削除する。
raw_data に個人情報マスク済みの情報が残るため、長期保存を避ける。

使い方:
    python manage.py purge_import_errors
    python manage.py purge_import_errors --days 30
    python manage.py purge_import_errors --dry-run
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "import_errors レコードを保存期間（デフォルト 30 日）経過後に削除する"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="削除対象とする保存期間（日数）。デフォルト 30 日。",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="削除対象件数のみ表示し、実際には削除しない。",
        )

    def handle(self, *args, **options):
        from apps.imports.models import ImportError

        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(days=days)

        qs = ImportError.objects.filter(created_at__lt=cutoff)
        count = qs.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] {days} 日以上前の import_errors: {count} 件（削除対象・実削除なし）"
                )
            )
            return

        deleted, _ = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"import_errors を {deleted} 件削除しました（{days} 日以上前）"
            )
        )
