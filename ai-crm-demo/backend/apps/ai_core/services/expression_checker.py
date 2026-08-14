"""
広告表現チェックサービス (AI-10 / P2-005)

AI_PROVIDER=mock のときはモック応答を返す。
AI_PROVIDER=anthropic のときは Anthropic API を呼び出す。
本文テキストは外部に送出するが、氏名・電話・メール等の個人情報を渡さないこと（呼び出し元の責務）。
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ルールベース禁止語句辞書
# ---------------------------------------------------------------------------

_RULE_CHECKS: list[tuple[str, str, int, str, str]] = [
    # (pattern, category, score, reason, suggestion)
    (
        r"必ず(?:痩せ|細く|変わ|改善|効果)",
        "effect_guarantee",
        35,
        "効果を保証する表現です",
        "目標に合わせてサポートします",
    ),
    (
        r"絶対に(?:痩せ|変わ|改善|治|効果)",
        "effect_guarantee",
        35,
        "効果を保証する表現です",
        "状態に合わせてケアします",
    ),
    (
        r"確実に(?:痩せ|変わ|改善|治|効果)",
        "effect_guarantee",
        35,
        "効果を確約する表現です",
        "変化の感じ方には個人差があります",
    ),
    (
        r"(?:治る|完治|治療効果|疾病.*治|治癒)",
        "medical",
        45,
        "医療的効果を断定する表現です（薬機法・医療法に抵触する恐れがあります）",
        "ケアをサポートします（症状が強い場合は医療機関にご相談ください）",
    ),
    (
        r"(?:シミが消え|たるみが治|セルライトが消え|脂肪が消え)",
        "cosmetic",
        40,
        "美容効果を断定する表現です",
        "ハリ感・すっきり感を目指すケアです",
    ),
    (
        r"(?:痩せる保証|痩身保証|-\d+kg保証|\d+kg.*保証)",
        "cosmetic",
        45,
        "痩身効果の保証表現です",
        "目標体型に向けてサポートします（成果には個人差があります）",
    ),
    (
        r"(?:永久に効果|半永久的|一生(?:効果|続く))",
        "cosmetic",
        30,
        "効果の永続性を断定する表現です",
        "継続的なケアで良い状態を保ちます",
    ),
    (
        r"(?:医療レベル|病院級|クリニック品質)",
        "medical",
        35,
        "医療行為と混同させる恐れのある表現です",
        "プロによる丁寧なケアを提供します",
    ),
    (
        r"(?:地域No\.?1|業界最高|日本一|全国1位|業界No\.?1)(?!.*[調査|比較|統計])",
        "superiority",
        25,
        "根拠のない優位性を示す表現です（景品表示法に抵触する恐れがあります）",
        "地域で長く愛されるサービスを目指しています",
    ),
    (
        r"(?:今だけ無料|本日限り無料|残りわずか)(?!.*[条件|対象|詳細])",
        "pricing",
        20,
        "条件が不明確な限定表現です（景品表示法に抵触する恐れがあります）",
        "期間・対象・条件を明記してください",
    ),
    (
        r"(?:放置すると危険|そのままでは大変|手遅れになる)",
        "fear",
        20,
        "過度な不安訴求の表現です",
        "気になる方はお気軽にご相談ください",
    ),
]

# スコア → risk_level のマッピング
def _score_to_level(score: int) -> str:
    if score >= 100:
        return "review_required"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    if score >= 20:
        return "low"
    return "none"


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ExpressionIssue:
    text: str
    category: str
    reason: str
    severity: str
    suggestion: str


@dataclass
class ExpressionCheckResult:
    risk_level: str
    risk_score: int
    issues: list[ExpressionIssue]
    overall_comment: str
    requires_human_approval: bool
    model_used: str
    input_tokens: int | None = None
    output_tokens: int | None = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_INDUSTRY_LABELS: dict[str, str] = {
    "esthetic":  "エステ・美容",
    "bodycare":  "整体・カイロプラクティック",
    "gym":       "フィットネス・ジム",
    "hair":      "ヘアサロン",
    "nail":      "ネイルサロン",
    "other":     "その他サービス業",
}

_CONTENT_TYPE_LABELS: dict[str, str] = {
    "line":             "公式LINE配信文",
    "instagram":        "Instagram投稿",
    "google_business":  "Googleビジネスプロフィール投稿",
    "email":            "メール",
    "sms":              "SMS",
    "pop":              "店頭POP",
    "flyer":            "チラシ",
}


def check_expression(body: str, industry: str, content_type: str) -> ExpressionCheckResult:
    """
    文案テキストの広告表現リスクを検出して返す。
    AI呼び出しに失敗した場合は RuntimeError を raise する（呼び出し元でハンドルすること）。
    個人情報（氏名・電話・メール等）を body に含めないこと。
    """
    provider = getattr(settings, "AI_PROVIDER", "mock")

    if provider == "mock":
        return _mock_result()

    if provider == "anthropic":
        return _check_with_anthropic(body, industry, content_type)

    raise RuntimeError(f"未対応の AI_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mock_result() -> ExpressionCheckResult:
    return ExpressionCheckResult(
        risk_level="none",
        risk_score=0,
        issues=[],
        overall_comment="表現に大きな問題は検出されませんでした（モック）。配信前に必ず内容を確認してください。",
        requires_human_approval=True,
        model_used="mock",
    )


_SYSTEM_PROMPT = """\
あなたは日本の広告表現コンプライアンス専門家です。
エステ・美容・整体・フィットネスなどの業種における広告表現リスクを検出してください。

## 検出すべきリスクカテゴリ
- effect_guarantee: 効果保証（「必ず」「絶対に」「確実に」＋効果表現）
- medical: 医療的断定（「治る」「完治」「疾病治癒」「医療レベル」）
- cosmetic: 美容・痩身断定（「シミが消える」「痩せる保証」「永久効果」）
- superiority: 根拠なし優位（「地域No.1」「業界最高」等、根拠なし）
- pricing: 景品表示法リスク（条件不明な「今だけ無料」「残りわずか」等）
- fear: 過度な不安訴求（「放置すると危険」等）
- personal_info: 個人情報・ステマリスク

## 重要な注意
- 広告表現チェックは法的適合性を保証しない
- リスクが検出されなければ issues は空配列にする
- 修正案（suggestion）は必ず安全な代替表現を日本語で提示する
- overall_comment は100文字以内の日本語で書く

## 出力形式（このJSONのみを返すこと）
{
  "risk_score": 0から100以上の整数,
  "issues": [
    {
      "text": "問題箇所の文字列（原文から引用）",
      "category": "カテゴリ名",
      "reason": "判定理由（日本語、50文字以内）",
      "severity": "high | medium | low",
      "suggestion": "修正案（日本語、60文字以内）"
    }
  ],
  "overall_comment": "全体コメント（100文字以内）"
}
"""


def _build_user_message(body: str, industry: str, content_type: str) -> str:
    industry_label = _INDUSTRY_LABELS.get(industry, industry)
    content_type_label = _CONTENT_TYPE_LABELS.get(content_type, content_type)
    return (
        f"# 業種\n{industry_label}\n\n"
        f"# 媒体\n{content_type_label}\n\n"
        f"# チェック対象テキスト\n{body}"
    )


def _check_with_anthropic(body: str, industry: str, content_type: str) -> ExpressionCheckResult:
    try:
        import anthropic  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "anthropic パッケージがインストールされていません。pip install anthropic を実行してください。"
        ) from exc

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY が設定されていません。")

    model = getattr(settings, "ANTHROPIC_MODEL", "claude-sonnet-4-6")
    client = anthropic.Anthropic(api_key=api_key)

    user_message = _build_user_message(body, industry, content_type)

    message = client.messages.create(
        model=model,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"AI応答のJSONパースに失敗しました: {exc}\n応答: {raw[:200]}"
        ) from exc

    risk_score = int(parsed.get("risk_score", 0))
    raw_issues = parsed.get("issues", [])
    issues = [
        ExpressionIssue(
            text=item.get("text", ""),
            category=item.get("category", ""),
            reason=item.get("reason", ""),
            severity=item.get("severity", "low"),
            suggestion=item.get("suggestion", ""),
        )
        for item in raw_issues
        if isinstance(item, dict)
    ]
    risk_level = _score_to_level(risk_score)

    return ExpressionCheckResult(
        risk_level=risk_level,
        risk_score=risk_score,
        issues=issues,
        overall_comment=parsed.get("overall_comment", ""),
        requires_human_approval=risk_level != "none",
        model_used=model,
        input_tokens=message.usage.input_tokens if message.usage else None,
        output_tokens=message.usage.output_tokens if message.usage else None,
    )
