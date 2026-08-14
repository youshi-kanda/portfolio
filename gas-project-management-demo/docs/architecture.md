# Architecture

Project Progress Manager は Google Sheets を正本（source of truth）として扱い、
Google Apps Script をその上の薄いアプリケーション層として動かす構成です。
外部DBもサーバーも持たず、シートそのものがデータストアになります。

---

## 1. 登録フロー

Sidebar から 1 回送信すると、Project / Work Item / Decision / Relation が
**ひとつのトランザクションとして**書き込まれます。

```
Sidebar (HTML Service)
  ↓  payload = { submissionId, project, items[], relations[], decisions[] }
Validation            列挙値・日付・文字数・親子循環・依存循環・別Project参照
  ↓                   （1件でもNGなら、ここで停止。書き込みゼロ）
LockService           getScriptLock().tryLock(200ms) — 失敗は concurrent_sync
  ↓
Idempotency Check     92_登録履歴 を submissionId で検索
  ↓                   同一payload → 前回結果をそのまま返す（再送安全）
  ↓                   別payload   → payload_mismatch で拒否
ID採番                93_採番カウンタ を read-modify-write（採番のみ、再利用なし）
  ↓
Project / Item / Decision / Relation 行を追記
  ↓                   ここで失敗したら書いた行を逆順に削除（rollback）
Activity Log          07_活動履歴 へ追記。※Activity書き込みもトランザクションの一部
  ↓                   Activity が失敗したら正本側もロールバックする
Commit                92_登録履歴 の state を committed にして結果を返す
```

設計上の要点は「**正本が変わったのに履歴が残らない状態を作らない**」ことです。
Activity の書き込み失敗は成功として扱わず、登録全体をロールバックします。

Dashboard の再構築は、このトランザクションには含まれません。
`00_共有ダッシュボード` は正本から導出される表示用シートなので、
メニューの `ダッシュボードを更新`（および デモデータ投入の最後）から
`V3SyncController.rebuildDashboard` を別途呼び出して再構築します。
再構築は Project 行の領域を一度クリアしてから書き直す全面更新です。

---

## 2. シート構成（表示 8 / 管理 4 / 合計 12）

| シート | 区分 | 役割 |
|---|---|---|
| `00_共有ダッシュボード` | 表示 | KPI と Project 一覧。再構築で全面更新 |
| `01_プロジェクト` | 表示 | Project の正本 |
| `02_タスク` | 表示 | Work Item（Epic/Feature/Task/Subtask/Bug/Improvement）の正本 |
| `03_ボード` | 表示 | **スタブ（未実装）**。案内行のみを持つ空シート |
| `04_ロードマップ` | 表示 | **スタブ（未実装）**。案内行のみを持つ空シート |
| `05_判断待ち・ブロッカー` | 表示 | Decision の正本 |
| `06_AI提案` | 表示 | **スタブ（未実装）**。案内行のみを持つ空シート |
| `07_活動履歴` | 表示 | Activity ログ（追記のみ） |
| `90_設定` | 管理 | しきい値・デモ基準日などの key/value。既定値は上書きしない |
| `91_関係` | 管理 | Relation（depends_on / blocks）の正本 |
| `92_登録履歴` | 管理 | submissionId と payloadHash。冪等性の判定に使う |
| `93_採番カウンタ` | 管理 | ID採番カウンタ |

管理シートは setup 時に非表示化されます。

---

## 3. 列は「位置」ではなく「見出し名」で解決する

すべての読み書きが `V3Schema.resolveColumnIndex(sheet, headerName)` を通ります。
列番号をコードに埋め込まないため、後から列を追加しても既存の参照が壊れません。
1行目の見出しがスキーマ定義そのものです。

構造列・自動列（ID, createdAt, updatedAt, revision など）は
Range Protection で保護し、日常的に触る列（status, priority, assignee,
dueDate など）だけを直接編集の許可リストに入れています。

---

## 4. onEdit の扱い

`onEdit` は「正式な更新」と見なす条件を厳しく絞っています。

- その行が**正式な行**であること（ID と createdAt が両方入っている）
- **単一セル編集**であること（複数セル貼り付けは対象外）
- 編集された列が、そのシートの許可リストに含まれること

3つを満たしたときだけ `updatedAt` を更新し、Activity を1行追記します。
満たさない編集に対しては、値の復元も消去も行いません
（構造列は Protection 側で先に止まるため）。
手打ちしたIDだけの行は「正式な行」にならないので、
Dashboard の集計にも依存関係の参照先にも入りません。

---

## 5. 事故防止の作り込み

| 仕組み | 目的 |
|---|---|
| LockService（200ms fail-fast） | 同時実行の直列化。待たせずに `concurrent_sync` を返す |
| submissionId + payloadHash | 二重送信・再送を無害化（同一payloadなら前回結果を返す） |
| 逆順 deleteRow による rollback | 途中失敗で中途半端な行を残さない |
| DFS による循環検出 | 親子・依存の循環を書き込み前に拒否 |
| 先頭 `=` のエスケープ | Formula Injection 対策 |
| Safe Error | 例外原文をUIに出さず、コード化＋トークン/鍵/メールをマスク |
| 正式行の判定（ID + createdAt） | 手打ちIDの幽霊行を集計・参照から除外 |
| Range Protection | 構造列・自動列を通常利用者が編集できないようにする |

---

## 6. デモデータの基準日

`デモデータを投入` は専用の書き込み経路を持たず、Sidebar と同じ
`V3RegistrationService.register` に架空の payload を渡すだけです。

日付は固定のカレンダーではなく、基準日 `DEMO_ANCHOR_DATE`（`90_設定`）からの
相対日数で組み立てます。基準日はスプレッドシートごとに初回投入時の1回だけ確定し、
以後は保存値を読み直します。

- 固定カレンダーだと、その年を過ぎた時点で全件が「期限超過」になり、
  Green / Amber / Red の対比が消えてしまう
- 基準日を保存しておくことで、翌日でも数年後でも payload とハッシュが一致し、
  再投入は冪等な replay になる（`payload_mismatch` を起こさない）

---

## 7. このデモに含まれないもの

- `03_ボード` / `04_ロードマップ` / `06_AI提案` はスタブ（案内行のみ）
- 外部イシュートラッカー連携なし（HTTP呼び出しコードを1行も持たない）
- LLM 連携なし
- スケジュール実行トリガーなし
- 依存関係の後追い追加・削除、ライフサイクル操作は未実装

---

## 8. テスト

`npm test` は Apps Script ランタイム無しで動きます。
Spreadsheet / Range / LockService / Ui の Fake を `vm` サンドボックスに載せ、
`src/*.js` をそのまま読み込んで実行します。
ネットワークアクセスも、実スプレッドシートへの書き込みも発生しません。
