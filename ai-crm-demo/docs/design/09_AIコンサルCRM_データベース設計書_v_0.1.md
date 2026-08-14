# AIコンサルCRM データベース設計書 v0.2

## 1. 本書の目的

本書は、AIコンサルCRMのシステム構築に向けて、主要データベース構造、テーブル定義、リレーション、権限・同意・監査・AI活用に関わるデータ設計を定義するものである。

本サービスは、公式LINEを主要な顧客接点として活用する個人店・小規模店舗向けに、顧客データ・売上データ・予約/来店データ・施策データ・発信データ・AI相談履歴を統合し、集客・再来店・顧客フォロー・売上改善の次アクションを提案するAIコンサル型CRMである。

本書では、以下を明確にする。

- どのテーブルを持つか
- 各テーブルにどの項目を持たせるか
- 店舗、顧客、施策、AI提案をどう紐づけるか
- 公式LINE/Lステップ連携に必要な最小タグ情報をどう管理するか
- 代理店・コンサルが複数店舗を支援する場合のデータ分離をどう担保するか
- 同意管理・配信停止・削除要求をどう扱うか
- 将来的な匿名集計・業種別ベンチマークに備えてどう設計するか

---

## 2. データベース設計の基本方針

### 2.1 基本思想

本サービスのデータベースは、単なる顧客管理DBではなく、以下の流れを支える意思決定・施策実行DBとして設計する。

```text
店舗情報
↓
顧客・予約・売上データ
↓
顧客状態・ニーズ・セグメント判定
↓
AI相談・AI提案
↓
施策・発信・対象者リスト
↓
実行結果・反応・売上
↓
改善提案・レポート
```

### 2.2 設計原則

| 原則 | 内容 |
|---|---|
| テナント分離 | 店舗・代理店単位でデータを分離する |
| 店舗ID中心設計 | ほぼすべての業務データに店舗IDを持たせる |
| 顧客ID中心設計 | 顧客単位の履歴・売上・施策反応を追跡できるようにする |
| 外部ツール非依存 | 初期はLINE APIや予約APIに依存せず、CSV/手入力でも成立させる |
| タグ最小化 | 詳細な顧客理解は本サービス側に持ち、外部タグは最小限にする |
| AI根拠保存 | AI提案の根拠、参照データ、信頼度を保存する |
| 人間承認前提 | 顧客向け配信文・外部投稿文は承認状態を持つ |
| 同意・配信停止優先 | 配信対象抽出時に同意状態・配信停止を必ず参照する |
| 匿名集計対応 | 将来の横断分析に備え、個人情報と分析用データを分離しやすくする |
| 監査可能性 | 取込、編集、AI生成、承認、出力の履歴を残す |

### 2.3 想定DB

初期は以下を想定する。

| 項目 | 方針 |
|---|---|
| RDB | PostgreSQL推奨 |
| ORM | Django ORM、Prisma、Drizzle等を想定可能 |
| ファイル | CSV、PDF、Markdown、添付ファイルはオブジェクトストレージ管理 |
| AIログ | RDBに要約・メタ情報を保存し、必要に応じて別ストレージ分離 |
| 分析基盤 | 初期はRDB集計、将来はDWH/BigQuery等を検討 |

---

## 3. エンティティ全体構成

### 3.1 主要エンティティ

| 区分 | テーブル | 内容 |
|---|---|---|
| テナント/権限 | tenants | 契約単位、代理店または店舗組織 |
| テナント/権限 | users | 利用ユーザー |
| テナント/権限 | user_tenant_roles | ユーザーとテナント権限 |
| テナント/権限 | user_store_roles | ユーザーと店舗権限 |
| 店舗 | stores | 店舗情報 |
| 店舗 | store_settings | 店舗設定 |
| 店舗 | store_tools | 利用中ツール |
| 店舗 | menus | メニュー/商品/サービス |
| 代理店 | agencies | 代理店/支援者組織 |
| 代理店 | agency_store_assignments | 代理店と担当店舗の紐づけ |
| 顧客 | customers | 顧客基本情報 |
| 顧客 | customer_profiles | 顧客属性・補足情報 |
| 顧客 | customer_consents | 同意状態 |
| 顧客 | customer_notes | 接客メモ/カウンセリングメモ |
| 予約/来店 | reservations | 予約・来店履歴 |
| 売上 | sales | 売上履歴 |
| ニーズ | customer_needs | 顧客ニーズ情報 |
| セグメント | customer_insights | 顧客状態・推定ニーズ・次アクション |
| セグメント | segment_definitions | セグメント定義 |
| セグメント | segment_members | セグメント対象者 |
| タグ連携 | external_tags | 外部ツール用タグ |
| タグ連携 | external_tag_members | 外部タグ対象者 |
| AI | ai_conversations | AI相談スレッド |
| AI | ai_messages | AI相談メッセージ |
| AI | ai_recommendations | AI提案 |
| AI | ai_reference_logs | AI参照データログ |
| 戦略目的 | strategy_goals | 今月・今期の重点目的 |
| 戦略目的 | strategy_goal_actions | 戦略目的と推奨施策候補の紐づけ |
| 施策 | campaigns | 施策 |
| 施策 | campaign_targets | 施策対象者 |
| 施策 | campaign_contents | 配信文/投稿文 |
| 施策 | campaign_results | 施策結果 |
| 発信 | communications | 発信履歴 |
| 承認 | approvals | 承認管理 |
| レポート | reports | レポート |
| 業種テンプレート | industry_templates | 業種別テンプレート |
| エリア | area_profiles | 商圏・競合・地域情報 |
| 監査 | audit_logs | 操作ログ |
| 取込 | import_jobs | データ取込ジョブ |
| 取込 | import_errors | 取込エラー |
| 削除/請求 | data_requests | 開示・削除等の要求管理 |

---

## 4. リレーション概要

### 4.1 基本リレーション

```text
tenants
  └─ stores
       ├─ menus
       ├─ customers
       │    ├─ customer_profiles
       │    ├─ customer_consents
       │    ├─ customer_notes
       │    ├─ reservations
       │    ├─ sales
       │    ├─ customer_needs
       │    └─ customer_insights
       ├─ campaigns
       │    ├─ campaign_targets
       │    ├─ campaign_contents
       │    └─ campaign_results
       ├─ ai_conversations
       │    ├─ ai_messages
       │    └─ ai_recommendations
       ├─ strategy_goals
       │    └─ strategy_goal_actions
       ├─ segment_definitions
       │    └─ segment_members
       ├─ external_tags
       │    └─ external_tag_members
       ├─ reports
       └─ area_profiles
```

### 4.2 代理店利用時のリレーション

```text
agencies
  └─ agency_store_assignments
        └─ stores
              └─ 店舗データ一式
```

代理店は店舗データを直接所有するのではなく、許可された店舗に対する閲覧・編集権限を持つ構造とする。

---

## 5. 共通カラム設計

多くのテーブルに以下の共通カラムを持たせる。

| カラム | 型 | 内容 |
|---|---|---|
| id | UUID | 主キー |
| tenant_id | UUID | テナントID |
| store_id | UUID | 店舗ID。店舗に紐づくデータでは原則必須 |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |
| deleted_at | timestamp nullable | 論理削除日時 |
| created_by | UUID nullable | 作成ユーザー |
| updated_by | UUID nullable | 更新ユーザー |

### 5.1 論理削除方針

初期は、顧客・施策・発信・AIログなどの主要データは論理削除を基本とする。

ただし、個人情報削除要求がある場合は、以下の対応を検討する。

| 対象 | 方針 |
|---|---|
| 顧客氏名・連絡先 | マスキングまたは物理削除 |
| 来店・売上履歴 | 個人識別情報を外して統計化可能な形で保持を検討 |
| AI相談ログ | 個人名・固有情報を削除またはマスキング |
| 施策結果 | 個人単位を外し、集計値として残すことを検討 |

---

## 6. テーブル定義

## 6.1 tenants

### 目的

契約・利用単位を管理する。店舗単体契約、代理店契約、複数店舗契約に対応する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | テナントID |
| name | varchar | 必須 | テナント名 |
| tenant_type | enum | 必須 | store_owner / agency / admin |
| plan_type | enum | 任意 | free / basic / pro / agency 等 |
| status | enum | 必須 | active / suspended / cancelled |
| billing_email | varchar | 任意 | 請求先メール |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |
| deleted_at | timestamp | 任意 | 論理削除日時 |

---

## 6.2 users

### 目的

システム利用者を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ユーザーID |
| email | varchar | 必須 | メールアドレス |
| password_hash | varchar | 任意 | パスワードハッシュ。外部Auth利用時は不要 |
| name | varchar | 必須 | 氏名 |
| status | enum | 必須 | invited / active / suspended |
| last_login_at | timestamp | 任意 | 最終ログイン |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.3 user_tenant_roles

### 目的

ユーザーがどのテナントにどの権限で所属しているかを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| user_id | UUID | 必須 | ユーザーID |
| tenant_id | UUID | 必須 | テナントID |
| role | enum | 必須 | owner / manager / staff / agency_admin / supporter / system_admin |
| status | enum | 必須 | active / inactive |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.4 stores

### 目的

店舗情報を管理する。AI提案・顧客管理・施策管理の中心となる。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 店舗ID |
| tenant_id | UUID | 必須 | テナントID |
| name | varchar | 必須 | 店舗名 |
| industry | enum | 必須 | esthetic / bodycare / gym 等 |
| sub_industry | varchar | 任意 | フェイシャル、痩身、鍼灸等 |
| prefecture | varchar | 任意 | 都道府県 |
| city | varchar | 任意 | 市区町村 |
| area_label | varchar | 必須 | 駅名、商圏名など |
| address | varchar | 任意 | 住所 |
| phone | varchar | 任意 | 電話番号 |
| website_url | text | 任意 | WebサイトURL |
| business_hours | jsonb | 任意 | 営業時間 |
| closed_days | jsonb | 任意 | 定休日 |
| status | enum | 必須 | active / inactive |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |
| deleted_at | timestamp | 任意 | 論理削除 |

---

## 6.5 store_settings

### 目的

店舗ごとのAI提案設定、通知設定、運用設定を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| store_id | UUID | 必須 | 店舗ID |
| main_goal | enum | 任意 | new_customers / repeat / ltv / dormant_reactivation 等 |
| tone | enum | 任意 | polite / friendly / professional |
| ai_suggestion_level | enum | 任意 | conservative / standard / aggressive |
| require_approval_for_external | boolean | 必須 | 外部発信承認必須フラグ |
| default_dormant_days | integer | 任意 | 休眠判定日数 |
| default_pre_dormant_days | integer | 任意 | 休眠予備軍判定日数 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.6 store_tools

### 目的

店舗が利用している外部ツールを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| store_id | UUID | 必須 | 店舗ID |
| tool_type | enum | 必須 | official_line / lstep / lmessage / instagram / google_business / reservation / pos / spreadsheet |
| tool_name | varchar | 任意 | ツール名 |
| usage_status | enum | 必須 | using / considering / not_using |
| external_account_id | varchar | 任意 | 外部ID |
| connection_status | enum | 任意 | not_connected / connected / error |
| notes | text | 任意 | メモ |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.7 menus

### 目的

店舗のメニュー、商品、サービスを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | メニューID |
| store_id | UUID | 必須 | 店舗ID |
| name | varchar | 必須 | メニュー名 |
| category | varchar | 任意 | フェイシャル、整体、体験、回数券など |
| price | integer | 任意 | 価格 |
| duration_minutes | integer | 任意 | 所要時間 |
| is_main | boolean | 必須 | 主力メニューか |
| is_high_value | boolean | 必須 | 高単価メニューか |
| description | text | 任意 | 説明 |
| status | enum | 必須 | active / inactive |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.8 agencies

### 目的

代理店、コンサル、LINE運用代行者などの支援者組織を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 代理店ID |
| tenant_id | UUID | 必須 | テナントID |
| name | varchar | 必須 | 会社名/屋号 |
| support_type | enum | 任意 | line_ops / lstep_build / sns_ops / consulting / other |
| contact_name | varchar | 任意 | 主担当者 |
| contact_email | varchar | 任意 | 連絡先 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.9 agency_store_assignments

### 目的

代理店・コンサルが支援する店舗と権限範囲を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| agency_id | UUID | 必須 | 代理店ID |
| store_id | UUID | 必須 | 店舗ID |
| permission_level | enum | 必須 | view_report / edit_campaign / full_support |
| can_view_personal_data | boolean | 必須 | 個人情報閲覧可否 |
| can_export_data | boolean | 必須 | データ出力可否 |
| status | enum | 必須 | active / inactive |
| started_at | date | 任意 | 支援開始日 |
| ended_at | date | 任意 | 支援終了日 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.10 customers

### 目的

顧客の基本情報を管理する。個人情報を含むため、権限・削除・マスキング対象とする。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 顧客ID |
| store_id | UUID | 必須 | 店舗ID |
| external_customer_id | varchar | 任意 | 予約システム等の外部顧客ID |
| line_user_id | varchar | 将来 | LINE連携時のuserId |
| display_name | varchar | 任意 | 表示名、LINE名など |
| full_name | varchar | 任意 | 氏名 |
| phone | varchar | 任意 | 電話番号 |
| email | varchar | 任意 | メールアドレス |
| first_contact_date | date | 任意 | 初回接点日 |
| acquisition_channel | varchar | 任意 | 流入経路 |
| status | enum | 必須 | active / inactive / deleted |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |
| deleted_at | timestamp | 任意 | 論理削除 |

### 注意

初期段階では、氏名や電話番号を必須にしすぎない。小規模店舗ではLINE名のみ、予約システムIDのみのケースがあり得るため、顧客識別は柔軟にする。

---

## 6.11 customer_profiles

### 目的

顧客属性、補足情報、集計用の非連絡先情報を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| customer_id | UUID | 必須 | 顧客ID |
| store_id | UUID | 必須 | 店舗ID |
| gender | enum | 任意 | female / male / other / unknown |
| age_group | enum | 任意 | 20s / 30s / 40s 等 |
| residential_area | varchar | 任意 | 居住エリア |
| occupation | varchar | 任意 | 職業 |
| preferences | jsonb | 任意 | 好み、注意事項 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.12 customer_consents

### 目的

顧客への連絡同意、分析同意、配信停止状態を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| customer_id | UUID | 必須 | 顧客ID |
| store_id | UUID | 必須 | 店舗ID |
| contact_line_allowed | boolean | 必須 | LINE連絡可否 |
| contact_email_allowed | boolean | 必須 | メール連絡可否 |
| contact_sms_allowed | boolean | 必須 | SMS連絡可否 |
| analysis_allowed | boolean | 必須 | 分析利用可否 |
| external_integration_allowed | boolean | 必須 | 外部連携利用可否 |
| is_unsubscribed | boolean | 必須 | 配信停止状態 |
| unsubscribed_at | timestamp | 任意 | 配信停止日時 |
| consent_source | varchar | 任意 | 同意取得元 |
| consented_at | timestamp | 任意 | 同意取得日時 |
| updated_at | timestamp | 必須 | 更新日時 |

### 注意

配信対象抽出時は、必ずこのテーブルを参照し、配信停止者・同意未取得者を除外する。

---

## 6.13 customer_notes

### 目的

接客メモ、カウンセリングメモ、注意事項、フォロー記録を保存する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | メモID |
| customer_id | UUID | 必須 | 顧客ID |
| store_id | UUID | 必須 | 店舗ID |
| note_type | enum | 必須 | counseling / service / followup / warning / general |
| content | text | 必須 | メモ本文 |
| contains_sensitive_info | boolean | 必須 | センシティブ情報の可能性 |
| created_by | UUID | 任意 | 作成者 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.14 reservations

### 目的

予約・来店・キャンセル履歴を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 予約ID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 任意 | 顧客ID。名寄せ前はNULL許容 |
| external_reservation_id | varchar | 任意 | 外部予約ID |
| reservation_created_at | timestamp | 任意 | 予約受付日時 |
| scheduled_start_at | timestamp | 必須 | 来店予定日時 |
| scheduled_end_at | timestamp | 任意 | 終了予定日時 |
| visited_at | timestamp | 任意 | 実来店日時 |
| menu_id | UUID | 任意 | メニューID |
| menu_name_snapshot | varchar | 任意 | 取込時点のメニュー名 |
| staff_user_id | UUID | 任意 | 担当スタッフ |
| channel | enum | 任意 | official_line / phone / hpb / instagram / web / other |
| status | enum | 必須 | reserved / visited / cancelled / no_show |
| cancellation_reason | text | 任意 | キャンセル理由 |
| has_next_reservation | boolean | 任意 | 次回予約有無 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.15 sales

### 目的

売上・購入・契約・回数券情報を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 売上ID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 任意 | 顧客ID |
| reservation_id | UUID | 任意 | 関連予約ID |
| sale_date | date | 必須 | 売上日 |
| amount | integer | 必須 | 売上金額 |
| menu_id | UUID | 任意 | メニューID |
| item_name_snapshot | varchar | 任意 | 商品/メニュー名 |
| item_category | enum | 任意 | service / product / ticket / subscription / other |
| payment_method | enum | 任意 | cash / card / qr / bank / other |
| ticket_remaining_count | integer | 任意 | 回数券残数 |
| contract_status | enum | 任意 | active / ended / renewal_due |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.16 customer_needs

### 目的

顧客の悩み、目的、問い合わせ、アンケート回答、キャンセル理由などのニーズ情報を構造化する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ニーズID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 必須 | 顧客ID |
| source_type | enum | 必須 | questionnaire / counseling / inquiry / click / review / cancellation / ai_inferred |
| need_category | enum | 任意 | effect_check / price_anxiety / continuation_hesitation / seasonal_issue / trigger_needed / advanced_need / relationship |
| content | text | 任意 | 内容 |
| confidence | enum | 任意 | high / medium / low |
| captured_at | timestamp | 任意 | 取得日時 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.17 customer_insights

### 目的

AIまたは人間が判定した顧客状態、推定ニーズ、阻害要因、次アクションを保存する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | インサイトID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 必須 | 顧客ID |
| insight_date | date | 必須 | 判定日 |
| customer_state | enum | 必須 | new_lead / first_reserved / after_first_visit / repeater / pre_dormant / dormant / vip_candidate / high_risk |
| inferred_needs | jsonb | 任意 | 推定ニーズ配列 |
| blocking_factors | jsonb | 任意 | 行動阻害要因配列 |
| recommended_action | enum | 任意 | line_message / individual_contact / consultation_offer / store_proposal / sns_targeting |
| priority | enum | 必須 | high / medium / low |
| evidence_summary | text | 必須 | 判断根拠要約 |
| ai_confidence | enum | 必須 | high / medium / low |
| valid_until | date | 任意 | 再判定期限 |
| review_status | enum | 必須 | unreviewed / confirmed / modified |
| created_by_ai | boolean | 必須 | AI作成か |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

### 注意

顧客の現在状態を高速表示するため、customersにcurrent_insight_idを持たせる案もある。ただし冗長管理になるため、初期は最新insightをクエリで取得する方針でもよい。

---

## 6.18 segment_definitions

### 目的

施策目的に応じたセグメント条件を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | セグメントID |
| store_id | UUID | 必須 | 店舗ID |
| name | varchar | 必須 | セグメント名 |
| purpose | enum | 必須 | first_followup / dormant_reactivation / upsell / renewal / vip / custom |
| condition_json | jsonb | 必須 | 抽出条件 |
| generated_by | enum | 必須 | ai / user / template |
| description | text | 任意 | 説明 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.19 segment_members

### 目的

セグメントに含まれる顧客を保存する。抽出時点のスナップショットとして扱う。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| segment_id | UUID | 必須 | セグメントID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 必須 | 顧客ID |
| inclusion_reason | text | 任意 | 対象理由 |
| excluded | boolean | 必須 | 除外されたか |
| exclusion_reason | varchar | 任意 | 配信停止、同意なし、手動除外など |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.20 external_tags

### 目的

公式LINE、Lステップ、L Message等で使う最小限の外部タグを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 外部タグID |
| store_id | UUID | 必須 | 店舗ID |
| external_tool_type | enum | 必須 | official_line / lstep / lmessage |
| tag_name | varchar | 必須 | 外部ツール用タグ名 |
| tag_type | enum | 必須 | state / campaign / warning / channel |
| purpose | text | 必須 | 作成理由 |
| source_segment_id | UUID | 任意 | 元セグメントID |
| effective_from | date | 任意 | 有効開始日 |
| effective_until | date | 任意 | 有効期限 |
| sync_status | enum | 必須 | not_synced / exported / synced / delete_required / deleted |
| created_by | enum | 必須 | ai / user / imported |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.21 external_tag_members

### 目的

外部タグの対象者を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| external_tag_id | UUID | 必須 | 外部タグID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 必須 | 顧客ID |
| external_customer_id | varchar | 任意 | 外部ツール上の顧客ID |
| export_status | enum | 必須 | pending / exported / failed |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.22 ai_conversations

### 目的

AI相談のスレッドを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | AI相談ID |
| store_id | UUID | 必須 | 店舗ID |
| user_id | UUID | 必須 | 相談者 |
| category | enum | 任意 | sales / acquisition / repeat / dormant / upsell / line / sns / google / lstep / report / other |
| title | varchar | 任意 | 相談タイトル |
| status | enum | 必須 | active / archived |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.23 ai_messages

### 目的

AI相談のユーザー入力・AI回答を保存する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | メッセージID |
| conversation_id | UUID | 必須 | AI相談ID |
| store_id | UUID | 必須 | 店舗ID |
| role | enum | 必須 | user / assistant / system |
| content | text | 必須 | 内容 |
| content_summary | text | 任意 | 要約 |
| risk_flag | boolean | 必須 | リスク表現や機密情報の可能性 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.24 ai_recommendations

### 目的

AIが生成した提案、診断、アクション案、改善案を保存する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | AI提案ID |
| store_id | UUID | 必須 | 店舗ID |
| conversation_id | UUID | 任意 | AI相談ID |
| recommendation_type | enum | 必須 | diagnosis / action_plan / segment / content / improvement / lstep_judgement / report / strategy_goal |
| title | varchar | 必須 | 提案タイトル |
| summary | text | 必須 | 提案要約 |
| target_type | enum | 任意 | store / customer / segment / campaign / channel |
| target_id | UUID | 任意 | 対象ID |
| purpose | text | 任意 | 目的 |
| evidence_summary | text | 必須 | 根拠要約 |
| referenced_data_types | jsonb | 任意 | 参照データ種別 |
| confidence | enum | 必須 | high / medium / low |
| cautions | jsonb | 任意 | 注意点 |
| suggested_next_action | text | 任意 | 次の操作 |
| adoption_status | enum | 必須 | proposed / adopted / rejected / pending |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.25 ai_reference_logs

### 目的

AI回答が参照したデータ種別や対象期間を監査できるようにする。個人情報の過剰保存を避けるため、原則として要約・ID参照・メタ情報中心とする。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 参照ログID |
| ai_recommendation_id | UUID | 必須 | AI提案ID |
| store_id | UUID | 必須 | 店舗ID |
| data_type | enum | 必須 | sales / customers / reservations / campaigns / communications / area / notes |
| reference_period_start | date | 任意 | 参照期間開始 |
| reference_period_end | date | 任意 | 参照期間終了 |
| referenced_count | integer | 任意 | 参照件数 |
| reference_summary | text | 任意 | 参照内容要約 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.26 strategy_goals

### 目的

店舗が今月・今期に優先する売上改善目的を保存する。施策提案の前段で Why を明確化し、KPI候補、対象顧客、推奨チャネル、推奨施策候補へつなげる。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 戦略目的ID |
| tenant_id | UUID | 必須 | テナントID |
| store_id | UUID | 必須 | 店舗ID |
| period_type | enum | 必須 | monthly / quarterly |
| period_start | date | 必須 | 対象期間開始日 |
| period_end | date | 必須 | 対象期間終了日 |
| title | varchar | 必須 | 重点目的名 |
| purpose | text | 必須 | 目的本文 |
| why_summary | text | 必須 | なぜこの目的を優先するか |
| evidence_summary | text | 必須 | 判断根拠要約 |
| kpi_candidates | jsonb | 任意 | KPI候補配列 |
| target_customer_segments | jsonb | 任意 | 対象顧客候補 |
| recommended_channels | jsonb | 任意 | 推奨チャネル |
| confidence | enum | 必須 | high / medium / low |
| cautions | jsonb | 任意 | 注意点 |
| missing_data | jsonb | 任意 | 不足データ |
| source_type | enum | 必須 | rule_based / ai_mock / ai_generated / user |
| status | enum | 必須 | draft / proposed / approved / archived |
| ai_recommendation_id | UUID | 任意 | 元AI提案ID |
| approved_by_user_id | UUID | 任意 | 承認ユーザーID |
| approved_at | timestamp | 任意 | 承認日時 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

### 注意

Phase1ではダッシュボードの「今月の重点目的カード」表示に必要な最小項目のみを利用する。詳細なKPI目標管理、施策連携、月次レポート反映はPhase2以降とする。

---

## 6.27 strategy_goal_actions

### 目的

戦略目的から展開する推奨施策候補を保存する。Phase1では候補表示に留め、実際の顧客向け発信・外部投稿は人間承認後に既存の施策管理へ展開する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 戦略目的施策ID |
| strategy_goal_id | UUID | 必須 | 戦略目的ID |
| tenant_id | UUID | 必須 | テナントID |
| store_id | UUID | 必須 | 店舗ID |
| action_type | enum | 必須 | line_message / individual_contact / sns_post / google_post / in_store / analysis / other |
| title | varchar | 必須 | 推奨施策名 |
| description | text | 任意 | 施策概要 |
| recommended_channel | enum | 任意 | official_line / individual_contact / instagram / google / in_store / other |
| target_segment_definition_id | UUID | 任意 | 対象セグメントID |
| campaign_id | UUID | 任意 | 施策化したcampaign ID |
| priority | enum | 必須 | high / medium / low |
| approval_required | boolean | 必須 | 人間承認が必要か |
| status | enum | 必須 | proposed / adopted / rejected / converted |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.28 campaigns

### 目的

LINE配信、SNS投稿、Google投稿、個別対応、店頭施策などを施策単位で管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 施策ID |
| store_id | UUID | 必須 | 店舗ID |
| created_from_recommendation_id | UUID | 任意 | 元AI提案ID |
| name | varchar | 必須 | 施策名 |
| purpose | enum | 必須 | new_customer / repeat / first_followup / dormant_reactivation / upsell / renewal / awareness / custom |
| channel | enum | 必須 | official_line / lstep / instagram / google_business / email / sms / phone / in_store / flyer |
| status | enum | 必須 | proposed / draft / approval_pending / approved / executed / result_pending / reviewed / on_hold |
| scheduled_at | timestamp | 任意 | 実施予定日時 |
| executed_at | timestamp | 任意 | 実施日時 |
| owner_user_id | UUID | 任意 | 担当者 |
| target_segment_id | UUID | 任意 | 対象セグメント |
| target_count | integer | 任意 | 対象人数 |
| caution_summary | text | 任意 | 注意点 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.29 campaign_targets

### 目的

施策対象者をスナップショットとして保存する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ID |
| campaign_id | UUID | 必須 | 施策ID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 任意 | 顧客ID |
| target_reason | text | 任意 | 対象理由 |
| excluded | boolean | 必須 | 除外有無 |
| exclusion_reason | varchar | 任意 | 配信停止、同意なし、手動除外など |
| delivery_status | enum | 任意 | pending / sent / failed / manual_done / skipped |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.30 campaign_contents

### 目的

施策で使用するLINE文、Instagram投稿文、Google投稿文、メール文などを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | コンテンツID |
| campaign_id | UUID | 任意 | 施策ID |
| store_id | UUID | 必須 | 店舗ID |
| content_type | enum | 必須 | line / instagram / google_business / email / pop / flyer |
| title | varchar | 任意 | 件名・タイトル |
| body | text | 必須 | 本文 |
| cta | text | 任意 | 行動導線 |
| tone | enum | 任意 | polite / friendly / professional |
| generated_by_ai | boolean | 必須 | AI生成か |
| ai_recommendation_id | UUID | 任意 | 元AI提案ID |
| expression_risk_level | enum | 任意 | none / low / medium / high |
| expression_check_result | jsonb | 任意 | 表現チェック結果 |
| approval_status | enum | 必須 | draft / approval_pending / approved / rejected |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.31 campaign_results

### 目的

施策実行後の反応、予約、来店、売上を記録する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 結果ID |
| campaign_id | UUID | 必須 | 施策ID |
| store_id | UUID | 必須 | 店舗ID |
| result_input_method | enum | 必須 | manual / csv / api |
| sent_count | integer | 任意 | 配信数/対象数 |
| opened_count | integer | 任意 | 開封数。取得可能な場合 |
| clicked_count | integer | 任意 | クリック数 |
| replied_count | integer | 任意 | 返信数 |
| reserved_count | integer | 任意 | 予約数 |
| visited_count | integer | 任意 | 来店数 |
| sales_amount | integer | 任意 | 施策起因売上 |
| staff_memo | text | 任意 | 店舗所感 |
| ai_improvement_summary | text | 任意 | AI改善案要約 |
| reviewed_at | timestamp | 任意 | 振り返り日時 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.32 communications

### 目的

LINE配信、Instagram投稿、Google投稿、個別連絡などの発信履歴を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 発信ID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 任意 | 個別発信の場合の顧客ID |
| campaign_id | UUID | 任意 | 関連施策ID |
| channel | enum | 必須 | official_line / lstep / instagram / google_business / email / sms / phone / in_store |
| direction | enum | 必須 | outbound / inbound |
| content_summary | text | 任意 | 内容要約 |
| content_id | UUID | 任意 | campaign_contents ID |
| sent_at | timestamp | 任意 | 送信/投稿日時 |
| response_status | enum | 任意 | no_response / replied / clicked / reserved / visited |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.33 approvals

### 目的

顧客向け文案、外部投稿文、施策、代理店提案書などの承認状態を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 承認ID |
| store_id | UUID | 必須 | 店舗ID |
| approval_target_type | enum | 必須 | campaign / content / report / lstep_scenario |
| approval_target_id | UUID | 必須 | 対象ID |
| requested_by | UUID | 必須 | 申請者 |
| approver_id | UUID | 任意 | 承認者 |
| status | enum | 必須 | pending / approved / rejected / cancelled |
| comment | text | 任意 | コメント |
| requested_at | timestamp | 必須 | 申請日時 |
| decided_at | timestamp | 任意 | 承認/差戻し日時 |

---

## 6.34 reports

### 目的

初期診断、月次改善、顧客状態、施策結果、代理店提案レポートを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | レポートID |
| store_id | UUID | 必須 | 店舗ID |
| report_type | enum | 必須 | initial_diagnosis / monthly / customer_state / dormant / campaign_result / lstep_judgement / agency_proposal |
| title | varchar | 必須 | レポート名 |
| period_start | date | 任意 | 対象期間開始 |
| period_end | date | 任意 | 対象期間終了 |
| body_markdown | text | 任意 | Markdown本文 |
| summary | text | 任意 | 要約 |
| generated_by_ai | boolean | 必須 | AI生成か |
| status | enum | 必須 | draft / shared / archived |
| contains_personal_data | boolean | 必須 | 個人情報を含むか |
| created_by | UUID | 任意 | 作成者 |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.35 industry_templates

### 目的

業種別のKPI、顧客状態、ニーズ分類、施策テンプレート、禁止表現を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | テンプレートID |
| industry | enum | 必須 | esthetic / bodycare / gym 等 |
| template_type | enum | 必須 | kpi / customer_state / need_category / campaign / content / prohibited_expression |
| name | varchar | 必須 | テンプレート名 |
| config_json | jsonb | 必須 | 設定内容 |
| description | text | 任意 | 説明 |
| status | enum | 必須 | active / inactive |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.36 area_profiles

### 目的

商圏、競合、地域ニーズ、季節要因を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | エリア情報ID |
| store_id | UUID | 必須 | 店舗ID |
| area_name | varchar | 必須 | 商圏名、駅名、市区町村 |
| competitor_info | jsonb | 任意 | 競合情報 |
| competitor_price_info | jsonb | 任意 | 競合価格帯 |
| local_needs_memo | text | 任意 | 地域ニーズメモ |
| seasonal_factors | jsonb | 任意 | 季節要因 |
| local_events | jsonb | 任意 | 地域イベント |
| search_keywords | jsonb | 将来 | 検索テーマ |
| created_at | timestamp | 必須 | 作成日時 |
| updated_at | timestamp | 必須 | 更新日時 |

---

## 6.37 import_jobs

### 目的

CSV、スプレッドシート、手入力によるデータ取込履歴を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 取込ジョブID |
| store_id | UUID | 必須 | 店舗ID |
| import_type | enum | 必須 | customers / reservations / sales / campaigns / communications |
| source_type | enum | 必須 | csv / spreadsheet / manual / api |
| file_name | varchar | 任意 | ファイル名 |
| status | enum | 必須 | pending / processing / completed / failed |
| total_rows | integer | 任意 | 総件数 |
| success_rows | integer | 任意 | 成功件数 |
| error_rows | integer | 任意 | エラー件数 |
| executed_by | UUID | 任意 | 実行者 |
| started_at | timestamp | 任意 | 開始日時 |
| completed_at | timestamp | 任意 | 完了日時 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.38 import_errors

### 目的

取込時のエラー詳細を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | エラーID |
| import_job_id | UUID | 必須 | 取込ジョブID |
| store_id | UUID | 必須 | 店舗ID |
| row_number | integer | 任意 | 行番号 |
| field_name | varchar | 任意 | 項目名 |
| error_type | enum | 必須 | missing_required / invalid_format / duplicated / mapping_error / unknown |
| error_message | text | 必須 | エラー内容 |
| raw_data | jsonb | 任意 | 元データ |
| created_at | timestamp | 必須 | 作成日時 |

---

## 6.39 audit_logs

### 目的

重要操作の監査ログを管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | ログID |
| tenant_id | UUID | 任意 | テナントID |
| store_id | UUID | 任意 | 店舗ID |
| user_id | UUID | 任意 | 操作者 |
| action | varchar | 必須 | 操作種別 |
| target_type | varchar | 任意 | 対象テーブル/対象種別 |
| target_id | UUID | 任意 | 対象ID |
| before_snapshot | jsonb | 任意 | 変更前 |
| after_snapshot | jsonb | 任意 | 変更後 |
| ip_address | varchar | 任意 | IPアドレス |
| user_agent | text | 任意 | User-Agent |
| created_at | timestamp | 必須 | 作成日時 |

### 記録対象例

- 顧客情報の閲覧・編集・削除
- CSV取込
- 顧客データ出力
- AI文案生成
- 施策承認
- 配信対象リスト出力
- 代理店権限変更
- 同意状態変更

---

## 6.40 data_requests

### 目的

顧客または店舗からの開示、訂正、削除、利用停止要求を管理する。

| カラム | 型 | 必須 | 内容 |
|---|---|---|---|
| id | UUID | 必須 | 要求ID |
| store_id | UUID | 必須 | 店舗ID |
| customer_id | UUID | 任意 | 対象顧客ID |
| request_type | enum | 必須 | disclosure / correction / deletion / suspension |
| requested_by_name | varchar | 任意 | 申請者名 |
| requested_by_contact | varchar | 任意 | 連絡先 |
| status | enum | 必須 | received / verifying / completed / rejected |
| response_note | text | 任意 | 対応メモ |
| requested_at | timestamp | 必須 | 申請日時 |
| completed_at | timestamp | 任意 | 完了日時 |
| created_at | timestamp | 必須 | 作成日時 |

---

## 7. ER図テキスト版

```text
tenants 1 ── n stores
users n ── n tenants via user_tenant_roles
users n ── n stores via user_store_roles

stores 1 ── n menus
stores 1 ── n store_tools
stores 1 ── n customers
stores 1 ── n reservations
stores 1 ── n sales
stores 1 ── n strategy_goals
stores 1 ── n campaigns
stores 1 ── n ai_conversations
stores 1 ── n reports
stores 1 ── n area_profiles

customers 1 ── 1 customer_profiles
customers 1 ── n customer_consents
customers 1 ── n customer_notes
customers 1 ── n reservations
customers 1 ── n sales
customers 1 ── n customer_needs
customers 1 ── n customer_insights
customers n ── n campaigns via campaign_targets
customers n ── n segment_definitions via segment_members

segment_definitions 1 ── n segment_members
segment_definitions 1 ── n external_tags
external_tags 1 ── n external_tag_members

campaigns 1 ── n campaign_targets
campaigns 1 ── n campaign_contents
campaigns 1 ── n campaign_results
campaigns 1 ── n communications
campaigns n ── 1 ai_recommendations

ai_conversations 1 ── n ai_messages
ai_conversations 1 ── n ai_recommendations
ai_recommendations 1 ── n ai_reference_logs
ai_recommendations 1 ── n campaigns
ai_recommendations 1 ── n strategy_goals
strategy_goals 1 ── n strategy_goal_actions
strategy_goal_actions n ── 0..1 campaigns

agencies 1 ── n agency_store_assignments
stores 1 ── n agency_store_assignments
```

---

## 8. 主要Enum定義

### 8.1 customer_state

| 値 | 内容 |
|---|---|
| new_lead | 新規リード |
| first_reserved | 初回予約済 |
| after_first_visit | 初回来店後 |
| repeater | リピーター |
| pre_dormant | 休眠予備軍 |
| dormant | 休眠顧客 |
| vip_candidate | VIP候補 |
| high_risk | 離脱リスク高 |

### 8.2 need_category

| 値 | 内容 |
|---|---|
| effect_check | 効果確認 |
| price_anxiety | 価格不安 |
| continuation_hesitation | 継続迷い |
| seasonal_issue | 季節悩み |
| decision_lacking | 決め手不足 |
| trigger_needed | 再開きっかけ不足 |
| advanced_need | 高度化ニーズ |
| relationship | 関係性重視 |

### 8.3 campaign_status

| 値 | 内容 |
|---|---|
| proposed | 提案中 |
| draft | 下書き |
| approval_pending | 承認待ち |
| approved | 承認済み |
| executed | 実行済み |
| result_pending | 結果入力待ち |
| reviewed | 振り返り済み |
| on_hold | 保留 |

### 8.4 channel

| 値 | 内容 |
|---|---|
| official_line | 公式LINE |
| lstep | Lステップ |
| lmessage | L Message |
| instagram | Instagram |
| google_business | Googleビジネスプロフィール |
| email | メール |
| sms | SMS |
| phone | 電話 |
| in_store | 店頭対応 |
| flyer | チラシ |

### 8.5 approval_status

| 値 | 内容 |
|---|---|
| draft | 下書き |
| approval_pending | 承認待ち |
| approved | 承認済み |
| rejected | 差戻し |

---

## 9. インデックス設計

### 9.1 基本インデックス

| テーブル | インデックス | 目的 |
|---|---|---|
| stores | tenant_id | テナント配下店舗検索 |
| customers | store_id | 店舗別顧客検索 |
| customers | store_id, full_name | 顧客検索 |
| customers | store_id, phone | 重複検知 |
| customers | store_id, email | 重複検知 |
| reservations | store_id, scheduled_start_at | 予約期間検索 |
| reservations | customer_id, scheduled_start_at | 顧客別予約履歴 |
| sales | store_id, sale_date | 売上期間集計 |
| sales | customer_id, sale_date | 顧客別LTV集計 |
| customer_insights | store_id, customer_state | 状態別抽出 |
| customer_insights | customer_id, insight_date | 最新インサイト取得 |
| campaigns | store_id, status | 施策ステータス検索 |
| campaigns | store_id, scheduled_at | 施策予定検索 |
| campaign_targets | campaign_id | 施策対象者取得 |
| ai_conversations | store_id, created_at | AI相談履歴 |
| reports | store_id, report_type, period_start | レポート検索 |

### 9.2 注意

顧客一覧、セグメント抽出、ダッシュボード集計は高頻度で参照されるため、以下は将来的にマテリアライズドビューや集計テーブルを検討する。

- 顧客ごとの最終来店日
- 顧客ごとの累計売上
- 顧客ごとの来店回数
- 顧客ごとの最新インサイト
- 月次売上サマリ
- 施策結果サマリ

---

## 10. データ取込・名寄せ方針

### 10.1 初期取込方式

| 方式 | 内容 |
|---|---|
| CSV取込 | 顧客、予約、売上、施策結果をCSVで取り込む |
| スプレッドシート連携 | Googleスプレッドシートから手動または定期取込 |
| 手入力 | 少量データや初期診断用情報を手入力 |

### 10.2 名寄せ候補条件

顧客データ取込時は、以下の条件で重複候補を表示する。

| 優先度 | 条件 |
|---|---|
| 高 | 電話番号一致 |
| 高 | メールアドレス一致 |
| 中 | 氏名 + 初回来店日一致 |
| 中 | 氏名 + 生年月日/年代 + 流入経路一致 |
| 低 | LINE表示名類似 |

### 10.3 名寄せ注意点

- 自動統合は初期では避ける
- 重複候補として提示し、人間確認後に統合する
- 統合前後の履歴をaudit_logsに残す
- 外部顧客IDが異なる場合、統合後も外部IDを保持できるようにする

---

## 11. 同意・配信停止・削除要求の設計

### 11.1 配信対象抽出時の必須条件

LINEやメールなど顧客向け配信では、対象者抽出時に以下を必ず確認する。

```text
contact_line_allowed = true
AND is_unsubscribed = false
AND customer.status = active
```

チャネルに応じて、email、smsなどの同意項目を参照する。

### 11.2 削除要求時の基本対応

| データ | 対応 |
|---|---|
| 氏名・電話・メール | 削除またはマスキング |
| LINE userId | 削除または無効化 |
| 接客メモ | 個人特定部分を削除または全文削除 |
| 売上・来店履歴 | 個人IDを外して統計化できるか検討 |
| AI相談ログ | 個人情報を含む場合はマスキング |

---

## 12. AIデータ設計

### 12.1 AIに渡すデータの基本方針

AIには、相談内容に応じて必要なデータのみを渡す。

| 相談内容 | 主に参照するデータ |
|---|---|
| 売上相談 | sales, reservations, campaigns, campaign_results |
| 休眠客対策 | customers, reservations, customer_insights, communications |
| LINE配信相談 | customer_consents, customer_insights, campaign_results |
| Lステップ判断 | customers, campaigns, store_tools, segment_definitions |
| SNS相談 | stores, menus, area_profiles, communications |
| レポート作成 | sales, reservations, campaigns, campaign_results, customer_insights |
| 戦略目的整理 | sales, reservations, customer_insights, campaigns, campaign_results, store_settings |

### 12.2 AI出力保存方針

AI出力は以下の単位で保存する。

| 出力 | 保存先 |
|---|---|
| 相談履歴 | ai_conversations / ai_messages |
| 提案内容 | ai_recommendations |
| 戦略目的 | strategy_goals |
| 戦略目的に紐づく推奨施策 | strategy_goal_actions |
| 参照データ | ai_reference_logs |
| 文案 | campaign_contents |
| 施策化した内容 | campaigns |
| 改善案 | campaign_results または ai_recommendations |
| レポート | reports |

### 12.3 AIログの注意点

- 原文をすべて長期保存するかは要検討
- 個人情報を含む相談内容はマスキング対象にする
- AI提案の根拠と信頼度は必ず保存する
- プロンプト全文を保存する場合はアクセス権限を厳格化する

---

## 13. 匿名集計・横断分析設計

### 13.1 横断分析に使える候補データ

| データ | 利用条件 |
|---|---|
| 顧客状態分布 | 個人・店舗が特定されない件数以上 |
| 施策種別ごとの反応率 | 業種・規模別に集計 |
| 休眠復帰施策の予約転換率 | 十分な施策件数がある場合 |
| 業種別平均LTV | 店舗特定を避ける |
| 地域別ニーズ傾向 | 個別店舗が推測されない粒度 |
| AI相談カテゴリ傾向 | 固有名詞・機密情報を除去 |

### 13.2 初期の最小集計数案

| 集計対象 | 最小件数案 |
|---|---|
| 顧客単位集計 | 50件以上 |
| 店舗ベンチマーク | 同カテゴリ5店舗以上 |
| 施策成功パターン | 同種施策10件以上 |
| 地域別分析 | 同地域または近隣カテゴリで一定件数以上 |

### 13.3 分析用ビュー候補

将来的に以下のビューを作成する。

- v_store_monthly_summary
- v_customer_ltv_summary
- v_customer_state_distribution
- v_campaign_performance_summary
- v_industry_benchmark_summary
- v_area_need_summary

---

## 14. MVPで必須のテーブル

初期MVPで最低限必要なテーブルは以下である。

| 優先 | テーブル |
|---|---|
| 必須 | tenants |
| 必須 | users |
| 必須 | user_tenant_roles |
| 必須 | stores |
| 必須 | store_settings |
| 必須 | store_tools |
| 必須 | menus |
| 必須 | customers |
| 必須 | customer_consents |
| 必須 | reservations |
| 必須 | sales |
| 必須 | customer_insights |
| 必須 | segment_definitions |
| 必須 | segment_members |
| 必須 | ai_conversations |
| 必須 | ai_messages |
| 必須 | ai_recommendations |
| 必須 | strategy_goals |
| 必須 | campaigns |
| 必須 | campaign_targets |
| 必須 | campaign_contents |
| 必須 | campaign_results |
| 必須 | reports |
| 必須 | import_jobs |
| 必須 | audit_logs |

### 14.1 MVPでは後回しでもよいテーブル

| テーブル | 理由 |
|---|---|
| agencies | 代理店機能を初期後半にする場合 |
| agency_store_assignments | 同上 |
| external_tags | 初期は対象者リスト出力のみでも成立するため |
| external_tag_members | 同上 |
| area_profiles | 初期は店舗設定内の簡易項目でもよい |
| industry_templates | 初期は固定マスタでもよい |
| data_requests | 運用フローで暫定対応可能。ただし正式リリース前には必要 |
| strategy_goal_actions | Phase1は重点目的カードのみで、詳細な施策連携はPhase2以降でもよい |

---

## 14.2 Phase 5 追加テーブル（LINE Messaging）

Phase 5（LINE配信実行）で追加するテーブルは以下である。

| テーブル | 目的 |
|---|---|
| line_accounts | LINE Official Accountの認証情報・Webhook設定 |
| line_friends | LINE友だち情報・既存顧客との紐付け |
| line_friend_tags | LINE友だち用タグ定義 |
| line_friend_tag_assignments | 友だちへのタグ付与 |
| line_broadcasts | 一斉/セグメント配信管理 |
| line_broadcast_insights | 配信結果（delivered/impression/clicks） |
| line_scenarios | ステップ配信シナリオ定義 |
| line_scenario_steps | シナリオステップ（タイミング・メッセージ） |
| line_friend_scenarios | 友だちのシナリオ進行状態 |
| line_auto_replies | キーワード自動応答ルール |
| line_rich_menus | リッチメニュー管理 |

### 14.2.1 line_accounts

LINE Official Accountの認証情報を店舗ごとに管理する。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| id | uuid | 必須 | PK |
| store_id | uuid | 必須 | FK → stores |
| name | varchar | 必須 | アカウント識別名 |
| channel_id | varchar | 必須 | LINE Channel ID |
| channel_access_token | text | 必須 | アクセストークン（暗号化推奨） |
| channel_secret | varchar | 必須 | チャンネルシークレット（暗号化推奨） |
| liff_id | varchar | 任意 | LIFF App ID |
| is_active | boolean | 必須 | 有効/無効 |
| created_at | timestamptz | 必須 | |
| updated_at | timestamptz | 必須 | |

### 14.2.2 line_friends

LINE友だちと既存顧客の紐付けを管理する。line_user_idはlineアカウント内でユニーク。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| id | uuid | 必須 | PK |
| store_id | uuid | 必須 | FK → stores |
| line_account_id | uuid | 必須 | FK → line_accounts |
| customer_id | uuid | 任意 | FK → customers（既存顧客と紐付け） |
| line_user_id | varchar | 必須 | LINE userId |
| display_name | varchar | 任意 | 表示名（ログに出力禁止） |
| picture_url | varchar | 任意 | プロフィール画像URL |
| is_following | boolean | 必須 | フォロー中/ブロック済 |
| followed_at | timestamptz | 任意 | フォロー日時 |
| unfollowed_at | timestamptz | 任意 | ブロック/アンフォロー日時 |
| created_at | timestamptz | 必須 | |
| updated_at | timestamptz | 必須 | |

ユニーク制約: `(line_account_id, line_user_id)`

### 14.2.3 line_broadcasts

承認済み文案からのLINE配信ジョブを管理する。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| id | uuid | 必須 | PK |
| store_id | uuid | 必須 | FK → stores |
| line_account_id | uuid | 必須 | FK → line_accounts |
| campaign_content_id | uuid | 任意 | FK → campaign_contents（承認済み文案） |
| target_type | enum | 必須 | all / tag / segment |
| segment_condition | jsonb | 任意 | 対象者抽出条件 |
| status | enum | 必須 | draft / scheduled / sending / sent / failed |
| scheduled_at | timestamptz | 任意 | 予約配信日時 |
| total_count | integer | 任意 | 対象数 |
| success_count | integer | 任意 | 成功数 |
| batch_offset | integer | 必須 | 再開用オフセット（default: 0） |
| created_at | timestamptz | 必須 | |
| updated_at | timestamptz | 必須 | |

---

## 15. 実装上の注意点

### 15.1 初期から避けるべき設計

| 避ける設計 | 理由 |
|---|---|
| 外部LINEタグを中心にしたDB設計 | 公式LINE/Lステップ仕様に引っ張られすぎるため |
| 顧客状態をcustomersだけに固定保存 | 顧客状態の履歴や根拠が消えるため |
| AI回答を文字列だけで保存 | 提案の再利用・施策化・分析ができないため |
| 施策と発信文を分離しない設計 | 結果改善や再利用が難しくなるため |
| 配信停止を単なるメモ管理にする設計 | 誤配信リスクが高い |
| 代理店に全店舗データを広く見せる設計 | 情報漏えいリスクが高い |

### 15.2 重要な設計判断

- 顧客状態は履歴管理する
- 施策対象者は実行時点のスナップショットとして保存する
- 外部タグは施策実行用の最小情報として扱う
- AI提案は施策・文案・レポートに変換できる構造にする
- 同意状態と配信停止は配信対象抽出の必須条件にする
- 代理店権限は店舗単位で明示的に管理する

---

## 16. 未確定論点

次に詰めるべき論点は以下である。

1. 顧客の氏名・電話番号・メールをどこまで必須にするか
2. LINE userIdをどのフェーズで取得するか
3. 顧客状態の最新値をcustomersに冗長保持するか
4. AI相談ログの全文保存期間をどうするか
5. 施策結果の売上貢献をどのロジックで紐づけるか
6. 代理店が個人情報を閲覧できる条件をどうするか
7. 匿名集計データの最小件数を正式に何件にするか
8. 顧客削除要求時に売上履歴をどの粒度で残すか
9. 外部タグの有効期限切れ後の削除・棚卸しをどう運用するか
10. 業種テンプレートをDB管理にするか、コード/設定ファイル管理にするか

---

## 17. 次に作成する仕様書

本書の次に作成する仕様書は以下を推奨する。

1. 同意管理・プライバシー仕様書 v0.1
2. 業種別テンプレート仕様書 v0.1
3. 代理店・コンサル利用仕様書 v0.1
4. 公式LINE/Lステップ連携方針書 v0.1
5. API設計書 v0.1
6. 開発ロードマップ v0.2
