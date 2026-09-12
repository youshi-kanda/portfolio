# Portfolio Work Inventory

Issue: [#5 \[Phase 2\] 全プロジェクト棚卸しと掲載ランク決定](https://github.com/youshi-kanda/portfolio/issues/5)
Branch: `issue/5-project-inventory`
調査日: 2026-09-13（第 3 版）
入力: [#4 UI / IA 調査](./portfolio-ui-ia-research.md)

この文書は **Repository Inventory ではなく Work Inventory** である。
「どの repository を公開できるか」ではなく、**「Portfolio Work として何を見せられるか」**で
全候補を評価した。UI・HERO・CSS・`site.json`・作品 JSON の実装変更は一切含まない。

### 版の履歴

| 版 | 変えたこと |
|---|---|
| 第 1 版 | repository 単位・publishability 中心の棚卸し |
| 第 2 版 | 80 repository を 28 Portfolio Work へ再集約。Featured をゼロベースで選び直した |
| **第 3 版** | **採用案件の分類を「業務自動化」から「業務 Web Application」へ訂正**。Strong Featured を再評価。public 文書としての記述粒度を Portfolio 判断に必要な範囲まで絞った |

---

## 0. 調査方法と、この文書における「事実」の定義

### 取得したもの

GitHub CLI で個人アカウント + 所属 Organization 2 件を列挙し、**80 repository すべて**に対して
メタデータ・**全ファイルツリー**（空でない 68 repository）・README 全文を取得した。
強い候補についてはさらに、主要な画面構成 / API の役割 / データモデルの主題 /
設計文書 / commit author 内訳まで確認している。

**default branch だけを見ていない。** 第 2 版で分類を誤った採用案件は、
default branch に初期版しか無く、**最終実装は別 branch にあった**（§Correction Log）。
主要候補については branch 一覧を確認したうえで、最も進んだ実装を評価対象としている。

### 事実と推測の線引き

- 本文のプロダクト内容・技術・機能は、すべて当該 repository から読み取れる範囲に限る。
- 商用実績・利用者数・売上・稼働状況・契約内容・業務成果は **1 件も記載していない。**
- **担当範囲はコミット数だけから推測していない。** commit author 内訳で言えることだけを書き、
  確定できないものは §Human Questions へ送った。

### 固有名と記述粒度の取り扱い（重要）

**この `portfolio` repository は public である。** private / Organization の Work については、
**Portfolio 判断に必要な粒度までに記述を絞っている。**

**記載するもの**: 匿名 Work ID / Portfolio title / 何を作ったか / 誰向けか（安全な一般表現） /
担当範囲 / 主要技術（一般技術名のみ、5〜8 個程度） / Portfolio Value / Featured 理由 /
Disclosure Mode / 本人確認事項

**記載しないもの**: private repository 名・URL / 顧客名・会社名・サービス名・製品名 /
業種名 / 内部ファイル名・モジュール名 / migration 本数・table 本数・API 本数 /
内部設計文書の固有名称 / repository 構造を逆算できる詳細

RAG / Embedding / LLM / Vector Search / React / Next.js / Python / PostgreSQL / Supabase /
Cloudflare / Docker / GAS / OAuth / Workflow / Audit / RBAC といった**一般技術名は記載する。**

private 由来の Work はすべて匿名 ID で管理し、**ID と実 repository の対応表は
この public repository に置いていない。** 名称をそのまま書いているのは **すでに public な repository のみ**。

| 接頭辞 | 指すもの |
|---|---|
| `ANON-AI-xx` | AI / LLM を中核とする Work |
| `ANON-WEBAPP-xx` | 業務 Web Application |
| `ANON-PLATFORM-xx` | 業務プラットフォーム・基盤系 |
| `ANON-AUTOMATION-xx` | 業務自動化・ワークフロー系 |
| `ANON-APP-xx` | モバイル / PWA 単体 |
| `ANON-BIZ-xx` | 特定業種向け業務システム |
| `ANON-WEB-xx` | サイト / LP 制作 |
| `ANON-TOOL-xx` | 個人ツール・社内ツール |

### 2 軸の分離（公開可否と技術価値を混ぜない）

**Portfolio Value** と **Disclosure Mode** は完全に別軸として記録する。
**GitHub 公開可否は Portfolio Value の点数に一切入れていない。**

**A. Portfolio Value**: `Strong Featured` / `Featured candidate` / `More Projects` /
`Supporting / Experiment` / `Low Priority`

**B. Disclosure Mode**: `Public` / `Anonymous` / `Limited` / `Reconstructed Demo` /
`Private Only` / `Human Confirmation Required`

`Human Confirmation Required` の Work も Portfolio Value は必ず評価してある。

### Visual Strength の 2 分割

**「現在画像があるか」と「Portfolio 用 visual を安全に作れるか」を分けて**記録する。
既存スクリーンショットが無いことを理由に Featured から落とした Work は **1 件も無い。**

---

## 1. Executive Summary

| 項目 | 件数 |
|---|---|
| Repositories reviewed | **80**（public 25 / private 55、うち空 12） |
| ファイルツリーまで精査した repository | **68** |
| **Portfolio Works identified** | **28** |
| Strong Featured candidates | **5** |
| Featured candidates | **6** |
| More Projects | **9** |
| Supporting / Experiment | **5** |
| Low Priority | **3** |
| 匿名掲載が前提の Work | **14** |
| Human confirmation items | **17** |

### 第 3 版で変わったこと

1. **採用案件の分類を訂正した。** 「GAS による業務自動化」ではなく
   **「React + TypeScript の採用管理 Web Application」**が最終形である。
   Strong Featured 内の順位も上がった（§Correction Log）。
2. **`ANON-PLATFORM-01`（業務情報プラットフォーム）を Recommended Featured から外した。**
   既存方針上、現時点では掲載候補に載せない。**Technical Value の記録は保持する**（§4）。
3. **記述粒度を public 文書として適正化した。** 内部モジュール名・API 本数・
   migration 本数・設計文書の固有名称を削除し、Portfolio 判断に必要な情報だけを残した。

---

## 2. Portfolio Work Matrix

Portfolio Value 順。`Core Tech` は依存 package の羅列ではなく、
**システムの中核で使われていることが確認できたもの**に絞っている。

| # | Work | Type | Target / User | What was built | Role | Core Tech | Portfolio Value | Disclosure Mode |
|---|---|---|---|---|---|---|---|---|
| 1 | `ANON-AI-01` | AI 業務支援 | 相談業務のオペレーター | 顧客から聞き取った条件をもとに、商品ごとの適用可否を社内基準に照らして自動判定し、根拠を社内ナレッジから検索して提示する相談支援 SaaS | Frontend / Backend / AI integration / Database / Auth / Workflow | React / TypeScript / Supabase / PostgreSQL / RAG + Vector Search / LLM / Stripe / Cloudflare | **Strong Featured** | Anonymous / Human Confirmation Required |
| 2 | `ANON-WEBAPP-01` | Business Web Application / Recruitment Management | 採用担当者と応募者 | 応募受付から選考、応募者管理、面接日程までを一元管理する採用管理 Web アプリ。管理画面で選考状況と合否を管理し、カレンダー連携の面接予約・通知まで実装 | Frontend / Backend / Database / Auth / Workflow / Infrastructure | React / TypeScript / Cloudflare Pages / Pages Functions / Cloudflare D1 / Google Calendar API / Twilio / GAS | **Strong Featured** | Limited / Human Confirmation Required |
| 3 | `ANON-AI-02` | AI 業務支援 Platform | 企業の従業員 | AI 秘書・社内向け AI チャット・管理ポータルの 3 アプリを 1 基盤に載せた monorepo。組織単位のテナント分離・権限・監査を備える | Frontend / Backend / AI integration / Architecture / Database / Auth / Infra | React / TypeScript / Supabase / PostgreSQL / RAG（hybrid search・semantic search・multi-agent）/ LLM / Google OAuth / Slack | **Strong Featured** | Anonymous |
| 4 | `ANON-PLATFORM-02` | 業務オペレーション Platform | 現場スタッフと管理者 | 権限とスコープ、状態遷移を先に設計してから、日報・動画マニュアル・面接処理・通知を同じ権限モデルの上に載せた業務運用プラットフォーム | Frontend / Backend / Architecture / Database / Auth / Workflow / Infra | Next.js / React / Cloudflare Workers（BFF）/ Supabase Edge Functions / PostgreSQL / RBAC + RLS / Web Push | **Strong Featured** | Anonymous |
| 5 | `ANON-AI-03`（公開デモ `ai-crm-demo` あり） | AI 業務支援 / CRM | 個人店・小規模店舗とその支援代理店 | 公式 LINE を主要な顧客接点として顧客・予約・売上を統合し、AI が次アクションを提案する相談型マーケティング CRM。承認権限・月次レポート・広告表現リスク表示・監査まで実装 | Frontend / Backend / AI integration / Database / Auth / Testing / CI/CD | Django REST Framework / PostgreSQL / React / TypeScript / Redis + Celery / LINE 連携 / PWA / Cloudflare | **Strong Featured** | Public（デモ）/ Anonymous（実装元） |
| 6 | `ANON-PLATFORM-01` | Platform / Architecture | 紙・PDF・画像・音声が混在する業務現場 | 業務書類を受け付け → AI 抽出 → **人による確認を経て確定データへ昇格** → 目的別に再利用する情報ライフサイクル基盤。AI は交換可能な処理層として分離 | Architecture / Backend / Database / Testing / CI/CD / Automation | Python / PostgreSQL / LLM による構造化抽出 / GAS / OCR / Audit / Workflow | **Featured candidate**（Recommended Featured からは現時点で除外） | Anonymous / Human Confirmation Required |
| 7 | `ANON-AI-04` | AI SaaS 基盤 | 複数企業のナレッジ検索利用者 | テナントごとに配信するナレッジ AI チャット SaaS。第 1 世代から第 2 世代へ作り替えた経緯が残る | 世代により異なる。一部テナントで本人の直接コミットを確認、他は不明 | Python / Django / PostgreSQL / Cloudflare Workers / Supabase / RAG + Vector Search / Stripe | **Featured candidate** | Anonymous / Human Confirmation Required |
| 8 | `ANON-PM-01`（公開デモ `gas-project-management-demo` あり） | Automation / PM | PM・PMO・非エンジニアを含むチーム | Google Sheets を正本とする複数プロジェクト進捗管理と、Git を事実源に現在地・Risk・Decision を再構築する PM 伴走基盤 | Automation / Architecture / Testing | GAS / Google Sheets / GitHub API / CI | **Featured candidate** | Public（デモ）/ Anonymous（実装元） |
| 9 | `ANON-PLATFORM-03` | Platform / 決済 | 運営者・加盟店スタッフ・エンドユーザー | 運営管理 / 店舗管理 / ユーザーアプリ / 決済端末 の 4 サービスを独立させたポイント基盤 | Frontend / Backend / Database / Infra | Python / Next.js / PostgreSQL / QR 決済 / Docker / CI/CD | **Featured candidate** | Anonymous / Human Confirmation Required |
| 10 | `ANON-AI-05` | AI / 採用 | 採用担当と応募者 | 動画・音声で回答し自動文字起こしされた内容を採用担当が評価する面接システム。**4 つの独立した実装**が存在する | 実装により異なる。担当が確定できないものが多い | Next.js / Whisper / FastAPI / Cloudflare Workers + R2 / LLM / GAS | **Featured candidate** | Anonymous / Human Confirmation Required |
| 11 | `ANON-BIZ-01` | 業務管理 | 農園の現場作業員と管理者 | マルチテナント農業工程管理。GPS 付き作業ログ・ワンタップ打刻・招待制ユーザー管理・管理者ダッシュボード | Frontend / Backend / Database / Auth | Next.js / TypeScript / Firebase / マルチテナント / 招待フロー | **Featured candidate** | Anonymous |
| 12 | `minio-access-management` | Infrastructure | 社内ストレージ管理者 | ストレージの GUI 管理コンソール。バケット・ユーザー・ポリシー・招待・監査ログ・期限付き共有リンク | Frontend / Backend / Infra / Auth | MinIO / Docker / TypeScript / Google OAuth 2.0 / 監査ログ | **More Projects** | Public |
| 13 | `-OCR-LLM_System` | AI / Document | 記帳・経理担当 | 通帳の画像・PDF から取引データを抽出し CSV 出力する Web アプリ。**2 つの LLM を併用**し、WebSocket で進捗表示 | Frontend / Backend / AI integration / Infra | React / TypeScript / Python / PostgreSQL / Docker / WebSocket / LLM 2 系統 | **More Projects** | Public |
| 14 | `ANON-APP-01` | Mobile App | 乗客とドライバー | 配車アプリ 2 本（乗客向け・ドライバー向け）。地図・位置情報・リアルタイム配車 | Frontend / Mobile / Integration | React Native / Expo / iOS + Android ネイティブビルド / WebSocket / 位置情報 | **More Projects** | Anonymous / Human Confirmation Required |
| 15 | `ANON-BIZ-02` | 業務 SaaS デモ | 会計担当 | 会計 SaaS のモバイル提案デモ。検索 → 確認 → 絞り込み → **承認 / 差戻し** → 証憑 OCR 紐付け の 5 操作 | Frontend / Demo 設計 | モバイル UI / 承認フロー / OCR 連携 | **More Projects** | Anonymous |
| 16 | `tennis_yoyaku` | Automation / PWA | 予約枠を確保したい個人利用者 | 予約サイトの空き枠を監視する PWA。監視間隔の最適化でリソース 95% 削減と repository が記録 | Frontend / Automation / Infra | TypeScript / PWA / スクレイピング / CI | **More Projects** | Public / Human Confirmation Required |
| 17 | `ANON-AI-06` | AI Automation | 記録業務の担当者 | 音声から業務記録を生成し、マスタとシートへ反映するジョブ管理付きの AI 記録システム MVP | Automation / AI integration | GAS / LLM / Google Sheets / Docs / ジョブ管理 | **More Projects** | Anonymous / Human Confirmation Required |
| 18 | `ANON-TOOL-01` | Tooling | 設計・提案文書を作る自分とレビュアー | 複数案件の設計・要件・提案資料を正本 Markdown から一貫生成・レビューする Workspace | Architecture / Tooling | Markdown 正本管理 / AI エージェント Workflow | **More Projects** | Anonymous |
| 19 | `AIStudy_Agent` | AI / 学習 | 学習者 | コース・ステップ・クイズ・コードエディタを持つ学習アプリに AI チャットを統合 | Frontend / Backend / AI integration | Next.js / Supabase / LLM / コードエディタ | **More Projects** | Public |
| 20 | `ANON-WEB-01` | Web 制作 | 事業会社のサイト訪問者 | コーポレートサイト・LP の制作 6 案件。Astro / WordPress / React の 3 系統、CMS 連携と外部媒体の自動同期を含む | Frontend / CMS 連携 / Infra | Astro / WordPress / Docker / React / ヘッドレス CMS / GitHub Actions | **More Projects** | Anonymous / 一部 Public |
| 21 | `ANON-APP-02`（public `hear-and-save`） | PWA | 会話を記録したい利用者 | ブラウザ録音とブックマークで会話を保存する PWA | Frontend / CI/CD | React / TypeScript / GitHub Actions / Pages | **More Projects** | Public |
| 22 | `ANON-AUTOMATION-02` | Automation / CRM | 店舗の公式 LINE 運用者 | 公式 LINE の構築運用管理。棚卸し・シナリオ設計・タグ設計・来店チェックイン導線 | 設計・運用（実装コード無し） | LINE 公式アカウント / シナリオ設計 | **Supporting** | Anonymous |
| 23 | `MINPAKU` | 業務支援 | 短期賃貸ビジネスのコンサルタント | 物件データから収益予測 PDF を生成し通知する営業支援ツール | Backend / Automation | Python / Docker / PDF 生成 / LINE 通知 | **Supporting** | Public（§7 の対応事項あり） |
| 24 | `ANON-TOOL-02` | 個人 MVP | 本人 | 体重・食事・飲酒を記録する Web アプリ。**DB に Google Spreadsheet を採用**した割り切り構成 | Frontend / Backend / Infra | React / Cloudflare Pages + Functions / Google Spreadsheet | **Supporting** | Human Confirmation Required |
| 25 | `ANON-TOOL-03` | Automation | 小規模事業のシフト管理者 | シフト・台帳管理の GAS 実装 | Automation | GAS / Google Sheets / clasp | **Supporting** | Human Confirmation Required |
| 26 | `ANON-WEB-02` | Experiment | — | 生成 AI 開発環境で作った UI・LP の試作群 5 件。本人の実装痕跡が薄い | 不明 | React / TypeScript | **Supporting / Experiment** | Private Only |
| 27 | `ANON-TOOL-04` | Learning | 本人 | 学習記録（ナレッジ vault 2 件・Python notebook 群・Java 学習 workspace・学習ハブ） | — | Obsidian / Jupyter / Java | **Low Priority** | Private Only |
| 28 | （空 repository） | — | — | ファイルが 1 件も無い repository 12 件 | — | — | **Low Priority** | Private Only |

---

## 3. Strong Featured Candidates

**Portfolio の最初に見せるべき 5 件。**
順位は Portfolio Value のみで決めており、**GitHub 公開可否は順位に含めていない。**

`ANON-PLATFORM-01` は Technical Value では上位に入るが、既存方針上
**現時点では Recommended Featured から外している**（§4 に記録を保持）。

---

### 1 位 — `ANON-AI-01`

- **Portfolio title candidate**: 「相談業務オペレーター向け AI 相談支援システム」
  （**業種名は本書に記載しない。** 業種を出してよければより具体的な題名にできる — Q1）
- **紹介文案**
  オペレーターが顧客から聞き取った内容をもとに、商品ごとの適用可否を社内基準に照らして自動判定し、
  判断根拠を社内ナレッジから検索して提示する相談支援 SaaS。
  相談記録は PDF 化され、保持期限後に自動で匿名化される。
- **Product type**: AI 業務支援システム（マルチテナント SaaS）
- **Role**: Frontend / Backend / AI integration / Database / Authentication / Workflow
  （本人名義の直接コミットを多数確認。ただし生成 AI 開発環境経由のコミットの帰属は未確定 — Q5）
- **Core technologies**: React / TypeScript / Supabase / PostgreSQL /
  **RAG + Vector Search + Embedding** / LLM（回答生成・文書構造化・音声認識）/ Stripe / Cloudflare
- **なぜ Featured なのか**
  1. **業務課題との結びつきが一番はっきりしている。** 「聞き取った条件から、どの商品が
     適用可能かを判断する」という、人が時間をかけて調べていた判断そのものを対象にしている。
  2. **RAG が飾りではない。** ナレッジ分割 → 埋め込み生成 → ベクトル検索 → 引用付き回答 までが
     個別の処理として実装され、既存データへの遡及適用まで用意されている。
  3. **業務システムとして必要なものが一通り揃っている。** テナント分離・組織階層・
     権限テンプレート・監査ログ・レート制限・規約同意ログ・保持期限後の自動匿名化。
  4. **課金まで作っている。** 従量課金とプラン管理があり、
     「動くデモ」ではなく「売る前提のプロダクト」であることが構成から分かる。
- **既存候補との違い**: 現行 Featured 3 件はいずれも synthetic data の再構築デモである。
  本件は**業種特化のドメインモデルを実際に持つ実プロダクト**で、証明の種類が違う。
- **Visual Strength**: 現在画像 **なし** / **安全に作れる**。
  相談フロー（聞き取り → 判定 → 比較表 → PDF）の architecture-style visual と、
  ダミーの商品名・条件による sanitized mock screen で構成可能。実データは使わない。
- **Disclosure Mode**: `Anonymous` / `Human Confirmation Required`
- **人間に確認する事項**: Q1 / Q2 / Q5 / Q9

---

### 2 位 — `ANON-WEBAPP-01`

- **Portfolio title candidate**: 「採用管理 Web Application」
- **紹介文案**
  応募受付から選考、応募者管理、面接日程までを一元管理する採用管理 Web アプリ。
  管理画面から選考状況を管理し、Google Calendar と連携した面接予約・通知まで実装。
- **Product type**: Business Web Application / Recruitment Management
- **何を作ったか → 業務フロー → 技術**
  1. **何を作ったか**: 採用担当が日常的に開く管理画面と、応募者が入力する応募・予約画面を
     ひとつのシステムとして作った。応募者一覧・検索・詳細表示、選考ステータス管理、
     **合否判定**、面接の予約・変更・キャンセル、担当者管理、統計ダッシュボードを備える。
  2. **業務フロー**: 応募 → 質問への回答 → 応募者情報の確認 → 選考ステータス更新 →
     面接枠の提示と予約 → カレンダー登録 → 通知 → 合否判定 → 記録の保持期限管理。
     **応募者の個人情報を保持期限後に匿名化する処理**まで業務フローに含めている。
  3. **技術**: React / TypeScript の管理画面を Cloudflare Pages に、
     API を Pages Functions に、主データを Cloudflare D1 に置いた構成。
     Google Calendar API で面接枠と予定を同期し、Twilio で応募者への連絡を送る。
     **GAS は初期段階と外部連携の構成要素**であり、最終プロダクトの中心ではない。
     表計算からデータベースへの移行処理も実装されている。
- **Role**: Frontend / Backend / Database / Authentication / Workflow / Infrastructure
  （最終実装 branch の直接コミットは **210 件すべて本人名義**）
- **Core technologies**: React / TypeScript / Cloudflare Pages / Pages Functions /
  Cloudflare D1 / Google Calendar API / Twilio / GAS
- **なぜ Featured なのか**
  1. **「何を作ったか」が 1 文で伝わる。** Featured 条件の「見た人が仕事を頼めそうと思えるか」に
     最も素直に答える Work。採用管理という業務は説明が要らない。
  2. **業務 Web アプリとして一通り揃っている。** 一覧・検索・詳細・ステータス遷移・
     判定・予約・通知・権限・監査という、業務アプリで必ず求められる要素が全部ある。
  3. **個人情報の扱いを業務フローに組み込んでいる。** 保持期限と匿名化を後付けではなく
     機能として持っている点は、採用・人事領域では実務的な説得力がある。
  4. **段階的に作り替えた履歴が残っている。** 表計算を正本にした初期版から、
     データベースを正本にした Web アプリへ移行しており、**その判断を自分の言葉で説明できる。**
  5. **他 4 件と技術の性格が違う。** RAG でも RBAC 設計でもなく、
     **業務 Web アプリを最後まで作り切る力**の枠を埋める。
- **既存候補との違い**: 現行 Featured には「発注元の業務を回すために作られた Web アプリ」が無い。
  AI を主題にしない Work として、lineup の性格を広げる。
- **Visual Strength**: 現在画像 **なし** / **安全に作れる**。
  管理画面は sanitized mock screen（ダミー応募者・ダミー日程）で再現でき、
  応募 → 選考 → 面接 → 判定 のフロー図も実データ無しで作れる。
- **Disclosure Mode**: `Limited` / `Human Confirmation Required`
  （**発注元名が public repository の名称と README に含まれている。**
  発注元名を出すか、業種表現に留めるかの判断が必要 — Q11）
- **人間に確認する事項**: Q9 / Q11 / Q12

---

### 3 位 — `ANON-AI-02`

- **Portfolio title candidate**: 「組織向け AI アシスタント基盤（AI 秘書 / 社内 AI チャット / 管理ポータル）」
- **紹介文案**
  ひとつの基盤の上に、予定と連絡先を扱う AI 秘書、社内ナレッジに答える AI チャット、
  組織と設定を管理する管理ポータルの 3 アプリを載せた monorepo。
  組織単位のテナント分離・権限・監査まで作り込んである。
- **Product type**: AI 業務支援 Platform（マルチテナント）
- **Role**: Frontend / Backend / AI integration / Architecture / Database / Authentication / Infrastructure
  （ほぼ単独。先行実装と後継の monorepo の両方で本人の直接コミットを確認）
- **Core technologies**: React / TypeScript / Supabase / PostgreSQL /
  **RAG（hybrid search・semantic search・multi-agent）** / LLM（生成・音声認識・音声合成）/
  Google OAuth（Calendar・Contacts）/ Slack 連携
- **なぜ Featured なのか**
  1. **RAG の「精度を上げる工夫」が具体的にある。** hybrid search・semantic search・
     再ランキング・クエリ拡張・意図分類・長期記憶・multi-agent が個別に実装されており、
     「embedding して検索しました」で終わっていない。
  2. **鍵と権限の管理を正面から扱っている。** 組織ごとの設定解決、暗号化保管、
     監査ログが揃っており、**AI プロダクトの運用で一番面倒な部分を設計している**ことが示せる。
  3. **1 基盤 3 プロダクトという構造が、そのまま設計力の説明になる。**
     共通サービスを切り出した理由が、3 アプリの存在から自然に説明できる。
  4. **外部サービスと業務データがつながっている。** カレンダー・連絡先・Slack と連携し、
     チャットの中から予定作成まで到達する。
- **既存候補との違い**: 現行 Featured に「複数プロダクトを載せる基盤」が 1 件も無い。
  `ANON-AI-01` が業種特化の縦の深さなら、本件は**横に広げる基盤設計**で役割が重ならない。
- **Visual Strength**: 現在画像 **なし** / **安全に作れる**。
  3 アプリ + 共通基盤の構成図、RAG パイプライン図はいずれも顧客情報を含まない。
- **Disclosure Mode**: `Anonymous`
- **人間に確認する事項**: Q6 / Q9 / Q10

---

### 4 位 — `ANON-PLATFORM-02`

- **Portfolio title candidate**: 「業務運用プラットフォーム（権限設計 + 管理画面 + 通知）」
- **紹介文案**
  現場スタッフと管理者が使う業務運用プラットフォーム。
  **権限とスコープ、状態遷移を先に設計として確定させ**、日報・動画マニュアル・
  面接処理・通知を同じ権限モデルの上に載せている。
- **Product type**: 業務オペレーション Platform（マルチテナント）
  **AI 案件としてではなく、業務オペレーション・権限設計・Platform として評価している。**
- **Role**: Frontend / Backend / Architecture / Database / Authentication / Workflow / Infrastructure（単独）
- **Core technologies**: Next.js / React / **Cloudflare Workers を BFF として分離** /
  Supabase Edge Functions / PostgreSQL / **RBAC + RLS によるロール管理** / Web Push /
  tenant / project / user の 3 階層管理
- **なぜ Featured なのか**
  1. **権限設計を成果物として見せられる数少ない Work。** 権限の一覧、権限が及ぶスコープ、
     状態遷移を設計として先に確定させ、それがそのままデータベース側のアクセス制御に対応している。
     **業務システムで一番聞かれる部分に、見せられる答えがある。**
  2. **フロントとバックの間に BFF を置いた理由が構成から読める。**
     署名付きアップロードや検証を境界側に寄せ、重い処理は非同期側へ渡している。
  3. **通知まで作っている。** Web Push の購読・配信・設定が揃っており、
     「業務で実際に使われる状態」まで踏み込んでいる。
  4. **管理画面とテナント管理がある。** tenant / project / user を管理者が運用できる形になっている。
- **既存候補との違い**: 現行 Featured に「権限・ロール・承認」を主題にした Work が無い。
  lineup の中で **RBAC / Audit / Multi-tenant の枠**を埋める唯一の候補。
- **Visual Strength**: 現在画像 **なし** / **安全に作れる**。
  権限マトリクス図と状態遷移図は、ロール名を一般名詞に置き換えればそのまま掲載できる。
- **Disclosure Mode**: `Anonymous`
- **人間に確認する事項**: Q7 / Q9

---

### 5 位 — `ANON-AI-03`（公開デモ `ai-crm-demo` あり）

- **Portfolio title candidate**: 「小規模店舗向け AI 相談型マーケティング CRM」
- **紹介文案**
  公式 LINE を主要な顧客接点として、顧客・予約・売上データを整理し、
  AI が集客・再来店・顧客フォローの次アクションを提案する CRM。
  **実務向け CRM として作られており、本 repository にその公開可能な断面を実装済み。**
- **Product type**: AI 業務支援 / CRM（フルスタック）
- **Role**: Frontend / Backend / AI integration / Database / Authentication / Testing / CI/CD（単独）
- **Core technologies**: Django REST Framework / PostgreSQL / React / TypeScript /
  Redis + Celery（非同期処理）/ LINE 連携 / PWA・モバイル対応 / Cloudflare
- **なぜ Featured なのか**
  1. **「単なるデモ」ではない。** 最新の開発版では LINE 連携・非同期処理・
     **承認権限制御**・月次レポート・**広告表現リスク表示**・監査・PWA / モバイル対応・
     実機確認を通した配信設計まで進んでいる。
  2. **すでに公開できる断面が手元にある。** 実データを使わない公開デモが動いており、
     許可待ちの影響を受けずに掲載できる。
  3. **AI の提案を人が承認する構造**を持ち、`ANON-PLATFORM-01` の
     「人の確認を挟む」思想と一貫している。
  4. **法令・広告表現・同意管理まで詰めている。** 業種特化 CRM で避けられない部分を
     コードの外側でも設計しており、実務感の裏付けになる。
- **既存候補との違い**: 現行 Featured から唯一そのまま残す候補。ただし**位置づけを変える**。
  「デモ」ではなく **「実務向け CRM の公開可能な断面」**として提示する。
- **Visual Strength**: 現在画像 **あり**（publish 済み画像 7 枚 + 動画）/ 既存素材で足りる
- **Disclosure Mode**: `Public`（デモ）/ `Anonymous`（実装元）
- **人間に確認する事項**: Q8

---

## 3.5 Recommended Featured lineup

### A 案 — 「実務の厚み」を先に見せる（推奨）

| 位置 | Work | 埋める枠 |
|---|---|---|
| 1 | `ANON-AI-01` | 業種特化 AI × 実務判断の代替 |
| 2 | `ANON-WEBAPP-01` | 業務 Web アプリを最後まで作り切る力 |
| 3 | `ANON-AI-02` | AI 基盤 / RAG の作り込み |
| 4 | `ANON-PLATFORM-02` | RBAC / 業務オペレーション / Platform |
| 5 | `ANON-AI-03` | 触れる実物 / AI × Human approval |

**選ぶ理由**: 5 件が互いに役割で重ならず、
**AI 応用・業務アプリ・AI 基盤・権限設計・実物**の 5 方向を覆う。
1 位と 2 位で「AI も作るし、業務アプリも最後まで作る」という二面が最初の 1 画面で伝わる。

**リスク**: 1〜4 位が `Anonymous` / `Limited` のため、
**Q1 / Q5 / Q9 / Q11 の回答が出るまで確定できない。**
特に Q9（visual をどう用意するか）が決まらないと First viewport が作れない。

### B 案 — 許可待ちを前提に、今すぐ組める構成

| 位置 | Work | 埋める枠 |
|---|---|---|
| 1 | `ANON-AI-03`（公開デモ） | 触れる実物 / AI × Human approval |
| 2 | `ANON-PM-01` の公開断面 | 業務自動化 / 情報設計 |
| 3 | `minio-access-management` | Infrastructure / OAuth / 権限 |
| 4 | `-OCR-LLM_System` | Document AI / 複数 LLM の併用 |
| 5 | `AIStudy_Agent` | AI 応用アプリ |

**選ぶ理由**: **全件が今すぐ公開できる。** 許可も visual 作成も待たない。

**リスク**: 上位が synthetic data のデモと個人開発に寄り、**実務の規模が伝わらない。**

### 推奨

**A 案を本線とし、Q1 / Q5 / Q9 / Q11 の回答待ちの間は B 案で仮組みする。**
B 案の 1・2 位は A 案でもそのまま使えるため、作業は無駄にならない。
Q9 の回答が「architecture-style visual でよい」であれば、
**A 案の 1〜4 位は実画面を待たずに着手できる。**

---

## 4. Other Strong Works

### `ANON-PLATFORM-01` — 業務情報プラットフォーム（Technical Value のみ保持）

**既存方針上、現時点では Recommended Featured から外す。** 掲載候補としては扱わない。
ただし Technical Value は高く、記録としてここに残す。

紙・PDF・画像・音声で入ってくる業務情報を受け付け、AI で候補データへ構造化し、
**人による確認を経て確定データへ昇格**させて再利用可能な状態に保つプラットフォーム。
**AI を主役にしていない**点が設計の核で、AI 抽出は交換可能な処理層として分離されている。
候補データと確定データを別の概念として分け、その間に人のレビューを挟む構造になっている。
監査・系譜・冪等性は全レイヤを貫通する横断関心事として定義されている。

- Role: Architecture / Backend / Database / Testing / CI/CD / Automation（単独）
- Core tech: Python / PostgreSQL / LLM による構造化抽出 / GAS / OCR / Audit / Workflow
- Portfolio Value: `Featured candidate`（**Recommended Featured からは除外**）
- Disclosure: `Anonymous` / `Human Confirmation Required`
- 備考: 本 repository の `document-field-extraction-demo` は、この Work の
  抽出・確信度・レビューゲート部分のみを synthetic data で再構築した公開断面。
  **デモ側は掲載可能**であり、実 Work の掲載可否とは別に判断できる。

### `ANON-AI-04` — マルチテナント業務 AI チャット SaaS 基盤
複数 repository にまたがる。**第 1 世代**（静的フロント + エッジ実行 + 外部 AI 基盤）から
**第 2 世代**（ベクトル検索による RAG 再実装）へ作り替えた経緯が残っている。
「同じプロダクトを作り直した」という判断過程は題材として強いが、
**一部テナント以外は本人の直接コミットが確認できず、担当範囲が不明。**
Value: `Featured candidate` / Disclosure: `Anonymous` + `Human Confirmation Required`

### `ANON-PM-01` — 開発進捗管理と PM 伴走エージェント（公開デモあり）
Google Sheets を正本とする複数プロジェクト進捗管理と、
**Git を開発の主要な事実源に据えたまま、現在地・Risk・Decision・Release readiness を
継続的に再構築し、役割ごとに翻訳する** PM 伴走基盤。
「非エンジニアが最初に見る面と開発者が編集する面を同じ正本データから生成する」という情報設計は、
Portfolio サイトの設計思想とも一貫する。
Value: `Featured candidate` / Disclosure: `Public`（デモ）+ `Anonymous`（実装元）

### `ANON-PLATFORM-03` — ポイント / 会員プラットフォーム（4 サービス構成）
運営管理・店舗管理・ユーザーアプリ・決済端末を**独立した 4 サービス**として構成。
QR 読み取り、ポイント付与 / 使用、ギフト交換、店舗別レポート、取引管理。
**サービス分割の判断を説明できる規模**がある。
Value: `Featured candidate` / Disclosure: `Anonymous` + `Human Confirmation Required`

### `ANON-AI-05` — 動画 / 音声 AI 面接システム
**4 つの独立した実装**が存在する。同じ課題を 4 回作った事実自体がこの領域の経験の厚みを示すが、
単独の実装の多くは**担当範囲が repository から確定できない**。
なお `ANON-WEBAPP-01` および `ANON-PLATFORM-02` にも面接関連機能が含まれるが、
それぞれの Work の内部機能として扱っている。
Value: `Featured candidate` / Disclosure: `Anonymous` + `Human Confirmation Required`

### `ANON-BIZ-01` — 農業工程・勤怠管理（マルチテナント）
現場作業員のワンタップ打刻・GPS 付き作業ログと、管理者の工程管理・スタッフ管理・レポートを統合。
「現場はスマホ、管理は PC」という利用者の分離が画面構成に出ている。
Value: `Featured candidate` / Disclosure: `Anonymous`

---

## 5. More Projects

| Work | 一言 | Disclosure Mode |
|---|---|---|
| `minio-access-management` | ストレージの GUI 管理コンソール。バケット / ユーザー / ポリシー / 招待 / 監査ログ / 期限付き共有リンク。OAuth のドメイン制限つき | `Public` |
| `-OCR-LLM_System` | 通帳の画像 / PDF から取引データを抽出。**2 つの LLM を併用**、WebSocket 進捗表示、文字種の正規化 | `Public` |
| `ANON-APP-01` | 配車アプリ 2 本（乗客向け・ドライバー向け）。React Native + Expo、ネイティブビルドまで | `Anonymous` + 確認要 |
| `ANON-BIZ-02` | 会計 SaaS のモバイル提案デモ。検索 → 確認 → 絞り込み → **承認 / 差戻し** → 証憑 OCR 紐付け | `Anonymous` |
| `tennis_yoyaku` | 予約サイトの空き枠監視 PWA。監視間隔の最適化でリソース 95% 削減と repository が記録 | `Public` + 確認要 |
| `ANON-AI-06` | 音声から業務記録を生成する AI 記録システム MVP。マスタ連携とジョブ管理を分離 | `Anonymous` + 確認要 |
| `ANON-TOOL-01` | 設計・要件・提案資料を正本 Markdown から一貫生成・レビューする Workspace | `Anonymous` |
| `AIStudy_Agent` | コース / ステップ / クイズ / コードエディタ + AI チャットの学習アプリ | `Public` |
| `ANON-WEB-01` | コーポレートサイト / LP 制作 6 案件。Astro / WordPress / React の 3 系統、CMS 連携と外部媒体の自動同期 | `Anonymous` + 一部 `Public` |

---

## 6. Experiments

| Work | 内容 | Portfolio Value | Disclosure Mode |
|---|---|---|---|
| `ANON-APP-02`（public `hear-and-save`） | ブラウザ録音 + ブックマークの PWA。CI と Pages デプロイまで構成 | More Projects 下位 | `Public` |
| `ANON-AUTOMATION-02` | 公式 LINE の構築運用管理（棚卸し・シナリオ・タグ・来店導線）。実装コードは無く設計と運用のみ | Supporting | `Anonymous` |
| `MINPAKU` | 物件データから収益予測 PDF を生成し通知する営業支援ツール | Supporting | `Public`（§7 参照） |
| `ANON-TOOL-02` / `ANON-TOOL-03` | 記録 Web アプリ（DB に Google Spreadsheet を採用）/ シフト台帳の GAS 実装 | Supporting | 確認要 |
| `ANON-WEB-02` | 生成 AI 開発環境による UI・LP 試作 5 件。本人の実装痕跡が薄い | Experiment | `Private Only` |
| `ANON-TOOL-04` | 学習記録（ナレッジ vault / Python notebook / Java 学習 workspace / 学習ハブ） | Low Priority | `Private Only` |
| （空 repository） | ファイルが 1 件も無い repository 12 件 | Low Priority | — |

---

## 7. Work Grouping

**80 repository → 28 Portfolio Work** への集約。
private repository は匿名 ID で管理し、**対応表はこの public repository に置かない。**
**統合の根拠は、repository 構造を逆算できない粒度で記述する。**

### 複数 repository を 1 Work にまとめたもの

| Work | repository 数 | 統合の根拠 |
|---|---|---|
| `ANON-AI-04` + `ANON-AI-01` | 7 | 同一プロダクトの系列。第 1 世代のテナント別配信と第 2 世代の再実装からなり、機能構成が一致する。うち 1 件だけが業種特化のドメインモデルを追加実装しているため、これを `ANON-AI-01` として**分離**した |
| `ANON-AI-02` | 2 | 個人側が先行実装、Organization 側がそれを monorepo 化した後継。サービス構成が対応する |
| `ANON-WEBAPP-01` | 2 | 管理画面 / API 側と、エッジ実行の連携層。一方の README が他方を連携先として明記 |
| `ANON-PLATFORM-03` | 8 | 同一ポイント基盤の本体 1 + 配信 / 旧版 / 空 repository 7 |
| `ANON-APP-01` | 4 | 同一配車アプリの複製 2 件と、乗客向け / ドライバー向けの 2 アプリ |
| `ANON-AI-05` | 4 | 「AI 面接」という同一課題に対する独立実装 4 件。共通コードが無いため**同一 Work の別実装**として扱う |
| `ANON-PM-01` | 2 | 同一 Product 名で、同じ管理対象を指す 2 系統。Sheets 実装と Git 事実起点エージェントの 2 面 |
| `ANON-WEB-01` | 6 | 同一クライアント系列のサイト作り替え 4 件 + 独立 2 件 |
| `ANON-TOOL-04` | 5 | 学習記録・学習ハブ・notebook・IDE workspace |

### 1 repository を複数 Work に分離したもの

| 元 | 分離後 | 根拠 |
|---|---|---|
| `ANON-AI-04` | SaaS 基盤 / `ANON-AI-01` | 業種特化ドメインモデルの有無で分離 |
| `ANON-PLATFORM-02` | 業務運用 Platform 本体 / 面接処理 | 面接処理は独立した実行環境と専用データを持つが、**配信は本体と一体**のため本体に含め、`ANON-AI-05` 側へ注記のみ |

### 同一 Work の可能性はあるが、確定できなかったもの

- **`ANON-AI-05` の 4 実装**が、同一案件の作り直しか別々の発注かは確定できない（Q14）
- **`ANON-WEB-01` の 6 件**のうち 2 件は、他 4 件と同一クライアント系列かが確定できない
- **`ANON-AI-04` のテナント別配信**は、発注元が別法人である可能性がある（Q15）

### 本 repository 内の公開デモと実 Work の対応

| 公開デモ | 対応する実 Work | 関係 |
|---|---|---|
| `ai-crm-demo` | `ANON-AI-03` | 実務向け CRM の公開可能な断面 |
| `gas-project-management-demo` | `ANON-PM-01` | 進捗管理部分の公開断面 |
| `document-field-extraction-demo` | `ANON-PLATFORM-01` | 抽出 → 確信度 → レビューゲート部分の公開断面 |

**現行 Featured 3 件は、いずれも独立した Work ではなく、上位 Work の公開断面である。**

---

## 8. Correction Log

**採用案件の分類を訂正した。** 第 2 版の分類は最終実装を正しく表していなかった。

| | 内容 |
|---|---|
| **Before（第 2 版）** | `ANON-AUTOMATION-01`「採用ワークフロー自動化」/ Type: Business Automation / Workflow。**GAS と外部サービス接着が主題**として記述していた |
| **After（第 3 版）** | `ANON-WEBAPP-01`「採用管理 Web Application」/ Type: Business Web Application / Recruitment Management。**React + TypeScript の管理画面と、エッジ実行 + データベースによる API が主題**。GAS は初期・連携系の構成要素 |

**なぜ誤ったか**: default branch には初期版しか無く、
**最終実装は別 branch にあった**。第 2 版は default branch だけを見て分類していた。

**確認したこと（Evidence checked）**:

- branch 一覧を取得し、最終実装を含む branch を特定した
- 管理画面側に、応募者一覧 / 検索 / 詳細表示 / 選考ステータス管理 / **合否判定** /
  面接予約・変更・キャンセル / 担当者管理 / 統計ダッシュボード / システムログ の各画面が存在
- API 側が **Cloudflare Pages Functions** として実装され、
  主データが **Cloudflare D1** に置かれていること
- **表計算からデータベースへの移行処理**が存在すること
- **Google Calendar 連携**（認証・予定同期・担当者ごとのカレンダー割当）が存在すること
- 通知（SMS・画面内通知）が実装されていること
- 個人情報の**保持期限管理と匿名化**が定期実行として実装されていること
- 旧世代の静的実装が別ディレクトリに残され、**作り替えの履歴が追えること**
- **最終実装 branch の直接コミット 210 件すべてが本人名義**であること

**Portfolio 上の影響**:

- Type を Business Automation から **Business Web Application** へ変更
- Strong Featured 内の順位が **6 位 → 2 位** へ上昇
- Role の確度が上がった（担当範囲について repository から言えることが増えた）
- 「GAS / Automation 枠」ではなく **「実務向け業務 Web Application 枠」**として lineup に配置

---

## 9. 調査中に見つかった、掲載判断とは別に対応が必要な事項

1. **公開 repository に `.env` が追跡ファイルとして存在するものが 4 件ある。**
   **内容は取得しておらず、本 PR でも何も変更していない。**
   本書は public であるため repository 名は列挙しない。対応可否は別途判断が必要。
2. **private repository にも認証情報を含むファイルが追跡されているものが複数ある。**
   private のため露出はしていないが、**public 化する場合は履歴からの除去が必要**。
   これは `Disclosure Mode` を `Public` へ上げる際の前提条件になる。
3. **公開 repository の名称そのものに発注元名 / ブランド名が含まれるものが複数ある。**
   匿名掲載を選んでも repository 名から辿れてしまうため、掲載方針と整合させる必要がある。

---

## 10. Human Questions

**本人しか答えられない事項。** Portfolio Value の評価はすでに完了しており、
以下は **Disclosure Mode の確定**と**担当範囲の確定**のためだけに必要なもの。

### 業種・固有名の公開可否

- **Q1** `ANON-AI-01` の**業種名を出してよいか。**（業種は本書に記載していない）
  業種を明示した題名にするか、「相談業務オペレーター向け AI Chat」に留めるか。
- **Q2** `ANON-AI-01` の**業種固有の機能名**を出してよいか。
  業種を伏せてもこの機能名を書くと業種が推測できるため、本書では一般語に置き換えてある。
- **Q3** `ANON-PLATFORM-01` の**業種名を出してよいか。**（業種は本書に記載していない）
- **Q4** `ANON-PLATFORM-01` の**プロダクト名**を出してよいか。
- **Q11** `ANON-WEBAPP-01` の**発注元名**を出してよいか。
  **すでに公開 repository の名称と README に含まれている。**
  出さない方針を採る場合、repository 側の扱いも決める必要がある。
- **Q15** `ANON-AI-04` のテナント別配信は、**同一発注元か別法人か。**

### 担当範囲（repository から確定できなかったもの）

- **Q5** `ANON-AI-01` および `ANON-AI-04` 第 2 世代について、
  **生成 AI 開発環境経由のコミットは本人の作業か。**
  本人名義の直接コミットは多数確認できたが、残りの帰属が確定できない。
  Portfolio に「担当: フルスタック / AI 実装」と書けるかはこの回答で決まる。
- **Q6** `ANON-AI-02` について、**要件定義・プロダクト判断まで担当したか、実装のみか。**
- **Q7** `ANON-PLATFORM-02` の**権限設計は本人が起草したか、受領したか。**
  Featured の訴求点が「権限設計ができる」か「権限設計に沿って実装できる」かが変わる。
- **Q14** `ANON-AI-05` の 4 実装は**同一案件の作り直しか、別々の発注か。**
  また各実装の担当範囲。
- **Q16** `ANON-AI-06` の担当範囲。実装痕跡が少なく判定できない。
- **Q17** `ANON-PLATFORM-03` の 4 サービスのうち、**どれを担当したか。**

### 掲載形式

- **Q8** `ANON-AI-03` を「公開デモ」として見せるか、
  「実務向け CRM + 公開可能な断面」として見せるか。
- **Q9** **実画面を使えるか。** Strong Featured 5 件のうち 4 件は
  repository に製品スクリーンショットが存在しない。次のどれを採るか。
  (a) 実画面を sanitize して使う / (b) abstract UI mock を作る /
  (c) architecture-style visual のみ / (d) reconstructed demo を新規実装する
- **Q10** `ANON-AI-02` の**アバター素材**を Portfolio で使えるか（第三者の肖像・音声の可能性）。
- **Q12** `ANON-WEBAPP-01` を**匿名 Case Study として掲載するか。**
- **Q13** `ANON-PLATFORM-01` の掲載を、**既存方針のまま見送るか、条件付きで再検討するか。**

---

## 11. この調査で変更していないもの

変更はこの調査文書 **1 ファイルのみ**。

未変更を確認済み: `portfolio-site/src/**` / CSS / Astro components / `site.json` / 作品 JSON /
`public/` / `dist/` / `.github/workflows/**` / deploy 設定 / staging / production / `main`。

private repository のソースコード・secrets・顧客データ・private URL・内部仕様本文・
内部ファイル名・顧客名・会社名・サービス名・業種名・Organization 名は、
**本書へ一切記載していない。**
