# AIコンサルCRM アーキテクチャ設計書 v0.1

## 1. 本書の目的

本書は、AIコンサルCRMのPhase1開発に向けて、システム全体の技術構成、責務分離、ディレクトリ構成、データフロー、主要コンポーネント、外部連携方針、Claude Codeでの開発前提を定義するものである。

本プロジェクトは、VSCode + Claude Code を用いて開発を進める。

そのため、本書では以下を明確にする。

- フロントエンド、バックエンド、DB、AI連携の責務
- Phase1で実装する範囲
- Phase1で実装しない範囲
- 推奨リポジトリ構成
- アプリケーション分割方針
- データモデルの中心設計
- CSV取込の処理構造
- 顧客状態判定の設計
- AI診断の初期実装方針
- セキュリティ・権限・監査ログの基本設計
- Claude Codeに守らせる実装上の制約

---

## 2. アーキテクチャ基本方針

### 2.1 基本思想

AIコンサルCRMは、初期段階では外部API連携や自動配信を中心にしたシステムではなく、店舗データを整理し、顧客状態を可視化し、店舗が次に取るべき行動を判断できるようにする業務支援システムとして構築する。

Phase1では、以下の流れを通すことを最優先にする。

```text
店舗登録
↓
顧客CSV・予約/来店CSV・売上CSV取込
↓
顧客状態判定
↓
ダッシュボード表示
↓
診断カード・今週のアクション表示
```

### 2.2 Phase1の設計方針

| 方針 | 内容 |
|---|---|
| 外部API非依存 | LINE、Lステップ、Instagram、Google APIには接続しない |
| CSV中心 | 顧客・予約/来店・売上データはCSV取込を中心にする |
| ルールベース優先 | 顧客状態判定はAIではなくルールベースから始める |
| AIは軽量 | Phase1では診断モックまたは軽量AI診断に留める |
| テナント/店舗分離 | すべての業務データは tenant_id / store_id を考慮する |
| 個人情報保護 | 顧客情報はログ・AI入力・CSV出力で慎重に扱う |
| 監査ログ | CSV取込、同意変更、診断実行など重要操作を記録する |
| Claude Code向け | 実装対象・禁止対象・責務分離を明確にする |

---

## 3. 推奨技術構成

## 3.1 初期推奨構成

Phase1では、以下の構成を推奨する。

| 領域 | 推奨技術 | 理由 |
|---|---|---|
| フロントエンド | React + TypeScript + Vite または Next.js | UI開発しやすく、Claude Codeでも扱いやすい |
| バックエンド | Django REST Framework または FastAPI | CSV、DB、認証、管理系APIと相性が良い |
| DB | PostgreSQL | 顧客・予約・売上・分析データの管理に適している |
| 認証 | Django Auth / JWT / Session | 初期はシンプルに始めやすい |
| ファイル保存 | ローカル保存 → S3互換へ拡張 | Phase1はローカルでも検証可能 |
| AI連携 | AI Provider Adapter | OpenAI/Gemini等を後から切替可能にする |
| 非同期処理 | Phase1は同期中心、後でCelery等 | まずは実装負荷を下げる |
| 開発支援 | VSCode + Claude Code | 小タスク単位で実装する |

### 3.2 技術選定の判断

Phase1では、開発速度と保守性を優先する。

特に、CSV取込、データ管理、権限管理、管理画面の実装が多いため、バックエンドは Django REST Framework が有力である。

ただし、既存の開発メンバーが FastAPI や Node.js に強い場合は、同等の責務分離を守れば変更可能とする。

### 3.3 初期構成案

```text
Frontend: React + TypeScript
Backend: Django REST Framework
DB: PostgreSQL
AI: Provider Adapter経由で呼び出し
Storage: local media / 将来S3互換
Development: VSCode + Claude Code
```

---

## 4. システム全体構成

### 4.1 論理構成

```text
[Frontend]
  - ログイン
  - 初期セットアップ
  - ダッシュボード
  - 顧客一覧
  - 顧客詳細
  - データ取込
  - 店舗設定

        ↓ REST API

[Backend API]
  - 認証・認可
  - 店舗管理
  - 顧客管理
  - 予約/来店管理
  - 売上管理
  - CSV取込
  - 顧客状態判定
  - ダッシュボード集計
  - 診断カード生成
  - 監査ログ

        ↓ ORM

[PostgreSQL]
  - users / tenants / stores
  - customers / customer_consents
  - reservations / sales
  - import_jobs / import_errors
  - customer_insights
  - audit_logs

        ↓ optional

[AI Provider]
  - Phase1では診断モックまたは軽量AI診断
```

### 4.2 Phase1で接続しない外部サービス

Phase1では、以下には接続しない。

- LINE Messaging API
- Lステップ API
- L Message API
- Instagram Graph API
- Google Business Profile API
- 予約システムAPI
- POS API
- 決済API

これらは、Phase2以降の拡張候補として扱う。

---

## 5. 推奨リポジトリ構成

### 5.1 モノレポ構成

Phase1では、フロントエンドとバックエンドを同一リポジトリで管理するモノレポ構成を推奨する。

```text
ai-consult-crm/
  backend/
    config/
    apps/
      accounts/
      stores/
      customers/
      reservations/
      sales/
      imports/
      insights/
      dashboard/
      ai_core/
      audit/
    tests/
    manage.py
    requirements.txt
    .env.example

  frontend/
    src/
      app/
      components/
      features/
        auth/
        setup/
        dashboard/
        stores/
        customers/
        imports/
      lib/
      types/
    package.json
    .env.example

  docs/
    ARCHITECTURE.md
    DEVELOPMENT_PLAN.md
    API_CONTRACT.md
    SEED_DATA_SPEC.md
    SECURITY_CHECKLIST.md

  scripts/
    seed/
    import_samples/

  CLAUDE.md
  README.md
```

### 5.2 docs配置方針

既存の長い仕様書は、必要に応じて `docs/specs/` に配置する。

Claude Codeが日常的に参照する実装用ドキュメントは、`docs/` 直下に置く。

```text
docs/
  ARCHITECTURE.md
  DEVELOPMENT_PLAN.md
  API_CONTRACT.md
  SEED_DATA_SPEC.md
  SECURITY_CHECKLIST.md
  specs/
    planning/
    requirements/
    ai/
    privacy/
    csv/
```

### 5.3 Claude Code向けの注意

Claude Codeには、実装時にまず以下を参照させる。

1. `CLAUDE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DEVELOPMENT_PLAN.md`
4. `docs/API_CONTRACT.md`
5. 対象機能に関係する仕様書

---

## 6. バックエンド責務分離

## 6.1 アプリ分割案

| App | 責務 |
|---|---|
| accounts | ユーザー、認証、ロール |
| stores | 店舗、店舗設定、メニュー、利用ツール |
| customers | 顧客、同意、顧客メモ |
| reservations | 予約/来店履歴 |
| sales | 売上履歴 |
| imports | CSVアップロード、マッピング、検証、取込 |
| insights | 顧客状態判定、顧客インサイト |
| dashboard | KPI集計、診断カード、今週のアクション |
| ai_core | AI Provider Adapter、診断モック |
| audit | 監査ログ |

### 6.2 accounts

認証・ユーザー・ロール管理を担当する。

Phase1では、以下を扱う。

- ユーザー登録または初期ユーザー作成
- ログイン
- ログアウト
- ログインユーザー取得
- tenant_id / store_id のアクセス制御

### 6.3 stores

店舗情報と店舗設定を管理する。

- 店舗基本情報
- 業種
- エリア
- 店舗設定
- 標準来店周期
- 利用ツール
- メニュー

### 6.4 customers

顧客情報と同意状態を管理する。

- 顧客基本情報
- 顧客一覧
- 顧客詳細
- 同意状態
- 配信停止状態
- 顧客メモ
- 論理削除

### 6.5 imports

CSV取込を担当する。

- CSVアップロード
- 文字コード判定
- ヘッダー読み取り
- 項目マッピング
- バリデーション
- エラー表示
- 取込実行
- 取込履歴

### 6.6 insights

顧客状態判定を担当する。

Phase1ではAIではなく、ルールベースで以下を判定する。

- 新規リード
- 初回予約済
- 初回来店後
- 2回目来店前
- リピーター
- 休眠予備軍
- 休眠顧客
- VIP候補

### 6.7 dashboard

店舗の状態を集計して表示する。

- 売上合計
- 来店数
- 客単価
- 顧客数
- 顧客状態分布
- 注意アラート
- 今週のアクション候補
- 診断カード

### 6.8 ai_core

AI連携を抽象化する。

Phase1では、以下に留める。

- 診断モック
- 軽量AI診断の呼び出し候補
- AI入力のマスキング
- AI出力ログの準備

### 6.9 audit

重要操作のログを管理する。

- CSVアップロード
- CSV取込
- 顧客更新
- 同意状態変更
- 顧客状態再計算
- 診断実行

---

## 7. フロントエンド責務分離

## 7.1 features分割案

```text
frontend/src/features/
  auth/
  setup/
  dashboard/
  stores/
  customers/
  imports/
```

### 7.2 auth

- ログイン画面
- ログアウト
- 認証状態管理
- APIトークンまたはセッション管理

### 7.3 setup

- 初期セットアップ
- 店舗情報入力
- メニュー登録
- 利用ツール登録
- 初回CSV取込導線

### 7.4 dashboard

- KPIカード
- 顧客状態分布
- 注意アラート
- 今週のアクション
- 診断カード

### 7.5 customers

- 顧客一覧
- 顧客詳細
- 同意・配信停止表示
- 来店履歴
- 売上履歴
- 顧客状態表示

### 7.6 imports

- CSVアップロード
- マッピング画面
- プレビュー
- エラー一覧
- 取込結果
- 取込履歴

---

## 8. データ設計の中心方針

### 8.1 store_id中心設計

Phase1では、すべての業務データを `store_id` に紐づける。

```text
stores
  ├─ menus
  ├─ customers
  │   ├─ customer_consents
  │   ├─ customer_notes
  │   ├─ reservations
  │   ├─ sales
  │   └─ customer_insights
  ├─ import_jobs
  └─ audit_logs
```

### 8.2 tenant_id の扱い

将来的な代理店・複数店舗対応を考え、`tenant_id` も持てる設計にする。

Phase1では1テナント1〜複数店舗を想定しつつ、実装はシンプルにする。

### 8.3 論理削除

以下は原則として論理削除にする。

- 店舗
- 顧客
- メニュー
- 予約/来店履歴
- 売上履歴

理由は、過去分析や監査ログとの整合性を保つためである。

---

## 9. 主要データモデル案

### 9.1 stores

| カラム | 内容 |
|---|---|
| id | 店舗ID |
| tenant_id | テナントID |
| name | 店舗名 |
| industry | 業種 |
| prefecture | 都道府県 |
| city | 市区町村 |
| area_label | エリア名 |
| status | active / inactive / deleted |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 9.2 store_settings

| カラム | 内容 |
|---|---|
| id | 設定ID |
| store_id | 店舗ID |
| standard_visit_cycle_days | 標準来店周期 |
| pre_dormant_days | 休眠予備軍判定日数 |
| dormant_days | 休眠判定日数 |
| strengths | 店舗の強み |
| issues | 店舗課題 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 9.3 customers

| カラム | 内容 |
|---|---|
| id | 顧客ID |
| store_id | 店舗ID |
| external_customer_id | 外部顧客ID |
| display_name | 表示名 |
| full_name | 氏名 |
| kana | カナ |
| phone | 電話番号 |
| email | メール |
| gender | 性別 |
| birth_date | 生年月日 |
| acquisition_channel | 流入経路 |
| status | active / inactive / deleted |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 9.4 customer_consents

| カラム | 内容 |
|---|---|
| id | 同意ID |
| store_id | 店舗ID |
| customer_id | 顧客ID |
| contact_line_allowed | LINE連絡可否 |
| contact_email_allowed | メール連絡可否 |
| contact_sms_allowed | SMS連絡可否 |
| analysis_allowed | AI分析可否 |
| is_unsubscribed | 配信停止 |
| consent_source | 同意取得元 |
| consented_at | 同意日時 |
| unsubscribed_at | 配信停止日時 |
| updated_at | 更新日時 |

### 9.5 reservations

| カラム | 内容 |
|---|---|
| id | 予約/来店ID |
| store_id | 店舗ID |
| customer_id | 顧客ID |
| external_reservation_id | 外部予約ID |
| reservation_date | 予約日時 |
| visit_date | 来店日時 |
| status | reserved / visited / cancelled / no_show |
| menu_name | メニュー名 |
| staff_name | 担当者名 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 9.6 sales

| カラム | 内容 |
|---|---|
| id | 売上ID |
| store_id | 店舗ID |
| customer_id | 顧客ID |
| external_sale_id | 外部売上ID |
| sale_date | 売上日 |
| menu_name | メニュー名 |
| category | 施術 / 物販 / 回数券など |
| amount | 金額 |
| payment_method | 支払方法 |
| staff_name | 担当者名 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### 9.7 customer_insights

| カラム | 内容 |
|---|---|
| id | インサイトID |
| store_id | 店舗ID |
| customer_id | 顧客ID |
| customer_state | 顧客状態 |
| priority | high / medium / low |
| last_visit_date | 最終来店日 |
| visit_count | 来店回数 |
| total_sales | 累計売上 |
| next_reservation_exists | 次回予約有無 |
| calculated_at | 算出日時 |
| calculation_version | 判定ロジックバージョン |

---

## 10. CSV取込アーキテクチャ

### 10.1 処理フロー

```text
CSVアップロード
↓
ファイル保存
↓
文字コード判定
↓
ヘッダー読み取り
↓
CSV種別選択
↓
項目マッピング
↓
プレビュー生成
↓
バリデーション
↓
エラー・警告表示
↓
取込実行
↓
DB保存
↓
顧客状態再計算
↓
監査ログ保存
```

### 10.2 imports app の責務

| モジュール | 責務 |
|---|---|
| upload | CSVファイル受付 |
| encoding | 文字コード判定 |
| parser | CSV読み取り |
| mapping | 項目マッピング |
| validators | 必須項目・日付・金額チェック |
| importers | 顧客/予約/売上への保存 |
| errors | エラー管理 |
| jobs | 取込ジョブ管理 |

### 10.3 import_jobs 状態

| 状態 | 内容 |
|---|---|
| uploaded | アップロード済み |
| mapped | マッピング済み |
| validated | 検証済み |
| failed | 失敗 |
| completed | 完了 |

### 10.4 Phase1での非同期処理

Phase1では、まず同期処理でもよい。

ただし、以下は後で非同期化できるように分離する。

- 1万行以上のCSV取込
- 顧客状態一括再計算
- AI診断

---

## 11. 顧客状態判定アーキテクチャ

### 11.1 基本方針

Phase1では、顧客状態判定をAIに依存させない。

まずはルールベースで実装する。

### 11.2 判定入力

| 入力 | 内容 |
|---|---|
| visit_count | 来店回数 |
| last_visit_date | 最終来店日 |
| future_reservation_exists | 未来予約有無 |
| total_sales | 累計売上 |
| customer.status | 顧客状態 |
| customer_consents | 配信可否表示用 |
| store_settings | 休眠判定日数 |

### 11.3 判定出力

| 出力 | 内容 |
|---|---|
| customer_state | 顧客状態 |
| priority | 優先度 |
| next_action_hint | 次アクション候補 |
| calculated_at | 算出日時 |
| calculation_version | 判定ロジックバージョン |

### 11.4 判定ロジック初期値

```text
来店履歴なし + 未来予約なし → 新規リード
来店履歴なし + 未来予約あり → 初回予約済
来店回数 = 1 + 未来予約なし + 最終来店30日以内 → 初回来店後
来店回数 = 1 + 未来予約あり → 2回目来店前
来店回数 >= 2 + 最終来店45日未満 → リピーター
最終来店45〜89日 + 未来予約なし → 休眠予備軍
最終来店90日以上 + 未来予約なし → 休眠顧客
来店回数 >= 6 または累計売上上位 → VIP候補
```

### 11.5 注意点

- VIP候補と休眠顧客が重なる場合、優先表示ルールが必要
- 配信停止は顧客状態ではなく、配信可否として別表示する
- 顧客状態は過去履歴としても保持できるとよい
- 判定ロジックのバージョンを保存する

---

## 12. ダッシュボードアーキテクチャ

### 12.1 集計方針

Phase1では、リアルタイム集計またはAPI実行時集計でよい。

ただし、顧客数が増えた場合にキャッシュや集計テーブルへ移行できる設計にする。

### 12.2 表示データ

| データ | 取得元 |
|---|---|
| 顧客数 | customers |
| 来店数 | reservations |
| 売上 | sales |
| 客単価 | sales / reservations |
| 顧客状態分布 | customer_insights |
| 休眠予備軍数 | customer_insights |
| 休眠顧客数 | customer_insights |
| 初回来店後対象数 | customer_insights |
| 今週のアクション | customer_insights + rules |

### 12.3 今週のアクション生成

Phase1では、固定ロジックでよい。

例：

| 条件 | アクション |
|---|---|
| 初回来店後が多い | 初回来店後フォロー対象を確認する |
| 休眠予備軍が多い | 休眠予備軍向けのリマインド準備をする |
| 休眠顧客が多い | 休眠復帰施策を検討する |
| 売上データ不足 | 売上CSVを取り込む |
| 予約データ不足 | 予約/来店CSVを取り込む |

---

## 13. AI連携アーキテクチャ

### 13.1 Phase1方針

Phase1ではAI連携を必須にしない。

以下のどちらかで実装する。

| 方式 | 内容 |
|---|---|
| 診断モック | ルールベースの診断コメントを返す |
| 軽量AI診断 | 店舗KPIサマリのみAIに渡して診断文を生成 |

### 13.2 ai_core構成案

```text
ai_core/
  adapters/
    base.py
    mock.py
    openai_adapter.py
    gemini_adapter.py
  prompts/
    basic_diagnosis.py
  services/
    diagnosis_service.py
  schemas/
    diagnosis.py
```

### 13.3 AI Provider Adapter

AIプロバイダーを直接業務ロジックに書かない。

```text
Dashboard Service
  ↓
Diagnosis Service
  ↓
AI Provider Adapter
  ↓
OpenAI / Gemini / Mock
```

### 13.4 AI入力制限

AIに渡すのは、Phase1では集計値中心とする。

渡してよいもの：

- 顧客状態別人数
- 売上合計
- 来店数
- 客単価
- 休眠顧客数
- 初回来店後対象数
- 施策履歴の有無

渡さないもの：

- 顧客氏名
- 電話番号
- メール
- LINE userId
- 接客メモ全文
- 顧客CSV全文

---

## 14. セキュリティアーキテクチャ

### 14.1 認証

Phase1では、以下のいずれかを採用する。

- セッション認証
- JWT認証
- Django Authベース

選定時は、フロントエンドとの相性を考慮する。

### 14.2 認可

すべての店舗APIで以下を確認する。

```text
認証済みである
AND 対象 store_id にアクセス権がある
AND 操作に必要なロールを持つ
```

### 14.3 IDOR対策

URL上の `store_id` や `customer_id` を差し替えて他店舗のデータが見えないようにする。

必ずDB取得時に `store_id` で絞り込む。

悪い例：

```text
Customer.objects.get(id=customer_id)
```

良い例：

```text
Customer.objects.get(id=customer_id, store_id=store_id)
```

### 14.4 個人情報ログ禁止

以下はログに出さない。

- 電話番号全文
- メールアドレス全文
- LINE userId
- 顧客メモ全文
- CSV本文全文
- AI入力全文

---

## 15. 監査ログアーキテクチャ

### 15.1 記録対象

Phase1では以下を必須とする。

| 操作 | 内容 |
|---|---|
| ログイン | user_id, IP, user_agent |
| 店舗更新 | target_id, before/after要約 |
| 顧客作成・更新 | target_id, 操作種別 |
| 同意状態更新 | 変更前後 |
| CSVアップロード | ファイル名、種別 |
| CSV取込実行 | 成功件数、エラー件数 |
| 顧客状態再計算 | 対象件数 |
| 診断実行 | 診断種別、参照期間 |

### 15.2 Audit Service

各アプリから直接audit_logsに書くのではなく、Audit Serviceを経由する。

```text
Business Service
  ↓
Audit Service
  ↓
audit_logs
```

### 15.3 保存時の注意

- before/afterには個人情報全文を保存しない
- CSVの中身全文を保存しない
- 変更概要と対象IDを中心に保存する

---

## 16. API設計方針

### 16.1 REST中心

Phase1ではREST APIを基本にする。

```text
/api/v1/...
```

### 16.2 共通レスポンス

成功時：

```json
{
  "data": {},
  "meta": {
    "request_id": "req_xxx"
  }
}
```

一覧：

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 100,
    "request_id": "req_xxx"
  }
}
```

エラー：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります。",
    "details": []
  },
  "meta": {
    "request_id": "req_xxx"
  }
}
```

### 16.3 API設計時の注意

- store_idを必ず考慮する
- ページングを入れる
- 顧客一覧は検索・状態フィルタを持つ
- CSV取込はジョブIDで状態管理する
- エラーはユーザーが直せる内容にする

---

## 17. フロントエンド設計方針

### 17.1 UI方針

Phase1では、多機能なCRM画面ではなく、以下を優先する。

- 現状が分かる
- 次にやることが分かる
- データ取込で迷わない
- 顧客状態が分かる
- 配信停止・同意状態が分かる

### 17.2 主要コンポーネント

| コンポーネント | 用途 |
|---|---|
| KpiCard | KPI表示 |
| CustomerStateBadge | 顧客状態表示 |
| ConsentBadge | 配信可否表示 |
| ImportStepper | CSV取込ステップ |
| ErrorTable | CSVエラー表示 |
| ActionCard | 今週のアクション表示 |
| DiagnosisCard | 診断結果表示 |

### 17.3 状態表示

顧客一覧では最低限以下を表示する。

- 氏名または表示名
- 顧客状態
- 最終来店日
- 来店回数
- 累計売上
- 次回予約有無
- LINE連絡可否
- 配信停止有無

---

## 18. 開発・実行コマンド方針

実際の技術選定後に確定する。

初期候補：

```bash
# backend
cd backend
python -m venv .venv
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# frontend
cd frontend
npm install
npm run dev
```

テスト候補：

```bash
# backend
pytest

# frontend
npm run test
npm run lint
```

---

## 19. Claude Code開発時の制約

Claude Codeには、以下を必ず守らせる。

### 19.1 やってよいこと

- Phase1対象モデルの作成
- Phase1対象APIの実装
- Phase1対象画面の実装
- CSV取込ロジックの実装
- 顧客状態判定ロジックの実装
- 診断モックの実装
- 監査ログの実装
- テスト追加

### 19.2 やってはいけないこと

- LINE自動配信を実装する
- Lステップ連携を実装する
- Instagram投稿連携を実装する
- Google投稿連携を実装する
- 決済を実装する
- 高度な代理店機能を実装する
- 顧客向け文案生成をPhase1で作る
- 承認管理をPhase1で作る
- 月次レポートをPhase1で作る
- 個人情報をログに出す
- store_idを無視したデータ取得をする

---

## 20. Phase1完了条件との対応

| 完了条件 | 対応アーキテクチャ |
|---|---|
| ログインできる | accounts |
| 店舗登録できる | stores |
| メニュー登録できる | stores / menus |
| 顧客CSV取込できる | imports / customers |
| 予約CSV取込できる | imports / reservations |
| 売上CSV取込できる | imports / sales |
| 顧客状態判定できる | insights |
| ダッシュボード表示できる | dashboard |
| 今週のアクション表示できる | dashboard / insights |
| 監査ログが残る | audit |
| 個人情報を保護できる | accounts / audit / logging rules |

---

## 21. 未確定論点

今後詰めるべき論点は以下である。

| 論点 | 内容 |
|---|---|
| バックエンド技術 | Django REST Frameworkで確定するか、FastAPIにするか |
| フロント技術 | Vite Reactでよいか、Next.jsにするか |
| 認証方式 | SessionかJWTか |
| ファイル保存 | Phase1はローカルか、最初からS3互換か |
| 非同期処理 | Phase1でCelery等を入れるか |
| AI連携 | Phase1で実APIを使うか、Mockにするか |
| テスト方針 | pytest / frontend test の範囲 |
| Docker化 | Phase1開始時点で入れるか、後から入れるか |

---

## 22. 次に作成するドキュメント

本書の次に作成するドキュメントは以下を推奨する。

1. リポジトリ構成・環境構築手順書 v0.1
2. サンプルデータ仕様書 v0.1
3. API Contract詳細 v0.1
4. セキュリティチェックリスト v0.1
5. Claude Codeタスクプロンプト集 v0.1
