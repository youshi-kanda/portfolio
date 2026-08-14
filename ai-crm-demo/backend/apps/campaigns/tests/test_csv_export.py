import csv
import io

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.campaigns.models import Campaign, CampaignTarget
from apps.campaigns.views import _mask_email, _mask_name, _mask_phone
from apps.customers.models import Customer, CustomerConsent
from apps.insights.models import CustomerInsight
from apps.stores.models import Store, StoreCollaborator

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="owner@example.com", name="オーナー", password="StrongPass123!"
    )


@pytest.fixture
def supporter(db) -> User:
    return User.objects.create_user(
        email="supporter@example.com", name="外部支援者", password="StrongPass123!",
        role=User.Role.SUPPORTER,
    )


@pytest.fixture
def auth_client(client, user) -> APIClient:
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def supporter_client(supporter) -> APIClient:
    c = APIClient()
    token = RefreshToken.for_user(supporter).access_token
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.fixture
def store(db, user) -> Store:
    return Store.objects.create(
        tenant_id=user.id,
        name="テスト店舗",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )


@pytest.fixture
def campaign(store, user) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="休眠復帰施策",
        purpose=Campaign.Purpose.DORMANT_REACTIVATION,
        channel=Campaign.Channel.OFFICIAL_LINE,
    )


def _make_target(store, campaign, *, excluded=False, exclusion_reason="", display_name="山田花子"):
    customer = Customer.objects.create(
        store=store, display_name=display_name, status="active",
        phone="090-1234-5678", email="hanako@example.com",
    )
    CustomerConsent.objects.create(
        customer=customer, store_id=store.id,
        contact_line_allowed=not excluded,
        is_unsubscribed=False,
    )
    return CampaignTarget.objects.create(
        campaign=campaign, store=store, customer=customer,
        excluded=excluded,
        exclusion_reason=exclusion_reason,
        target_reason="テスト理由",
    )


def _parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


# ---------------------------------------------------------------------------
# Masking unit tests
# ---------------------------------------------------------------------------


class TestMaskingHelpers:
    def test_mask_name_long(self):
        assert _mask_name("山田花子") == "山〇〇〇"

    def test_mask_name_single(self):
        assert _mask_name("山") == "山"

    def test_mask_name_empty(self):
        assert _mask_name("") == ""
        assert _mask_name(None) == ""

    def test_mask_phone_hyphenated(self):
        assert _mask_phone("090-1234-5678") == "090-****-5678"

    def test_mask_phone_none(self):
        assert _mask_phone(None) == ""

    def test_mask_email_normal(self):
        assert _mask_email("hanako@example.com") == "h***@example.com"

    def test_mask_email_none(self):
        assert _mask_email(None) == ""


# ---------------------------------------------------------------------------
# Export: included targets
# ---------------------------------------------------------------------------


class TestTargetExport:
    def _url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_export_returns_csv(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False, display_name="山田花子")

        res = auth_client.get(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_200_OK
        assert "text/csv" in res["Content-Type"]
        assert "attachment" in res["Content-Disposition"]
        rows = _parse_csv(b"".join(res.streaming_content))
        assert len(rows) == 1

    def test_export_masks_display_name(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False, display_name="山田花子")

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert rows[0]["display_name"] == "山〇〇〇"

    def test_export_only_included(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False, display_name="対象者")
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止", display_name="除外者")

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert len(rows) == 1
        assert rows[0]["display_name"] == "対〇〇"

    def test_export_empty(self, auth_client, store, campaign):
        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))
        assert len(rows) == 0

    def test_export_has_required_columns(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False)

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert "campaign_id" in rows[0]
        assert "customer_id" in rows[0]
        assert "display_name" in rows[0]

    def test_401_unauthenticated(self, client, store, campaign):
        url = self._url(store.id, campaign.id)
        assert client.get(url).status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(self, auth_client, db):
        other_user = User.objects.create_user(
            email="other@example.com", name="他", password="StrongPass123!"
        )
        other_store = Store.objects.create(
            tenant_id=other_user.id, name="他店舗",
            industry=Store.Industry.HAIR, area_label="難波", created_by=other_user,
        )
        other_campaign = Campaign.objects.create(
            store=other_store, owner_user=other_user,
            name="他施策", purpose="repeat", channel="in_store",
        )
        url = self._url(other_store.id, other_campaign.id)
        assert auth_client.get(url).status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Export: excluded targets
# ---------------------------------------------------------------------------


class TestTargetExportExcluded:
    def _url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export-excluded",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_export_excluded_returns_csv(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止", display_name="田中一郎")

        res = auth_client.get(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_200_OK
        rows = _parse_csv(b"".join(res.streaming_content))
        assert len(rows) == 1

    def test_export_excluded_only_excluded(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False, display_name="対象者")
        _make_target(store, campaign, excluded=True, exclusion_reason="LINE連絡同意なし", display_name="除外者")

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert len(rows) == 1

    def test_export_excluded_has_exclusion_reason(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止", display_name="鈴木次郎")

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert rows[0]["exclusion_reason"] == "配信停止"

    def test_export_excluded_masks_name(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止", display_name="鈴木次郎")

        res = auth_client.get(self._url(store.id, campaign.id))
        rows = _parse_csv(b"".join(res.streaming_content))

        assert rows[0]["display_name"] == "鈴〇〇〇"

    def test_401_unauthenticated(self, client, store, campaign):
        url = self._url(store.id, campaign.id)
        assert client.get(url).status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# Permission and audit log tests: targets export
# ---------------------------------------------------------------------------


@pytest.fixture
def collab_with_export(db, store, supporter, user) -> StoreCollaborator:
    return StoreCollaborator.objects.create(
        store=store,
        user=supporter,
        can_view=True,
        can_export_csv=True,
        invited_by=user,
    )


@pytest.fixture
def collab_without_export(db, store, supporter, user) -> StoreCollaborator:
    return StoreCollaborator.objects.create(
        store=store,
        user=supporter,
        can_view=True,
        can_export_csv=False,
        invited_by=user,
    )


class TestTargetExportPermissions:
    def _url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_owner_export_creates_audit_log(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False)

        res = auth_client.get(self._url(store.id, campaign.id))
        b"".join(res.streaming_content)

        assert res.status_code == status.HTTP_200_OK
        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORTED)
        assert log.after_snapshot["export_type"] == "targets"
        assert log.after_snapshot["target_count"] == 1
        assert log.after_snapshot["campaign_id"] == str(campaign.id)

    def test_collaborator_with_permission_can_export(
        self, supporter_client, store, campaign, collab_with_export
    ):
        _make_target(store, campaign, excluded=False)

        res = supporter_client.get(self._url(store.id, campaign.id))
        b"".join(res.streaming_content)

        assert res.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORTED).exists()

    def test_collaborator_without_permission_is_403(
        self, supporter_client, store, campaign, collab_without_export
    ):
        res = supporter_client.get(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORT_DENIED)
        assert log.after_snapshot["reason"] == "permission_denied"
        assert log.after_snapshot["export_type"] == "targets"

    def test_audit_log_has_no_personal_info(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=False, display_name="山田花子")

        auth_client.get(self._url(store.id, campaign.id))

        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_CSV_EXPORTED)
        snapshot_str = str(log.after_snapshot)
        assert "山田" not in snapshot_str
        assert "090-" not in snapshot_str
        assert "hanako" not in snapshot_str


# ---------------------------------------------------------------------------
# Permission and audit log tests: excluded targets export
# ---------------------------------------------------------------------------


class TestTargetExportExcludedPermissions:
    def _url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export-excluded",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_owner_export_excluded_creates_audit_log(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止")

        res = auth_client.get(self._url(store.id, campaign.id))
        b"".join(res.streaming_content)

        assert res.status_code == status.HTTP_200_OK
        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORTED)
        assert log.after_snapshot["export_type"] == "excluded"
        assert log.after_snapshot["target_count"] == 1

    def test_collaborator_with_permission_can_export_excluded(
        self, supporter_client, store, campaign, collab_with_export
    ):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止")

        res = supporter_client.get(self._url(store.id, campaign.id))
        b"".join(res.streaming_content)

        assert res.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORTED).exists()

    def test_collaborator_without_permission_is_403_excluded(
        self, supporter_client, store, campaign, collab_without_export
    ):
        res = supporter_client.get(self._url(store.id, campaign.id))

        assert res.status_code == status.HTTP_403_FORBIDDEN
        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORT_DENIED)
        assert log.after_snapshot["reason"] == "permission_denied"
        assert log.after_snapshot["export_type"] == "excluded"

    def test_audit_log_excluded_has_no_personal_info(self, auth_client, store, campaign):
        _make_target(store, campaign, excluded=True, exclusion_reason="配信停止", display_name="鈴木次郎")

        auth_client.get(self._url(store.id, campaign.id))

        log = AuditLog.objects.get(store=store, action=AuditLog.Action.CAMPAIGN_TARGET_EXCLUDED_CSV_EXPORTED)
        snapshot_str = str(log.after_snapshot)
        assert "鈴木" not in snapshot_str
        assert "090-" not in snapshot_str
        assert "hanako" not in snapshot_str


# ---------------------------------------------------------------------------
# P7-022: 削除済み顧客が配信対象CSV / 除外者CSVに含まれないこと
# ---------------------------------------------------------------------------


class TestDeletedCustomerExcludedFromCsv:
    """顧客削除後、既存の CampaignTarget があっても CSV に出力されないこと。"""

    def _target_url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def _excluded_url(self, store_id, campaign_id):
        return reverse(
            "stores:campaigns:targets-export-excluded",
            kwargs={"store_id": store_id, "campaign_id": campaign_id},
        )

    def test_deleted_customer_not_in_targets_csv(self, auth_client, store, campaign):
        from django.utils import timezone
        from apps.campaigns.models import CampaignTarget

        active_customer = Customer.objects.create(
            store=store, display_name="有効顧客", status="active",
        )
        deleted_customer = Customer.objects.create(
            store=store, display_name="削除済み顧客", status="active",
            phone="090-0000-0001", email="deleted@example.com",
        )
        # 両方を配信対象として登録
        CampaignTarget.objects.create(
            campaign=campaign, store=store, customer=active_customer,
            excluded=False, target_reason="テスト理由",
        )
        CampaignTarget.objects.create(
            campaign=campaign, store=store, customer=deleted_customer,
            excluded=False, target_reason="テスト理由",
        )

        # 顧客を論理削除 + anonymize
        deleted_customer.deleted_at = timezone.now()
        deleted_customer.status = "inactive"
        deleted_customer.display_name = None
        deleted_customer.phone = None
        deleted_customer.email = None
        deleted_customer.save()

        res = auth_client.get(self._target_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        rows = _parse_csv(b"".join(res.streaming_content))

        customer_ids = [r["customer_id"] for r in rows]
        assert str(active_customer.id) in customer_ids
        assert str(deleted_customer.id) not in customer_ids

    def test_deleted_customer_not_in_excluded_csv(self, auth_client, store, campaign):
        from django.utils import timezone
        from apps.campaigns.models import CampaignTarget

        active_customer = Customer.objects.create(
            store=store, display_name="有効顧客（除外）", status="active",
        )
        deleted_customer = Customer.objects.create(
            store=store, display_name="削除済み顧客（除外）", status="active",
        )
        CampaignTarget.objects.create(
            campaign=campaign, store=store, customer=active_customer,
            excluded=True, exclusion_reason="配信停止",
        )
        CampaignTarget.objects.create(
            campaign=campaign, store=store, customer=deleted_customer,
            excluded=True, exclusion_reason="配信停止",
        )

        deleted_customer.deleted_at = timezone.now()
        deleted_customer.status = "inactive"
        deleted_customer.display_name = None
        deleted_customer.save()

        res = auth_client.get(self._excluded_url(store.id, campaign.id))
        assert res.status_code == status.HTTP_200_OK
        rows = _parse_csv(b"".join(res.streaming_content))

        customer_ids = [r["customer_id"] for r in rows]
        assert str(active_customer.id) in customer_ids
        assert str(deleted_customer.id) not in customer_ids
