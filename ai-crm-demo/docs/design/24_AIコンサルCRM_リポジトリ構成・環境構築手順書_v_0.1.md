# AIコンサルCRM リポジトリ構成・環境構築手順書 v0.1

## 1. 本書の目的

本書は、AIコンサルCRMを VSCode + Claude Code で開発するために、リポジトリ構成、ローカル開発環境、初期セットアップ手順、開発コマンド、Git運用、Claude Code利用手順を定義するものである。

本プロジェクトでは、既存の仕様書群をそのまま実装指示に使うのではなく、Claude Code が迷わず作業できるように、以下を明確にする。

- リポジトリ構成
- docs 配置ルール
- backend / frontend の責務
- ローカル環境構築手順
- 環境変数
- 起動コマンド
- 開発タスクの進め方
- Claude Code に渡すプロンプト形式
- Git / GitHub 運用
- 初期開発で守る禁止事項

---

## 2. 開発前提

### 2.1 開発体制

| 項目 | 方針 |
|---|---|
| エディタ | VSCode |
| AI開発支援 | Claude Code |
| バージョン管理 | Git / GitHub |
| 開発方式 | 小タスク単位で実装 |
| 仕様管理 | docs 配下のMarkdownを参照 |
| 実装範囲 | Phase1開発スコープ確定書に従う |

### 2.2 技術構成の初期推奨

Phase1では、以下の構成を推奨する。

| 領域 | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Django REST Framework |
| DB | PostgreSQL |
| Auth | Django Auth + JWT または Session |
| CSV処理 | Python標準CSV / pandasは必要時のみ |
| AI連携 | Phase1はMockまたはAdapter構成のみ |
| File Storage | 初期はローカル保存、将来S3互換へ拡張 |

### 2.3 Phase1での重要方針

Phase1では、以下を優先する。

1. 外部API連携に依存しない
2. CSV取込を安定させる
3. 顧客状態判定はルールベースで実装する
4. AI診断はMockまたは軽量診断に留める
5. LINE自動配信は作らない
6. Lステップ連携は作らない
7. 個人情報をログに出さない
8. store_id によるデータ分離を必ず守る

---

## 3. 推奨リポジトリ構成

### 3.1 全体構成

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
    CLAUDE_TASK_PROMPTS.md
    specs/
      planning/
      requirements/
      api/
      db/
      ai/
      privacy/
      csv/
      legal/

  scripts/
    seed/
    import_samples/

  sample_data/
    customers.csv
    reservations.csv
    sales.csv

  CLAUDE.md
  README.md
  .gitignore
```

### 3.2 backend 配下

| ディレクトリ | 役割 |
|---|---|
| config | Django設定、ルーティング、共通設定 |
| apps/accounts | ユーザー、認証、権限 |
| apps/stores | 店舗、店舗設定、メニュー、利用ツール |
| apps/customers | 顧客、同意、顧客メモ |
| apps/reservations | 予約/来店履歴 |
| apps/sales | 売上履歴 |
| apps/imports | CSV取込、マッピング、検証、エラー管理 |
| apps/insights | 顧客状態判定、インサイト保存 |
| apps/dashboard | KPI集計、今週のアクション、診断カード |
| apps/ai_core | AI Provider Adapter、Mock診断 |
| apps/audit | 監査ログ |
| tests | backendテスト |

### 3.3 frontend 配下

| ディレクトリ | 役割 |
|---|---|
| src/app | ルーティング、アプリ全体設定 |
| src/components | 共通UIコンポーネント |
| src/features/auth | ログイン、認証状態 |
| src/features/setup | 初期セットアップ |
| src/features/dashboard | ダッシュボード |
| src/features/stores | 店舗設定 |
| src/features/customers | 顧客一覧、顧客詳細 |
| src/features/imports | CSV取込画面 |
| src/lib | API Client、共通関数 |
| src/types | TypeScript型定義 |

### 3.4 docs 配下

Claude Codeが参照する実装用ドキュメントは `docs/` 直下に置く。

長い仕様書は `docs/specs/` 配下に分類して置く。

```text
docs/
  ARCHITECTURE.md
  DEVELOPMENT_PLAN.md
  API_CONTRACT.md
  SEED_DATA_SPEC.md
  SECURITY_CHECKLIST.md
  CLAUDE_TASK_PROMPTS.md
  specs/
    planning/
    requirements/
    api/
    db/
    ai/
    privacy/
    csv/
    legal/
```

---

## 4. docs配置ルール

### 4.1 Claude Codeに優先参照させるファイル

Claude Codeに作業を依頼する際は、原則として以下を優先参照させる。

| 優先度 | ファイル | 用途 |
|---|---|---|
| 1 | CLAUDE.md | 開発ルール、禁止事項、Phase1範囲 |
| 2 | docs/ARCHITECTURE.md | 技術構成、責務分離、アプリ構成 |
| 3 | docs/DEVELOPMENT_PLAN.md | 実装タスク順序 |
| 4 | docs/API_CONTRACT.md | API仕様 |
| 5 | docs/SEED_DATA_SPEC.md | サンプルデータ |
| 6 | docs/SECURITY_CHECKLIST.md | セキュリティ確認 |

### 4.2 長い仕様書の扱い

既存の仕様書は、以下のように配置する。

```text
docs/specs/planning/
  01_AIコンサルCRM_企画要求仕様書_v0.2.md
  02_AIコンサルCRM_再設計方針書_v0.2.md
  17_AIコンサルCRM_開発ロードマップ_v0.2.md


docs/specs/requirements/
  05_AIコンサルCRM_業務要件定義書_v0.2.md
  06_AIコンサルCRM_機能要件定義書_v0.2.md
  08_AIコンサルCRM_画面設計書_v0.2.md


docs/specs/db/
  09_AIコンサルCRM_データベース設計書_v0.2.md
  03_AIコンサルCRM_データ戦略仕様書_v0.2.md


docs/specs/privacy/
  10_AIコンサルCRM_同意管理・プライバシー仕様書_v0.1.md


docs/specs/ai/
  07_AIコンサルCRM_AI機能仕様書_v0.2.md
  20_AIコンサルCRM_AIプロンプト設計書_v0.1.md


docs/specs/csv/
  18_AIコンサルCRM_CSV取込・出力仕様書_v0.1.md


docs/specs/legal/
  04_AIコンサルCRM_法令・規約・外部API前提整理書_v0.1.md
  12_AIコンサルCRM_業種別広告表現チェック仕様書_v0.1.md
```

### 4.3 実装時の注意

Claude Codeには、長い仕様書をすべて読ませて一括実装させない。

実装時は以下の順に参照させる。

```text
CLAUDE.md
↓
docs/ARCHITECTURE.md
↓
docs/DEVELOPMENT_PLAN.md
↓
対象機能に関係する仕様書
```

---

## 5. 初期セットアップ手順

## 5.1 リポジトリ作成

```bash
mkdir ai-consult-crm
cd ai-consult-crm

git init
```

初期ファイルを作成する。

```bash
mkdir backend frontend docs scripts sample_data
mkdir -p docs/specs/{planning,requirements,api,db,ai,privacy,csv,legal}
mkdir -p scripts/seed scripts/import_samples

touch README.md CLAUDE.md .gitignore
```

---

## 5.2 backend 初期化案：Django REST Framework

### 5.2.1 Python仮想環境作成

```bash
cd backend
python -m venv .venv
```

Windows PowerShellの場合：

```bash
.\.venv\Scripts\Activate.ps1
```

WSL / macOS / Linux の場合：

```bash
source .venv/bin/activate
```

### 5.2.2 必要パッケージインストール

```bash
pip install django djangorestframework psycopg2-binary python-dotenv django-cors-headers djangorestframework-simplejwt
pip freeze > requirements.txt
```

必要に応じて追加候補：

```bash
pip install pytest pytest-django black ruff
```

### 5.2.3 Djangoプロジェクト作成

```bash
django-admin startproject config .
mkdir apps
```

### 5.2.4 Django app 作成

```bash
python manage.py startapp accounts apps/accounts
python manage.py startapp stores apps/stores
python manage.py startapp customers apps/customers
python manage.py startapp reservations apps/reservations
python manage.py startapp sales apps/sales
python manage.py startapp imports apps/imports
python manage.py startapp insights apps/insights
python manage.py startapp dashboard apps/dashboard
python manage.py startapp ai_core apps/ai_core
python manage.py startapp audit apps/audit
```

Djangoの `startapp` はディレクトリ作成済みだと失敗する場合があるため、実際にはClaude Codeに構成確認させてから実行する。

---

## 5.3 frontend 初期化案：React + TypeScript + Vite

```bash
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install
```

追加候補：

```bash
npm install axios react-router-dom zod
npm install -D eslint prettier
```

UIライブラリは初期段階では必須にしない。

必要になった段階で以下を検討する。

- shadcn/ui
- Tailwind CSS
- Material UI
- Chakra UI

Phase1では、UIライブラリ導入よりも、画面フローとAPI接続を優先する。

---

## 5.4 PostgreSQL準備

### 5.4.1 ローカルPostgreSQL利用

ローカル環境でPostgreSQLを利用する場合、DBを作成する。

```bash
createdb ai_consult_crm_dev
```

### 5.4.2 Docker利用候補

Dockerを使う場合は、Phase1開始時点で必須ではないが、以下のような構成を検討する。

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ai_consult_crm_dev
      POSTGRES_USER: ai_crm_user
      POSTGRES_PASSWORD: ai_crm_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Docker化は便利だが、初期開発のハードルが上がる場合は後回しでもよい。

---

## 6. 環境変数

### 6.1 backend/.env.example

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DATABASE_URL=postgres://ai_crm_user:ai_crm_password@localhost:5432/ai_consult_crm_dev

CORS_ALLOWED_ORIGINS=http://localhost:5173

AI_PROVIDER=mock
OPENAI_API_KEY=
GEMINI_API_KEY=

FILE_STORAGE=local
MEDIA_ROOT=media

LOG_LEVEL=INFO
```

### 6.2 frontend/.env.example

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_NAME=AIコンサルCRM
```

### 6.3 環境変数の注意

- `.env` はGit管理しない
- `.env.example` はGit管理する
- APIキーをコードに直接書かない
- 本番環境ではSecret Manager等を検討する

---

## 7. .gitignore 初期案

```gitignore
# Python
__pycache__/
*.py[cod]
*.sqlite3
.venv/
.env
media/
staticfiles/

# Node
node_modules/
dist/
build/
.env.local
.env.*.local

# OS / Editor
.DS_Store
Thumbs.db
.vscode/settings.json

# Logs
*.log
logs/

# CSV uploads
backend/media/imports/
```

`.vscode/settings.json` は個人差が出やすいため、原則Git管理しない。

チーム共通設定が必要な場合は `.vscode/extensions.json` のみ共有を検討する。

---

## 8. 開発コマンド

### 8.1 backend

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver
```

Windows PowerShellの場合：

```bash
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py runserver
```

### 8.2 frontend

```bash
cd frontend
npm install
npm run dev
```

### 8.3 よく使うコマンド一覧

| 用途 | コマンド |
|---|---|
| backend起動 | `python manage.py runserver` |
| migration作成 | `python manage.py makemigrations` |
| migration実行 | `python manage.py migrate` |
| 管理ユーザー作成 | `python manage.py createsuperuser` |
| frontend起動 | `npm run dev` |
| frontend build | `npm run build` |
| frontend lint | `npm run lint` |

---

## 9. VSCode設定方針

### 9.1 推奨拡張機能

| 拡張機能 | 用途 |
|---|---|
| Python | Python/Django開発 |
| Pylance | 型補完 |
| ESLint | Frontend lint |
| Prettier | Format |
| GitLens | Git履歴確認 |
| Markdown All in One | 仕様書編集 |
| Claude Code | AI開発支援 |

### 9.2 VSCodeワークスペース運用

リポジトリルート `ai-consult-crm/` をVSCodeで開く。

```text
File > Open Folder > ai-consult-crm
```

Claude Codeもリポジトリルートで起動する。

### 9.3 Claude Code起動前に確認すること

- `CLAUDE.md` がリポジトリルートにある
- `docs/ARCHITECTURE.md` がある
- `docs/DEVELOPMENT_PLAN.md` がある
- `.env.example` がある
- Git管理されている
- 直前の変更がcommit済み、または差分を把握している

---

## 10. Claude Code利用手順

### 10.1 基本ルール

Claude Codeには、1回の依頼で大きすぎる範囲を渡さない。

原則：

```text
1依頼 = 1タスク
```

大きくても、関連する2タスクまでにする。

### 10.2 依頼テンプレート

```text
P1-XXX [タスク名] を実装してください。

参照ファイル：
- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/DEVELOPMENT_PLAN.md
- docs/API_CONTRACT.md

実装範囲：
- [今回実装すること]

実装しないこと：
- LINE自動配信
- Lステップ連携
- Phase1範囲外の機能

注意：
- store_id によるデータ分離を守る
- 個人情報をログに出さない
- APIレスポンス形式を統一する
- テストまたは動作確認方法も提示する
```

### 10.3 悪い依頼例

```text
AIコンサルCRMを全部作ってください。
```

```text
顧客管理とCSVとAI診断とダッシュボードを一気に作ってください。
```

### 10.4 良い依頼例

```text
P1-007 顧客モデル/APIを実装してください。

参照ファイル：
- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACT.md

要件：
- customersテーブルを作成
- store_idを必須にする
- 論理削除に対応
- 顧客一覧API、詳細API、作成API、更新APIを作成
- APIレスポンス形式を共通仕様に合わせる

実装しないこと：
- LINE userId連携
- セグメント生成
- AI顧客分析
```

---

## 11. Git運用

### 11.1 ブランチ方針

Phase1ではシンプルな運用でよい。

| ブランチ | 用途 |
|---|---|
| main | 安定版 |
| develop | 開発統合 |
| feature/p1-xxx | 各タスク実装 |

小規模開発の場合は、`main` + `feature/*` のみでもよい。

### 11.2 ブランチ命名

```text
feature/p1-001-project-init
feature/p1-007-customers-api
feature/p1-011-csv-import-base
feature/p1-018-dashboard
```

### 11.3 コミットメッセージ

```text
feat: add customer model and APIs
fix: prevent cross-store customer access
chore: add env example
refactor: split import validation service
docs: update API contract
```

### 11.4 Claude Code作業前後

作業前：

```bash
git status
git checkout -b feature/p1-xxx-task-name
```

作業後：

```bash
git status
git diff
# 動作確認
# 問題なければcommit
git add .
git commit -m "feat: implement p1-xxx task"
```

### 11.5 注意

Claude Code作業後は、必ず差分を確認する。

```bash
git diff
```

意図しないファイル変更、Phase1範囲外の実装、個人情報ログ出力がないか確認する。

---

## 12. 初期開発順序

Phase1では以下の順で進める。

```text
P1-001 プロジェクト初期化
P1-002 環境変数・設定ファイル整備
P1-003 認証基盤
P1-004 店舗モデル・店舗API
P1-005 店舗設定・利用ツールAPI
P1-006 メニューモデル・メニューAPI
P1-007 顧客モデル・顧客API
P1-008 同意/配信停止モデル・API
P1-009 予約/来店モデル・API
P1-010 売上モデル・API
P1-011 CSVアップロード基盤
P1-012 顧客CSV取込
P1-013 予約/来店CSV取込
P1-014 売上CSV取込
P1-015 顧客状態判定ロジック
P1-016 顧客一覧画面
P1-017 顧客詳細画面
P1-018 ダッシュボード初期版
P1-019 AI診断モック・今週のアクション
P1-020 監査ログ初期実装
```

---

## 13. 初期README案

```md
# AIコンサルCRM

個人店・小規模店舗向けに、公式LINEを主要な顧客接点として活用しながら、顧客データ・予約/来店データ・売上データを整理し、AIが集客・再来店・顧客フォローの次アクションを提案する相談型マーケティングCRMです。

## Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Important Docs

- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/DEVELOPMENT_PLAN.md
- docs/API_CONTRACT.md
- docs/SEED_DATA_SPEC.md
```

---

## 14. 初期環境構築の完了条件

以下を満たしたら、環境構築完了とする。

1. Gitリポジトリが作成されている
2. `CLAUDE.md` が配置されている
3. `docs/ARCHITECTURE.md` が配置されている
4. `docs/DEVELOPMENT_PLAN.md` が配置されている
5. backend が起動できる
6. frontend が起動できる
7. PostgreSQLに接続できる
8. `.env.example` が用意されている
9. `.env` がGit管理外になっている
10. Claude CodeにP1-001を依頼できる状態になっている

---

## 15. 注意点・判断事項

### 15.1 Django REST Frameworkで進める場合

Django REST Frameworkは、以下の理由でPhase1に向いている。

- 顧客管理・店舗管理・CSV取込に強い
- 管理画面を利用しやすい
- PostgreSQLとの相性が良い
- 認証・権限管理を実装しやすい
- Claude Codeでも標準的な構成を扱いやすい

### 15.2 FastAPIを選ぶ場合

FastAPIを選ぶ場合は、以下を別途設計する必要がある。

- ORM選定
- migration管理
- 認証管理
- 管理画面
- app分割
- OpenAPI活用

### 15.3 Next.jsを選ぶ場合

Next.jsを選ぶ場合は、以下を検討する。

- ルーティング設計
- SSRが必要か
- API層をNext側に持つか
- Django APIとの責務分離

Phase1では、React + Vite の方がシンプルに始めやすい。

---

## 16. 次に作成するドキュメント

次に作成するべきドキュメントは以下である。

1. サンプルデータ仕様書 v0.1
2. API Contract詳細 v0.1
3. セキュリティチェックリスト v0.1
4. Claude Codeタスクプロンプト集 v0.1

優先順位は、以下を推奨する。

```text
1. サンプルデータ仕様書
2. API Contract詳細
3. セキュリティチェックリスト
4. Claude Codeタスクプロンプト集
```
