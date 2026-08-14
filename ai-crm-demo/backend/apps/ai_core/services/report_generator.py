"""
月次レポート生成サービス (Phase3)

AI_PROVIDER=mock のときはモック応答を返す。
AI_PROVIDER=anthropic のときは Anthropic API を呼び出す。
個人情報（氏名・電話・メール等）はこのサービスに渡さない。
集計値・統計値のみを入力とする。
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date

from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
あなたは、個人店・小規模店舗の月次経営レポートを作成するAIアシスタントです。

以下の原則を必ず守ってください。
1. 売上向上・集客向上を保証しない。
2. 法的判断・医療判断を代替しない。
3. 提案は根拠を明示し、断定的な表現を避ける。
4. データが不足している場合はその旨を記載する。
5. 次月アクションは具体的かつ実行可能な範囲で提案する。
"""

_USER_PROMPT_TEMPLATE = """\
以下の店舗データをもとに、{period_start}〜{period_end}の月次レポートを作成してください。

# 店舗情報
- 店舗名: {store_name}
- 業種: {industry}
- エリア: {area_label}

# 顧客状態サマリ
- 総顧客数: {total_customers}名
- 新規顧客: {new_customers}名
- アクティブ顧客: {active_customers}名
- 休眠顧客: {dormant_customers}名

# 売上サマリ
- 当月売上合計: {total_revenue}円
- 取引件数: {sales_count}件
- 平均客単価: {avg_revenue}円

# 施策サマリ
- 実施施策数: {campaign_count}件
- 総配信数: {total_sent}名
- 総来店転換数: {total_visits}名
- 施策経由売上合計: {campaign_revenue}円

# 出力形式（必ずこのJSONのみを返してください）
{{
  "title": "月次レポートのタイトル（40文字以内）",
  "summary": "月次総括（150文字以内）",
  "highlights": ["良かった点を1〜3件"],
  "issues": ["課題・懸念点を1〜3件"],
  "next_month_actions": ["次月アクション候補を2〜4件"],
  "body_markdown": "詳細レポート本文（Markdown形式、400文字以内）",
  "confidence": "high | medium | low"
}}
"""


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class ReportContent:
    title: str
    summary: str
    highlights: list[str]
    issues: list[str]
    next_month_actions: list[str]
    body_markdown: str
    confidence: str
    model_used: str
    input_tokens: int | None = None
    output_tokens: int | None = None


# ---------------------------------------------------------------------------
# Input context dataclass
# ---------------------------------------------------------------------------


@dataclass
class MonthlyReportContext:
    store_name: str
    industry: str
    area_label: str
    period_start: date
    period_end: date
    total_customers: int = 0
    new_customers: int = 0
    active_customers: int = 0
    dormant_customers: int = 0
    total_revenue: int = 0
    sales_count: int = 0
    avg_revenue: int = 0
    campaign_count: int = 0
    total_sent: int = 0
    total_visits: int = 0
    campaign_revenue: int = 0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_monthly_report(ctx: MonthlyReportContext) -> ReportContent:
    """
    月次レポートを生成して返す。
    AI呼び出しに失敗した場合は RuntimeError を raise する。
    """
    user_message = _USER_PROMPT_TEMPLATE.format(
        store_name=ctx.store_name,
        industry=ctx.industry,
        area_label=ctx.area_label,
        period_start=ctx.period_start.strftime("%Y年%m月%d日"),
        period_end=ctx.period_end.strftime("%Y年%m月%d日"),
        total_customers=ctx.total_customers,
        new_customers=ctx.new_customers,
        active_customers=ctx.active_customers,
        dormant_customers=ctx.dormant_customers,
        total_revenue=ctx.total_revenue,
        sales_count=ctx.sales_count,
        avg_revenue=ctx.avg_revenue,
        campaign_count=ctx.campaign_count,
        total_sent=ctx.total_sent,
        total_visits=ctx.total_visits,
        campaign_revenue=ctx.campaign_revenue,
    )

    provider = getattr(settings, "AI_PROVIDER", "mock")

    if provider == "mock":
        return _mock_result(ctx)

    if provider == "anthropic":
        return _call_anthropic(_SYSTEM_PROMPT, user_message)

    raise RuntimeError(f"未対応の AI_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mock_result(ctx: MonthlyReportContext) -> ReportContent:
    period = f"{ctx.period_start.strftime('%Y年%m月')}"
    return ReportContent(
        title=f"{period}月次レポート（{ctx.store_name}）",
        summary=(
            f"{period}は売上{ctx.total_revenue:,}円、新規{ctx.new_customers}名を獲得しました。"
            "施策の来店転換率に改善の余地があります（モック）。"
        ),
        highlights=[
            f"新規顧客{ctx.new_customers}名を獲得した",
            "施策配信への反応率が前月より改善傾向",
        ],
        issues=[
            "休眠顧客の復帰率が低い状況が続いている",
            "施策から予約への転換率に課題がある",
        ],
        next_month_actions=[
            "休眠顧客向け復帰施策を1件実施する",
            "来店後フォローLINEの文案を見直す",
            "新規顧客の2回目来店促進を強化する",
            "施策結果の振り返りを月末に実施する",
        ],
        body_markdown=(
            f"## {period} 月次レポート\n\n"
            "### 顧客状態\n"
            f"- 総顧客数: {ctx.total_customers}名 / アクティブ: {ctx.active_customers}名 / 休眠: {ctx.dormant_customers}名\n\n"
            "### 売上\n"
            f"- 当月売上: {ctx.total_revenue:,}円 / 件数: {ctx.sales_count}件 / 平均客単価: {ctx.avg_revenue:,}円\n\n"
            "### 施策\n"
            f"- 実施施策: {ctx.campaign_count}件 / 配信数: {ctx.total_sent}名 / 来店転換: {ctx.total_visits}名\n\n"
            "> このレポートはモックデータによる生成です。実際のデータに基づいて内容を確認してください。"
        ),
        confidence="medium",
        model_used="mock",
    )


def _call_anthropic(system_prompt: str, user_message: str) -> ReportContent:
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
            max_tokens=1536,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as exc:
        logger.error("Anthropic API error in report_generator: %s", exc)
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

    return ReportContent(
        title=data.get("title", "月次レポート"),
        summary=data.get("summary", ""),
        highlights=data.get("highlights", []),
        issues=data.get("issues", []),
        next_month_actions=data.get("next_month_actions", []),
        body_markdown=data.get("body_markdown", ""),
        confidence=data.get("confidence", "low"),
        model_used=model,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
