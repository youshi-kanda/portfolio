# Developer Portfolio

業務システム、AI活用、業務自動化を中心に開発しているポートフォリオです。

実案件・開発経験をベースに、公開可能な範囲へ再構成し、
実データや本番認証情報を含まないデモとして掲載しています。

## Skills

- Frontend: React / TypeScript / Vite
- Backend: Python / Django / Django REST Framework
- Database: PostgreSQL / SQLite
- AI: LLM API integration / Mock AI / Rule-based analysis
- Authentication: JWT
- Automation: Google Apps Script
- Other: REST API / Git / GitHub / Business system development

## Featured Projects

### AI CRM Demo

小規模店舗向けのAI活用CRMデモです。

顧客・予約・売上データをもとに、
顧客分析から施策提案、AI文案生成、承認、月次レポートまでの
業務フローを実装しています。

**Main Features**

- JWT認証
- 顧客管理
- 予約・売上管理
- KPIダッシュボード
- 顧客状態分析
- AI施策提案
- AI文案生成
- 表現リスクチェック
- 承認ワークフロー
- 月次レポート
- 監査ログ
- Synthetic Demo Data

**Tech Stack**

`React` `TypeScript` `Django` `Django REST Framework`
`PostgreSQL` `TanStack Query` `Axios` `JWT` `Anthropic API`

Backend tests: **484 passed**

[View AI CRM Demo →](./ai-crm-demo/)

### Project Progress Manager

Google Apps ScriptとGoogle Sheetsで構築した、プロジェクト進捗管理デモです。

Project / Work Item / Decision / Dependencyをスプレッドシート上で管理し、
Sidebarからの一括登録、Dashboard集計、Activity履歴までを実装しています。

**Main Features**

- Project管理
- Work Item / Task管理
- Decision / Blocker管理
- Dependency管理
- HTML Service Sidebarからの一括登録
- Dashboard集計
- Activity履歴
- onEditによる更新記録
- Synthetic Demo Data

**Engineering Highlights**

- Google Sheets as Source of Truth
- Header-based column resolution
- LockServiceによる排他制御
- submissionId + payloadHashによる冪等性
- Transaction-like rollback
- DFSによる循環依存検出
- Formula Injection対策
- Safe Error / secret masking

**Tech Stack**

`Google Apps Script` `JavaScript` `Google Sheets`
`HTML Service` `LockService`

Tests: **77 passed**

This portfolio demo does not include external API or GitHub integration.

[View Project Progress Manager →](./gas-project-management-demo/)

### Document Field Extraction Demo

設備点検フォームを対象とした、帳票項目抽出デモです。

OCRレスポンスから12項目の業務データを抽出し、
正規化・信頼度スコアリング・スキーマ検証を経て、
確認が必要な項目だけを人のレビューへ振り分けます。

**Main Features**

- Synthetic OCR Response
- Mock OCR Provider
- キーワードアンカー方式のField Extraction
- 日付 / enum / チェックボックスの正規化
- Block単位のConfidence Scoring
- 低信頼フィールドの検出
- Review Gate（passed / review_required / blocked）
- JSON Schema検証
- Structured JSON出力
- Safe Error
- Synthetic Demo Data

**Engineering Highlights**

- Post-OCR field extraction pipeline
- 決定的なMock Providerによるoffline実行
- Block単位のconfidence集計（ページ平均に埋もれさせない）
- 欠損値はconfidence 0として扱う設計
- 次のラベルで打ち切る抽出ウィンドウ
- チェックボックスのtri-state判定（true / false / 未判定）
- 不正な日付は補正せずnullを返す
- 依存なしJSON Schema subset validator（未対応keywordはfail-fast）
- Zero runtime dependencies / no-networkテスト

**Tech Stack**

`JavaScript` `Node.js` `node:test` `JSON Schema`

Tests: **157 passed across 40 suites**

The default demo uses a deterministic synthetic OCR response
and does not run an OCR engine or external service.

[View Document Field Extraction Demo →](./document-field-extraction-demo/)

## About This Repository

公開用Portfolioでは以下を含めない方針です。

- 実顧客データ
- APIキー・認証情報
- 本番データベース
- 本番サーバー設定
- クライアント固有情報

各作品はSynthetic / Mock dataを利用して公開しています。
