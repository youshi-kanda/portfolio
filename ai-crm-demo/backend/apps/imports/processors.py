import csv
import io
import re
import uuid as _uuid
from datetime import datetime

from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignResult
from apps.customers.models import Customer, CustomerConsent, CustomerProfile
from apps.reservations.models import Reservation
from apps.sales.models import Sale

from .models import ImportError, ImportJob


_BOOL_TRUE  = {"true", "1", "はい", "あり", "可", "同意あり"}
_BOOL_FALSE = {"false", "0", "いいえ", "なし", "不可", "同意なし"}

_DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M",
    "%Y年%m月%d日",
]

_GENDER_MAP = {
    "female": "female", "女性": "female",
    "male": "male",     "男性": "male",
    "other": "other",   "その他": "other",
    "unknown": "unknown", "不明": "unknown",
}

_STATUS_MAP = {
    "reserved": "reserved",   "予約済み": "reserved",  "未来予約": "reserved",
    "visited": "visited",     "来店済み": "visited",   "施術済み": "visited",
    "cancelled": "cancelled", "キャンセル": "cancelled",
    "no_show": "no_show",     "無断キャンセル": "no_show",
}

_DATETIME_FORMATS = [
    "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M",
    "%Y-%m-%dT%H:%M",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y年%m月%d日",
]


def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp932"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise ValueError("ファイルの文字コードを判定できませんでした。UTF-8またはShift_JISで保存してください。")


def _parse_bool(value: str) -> bool | None:
    if not value:
        return None
    v = value.strip().lower()
    if v in _BOOL_TRUE:
        return True
    if v in _BOOL_FALSE:
        return False
    return None


def _parse_date(value: str):
    if not value:
        return None
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_datetime(value: str):
    if not value:
        return None
    value = value.strip()
    tz = timezone.get_current_timezone()
    for fmt in _DATETIME_FORMATS:
        try:
            dt = datetime.strptime(value, fmt)
            return timezone.make_aware(dt, tz)
        except ValueError:
            continue
    return None


def _parse_amount(value: str) -> int | None:
    if not value:
        return None
    cleaned = re.sub(r"[¥,円\s]", "", value.strip())
    try:
        return int(cleaned)
    except ValueError:
        return None


def _val(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


# 個人情報に該当するキー（CLAUDE.md 5節 / P7-020 方針に準拠）
_PII_KEYS: frozenset[str] = frozenset({
    "full_name", "kana", "display_name",
    "phone", "email", "line_user_id", "note",
})


def _mask_raw_data(row: dict) -> dict:
    """raw_data に保存する前に個人情報フィールドをマスキングする。

    キー名は保持（デバッグ可能）、値のみ '***' に置換する。
    空文字列や None は置換しない（フィールド欠損とマスクを区別するため）。
    """
    return {
        k: ("***" if k in _PII_KEYS and v and str(v).strip() else v)
        for k, v in row.items()
    }


class CustomerCsvProcessor:
    def __init__(self, job: ImportJob) -> None:
        self.job   = job
        self.store = job.store

    def run(self) -> None:
        self.job.status     = ImportJob.Status.PROCESSING
        self.job.started_at = timezone.now()
        self.job.save(update_fields=["status", "started_at"])

        try:
            rows = self._read_rows()
        except Exception as exc:
            self._fail(str(exc))
            return

        total   = len(rows)
        success = 0
        errors  = 0

        for i, row in enumerate(rows, start=2):  # row 1 is header
            if self._process_row(i, row):
                success += 1
            else:
                errors += 1

        self.job.status       = ImportJob.Status.COMPLETED
        self.job.total_rows   = total
        self.job.success_rows = success
        self.job.error_rows   = errors
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "total_rows", "success_rows", "error_rows", "completed_at"])

    def _fail(self, message: str) -> None:
        self.job.status       = ImportJob.Status.FAILED
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "completed_at"])
        ImportError.objects.create(
            import_job=self.job,
            store_id=self.store.id,
            error_type=ImportError.ErrorType.UNKNOWN,
            error_message=message,
        )

    def _read_rows(self) -> list[dict]:
        with self.job.file.open("rb") as f:
            raw = f.read()
        text   = _decode(raw)
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)

    def _has_identifier(self, row: dict) -> bool:
        return bool(
            _val(row, "external_customer_id")
            or _val(row, "phone")
            or _val(row, "email")
            or _val(row, "line_user_id")
            or _val(row, "full_name")
            or _val(row, "display_name")
        )

    def _find_existing(self, row: dict) -> Customer | None:
        ext_id = _val(row, "external_customer_id")
        if ext_id:
            c = Customer.objects.filter(
                store=self.store, external_customer_id=ext_id, deleted_at__isnull=True
            ).first()
            if c:
                return c

        phone = _val(row, "phone")
        if phone:
            c = Customer.objects.filter(
                store=self.store, phone=phone, deleted_at__isnull=True
            ).first()
            if c:
                return c

        email = _val(row, "email")
        if email:
            c = Customer.objects.filter(
                store=self.store, email=email, deleted_at__isnull=True
            ).first()
            if c:
                return c

        return None

    def _process_row(self, row_number: int, row: dict) -> bool:
        if not self._has_identifier(row):
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message=(
                    "顧客を識別できる情報が不足しています。"
                    "外部顧客ID・電話番号・メール・氏名のいずれかを入力してください。"
                ),
                raw_data=_mask_raw_data(row),
            )
            return False

        customer = self._find_existing(row)
        customer = self._upsert_customer(customer, row)
        self._upsert_profile(customer, row)
        self._upsert_consent(customer, row)
        return True

    def _upsert_customer(self, customer: Customer | None, row: dict) -> Customer:
        fields: dict = {}

        for key in ("external_customer_id", "display_name", "full_name", "kana",
                    "phone", "email", "line_user_id", "acquisition_channel"):
            v = _val(row, key)
            if v:
                fields[key] = v

        d = _parse_date(_val(row, "first_contact_date"))
        if d:
            fields["first_contact_date"] = d

        if customer:
            for k, v in fields.items():
                setattr(customer, k, v)
            customer.save(update_fields=list(fields.keys()) + ["updated_at"])
        else:
            customer = Customer.objects.create(store=self.store, **fields)

        return customer

    def _upsert_profile(self, customer: Customer, row: dict) -> None:
        profile, _ = CustomerProfile.objects.get_or_create(
            customer=customer,
            defaults={"store_id": self.store.id},
        )

        fields: dict = {}

        gender_raw = _val(row, "gender").lower()
        if gender_raw:
            g = _GENDER_MAP.get(gender_raw)
            if g:
                fields["gender"] = g

        if _val(row, "age_group"):
            fields["age_group"] = _val(row, "age_group")

        for date_key in ("birth_date", "first_visit_date", "last_visit_date"):
            d = _parse_date(_val(row, date_key))
            if d:
                fields[date_key] = d

        visit_count_raw = _val(row, "visit_count")
        if visit_count_raw:
            try:
                fields["visit_count"] = int(visit_count_raw)
            except ValueError:
                pass

        total_sales = _parse_amount(_val(row, "total_sales"))
        if total_sales is not None:
            fields["total_sales"] = total_sales

        if _val(row, "note"):
            fields["note"] = _val(row, "note")

        if fields:
            for k, v in fields.items():
                setattr(profile, k, v)
            profile.save(update_fields=list(fields.keys()) + ["updated_at"])

    def _upsert_consent(self, customer: Customer, row: dict) -> None:
        consent, _ = CustomerConsent.objects.get_or_create(
            customer=customer,
            defaults={"store_id": self.store.id},
        )

        fields: dict = {}

        for bool_key in ("contact_line_allowed", "contact_email_allowed",
                         "contact_sms_allowed", "analysis_allowed"):
            v = _parse_bool(_val(row, bool_key))
            if v is not None:
                fields[bool_key] = v

        is_unsub = _parse_bool(_val(row, "is_unsubscribed"))
        if is_unsub is True:
            fields["is_unsubscribed"] = True
            if not consent.unsubscribed_at:
                fields["unsubscribed_at"] = timezone.now()

        if _val(row, "consent_source"):
            fields["consent_source"] = _val(row, "consent_source")

        consented_at = _parse_date(_val(row, "consented_at"))
        if consented_at and not consent.consented_at:
            from datetime import datetime as _dt
            fields["consented_at"] = _dt.combine(consented_at, _dt.min.time()).replace(
                tzinfo=timezone.get_current_timezone()
            )

        if fields:
            for k, v in fields.items():
                setattr(consent, k, v)
            consent.save(update_fields=list(fields.keys()) + ["updated_at"])


class ReservationCsvProcessor:
    def __init__(self, job: ImportJob) -> None:
        self.job   = job
        self.store = job.store

    def run(self) -> None:
        self.job.status     = ImportJob.Status.PROCESSING
        self.job.started_at = timezone.now()
        self.job.save(update_fields=["status", "started_at"])

        try:
            rows = self._read_rows()
        except Exception as exc:
            self._fail(str(exc))
            return

        total   = len(rows)
        success = 0
        errors  = 0

        for i, row in enumerate(rows, start=2):
            if self._process_row(i, row):
                success += 1
            else:
                errors += 1

        self.job.status       = ImportJob.Status.COMPLETED
        self.job.total_rows   = total
        self.job.success_rows = success
        self.job.error_rows   = errors
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "total_rows", "success_rows", "error_rows", "completed_at"])

    def _fail(self, message: str) -> None:
        self.job.status       = ImportJob.Status.FAILED
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "completed_at"])
        ImportError.objects.create(
            import_job=self.job,
            store_id=self.store.id,
            error_type=ImportError.ErrorType.UNKNOWN,
            error_message=message,
        )

    def _read_rows(self) -> list[dict]:
        with self.job.file.open("rb") as f:
            raw = f.read()
        text   = _decode(raw)
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)

    def _find_customer(self, row: dict) -> Customer | None:
        ext_id = _val(row, "external_customer_id")
        if ext_id:
            c = Customer.objects.filter(
                store=self.store, external_customer_id=ext_id, deleted_at__isnull=True
            ).first()
            if c:
                return c

        phone = _val(row, "phone")
        if phone:
            c = Customer.objects.filter(
                store=self.store, phone=phone, deleted_at__isnull=True
            ).first()
            if c:
                return c

        return None

    def _process_row(self, row_number: int, row: dict) -> bool:
        reservation_date = _parse_datetime(_val(row, "reservation_date"))
        if reservation_date is None:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="reservation_date",
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message="予約日時は必須です。YYYY-MM-DD または YYYY-MM-DD HH:MM 形式で入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        status_raw = _val(row, "status")
        if not status_raw:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="status",
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message="予約状態は必須です。reserved / visited / cancelled / no_show のいずれかを入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        status_val = _STATUS_MAP.get(status_raw.strip())
        if status_val is None:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="status",
                error_type=ImportError.ErrorType.INVALID_FORMAT,
                error_message=f"予約状態 '{status_raw}' は不正な値です。reserved / visited / cancelled / no_show のいずれかを入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        ext_res_id = _val(row, "external_reservation_id")
        if ext_res_id and Reservation.objects.filter(
            store=self.store,
            external_reservation_id=ext_res_id,
            deleted_at__isnull=True,
        ).exists():
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="external_reservation_id",
                error_type=ImportError.ErrorType.DUPLICATED,
                error_message=f"外部予約ID '{ext_res_id}' は既に取り込み済みです。スキップしました。",
                raw_data=_mask_raw_data(row),
            )
            return False

        customer = self._find_customer(row)

        fields: dict = {
            "store":              self.store,
            "scheduled_start_at": reservation_date,
            "status":             status_val,
        }
        if customer:
            fields["customer"] = customer
        if ext_res_id:
            fields["external_reservation_id"] = ext_res_id

        visit_date = _parse_datetime(_val(row, "visit_date"))
        if visit_date:
            fields["visited_at"] = visit_date

        menu_name = _val(row, "menu_name")
        if menu_name:
            fields["menu_name_snapshot"] = menu_name

        cancel_reason = _val(row, "cancel_reason")
        if cancel_reason:
            fields["cancellation_reason"] = cancel_reason

        if _parse_datetime(_val(row, "next_reservation_date")):
            fields["has_next_reservation"] = True

        Reservation.objects.create(**fields)
        return True


_PAYMENT_METHOD_MAP = {
    "cash": "cash",    "現金": "cash",
    "card": "card",    "カード": "card",  "クレジット": "card", "クレカ": "card",
    "qr": "qr",        "qrコード": "qr",  "qr코드": "qr",
    "bank": "bank",    "銀行振込": "bank", "振込": "bank",
    "other": "other",  "その他": "other",
}

_ITEM_CATEGORY_MAP = {
    "service": "service",           "施術": "service",      "施術・サービス": "service",
    "product": "product",           "物販": "product",
    "ticket": "ticket",             "回数券": "ticket",
    "subscription": "subscription", "定期契約": "subscription",
    "other": "other",               "その他": "other",
}

_CONTRACT_STATUS_MAP = {
    "active": "active",             "契約中": "active",
    "ended": "ended",               "終了": "ended",
    "renewal_due": "renewal_due",   "更新期限近い": "renewal_due",
}


class SalesCsvProcessor:
    def __init__(self, job: ImportJob) -> None:
        self.job   = job
        self.store = job.store

    def run(self) -> None:
        self.job.status     = ImportJob.Status.PROCESSING
        self.job.started_at = timezone.now()
        self.job.save(update_fields=["status", "started_at"])

        try:
            rows = self._read_rows()
        except Exception as exc:
            self._fail(str(exc))
            return

        total   = len(rows)
        success = 0
        errors  = 0

        for i, row in enumerate(rows, start=2):
            if self._process_row(i, row):
                success += 1
            else:
                errors += 1

        self.job.status       = ImportJob.Status.COMPLETED
        self.job.total_rows   = total
        self.job.success_rows = success
        self.job.error_rows   = errors
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "total_rows", "success_rows", "error_rows", "completed_at"])

    def _fail(self, message: str) -> None:
        self.job.status       = ImportJob.Status.FAILED
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "completed_at"])
        ImportError.objects.create(
            import_job=self.job,
            store_id=self.store.id,
            error_type=ImportError.ErrorType.UNKNOWN,
            error_message=message,
        )

    def _read_rows(self) -> list[dict]:
        with self.job.file.open("rb") as f:
            raw = f.read()
        text   = _decode(raw)
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)

    def _find_customer(self, row: dict) -> Customer | None:
        ext_id = _val(row, "external_customer_id")
        if ext_id:
            c = Customer.objects.filter(
                store=self.store, external_customer_id=ext_id, deleted_at__isnull=True
            ).first()
            if c:
                return c

        phone = _val(row, "phone")
        if phone:
            c = Customer.objects.filter(
                store=self.store, phone=phone, deleted_at__isnull=True
            ).first()
            if c:
                return c

        return None

    def _process_row(self, row_number: int, row: dict) -> bool:
        sale_date = _parse_date(_val(row, "sale_date"))
        if sale_date is None:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="sale_date",
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message="売上日は必須です。YYYY-MM-DD 形式で入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        amount = _parse_amount(_val(row, "amount"))
        if amount is None:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="amount",
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message="金額は必須です。半角数字で入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        payment_method_raw = _val(row, "payment_method").lower()
        payment_method_val = None
        if payment_method_raw:
            payment_method_val = _PAYMENT_METHOD_MAP.get(payment_method_raw)
            if payment_method_val is None:
                ImportError.objects.create(
                    import_job=self.job,
                    store_id=self.store.id,
                    row_number=row_number,
                    field_name="payment_method",
                    error_type=ImportError.ErrorType.INVALID_FORMAT,
                    error_message=(
                        f"支払方法 '{_val(row, 'payment_method')}' は不正な値です。"
                        "cash / card / qr / bank / other のいずれかを入力してください。"
                    ),
                    raw_data=_mask_raw_data(row),
                )
                return False

        item_category_raw = _val(row, "item_category").lower()
        item_category_val = None
        if item_category_raw:
            item_category_val = _ITEM_CATEGORY_MAP.get(item_category_raw)
            if item_category_val is None:
                ImportError.objects.create(
                    import_job=self.job,
                    store_id=self.store.id,
                    row_number=row_number,
                    field_name="item_category",
                    error_type=ImportError.ErrorType.INVALID_FORMAT,
                    error_message=(
                        f"商品カテゴリ '{_val(row, 'item_category')}' は不正な値です。"
                        "service / product / ticket / subscription / other のいずれかを入力してください。"
                    ),
                    raw_data=_mask_raw_data(row),
                )
                return False

        contract_status_raw = _val(row, "contract_status").lower()
        contract_status_val = None
        if contract_status_raw:
            contract_status_val = _CONTRACT_STATUS_MAP.get(contract_status_raw)
            if contract_status_val is None:
                ImportError.objects.create(
                    import_job=self.job,
                    store_id=self.store.id,
                    row_number=row_number,
                    field_name="contract_status",
                    error_type=ImportError.ErrorType.INVALID_FORMAT,
                    error_message=(
                        f"契約状態 '{_val(row, 'contract_status')}' は不正な値です。"
                        "active / ended / renewal_due のいずれかを入力してください。"
                    ),
                    raw_data=_mask_raw_data(row),
                )
                return False

        customer = self._find_customer(row)

        fields: dict = {
            "store":      self.store,
            "sale_date":  sale_date,
            "amount":     amount,
        }

        if customer:
            fields["customer"] = customer

        if payment_method_val:
            fields["payment_method"] = payment_method_val

        if item_category_val:
            fields["item_category"] = item_category_val

        if contract_status_val:
            fields["contract_status"] = contract_status_val

        item_name = _val(row, "item_name_snapshot")
        if item_name:
            fields["item_name_snapshot"] = item_name

        ticket_count_raw = _val(row, "ticket_remaining_count")
        if ticket_count_raw:
            try:
                fields["ticket_remaining_count"] = int(ticket_count_raw)
            except ValueError:
                pass

        Sale.objects.create(**fields)
        return True


class CampaignResultCsvProcessor:
    def __init__(self, job: ImportJob) -> None:
        self.job   = job
        self.store = job.store

    def run(self) -> None:
        self.job.status     = ImportJob.Status.PROCESSING
        self.job.started_at = timezone.now()
        self.job.save(update_fields=["status", "started_at"])

        try:
            rows = self._read_rows()
        except Exception as exc:
            self._fail(str(exc))
            return

        total   = len(rows)
        success = 0
        errors  = 0

        for i, row in enumerate(rows, start=2):
            if self._process_row(i, row):
                success += 1
            else:
                errors += 1

        self.job.status       = ImportJob.Status.COMPLETED
        self.job.total_rows   = total
        self.job.success_rows = success
        self.job.error_rows   = errors
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "total_rows", "success_rows", "error_rows", "completed_at"])

    def _fail(self, message: str) -> None:
        self.job.status       = ImportJob.Status.FAILED
        self.job.completed_at = timezone.now()
        self.job.save(update_fields=["status", "completed_at"])
        ImportError.objects.create(
            import_job=self.job,
            store_id=self.store.id,
            error_type=ImportError.ErrorType.UNKNOWN,
            error_message=message,
        )

    def _read_rows(self) -> list[dict]:
        with self.job.file.open("rb") as f:
            raw = f.read()
        text   = _decode(raw)
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)

    def _find_campaign(self, campaign_id_str: str) -> Campaign | None:
        try:
            cid = _uuid.UUID(campaign_id_str)
        except (ValueError, AttributeError):
            return None
        return Campaign.objects.filter(
            id=cid, store=self.store, deleted_at__isnull=True
        ).first()

    def _parse_int(self, value: str) -> int | None:
        if not value:
            return None
        try:
            return int(value.strip())
        except ValueError:
            return None

    def _process_row(self, row_number: int, row: dict) -> bool:
        campaign_id_str = _val(row, "campaign_id")
        if not campaign_id_str:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="campaign_id",
                error_type=ImportError.ErrorType.MISSING_REQUIRED,
                error_message="campaign_id は必須です。施策IDを入力してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        campaign = self._find_campaign(campaign_id_str)
        if campaign is None:
            ImportError.objects.create(
                import_job=self.job,
                store_id=self.store.id,
                row_number=row_number,
                field_name="campaign_id",
                error_type=ImportError.ErrorType.MAPPING_ERROR,
                error_message=f"施策ID '{campaign_id_str}' が見つかりません。この店舗の施策IDを確認してください。",
                raw_data=_mask_raw_data(row),
            )
            return False

        fields: dict = {}

        sent_count = self._parse_int(_val(row, "delivered_count"))
        if sent_count is not None:
            fields["sent_count"] = sent_count

        reply_count = self._parse_int(_val(row, "reply_count"))
        if reply_count is not None:
            fields["reply_count"] = reply_count

        click_count = self._parse_int(_val(row, "clicked_count"))
        if click_count is not None:
            fields["click_count"] = click_count

        reservation_count = self._parse_int(_val(row, "reservation_count"))
        if reservation_count is not None:
            fields["reservation_count"] = reservation_count

        visit_count = self._parse_int(_val(row, "visit_count"))
        if visit_count is not None:
            fields["visit_count"] = visit_count

        revenue_amount = _parse_amount(_val(row, "sales_amount"))
        if revenue_amount is not None:
            fields["revenue_amount"] = revenue_amount

        memo = _val(row, "memo")
        if memo:
            fields["memo"] = memo

        if hasattr(campaign, "result"):
            result = campaign.result
            for k, v in fields.items():
                setattr(result, k, v)
            result.save(update_fields=list(fields.keys()) + ["updated_at"])
        else:
            CampaignResult.objects.create(
                campaign=campaign,
                store_id=self.store.id,
                **fields,
            )
            campaign.status = Campaign.Status.REVIEWED
            campaign.save(update_fields=["status", "updated_at"])

        return True


_PROCESSOR_MAP = {
    ImportJob.ImportType.CUSTOMERS:        CustomerCsvProcessor,
    ImportJob.ImportType.RESERVATIONS:     ReservationCsvProcessor,
    ImportJob.ImportType.SALES:            SalesCsvProcessor,
    ImportJob.ImportType.CAMPAIGN_RESULTS: CampaignResultCsvProcessor,
}


def get_processor(job: ImportJob):
    cls = _PROCESSOR_MAP.get(job.import_type)
    if cls is None:
        raise ValueError(f"import_type '{job.import_type}' のプロセッサが未実装です。")
    return cls(job)
