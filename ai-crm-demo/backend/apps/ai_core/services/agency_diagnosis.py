"""代理店診断サービス。

店舗の顧客状態・ツール利用状況をルールベースで分析し、
課題・強み・総合スコアを返す。AI_PROVIDER=anthropic の場合は
Anthropic API を使って総合コメントを生成する。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class DiagnosisIssue:
    category: str
    severity: str       # "high" | "medium" | "low"
    title: str
    detail: str
    recommendation: str


@dataclass
class DiagnosisStrength:
    category: str
    title: str
    detail: str


@dataclass
class StoreOverview:
    total_customers: int
    active_customers: int
    dormant_customers: int
    at_risk_customers: int
    active_rate: float          # 0.0 – 1.0
    line_consent_rate: float    # 0.0 – 1.0
    unsubscribe_rate: float     # 0.0 – 1.0


@dataclass
class AgencyDiagnosisResult:
    overview: StoreOverview
    issues: list[DiagnosisIssue]
    strengths: list[DiagnosisStrength]
    tool_notes: list[str]
    overall_score: int          # 0 – 100
    overall_comment: str
    confidence: str             # "high" | "medium" | "low"
    requires_human_review: bool
    model_used: str
    input_tokens: int | None = None
    output_tokens: int | None = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _run_rule_based(
    overview: StoreOverview,
    tool_types: list[str],
) -> tuple[list[DiagnosisIssue], list[DiagnosisStrength], list[str], int]:
    """ルールベースで課題・強み・ツールメモ・スコアを計算する。"""
    issues: list[DiagnosisIssue] = []
    strengths: list[DiagnosisStrength] = []
    tool_notes: list[str] = []
    score = 100

    # --- 顧客数 ---
    if overview.total_customers == 0:
        issues.append(DiagnosisIssue(
            category="no_customers",
            severity="high",
            title="顧客データが未登録",
            detail="顧客データが1件も登録されていません。",
            recommendation="顧客CSVをインポートするか、手動で顧客を登録してください。",
        ))
        score -= 40
    else:
        # --- アクティブ率 ---
        if overview.active_rate >= 0.70:
            strengths.append(DiagnosisStrength(
                category="active_rate",
                title="アクティブ顧客比率が高い",
                detail=f"顧客の{overview.active_rate * 100:.0f}%がアクティブ状態です。",
            ))
        elif overview.active_rate < 0.50:
            issues.append(DiagnosisIssue(
                category="low_active_rate",
                severity="high",
                title="アクティブ顧客比率が低い",
                detail=f"顧客の{overview.active_rate * 100:.0f}%しかアクティブ状態ではありません。",
                recommendation="休眠・リスク顧客への再来店施策を優先的に検討してください。",
            ))
            score -= 20
        else:
            issues.append(DiagnosisIssue(
                category="low_active_rate",
                severity="medium",
                title="アクティブ顧客比率がやや低い",
                detail=f"顧客の{overview.active_rate * 100:.0f}%がアクティブ状態です（目安: 70%以上）。",
                recommendation="定期来店を促す施策の強化を検討してください。",
            ))
            score -= 10

        # --- 休眠顧客 ---
        if overview.total_customers > 0:
            dormant_rate = overview.dormant_customers / overview.total_customers
            if dormant_rate >= 0.30:
                issues.append(DiagnosisIssue(
                    category="dormant_customers",
                    severity="high",
                    title="休眠顧客が多い",
                    detail=f"全顧客の{dormant_rate * 100:.0f}%が休眠状態です。",
                    recommendation="休眠復帰キャンペーンの実施を検討してください。クーポンや限定オファーが有効です。",
                ))
                score -= 15
            elif dormant_rate >= 0.15:
                issues.append(DiagnosisIssue(
                    category="dormant_customers",
                    severity="medium",
                    title="休眠顧客への対応が必要",
                    detail=f"全顧客の{dormant_rate * 100:.0f}%が休眠状態です。",
                    recommendation="定期的な休眠復帰メッセージを検討してください。",
                ))
                score -= 8

        # --- LINE同意率 ---
        if overview.line_consent_rate >= 0.60:
            strengths.append(DiagnosisStrength(
                category="line_consent",
                title="LINE同意率が高い",
                detail=f"顧客の{overview.line_consent_rate * 100:.0f}%がLINE配信に同意しています。",
            ))
        elif overview.line_consent_rate < 0.30:
            issues.append(DiagnosisIssue(
                category="low_line_consent",
                severity="high",
                title="LINE同意率が低い",
                detail=f"LINE配信に同意している顧客が{overview.line_consent_rate * 100:.0f}%と少ない状態です。",
                recommendation="来店時や予約確認時にLINE友だち追加・同意取得を促す仕組みを整えてください。",
            ))
            score -= 15
        elif overview.line_consent_rate < 0.60:
            issues.append(DiagnosisIssue(
                category="low_line_consent",
                severity="medium",
                title="LINE同意率を改善できます",
                detail=f"LINE配信同意率は{overview.line_consent_rate * 100:.0f}%です（目安: 60%以上）。",
                recommendation="LINE友だち追加を促すPOP・QRコードの設置を検討してください。",
            ))
            score -= 8

        # --- 配信停止率 ---
        if overview.unsubscribe_rate >= 0.10:
            issues.append(DiagnosisIssue(
                category="high_unsubscribe",
                severity="medium",
                title="配信停止率が高い",
                detail=f"配信停止率が{overview.unsubscribe_rate * 100:.0f}%です。",
                recommendation="メッセージの頻度・内容を見直し、顧客にとって価値ある情報の発信を心がけてください。",
            ))
            score -= 8

    # --- ツール診断 ---
    has_line = "official_line" in tool_types
    has_lstep = "lstep" in tool_types
    has_lmessage = "lmessage" in tool_types
    has_instagram = "instagram" in tool_types
    has_google = "google_business" in tool_types

    if has_line:
        tool_notes.append("LINE公式アカウントが登録済みです。")
    else:
        tool_notes.append("LINE公式アカウントが未登録です。顧客との接点強化のために導入を検討してください。")
        issues.append(DiagnosisIssue(
            category="no_line_official",
            severity="medium",
            title="LINE公式アカウントが未設定",
            detail="LINE公式アカウントが登録されていません。",
            recommendation="LINE公式アカウントを開設し、顧客との継続的な関係構築を始めましょう。",
        ))
        score -= 10

    if has_lstep:
        tool_notes.append("Lステップが登録済みです。自動配信の活用を確認してください。")
        strengths.append(DiagnosisStrength(
            category="lstep",
            title="Lステップ導入済み",
            detail="Lステップにより自動配信・ステップ配信が可能な環境です。",
        ))
    elif has_line:
        tool_notes.append("Lステップ未導入のため、LINE配信の自動化余地があります。")

    if has_lmessage:
        tool_notes.append("Lメッセージが登録済みです。")

    if not has_instagram and not has_google:
        tool_notes.append("Instagram・Googleビジネスプロフィールの活用でさらなる集客効果が見込めます。")
    elif has_instagram:
        tool_notes.append("Instagramが登録済みです。")
    if has_google:
        tool_notes.append("Googleビジネスプロフィールが登録済みです。")

    score = max(0, min(100, score))
    return issues, strengths, tool_notes, score


def _build_comment(overview: StoreOverview, issues: list[DiagnosisIssue], score: int) -> str:
    high_issues = [i for i in issues if i.severity == "high"]
    if score >= 80:
        base = "店舗の顧客管理は良好な状態です。"
    elif score >= 60:
        base = "顧客管理は概ね安定していますが、いくつかの改善点があります。"
    else:
        base = "優先的に取り組むべき課題が複数あります。"

    if high_issues:
        titles = "・".join(i.title for i in high_issues[:2])
        return f"{base} 特に「{titles}」への対応が重要です。"
    return base


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_agency_diagnosis(
    store,
    customer_stats: dict,
    tool_types: list[str],
) -> AgencyDiagnosisResult:
    """
    店舗の集計統計からルールベース診断を実行する。

    customer_stats は以下のキーを期待する:
      total, active, dormant, at_risk,
      line_consent, unsubscribed
    """
    total      = customer_stats.get("total", 0)
    active     = customer_stats.get("active", 0)
    dormant    = customer_stats.get("dormant", 0)
    at_risk    = customer_stats.get("at_risk", 0)
    consented  = customer_stats.get("line_consent", 0)
    unsub      = customer_stats.get("unsubscribed", 0)

    overview = StoreOverview(
        total_customers=total,
        active_customers=active,
        dormant_customers=dormant,
        at_risk_customers=at_risk,
        active_rate=_ratio(active, total),
        line_consent_rate=_ratio(consented, total),
        unsubscribe_rate=_ratio(unsub, total),
    )

    ai_provider = os.getenv("AI_PROVIDER", "mock")

    issues, strengths, tool_notes, score = _run_rule_based(overview, tool_types)
    comment = _build_comment(overview, issues, score)

    if ai_provider == "anthropic" and total > 0:
        # Anthropic による総合コメント補強（フォールバック: ルールベースコメントを維持）
        try:
            comment = _enhance_comment_with_ai(overview, issues, strengths, score, store)
        except Exception:
            pass  # AI 失敗時はルールベースコメントをそのまま使用

    return AgencyDiagnosisResult(
        overview=overview,
        issues=issues,
        strengths=strengths,
        tool_notes=tool_notes,
        overall_score=score,
        overall_comment=comment,
        confidence="medium" if total > 0 else "low",
        requires_human_review=True,
        model_used="mock" if ai_provider != "anthropic" else "claude-sonnet-4-6",
    )


def _enhance_comment_with_ai(
    overview: StoreOverview,
    issues: list[DiagnosisIssue],
    strengths: list[DiagnosisStrength],
    score: int,
    store,
) -> str:
    """Anthropic API を使って総合診断コメントを生成する。"""
    import anthropic

    client = anthropic.Anthropic()

    issue_text = "\n".join(f"- [{i.severity}] {i.title}: {i.detail}" for i in issues) or "なし"
    strength_text = "\n".join(f"- {s.title}: {s.detail}" for s in strengths) or "なし"

    prompt = f"""以下は店舗の顧客状態分析結果です。店舗オーナーに向けた総合診断コメントを3文以内で作成してください。
効果断定・医療・法的表現は使わないでください。

総合スコア: {score}/100
顧客数: {overview.total_customers}名（アクティブ率: {overview.active_rate * 100:.0f}%）
LINE同意率: {overview.line_consent_rate * 100:.0f}%

課題:
{issue_text}

強み:
{strength_text}

診断コメント:"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
