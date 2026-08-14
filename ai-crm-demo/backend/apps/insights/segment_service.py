"""
セグメント提案ロジック: 施策目的ごとに対象顧客を抽出・除外理由を付与する。
配信停止・同意未取得・削除済み顧客は必ず除外（CLAUDE.md Section 7参照）。
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from django.db.models import QuerySet
from django.utils import timezone

if TYPE_CHECKING:
    pass

# 施策目的ごとの対象顧客状態マッピング
_PURPOSE_TARGET_STATES: dict[str, list[str]] = {
    "dormant_reactivation": ["dormant"],
    "repeat":               ["after_first_visit", "repeater", "pre_dormant"],
    "first_followup":       ["after_first_visit"],
    "upsell":               ["repeater", "vip_candidate"],
    "new_customer":         ["new_lead", "first_reserved"],
    "renewal":              ["repeater", "vip_candidate"],
    "awareness":            [],  # 全顧客対象（除外ルール適用後）
    "custom":               [],  # 全顧客対象（除外ルール適用後）
}


@dataclass
class SegmentResult:
    included: list[dict] = field(default_factory=list)
    excluded: list[dict] = field(default_factory=list)
    total_candidates: int = 0
    total_included: int = 0
    total_excluded: int = 0
    purpose: str = ""
    generated_at: str = ""


def _build_exclusion_reason(consent) -> str | None:
    """同意・配信停止状態から除外理由を返す。除外不要なら None。"""
    if not hasattr(consent, "is_unsubscribed"):
        return "同意情報なし"
    if consent.is_unsubscribed:
        return "配信停止"
    if not consent.contact_line_allowed:
        return "LINE連絡同意なし"
    return None


def generate_targets(store, campaign) -> SegmentResult:
    """
    施策目的に基づき店舗顧客をセグメントし SegmentResult を返す。
    セグメント結果を CampaignTarget に保存する（既存レコードは削除して再生成）。
    """
    from apps.campaigns.models import CampaignTarget
    from apps.customers.models import Customer, CustomerConsent
    from apps.insights.models import CustomerInsight

    purpose = campaign.purpose
    target_states = _PURPOSE_TARGET_STATES.get(purpose, [])
    use_all_states = len(target_states) == 0

    # アクティブ・未削除の顧客を取得（select_related で N+1 防止）
    customers = (
        Customer.objects.filter(store=store, status="active", deleted_at__isnull=True)
        .prefetch_related("consent", "insights")
    )

    # 最新 insight を customer_id → state で引く（SQLite 互換: DISTINCT ON を使わず Python で集約）
    latest_insight_map: dict[uuid.UUID, str] = {}
    insights_qs = (
        CustomerInsight.objects.filter(store_id=store.id)
        .order_by("customer_id", "-insight_date")
        .values("customer_id", "customer_state")
    )
    for row in insights_qs:
        # 最初に出てくる行が最新（order_by -insight_date）
        if row["customer_id"] not in latest_insight_map:
            latest_insight_map[row["customer_id"]] = row["customer_state"]

    # 既存ターゲットを削除してから再生成
    CampaignTarget.objects.filter(campaign=campaign, store=store).delete()

    included: list[dict] = []
    excluded: list[dict] = []

    for customer in customers:
        customer_state = latest_insight_map.get(customer.id, None)

        # ---- 除外判定（最優先） ----
        try:
            consent = customer.consent
        except CustomerConsent.DoesNotExist:
            consent = None

        exclusion_reason: str | None
        if consent is None:
            exclusion_reason = "同意情報なし"
        else:
            exclusion_reason = _build_exclusion_reason(consent)

        # 状態不一致による除外（awareness/custom は状態不問）
        if exclusion_reason is None and not use_all_states:
            if customer_state not in target_states:
                exclusion_reason = f"対象状態外（{customer_state or '未判定'}）"

        if exclusion_reason:
            target = CampaignTarget.objects.create(
                campaign=campaign,
                store=store,
                customer=customer,
                target_reason=_target_reason_label(purpose, customer_state),
                excluded=True,
                exclusion_reason=exclusion_reason,
                delivery_status="not_sent",
            )
            excluded.append({"customer_id": str(customer.id), "exclusion_reason": exclusion_reason})
        else:
            target = CampaignTarget.objects.create(
                campaign=campaign,
                store=store,
                customer=customer,
                target_reason=_target_reason_label(purpose, customer_state),
                excluded=False,
                delivery_status="not_sent",
            )
            included.append({"customer_id": str(customer.id), "customer_state": customer_state})

    # target_count を Campaign に反映
    campaign.target_count = len(included)
    campaign.save(update_fields=["target_count"])

    return SegmentResult(
        included=included,
        excluded=excluded,
        total_candidates=len(included) + len(excluded),
        total_included=len(included),
        total_excluded=len(excluded),
        purpose=purpose,
        generated_at=timezone.now().isoformat(),
    )


def _target_reason_label(purpose: str, state: str | None) -> str:
    labels: dict[str, str] = {
        "dormant_reactivation": "休眠顧客への復帰アプローチ",
        "repeat":               "再来店促進対象",
        "first_followup":       "初回来店後フォロー対象",
        "upsell":               "アップセル提案対象",
        "new_customer":         "新規リード対象",
        "renewal":              "更新・回数券案内対象",
        "awareness":            "認知拡大対象",
        "custom":               "カスタム施策対象",
    }
    return labels.get(purpose, "施策対象")
