# Project Progress Manager

Google Apps Script と Google Sheets で構築した、プロジェクト進捗管理の
**ポートフォリオ用デモ**です。

スプレッドシートそのものを正本（source of truth）とし、
Sidebar からの一括登録・依存関係・判断待ち管理・ダッシュボード集計までを
サーバーレスで完結させています。
「表計算ソフトの手軽さを保ったまま、業務データを壊さない」ことを主眼に置いた実装です。

---

## 主な機能

| 機能 | 内容 |
|---|---|
| Project 管理 | 目的・期限・優先順位・健全度（Green/Amber/Red）を持つ案件単位の管理 |
| Work Item / Task 管理 | Epic / Feature / Task / Subtask / Bug / Improvement の6種別。親子構造あり |
| Decision / Blocker 管理 | 「判断待ち」「ブロッカー」「質問」を明示的なレコードとして管理 |
| Relation / Dependency 管理 | `depends_on` / `blocks` の依存関係。循環は登録時に拒否 |
| Sidebar 一括登録 | Project + Item + 依存 + 判断待ちを 1 回の送信でまとめて登録 |
| Dashboard 集計 | 進行中件数、健全度内訳、判断待ち、期限超過などの KPI を再構築 |
| Activity 履歴 | 誰が・いつ・どの項目を・何から何に変えたかを追記のみで記録 |
| onEdit 更新 | 許可リスト列の単一セル編集だけを「正式な更新」として扱う |
| ID 採番 | Project / Item / Decision / Relation / Activity の採番。ID は再利用しない |

---

## 設計面の見どころ

- **Sheets as Source of Truth** — 外部DBを持たず、シートの1行がそのまま正本
- **Header-based column resolution** — 列番号を埋め込まず見出し名で解決。列追加で壊れない
- **LockService** — 200ms fail-fast で同時実行を直列化。待たせずにエラーを返す
- **Idempotency** — `submissionId` + payload ハッシュで再送・二重送信を無害化
- **Rollback** — 途中失敗時に書き込んだ行を逆順に削除し、中途半端な状態を残さない
- **DFS cycle detection** — 親子関係・依存関係の循環を、書き込み前に検出して拒否
- **Formula Injection prevention** — 先頭 `=` の文字列をエスケープしてから書き込む
- **Safe Error masking** — 例外原文をUIに出さず、コード化した上でトークン・鍵・メールをマスク
- **Sheet column protection** — 構造列・自動列を Range Protection で編集不可にする

Activity ログの書き込みもトランザクションに含めており、
**「正本は変わったのに履歴が残っていない」状態を作らない**ようにしています。

詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

---

## Technology

- Google Apps Script（V8 ランタイム）
- JavaScript
- Google Sheets
- HTML Service（Sidebar UI）
- LockService

---

## Tests

```bash
npm test      # 77 passed / 0 failed
npm run check # node --check による構文チェック
```

**77 passed / 0 failed**。

テストは Apps Script ランタイムを必要としません。
Spreadsheet / Range / LockService / Ui の Fake を Node の `vm` サンドボックスに載せ、
`src/*.js` をそのまま読み込んで実行します。
ネットワークアクセスも、実スプレッドシートへの書き込みも一切発生しません。

カバーしている領域：ID 衝突、循環検出、ロールバック、冪等性、ロック競合、
Formula Injection、セットアップ冪等性、Activity、Dashboard 集計、Safe Error、
手打ちIDの幽霊行の隔離、直接編集の許可リスト契約、複数セル貼り付けの境界処理、
デモデータの基準日固定と再投入時の replay。

---

## セットアップ

1. Google スプレッドシートを新規作成し、拡張機能 → Apps Script を開く
2. `src/` 配下のファイルと `appsscript.json` を配置する
   （clasp を使う場合は `.clasp.example.json` を `.clasp.json` にコピーし、自分の Script ID を記入）
3. スプレッドシートを再読み込みし、メニュー **進捗管理** から
   - `初期セットアップ` … 12 枚のシートと見出し・入力規則・保護を作成
   - `デモデータを投入` … 架空のサンプルデータを投入（任意）
   - `プロジェクト・タスクを登録` … Sidebar を開く
   - `ダッシュボードを更新` … 集計を再構築

`.clasp.json` は `.gitignore` 済みです。実 Script ID をコミットしないでください。

---

## デモデータについて

`デモデータを投入` が行うこと・行わないことは次のとおりです。

**行うこと**

- 架空の Project 3 件 / Work Item 14 件 / Relation 10 件 / Decision 5 件を**追記**する
- 書き込みは Sidebar と同じ `V3RegistrationService.register` を通す。
  デモ専用の書き込み経路は持たない（検証 → ロック → 冪等性 → トランザクション → Activity）
- 初回投入時に基準日を1つ決め、`90_設定` の `DEMO_ANCHOR_DATE` に保存する
- 投入後に Dashboard を1回再構築する

**行わないこと**

- 既存の行の削除・上書き・クリアは行わない（追記のみ）
- シートの作成・削除は行わない（初期セットアップ未実施なら `setup_required` を返して何もしない）
- 外部アクセス、Script Properties への書き込み、トリガー作成は行わない

**再実行したとき**

デモデータの日付は「固定のカレンダー」ではなく、`DEMO_ANCHOR_DATE` からの相対日数で組み立てます。
基準日はスプレッドシートごとに初回投入時の1回だけ確定し、以後は保存値を読み直すため、
翌日でも数年後でも payload とそのハッシュは同一になります。
したがって再実行は **冪等な replay** になり、行は増えず、`payload_mismatch` にもなりません。

新しいスプレッドシートに投入した場合は、その投入日を基準に日付が組み直されるので、
いつ試しても Red（遅延＋ブロッカー）/ Amber（判断待ち）/ Green（問題なし）が1件ずつ揃います。

なお、投入直後の Dashboard がこの3色構成になります。
そのまま日数が経過したスプレッドシートを再集計すれば、
期限超過や更新停滞の判定が進んで色は変わります（それが本来の挙動です）。

---

## このリポジトリについて（重要）

- **Portfolio Demo** です。実運用中のスプレッドシートとは接続されていません
- **Synthetic data only** — 投入されるデータはすべて架空。実在の企業・案件・個人は含みません
- **No production spreadsheet** — 実データを含むスプレッドシートは同梱していません
- **No Script ID** — 実 Script ID は含まれていません（`.clasp.example.json` はプレースホルダのみ）
- **No API token** — API トークン・認証情報の類は一切含まれていません
- **No GitHub integration in this demo** — 外部イシュートラッカー連携のコードは含みません。
  HTTP 呼び出し（`UrlFetchApp`）を 1 行も持たないことをテストで担保しています
- **Board / Roadmap / AI Proposal are stubs** — `03_ボード` / `04_ロードマップ` / `06_AI提案`
  は案内行のみのスタブで、未実装です
- LLM 連携、スケジュール実行トリガー、依存関係の後追い編集も未実装です

---

## License

MIT
