# AIコンサルCRM CSV取込・出力仕様書 v0.1

## 1. 本書の目的

本書は、AIコンサルCRMにおけるCSV取込・CSV出力の仕様を定義するものである。

AIコンサルCRMは、公式LINEを主要な顧客接点として活用する個人店・小規模店舗向けに、顧客データ・予約/来店データ・売上データ・施策結果データを整理し、集客・再来店・顧客フォロー・売上改善の次アクションをAIが提案する相談型マーケティングCRMである。

初期MVPでは、外部API連携を必須とせず、CSV取込・手入力・Googleスプレッドシート連携候補を中心に設計する。

本書では、以下を明確にする。

- MVPで取り込むCSVの種類
- CSVごとの必須項目・任意項目
- 項目マッピングの考え方
- 文字コード・日付・金額・IDの扱い
- 取込時のデータ品質チェック
- 重複・名寄せ・表記ゆれの扱い
- 同意情報・配信停止情報の扱い
- 施策対象者CSV・タグ候補CSV・結果入力CSVの出力仕様
- 監査ログ・エラー管理の仕様

---

## 2. CSV設計の基本方針

### 2.1 基本思想

CSV取込は、初期MVPにおける最重要機能の一つである。

理由は、AIコンサルCRMの価値が以下の流れに依存するためである。

```text
顧客・予約・売上データを取り込む
↓
顧客状態・ニーズ・課題を整理する
↓
AIが施策を提案する
↓
対象者と文案を生成する
↓
公式LINE/SNS/Google/個別対応で実行する
↓
結果を戻す
↓
改善提案に反映する
```

### 2.2 初期方針

| 方針 | 内容 |
|---|---|
| 外部API非依存 | 初期は予約システム・LINE・POSのAPI連携を必須にしない |
| CSV優先 | 顧客、予約、来店、売上、施策結果はCSVで取り込めるようにする |
| 手入力併用 | 少量データや不足項目は画面から手入力できるようにする |
| 項目マッピング対応 | 予約システムごとにCSV項目名が違う前提で設計する |
| エラーを見える化 | 取込失敗理由を店舗担当者でも分かるように表示する |
| 完全自動化しない | 重複統合・同意判定・顧客削除は人間確認を前提にする |
| AI利用前提 | AI分析に必要な項目を優先的に取り込めるようにする |

### 2.3 初期対象業種

MVPでは、エステ・美容サロンを最優先とする。

ただし、将来的に整体・接骨院・鍼灸院、パーソナルジムへ拡張できるよう、CSV仕様は業種共通の基本構造にする。

---

## 3. CSV取込対象一覧

### 3.1 MVP必須CSV

| CSV種別 | ファイル種別ID | 目的 | MVP優先度 |
|---|---|---|---|
| 顧客CSV | customers | 顧客基本情報・連絡可否・流入経路を取り込む | 必須 |
| 予約/来店CSV | reservations | 予約日・来店日・キャンセル・次回予約を取り込む | 必須 |
| 売上CSV | sales | 顧客別・メニュー別の売上を取り込む | 必須 |
| メニューCSV | menus | 店舗メニュー・価格・所要時間を取り込む | 高 |
| 施策結果CSV | campaign_results | LINE/SNS/個別対応の結果を戻す | 高 |

### 3.2 MVP任意CSV

| CSV種別 | ファイル種別ID | 目的 | MVP優先度 |
|---|---|---|---|
| 顧客メモCSV | customer_notes | 接客メモ・カウンセリング情報を取り込む | 中 |
| 回数券/契約CSV | contracts | 回数券残数・契約状況を取り込む | 中 |
| 配信履歴CSV | communications | 過去LINE配信・SNS投稿履歴を取り込む | 中 |
| 同意/配信停止CSV | consents | 連絡同意・配信停止状態を取り込む | 中 |
| 外部タグCSV | external_tags | Lステップ等の既存タグを取り込む | 低 |

### 3.3 出力CSV

| CSV種別 | ファイル種別ID | 目的 | MVP優先度 |
|---|---|---|---|
| 配信対象者CSV | campaign_targets | 公式LINE/Lステップで配信対象確認に使う | 必須 |
| 除外者CSV | excluded_targets | 配信停止・同意未取得・注意顧客を確認する | 必須 |
| 外部タグ候補CSV | external_tag_candidates | Lステップ等でタグ付与する際の参考にする | 高 |
| 施策結果入力CSV | campaign_result_template | 配信後の結果入力用テンプレート | 高 |
| 月次レポートCSV | monthly_report | 代理店・店舗向け報告に使う | 中 |

---

## 4. 共通CSV仕様

### 4.1 ファイル形式

| 項目 | 仕様 |
|---|---|
| ファイル形式 | CSV |
| 区切り文字 | カンマ |
| 改行コード | CRLF / LF 両対応 |
| 文字コード | UTF-8 BOM付き推奨、Shift_JISも取込対応候補 |
| ヘッダー行 | 必須 |
| 最大ファイルサイズ | MVPでは10MB程度を上限候補 |
| 最大行数 | MVPでは5万行程度を上限候補 |
| 空行 | 無視 |
| ダブルクォート | 対応 |
| カンマを含む値 | ダブルクォートで囲む |

### 4.2 文字コード方針

日本の小規模店舗では、ExcelからShift_JISのCSVを出力するケースが多い。

そのため、初期は以下に対応する。

| 文字コード | 方針 |
|---|---|
| UTF-8 BOM付き | 推奨 |
| UTF-8 BOMなし | 対応 |
| Shift_JIS / CP932 | 対応候補。文字化け防止のため重要 |

### 4.3 日付形式

以下の形式を受け付ける。

| 形式 | 例 |
|---|---|
| YYYY-MM-DD | 2026-05-10 |
| YYYY/MM/DD | 2026/05/10 |
| YYYY年M月D日 | 2026年5月10日 |
| MM/DD/YYYY | 原則非推奨。必要時のみ対応 |

時刻を含む場合は以下を許容する。

| 形式 | 例 |
|---|---|
| YYYY-MM-DD HH:mm | 2026-05-10 14:30 |
| YYYY/MM/DD HH:mm | 2026/05/10 14:30 |

### 4.4 金額形式

| 入力例 | 取込結果 |
|---|---|
| 12000 | 12000 |
| 12,000 | 12000 |
| ¥12,000 | 12000 |
| 12000円 | 12000 |

金額は整数円として保存する。

### 4.5 真偽値形式

| 入力値 | true扱い |
|---|---|
| true | ○ |
| TRUE | ○ |
| 1 | ○ |
| はい | ○ |
| あり | ○ |
| 可 | ○ |
| 同意あり | ○ |

| 入力値 | false扱い |
|---|---|
| false | ○ |
| FALSE | ○ |
| 0 | ○ |
| いいえ | ○ |
| なし | ○ |
| 不可 | ○ |
| 同意なし | ○ |

### 4.6 外部ID方針

外部予約システムやPOSから出力されるIDは、以下のように保存する。

| 項目 | 内容 |
|---|---|
| external_customer_id | 予約システム等の顧客ID |
| external_reservation_id | 予約システム等の予約ID |
| external_sale_id | POS等の売上ID |
| source_system | 取込元システム名 |
| source_file_id | 取込元ファイルID |

---

## 5. 顧客CSV仕様

### 5.1 目的

顧客の基本情報、流入経路、連絡可否、同意状態を取り込む。

顧客CSVは、顧客管理・顧客インサイト・セグメント提案の基礎データになる。

### 5.2 取込先テーブル候補

- customers
- customer_profiles
- customer_consents

### 5.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_customer_id | 外部顧客ID | 推奨 | string | 予約システム等の顧客ID |
| display_name | 表示名 | 任意 | string | LINE名、ニックネーム等 |
| full_name | 氏名 | 任意 | string | 顧客氏名 |
| kana | 氏名カナ | 任意 | string | 顧客氏名カナ |
| phone | 電話番号 | 任意 | string | ハイフンあり/なし両対応 |
| email | メールアドレス | 任意 | string | メール連絡用 |
| line_user_id | LINE userId | 将来 | string | LINE連携時のID |
| gender | 性別 | 任意 | enum | female / male / other / unknown |
| birth_date | 生年月日 | 任意 | date | 年代推定に利用 |
| age_group | 年代 | 任意 | string | 20代、30代など |
| acquisition_channel | 流入経路 | 任意 | string | Instagram、紹介、Google等 |
| first_contact_date | 初回接点日 | 任意 | date | 問い合わせ・友だち追加日等 |
| first_visit_date | 初回来店日 | 任意 | date | 初回来店済みの場合 |
| last_visit_date | 最終来店日 | 任意 | date | 顧客状態判定に利用 |
| visit_count | 来店回数 | 任意 | integer | 予約履歴がない場合の補助 |
| total_sales | 累計売上 | 任意 | integer | 売上CSVがない場合の補助 |
| contact_line_allowed | LINE連絡可否 | 任意 | boolean | 同意管理に反映 |
| contact_email_allowed | メール連絡可否 | 任意 | boolean | 同意管理に反映 |
| contact_sms_allowed | SMS連絡可否 | 任意 | boolean | 同意管理に反映 |
| analysis_allowed | 分析利用可否 | 任意 | boolean | AI分析利用可否 |
| is_unsubscribed | 配信停止 | 任意 | boolean | 配信対象除外に利用 |
| consent_source | 同意取得元 | 任意 | string | LINE、予約フォーム、紙など |
| note | 備考 | 任意 | text | 軽微なメモ |

### 5.4 最低限必要な識別情報

顧客CSVでは、以下のいずれかが必要である。

| 優先 | 識別子 |
|---|---|
| 1 | external_customer_id |
| 2 | phone |
| 3 | email |
| 4 | line_user_id |
| 5 | full_name + birth_date |
| 6 | full_name + phone末尾 |

上記がすべてない場合は、仮顧客として登録するか、取込エラーにする。

### 5.5 顧客CSVサンプル

```csv
external_customer_id,full_name,kana,phone,email,acquisition_channel,first_visit_date,last_visit_date,visit_count,total_sales,contact_line_allowed,is_unsubscribed
C001,山田花子,ヤマダハナコ,090-1234-5678,hanako@example.com,Instagram,2026-02-10,2026-05-01,4,58000,はい,いいえ
C002,佐藤美咲,サトウミサキ,080-1111-2222,,紹介,2026-04-12,2026-04-12,1,9800,はい,いいえ
```

---

## 6. 予約/来店CSV仕様

### 6.1 目的

顧客ごとの予約、来店、キャンセル、次回予約の情報を取り込む。

このデータは、初回来店後フォロー、休眠判定、来店周期、キャンセル傾向、次回予約有無の判定に利用する。

### 6.2 取込先テーブル候補

- reservations

### 6.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_reservation_id | 外部予約ID | 推奨 | string | 予約システム上の予約ID |
| external_customer_id | 外部顧客ID | 推奨 | string | 顧客CSVとの紐付け |
| customer_name | 顧客名 | 任意 | string | 外部IDがない場合の補助 |
| phone | 電話番号 | 任意 | string | 顧客照合用 |
| reservation_date | 予約日時 | 必須 | datetime | 予約日時 |
| visit_date | 来店日時 | 任意 | datetime | 実来店日時 |
| status | 予約状態 | 必須 | enum | reserved / visited / cancelled / no_show |
| menu_name | メニュー名 | 任意 | string | メニュー照合用 |
| staff_name | 担当者名 | 任意 | string | 担当別分析用 |
| cancelled_at | キャンセル日時 | 任意 | datetime | キャンセル時刻 |
| cancel_reason | キャンセル理由 | 任意 | string | 離脱要因分析用 |
| next_reservation_date | 次回予約日時 | 任意 | datetime | 次回予約有無判定用 |
| source_system | 取込元 | 任意 | string | 予約システム名 |

### 6.4 status変換ルール

| 入力値 | 保存値 |
|---|---|
| 予約済み | reserved |
| 来店済み | visited |
| 施術済み | visited |
| キャンセル | cancelled |
| 無断キャンセル | no_show |
| 未来予約 | reserved |

### 6.5 予約/来店CSVサンプル

```csv
external_reservation_id,external_customer_id,reservation_date,visit_date,status,menu_name,staff_name,next_reservation_date
R001,C001,2026-05-01 14:00,2026-05-01 14:00,来店済み,フェイシャル60分,田中,
R002,C002,2026-05-10 11:00,,予約済み,初回体験コース,田中,
```

---

## 7. 売上CSV仕様

### 7.1 目的

顧客別、メニュー別、日別の売上を取り込む。

このデータは、LTV、客単価、回数券購入、アップセル候補、月次レポート、施策効果測定に利用する。

### 7.2 取込先テーブル候補

- sales

### 7.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_sale_id | 外部売上ID | 推奨 | string | POS等の売上ID |
| external_customer_id | 外部顧客ID | 推奨 | string | 顧客との紐付け |
| customer_name | 顧客名 | 任意 | string | 顧客照合用 |
| phone | 電話番号 | 任意 | string | 顧客照合用 |
| sale_date | 売上日 | 必須 | date | 売上発生日 |
| menu_name | メニュー名 | 任意 | string | メニュー名 |
| category | カテゴリ | 任意 | string | 施術、物販、回数券など |
| quantity | 数量 | 任意 | integer | 初期値1 |
| amount | 売上金額 | 必須 | integer | 税込/税抜は店舗設定で管理 |
| payment_method | 支払方法 | 任意 | string | 現金、カード、QR等 |
| staff_name | 担当者名 | 任意 | string | 担当別分析用 |
| campaign_id | 施策ID | 任意 | string | 施策紐付けが分かる場合 |
| source_system | 取込元 | 任意 | string | POS、予約システム等 |

### 7.4 売上CSVサンプル

```csv
external_sale_id,external_customer_id,sale_date,menu_name,category,quantity,amount,payment_method,staff_name
S001,C001,2026-05-01,フェイシャル60分,施術,1,12000,カード,田中
S002,C001,2026-05-01,美容液,物販,1,8800,カード,田中
```

---

## 8. メニューCSV仕様

### 8.1 目的

店舗のメニュー、価格、所要時間、カテゴリを取り込む。

AI診断・施策提案・文案生成・売上分析の前提情報として利用する。

### 8.2 取込先テーブル候補

- menus

### 8.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| menu_code | メニューコード | 任意 | string | 外部システム上のメニューID |
| name | メニュー名 | 必須 | string | メニュー名 |
| category | カテゴリ | 任意 | string | フェイシャル、痩身、物販など |
| price | 価格 | 任意 | integer | 標準価格 |
| duration_minutes | 所要時間 | 任意 | integer | 分単位 |
| is_main | 主力メニュー | 任意 | boolean | 集客・収益の中心メニューか |
| is_high_value | 高単価メニュー | 任意 | boolean | アップセル候補か |
| description | 説明 | 任意 | text | メニュー説明 |
| status | 状態 | 任意 | enum | active / inactive |

### 8.4 メニューCSVサンプル

```csv
menu_code,name,category,price,duration_minutes,is_main,is_high_value,status
M001,フェイシャル60分,フェイシャル,12000,60,はい,いいえ,active
M002,集中肌質改善コース,フェイシャル,39800,90,いいえ,はい,active
```

---

## 9. 顧客メモCSV仕様

### 9.1 目的

接客メモ、カウンセリングメモ、顧客の悩み、注意点を取り込む。

AIの顧客インサイト精度向上に有用だが、個人情報・センシティブ情報を含む可能性があるため慎重に扱う。

### 9.2 取込先テーブル候補

- customer_notes
- customer_needs

### 9.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_customer_id | 外部顧客ID | 推奨 | string | 顧客照合用 |
| customer_name | 顧客名 | 任意 | string | 顧客照合用 |
| note_date | メモ日 | 必須 | date | 記録日 |
| note_type | メモ種別 | 任意 | enum | counseling / service / complaint / follow_up / other |
| note | メモ本文 | 必須 | text | 接客メモ |
| needs | ニーズ | 任意 | string | 肌悩み、価格不安など |
| staff_name | 記録者 | 任意 | string | 担当者名 |
| ai_analysis_allowed | AI分析可否 | 任意 | boolean | 個別メモをAI分析に使うか |

### 9.4 注意点

- 医療・健康に関する詳細情報は必要最小限にする
- クレーム内容は要約・マスキングを推奨する
- AI分析対象にする場合は分析利用同意を確認する
- 代理店ユーザーには権限に応じて非表示または要約表示にする

---

## 10. 回数券/契約CSV仕様

### 10.1 目的

エステ・美容サロンで重要な回数券、コース契約、残数、更新候補を取り込む。

回数券更新候補、アップセル候補、LTV分析に利用する。

### 10.2 取込先テーブル候補

初期DBでは sales または contracts テーブル候補。

MVPでは独立テーブルを作らず、売上補助情報として管理してもよい。

### 10.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_contract_id | 外部契約ID | 推奨 | string | 契約ID |
| external_customer_id | 外部顧客ID | 推奨 | string | 顧客照合用 |
| customer_name | 顧客名 | 任意 | string | 顧客照合用 |
| contract_name | 契約名 | 必須 | string | 回数券、コース名 |
| start_date | 開始日 | 任意 | date | 契約開始日 |
| end_date | 終了日 | 任意 | date | 契約終了日 |
| total_count | 総回数 | 任意 | integer | 契約回数 |
| remaining_count | 残回数 | 任意 | integer | 残数 |
| contract_amount | 契約金額 | 任意 | integer | 契約金額 |
| status | 状態 | 任意 | enum | active / expired / cancelled |
| last_used_date | 最終利用日 | 任意 | date | 最終消化日 |

### 10.4 更新候補判定への利用

| 条件 | 判定 |
|---|---|
| remaining_count <= 2 | 回数券更新候補 |
| end_date が30日以内 | 契約更新候補 |
| active かつ最終利用から一定期間超過 | 離脱リスク |

---

## 11. 施策結果CSV仕様

### 11.1 目的

公式LINE、Instagram、Google投稿、個別対応などの実施結果を取り込み、施策改善AIと月次レポートに反映する。

### 11.2 取込先テーブル候補

- campaign_results
- communications

### 11.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| campaign_id | 施策ID | 必須 | string | 本サービス内の施策ID |
| campaign_name | 施策名 | 任意 | string | 施策名 |
| channel | チャネル | 必須 | enum | line / instagram / google / email / sms / phone / in_store |
| executed_at | 実施日時 | 必須 | datetime | 配信・投稿・対応日時 |
| target_count | 対象者数 | 任意 | integer | 配信・対応対象人数 |
| delivered_count | 配信数 | 任意 | integer | 実際に届いた数 |
| opened_count | 開封数 | 任意 | integer | 取得可能な場合 |
| clicked_count | クリック数 | 任意 | integer | 取得可能な場合 |
| reply_count | 返信数 | 任意 | integer | LINE/個別対応等 |
| reservation_count | 予約数 | 任意 | integer | 施策後予約数 |
| visit_count | 来店数 | 任意 | integer | 施策後来店数 |
| sales_amount | 売上金額 | 任意 | integer | 施策起点売上 |
| memo | メモ | 任意 | text | 実施所感・補足 |

### 11.4 施策結果CSVサンプル

```csv
campaign_id,campaign_name,channel,executed_at,target_count,delivered_count,reply_count,reservation_count,visit_count,sales_amount,memo
CMP001,休眠復帰LINE,line,2026-05-15 10:00,30,28,6,4,3,36000,季節悩み訴求の反応が良かった
```

---

## 12. 同意/配信停止CSV仕様

### 12.1 目的

外部ツールや手元管理から、顧客の連絡同意・配信停止情報を取り込む。

配信対象抽出の安全性に関わるため、重要度が高い。

### 12.2 取込先テーブル候補

- customer_consents

### 12.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| external_customer_id | 外部顧客ID | 推奨 | string | 顧客照合用 |
| customer_name | 顧客名 | 任意 | string | 顧客照合用 |
| phone | 電話番号 | 任意 | string | 顧客照合用 |
| contact_line_allowed | LINE連絡可否 | 任意 | boolean | LINE連絡可能か |
| contact_email_allowed | メール連絡可否 | 任意 | boolean | メール連絡可能か |
| contact_sms_allowed | SMS連絡可否 | 任意 | boolean | SMS連絡可能か |
| analysis_allowed | 分析利用可否 | 任意 | boolean | AI分析利用可能か |
| external_integration_allowed | 外部連携可否 | 任意 | boolean | 外部連携可能か |
| is_unsubscribed | 配信停止 | 任意 | boolean | 配信停止状態 |
| unsubscribed_at | 配信停止日時 | 任意 | datetime | 停止日時 |
| consent_source | 同意取得元 | 任意 | string | 予約フォーム、LINE、紙など |
| consented_at | 同意取得日時 | 任意 | datetime | 同意日時 |

### 12.4 取込時の注意

- 配信停止は既存値より優先する
- is_unsubscribed = true の場合、配信対象から即時除外する
- 連絡同意が不明な場合は false ではなく unknown として扱う設計も検討する
- 同意更新履歴は監査ログに残す

---

## 13. 外部タグCSV仕様

### 13.1 目的

Lステップ、L Message、公式LINE運用で既に使われているタグを取り込み、タグ棚卸しや最小タグ設計に利用する。

### 13.2 取込先テーブル候補

- external_tags
- external_tag_members

### 13.3 標準カラム

| カラム名 | 表示名 | 必須 | 型 | 説明 |
|---|---|---:|---|---|
| tool_type | ツール種別 | 必須 | enum | official_line / lstep / lmessage |
| tag_name | タグ名 | 必須 | string | 外部ツール上のタグ名 |
| external_customer_id | 外部顧客ID | 任意 | string | 顧客照合用 |
| line_user_id | LINE userId | 任意 | string | 将来連携用 |
| customer_name | 顧客名 | 任意 | string | 顧客照合補助 |
| assigned_at | 付与日時 | 任意 | datetime | タグ付与日時 |
| memo | メモ | 任意 | text | 補足 |

### 13.4 タグ棚卸し観点

| 観点 | 内容 |
|---|---|
| 類似タグ | 休眠、休眠客、休眠復帰対象などの重複 |
| 使われていないタグ | 対象者0件、長期間未使用 |
| 意味が不明なタグ | 作成理由・条件が不明 |
| 永続タグと一時タグの混在 | 運用複雑化の原因 |
| 施策単位タグ | 期間・目的・削除タイミングを管理する |

---

## 14. 項目マッピング仕様

### 14.1 目的

予約システム、POS、Excel管理表ごとにCSV項目名が異なるため、取込時に本サービス標準項目へマッピングできるようにする。

### 14.2 マッピング方式

| 方式 | 内容 |
|---|---|
| 自動推定 | ヘッダー名から標準項目を推定する |
| 手動選択 | ユーザーがプルダウンで対応項目を選ぶ |
| テンプレート保存 | 取込元ごとのマッピング設定を保存する |
| 再利用 | 次回以降、同じ取込元では保存済み設定を使う |

### 14.3 自動推定例

| CSVヘッダー例 | 標準項目 |
|---|---|
| 顧客ID | external_customer_id |
| 会員番号 | external_customer_id |
| 名前 | full_name |
| 氏名 | full_name |
| 電話 | phone |
| 電話番号 | phone |
| メール | email |
| 来店日 | visit_date |
| 予約日 | reservation_date |
| 売上 | amount |
| 金額 | amount |
| メニュー | menu_name |
| コース名 | menu_name |
| 担当 | staff_name |
| スタッフ | staff_name |

### 14.4 マッピング保存項目

| 項目 | 内容 |
|---|---|
| mapping_id | マッピングID |
| store_id | 店舗ID |
| import_type | customers / reservations / sales など |
| source_system | 取込元システム名 |
| source_headers | 元CSVヘッダー |
| mapped_fields | 標準項目へのマッピング |
| created_by | 作成者 |
| created_at | 作成日時 |

---

## 15. データ品質チェック仕様

### 15.1 チェック一覧

| チェック | 内容 | エラーレベル |
|---|---|---|
| 必須項目チェック | 必須項目が空でないか | error |
| 日付形式チェック | 日付として解釈できるか | error |
| 金額形式チェック | 金額が数値化できるか | error |
| 真偽値チェック | 同意可否が解釈できるか | warning/error |
| 重複チェック | 既存顧客・CSV内重複がないか | warning |
| 表記ゆれチェック | メニュー名・流入経路・担当名の揺れ | warning |
| 未登録メニューチェック | 売上/予約のメニュー名がmenusにあるか | warning |
| 顧客照合失敗 | 売上・予約が顧客と紐付かない | warning/error |
| 配信停止上書き | 停止状態が含まれる場合の確認 | warning |

### 15.2 エラーレベル

| レベル | 内容 | 取込可否 |
|---|---|---|
| error | 必須項目欠損、日付不正など重大エラー | 原則取込不可 |
| warning | 重複候補、表記ゆれ、未登録メニューなど | 確認後取込可能 |
| info | 補足情報、推奨修正 | 取込可能 |

### 15.3 エラー表示項目

| 項目 | 内容 |
|---|---|
| 行番号 | CSV上の行番号 |
| カラム名 | エラー対象カラム |
| 入力値 | 実際の値 |
| エラー種別 | REQUIRED / INVALID_DATE / DUPLICATE など |
| メッセージ | ユーザー向け説明 |
| 修正候補 | 自動修正候補 |

### 15.4 エラー例

| 行 | カラム | 入力値 | エラー | メッセージ |
|---:|---|---|---|---|
| 12 | sale_date | 2026/13/01 | INVALID_DATE | 日付として読み取れません |
| 18 | amount | 十二万円 | INVALID_AMOUNT | 金額は数値で入力してください |
| 25 | full_name | 空欄 | MISSING_IDENTIFIER | 顧客を識別できる情報が不足しています |

---

## 16. 重複・名寄せ仕様

### 16.1 基本方針

顧客の重複統合は、AIやシステムが完全自動で確定しない。

初期は、重複候補を提示し、人間が確認して統合する。

### 16.2 照合優先順位

| 優先 | 条件 | 判定 |
|---|---|---|
| 1 | store_id + external_customer_id 一致 | 同一顧客候補 高 |
| 2 | phone 一致 | 同一顧客候補 高 |
| 3 | email 一致 | 同一顧客候補 高 |
| 4 | line_user_id 一致 | 同一顧客候補 高 |
| 5 | full_name + birth_date 一致 | 同一顧客候補 中 |
| 6 | full_name + phone末尾一致 | 同一顧客候補 中 |
| 7 | kana + age_group + acquisition_channel 近似 | 同一顧客候補 低 |

### 16.3 統合時の優先ルール

| 情報 | 優先 |
|---|---|
| 配信停止 | true を優先 |
| 連絡同意 | 明確な同意ありを優先。ただし根拠不明は確認 |
| 氏名 | 新しい更新日時の値を優先 |
| 電話番号 | 空でない値を優先 |
| メール | 空でない値を優先 |
| 来店履歴 | 全履歴を保持 |
| 売上履歴 | 全履歴を保持 |
| 接客メモ | 全履歴を保持。ただし重複メモは候補表示 |

---

## 17. 表記ゆれ正規化仕様

### 17.1 対象

| 対象 | 例 |
|---|---|
| メニュー名 | フェイシャル60分 / フェイシャル 60min / FACIAL60 |
| 流入経路 | Instagram / インスタ / IG |
| 担当者名 | 田中 / 田中さん / Tanaka |
| 支払方法 | クレカ / カード / credit |
| 予約状態 | 来店済み / 施術済み / 完了 |

### 17.2 正規化方法

| 方法 | 内容 |
|---|---|
| 完全一致 | 登録済みマスタと完全一致 |
| 類似一致 | 空白・大文字小文字・全角半角を吸収 |
| 手動紐付け | ユーザーが正しいマスタを選択 |
| 辞書登録 | 次回以降、自動変換する |

### 17.3 正規化辞書例

| 入力値 | 正規化後 |
|---|---|
| インスタ | Instagram |
| IG | Instagram |
| グーグル | Google |
| カード | クレジットカード |
| クレカ | クレジットカード |

---

## 18. インポート処理フロー

### 18.1 基本フロー

```text
CSVアップロード
↓
文字コード判定
↓
ヘッダー読み取り
↓
CSV種別判定
↓
項目マッピング
↓
プレビュー表示
↓
データ品質チェック
↓
エラー・警告表示
↓
ユーザー確認
↓
取込実行
↓
取込結果表示
↓
AI再分析キュー登録
```

### 18.2 プレビュー表示

取込前に以下を表示する。

| 表示 | 内容 |
|---|---|
| ファイル名 | アップロードファイル名 |
| 取込種別 | 顧客、予約、売上など |
| 行数 | 読み取った件数 |
| マッピング結果 | 元項目と標準項目の対応 |
| 取込予定件数 | 新規、更新、スキップ |
| エラー件数 | error件数 |
| 警告件数 | warning件数 |
| 影響範囲 | 更新される顧客数、施策数など |

### 18.3 取込結果表示

| 表示 | 内容 |
|---|---|
| 新規作成件数 | 新たに作成した件数 |
| 更新件数 | 既存データを更新した件数 |
| スキップ件数 | 取込しなかった件数 |
| エラー件数 | 失敗件数 |
| 警告件数 | 注意件数 |
| AI再分析対象 | 再分析対象の顧客数 |

---

## 19. インポートジョブ管理

### 19.1 import_jobs

| カラム | 内容 |
|---|---|
| id | インポートジョブID |
| tenant_id | テナントID |
| store_id | 店舗ID |
| import_type | customers / reservations / sales など |
| source_system | 取込元システム |
| original_file_name | 元ファイル名 |
| file_path | 保存先パス |
| status | uploaded / mapped / validating / failed / completed |
| total_rows | 総行数 |
| success_rows | 成功件数 |
| error_rows | エラー件数 |
| warning_rows | 警告件数 |
| mapping_config | マッピング設定 |
| created_by | アップロードユーザー |
| created_at | 作成日時 |
| completed_at | 完了日時 |

### 19.2 import_errors

| カラム | 内容 |
|---|---|
| id | エラーID |
| import_job_id | インポートジョブID |
| row_number | 行番号 |
| column_name | カラム名 |
| input_value | 入力値 |
| error_level | error / warning / info |
| error_code | エラーコード |
| message | 表示メッセージ |
| suggestion | 修正候補 |
| resolved | 解決済みか |

---

## 20. CSV出力仕様

## 20.1 配信対象者CSV

### 20.1.1 目的

公式LINE、Lステップ、L Messageなどで手動配信・タグ付与・シナリオ投入に使うための対象者リストを出力する。

### 20.1.2 出力項目

| カラム名 | 表示名 | 説明 |
|---|---|---|
| campaign_id | 施策ID | 本サービス内の施策ID |
| campaign_name | 施策名 | 施策名 |
| customer_id | 顧客ID | 本サービス内ID |
| external_customer_id | 外部顧客ID | 外部システム用ID |
| display_name | 表示名 | 顧客表示名 |
| full_name | 氏名 | 権限により出力制御 |
| phone | 電話番号 | 権限により出力制御 |
| email | メール | 権限により出力制御 |
| line_user_id | LINE userId | 将来連携用 |
| customer_state | 顧客状態 | 休眠、初回後など |
| inferred_needs | 推定ニーズ | 季節悩み、価格不安など |
| priority | 優先度 | high / medium / low |
| recommended_channel | 推奨チャネル | line / phone / in_store など |
| recommended_message | 推奨文案 | 個別送信用文案がある場合 |
| external_tag_candidate | 外部タグ候補 | 施策用タグ候補 |
| reason | 対象理由 | なぜ対象になったか |
| caution | 注意点 | 過剰配信、個別対応など |

### 20.1.3 出力制御

以下の条件を満たす顧客のみを出力する。

```text
customer.status = active
AND customer_consents.contact_line_allowed = true
AND customer_consents.is_unsubscribed = false
```

メール・SMSの場合は各チャネルの同意状態を参照する。

---

## 20.2 除外者CSV

### 20.2.1 目的

配信対象から除外された顧客と、その理由を確認するために出力する。

### 20.2.2 出力項目

| カラム名 | 表示名 | 説明 |
|---|---|---|
| campaign_id | 施策ID | 本サービス内の施策ID |
| customer_id | 顧客ID | 本サービス内ID |
| display_name | 表示名 | 顧客表示名 |
| customer_state | 顧客状態 | 顧客状態 |
| excluded_reason | 除外理由 | 配信停止、同意未取得など |
| exclusion_detail | 除外詳細 | 補足 |
| requires_manual_check | 個別確認要否 | true / false |
| suggested_action | 推奨対応 | 再同意確認、個別連絡など |

### 20.2.3 除外理由

| 除外理由 | 内容 |
|---|---|
| unsubscribed | 配信停止 |
| no_channel_consent | 該当チャネルの同意なし |
| deleted_customer | 顧客削除済み |
| complaint_risk | クレーム注意 |
| manual_excluded | 手動除外 |
| individual_support | 個別対応中 |
| expression_risk | 施策内容と顧客状況が合わない |

---

## 20.3 外部タグ候補CSV

### 20.3.1 目的

公式LINE、Lステップ、L Message等で必要な最小限のタグを作成・付与するための候補を出力する。

### 20.3.2 出力項目

| カラム名 | 表示名 | 説明 |
|---|---|---|
| tool_type | ツール種別 | official_line / lstep / lmessage |
| tag_name | タグ名 | 外部ツール用タグ名 |
| tag_type | タグ種別 | state / campaign / caution / channel |
| customer_id | 顧客ID | 本サービス内ID |
| external_customer_id | 外部顧客ID | 外部システム用ID |
| line_user_id | LINE userId | 将来連携用 |
| reason | 作成理由 | タグ作成・付与理由 |
| valid_from | 有効開始日 | タグ利用開始日 |
| valid_until | 有効期限 | 一時タグの場合 |
| delete_after_campaign | 施策後削除推奨 | true / false |

### 20.3.3 タグ名ルール

| 種別 | 例 |
|---|---|
| 状態タグ | 初回後フォロー対象 |
| 状態タグ | 休眠復帰対象 |
| 施策タグ | 休眠復帰_2026年05月 |
| 施策タグ | 回数券更新_2026年06月 |
| 注意タグ | 要個別対応 |
| チャネルタグ | LINE配信対象 |

---

## 20.4 施策結果入力CSV

### 20.4.1 目的

店舗または代理店が、施策実行後の結果を本サービスへ戻すための入力テンプレートを出力する。

### 20.4.2 出力項目

| カラム名 | 表示名 | 説明 |
|---|---|---|
| campaign_id | 施策ID | 編集不可推奨 |
| campaign_name | 施策名 | 施策名 |
| channel | チャネル | line / instagram / google など |
| executed_at | 実施日時 | 実施日を入力 |
| target_count | 対象者数 | 初期値入り |
| delivered_count | 配信数 | 入力欄 |
| reply_count | 返信数 | 入力欄 |
| reservation_count | 予約数 | 入力欄 |
| visit_count | 来店数 | 入力欄 |
| sales_amount | 売上金額 | 入力欄 |
| memo | メモ | 入力欄 |

---

## 21. CSV出力時の権限制御

### 21.1 個人情報出力制御

| ロール | 氏名 | 電話 | メール | LINE userId | 顧客詳細 |
|---|---|---|---|---|---|
| owner | 出力可 | 出力可 | 出力可 | 出力可 | 出力可 |
| manager | 出力可 | 出力可 | 出力可 | 条件付き | 出力可 |
| staff | 制限 | 制限 | 制限 | 不可 | 担当分のみ |
| supporter | 権限次第 | 権限次第 | 権限次第 | 原則不可 | 権限次第 |
| agency_admin | 店舗許可時のみ | 店舗許可時のみ | 店舗許可時のみ | 原則不可 | 店舗許可時のみ |

### 21.2 重要操作ログ

以下は必ず監査ログに記録する。

- CSVアップロード
- CSV取込実行
- CSV出力
- 顧客個人情報を含むCSV出力
- 配信対象者CSV出力
- 除外者CSV出力
- 外部タグ候補CSV出力
- 同意状態の一括更新
- 配信停止状態の更新

---

## 22. セキュリティ・プライバシー注意点

### 22.1 CSV保存方針

| 対象 | 方針 |
|---|---|
| 元CSVファイル | 一定期間保存後削除、または暗号化保存 |
| 取込済みデータ | DBに保存 |
| エラーCSV | 個人情報を含むためアクセス制限 |
| 出力CSV | ダウンロード期限を設定 |
| 一時ファイル | 処理後削除 |

### 22.2 ダウンロード期限

出力CSVは、生成後一定時間で無効化する。

初期候補：

```text
24時間〜72時間
```

### 22.3 マスキング

権限が不足しているユーザーには、CSV上でも以下をマスキングする。

| 情報 | 例 |
|---|---|
| 氏名 | 山田花子 → 山田○○ / 顧客A |
| 電話番号 | 090-1234-5678 → 090-****-5678 |
| メール | hanako@example.com → h***@example.com |
| LINE表示名 | 一部非表示 |

---

## 23. 画面要件との関係

CSV取込・出力は、主に以下の画面と関係する。

| 画面 | 関係 |
|---|---|
| 初期セットアップ画面 | 初回データ取込 |
| データ取込画面 | CSVアップロード、マッピング、エラー確認 |
| 顧客一覧画面 | 取込結果の確認 |
| 顧客詳細画面 | 履歴・売上・メモ確認 |
| セグメント/対象者整理画面 | 対象者CSV・除外者CSV出力 |
| 施策詳細画面 | 施策対象・結果CSV出力/取込 |
| レポート画面 | 月次CSV/PDF出力 |
| 承認管理画面 | 承認済み文案・対象者出力 |

---

## 24. API要件との関係

CSV取込・出力に必要なAPIは以下である。

| API | 内容 |
|---|---|
| POST /imports | CSVアップロード |
| GET /imports/{id} | インポート詳細取得 |
| POST /imports/{id}/mapping | 項目マッピング保存 |
| POST /imports/{id}/validate | データ品質チェック |
| POST /imports/{id}/execute | 取込実行 |
| GET /imports/{id}/errors | エラー一覧取得 |
| GET /imports/{id}/result | 取込結果取得 |
| POST /exports/campaign-targets | 配信対象者CSV出力 |
| POST /exports/excluded-targets | 除外者CSV出力 |
| POST /exports/external-tags | 外部タグ候補CSV出力 |
| POST /exports/campaign-result-template | 施策結果入力CSV出力 |
| POST /exports/reports/monthly | 月次レポートCSV出力 |

---

## 25. MVPで必須の実装範囲

### 25.1 必須

| 機能 | 理由 |
|---|---|
| 顧客CSV取込 | 顧客状態判定の前提 |
| 予約/来店CSV取込 | 休眠・初回後・来店周期判定に必要 |
| 売上CSV取込 | LTV・客単価・アップセル判定に必要 |
| 項目マッピング | 実店舗CSVのばらつきに対応するため |
| エラー表示 | 店舗担当者が修正できるようにするため |
| 配信対象者CSV出力 | 公式LINE手動運用に必要 |
| 除外者CSV出力 | 誤配信防止に必要 |
| 施策結果入力CSV | 改善サイクルに必要 |
| 監査ログ | 個人情報・配信対象出力の管理に必要 |

### 25.2 後回し可

| 機能 | 理由 |
|---|---|
| 回数券/契約CSV専用取込 | エステでは重要だが、初期は手入力・売上CSVで代替可能 |
| 外部タグCSV取込 | Lステップ利用店舗向け。MVP後半でよい |
| Googleスプレッドシート自動同期 | CSVで初期検証可能 |
| 予約システム別プリセット | 利用店舗が増えてから対応でもよい |
| AIによる自動名寄せ確定 | 誤統合リスクがあるため後回し |

---

## 26. 未確定論点

今後詰めるべき論点は以下である。

| 論点 | 内容 |
|---|---|
| 文字コード | Shift_JISを初期必須対応にするか |
| 最大行数 | MVPで何行まで保証するか |
| 予約システム別テンプレート | SALON BOARD、RESERVA、STORES予約などをどこまで用意するか |
| 顧客識別ルール | 氏名のみの顧客をどこまで取り込むか |
| 同意不明の扱い | unknownを持つか、false扱いにするか |
| 回数券データ | MVPで専用テーブル化するか |
| AI分析再実行 | CSV取込後に即時実行か、夜間バッチか |
| 元CSV保存期間 | 何日保存するか |
| 出力CSVの保存期限 | 24時間か72時間か |
| エラー修正UI | 画面上で修正できるようにするか、CSV再アップロードにするか |

---

## 27. 次に作成する仕様書

本書の次に作成する仕様書は以下を推奨する。

1. 非機能要件定義書 v0.1
2. AIプロンプト設計書 v0.1
3. エステサロン向け初期テンプレート詳細仕様書 v0.1
4. MVP画面詳細仕様書 v0.1
5. CSVテンプレート実ファイル定義書 v0.1
