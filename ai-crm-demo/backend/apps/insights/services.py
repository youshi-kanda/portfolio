from datetime import date

from apps.reservations.models import Reservation

_VIP_SALES_THRESHOLD    = 100_000
_VIP_VISIT_THRESHOLD    = 10
_DEFAULT_DORMANT_DAYS     = 90
_DEFAULT_PRE_DORMANT_DAYS = 60
_CUSTOMER_MESSAGE_CAUTIONS = [
    "同意状態と配信停止状態を確認してください。",
    "顧客向け文案は人間確認を行ってください。",
    "LINE自動配信は行わず、手動確認を前提にしてください。",
]


def calculate_customer_state(customer, store_settings) -> dict:
    """
    顧客のプロフィールと予約履歴から customer_state を判定して返す。
    個人情報（氏名・電話番号等）は evidence_summary に含めない。
    """
    from apps.customers.models import CustomerProfile

    try:
        profile = customer.profile
    except CustomerProfile.DoesNotExist:
        profile = None

    last_visit_date = profile.last_visit_date if profile else None
    visit_count     = (profile.visit_count  or 0) if profile else 0
    total_sales     = (profile.total_sales  or 0) if profile else 0

    dormant_days = (
        store_settings.default_dormant_days
        if store_settings and store_settings.default_dormant_days
        else _DEFAULT_DORMANT_DAYS
    )
    pre_dormant_days = (
        store_settings.default_pre_dormant_days
        if store_settings and store_settings.default_pre_dormant_days
        else _DEFAULT_PRE_DORMANT_DAYS
    )

    today = date.today()

    if last_visit_date:
        days_since = (today - last_visit_date).days
        evidence = f"最終来店から{days_since}日経過、来店{visit_count}回、累計売上{total_sales}円。"
    else:
        evidence = f"来店履歴なし、来店{visit_count}回、累計売上{total_sales}円。"

    # 判定（上から順に最初に一致した状態を採用）
    if visit_count == 0 and last_visit_date is None:
        has_reservation = Reservation.objects.filter(
            store_id=customer.store_id,
            customer=customer,
            status=Reservation.Status.RESERVED,
            deleted_at__isnull=True,
        ).exists()
        state = "first_reserved" if has_reservation else "new_lead"
    elif total_sales >= _VIP_SALES_THRESHOLD or visit_count >= _VIP_VISIT_THRESHOLD:
        state = "vip_candidate"
    elif last_visit_date and (today - last_visit_date).days >= dormant_days:
        state = "dormant"
    elif last_visit_date and (today - last_visit_date).days >= pre_dormant_days:
        state = "pre_dormant"
    elif visit_count == 1:
        state = "after_first_visit"
    elif visit_count >= 2:
        state = "repeater"
    else:
        state = "new_lead"

    priority = "high" if state in ("dormant", "pre_dormant", "high_risk") else "medium"

    return {
        "customer_state":     state,
        "priority":           priority,
        "evidence_summary":   evidence,
        "ai_confidence":      "medium",
        "inferred_needs":     [],
        "blocking_factors":   [],
        "recommended_action": None,
    }


def build_dashboard_ai_diagnosis(dashboard_data: dict) -> dict:
    """
    ダッシュボード集計値のみを使って、Phase1向けの診断モックを返す。
    個人情報や顧客別データは入力・出力に含めない。
    """
    total_customers = dashboard_data.get("total_customers", 0)
    follow_targets = dashboard_data.get("after_first_visit_follow_targets", 0)
    dormant_customers = dashboard_data.get("dormant_customers", 0)
    pre_dormant_customers = dashboard_data.get("pre_dormant_customers", 0)
    repeat_customers = dashboard_data.get("repeat_customers", 0)
    visit_count = dashboard_data.get("visit_count_this_month", 0)
    total_sales = dashboard_data.get("total_sales_this_month", 0)
    average_spend = dashboard_data.get("average_spend_per_visit", 0)
    top_menus = dashboard_data.get("top_menus", [])

    missing_data = []
    if visit_count == 0:
        missing_data.append("今月の来店データ")
    if total_sales == 0:
        missing_data.append("今月の売上データ")
    if not top_menus:
        missing_data.append("人気メニュー集計")

    cautions = ["この診断は外部AIを使わないルールベースのモックです。"]

    if total_customers == 0:
        return {
            "summary": "顧客データがまだないため、診断はデータ不足です。",
            "main_issue": "顧客データ不足",
            "hypothesis": "CSV取込または手入力が未完了の可能性があります。",
            "priority": "low",
            "confidence": "low",
            "reasons": ["総顧客数が0人です。"],
            "cautions": cautions,
            "missing_data": ["顧客データ", *missing_data],
        }

    if follow_targets > 0:
        return {
            "summary": "初回来店後のフォロー対象があり、2回目予約につなげる対応を優先したい状態です。",
            "main_issue": "初回来店後フォロー不足",
            "hypothesis": "次回予約につながる理由づけや来店後フォローが不足している可能性があります。",
            "priority": "high",
            "confidence": "medium",
            "reasons": [f"初回来店後フォロー対象が{follow_targets}人います。"],
            "cautions": [*cautions, *_CUSTOMER_MESSAGE_CAUTIONS],
            "missing_data": missing_data,
        }

    if dormant_customers > 0:
        return {
            "summary": "休眠顧客がいるため、再来店のきっかけ作りを検討したい状態です。",
            "main_issue": "休眠顧客フォロー",
            "hypothesis": "来店理由の再提示や近況確認の接点が不足している可能性があります。",
            "priority": "high",
            "confidence": "medium",
            "reasons": [f"休眠顧客が{dormant_customers}人います。"],
            "cautions": [*cautions, *_CUSTOMER_MESSAGE_CAUTIONS, "過剰配信にならないよう頻度に注意してください。"],
            "missing_data": missing_data,
        }

    if pre_dormant_customers > 0:
        return {
            "summary": "休眠予備軍がいるため、早めの再来店フォローが有効そうです。",
            "main_issue": "休眠予備軍フォロー",
            "hypothesis": "来店周期が空き始めており、予約する理由を思い出してもらう接点が必要な可能性があります。",
            "priority": "medium",
            "confidence": "medium",
            "reasons": [f"休眠予備軍が{pre_dormant_customers}人います。"],
            "cautions": [*cautions, *_CUSTOMER_MESSAGE_CAUTIONS],
            "missing_data": missing_data,
        }

    if repeat_customers > 0 and top_menus:
        top_menu_name = top_menus[0]["name"]
        return {
            "summary": "リピーターと人気メニューのデータがあり、店頭提案や再来店促進に活用できそうです。",
            "main_issue": "リピーター向け提案の具体化",
            "hypothesis": "人気メニューを軸にした案内で、次回来店の理由を作れる可能性があります。",
            "priority": "medium",
            "confidence": "medium",
            "reasons": [
                f"リピーターが{repeat_customers}人います。",
                f"今月の人気メニューは「{top_menu_name}」です。",
                f"今月の客単価は{average_spend}円です。比較対象がないため増減は断定しません。",
            ],
            "cautions": cautions,
            "missing_data": missing_data,
        }

    return {
        "summary": "大きな注意サインは少なく、まずは来店・売上・顧客状態の記録を継続したい状態です。",
        "main_issue": "継続的なデータ蓄積",
        "hypothesis": "施策判断の精度を上げるには、来店・売上・反応データの蓄積が必要です。",
        "priority": "low",
        "confidence": "low" if missing_data else "medium",
        "reasons": [
            f"総顧客数は{total_customers}人です。",
            f"今月の来店件数は{visit_count}件、売上合計は{total_sales}円です。",
        ],
        "cautions": cautions,
        "missing_data": missing_data,
    }


def build_monthly_focus(dashboard_data: dict) -> dict:
    """
    ダッシュボード集計値のみを使って、今月の重点目的カードデータを返す。
    ルールベースで目的・根拠・信頼度・注意点を生成する。
    """
    total_customers = dashboard_data.get("total_customers", 0)
    follow_targets = dashboard_data.get("after_first_visit_follow_targets", 0)
    dormant_customers = dashboard_data.get("dormant_customers", 0)
    pre_dormant_customers = dashboard_data.get("pre_dormant_customers", 0)
    new_customers = dashboard_data.get("new_customers_this_month", 0)
    repeat_customers = dashboard_data.get("repeat_customers", 0)

    base_cautions = [
        "この判定はルールベースのモックです。実際の施策判断は店舗の状況を踏まえて確認してください。",
        "顧客向け発信は必ず人間確認を行ってください。",
    ]

    if total_customers == 0:
        return {
            "purpose": "顧客データの整備",
            "purpose_code": "data_setup",
            "reason": "顧客データが未登録のため、施策の判断ができません。まずCSV取込または手入力で顧客を登録してください。",
            "confidence": "low",
            "cautions": base_cautions,
        }

    if follow_targets > 0:
        return {
            "purpose": "2回目予約率の向上",
            "purpose_code": "second_visit",
            "reason": f"初回来店後に次回予約が取れていない顧客が{follow_targets}人います。早期フォローで定着率を高める時機です。",
            "confidence": "medium",
            "cautions": [*base_cautions, "同意・配信停止状態を必ず確認してから連絡してください。"],
        }

    if dormant_customers > 0:
        return {
            "purpose": "休眠顧客の復帰",
            "purpose_code": "dormant_reactivation",
            "reason": f"休眠状態の顧客が{dormant_customers}人います。来店きっかけを作ることで再来店につなげられる可能性があります。",
            "confidence": "medium",
            "cautions": [*base_cautions, "長期未来店の顧客への過剰な連絡は逆効果になる場合があります。"],
        }

    if pre_dormant_customers > 0:
        return {
            "purpose": "休眠化の予防",
            "purpose_code": "pre_dormant_prevention",
            "reason": f"休眠予備軍が{pre_dormant_customers}人います。来店周期が空き始めており、早めのフォローが有効です。",
            "confidence": "medium",
            "cautions": base_cautions,
        }

    if new_customers > 0 and total_customers < 20:
        return {
            "purpose": "新規顧客の獲得",
            "purpose_code": "new_customer_acquisition",
            "reason": f"今月{new_customers}人の新規顧客がいますが、総顧客数がまだ{total_customers}人と少ない段階です。新規獲得の取り組みを続けましょう。",
            "confidence": "low",
            "cautions": [*base_cautions, "新規顧客数の目標値は設定されていないため、増減の評価は店舗判断で行ってください。"],
        }

    if repeat_customers > 0:
        return {
            "purpose": "再来店・客単価の向上",
            "purpose_code": "repeat_upsell",
            "reason": f"リピーターが{repeat_customers}人おり、継続来店の基盤があります。来店頻度の維持とメニュー提案でLTV向上を目指せます。",
            "confidence": "medium",
            "cautions": base_cautions,
        }

    return {
        "purpose": "顧客状態の把握と継続運用",
        "purpose_code": "data_maintenance",
        "reason": f"現在{total_customers}人の顧客データがあります。来店・売上・反応データを継続的に記録することで、判断精度が上がります。",
        "confidence": "low",
        "cautions": base_cautions,
    }


def build_weekly_actions(dashboard_data: dict) -> list[dict]:
    """
    ダッシュボード集計値のみを使って、今週のアクション候補を返す。
    Phase1では保存や外部連携を行わず、表示用の固定ロジックに留める。
    """
    total_customers = dashboard_data.get("total_customers", 0)
    follow_targets = dashboard_data.get("after_first_visit_follow_targets", 0)
    dormant_customers = dashboard_data.get("dormant_customers", 0)
    pre_dormant_customers = dashboard_data.get("pre_dormant_customers", 0)
    repeat_customers = dashboard_data.get("repeat_customers", 0)
    top_menus = dashboard_data.get("top_menus", [])

    if total_customers == 0:
        return [{
            "id": "import_customer_data",
            "title": "顧客データを登録する",
            "purpose": "診断とアクション提案に必要な基本データを揃える",
            "target": "店舗の顧客データ",
            "priority": "medium",
            "channel": "internal",
            "due_label": "今週中",
            "estimated_minutes": 30,
            "steps": ["顧客CSVまたは手入力で登録する", "予約/来店データと売上データも登録する"],
            "success_metric": "顧客数と来店・売上データの登録件数",
            "cautions": ["CSVに個人情報が含まれる前提で扱ってください。"],
        }]

    actions = []

    if follow_targets > 0:
        actions.append({
            "id": "follow_after_first_visit",
            "title": "初回来店後フォロー対象を確認する",
            "purpose": "2回目予約につなげる",
            "target": f"初回来店後・次回予約なしの顧客 {follow_targets}人",
            "priority": "high",
            "channel": "manual_or_line",
            "due_label": "今週中",
            "estimated_minutes": 30,
            "steps": ["対象者を確認する", "送信前に同意・配信停止を確認する", "反応や次回予約を記録する"],
            "success_metric": "次回予約数",
            "cautions": _CUSTOMER_MESSAGE_CAUTIONS,
        })

    if dormant_customers > 0:
        actions.append({
            "id": "reactivate_dormant_customers",
            "title": "休眠顧客への再来店きっかけを整理する",
            "purpose": "休眠顧客の再来店機会を作る",
            "target": f"休眠顧客 {dormant_customers}人",
            "priority": "high",
            "channel": "manual_or_line",
            "due_label": "今週中",
            "estimated_minutes": 45,
            "steps": ["対象人数を確認する", "直近の人気メニューや季節の悩みに合わせた案内を考える", "送信前に同意・配信停止を確認する"],
            "success_metric": "返信数、予約数",
            "cautions": [*_CUSTOMER_MESSAGE_CAUTIONS, "過剰配信にならないよう頻度に注意してください。"],
        })

    if pre_dormant_customers > 0:
        actions.append({
            "id": "follow_pre_dormant_customers",
            "title": "休眠予備軍に早めのフォローを行う",
            "purpose": "休眠化を防ぐ",
            "target": f"休眠予備軍 {pre_dormant_customers}人",
            "priority": "medium",
            "channel": "manual_or_line",
            "due_label": "今週中",
            "estimated_minutes": 30,
            "steps": ["対象人数を確認する", "再来店理由を整理する", "送信前に同意・配信停止を確認する"],
            "success_metric": "予約数、来店数",
            "cautions": _CUSTOMER_MESSAGE_CAUTIONS,
        })

    if repeat_customers > 0 and top_menus:
        top_menu_name = top_menus[0]["name"]
        actions.append({
            "id": "promote_popular_menu_to_repeaters",
            "title": "リピーター向けに人気メニューの提案を準備する",
            "purpose": "次回来店の理由を作る",
            "target": f"リピーター {repeat_customers}人",
            "priority": "medium",
            "channel": "in_store_or_manual",
            "due_label": "今週中",
            "estimated_minutes": 20,
            "steps": [f"人気メニュー「{top_menu_name}」の案内ポイントを整理する", "店頭または手動連絡で提案する"],
            "success_metric": "予約数、対象メニューの利用件数",
            "cautions": ["客単価の増減は比較対象がないため断定しないでください。"],
        })

    return actions[:3]
