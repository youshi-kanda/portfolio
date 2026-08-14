"""
発信文案生成サービス (AI-06)

AI_PROVIDER=mock のときはモック応答を返す。
AI_PROVIDER=anthropic のときは Anthropic API を呼び出す。
失敗しても業務データ（CampaignContent）を壊さない。
顧客個人情報はこのサービスに渡さない（店舗・施策レベルの情報のみ）。
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates (fallback — DB の AIPromptTemplate が優先)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
あなたは、個人店・小規模店舗向けのAIマーケティング支援担当です。

以下の原則を必ず守ってください。
1. 売上向上を保証しない。
2. 法的判断・医療判断を代替しない。
3. 顧客向け文案では、効果を断定しない。
4. 美容・整体・健康領域では、治療・改善・痩身・美容効果を保証する表現を避ける。
5. 提案には、根拠・信頼度・注意点を必ず含める。
6. 外部発信は人間承認が必要であることを明示する。
7. 「必ず」「絶対」「確実」「治る」「痩せる」「消える」などの保証表現を避ける。
"""

_USER_PROMPT_TEMPLATE = """\
以下の施策情報をもとに、{channel_label}配信用の文案を作成してください。

# 業種
{industry}

# 施策目的
{purpose_label}

# 対象顧客セグメント
{target_segment}

# 対象者数（参考）
{target_count}名

# 店舗名
{store_name}

# エリア
{area_label}

# トーン
{tone}

# 出力形式（必ずこのJSONのみを返してください）
{{
  "title": "件名または見出し（30文字以内）",
  "body": "本文（200文字以内、改行可）",
  "cta": "行動喚起文（20文字以内）",
  "reasoning": "この文案を選んだ理由（50文字以内）",
  "confidence": "high | medium | low",
  "cautions": ["注意点を1〜3件"],
  "expression_risk_level": "none | low | medium | high",
  "human_review_required": true
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

_TONE_LABELS: dict[str, str] = {
    "warm":         "親しみやすく温かいトーン",
    "professional": "丁寧でプロフェッショナルなトーン",
    "casual":       "カジュアルで気軽なトーン",
    "urgent":       "期限や緊急感を意識したトーン",
}

_INDUSTRY_COPY_GUIDES: dict[str, str] = {
    "esthetic": "美容効果を断定せず、リラックス・気分転換・定期ケアの提案として表現してください。",
    "bodycare": "治療や改善を断定せず、疲れのケア・日常メンテナンスの提案として表現してください。",
    "gym": "痩身や成果を保証せず、運動習慣・体調管理・継続サポートの提案として表現してください。",
    "nail": "仕上がり保証を避け、季節感・気分転換・身だしなみの提案として表現してください。",
    "hair": "髪質改善などの断定を避け、印象づくり・メンテナンスの提案として表現してください。",
    "other": "業種固有の効能や成果を断定せず、来店しやすい案内として表現してください。",
}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class GenerationResult:
    title: str
    body: str
    cta: str
    reasoning: str
    confidence: str
    cautions: list[str]
    expression_risk_level: str
    template_name: str
    template_version: int
    model_used: str
    input_tokens: int | None
    output_tokens: int | None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_copy(campaign, store, tone: str = "warm") -> GenerationResult:
    """
    施策・店舗情報から発信文案を生成して返す。
    AI呼び出しに失敗した場合は RuntimeError を raise する（呼び出し側でハンドルすること）。
    """
    template_name, template_version, system_prompt, user_prompt = _load_template(
        campaign.purpose, campaign.channel
    )
    template_name, user_prompt = _apply_industry_builtin_template(
        template_name,
        user_prompt,
        getattr(store, "industry", "other"),
    )

    user_message = user_prompt.format(
        industry=getattr(store, "industry", "サービス業"),
        purpose_label=_PURPOSE_LABELS.get(campaign.purpose, campaign.purpose),
        target_segment=_PURPOSE_LABELS.get(campaign.purpose, "全顧客"),
        target_count=campaign.target_count or 0,
        store_name=store.name,
        area_label=getattr(store, "area_label", ""),
        channel_label=_CHANNEL_LABELS.get(campaign.channel, campaign.channel),
        tone=_TONE_LABELS.get(tone, tone),
    )

    provider = getattr(settings, "AI_PROVIDER", "mock")

    if provider == "mock":
        return _mock_result(template_name, template_version)

    if provider == "anthropic":
        return _call_anthropic(system_prompt, user_message, template_name, template_version)

    raise RuntimeError(f"未対応の AI_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_template(purpose: str, channel: str):
    """DB の AIPromptTemplate を探し、なければコード内フォールバックを使う。"""
    from apps.ai_core.models import AIPromptTemplate

    tmpl = (
        AIPromptTemplate.objects.filter(purpose=purpose, channel=channel, is_active=True)
        .order_by("-version")
        .first()
    ) or (
        AIPromptTemplate.objects.filter(purpose="all", channel="all", is_active=True)
        .order_by("-version")
        .first()
    )

    if tmpl:
        return tmpl.name, tmpl.version, tmpl.system_prompt, tmpl.user_prompt_template

    return "builtin_line_copy", 1, _SYSTEM_PROMPT, _USER_PROMPT_TEMPLATE


def _apply_industry_builtin_template(template_name: str, user_prompt: str, industry: str) -> tuple[str, str]:
    """DBテンプレート未設定時だけ、業種別の安全ガイドを追加する。"""
    if not template_name.startswith("builtin_"):
        return template_name, user_prompt

    guide = _INDUSTRY_COPY_GUIDES.get(industry, _INDUSTRY_COPY_GUIDES["other"])
    industry_prompt = (
        user_prompt
        + "\n# 業種別表現ガイド\n"
        + guide
        + "\n"
    )
    return f"{template_name}_{industry}", industry_prompt


def _mock_result(template_name: str, template_version: int) -> GenerationResult:
    return GenerationResult(
        title="いつもありがとうございます",
        body=(
            "こんにちは。\n"
            "いつもご利用いただきありがとうございます。\n"
            "最近少しお疲れではないですか？\n"
            "ご都合のよい日にぜひお気軽にお越しください。\n"
            "スタッフ一同、お待ちしております。"
        ),
        cta="ご予約・ご相談はこちら",
        reasoning="休眠顧客への親しみやすいアプローチ文（モック）",
        confidence="medium",
        cautions=[
            "この文案はモックです。実際の配信前に必ず内容を確認・修正してください。",
            "顧客向け配信には必ず人間承認を行ってください。",
        ],
        expression_risk_level="none",
        template_name=template_name,
        template_version=template_version,
        model_used="mock",
        input_tokens=None,
        output_tokens=None,
    )


def _call_anthropic(
    system_prompt: str,
    user_message: str,
    template_name: str,
    template_version: int,
) -> GenerationResult:
    try:
        import anthropic  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError("anthropic パッケージがインストールされていません。pip install anthropic を実行してください。") from exc

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY が設定されていません。")

    model = getattr(settings, "ANTHROPIC_MODEL", "claude-sonnet-4-6")
    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    # JSON ブロックを抽出（```json ... ``` で囲まれている場合も対応）
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"AI応答のJSONパースに失敗しました: {exc}\n応答: {raw[:200]}") from exc

    return GenerationResult(
        title=parsed.get("title", ""),
        body=parsed.get("body", ""),
        cta=parsed.get("cta", ""),
        reasoning=parsed.get("reasoning", ""),
        confidence=parsed.get("confidence", "medium"),
        cautions=parsed.get("cautions", []),
        expression_risk_level=_normalize_expression_risk_level(
            parsed.get("expression_risk_level", "medium")
        ),
        template_name=template_name,
        template_version=template_version,
        model_used=model,
        input_tokens=message.usage.input_tokens if message.usage else None,
        output_tokens=message.usage.output_tokens if message.usage else None,
    )


def _normalize_expression_risk_level(value: str | None) -> str:
    mapping = {
        "safe": "none",
        "caution": "medium",
        "high_risk": "high",
    }
    canonical = {"none", "low", "medium", "high"}
    normalized = mapping.get(value or "", value)
    return normalized if normalized in canonical else "medium"
