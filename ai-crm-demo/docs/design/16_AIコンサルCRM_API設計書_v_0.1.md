# AIコンサルCRM API設計書 v0.1

## 1. 本書の目的

本書は、AIコンサルCRMのシステム構築に向けて、API設計の基本方針、主要API一覧、認証・認可、データ取得・登録・更新・削除、AI機能連携、CSV取込・出力、公式LINE/Lステップ連携前提、代理店・コンサル利用、監査ログ、エラーハンドリングに関する仕様を定義するものである。

本サービスは、公式LINEを主要な顧客接点として活用する個人店・小規模店舗向けに、顧客データ・予約/来店データ・売上データ・施策データ・発信データ・AI相談履歴を統合し、集客・再来店・顧客フォロー・売上改善の次アクションを提案するAIコンサル型CRMである。

本API設計書では、以下を明確にする。

- API全体の設計思想
- 認証・認可・テナント分離の方針
- 店舗・顧客・予約・売上・施策・AI相談のAPI構成
- CSV取込・出力APIの方針
- AI機能をどのAPIで呼び出すか
- 公式LINE/Lステップ連携を初期はどうAPI非依存で扱うか
- 将来的な外部API連携をどう拡張できるようにするか
- 同意管理・配信停止・承認・監査ログをAPI上でどう扱うか

---

## 2. API設計の基本方針

### 2.1 基本思想

APIは、単なるCRUDではなく、以下の業務循環を支える構造にする。

```text
データを取り込む
↓
顧客状態・ニーズ・課題を整理する
↓
AIが施策を提案する
↓
対象者と文案を生成する
↓
承認する
↓
公式LINE/SNS/Google/個別対応で実行する
↓
結果を記録する
↓
改善案・レポートを生成する
```

### 2.2 API設計原則

| 原則 | 内容 |
|---|---|
| REST中心 | 初期はREST APIを基本にする |
| テナント分離 | すべての業務データは tenant_id / store_id で分離する |
| 店舗ID中心 | 店舗に紐づくAPIは原則 `store_id` を持つ |
| 権限前提 | APIごとにロール・店舗権限を確認する |
| 外部API非依存 | 初期はLINE/Instagram/Google API連携を必須にしない |
| CSV/手入力重視 | 初期はCSV取込・手入力・手動結果記録を重視する |
| AI根拠保存 | AI APIの出力は根拠・信頼度・注意点・参照データを保存する |
| 人間承認 | 顧客向け文案・外部投稿文は承認APIを通す |
| 同意優先 | 配信対象抽出APIでは同意・配信停止を必ず反映する |
| 監査可能 | 出力、承認、AI生成、CSV操作は監査ログを残す |

### 2.3 APIバージョニング

初期は以下の形式を採用する。

```text
/api/v1/...
```

将来的な破壊的変更に備え、v2以降を切れる設計にする。

### 2.4 想定技術構成

| 項目 | 想定 |
|---|---|
| バックエンド | Django REST Framework / FastAPI / Node.js NestJS 等 |
| DB | PostgreSQL |
| 認証 | JWT / Session / 外部Auth連携を検討 |
| ファイル | S3互換ストレージ、GCS、R2等 |
| AI連携 | OpenAI API、Gemini API等を抽象化して利用 |
| 非同期処理 | Celery / Cloud Tasks / BullMQ / Queue 等 |
| API仕様管理 | OpenAPI 3.0 |

---

## 3. 認証・認可設計

## 3.1 認証方式

### 3.1.1 初期方式

初期は、メールアドレス + パスワード認証、または外部Auth基盤を利用する。

| 方式 | 内容 |
|---|---|
| メール/パスワード | シンプルな初期実装向け |
| JWT | SPA/モバイル対応しやすい |
| Session Cookie | 管理画面中心なら扱いやすい |
| 外部Auth | Firebase Auth / Auth0 / Cognito 等を検討 |

### 3.1.2 認証API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/auth/login` | ログイン |
| POST | `/api/v1/auth/logout` | ログアウト |
| POST | `/api/v1/auth/refresh` | トークン更新 |
| POST | `/api/v1/auth/password-reset/request` | パスワード再設定依頼 |
| POST | `/api/v1/auth/password-reset/confirm` | パスワード再設定実行 |
| GET | `/api/v1/auth/me` | ログインユーザー情報取得 |

### 3.1.3 `/auth/me` レスポンス例

```json
{
  "user": {
    "id": "uuid",
    "name": "山田 太郎",
    "email": "owner@example.com"
  },
  "tenants": [
    {
      "tenant_id": "uuid",
      "tenant_name": "サンプルサロン",
      "role": "owner"
    }
  ],
  "stores": [
    {
      "store_id": "uuid",
      "store_name": "サンプルサロン心斎橋店",
      "role": "owner"
    }
  ]
}
```

---

## 3.2 認可方針

### 3.2.1 ロール

| ロール | 内容 |
|---|---|
| owner | 店舗オーナー。全体閲覧、設定、承認、出力が可能 |
| manager | 店長。顧客・施策・文案・レポート管理が可能 |
| staff | スタッフ。担当顧客確認、メモ、タスク実行が中心 |
| agency_admin | 代理店管理者。担当店舗・担当者管理が可能 |
| supporter | 外部支援者。許可店舗の診断・施策作成が可能 |
| system_admin | システム管理者。運営側管理用 |

### 3.2.2 権限確認の単位

APIでは、以下を必ず確認する。

| 確認対象 | 内容 |
|---|---|
| 認証済みか | ログインしているか |
| tenant_id | 所属テナントか |
| store_id | アクセス許可された店舗か |
| role | 操作可能なロールか |
| agency assignment | 代理店がその店舗に割り当てられているか |
| personal data permission | 個人情報閲覧・出力が許可されているか |

### 3.2.3 権限エラー

| HTTP | コード | 内容 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 未ログイン |
| 403 | `FORBIDDEN` | 権限不足 |
| 404 | `NOT_FOUND` | 対象データなし、または権限外のため非表示 |

---

## 4. 共通API仕様

### 4.1 共通リクエストヘッダー

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Tenant-Id: <tenant_id>
X-Store-Id: <store_id>
```

### 4.2 共通レスポンス形式

#### 成功時

```json
{
  "data": {},
  "meta": {
    "request_id": "req_xxx"
  }
}
```

#### 一覧取得時

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 123,
    "request_id": "req_xxx"
  }
}
```

#### エラー時

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります。",
    "details": [
      {
        "field": "name",
        "message": "店舗名は必須です。"
      }
    ]
  },
  "meta": {
    "request_id": "req_xxx"
  }
}
```

### 4.3 共通クエリ

| クエリ | 内容 |
|---|---|
| `page` | ページ番号 |
| `per_page` | 1ページあたり件数 |
| `sort` | 並び順 |
| `q` | 検索文字列 |
| `status` | ステータス絞り込み |
| `from` | 期間開始 |
| `to` | 期間終了 |

---

## 5. テナント・店舗・ユーザーAPI

## 5.1 テナントAPI

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/tenants` | 所属テナント一覧取得 |
| GET | `/api/v1/tenants/{tenant_id}` | テナント詳細取得 |
| PATCH | `/api/v1/tenants/{tenant_id}` | テナント更新 |

## 5.2 店舗API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores` | 店舗一覧取得 |
| POST | `/api/v1/stores` | 店舗作成 |
| GET | `/api/v1/stores/{store_id}` | 店舗詳細取得 |
| PATCH | `/api/v1/stores/{store_id}` | 店舗更新 |
| DELETE | `/api/v1/stores/{store_id}` | 店舗論理削除 |
| GET | `/api/v1/stores/{store_id}/settings` | 店舗設定取得 |
| PATCH | `/api/v1/stores/{store_id}/settings` | 店舗設定更新 |
| GET | `/api/v1/stores/{store_id}/tools` | 利用ツール一覧取得 |
| POST | `/api/v1/stores/{store_id}/tools` | 利用ツール登録 |
| PATCH | `/api/v1/stores/{store_id}/tools/{tool_id}` | 利用ツール更新 |

### 5.2.1 店舗作成リクエスト例

```json
{
  "name": "サンプルサロン心斎橋店",
  "industry": "esthetic",
  "sub_industry": "facial",
  "prefecture": "大阪府",
  "city": "大阪市中央区",
  "area_label": "心斎橋",
  "address": "大阪市中央区...",
  "phone": "06-xxxx-xxxx"
}
```

## 5.3 メニューAPI

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/menus` | メニュー一覧取得 |
| POST | `/api/v1/stores/{store_id}/menus` | メニュー登録 |
| GET | `/api/v1/stores/{store_id}/menus/{menu_id}` | メニュー詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/menus/{menu_id}` | メニュー更新 |
| DELETE | `/api/v1/stores/{store_id}/menus/{menu_id}` | メニュー論理削除 |

---

## 6. 顧客API

## 6.1 顧客一覧・詳細

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/customers` | 顧客一覧取得 |
| POST | `/api/v1/stores/{store_id}/customers` | 顧客作成 |
| GET | `/api/v1/stores/{store_id}/customers/{customer_id}` | 顧客詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/customers/{customer_id}` | 顧客更新 |
| DELETE | `/api/v1/stores/{store_id}/customers/{customer_id}` | 顧客論理削除 |

### 6.1.1 顧客一覧クエリ

| クエリ | 内容 |
|---|---|
| `q` | 氏名、表示名、電話、メール検索 |
| `customer_state` | 顧客状態で絞り込み |
| `need_category` | 推定ニーズで絞り込み |
| `priority` | 優先度で絞り込み |
| `is_unsubscribed` | 配信停止状態 |
| `contact_line_allowed` | LINE連絡可否 |
| `last_visit_from` | 最終来店日開始 |
| `last_visit_to` | 最終来店日終了 |
| `has_next_reservation` | 次回予約有無 |

### 6.1.2 顧客一覧レスポンス例

```json
{
  "data": [
    {
      "id": "uuid",
      "display_name": "山田様",
      "full_name": "山田 花子",
      "customer_state": "pre_dormant",
      "inferred_needs": ["seasonal_issue", "trigger_needed"],
      "priority": "high",
      "last_visit_date": "2026-05-01",
      "visit_count": 4,
      "ltv": 58000,
      "next_action": "line_message",
      "contact_line_allowed": true,
      "is_unsubscribed": false
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 80
  }
}
```

## 6.2 顧客同意API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/customers/{customer_id}/consents` | 同意状態取得 |
| PATCH | `/api/v1/stores/{store_id}/customers/{customer_id}/consents` | 同意状態更新 |
| POST | `/api/v1/stores/{store_id}/customers/{customer_id}/unsubscribe` | 配信停止登録 |
| POST | `/api/v1/stores/{store_id}/customers/{customer_id}/resubscribe` | 配信停止解除 |

### 6.2.1 同意更新リクエスト例

```json
{
  "contact_line_allowed": true,
  "contact_email_allowed": false,
  "contact_sms_allowed": false,
  "analysis_allowed": true,
  "external_integration_allowed": false,
  "consent_source": "store_manual",
  "consented_at": "2026-05-10T10:00:00+09:00"
}
```

## 6.3 顧客メモAPI

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/customers/{customer_id}/notes` | メモ一覧取得 |
| POST | `/api/v1/stores/{store_id}/customers/{customer_id}/notes` | メモ登録 |
| PATCH | `/api/v1/stores/{store_id}/customers/{customer_id}/notes/{note_id}` | メモ更新 |
| DELETE | `/api/v1/stores/{store_id}/customers/{customer_id}/notes/{note_id}` | メモ削除 |

## 6.4 顧客インサイトAPI

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/customers/{customer_id}/insights` | 顧客インサイト履歴取得 |
| POST | `/api/v1/stores/{store_id}/customers/{customer_id}/insights/recalculate` | 顧客インサイト再計算 |
| PATCH | `/api/v1/stores/{store_id}/customers/{customer_id}/insights/{insight_id}` | インサイト手動修正 |

### 6.4.1 インサイト再計算レスポンス例

```json
{
  "data": {
    "customer_id": "uuid",
    "customer_state": "dormant",
    "inferred_needs": ["trigger_needed", "seasonal_issue"],
    "blocking_factors": ["booking_reason_weak"],
    "recommended_action": "line_message",
    "priority": "high",
    "evidence_summary": "最終来店から78日経過、過去3回来店、フェイシャル利用履歴あり。",
    "ai_confidence": "medium",
    "review_status": "unreviewed"
  }
}
```

---

## 7. 予約・売上API

## 7.1 予約API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/reservations` | 予約一覧取得 |
| POST | `/api/v1/stores/{store_id}/reservations` | 予約登録 |
| GET | `/api/v1/stores/{store_id}/reservations/{reservation_id}` | 予約詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/reservations/{reservation_id}` | 予約更新 |
| DELETE | `/api/v1/stores/{store_id}/reservations/{reservation_id}` | 予約削除 |

### 7.1.1 予約一覧クエリ

| クエリ | 内容 |
|---|---|
| `customer_id` | 顧客ID |
| `status` | reserved / visited / cancelled / no_show |
| `scheduled_from` | 予定日時開始 |
| `scheduled_to` | 予定日時終了 |
| `channel` | 予約経路 |

## 7.2 売上API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/sales` | 売上一覧取得 |
| POST | `/api/v1/stores/{store_id}/sales` | 売上登録 |
| GET | `/api/v1/stores/{store_id}/sales/{sale_id}` | 売上詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/sales/{sale_id}` | 売上更新 |
| DELETE | `/api/v1/stores/{store_id}/sales/{sale_id}` | 売上削除 |

---

## 8. セグメント・タグAPI

## 8.1 セグメント定義API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/segments` | セグメント一覧取得 |
| POST | `/api/v1/stores/{store_id}/segments` | セグメント作成 |
| GET | `/api/v1/stores/{store_id}/segments/{segment_id}` | セグメント詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/segments/{segment_id}` | セグメント更新 |
| DELETE | `/api/v1/stores/{store_id}/segments/{segment_id}` | セグメント削除 |
| POST | `/api/v1/stores/{store_id}/segments/{segment_id}/preview` | 対象者プレビュー |
| POST | `/api/v1/stores/{store_id}/segments/{segment_id}/snapshot` | 対象者スナップショット作成 |

## 8.2 セグメント提案API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/stores/{store_id}/segments/suggest` | AIによるセグメント提案 |

### 8.2.1 セグメント提案リクエスト例

```json
{
  "purpose": "dormant_reactivation",
  "channel": "official_line",
  "reference_date": "2026-05-10",
  "include_external_tag_suggestion": true
}
```

### 8.2.2 セグメント提案レスポンス例

```json
{
  "data": {
    "segment_name": "休眠復帰対象_2026年05月",
    "purpose": "dormant_reactivation",
    "condition_summary": "最終来店60日以上、次回予約なし、LINE連絡同意あり",
    "target_count": 28,
    "excluded_count": 3,
    "exclusion_breakdown": {
      "unsubscribed": 2,
      "no_line_consent": 1
    },
    "external_tag_suggestion": {
      "tag_name": "休眠復帰_2026年05月",
      "tag_type": "campaign",
      "purpose": "休眠復帰施策の一時タグ"
    },
    "evidence_summary": "最終来店から60日以上の顧客が31名、そのうち配信可能者は28名。",
    "cautions": ["値引き訴求に偏らず、再来店理由を提示してください。"]
  }
}
```

## 8.3 外部タグAPI

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/external-tags` | 外部タグ一覧取得 |
| POST | `/api/v1/stores/{store_id}/external-tags` | 外部タグ登録 |
| PATCH | `/api/v1/stores/{store_id}/external-tags/{external_tag_id}` | 外部タグ更新 |
| DELETE | `/api/v1/stores/{store_id}/external-tags/{external_tag_id}` | 外部タグ削除 |

---

## 9. 施策・発信API

## 9.1 施策API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/campaigns` | 施策一覧取得 |
| POST | `/api/v1/stores/{store_id}/campaigns` | 施策作成 |
| GET | `/api/v1/stores/{store_id}/campaigns/{campaign_id}` | 施策詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/campaigns/{campaign_id}` | 施策更新 |
| DELETE | `/api/v1/stores/{store_id}/campaigns/{campaign_id}` | 施策削除 |
| POST | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/targets/generate` | 施策対象者生成 |
| GET | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/targets` | 施策対象者取得 |
| POST | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/contents/generate` | 文案生成 |
| GET | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/contents` | 文案一覧取得 |
| POST | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/execute-log` | 手動実行ログ登録 |

## 9.2 施策作成リクエスト例

```json
{
  "name": "5月休眠復帰LINE施策",
  "purpose": "dormant_reactivation",
  "channel": "official_line",
  "scheduled_at": "2026-05-15T10:00:00+09:00",
  "target_segment_id": "uuid"
}
```

## 9.3 文案生成API

### 9.3.1 リクエスト例

```json
{
  "content_type": "line",
  "tone": "polite",
  "include_expression_check": true,
  "instructions": "値引きではなく、季節の肌悩みをきっかけにした再来店文にしてください。"
}
```

### 9.3.2 レスポンス例

```json
{
  "data": {
    "content_id": "uuid",
    "title": "季節の肌ケアのご案内",
    "body": "こんにちは。最近は乾燥や紫外線の影響で、お肌の調子が変わりやすい時期です...",
    "cta": "気になることがあれば、このLINEにそのままご返信ください。",
    "expression_risk_level": "low",
    "expression_check_result": {
      "issues": [],
      "overall_comment": "明確な効果断定はありません。配信前に店舗側で内容を確認してください。"
    },
    "approval_status": "draft"
  }
}
```

## 9.4 施策結果API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/results` | 結果取得 |
| POST | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/results` | 結果登録 |
| PATCH | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/results/{result_id}` | 結果更新 |
| POST | `/api/v1/stores/{store_id}/campaigns/{campaign_id}/results/analyze` | AI改善分析 |

---

## 10. AI API

## 10.1 AI相談API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/ai/conversations` | AI相談一覧取得 |
| POST | `/api/v1/stores/{store_id}/ai/conversations` | AI相談作成 |
| GET | `/api/v1/stores/{store_id}/ai/conversations/{conversation_id}` | AI相談詳細取得 |
| POST | `/api/v1/stores/{store_id}/ai/conversations/{conversation_id}/messages` | メッセージ送信 |

### 10.1.1 メッセージ送信リクエスト例

```json
{
  "category": "line",
  "message": "今月休眠顧客が増えているので、公式LINEで何を送るべきか相談したいです。",
  "reference_period": {
    "from": "2026-04-01",
    "to": "2026-05-10"
  }
}
```

## 10.2 AI診断API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/stores/{store_id}/ai/diagnosis/store` | 自社診断AI実行 |
| POST | `/api/v1/stores/{store_id}/ai/action-plans/generate` | アクションプラン生成 |
| POST | `/api/v1/stores/{store_id}/ai/lstep-necessity` | Lステップ要否診断 |
| POST | `/api/v1/stores/{store_id}/ai/expression-check` | 広告表現チェック |
| POST | `/api/v1/stores/{store_id}/ai/strategy-goals/suggest` | 戦略目的整理AI実行（Phase1はルールベースまたは診断モック可） |

### 10.2.1 Lステップ要否診断レスポンス例

```json
{
  "data": {
    "judgement": "official_line_plus_service_recommended",
    "summary": "現時点ではLステップ導入よりも、公式LINEと本サービスで対象者整理・文案作成・結果記録を回す方が優先です。",
    "reasons": [
      "月間配信対象が80名程度で、手動運用でも対応可能",
      "顧客状態の整理が未整備で、先に対象者設計が必要",
      "複雑なステップ分岐より、初回後・休眠復帰の基本施策が優先"
    ],
    "recommended_next_steps": [
      "休眠復帰対象者を抽出する",
      "初回後フォロー文を作成する",
      "配信結果を手入力で記録する"
    ],
    "confidence": "medium"
  }
}
```

---

## 11. 承認API

## 11.1 承認対象

- 顧客向けLINE文
- 個別LINE文
- Instagram投稿文
- Google投稿文
- キャンペーン文
- Lステップシナリオ案
- レポート

## 11.2 承認API一覧

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/approvals` | 承認一覧取得 |
| POST | `/api/v1/stores/{store_id}/approvals` | 承認依頼作成 |
| GET | `/api/v1/stores/{store_id}/approvals/{approval_id}` | 承認詳細取得 |
| POST | `/api/v1/stores/{store_id}/approvals/{approval_id}/approve` | 承認 |
| POST | `/api/v1/stores/{store_id}/approvals/{approval_id}/reject` | 差戻し |
| POST | `/api/v1/stores/{store_id}/approvals/{approval_id}/cancel` | 取り下げ |

### 11.2.1 承認依頼リクエスト例

```json
{
  "approval_target_type": "content",
  "approval_target_id": "uuid",
  "comment": "5月休眠復帰施策のLINE文案です。確認をお願いします。"
}
```

---

## 12. レポートAPI

## 12.1 レポートAPI一覧

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/reports` | レポート一覧取得 |
| POST | `/api/v1/stores/{store_id}/reports/generate` | レポート生成 |
| GET | `/api/v1/stores/{store_id}/reports/{report_id}` | レポート詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/reports/{report_id}` | レポート編集 |
| POST | `/api/v1/stores/{store_id}/reports/{report_id}/export` | レポート出力 |

### 12.1.1 月次レポート生成リクエスト例

```json
{
  "report_type": "monthly",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "include_personal_data": false
}
```

---

## 13. CSV取込・出力API

## 13.1 取込API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/stores/{store_id}/imports` | 取込ジョブ作成 |
| GET | `/api/v1/stores/{store_id}/imports` | 取込履歴一覧 |
| GET | `/api/v1/stores/{store_id}/imports/{import_job_id}` | 取込ジョブ詳細 |
| POST | `/api/v1/stores/{store_id}/imports/{import_job_id}/mapping` | 項目マッピング設定 |
| POST | `/api/v1/stores/{store_id}/imports/{import_job_id}/execute` | 取込実行 |
| GET | `/api/v1/stores/{store_id}/imports/{import_job_id}/errors` | 取込エラー一覧 |

### 13.1.1 取込ジョブ作成リクエスト例

```json
{
  "import_type": "customers",
  "source_type": "csv",
  "file_id": "uploaded_file_uuid"
}
```

## 13.2 出力API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/stores/{store_id}/exports/segment-targets` | セグメント対象者CSV出力 |
| POST | `/api/v1/stores/{store_id}/exports/campaign-targets` | 施策対象者CSV出力 |
| POST | `/api/v1/stores/{store_id}/exports/reports/{report_id}` | レポート出力 |
| POST | `/api/v1/stores/{store_id}/exports/customer-list` | 顧客一覧CSV出力 |

### 13.2.1 施策対象者CSV出力リクエスト例

```json
{
  "campaign_id": "uuid",
  "include_personal_data": false,
  "format": "csv"
}
```

---

## 14. 代理店・コンサルAPI

## 14.1 代理店API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/agencies/{agency_id}/stores` | 担当店舗一覧取得 |
| POST | `/api/v1/agencies/{agency_id}/stores/{store_id}/assign` | 店舗割当 |
| PATCH | `/api/v1/agencies/{agency_id}/stores/{store_id}/assignment` | 店舗権限更新 |
| DELETE | `/api/v1/agencies/{agency_id}/stores/{store_id}/assignment` | 店舗割当解除 |
| GET | `/api/v1/agencies/{agency_id}/dashboard` | 代理店ダッシュボード取得 |
| POST | `/api/v1/agencies/{agency_id}/proposal/generate` | 代理店提案書生成 |

### 14.1.1 代理店ダッシュボードレスポンス例

```json
{
  "data": {
    "assigned_store_count": 12,
    "stores_need_action": 5,
    "approval_pending_count": 8,
    "reports_pending_count": 3,
    "stores": [
      {
        "store_id": "uuid",
        "store_name": "サンプルサロン心斎橋店",
        "industry": "esthetic",
        "monthly_status": "needs_attention",
        "pending_actions": ["monthly_report", "campaign_result_input"]
      }
    ]
  }
}
```

---

## 15. 外部連携API

## 15.1 初期方針

初期では、外部API連携は必須にしない。

外部連携APIは、利用ツール情報の登録、CSV出力、将来連携設定の保存を中心にする。

## 15.2 外部連携設定API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/integrations` | 外部連携設定一覧 |
| POST | `/api/v1/stores/{store_id}/integrations` | 外部連携設定作成 |
| PATCH | `/api/v1/stores/{store_id}/integrations/{integration_id}` | 外部連携設定更新 |
| DELETE | `/api/v1/stores/{store_id}/integrations/{integration_id}` | 外部連携解除 |
| POST | `/api/v1/stores/{store_id}/integrations/{integration_id}/test` | 接続テスト |

### 15.2.1 将来連携候補

| 外部サービス | 初期扱い | 将来候補 |
|---|---|---|
| 公式LINE | 文案・対象者出力 | userId連携、Webhook、半自動配信 |
| Lステップ | タグ案・シナリオ案 | CSV/外部API連携 |
| L Message | タグ案・シナリオ案 | CSV/外部API連携 |
| Instagram | 投稿文生成 | インサイト取得 |
| Googleビジネスプロフィール | 投稿文・口コミ返信案 | Performance API連携 |
| 予約システム | CSV取込 | API連携 |
| POS | CSV取込 | API連携 |

---

## 16. ダッシュボードAPI

## 16.1 ダッシュボード取得

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/dashboard` | 店舗ダッシュボード取得 |

### 16.1.1 クエリ

| クエリ | 内容 |
|---|---|
| `period` | this_month / last_month / custom |
| `from` | 期間開始 |
| `to` | 期間終了 |

### 16.1.2 レスポンス項目

- 売上サマリ
- 新規数
- リピート数
- 客単価
- 休眠顧客数
- 顧客状態分布
- 今週の優先アクション
- 承認待ち件数
- 結果未入力件数
- AI診断サマリ
- 今月の重点目的カード（目的、根拠、信頼度、注意点、不足データ）
- 注意アラート

---

## 17. 戦略目的API

## 17.1 strategy-goals API一覧

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/strategy-goals` | 戦略目的一覧取得 |
| POST | `/api/v1/stores/{store_id}/strategy-goals` | 戦略目的作成 |
| GET | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}` | 戦略目的詳細取得 |
| PATCH | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}` | 戦略目的更新 |
| POST | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/approve` | 戦略目的承認 |
| GET | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/actions` | 推奨施策候補取得 |
| POST | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/actions` | 推奨施策候補追加 |
| POST | `/api/v1/stores/{store_id}/strategy-goals/{strategy_goal_id}/actions/{action_id}/convert-to-campaign` | 施策管理への変換（Phase2以降） |

### 17.1.1 一覧クエリ

| クエリ | 内容 |
|---|---|
| `period_type` | monthly / quarterly |
| `from` | 期間開始 |
| `to` | 期間終了 |
| `status` | draft / proposed / approved / archived |

### 17.1.2 レスポンス項目

- 目的
- Why/根拠
- 信頼度
- 注意点
- 不足データ
- KPI候補
- 対象顧客候補
- 推奨チャネル
- 推奨施策候補
- 人間承認ステータス

### 17.1.3 制約

Phase1では、ダッシュボードの「今月の重点目的カード」に必要な取得・提案表示に留める。詳細なKPI目標管理、施策連携、月次レポート反映、自動配信、LINE API/Lステップ等の外部API連携はPhase2以降とする。顧客向け発信に展開する場合は必ず人間承認APIを通す。

---

## 18. 監査ログAPI

## 18.1 監査ログ一覧

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/stores/{store_id}/audit-logs` | 監査ログ一覧取得 |
| GET | `/api/v1/stores/{store_id}/audit-logs/{audit_log_id}` | 監査ログ詳細取得 |

### 18.1.1 監査対象

- 顧客情報閲覧
- 顧客情報編集
- 同意状態変更
- CSV取込
- CSV出力
- 対象者リスト出力
- AI提案生成
- 文案生成
- 広告表現チェック
- 承認
- 差戻し
- レポート出力

---

## 19. ファイルAPI

## 19.1 ファイルアップロード

| メソッド | エンドポイント | 内容 |
|---|---|---|
| POST | `/api/v1/files` | ファイルアップロード |
| GET | `/api/v1/files/{file_id}` | ファイル情報取得 |
| DELETE | `/api/v1/files/{file_id}` | ファイル削除 |

### 19.1.1 対象ファイル

- CSV
- Excel
- PDF
- Markdown
- 画像

### 19.1.2 注意

顧客情報を含むファイルは、以下を管理する。

- アップロード者
- 店舗ID
- ファイル種別
- 個人情報含有フラグ
- 保存期限
- 削除状態

---

## 20. エラーコード設計

| HTTP | コード | 内容 |
|---|---|---|
| 400 | `BAD_REQUEST` | 不正なリクエスト |
| 400 | `VALIDATION_ERROR` | 入力値エラー |
| 401 | `UNAUTHORIZED` | 未認証 |
| 403 | `FORBIDDEN` | 権限不足 |
| 404 | `NOT_FOUND` | 対象なし |
| 409 | `CONFLICT` | 重複・競合 |
| 413 | `FILE_TOO_LARGE` | ファイルサイズ超過 |
| 415 | `UNSUPPORTED_FILE_TYPE` | 非対応ファイル形式 |
| 422 | `BUSINESS_RULE_ERROR` | 業務ルール違反 |
| 429 | `RATE_LIMITED` | レート制限 |
| 500 | `INTERNAL_ERROR` | サーバーエラー |
| 502 | `AI_PROVIDER_ERROR` | AI APIエラー |
| 503 | `SERVICE_UNAVAILABLE` | 一時利用不可 |

---

## 21. 非同期処理設計

### 21.1 非同期対象

| 処理 | 理由 |
|---|---|
| CSV取込 | 件数が多い可能性がある |
| 顧客インサイト一括再計算 | AI/集計処理が重い |
| 自社診断AI | 複数データ参照が必要 |
| 月次レポート生成 | AI生成と集計が必要 |
| PDF出力 | 生成に時間がかかる |
| 大量CSV出力 | 個人情報と負荷の観点で制御が必要 |

### 21.2 ジョブ管理API

| メソッド | エンドポイント | 内容 |
|---|---|---|
| GET | `/api/v1/jobs/{job_id}` | ジョブ状態取得 |
| POST | `/api/v1/jobs/{job_id}/cancel` | ジョブキャンセル |

### 21.3 ジョブ状態

| 状態 | 内容 |
|---|---|
| queued | 待機中 |
| processing | 処理中 |
| completed | 完了 |
| failed | 失敗 |
| cancelled | キャンセル |

---

## 22. レート制限・安全制御

### 22.1 レート制限対象

| 対象 | 制御理由 |
|---|---|
| ログインAPI | ブルートフォース防止 |
| AI生成API | コスト・過剰利用防止 |
| CSV出力API | 個人情報持ち出し防止 |
| ファイルアップロード | ストレージ・ウイルス対策 |
| 顧客検索API | スクレイピング防止 |

### 22.2 AI API利用上限

| 単位 | 内容 |
|---|---|
| テナント単位 | 月間AI生成回数 |
| 店舗単位 | 月間診断・文案・レポート生成回数 |
| ユーザー単位 | 短時間の連続生成制限 |

---

## 23. MVPで必須のAPI

MVPで必須とするAPIは以下である。

| 区分 | API |
|---|---|
| 認証 | login, logout, me |
| 店舗 | stores, store_settings, store_tools, menus |
| 顧客 | customers, customer_consents, customer_notes, customer_insights |
| 予約/売上 | reservations, sales |
| セグメント | segments, segments/suggest, segment preview/snapshot |
| 施策 | campaigns, campaign_targets, campaign_contents, campaign_results |
| AI | ai/conversations, ai/diagnosis/store, ai/action-plans/generate, ai/expression-check |
| 承認 | approvals |
| 取込/出力 | imports, exports |
| レポート | reports/generate, reports/export |
| 監査 | audit-logs |
| ダッシュボード | dashboard |
| 戦略目的 | strategy-goals（Phase1は重点目的カード用の取得・提案のみ） |

---

## 24. MVPでは後回しにするAPI

| API | 理由 |
|---|---|
| LINE配信実行API | Phase 5で実装。人間承認必須（Phase 1〜4では対象者リスト出力のみ） |
| Instagram投稿API | API審査・権限・仕様差がある |
| Googleビジネスプロフィール投稿API | APIアクセス・割当・審査が必要 |
| Lステップ直接操作API | 複雑なシナリオ用任意ツール連携 |
| POSリアルタイム連携API | 連携先ごとの差異が大きい |
| 請求API | 初期は手動契約・手動請求でも可 |
| ホワイトラベルAPI | 代理店向け拡張後でよい |
| strategy-goalsの施策変換・レポート反映API | 詳細なKPI目標管理、施策連携、月次レポート反映はPhase2以降でよい |

---

## 24.1 Phase 5 LINE Messaging API（追加予定）

Phase 5で追加するエンドポイント一覧。承認済み文案からLINE配信実行まで完結させる。

### LINEアカウント管理

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/api/v1/stores/{id}/line/accounts/` | LINEアカウント一覧・作成 |
| GET/PATCH/DELETE | `/api/v1/stores/{id}/line/accounts/{account_id}/` | LINEアカウント詳細・更新・削除 |

### Webhook

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/v1/line/webhook/{line_account_id}/` | Webhook受信（HMAC-SHA256署名検証） |

### LINE友だち管理

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/stores/{id}/line/friends/` | 友だち一覧 |
| PATCH | `/api/v1/stores/{id}/line/friends/{friend_id}/` | 友だち情報更新・顧客紐付け |
| GET/POST | `/api/v1/stores/{id}/line/tags/` | タグ管理 |
| POST | `/api/v1/stores/{id}/line/friends/{friend_id}/tags/` | タグ付与 |

### 一斉配信（Broadcast）

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/api/v1/stores/{id}/line/broadcasts/` | 配信一覧・作成 |
| GET/PATCH | `/api/v1/stores/{id}/line/broadcasts/{bid}/` | 配信詳細・更新 |
| POST | `/api/v1/stores/{id}/line/broadcasts/{bid}/send/` | 配信実行（承認済み必須） |
| GET | `/api/v1/stores/{id}/line/broadcasts/{bid}/insights/` | 配信結果取得 |

### ステップ配信（Scenario）

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/api/v1/stores/{id}/line/scenarios/` | シナリオ一覧・作成 |
| GET/PATCH/DELETE | `/api/v1/stores/{id}/line/scenarios/{sid}/` | シナリオ詳細・更新・削除 |
| GET/POST | `/api/v1/stores/{id}/line/scenarios/{sid}/steps/` | ステップ管理 |

### 自動応答

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/api/v1/stores/{id}/line/auto-replies/` | 自動応答一覧・作成 |
| GET/PATCH/DELETE | `/api/v1/stores/{id}/line/auto-replies/{rid}/` | 自動応答詳細・更新・削除 |

### リッチメニュー

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/api/v1/stores/{id}/line/rich-menus/` | リッチメニュー一覧・作成 |
| DELETE | `/api/v1/stores/{id}/line/rich-menus/{mid}/` | リッチメニュー削除 |
| POST | `/api/v1/stores/{id}/line/rich-menus/{mid}/set-default/` | デフォルト設定 |
| POST | `/api/v1/stores/{id}/line/rich-menus/{mid}/image/` | 画像アップロード |

---

## 25. 未確定論点

次に詰めるべき論点は以下である。

1. 認証基盤を自前実装にするか、Firebase/Auth0/Cognito等にするか
2. APIをREST中心にするか、GraphQLを併用するか
3. AI APIを同期レスポンスにするか、ジョブ化するか
4. 顧客インサイト再計算をリアルタイムにするか、バッチにするか
5. CSV取込の項目マッピングをどこまで柔軟にするか
6. CSV出力時の個人情報マスキングをどの粒度にするか
7. 代理店APIをMVPに含めるか、後半フェーズにするか
8. 外部連携設定APIをどこまで実装するか
9. OpenAPI仕様書をどのタイミングで生成・管理するか
10. AI生成コスト制御を料金プランにどう反映するか

---

## 26. 次に作成する仕様書

本書の次に作成する仕様書は以下を推奨する。

1. MVPスコープ定義書 v0.1
2. 開発ロードマップ v0.2
3. CSV取込・出力仕様書 v0.1
4. 提案書・月次レポート出力仕様書 v0.1
5. 非機能要件定義書 v0.1
