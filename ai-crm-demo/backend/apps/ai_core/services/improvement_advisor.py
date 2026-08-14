"""
施策改善AI提案サービス (AI-07)

AI_PROVIDER=mock のときはモック応答を返す。
AI_PROVIDER=anthropic のときは Anthropic API を呼び出す。
顧客個人情報はこのサービスに渡さない（施策・結果レベルの集計値のみ）。
失敗しても業務データを壊さない。
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
あなたは、個人店・小規模店舗のマーケティング改善を支援するAIアドバイザーです。

以下の原則を必ず守ってください。
1. 売上向上・集客向上を保証しない。
2. 法的判断・医療判断を代替しない。
3. 美容・整体・健康領域では、治療・改善・痩身・美容効果を保証する表現を避ける。
4. 提案には根拠・信頼度・注意点を必ず含める。
5. 顧客向け文案は人間承認が必要であることを明示する。
6. データが少ない場合は信頼度を low と返す。
"""

_USER_PROMPT_TEMPLATE = """\
以下の施策と結果をもとに、次回改善案を提案してください。

# 施策情報
- 施策名: {campaign_name}
- 目的: {purpose_label}
- チャネル: {channel_label}
- 対象者数: {target_count}名

# 実施結果
- 配信数（送信数）: {sent_count}
- 返信数: {reply_count}
- クリック数: {click_count}
- 予約数: {reservation_count}
- 来店数: {visit_count}
- 売上: {revenue_amount}円
- 担当者所感: {memo}

# 出力形式（必ずこのJSONのみを返してください）
{{
  "summary": "結果の要約（100文字以内）",
  "good_points": ["良かった点を1〜3件"],
  "issues": ["課題・仮説を1〜3件"],
  "improvements": ["次回改善案を1〜3件"],
  "next_target_hint": "次回対象者の条件見直し案（50文字以内）",
  "next_copy_hint": "次回文案の改善方向性（50文字以内）",
  "confidence": "high | medium | low",
  "cautions": ["注意点を1〜2件"]
}}
"""

_PURPOSE_LABELS: dict[str, str] = {
    "dormant_reactivation": "休眠顧客の復帰促進",
    "repeat":               "再来店促進",
    "first_followup":       "初回来店後フォロー",
    "upsell":               "アップセル・追加提案",
    "new_customer":         "新規顧客獲得",
    "renewal":              "更新・回数券案内",
    "awareness":            "認知拡大",
    "custom":               "カスタム施策",
}

_CHANNEL_LABELS: dict[str, str] = {
    "official_line":   "公式LINE",
    "instagram":       "Instagram",
    "google_business": "Googleビジネスプロフィール",
    "email":           "メール",
    "sms":             "SMS",
    "in_store":        "店頭",
    "phone":           "電話",
    "flyer":           "チラシ",
}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class ImprovementResult:
    summary: str
    good_points: list[str]
    issues: list[str]
    improvements: list[str]
    next_target_hint: str
    next_copy_hint: str
    confidence: str
    cautions: list[str]
    model_used: str
    input_tokens: int | None = None
    output_tokens: int | None = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def advise_improvement(campaign, result) -> ImprovementResult:
    """
    施策・結果データから改善提案を生成して返す。
    AI呼び出しに失敗した場合は RuntimeError を raise する（呼び出し側でハンドルすること）。
    resultはCampaignResultオブジェクト。
    """
    user_message = _USER_PROMPT_TEMPLATE.format(
        campaign_name=campaign.name,
        purpose_label=_PURPOSE_LABELS.get(campaign.purpose, campaign.purpose),
        channel_label=_CHANNEL_LABELS.get(campaign.channel, campaign.channel),
        target_count=campaign.target_count or 0,
        sent_count=result.sent_count if result.sent_count is not None else "データなし",
        reply_count=result.reply_count if result.reply_count is not None else "データなし",
        click_count=result.click_count if result.click_count is not None else "データなし",
        reservation_count=result.reservation_count if result.reservation_count is not None else "データなし",
        visit_count=result.visit_count if result.visit_count is not None else "データなし",
        revenue_amount=int(result.revenue_amount) if result.revenue_amount is not None else "データなし",
        memo=result.memo or "なし",
    )

    provider = getattr(settings, "AI_PROVIDER", "mock")

    if provider == "mock":
        return _mock_result()

    if provider == "anthropic":
        return _call_anthropic(_SYSTEM_PROMPT, user_message)

    raise RuntimeError(f"未対応の AI_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mock_result() -> ImprovementResult:
    return ImprovementResult(
        summary="配信数に対し返信率は高い結果でしたが、予約転換が低い状況です（モック）。",
        good_points=[
            "返信率が施策平均より高く、メッセージの関心度は高い",
            "来店単価が前回より改善している",
        ],
        issues=[
            "返信から予約への導線が弱い可能性がある",
            "空き枠・所要時間の情報が不足している可能性がある",
        ],
        improvements=[
            "予約ページへのリンクまたは返信方法を明確に記載する",
            "空き枠候補を2〜3件文中に入れる",
            "来店理由（悩みに合わせた理由）を冒頭に入れる",
        ],
        next_target_hint="前回来店から90日以上経過かつ過去来店あり顧客を中心に絞る",
        next_copy_hint="予約リンクを冒頭近くに配置し、所要時間・空き枠を明記する",
        confidence="medium",
        cautions=[
            "このデータはモックです。実際の施策データに基づいて改善案を検討してください。",
            "提案は参考情報です。最終判断は必ず担当者が行ってください。",
        ],
        model_used="mock",
    )


def _call_anthropic(system_prompt: str, user_message: str) -> ImprovementResult:
    try:
        import anthropic  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError("anthropic パッケージがインストールされていません") from exc

    api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY が設定されていません")

    model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as exc:
        logger.error("Anthropic API error in improvement_advisor: %s", exc)
        raise RuntimeError(f"Anthropic API呼び出しに失敗しました: {exc}") from exc

    raw = message.content[0].text.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            raise RuntimeError(f"AI応答のJSONパースに失敗しました: {raw[:200]}")
        data = json.loads(m.group())

    return ImprovementResult(
        summary=data.get("summary", ""),
        good_points=data.get("good_points", []),
        issues=data.get("issues", []),
        improvements=data.get("improvements", []),
        next_target_hint=data.get("next_target_hint", ""),
        next_copy_hint=data.get("next_copy_hint", ""),
        confidence=data.get("confidence", "low"),
        cautions=data.get("cautions", []),
        model_used=model,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
