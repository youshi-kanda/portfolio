"""
P7-020: import_errors.raw_data マスキングと purge_import_errors コマンドのテスト。
"""
import uuid
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.imports.models import ImportError, ImportJob
from apps.imports.processors import _mask_raw_data
from apps.stores.models import Store, StoreSettings


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="owner@example.com", name="オーナー", password="StrongPass123!"
    )


@pytest.fixture
def store(db, user: User) -> Store:
    s = Store.objects.create(
        tenant_id=user.id,
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )
    StoreSettings.objects.create(store=s)
    return s


@pytest.fixture
def auth_client(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def _pending_job(store: Store, content: str, import_type: str = "customers") -> ImportJob:
    f = SimpleUploadedFile("test.csv", content.encode("utf-8"), content_type="text/csv")
    return ImportJob.objects.create(
        store=store,
        import_type=import_type,
        source_type=ImportJob.SourceType.CSV,
        file_name="test.csv",
        file=f,
        status=ImportJob.Status.PENDING,
    )


# ---------------------------------------------------------------------------
# _mask_raw_data ユニットテスト
# ---------------------------------------------------------------------------


def test_mask_raw_data_masks_pii_fields():
    row = {
        "full_name": "山田花子",
        "kana": "ヤマダハナコ",
        "phone": "090-1234-5678",
        "email": "hanako@example.com",
        "line_user_id": "Uabcdef1234567890",
        "display_name": "はなちゃん",
        "note": "常連さん。肌が敏感",
    }
    result = _mask_raw_data(row)
    for key in ("full_name", "kana", "phone", "email", "line_user_id", "display_name", "note"):
        assert result[key] == "***", f"{key} should be masked"


def test_mask_raw_data_preserves_non_pii_fields():
    row = {
        "external_customer_id": "C001",
        "acquisition_channel": "Instagram",
        "gender": "female",
        "age_group": "30s",
        "first_visit_date": "2026-02-10",
        "visit_count": "4",
        "total_sales": "58000",
        "contact_line_allowed": "はい",
        "is_unsubscribed": "いいえ",
        "consent_source": "LINE登録時",
    }
    result = _mask_raw_data(row)
    for key, val in row.items():
        assert result[key] == val, f"{key} should not be masked"


def test_mask_raw_data_preserves_empty_pii_fields():
    """空文字や None の PII フィールドはマスクしない（欠損とマスクを区別するため）。"""
    row = {"phone": "", "email": None, "full_name": "  "}
    result = _mask_raw_data(row)
    assert result["phone"] == ""
    assert result["email"] is None
    assert result["full_name"] == "  "


def test_mask_raw_data_preserves_all_keys():
    """キー名はすべて保持される（デバッグ可能性を維持するため）。"""
    row = {"phone": "090-0000-0001", "external_customer_id": "C001", "sale_date": "2026-01-01"}
    result = _mask_raw_data(row)
    assert set(result.keys()) == set(row.keys())


# ---------------------------------------------------------------------------
# CustomerCsvProcessor: エラー行の raw_data マスキング確認
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_customer_csv_error_raw_data_is_masked(auth_client: APIClient, store: Store):
    """識別子なし行のエラー raw_data で PII がマスクされることを確認する。

    phone/email/full_name/display_name 等が全て空だと識別子欠損エラーになる。
    kana と note は識別子ではないが PII 対象キーなのでマスクされる。
    """
    from django.urls import reverse

    csv_content = (
        "kana,note\n"
        "ヤマダハナコ,常連さん\n"   # 識別子（phone/email/full_name 等）が一切ない → エラー
    )
    job = _pending_job(store, csv_content)
    url = reverse("stores:imports:execute", kwargs={"store_id": store.id, "job_id": job.id})
    resp = auth_client.post(url)
    assert resp.status_code == 200

    err = ImportError.objects.get(import_job=job)
    raw = err.raw_data
    assert raw["kana"] == "***"
    assert raw["note"] == "***"


# ---------------------------------------------------------------------------
# purge_import_errors 管理コマンド
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_purge_command_deletes_old_records(store: Store, capsys):
    """cutoff より古いレコードが削除される。"""
    job = ImportJob.objects.create(
        store=store, import_type="customers", source_type="csv"
    )
    old_record = ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        error_type=ImportError.ErrorType.UNKNOWN,
        error_message="old error",
    )
    ImportError.objects.filter(pk=old_record.pk).update(
        created_at=timezone.now() - timedelta(days=31)
    )

    new_record = ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        error_type=ImportError.ErrorType.UNKNOWN,
        error_message="new error",
    )

    call_command("purge_import_errors", days=30)

    assert not ImportError.objects.filter(pk=old_record.pk).exists()
    assert ImportError.objects.filter(pk=new_record.pk).exists()


@pytest.mark.django_db
def test_purge_command_dry_run_does_not_delete(store: Store, capsys):
    """--dry-run では実削除が行われない。"""
    job = ImportJob.objects.create(
        store=store, import_type="customers", source_type="csv"
    )
    old_record = ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        error_type=ImportError.ErrorType.UNKNOWN,
        error_message="old error",
    )
    ImportError.objects.filter(pk=old_record.pk).update(
        created_at=timezone.now() - timedelta(days=31)
    )

    call_command("purge_import_errors", days=30, dry_run=True)

    assert ImportError.objects.filter(pk=old_record.pk).exists()


@pytest.mark.django_db
def test_purge_command_respects_days_option(store: Store):
    """--days オプションで閾値が変わることを確認する。"""
    job = ImportJob.objects.create(
        store=store, import_type="customers", source_type="csv"
    )
    record = ImportError.objects.create(
        import_job=job,
        store_id=store.id,
        error_type=ImportError.ErrorType.UNKNOWN,
        error_message="error",
    )
    ImportError.objects.filter(pk=record.pk).update(
        created_at=timezone.now() - timedelta(days=10)
    )

    # --days 30 では対象外（10日前なので残る）
    call_command("purge_import_errors", days=30)
    assert ImportError.objects.filter(pk=record.pk).exists()

    # --days 7 では対象（10日前なので削除される）
    call_command("purge_import_errors", days=7)
    assert not ImportError.objects.filter(pk=record.pk).exists()
