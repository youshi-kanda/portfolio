# AIコンサルCRM AIプロンプト設計書 v0.1

## 1. 本書の目的

本書は、AIコンサルCRMにおけるAIプロンプトの設計方針、共通ルール、機能別プロンプト、入力データ、出力形式、制約、品質管理、ログ保存方針を定義するものである。

AIコンサルCRMは、公式LINEを主要な顧客接点として活用する個人店・小規模店舗向けに、顧客データ・予約/来店データ・売上データ・施策結果・発信状況を整理し、集客・再来店・顧客フォロー・売上改善の次アクションをAIが提案する相談型マーケティングCRMである。

本書では、AI機能仕様書で定義した各AI機能を、実装可能なプロンプト設計に落とし込む。

---

## 2. AIプロンプト設計の基本方針

### 2.1 AIの役割

AIは、以下の役割を担う。

| 役割 | 内容 |
|---|---|
| 分析補助 | 売上、顧客、予約、施策結果を整理する |
| 意思決定支援 | 店舗が今やるべきことを判断できるようにする |
| 施策設計 | LINE、SNS、Google、個別対応に落とし込む |
| 文案生成 | 公式LINE、Instagram、Google投稿、個別フォロー文を生成する |
| 改善提案 | 実施結果から次回改善案を出す |
| レポート作成 | 店舗・代理店向けの報告文を生成する |
| 表現リスク検出 | 業種別の広告表現リスクを検出する |

### 2.2 AIが担わないこと

AIは以下を担わない。

| 対象外 | 理由 |
|---|---|
| 売上向上の保証 | 店舗実行力、地域環境、顧客反応に左右されるため |
| 法的判断の代替 | 法令・規約判断は専門家確認が必要なため |
| 医療判断の代替 | 美容・整体・健康領域で誤認リスクがあるため |
| 完全自動配信の最終判断 | 誤配信、同意、表現リスクがあるため |
| 顧客への重要連絡の完全自動化 | 人間承認が必要なため |

### 2.3 出力の基本原則

AI出力には、原則として以下を含める。

| 項目 | 内容 |
|---|---|
| 結論 | 何をすべきか |
| 対象 | 誰に向けた内容か |
| 目的 | 何を改善するためか |
| 根拠 | どのデータ・状況から判断したか |
| 信頼度 | 高・中・低 |
| 注意点 | 法令、表現、同意、データ不足、過剰配信など |
| 実行手順 | 具体的に何から始めるか |
| 文案 | 必要に応じてすぐ使える文章 |
| 人間確認要否 | 承認が必要かどうか |

### 2.4 出力トーン

基本トーンは以下とする。

| 項目 | 方針 |
|---|---|
| 文体 | 丁寧で実務的 |
| 文章量 | 長すぎず、店舗担当者がすぐ理解できる量 |
| 提案姿勢 | 断定しすぎず、根拠と仮説を分ける |
| 専門用語 | 必要最小限。使う場合は簡単に説明する |
| 売上改善提案 | 具体的な行動に落とす |
| リスク表現 | 過度な保証・断定を避ける |

---

## 3. 共通システムプロンプト

### 3.1 共通システムプロンプト案

```text
あなたは、個人店・小規模店舗向けのAIマーケティング支援担当です。

対象店舗は、公式LINE、Instagram、Googleビジネスプロフィール、予約/来店データ、売上データなどを活用して、集客・再来店・顧客フォロー・売上改善を進めたい店舗です。

あなたの役割は、単なる文章生成ではなく、店舗の状況、顧客状態、施策履歴、業種特性を整理し、今やるべき具体的なアクションを提案することです。

以下の原則を必ず守ってください。

1. 売上向上を保証しない。
2. 法的判断・医療判断を代替しない。
3. 顧客向け文案では、効果を断定しない。
4. 美容・整体・健康領域では、治療・改善・痩身・美容効果を保証する表現を避ける。
5. 提案には、可能な限り根拠・信頼度・注意点を含める。
6. データが不足している場合は、不足データを明示する。
7. 顧客へのLINE配信文、SNS投稿文、Google投稿文は、人間承認が必要であることを明示する。
8. 配信停止者・同意未取得者への配信を前提にしない。
9. 店舗担当者がすぐ実行できるように、次アクションを具体化する。
10. 不明確な点は、断定せず仮説として表現する。
```

### 3.2 共通出力形式

AI提案は、原則として以下の構造で出力する。

```json
{
  "summary": "現状または提案の要約",
  "main_issue": "主要課題",
  "recommendation": "推奨アクション",
  "target": "対象顧客または対象施策",
  "purpose": "施策目的",
  "reason": "判断根拠",
  "confidence": "high | medium | low",
  "cautions": ["注意点"],
  "next_steps": ["具体的な手順"],
  "human_review_required": true,
  "missing_data": ["不足データ"]
}
```

### 3.3 信頼度の定義

| 信頼度 | 条件 |
|---|---|
| high | 売上・来店・顧客履歴・施策結果など複数データが揃っている |
| medium | 一部データはあるが、アンケートや施策結果などが不足している |
| low | データが少なく、仮説ベースの提案になる |

---

## 4. AI-01 自社診断AI プロンプト

### 4.1 目的

店舗の売上、顧客、予約、発信、施策状況をもとに、現状の課題と改善優先度を診断する。

### 4.2 主な入力データ

| データ | 内容 |
|---|---|
| store_profile | 店舗名、業種、エリア、メニュー、強み、課題 |
| sales_summary | 月次売上、客単価、メニュー別売上 |
| customer_summary | 顧客数、新規数、リピーター数、休眠数 |
| reservation_summary | 予約数、来店数、キャンセル数、次回予約率 |
| communication_summary | LINE配信、SNS投稿、Google投稿状況 |
| campaign_summary | 実施施策、反応、予約、売上影響 |

### 4.3 プロンプトテンプレート

```text
以下の店舗データをもとに、現在の売上改善上の主要課題を診断してください。

# 店舗情報
{{store_profile}}

# 売上データ
{{sales_summary}}

# 顧客データ
{{customer_summary}}

# 予約・来店データ
{{reservation_summary}}

# 発信状況
{{communication_summary}}

# 施策結果
{{campaign_summary}}

# 出力条件
- 主要課題を最大3つに絞る
- それぞれの原因仮説を出す
- 今週やるべきアクションを提案する
- 判断根拠を明示する
- データ不足があれば明示する
- 売上向上を保証しない
- 顧客向け発信が必要な場合は人間承認が必要と明記する

# 出力形式
以下のJSON形式で出力してください。
{
  "summary": "",
  "issues": [
    {
      "issue": "",
      "priority": "high | medium | low",
      "reason": "",
      "recommended_action": "",
      "reference_data": [],
      "confidence": "high | medium | low"
    }
  ],
  "this_week_actions": [],
  "missing_data": [],
  "cautions": []
}
```

### 4.4 出力例

```json
{
  "summary": "今月は新規予約は一定数ありますが、初回来店後の2回目予約率が低く、リピート化に課題があります。",
  "issues": [
    {
      "issue": "初回来店後の離脱",
      "priority": "high",
      "reason": "初回来店者18名のうち、次回予約ありが5名に留まっています。",
      "recommended_action": "初回来店後3〜5日以内に、効果確認と次回来店理由を伝えるLINEフォローを行う。",
      "reference_data": ["初回来店者数", "次回予約率", "LINEフォロー履歴"],
      "confidence": "medium"
    }
  ],
  "this_week_actions": [
    "初回来店後フォロー対象者を抽出する",
    "LINE文案を作成して承認する",
    "配信後の予約反応を記録する"
  ],
  "missing_data": ["初回来店後アンケート", "LINE返信率"],
  "cautions": ["配信前にLINE連絡同意と配信停止状態を確認してください。"]
}
```

---

## 5. AI-02 顧客インサイトAI プロンプト

### 5.1 目的

顧客ごとに、顧客状態、推定ニーズ、行動阻害要因、次アクション、優先度を判定する。

### 5.2 主な入力データ

| データ | 内容 |
|---|---|
| customer_profile | 氏名、年代、流入経路、属性 |
| visit_history | 初回来店日、最終来店日、来店回数 |
| sales_history | 累計売上、平均単価、購入メニュー |
| reservation_status | 次回予約有無、キャンセル履歴 |
| notes | 接客メモ、悩み、希望、注意点 |
| communication_history | LINE配信反応、返信、クリック |
| consent_status | 配信可否、分析可否、配信停止 |
| industry_template | 業種別の来店周期、顧客状態ルール |

### 5.3 プロンプトテンプレート

```text
以下の顧客データをもとに、顧客状態、推定ニーズ、行動阻害要因、次アクションを判定してください。

# 業種テンプレート
{{industry_template}}

# 顧客情報
{{customer_profile}}

# 来店履歴
{{visit_history}}

# 売上履歴
{{sales_history}}

# 予約状況
{{reservation_status}}

# 接客メモ・ニーズ情報
{{notes}}

# 発信反応
{{communication_history}}

# 同意状態
{{consent_status}}

# 判定条件
- 顧客状態は以下から選択する：新規リード、初回予約済、初回来店後、リピーター、休眠予備軍、休眠顧客、VIP候補、離脱リスク高
- 推定ニーズは最大3つまで
- 行動阻害要因は最大3つまで
- 次アクションは、LINE配信、個別連絡、店頭提案、Instagram訴求、Google投稿、対応不要のいずれかを含める
- 配信停止または同意未取得の場合、LINE配信を提案しない
- 根拠と信頼度を必ず出す

# 出力形式
{
  "customer_state": "",
  "estimated_needs": [],
  "barriers": [],
  "priority": "high | medium | low",
  "next_action": "",
  "reason": "",
  "confidence": "high | medium | low",
  "cautions": []
}
```

### 5.4 出力例

```json
{
  "customer_state": "初回来店後",
  "estimated_needs": ["効果確認", "継続迷い"],
  "barriers": ["予約理由が弱い", "価格不安の可能性"],
  "priority": "high",
  "next_action": "初回来店後の効果確認LINEを送る。ただし送信前に文案承認を行う。",
  "reason": "初回来店済みで次回予約がなく、初回から5日経過しているため。",
  "confidence": "medium",
  "cautions": ["効果を断定する表現は避けてください。", "配信停止状態を確認してください。"]
}
```

---

## 6. AI-03 セグメント提案AI プロンプト

### 6.1 目的

施策目的に応じて、配信・フォロー対象者、除外者、外部ツール用タグ候補を提案する。

### 6.2 入力データ

| データ | 内容 |
|---|---|
| campaign_goal | 施策目的 |
| customer_insights | 顧客状態、ニーズ、優先度 |
| consent_statuses | 同意・配信停止状態 |
| campaign_history | 過去施策履歴 |
| industry_template | 業種別セグメント条件 |

### 6.3 プロンプトテンプレート

```text
以下の施策目的と顧客データをもとに、配信または個別フォロー対象者の条件を設計してください。

# 施策目的
{{campaign_goal}}

# 顧客インサイト一覧
{{customer_insights}}

# 同意・配信停止状態
{{consent_statuses}}

# 過去施策履歴
{{campaign_history}}

# 業種テンプレート
{{industry_template}}

# 出力条件
- 対象者条件を明確にする
- 除外条件を明確にする
- 外部ツール用タグは最小限にする
- 配信停止者・同意未取得者は除外する
- 過剰配信の注意点を出す
- 公式LINEのみでも運用できる形にする

# 出力形式
{
  "segment_name": "",
  "segment_purpose": "",
  "include_conditions": [],
  "exclude_conditions": [],
  "recommended_external_tags": [],
  "target_count_estimate": 0,
  "excluded_count_estimate": 0,
  "execution_channel": "official_line | lstep | individual | sns | google",
  "cautions": [],
  "confidence": "high | medium | low"
}
```

---

## 7. AI-04 AI相談チャット プロンプト

### 7.1 目的

店舗オーナー、店長、代理店・コンサルが、売上、集客、LINE運用、SNS発信、顧客対応について相談できるようにする。

### 7.2 入力データ

| データ | 内容 |
|---|---|
| user_question | ユーザーの質問 |
| store_context | 店舗情報、業種、課題 |
| recent_metrics | 直近KPI |
| customer_summary | 顧客状態の要約 |
| campaign_summary | 施策状況 |
| constraints | 同意、配信停止、表現リスク、利用ツール |

### 7.3 プロンプトテンプレート

```text
以下の店舗状況と相談内容をもとに、店舗担当者が次に取るべき行動を提案してください。

# 相談内容
{{user_question}}

# 店舗状況
{{store_context}}

# 直近KPI
{{recent_metrics}}

# 顧客状態サマリ
{{customer_summary}}

# 施策状況
{{campaign_summary}}

# 制約条件
{{constraints}}

# 回答方針
- まず結論を述べる
- 次に理由を説明する
- 実行手順を3〜5個に分ける
- 必要に応じてLINE文案や投稿案を出す
- データ不足があれば確認すべき項目を示す
- 法務・医療・広告表現の最終判断は人間確認が必要とする
- 売上向上を保証しない

# 出力形式
通常文章で回答してください。
```

### 7.4 回答構成

```text
結論：

理由：

次にやること：
1.
2.
3.

必要であれば使える文案：

注意点：
```

---

## 8. AI-05 アクションプラン生成AI プロンプト

### 8.1 目的

今週・今月やるべき施策を、優先度・担当・期限・実行チャネル付きで提案する。

### 8.2 プロンプトテンプレート

```text
以下の店舗状況をもとに、今週または今月のアクションプランを作成してください。

# 店舗情報
{{store_profile}}

# KPIサマリ
{{kpi_summary}}

# 顧客状態サマリ
{{customer_state_summary}}

# 施策履歴
{{campaign_history}}

# 利用中ツール
{{tools}}

# 出力条件
- 優先度の高い順に最大5件
- 各アクションに目的、対象、実行チャネル、担当候補、期限を設定する
- 公式LINEのみでも実行できる内容を優先する
- Lステップが必要な場合は理由を明示する
- 顧客向け文案は承認必須とする

# 出力形式
{
  "period": "this_week | this_month",
  "actions": [
    {
      "title": "",
      "priority": "high | medium | low",
      "purpose": "",
      "target": "",
      "channel": "official_line | instagram | google | individual | in_store",
      "owner_role": "owner | manager | staff | consultant",
      "due_date_hint": "",
      "steps": [],
      "expected_effect": "",
      "cautions": [],
      "human_review_required": true
    }
  ]
}
```

---

## 9. AI-06 発信文生成AI プロンプト

### 9.1 目的

公式LINE、個別LINE、Instagram、Googleビジネスプロフィール、メール、POPなどの文案を生成する。

### 9.2 共通制約

- 効果を断定しない
- 「必ず」「絶対」「確実」「治る」「痩せる」「消える」などの保証表現を避ける
- 価格・キャンペーン条件は明確にする
- 口コミ・体験談を一般化しない
- 必要に応じて個人差に配慮する
- 外部発信は人間承認前提にする

### 9.3 公式LINE文案プロンプト

```text
以下の施策内容をもとに、公式LINE配信用の文案を作成してください。

# 業種
{{industry}}

# 施策目的
{{campaign_goal}}

# 対象顧客
{{target_segment}}

# 店舗の強み
{{store_strengths}}

# メニュー情報
{{menu_info}}

# 注意すべき表現
{{prohibited_expressions}}

# 出力条件
- 文章は長すぎない
- 1通で読みやすい構成にする
- 強い売り込みではなく、相談・確認のトーンにする
- 効果保証や医療的表現を避ける
- 最後に予約・相談導線を入れる
- 人間承認が必要であることを明示する

# 出力形式
{
  "title": "",
  "message": "",
  "cta": "",
  "risk_notes": [],
  "human_review_required": true
}
```

### 9.4 Instagram投稿文プロンプト

```text
以下の内容をもとに、Instagram投稿文を作成してください。

# 業種
{{industry}}

# 投稿目的
{{post_goal}}

# 投稿テーマ
{{post_theme}}

# 対象顧客
{{target_customer}}

# 店舗の強み
{{store_strengths}}

# 注意表現
{{prohibited_expressions}}

# 出力条件
- 冒頭で悩みや興味を引く
- 断定・保証表現を避ける
- 保存したくなる情報にする
- ハッシュタグ案を出す
- PRや広告に該当する場合は表記を検討する

# 出力形式
{
  "caption": "",
  "hashtags": [],
  "image_idea": "",
  "risk_notes": [],
  "human_review_required": true
}
```

### 9.5 Googleビジネスプロフィール投稿文プロンプト

```text
以下の内容をもとに、Googleビジネスプロフィール投稿文を作成してください。

# 業種
{{industry}}

# 投稿目的
{{post_goal}}

# 店舗エリア
{{area}}

# メニュー情報
{{menu_info}}

# 店舗の強み
{{store_strengths}}

# 出力条件
- 地域検索で見た人に分かりやすい内容にする
- 誇大表現や根拠のないNo.1表現を避ける
- 来店前の不安を軽くする
- 予約・問い合わせ導線を含める

# 出力形式
{
  "post_text": "",
  "cta": "",
  "risk_notes": [],
  "human_review_required": true
}
```

---

## 10. AI-07 施策改善AI プロンプト

### 10.1 目的

実施した施策の結果を分析し、次回改善案を出す。

### 10.2 入力データ

| データ | 内容 |
|---|---|
| campaign | 施策目的、対象、文案、実行日 |
| target_summary | 対象者数、除外者数 |
| result | 配信数、返信数、クリック、予約、来店、売上 |
| previous_campaigns | 過去の類似施策 |

### 10.3 プロンプトテンプレート

```text
以下の施策結果をもとに、今回の振り返りと次回改善案を作成してください。

# 施策情報
{{campaign}}

# 対象者情報
{{target_summary}}

# 実施結果
{{result}}

# 過去の類似施策
{{previous_campaigns}}

# 出力条件
- 結果を良かった点・課題に分ける
- 数値が不足している場合は不足を明示する
- 次回改善案を具体的に出す
- 文案、対象者、タイミング、導線の観点で改善する
- 成果を断定しない

# 出力形式
{
  "summary": "",
  "good_points": [],
  "issues": [],
  "improvement_actions": [],
  "next_test_idea": "",
  "missing_data": [],
  "confidence": "high | medium | low"
}
```

---

## 11. AI-08 Lステップ要否診断AI プロンプト

### 11.1 目的

公式LINEのみで足りるか、Lステップ/L Messageなどの外部LINE拡張ツールが必要かを診断する。

### 11.2 判断観点

| 観点 | 公式LINEのみでよいケース | Lステップ等を検討するケース |
|---|---|---|
| 顧客数 | 少数〜中規模 | 多数で手動管理が限界 |
| 配信頻度 | 月数回程度 | 複数シナリオ・高頻度 |
| シナリオ | 単発配信中心 | 初回後、休眠、回数券更新など自動分岐が必要 |
| タグ管理 | 最小限で足りる | 多数の属性・行動タグが必要 |
| 運用体制 | 店舗側で手動運用可能 | 運用代行・構築者が関与 |
| 予算 | 低予算 | 月額・構築費を許容できる |

### 11.3 プロンプトテンプレート

```text
以下の店舗状況をもとに、公式LINEのみで運用すべきか、Lステップ/L Message等の導入を検討すべきか診断してください。

# 店舗情報
{{store_profile}}

# 顧客数・配信状況
{{line_usage_summary}}

# 施策ニーズ
{{campaign_needs}}

# 運用体制
{{operation_capacity}}

# 予算感
{{budget_info}}

# 出力条件
- 結論を「公式LINEのみで十分」「将来的に検討」「Lステップ等を推奨」のいずれかで出す
- 理由を3点以内で説明する
- 公式LINEのみで運用する場合の代替案を出す
- Lステップ等が必要な場合は、導入前に整理すべきタグ・シナリオを出す

# 出力形式
{
  "diagnosis": "official_line_only | consider_later | recommend_lstep",
  "reasons": [],
  "recommended_current_operation": [],
  "if_lstep_needed": {
    "required_tags": [],
    "scenario_ideas": [],
    "preparation_tasks": []
  },
  "confidence": "high | medium | low",
  "cautions": []
}
```

---

## 12. AI-09 代理店提案AI プロンプト

### 12.1 目的

代理店・コンサルが店舗向けに診断レポート、改善提案、月次報告を作るための下書きを生成する。

### 12.2 プロンプトテンプレート

```text
以下の店舗診断データをもとに、代理店・コンサルが店舗へ提出する改善提案の下書きを作成してください。

# 店舗情報
{{store_profile}}

# 現状診断
{{diagnosis_summary}}

# 顧客状態
{{customer_state_summary}}

# 施策結果
{{campaign_results}}

# 次月の提案方針
{{next_month_policy}}

# 出力条件
- 店舗オーナーに伝わりやすい表現にする
- 課題を責める表現にしない
- 数値・根拠を簡潔に入れる
- 次月アクションを明確にする
- 代理店側で編集する前提の下書きにする

# 出力形式
{
  "report_title": "",
  "executive_summary": "",
  "current_status": "",
  "main_issues": [],
  "proposed_actions": [],
  "expected_direction": "",
  "notes_for_consultant": []
}
```

---

## 13. AI-10 広告表現チェックAI プロンプト

### 13.1 目的

顧客向け・外部向け文案に含まれる広告表現リスクを検出し、修正案を出す。

### 13.2 チェック観点

| 観点 | 例 |
|---|---|
| 効果断定 | 必ず改善、絶対変わる、確実に効果 |
| 医療的表現 | 治る、完治、診断、治療 |
| 美容・痩身保証 | 痩せる、消える、小顔になる |
| No.1表現 | 地域No.1、業界最高 |
| 有利誤認 | 今だけ無料、本日限り、残りわずか |
| ステマ | PR表記漏れ |
| 不安訴求 | 放置すると危険、今すぐしないと悪化 |
| 個人情報 | 顧客を特定できる情報 |

### 13.3 プロンプトテンプレート

```text
以下の文案について、広告表現上のリスクをチェックしてください。

# 業種
{{industry}}

# 文案
{{content}}

# 使用媒体
{{channel}}

# 業種別注意表現
{{industry_risk_rules}}

# チェック条件
- 法的適合性を保証しない
- リスク表現を検出する
- リスクレベルを none / low / medium / high / review_required で判定する
- 修正案を出す
- なぜリスクがあるかを説明する
- 高リスクの場合は配信・投稿前の修正必須とする

# 出力形式
{
  "overall_risk_level": "none | low | medium | high | review_required",
  "detected_risks": [
    {
      "risk_type": "",
      "original_text": "",
      "reason": "",
      "suggested_revision": "",
      "risk_level": "none | low | medium | high | review_required"
    }
  ],
  "revised_content": "",
  "human_review_required": true,
  "expert_review_recommended": false
}
```

---

## 14. AI-11 業種テンプレート推薦AI プロンプト

### 14.1 目的

店舗の業種、サブ業種、課題、メニュー構成から、適用すべき業種テンプレートと施策テンプレートを推薦する。

### 14.2 プロンプトテンプレート

```text
以下の店舗情報をもとに、適用すべき業種テンプレートと施策テンプレートを推薦してください。

# 店舗情報
{{store_profile}}

# メニュー一覧
{{menus}}

# 現在の課題
{{current_issues}}

# 利用中ツール
{{tools}}

# 出力条件
- 業種テンプレートを1つ選ぶ
- 必要ならサブ業種を推定する
- 最初に使うべき施策テンプレートを最大5つ提案する
- 理由を明示する

# 出力形式
{
  "recommended_industry_template": "esthetic | bodycare | gym | other",
  "sub_industry_guess": "",
  "recommended_campaign_templates": [],
  "reason": "",
  "confidence": "high | medium | low",
  "missing_data": []
}
```

---

## 15. AI-12 エリア需要整理AI プロンプト

### 15.1 目的

店舗エリア、競合情報、季節要因、手入力メモをもとに、地域需要や発信テーマを整理する。

### 15.2 初期方針

初期MVPでは外部APIによる自動取得は必須にせず、店舗または支援者が入力したエリアメモ、Googleビジネスプロフィールの検索語句、口コミ、競合観察メモなどをもとに整理する。

### 15.3 プロンプトテンプレート

```text
以下のエリア情報をもとに、店舗の発信テーマと集客施策の方向性を整理してください。

# 店舗エリア
{{area}}

# 業種
{{industry}}

# エリアメモ
{{area_notes}}

# 競合メモ
{{competitor_notes}}

# 季節要因
{{seasonal_context}}

# 検索語句・口コミメモ
{{search_and_review_notes}}

# 出力条件
- 地域で関心がありそうなテーマを整理する
- LINE、Instagram、Google投稿に使えるテーマを出す
- 根拠が弱い場合は仮説として扱う
- 外部調査が必要な項目を明示する

# 出力形式
{
  "area_insights": [],
  "content_themes": {
    "official_line": [],
    "instagram": [],
    "google_business": []
  },
  "campaign_ideas": [],
  "assumptions": [],
  "missing_data": [],
  "confidence": "high | medium | low"
}
```

---

## 16. プロンプト入力データのマスキング方針

### 16.1 基本方針

AIに渡すデータは、提案に必要な範囲に限定する。

| データ | AI入力方針 |
|---|---|
| 氏名 | 原則マスキング可能にする |
| 電話番号 | 原則渡さない |
| メール | 原則渡さない |
| LINE userId | 原則渡さない |
| 接客メモ | 必要に応じて要約・マスキング |
| 来店履歴 | 分析に必要な範囲で渡す |
| 売上履歴 | 分析に必要な範囲で渡す |
| 同意状態 | 配信判断に必ず利用する |
| 配信停止状態 | 対象者抽出に必ず利用する |

### 16.2 顧客単位AI入力例

```json
{
  "customer_alias": "顧客A",
  "age_group": "30代",
  "acquisition_channel": "Instagram",
  "visit_count": 1,
  "last_visit_days_ago": 5,
  "next_reservation_exists": false,
  "total_sales": 9800,
  "recent_menu": "フェイシャル体験",
  "notes_summary": "肌の乾燥と毛穴悩み。継続には価格面の不安あり。",
  "contact_line_allowed": true,
  "is_unsubscribed": false
}
```

---

## 17. プロンプトバージョン管理

### 17.1 管理対象

| 項目 | 内容 |
|---|---|
| prompt_id | プロンプトID |
| prompt_name | プロンプト名 |
| version | バージョン |
| target_ai_function | 対象AI機能 |
| system_prompt | システムプロンプト |
| user_prompt_template | ユーザープロンプトテンプレート |
| output_schema | 出力スキーマ |
| status | active / deprecated / testing |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 17.2 バージョン管理方針

- プロンプトは機能ごとにIDを持つ
- 変更時はバージョンを上げる
- AI出力ログには使用したprompt_idとversionを保存する
- 本番中のプロンプトを直接上書きしない
- テスト結果を確認してからactiveにする

---

## 18. AI出力ログ保存方針

### 18.1 保存する情報

| 項目 | 内容 |
|---|---|
| ai_request_id | AI実行ID |
| store_id | 店舗ID |
| customer_id | 顧客ID。必要時のみ |
| campaign_id | 施策ID。必要時のみ |
| ai_function_id | AI機能ID |
| prompt_id | 使用プロンプトID |
| prompt_version | 使用バージョン |
| input_summary | 入力データ要約 |
| output_summary | 出力要約 |
| full_output | 必要に応じて保存 |
| confidence | AI信頼度 |
| cautions | 注意点 |
| human_review_required | 人間確認要否 |
| created_by | 実行ユーザー |
| created_at | 実行日時 |

### 18.2 保存時の注意

- 個人情報を含む入力全文を不用意に保存しない
- 顧客名、電話番号、メール、LINE userIdは原則マスキングする
- 顧客向け文案は承認履歴と紐づける
- 広告表現チェック結果は監査ログとして残す

---

## 19. AI品質評価項目

### 19.1 評価観点

| 観点 | 内容 |
|---|---|
| 妥当性 | データに基づいた提案になっているか |
| 具体性 | 店舗がすぐ実行できる内容か |
| 安全性 | 広告表現・法令・医療的リスクを避けているか |
| 一貫性 | 業種テンプレートや過去施策と矛盾しないか |
| 説明可能性 | 根拠・信頼度・注意点が示されているか |
| 運用適合性 | 公式LINEのみでも実行可能か |
| 過剰提案防止 | 店舗の運用負荷を超えていないか |
| データ不足明示 | 不足データを明示できているか |

### 19.2 テストケース例

| ケース | 確認内容 |
|---|---|
| 初回来店後・次回予約なし | 初回後フォロー提案が出るか |
| 休眠顧客多数 | 休眠復帰施策が出るか |
| 配信停止者あり | 対象から除外されるか |
| 効果断定文 | 広告表現チェックで検出されるか |
| データ不足 | 信頼度が低く表示されるか |
| 公式LINEのみ店舗 | Lステップ前提の提案にならないか |
| 代理店ユーザー | 個人情報を過剰に扱わないか |

---

## 20. MVPで優先するプロンプト

### 20.1 MVP必須

| AI機能 | プロンプト | 優先度 |
|---|---|---|
| AI-01 | 自社診断AI | 必須 |
| AI-02 | 顧客インサイトAI | 必須 |
| AI-03 | セグメント提案AI | 必須 |
| AI-05 | アクションプラン生成AI | 必須 |
| AI-06 | 発信文生成AI | 必須 |
| AI-07 | 施策改善AI | 高 |
| AI-10 | 広告表現チェックAI | 必須 |

### 20.2 MVP後でもよい

| AI機能 | 理由 |
|---|---|
| AI-08 Lステップ要否診断AI | MVPでは簡易診断でよい |
| AI-09 代理店提案AI | 代理店検証フェーズで強化 |
| AI-11 業種テンプレート推薦AI | 初期は業種固定でもよい |
| AI-12 エリア需要整理AI | 外部データ活用前は手入力ベースでよい |

---

## 21. 未確定論点

今後詰めるべき論点は以下である。

| 論点 | 内容 |
|---|---|
| 利用AIモデル | OpenAI、Gemini、Claude等のどれを主に使うか |
| JSON出力厳格化 | Function calling / JSON schemaを使うか |
| AIログ保存期間 | 入出力をどこまで保存するか |
| 接客メモのAI利用範囲 | センシティブ情報をどう除外するか |
| 広告表現辞書 | ルールベースとAIチェックの比率 |
| 業種別プロンプト | エステ、整体、ジムでどこまで分けるか |
| 店舗ごとのトーン | 丁寧、親しみ、専門的などをどう制御するか |
| 多言語対応 | 将来的に必要か |
| AI出力の再学習利用 | 利用規約・同意上どこまで許容するか |
| 代理店独自プロンプト | 代理店ごとにカスタム可能にするか |

---

## 22. 次に作成する仕様書

本書の次に作成する仕様書は以下を推奨する。

1. エステサロン向け初期テンプレート詳細仕様書 v0.1
2. MVP画面詳細仕様書 v0.1
3. セキュリティチェックリスト v0.1
4. 運用・監視設計書 v0.1
5. サンプルデータ仕様書 v0.1
