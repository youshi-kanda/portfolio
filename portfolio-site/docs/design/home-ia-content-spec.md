# Home IA / Content Specification

Issue: [#6 \[Phase 3\] トップページ IA とコンテンツ構成をポートフォリオ向けに再設計](https://github.com/youshi-kanda/portfolio/issues/6)
Branch: `issue/6-home-ia-content` / Base: `release/portfolio-site-v4`
作成日: 2026-09-13
入力: [#4 UI / IA 調査](../research/portfolio-ui-ia-research.md) ／ [#5 Work Inventory](../research/project-inventory.md) ／ #5 後の本人確認（Q1 / Q5 / Q9 / Q11）

この文書は **IA / コンテンツ / CTA の意思決定**である。
Astro component・CSS・`site.json`・作品 JSON の実装変更は **1 行も含まない**。
実装は #7 が行う。#7 が追加の IA 判断をせずに着手できる粒度まで確定させることが本書の目的である。

---

## 0. 本書が前提として受け取ったもの

#5 の Human Questions のうち、本人確認が完了した 4 件を事実として扱う。

| Q | 確定した内容 | 本書への影響 |
|---|---|---|
| **Q1** | `ANON-AI-01` について「保険代理店向け」「保険業務オペレーター向け」の業種・利用者表現を使ってよい | Featured 01 の public title を確定できる（§5.1）。「相談業務オペレーター向け」への抽象化は不要 |
| **Q5** | 生成 AI 開発環境経由のコミットも本人が指示・設計・実装した作業である | Featured 01 / 03 の Role を「担当範囲不明」扱いにしない。ただし repository から読めない要件定義・顧客折衝・成果は書かない |
| **Q9** | Strong Featured の visual は ① dummy data による sanitized UI mock を基本、② 必要な場合のみ architecture-style visual | §7 の visual brief をこの方針で書く。実データ・顧客情報は使わない |
| **Q11** | `ANON-WEBAPP-01` の発注元名は Portfolio に出さない | Featured 02 の title・本文・Case Study から発注元名を除く（§5.2 / §10） |

未回答のまま残っている Q は §13.4 に「#8 へ送る未決事項」として列挙する。

---

## 1. Portfolio Positioning

### 1.1 中心メッセージ

> **業務課題を理解し、Web Application / AI / Automation を組み合わせて、
> 実際に使える業務システムとして設計・実装できるエンジニア。**

このサイトが証明しようとしているのは「AI 技術をたくさん知っていること」**ではない**。
技術名は能力の裏付けとして出し、**技術一覧を主役にしない。**

### 1.2 公開面の情報順序（全 Work 共通・例外なし）

```
Problem / Business Context   ←  何に困っていたか
        ↓
What was built                ←  何を作ったか
        ↓
Role                          ←  どこまで自分がやったか
        ↓
Selected Technology           ←  何で作ったか（最後）
```

**Selected Technology を先頭に置かない。** 技術から入ると「技術を知っている人」の証明になり、
§1.1 のメッセージと逆を向く。

### 1.3 この Positioning が現行サイトを否定する点

| 現行 | 新方針 |
|---|---|
| Lead 1 件を深く見せ、同じ 3 作品を Band / Lead / index で 3 回出す | **同じ Work を複数回紹介しない。** Featured 5 件を 1 回ずつ |
| `HOW I BUILD`（AI 開発方法論）がトップで 2,220px | **CAPABILITIES へ圧縮。** 方法論は「何を任せられるか」の下位に置く |
| 免責・provenance・内部管理表現が公開面に出ている | **公開面は作品 Gallery。** 監査文書としての層は内部に残す（§10） |
| 技術スタック表を軸にする | **「何を頼めるか」4 カテゴリ**へ再構成（§7 → §8） |

### 1.4 想定読者と、その読者が 5 秒で判断すること

| 読者 | 5 秒で判断したいこと | どこで答えるか |
|---|---|---|
| 採用担当 / 技術責任者 | 業務システムを任せられる実装力があるか | HERO display + Featured 01 の visual |
| 発注を検討している事業者 | 自社の業務課題を扱えるか | Featured の Problem 行 + CAPABILITIES |
| エンジニア | 何をどこまで作っているか | Featured の Role + Case Study |

---

## 2. Final IA

### 2.1 セクション順（確定）

| # | id | nav ラベル | 役割 | 高さ上限 @1440 |
|---|---|---|---|---|
| 00 | `top` | —（nav に出さない） | 何者か / 何ができるか / 2 CTA | **≤ 600px** |
| 01 | `work` | **WORK** | Featured 5 件を 1 回ずつ、大型 visual で | **≤ 4,300px**（1 件 ≤ 800px + 見出し 300px） |
| 02 | `more` | **MORE** | More Projects 4 件を罫線 register で | **≤ 700px** |
| 03 | `capabilities` | **CAPABILITIES** | 何を頼めるか 4 カテゴリ + 作品対応 | **≤ 700px** |
| 04 | `about` | **ABOUT** | どういう考え方で作る人か | **≤ 550px** |
| 05 | `contact` | **CONTACT** | conversion point（反転バンド） | **≤ 450px** |
| 06 | `footer` | —（nav に出さない） | repo / 版 / 最終更新 | **≤ 200px** |
| | | | **合計** | **≤ 7,500px** |

> 合計上限は #4 §10.10 の 6,000px から 7,500px へ引き上げる。**作品数が 3 → 9 件へ増えたため。**
> 1 件あたりの上限は #4 の 900px から **800px へ下げる**（#4 §10.4 が「Featured 4 件以上なら 800px へ」と
> 定めた条件に、Featured 5 件は該当する）。ページ全長の抑制は件数ではなく 1 件あたりの密度で行う。

### 2.2 nav

```
youshi-kanda 業務システム / 業務自動化   01 WORK  02 MORE  03 CAPABILITIES  04 ABOUT  05 CONTACT
```

- **セクション見出しと nav ラベルは別物。** 見出しは `FEATURED WORK` / `MORE PROJECTS` / `CAPABILITIES`、
  nav ラベルは文字数を抑えた `WORK` / `MORE` / `CAPABILITIES`。`site.sections[].label` は **nav ラベル**を持つ。
- 番号は `site.sections` の位置から導出される（`derive.ts: sectionNumber`）。**番号を文字列として書かない。**
- `contact` の `label` を `null` → `"CONTACT"` にすることで nav に出る。**これが CONTACT 3 導線の 1 本目。**
- `footer` は `label: null` で `sections` に載せる。番号 06 は得るが nav には出ない。

### 2.3 現行セクションの行き先（削除ではなく再配置）

| 現行 | 行き先 |
|---|---|
| `INTRO`（Hero.astro） | **00 HERO** へ。コピーを圧縮（§4） |
| `EDITORIAL BAND` | **廃止。** Featured 5 件の gallery に統合。同じ Work を 2 回出さないため |
| `LEAD`（work entry 1 件の深掘り） | **廃止。** 深さは Case Study へ。`homepageRole` データは削除しない |
| `WORK INDEX`（Register） | **02 MORE PROJECTS** の減量 register として再利用 |
| `HOW I BUILD`（8 step workflow 図） | トップから除去。**03 CAPABILITIES に lede 1 行 + リンク**のみ残す。詳細の移設先は §13.3 |
| `ENGINEERING STACK`（非表示） | **03 CAPABILITIES** の技術対応列として吸収 |
| `ENGINEERING PRINCIPLES`（非表示） | トップに戻さない。Case Study 側に置く |
| `FEATURED EVIDENCE`（非表示） | トップに戻さない。Evidence 機構は各 Case Study で維持 |
| `SYNTHETIC DATA` 帯（F1 内） | **F1 から除去。** 図版キャプション（§7.7）と 04 ABOUT（§9）へ再配置。表明の総量は減らさない |

---

## 3. First Viewport Specification

### 3.1 Desktop 1440 × 900

| Y | 要素 |
|---|---|
| 0 – 72 | nav（masthead + 5 セクション） |
| 96 – 180 | rail `00` / ソフトウェアエンジニア / 業務システム・AI 活用・業務自動化 |
| 180 – 400 | **display 2 行**（§4.2） |
| 400 – 480 | supporting copy 2 行（§4.3） |
| 480 – 540 | **CTA 2 つ**（実績を見る / 相談する） |
| 540 – 600 | 01 WORK セクション頭（rail `01` + h2） |
| **600 – 900** | **Featured 01 の visual 上端。fold 内に ≥ 200px 見える** |

**合格条件**: `01` の 1 枚目の図版上端 Y ≤ 700px。
**HERO だけで画面を使い切らない。** SYNTHETIC 帯は F1 に置かない。

### 3.2 Mobile 390 × 844

| 順位 | 要素 | Y（目標） |
|---|---|---|
| 1 | nav（handle + kicker + INDEX） | 0 – 90 |
| 2 | display（**4 行以内** / 34px） | 110 – 320 |
| 3 | supporting copy（2 行 / 17px） | 340 – 420 |
| 4 | CTA 2 つ（縦積み可） | 440 – 540 |
| 5 | **Featured 01 の visual 上端** | **≤ 720** |

HERO の capability 3 組は mobile では display 直後に出さず、**03 CAPABILITIES に統合**する（重複するため）。

### 3.3 5 秒で伝わるかの判定

first viewport 内に、この 4 つが **すべて**入っていること。

1. **何者か** — 「ソフトウェアエンジニア / 業務システム・AI 活用・業務自動化」
2. **何ができるか** — display 2 行
3. **作品を見る導線** — primary CTA + 実際の作品 visual が見え始めている
4. **連絡する導線** — secondary CTA（+ nav の 05 CONTACT）

---

## 4. HERO Final Copy

### 4.1 方向の比較

| 案 | display | 評価 |
|---|---|---|
| A（現行 V4） | 業務の課題を整理し、／画面・API・データ・自動処理へ落とし込み、／動く仕組みとして設計・実装する。 | 内容は正しいが **3 行・長い**。「動く仕組み」が弱い（動くだけなら demo でもよい） |
| B（Issue 提示案） | 業務課題を、使われる Web・AI システムへ。 | **短い。**「使われる」が demo との差を一語で出す。主語述語が省略され、やや広告的 |
| C′ | 業務課題を、／**実際に使われる** Web・AI システムへ。 | **採らない。**「使われる」は**実稼働・利用実績**を含意する。掲載 9 件の稼働状況は repository から確認できず、#5 が「商用実績・利用者数・稼働状況を 1 件も記載していない」と明記した範囲を越える |
| **C（採用）** | **業務課題を、**／**業務で使える Web・AI システムへ。** | B を 2 行に割って display の版面を保ちつつ、**「業務で使える」= 業務要件への適合の主張に留める。** 稼働実績を主張しない。#4 §13.3 の mobile 4 行以内に収まる |

**採用: C。** 理由 —
(1) §1.1 の「実際に使える業務システム」をそのまま 1 文にしている。
(2) 「Web・AI」で守備範囲を、「業務で使える」で demo でないことを、同時に言える。
(3) 2 行なので desktop 220px / mobile 4 行以内に収まり、§3 の first viewport 条件を満たす。

**「使われる」を採らない理由（重要）**: 「使われる」は**実際に運用されている**という含意を持つ。
本 Portfolio は稼働状況・利用者数・商用実績を 1 件も主張しない方針であり（#5 §0）、
display でそれを含意すると、以降のすべての記述より強い主張を first viewport に置くことになる。
**「業務で使える」は能力の主張であって、実績の主張ではない。**

### 4.2 display（確定）

```
業務課題を、
業務で使える Web・AI システムへ。
```

- copy key: `home.hero.display.01` / `home.hero.display.02`（**現行 3 行を 2 行に変更**）
- `check:structure` が `data-hero-line` を 3 で固定しているため、**期待値の更新が必要**（§13.2）

### 4.3 supporting copy（確定）

```
業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、
実際に運用できる仕組みとして設計・実装します。
```

- copy key: `home.hero.lede`（**現行の 2 文を差し替え**）
- 現行 lede の「AI や自動処理に任せる範囲と、人が判断する範囲を分けて設計します」は
  **04 ABOUT へ移設**する（§9）。HERO からは消えるが、サイトからは消えない。

### 4.4 Role 行（確定）

| slot | text | copy key |
|---|---|---|
| 職種 | ソフトウェアエンジニア | `home.hero.role.01`（現行のまま） |
| 領域 | **業務システム / AI 活用 / 業務自動化** | `home.hero.role.02`（現行「業務システム / 自動化 / AI活用」の語順と表記を統一） |

英語併記（rail の小文字ラベル）:
`Software Engineer — Business Systems / AI Integration / Automation`

### 4.5 CTA（確定）

| 種別 | ラベル | 遷移先 | 備考 |
|---|---|---|---|
| Primary | **実績を見る** | `#work` | 塗り。first viewport 内 |
| Secondary | **相談する** | `#contact` | 罫線のみ。first viewport 内 |

- copy key: `home.hero.cta.primary` / `home.hero.cta.secondary`（**新規**。§13.2 の attestation 登録対象）
- 「作品を見る」ではなく **「実績を見る」**。Featured が個人 demo ではなく実務 Work 中心になったため。

### 4.6 HERO から外すもの

| 要素 | 行き先 |
|---|---|
| SYNTHETIC DATA / Demo 帯 | 図版キャプション（§7.7）+ 04 ABOUT |
| capability 3 組（`home.hero.capability.*`） | **03 CAPABILITIES**（§8）。4 カテゴリへ再編される |
| stack line（`hero.stackLine`） | **03 CAPABILITIES** の技術列。HERO には技術名を置かない（§1.2） |

---

## 5. Featured Work Structure

### 5.0 共通仕様

**トップページの 1 Work に載せる項目（これ以外は載せない）**

| 項目 | 上限 |
|---|---|
| index | `01`–`05` |
| category / short role | 1 行・全角 20 字以内 |
| title | 1 行 |
| copy | **1〜2 文**。Problem → Solution → Role が一読で分かること |
| Role | 1 行 |
| selected technologies | **4〜6 個** |
| large visual | 16:10 クロップ / 高さ ≥ 320px @1440 |
| CTA | **`caseStudyPublished` が true の Work にのみ `Case Study →` を 1 本。** false の Work は CTA を持たない（§5.0.1） |

**トップページに載せないもの（すべて Case Study 側へ送る）**

API 本数 / migration 数 / tests 本数 / 長い architecture 説明 / CI 詳細 /
内部判断記録 / publication review 情報 / sourceRef / limitations / originalProductScope

> 現行 `Register.astro` が出している `problem` 配列・`implementationScope`・`proves`・`tests`・
> `limitations` は **トップから外す**。Truth Gate のデータは残す（§10）。

**非対称リズム**（#4 §10.3）: 広 / 狭 / 広 / 狭 / 広
広 = `.bleed` 1,296px、狭 = `.msr` 720px。01・03・05 が広。

### 5.0.1 Case Study CTA の条件（既存仕様の踏襲）

**全 Featured に `Case Study →` を固定しない。** `workSchema` の `caseStudyPublished` が唯一の判定条件で、
これは既存仕様である（schema コメント: *"the site never offers a link whose label promises a page that does not exist"*）。

| `caseStudyPublished` | CTA |
|---|---|
| `true` | `Case Study →` を表示 |
| `false` | **CTA を表示しない。** 代替リンクもプレースホルダも置かない |

**本 IA 時点の実際の値**

| Work | `caseStudyPublished` | トップでの CTA |
|---|---|---|
| Featured 01 保険代理店向け AI 相談支援 | `false` | **無し** |
| Featured 02 採用管理 Web Application | `false` | **無し** |
| Featured 03 組織向け AI アシスタント基盤 | `false` | **無し** |
| Featured 04 業務運用 Platform | `false` | **無し** |
| Featured 05 AI 相談型マーケティング CRM | `true` | `Case Study →` |
| More 01 Project Progress Manager | `true` | `Case Study →` |

**#7 は新規 Featured 01〜04 の Case Study を制作しない。** それは #8 のスコープである。
したがって #7 の完成時点で Case Study CTA を持つのは **Featured 05 と More 01 の 2 件のみ**であり、
これは欠陥ではなく**正しい状態**である。

**禁止事項**: 存在しないページへのリンク / 「Case Study は準備中」等の将来を約束する文言 /
CTA の位置を空けておくためのプレースホルダ。**無いものは、無いものとして何も置かない。**

---

### 5.1 Featured 01

| 項目 | 内容 |
|---|---|
| **public title** | **保険代理店向け AI 相談支援システム** |
| **category** | 実務 AI / 判断支援 / RAG |
| **copy** | 顧客から聞き取った条件をもとに、どの商品が適用できるかを社内基準に照らして判定し、その根拠を社内ナレッジから検索して提示する相談支援システム。オペレーターが調べて判断していた工程そのものを対象にしている。 |
| **role** | Frontend / Backend / AI Integration / Database / Auth |
| **selected tech** | React · TypeScript · Supabase / PostgreSQL · RAG（Embedding / Vector Search）· LLM |
| **CTA** | **無し**（`caseStudyPublished: false`。Case Study は #8） |
| 内部 ID | `ANON-AI-01` / slug 案 `ins-ai` |

**title の選定（Q1 の 2 案比較）**

| 案 | 評価 |
|---|---|
| 保険業務オペレーター向け AI 相談支援システム | 利用者の役割は正確だが、「保険業務オペレーター」が一般に通る語ではなく、**誰の業務課題か**が一段遠い |
| **保険代理店向け AI 相談支援システム（採用）** | **「保険代理店」は事業者区分として広く通る。** 何の業種の、どういう事業者のためのシステムかが title だけで伝わる |

**採用は後者。** 利用者が「オペレーター」であることは title ではなく **copy 本文の主語**で表現する
（copy 冒頭「顧客から聞き取った条件をもとに」＝オペレーターの作業を指している）。
これで **業種（title）と利用者（copy）の両方**が伝わり、どちらも抽象化せずに済む。

**Featured 1 位である理由（内部）**: 業務課題との結びつきが最も明確で、RAG が飾りではなく
判断根拠の提示という業務要件から来ている。lineup では「業種特化 AI × 実務判断」の枠。

---

### 5.2 Featured 02

| 項目 | 内容 |
|---|---|
| **public title** | **採用管理 Web Application** |
| **category** | 業務 Web Application |
| **copy** | 応募受付から選考、応募者管理、面接日程、合否判定までを 1 つの管理画面に集約した採用管理 Web アプリ。Google Calendar 連携での面接予約と通知、応募者情報の保持期限後の匿名化まで業務フローに含めている。 |
| **role** | Frontend / Backend / Database / Auth / Infrastructure |
| **selected tech** | React · TypeScript · Cloudflare Pages / Functions · Cloudflare D1 · Google Calendar API · Twilio |
| **CTA** | **無し**（`caseStudyPublished: false`。Case Study は #8） |
| 内部 ID | `ANON-WEBAPP-01` / slug 案 `hire` |

**Q11 の適用（確定事項）**

- **title・copy・Role・Case Study・図版のいずれにも発注元名を出さない。**
- 「採用管理」という業務名だけで成立させる。業種名も出さない。
- **公開 repository 名に発注元名が含まれている**ため、**repository へのリンクを張らない**。
  Featured 02 は `link if public` を**持たない** Work として扱う。
- GAS を主語にしない。技術列に GAS を載せない（初期段階と連携の構成要素であり、最終形の中心ではない）。

**lineup 上の役割**: AI を主題にしない唯一の Featured。「業務 Web アプリを最後まで作り切る力」の枠。
Featured 01 の直後に置くことで、**AI も作るし業務アプリも作る**という二面が最初の 2 件で伝わる。

---

### 5.3 Featured 03

| 項目 | 内容 |
|---|---|
| **public title** | **組織向け AI アシスタント基盤** |
| **category** | AI Platform / RAG / External Integration |
| **copy** | AI 秘書・社内 AI チャット・管理ポータルの 3 つのアプリを、1 つの共通基盤の上に載せた AI Platform。組織単位のテナント分離・権限・監査を基盤側に置き、カレンダーや Slack など業務で使っているサービスと接続している。 |
| **role** | Architecture / Frontend / Backend / AI Integration / Infrastructure |
| **selected tech** | TypeScript · React · Supabase / PostgreSQL · RAG（Hybrid Search）· LLM · Google / Slack 連携 |
| **CTA** | **無し**（`caseStudyPublished: false`。Case Study は #8） |
| 内部 ID | `ANON-AI-02` / slug 案 `assist` |

**Featured 01 との差**: 01 が業種特化の**縦の深さ**、03 が複数プロダクトを載せる**横の基盤設計**。
copy でも 01 は「判定」、03 は「基盤に載せる」を主語にして重複を避ける。

**書かないこと**: RAG の内部手法の列挙（再ランキング / クエリ拡張 / 意図分類 / 長期記憶 / multi-agent）。
`RAG（Hybrid Search）` の 1 語に畳み、詳細は Case Study へ送る。
**アバター素材は使わない**（Q10 未回答。第三者の肖像・音声の可能性 → §13.4）。

---

### 5.4 Featured 04

| 項目 | 内容 |
|---|---|
| **public title** | **業務運用 Platform** |
| **category** | Business Operations / Permissions / Multi-tenant |
| **copy** | 現場スタッフと管理者が同じ仕組みを別の権限で使う業務運用プラットフォーム。誰が何をどこまで操作できるかと、業務がどの状態からどの状態へ進むかを先に設計として確定させ、日報・マニュアル・通知をその同じ権限モデルの上に載せている。 |
| **role** | Architecture / Frontend / Backend / Database / Infrastructure |
| **selected tech** | Next.js · React · Cloudflare Workers · Supabase / PostgreSQL · RBAC / RLS · Web Push |
| **CTA** | **無し**（`caseStudyPublished: false`。Case Study は #8） |
| 内部 ID | `ANON-PLATFORM-02` / slug 案 `ops` |

**AI を主題にしない。** lineup 中で「権限 / Role / Scope / 状態遷移 / 管理画面 / 通知 / Multi-tenant」を
主題にする唯一の Work。業務システムの商談で最も高頻度に聞かれる領域に、見せられる答えを置く枠。

**Q7 未回答の影響（重要）**: 権限設計を**本人が起草したか**が未確定。
そのため copy は **「設計として確定させ」** までに留め、**「私が権限設計を策定した」とは書かない。**
Q7 が「起草した」で確定した場合のみ、#8 以降で Role に `Permission Design` を追加してよい（§13.4）。

---

### 5.5 Featured 05

| 項目 | 内容 |
|---|---|
| **public title** | **AI 相談型マーケティング CRM** |
| **category** | Full-stack AI / Human Approval |
| **copy** | 公式 LINE を顧客接点として、顧客・予約・売上を 1 か所に整理し、次に誰へ何をすべきかを AI が提案する CRM。**AI の提案は下書きのままで、人が承認するまで確定しない。** |
| **role** | Frontend / Backend / AI Integration / Database / Testing / CI-CD |
| **selected tech** | Django REST Framework · PostgreSQL · React / TypeScript · Redis / Celery · LINE Messaging API · PWA |
| **CTA** | `Case Study →`（`caseStudyPublished: true`）+ **公開デモ導線**。デモ導線を持つ唯一の Featured |
| 内部 ID | `ANON-AI-03` / slug `crm`（**既存 slug をそのまま使う**） |

**位置づけの変更（Q8 に対する本書の決定）**: **「公開デモ」ではなく「実務向け CRM の、公開できる断面」**として出す。
copy に「デモ」の語を出さない。合成データである旨は図版キャプション（§7.7）で述べる。

**この 1 件だけ既存素材が揃っている。** §7.6 参照。

---

### 5.6 Featured 5 件が互いに重ならないことの確認

| # | 埋める枠 | AI が主題か | 主題の重心 |
|---|---|---|---|
| 01 | 業種特化 AI × 実務判断 | ○ | ドメイン判定 + RAG |
| 02 | 業務 Web アプリを作り切る | ✕ | 画面 + 業務フロー + 外部連携 |
| 03 | AI 基盤 / Platform 設計 | ○ | 基盤 + マルチプロダクト |
| 04 | 権限 / 運用 / Multi-tenant | ✕ | 権限モデル + 状態遷移 |
| 05 | 触れる実物 / Human approval | ○ | フルスタック + 承認構造 |

**AI ○ 3 件 / ✕ 2 件**で、§1.1 の「AI を知っている人ではない」を構成そのもので示す。
01 と 03 は AI だが縦 / 横で重心が違い、02 と 04 は非 AI だがアプリ / 基盤で重心が違う。

---

## 6. More Projects

### 6.1 最終 4 件（確定）

| # | title | one-line | role / category | selected tech | link |
|---|---|---|---|---|---|
| 01 | **Project Progress Manager** | Google スプレッドシートを正本にしたまま、複数プロジェクトの進捗・依存・判断待ちを登録から集計まで完結させる進捗管理アドオン | Automation / 情報設計 | GAS · Google Sheets · GitHub API | **公開デモあり** |
| 02 | **MinIO Access Management** | オブジェクトストレージのバケット・ユーザー・ポリシー・招待・監査ログ・期限付き共有リンクを扱う GUI 管理コンソール | Infrastructure / Auth | MinIO · TypeScript · Docker · Google OAuth 2.0 | **公開 repository** |
| 03 | **OCR / LLM 文書処理システム** | 通帳の画像・PDF から取引データを抽出して CSV 出力する Web アプリ。2 系統の LLM を併用し、処理の進捗を WebSocket で返す | Document AI / Full-stack | React · TypeScript · Python · PostgreSQL · WebSocket | **公開 repository**（§6.4 の確認後） |
| 04 | **農業工程・勤怠管理** | 現場作業員はスマートフォンでワンタップ打刻と GPS 付き作業ログ、管理者は PC で工程・スタッフ・レポートを見るマルチテナント業務管理 | 業務管理 / Multi-tenant | Next.js · TypeScript · Firebase | 非公開 |

### 6.2 この 4 件を選んだ理由

選定基準は 3 つ。**(a) Featured 5 件と能力が重複しないこと / (b) 担当範囲が repository から確定していること /
(c) Disclosure Mode が確定していること。**

| # | (a) Featured と重ならない軸 | (b) Role | (c) Disclosure |
|---|---|---|---|
| 01 | **Google Workspace 上の業務自動化。** Featured に GAS / Sheets を主題にする Work が 1 件も無い。「正本をどこに置くか」という情報設計の題材でもある | 確定（Automation / Architecture / Testing） | `Public`（本 repository 内にデモ） |
| 02 | **インフラ層の権限・ストレージ管理。** Featured 04 はアプリ層の RBAC であり、**層が違う**。招待・監査ログ・期限付きリンクという運用要件を含む | 確定（Frontend / Backend / Infra / Auth） | `Public` |
| 03 | **文書 AI。** Featured 01 / 03 の AI は検索と判断支援であり、**非定型文書からの構造化抽出は別の適用形**。2 系統の LLM 併用という判断も題材になる | 確定（Frontend / Backend / AI / Infra） | `Public` |
| 04 | **現場スマホ × 管理 PC という利用者分離。** Featured にモバイル起点の現場業務が無い。Firebase も他 8 件と重ならない唯一のスタック | 確定（Frontend / Backend / Database / Auth） | `Anonymous`（確認要件なし） |

**4 件で「幅」が成立する根拠**: Featured 5 件が覆う軸（業種 AI / 業務アプリ / AI 基盤 / 権限運用 / フルスタック）に対し、
More 4 件は **自動化・インフラ・文書 AI・現場業務**を足す。合計 9 件で §8 の 4 カテゴリすべてに実例が付く（§8.2）。

### 6.3 採用しなかった候補と、その理由

| 候補 | 判断 | 理由 |
|---|---|---|
| **ポイント / 会員 Platform**（`ANON-PLATFORM-03`） | **保留** | **担当範囲が未確定**（#5 Q17: 運営管理 / 店舗管理 / ユーザーアプリ / 決済端末の 4 サービスのうちどれを担当したか）。「repository から確認できないことは推測しない」という本件の原則に反するため、Q17 が確定するまで公開面に入れない。決済という未カバー領域を埋める価値はあるので、**Q17 確定後に More 05 として追加できる**（§13.4） |
| **AIStudy Agent** | **見送り** | 公開・Role 確定で掲載リスクは無いが、**AI チャット統合という軸が Featured 01 / 03 / 05 と重なる。** §6.2 基準 (a) を満たさない。他候補が枯れた場合の予備 |
| **Document Field Extraction Demo**（現行 `dfe`） | **トップから外す** | §6.5 参照 |

### 6.4 More 03 の掲載前提条件（#7 が着手前に確認すること）

#5 §9-1 が「公開 repository に `.env` が追跡ファイルとして存在するものが 4 件ある」と記録しているため、
**外部 public repository へリンクを出す More 02 / 03 について現況を確認した。**

**More 01 は対象外。** 公開デモが本 repository 内にあり、`scan:public` の対象として継続的に検査されている。

| Work | current main tree の現況 | 判定 |
|---|---|---|
| **More 02** MinIO Access Management | **`.env` 本体は無い。** `.env.example` / `.env.production.example` は存在する。ただし **`admin-api/cookies.txt` / `file-api/cookies.txt` 等が tracked で存在する** | **リンク前に security 確認が必要** |
| **More 03** OCR / LLM 文書処理システム | **`.env` 本体は無い。** `.env.example` のみ | 現況では阻害要因を確認していない |

**`cookies.txt` の内容は取得していない。** ファイル名から**セッション情報を含む可能性**があるため、
**内容の確認ではなく「Portfolio から repository リンクを出す前の security 確認事項」として残す。**
本書はこの判断を行わない（#8 U-05）。

該当した場合の扱いは 2 段階:

1. **リンクのみ取り下げ、掲載は継続。** title / one-line / role / tech は repository 名を含まないため、
   リンクが無くても More Projects の行としては成立する（§6.6）
2. 掲載自体を見送る場合、**代替は現行 `dfe`**（§6.5）。文書 AI の軸を空けないための差し替え先として確保する

### 6.5 現行 3 作品の行き先（本書の決定）

| slug | 現行 | 新 IA での位置 |
|---|---|---|
| `crm` | Featured / Lead | **Featured 05**（§5.5）。slug 据え置き |
| `ppm` | Featured | **More Projects 01**（§6.1） |
| `dfe` | Featured | **トップから外し、`/work/` アーカイブに残す** |

**`dfe` をトップから外す理由**: More 03（OCR / LLM 文書処理システム）と**同じ文書 AI の軸**に立つため、
両方をトップに出すと §6.2 (a) に反する。両者のうち Portfolio の主張（§1.1「実際に使える業務システム」）に
近いのは、CLI ではなく**画面を持つ Web アプリ**である More 03 の方である。

**ただし削除ではない。** `dfe` の作品 JSON・Case Study・Evidence・承認済みコピーはすべて残し、
`/work/` 一覧と `/work/dfe/` は公開のまま維持する（#4 §10.4 が `/work/` を archive と定義している）。
**トップの編成から外れるだけで、サイトから消えない。**

### 6.6 More Projects の表示仕様

- **Featured より明確に面積を小さくする。** 1 件あたり ≤ 120px @1440（Featured は ≤ 800px）
- 形式は **罫線 register**。カード grid にしない（#4 §7-10）
- **大型 visual を持たない。** サムネイルも置かない
- **作品別 pigment（`--sig`）を割り当てない。** ニュートラルで並べる（§13.2 の色数問題を回避する）
- `link if public` がある行だけリンクを出す。無い行はリンクを持たない（ラベルだけ置かない）
- セクション末尾に `すべての作品を見る →` で `/work/` へ

---

## 7. Visual Specification

**本書は「何を visual 化するか」までを決める。制作は #7 以降。画像生成は本 Issue では行わない。**

### 7.1 全 Featured 共通の原則（Q9 の適用）

| | 内容 |
|---|---|
| 主役 | **dummy data による sanitized UI mock** |
| 補助 | **必要な場合のみ** architecture-style visual |
| 禁止 | 実案件の実データ・顧客情報・実在の氏名 / 社名 / 商品名 / 日程 |
| 禁止 | **実 production screenshot であるかのように誤認させること** |
| 比率 | 16:10 クロップ。高さ ≥ 320px @1440 / ≥ 200px @390。**縮小せず横をクロップする** |

### 7.2 Featured 01 — visual brief

- **主 visual**: 相談画面の sanitized UI mock。左に聞き取り条件の入力、右に**商品ごとの適用可否の判定結果**と、
  その根拠として引用された社内ナレッジの抜粋が並ぶ 1 画面。
- **dummy data 指定**: 商品名は `商品 A / 商品 B / 商品 C`。顧客は `ダミー 太郎`。
  条件値・年齢・金額はすべて架空の丸い数字。**実在の保険商品名・約款文言を使わない。**
- **補助 visual（任意・1 枚まで）**: `聞き取り → 判定 → 比較 → 根拠提示 → PDF` の 5 段フロー図。
- **意図**: 「AI が答えた」ではなく **「根拠つきで判定を返した」**ことが 1 枚で分かること。

### 7.3 Featured 02 — visual brief

- **主 visual**: 応募者一覧の管理画面 mock。選考ステータス列（`書類選考 / 一次面接 / 最終 / 合否`）が
  行ごとに違う状態で並び、右側に面接予定が見える。
- **dummy data 指定**: 応募者は `応募者 A〜F`。日程は翌月の架空日付。
  **発注元名・企業ロゴ・実在の求人票を一切含めない（Q11）。**
- **補助 visual**: 不要。管理画面 1 枚で業務が伝わるため。
- **意図**: 「採用業務がこの 1 画面で回っている」ことが説明なしで分かること。

### 7.4 Featured 03 — visual brief

- **主 visual**: **architecture-style visual を主役にする唯一の Featured。**
  共通基盤（認証 / テナント / 監査 / RAG）の上に **AI 秘書・社内 AI チャット・管理ポータル**の
  3 アプリが載り、外側に Google / Slack が接続する構成図。
- **理由**: この Work の主張は「1 基盤に 3 プロダクトを載せた」であり、**構造そのものが成果物**。
  UI mock 1 枚では 3 アプリの関係が表現できない。
- **補助 visual（任意）**: AI チャット画面の sanitized mock 1 枚。
- **禁止**: **アバター素材を使わない**（Q10 未回答 / §13.4）。

### 7.5 Featured 04 — visual brief

- **主 visual**: **権限マトリクス**の mock。行 = ロール（`管理者 / 現場リーダー / スタッフ`）、
  列 = 操作（`閲覧 / 作成 / 承認 / 管理`）、セル = 可否とスコープ。
- **dummy data 指定**: **ロール名は一般名詞に置き換える。** 実際のロール名・テナント名・組織名を出さない。
- **補助 visual（任意）**: 業務の状態遷移図 1 枚。
- **意図**: **権限モデルとスコープを実装した構造が、図として分かること。**
- **書かないこと（Q7 未回答のため）**: 「権限を設計できる」「権限設計を策定した」等、
  **設計の起草者が本人であることを含意する表現。** 図もキャプションも、
  **実装された構造の説明**に留める。Q7 が「起草した」で確定した場合のみ、#8 以降で追加してよい（§13.4 U-02）。

### 7.6 Featured 05 — visual brief

- **主 visual**: **既存の公開可能素材を使う。** 制作不要。
  `assets/ai-crm/publish/` に 6 枚の画面（dashboard / customer-list / campaign-ai-draft /
  **campaign-approved** / customer-detail-masked / customer-detail-owner）と architecture 図 1 枚、
  および承認フローの動画がある。
- **主 visual の指定**: `06-campaign-approved.png`（現行 `/img/crmApproved.webp`）。
  **AI の下書きが人の承認を経て承認済みに変わった同一画面**で、§5.5 の copy と主張が一致する。
- **補助**: 顧客一覧または masked / owner の対比 1 枚（権限で表示が変わることを示す）。
- **前提**: これらは `portfolio-planning/assets/` にあり、**site の `public/img/` には現在 1 枚しか無い。**
  #7 で必要枚数を取り込む（§13.3）。

### 7.7 キャプションの扱い

- **「機密なのでモックです」とトップで大きく主張しない。**
- 各図版の下に **小さな caption を 1 行**だけ置く:
  - Featured 01–04（再構成 mock）: `Reconstructed interface / dummy data`
  - Featured 05（合成データの実画面）: 現行の合成データ表記を維持
- SYNTHETIC DATA の表明は **図版キャプション + 04 ABOUT** の 2 か所で担保する。
  **F1 の帯が消えるだけで、サイト上の表明は減らない。**

### 7.8 Mobile の図版

- 1 カラム。非対称リズムは捨てる
- 幅 = 画面幅 − 32px / 高さ ≥ 200px（320px 幅では ≥ 180px）
- **architecture 図（Featured 03 / 補助図）は縮小しすぎない。**
  390px で判読できない場合、**要素を減らした簡略版を別に用意する**（縮小ではなく作り分け）
- 1 枚目 `eager` / 2 枚目以降 `lazy`

---

## 8. Capabilities

### 8.1 方針

技術スタック一覧ではなく **「何を任せられるか」** で 4 カテゴリ。
カテゴリ名は閲覧者が **「これを頼める」** と読める日本語にし、英語を副題に添える。

### 8.2 4 カテゴリ（確定）

| # | カテゴリ | 何を任せられるか | 使う技術 | 実例 |
|---|---|---|---|---|
| 01 | **業務用の Web アプリケーションを作る**<br>Business Web Applications | 管理画面・業務フロー・認証・権限・データベース設計・外部サービス連携までを 1 つの業務アプリとして | React / Next.js · TypeScript · PostgreSQL · Supabase · Cloudflare | 採用管理 Web App（F02）／ 業務運用 Platform（F04）／ 農業工程・勤怠管理（M04） |
| 02 | **AI を業務の中に組み込む**<br>AI Integration | 社内ナレッジの検索・根拠提示・文書からの構造化抽出・**人の承認を挟む設計** | RAG / Vector Search · Hybrid Search · LLM · Embedding | 保険 AI 相談支援（F01）／ AI アシスタント基盤（F03）／ AI CRM（F05）／ OCR / LLM 文書処理（M03） |
| 03 | **外部サービスとつないで自動化する**<br>Automation & Integrations | 業務で既に使っているサービスとの接続、通知、定期実行、バックグラウンド処理 | Google Workspace / Calendar · LINE · Twilio · Celery / Redis · GAS | 採用管理（F02）／ AI CRM（F05）／ Project Progress Manager（M01） |
| 04 | **設計して、運用できる状態まで届ける**<br>System Design & Delivery | API / データ構造の設計、権限・マルチテナント、テスト、CI/CD、デプロイ | RBAC / RLS · Multi-tenant · GitHub Actions · Docker · Cloudflare Workers | 業務運用 Platform（F04）／ AI アシスタント基盤（F03）／ MinIO Access Management（M02） |

**掲載 9 件すべてが、少なくとも 1 つのカテゴリに実例として現れる。**
カテゴリは自己申告ではなく、**同じページに並んでいる作品への参照**として機能する。

### 8.3 HOW I BUILD の扱い

- **トップに残すのは lede 1 行 + リンク 1 本のみ。**
  lede: 「AI へ実装を委譲しても、理解まで委譲しない。」（`site.json: howIBuild.lede` の既存文）
- 8 step workflow 図 / roles テーブル / intent / notClaimed は**トップから除去**。
- **移設先の決定（#4 H6-6 / B-5 への回答）**: **`/about/` を新設せず、`/work/{slug}/technical/` にも置かない。**
  → **方法論ページ `/how-i-build/` を 1 枚新設する。** 理由:
  (a) 方法論は特定の作品に属さないため `/work/{slug}/technical/` に置くと所属が嘘になる。
  (b) `site.json: howIBuild` のデータ構造（workflow / roles / intent / notClaimed）はそのまま 1 ページに載る。
  (c) 既存の `HowIBuild.astro` を**そのままページへ移すだけ**で済み、#7 の作業量が最小になる。
- **データは削除しない。** `site.json: howIBuild` はそのまま維持する。

### 8.4 載せないもの

- 技術ロゴの壁
- 習熟度バー・星・パーセンテージ（検証不能な自己申告）
- 年数
- カテゴリごとの技術名を 6 個より多く並べること

---

## 9. About

### 9.1 方針

- **経歴年数・売上・利用者数・稼働条件・料金を創作しない。**（`user-fact` は本人提供がない限り書かない）
- 長い自己紹介にしない。**≤ 550px @1440**
- 役割は、作品を見た**後**に「どういう考え方で作っている人か」を補完すること

### 9.2 本文（確定案）

```
業務フローを整理し、必要な画面・API・データ構造・自動処理へ落とし込む開発をしています。

AI は目的ではなく、検索・判断支援・自動化など、業務に効果がある部分へ組み込みます。
自動処理や AI に任せる範囲と、人が判断する範囲を分けて設計します。
```

- 2 段落・4 行。copy key: `home.about.now.01` 〜 `.03`（**新規** / §13.2）
- 2 段落目 2 文目は **現行 `home.hero.lede` の前半を移設したもの**（§4.3）。新規の主張ではない。

### 9.3 前提条件（本文と分離して下に置く）

現行 `site.json: about.known` の 3 行を**そのまま維持**し、本文の下に小さく置く。

| key | 扱い |
|---|---|
| 実装形態 | 維持。ただし「AI CRM Demo は…」の 1 作品限定の記述を、**新しい Featured 構成に合わせて #7 で再確認**する |
| 公開範囲 | 維持 |
| データ | 維持。**SYNTHETIC DATA 帯の移設先の 1 つ**（§7.7） |

- `sourceRef` は **公開面に出さない**（§10）。データとしては残す。
- サイトの版（`v4`）を 1 行添える。

### 9.4 書かないこと

- 実務経験年数 / 案件数 / 売上 / 利用者数 / 稼働率
- 発注元名・顧客名・業種（Featured 01 の「保険代理店」は Q1 で確認済みの例外）
- 資格・学歴（本人提供がないため）

---

## 10. Contact

### 10.1 方針

CONTACT を**明確な conversion point**にする。現状は窓口が 0 で、URL がリンクにすらなっていない。

### 10.2 3 導線（確定）

| # | 位置 | 形 |
|---|---|---|
| 1 | **nav** | `05 CONTACT`（`site.json` の `label` を `null` → `"CONTACT"`） |
| 2 | **HERO** | secondary CTA「相談する」→ `#contact`（§4.5） |
| 3 | **page end** | 05 CONTACT の反転バンド（見出し + 呼びかけ + 連絡手段） |

### 10.3 コピー（確定案）

見出し: **業務 Web アプリ、AI 活用、業務自動化の開発相談**

本文 1 行:
```
業務課題の整理から、設計・実装・運用までご相談ください。
```

- copy key: `home.contact.h2` / `home.contact.lede`（**新規** / §13.2）

### 10.4 連絡手段

| 手段 | 扱い |
|---|---|
| **GitHub** | `github.com/youshi-kanda` — **クリック可能にする。** 現行は `<a>` が 0 個 |
| **リポジトリ** | `github.com/youshi-kanda/portfolio` — 同上 |
| **Email** | **未確定。§10.5** |

### 10.5 Email の調査結果（本書で確認した事実）

**repository 内・サイト内を全走査した結果、本人が公開連絡先として使用しているメールアドレスは 1 件も無い。**

- 走査範囲: `portfolio` repository 全体（`node_modules` / `.git` / `dist` / `.venv` を除く全ファイル）
- 検出されたアドレスは **すべて `@example.com` のテスト用フィクスチャ**（`demo@` / `sample@` / `test@` 等 19 種）
- `portfolio-site/README.md` も「連絡先は提供されていない」と明記している
- `site.json: contact.rows` は GitHub とリポジトリの 2 行のみ

**したがって: 公開意思が確認できないメールアドレスを新規に公開しない。**
本書の時点では Email を掲載せず、**GitHub を「返信できる窓口」として明示する。**

→ **#8 へ送る未決事項**（§13.4 U-01）。

### 10.6 Footer（06）

- repository リンク / サイトの版 / 最終更新
- **CONTACT とは別ブロック**にする。CONTACT が CTA、Footer が識別情報

---

## 11. Public vs Internal Content

### 11.1 公開面から外すもの（データは削除しない）

| 対象 | 現状 | 新方針 |
|---|---|---|
| `v-stage` / `v-split` / `v-terminal` | `visual.entryVariant` が DOM 属性として露出 | **公開面に出さない。** レンダラの内部選択子として使う |
| `spec CS-*` | `keyDecision.sourceRef` 等に文字列として出る | **公開面に出さない** |
| 編集指示・implementation control text | コンポーネントのコメント・コピー内に混在 | **公開面に出さない** |
| review labels / `publication.reviewStatus` | データに存在 | **公開面に出さない** |
| `sourceRef` | ABOUT・STACK・PRINCIPLES に露出 | **公開面に出さない** |
| truth / provenance の長文説明 | Evidence の provenance expander 等 | **トップに出さない。** Case Study 側には残す |
| `homepageRole` / `featuredOrder` | 内部データ | 表示しない。**削除もしない** |

### 11.2 内部で維持するもの（削除禁止）

- **Truth Gate**（`validate:content` / `check:attestation` / `scan:public` 等の検証ゲート）
- **`sourceRef`**（データとして）
- **publication review**（`reviewStatus` / `approvedBy` / `approvedAt`）
- **Evidence 機構**（`evidence/*.json` / `provenanceComplete` / `proves` / `notProves`）
- **internal notes**（`#5` の匿名 ID 対応・Human Questions）

### 11.3 原則

> **公開 Portfolio は監査文書ではなく作品 Gallery にする。**
> 検証の仕組みを弱めるのではなく、**検証の痕跡を読者の動線から外す。**
> 主張を裏付ける必要が生じたとき（Case Study / Evidence）に、同じ強度で取り出せる状態を保つ。

---

## 12. Desktop / Mobile Priority

### 12.1 Desktop（基準 1440 × 900 / 検証 1440 / 1280 / 1024）

| 優先 | 方針 |
|---|---|
| 1 | **HERO を短くする。** ≤ 600px。§3.1 の Y 配分 |
| 2 | **first viewport に Featured 01 の入り口を見せる。** 図版上端 ≤ 700px |
| 3 | **Featured の visual を大きく使う。** 広 = `.bleed` 1,296px / 狭 = `.msr` 720px |
| 4 | **text + visual の Editorial 構成。** カード grid にしない |
| 5 | rail は sticky。More Projects は罫線 register |

退避: 1280 → `--mg` 56px / 広い図版 1,168px。1024 → rail 160px・gap 40px、非対称リズム維持。
1023px 以下 → rail の sticky 解除（既存 `responsive.css` の挙動を踏襲）。

### 12.2 Mobile（基準 390 × 844 / 検証 390 / 360 / 320）

| 優先 | 方針 |
|---|---|
| 1 | **1 カラム。横スクロールを前提にしない** |
| 2 | 1 Work の並び順は **title → visual → short copy → role / tech → CTA** |
| 3 | **architecture diagram を縮小しすぎない。** 判読できない場合は簡略版を用意（§7.8） |
| 4 | **More Projects は compact list**（カードにしない。1 件 ≤ 96px） |
| 5 | MobileBar に **CONTACT を追加** |

タイポ縮小率（#4 §13.3 を踏襲）: `.dsp` 0.50 / 作品名 0.69 / `h2` 0.65 / `.lede` 0.89 / 本文 0.94。
**display を最も強く縮め、本文は据え置く。**

### 12.3 数値目標（#7 の完了判定）

| 指標 | 現行 | 目標 |
|---|---|---|
| 作品ビジュアル上端 Y @1440 | 1,044px | **≤ 700px** |
| 作品ビジュアル上端 Y @390 | 1,321px | **≤ 720px** |
| ページ全長 @1440 | 10,923px | **≤ 7,500px** |
| ページ全長 @390 | 14,112px | **≤ 9,500px** |
| トップ本文の文字数 | 4,534 字 | **≤ 2,600 字**（Work 9 件分を含む） |
| `<h2>` の数 | 3 | **≥ 6** |
| nav の CONTACT | 無 | **有** |
| F1 内の CTA | 0 | **2** |
| 1 Featured がトップで占める高さ | 3,392px | **≤ 800px** |
| 1 More Project が占める高さ | — | **≤ 120px @1440 / ≤ 96px @390** |
| F1 内の免責表示 | 有 | **無**（図版キャプションと ABOUT へ） |

---

## 13. #7 Implementation Handoff

**#7 は追加の IA 判断をしない。** 本節に列挙したものがすべての作業である。

### 13.1 確定済みで、#7 が変更してはいけないもの

1. セクション順と nav ラベル（§2.1）
2. HERO の display / supporting / role / CTA のコピー（§4）
3. Featured 5 件の順序・title・category・copy・role・selected tech（§5）
4. More Projects 4 件とその表示形式（§6）
5. Capabilities 4 カテゴリと実例の対応（§8.2）
6. ABOUT / CONTACT のコピー（§9 / §10）
7. Email を公開しないこと（§10.5）
8. Featured 02 に repository リンクを張らないこと（§5.2）
9. **`caseStudyPublished` が false の Work に Case Study CTA を出さないこと**（§5.0.1）。
   #7 で Case Study を新規制作しない。CTA を持つのは Featured 05 と More 01 の 2 件のみ
10. **`workSchema` を変更・緩和しないこと**（§13.3）。新規 Work は V4-only（`showcase` のみ）で登録する

### 13.2 #7 が越える必要のある技術的制約（本書で実地確認済み）

| # | 制約 | 現状 | 必要な対応 |
|---|---|---|---|
| **C-1** | **`B-BAND-COUNT` が featured 4 件以上で build を落とす** | `src/lib/validation/band.ts` が `BAND_PANELS = 3` を超えると **ERROR**。`EditorialBand.astro` のコメントにも「4+ で build 失敗」と明記 | **Editorial Band を廃止する**（§2.3）ため、band gate と `EditorialBand.astro` の扱いを決める必要がある。**gate の閾値を上げるのではなく、band という構成物ごと外す**のが本書の方針 |
| **C-2** | **作品別 pigment `--sig` が 3 slug 分しか無い** | `tokens.css` に `crm` / `ppm` / `dfe` の light / dark / inv、計 9 宣言 | Featured 5 件のうち pigment を持つのは `crm` のみで、**4 件が未割当**。More Projects には **pigment を割り当てない**（§6.6）ため、**`ppm` の藍と `dfe` の弁柄を Featured の 2 件へ割り当て直し、新色は 2 色の追加で足りる。** 割り当て直しと新色はいずれも art direction の判断 → 承認が要る |
| **C-3** | **無し（当初の指摘は誤りだった。§13.3 参照）** | V4 `workSchema` は `showcase` を持ち、非公開 Work をそのまま表現できる | **schema 変更は不要。** 新規 Work は V4-only 状態（`showcase` のみ）で登録する |
| **C-4** | `check:structure` が `data-hero-line` を 3 に固定 | display 3 行前提 | display 2 行化（§4.2）に合わせ**期待値を更新** |
| **C-5** | 新規コピーは承認済みコピーとして登録が必要 | `check:attestation` が `copy/shipping.json` の `publication.reviewStatus` を検査 | **新規 copy key**: `home.hero.display.01–02`（改訂）/ `home.hero.lede`（改訂）/ `home.hero.cta.primary` / `.secondary` / `home.about.now.01–03` / `home.contact.h2` / `home.contact.lede` / Featured 5 件と More 4 件の copy。**すべて `authored` として本人承認が要る** |
| **C-6** | `homepageRole = "lead"` が `crm` に付いている | Lead 構造の入力 | Lead 廃止に伴い**トップでは参照しない**。**データは削除しない**（#4 §14.4 B-4） |
| **C-7** | `public/img/` に画像が 3 枚しか無い | `crmApproved` / `ppmDash` / `dfeCli` | Featured 05 用に `portfolio-planning/assets/ai-crm/publish/` から**必要枚数を取り込む**（§7.6） |

### 13.3 新規 Work の content model（schema 変更は不要）

> **訂正。** 本書の初版は「`workSchema` が `repoPath` / `publicDemoScope` / `tests` を必須にしているため、
> `portfolio-work` という 2 つ目の record 種別が要る」と書いていた。**これは誤りである。**
> 初版は本リポジトリの外にある **V3 期の別チェックアウト**の `schema.ts` を読んで書かれており、
> 本ブランチの schema を見ていなかった。**`portfolio-work` の新設方針は撤回する。**

**事実（`src/lib/content/schema.ts` 実機確認）**

V4 の `workSchema` は `showcase` を持ち、**公開 repository を持たない Work をそのまま表現できる。**

```
showcase: {
  source: { access: 'public-repo' | 'private-repo' | 'none', path: string | null },
  demoScope: string[],                     // 既定 []。公開できるものが無ければ空でよい
  verification: { tests: {...} | null,     // 既定 null。公開できる test 実測値が無ければ null
                  verificationId: string | null }
}
```

- `repoPath` / `publicDemoScope` / `tests` は **`optional()` で LEGACY と明記されている**移行用フィールドで、
  **V4-only の Work では必須ではない。**
- `source.access` が `public-repo` 以外のとき、`path` は **`null` でなければならない**
  （`sourceSchema.superRefine`。非公開 repository の所在を public repository に書かせないための制約）。

**schema が定める 3 つの合法状態**（`workSchema.superRefine` のコメント）

| 状態 | 内容 | 本 IA での対象 |
|---|---|---|
| Legacy-only | `repoPath` + `publicDemoScope` + `tests`、`showcase` 無し | 既存 `crm` / `ppm` / `dfe`（現状のまま） |
| **V4-only** | **`showcase` のみ。legacy 3 フィールドは持たない** | **新規 6 件すべて** |
| Dual | 両方（移行中） | 使わない |

legacy 3 フィールドの**部分的な指定は refusal される**（3 つ揃って 1 つの状態）。
新規 Work は 3 つとも書かないので、この制約に当たらない。

**本書の決定（訂正版）**

> **新規 Work も既存の `work` collection を使う。`workSchema` は変更しない。緩めもしない。**
> 公開可否・demo・verification は **V4 `showcase` で正直に表現する。**

新規 6 件の `showcase` の書き方:

| Work | `source.access` | `path` | `demoScope` | `verification.tests` |
|---|---|---|---|---|
| Featured 01 / 02 / 03 / 04 | `private-repo` | `null` | `[]` | `null` |
| More 04 農業工程・勤怠管理 | `private-repo` | `null` | `[]` | `null` |
| More 02 MinIO / More 03 OCR・LLM | `public-repo` | 公開 path | 公開できる範囲を記載 | 公開できる実測値がなければ `null` |

> **Featured 02 は `private-repo` とする。** repository は public に存在するが、
> **名称に発注元名が含まれるため path を出さない**（Q11 / §5.2）。
> `access: public-repo` は `path` を必須にするので、path を出さない以上 `public-repo` とは書けない。
> **これは schema の制約ではなく、Q11 に対する正直な表現である。**

**schema 変更が要らないことの含意**: `validate:content` / `check:attestation` などの検証ゲートは
**現行のまま新規 Work に適用される。** 検証を弱めずに非公開 Work を載せられる、というのが
V4 `showcase` の設計意図そのものである（schema コメント: *「a client engagement has a repository that
exists and cannot be linked. Saying so is a fact about the work」*）。

**ただし `shipping: true` の Work には `image` と `visual` が依然として必須**
（`workSchema.superRefine`）。これは緩和対象ではなく、**§7 の visual 制作（#7）と
§13.2 C-2 の pigment 割り当てが先行する**ことを意味する。
schema コメント自身が「**顔料は 3 作品に 3 色が割り当てられており、4 件目は既定値ではなく決定である**」と
述べており、C-2 はここでも裏付けられる。

**HOW I BUILD の移設先**: `/how-i-build/` を新設（§8.3）。

### 13.4 #8 へ送る未決事項

| # | 事項 | 現状 | 決まったら何が変わるか |
|---|---|---|---|
| **U-01** | **Email を公開するか** | repository / サイト内に本人の公開用アドレスは **1 件も無い**（§10.5 で全走査済み） | 公開するなら 05 CONTACT に clipboard コピー付きで 1 行追加。公開しないなら GitHub を唯一の窓口として確定 |
| **U-02** | **Q7 — Featured 04 の権限設計は本人が起草したか** | 未回答 | 「起草した」なら Role に `Permission Design` を追加し、copy を「設計した」へ強められる（§5.4） |
| **U-03** | **Q10 — Featured 03 のアバター素材を使えるか** | 未回答。第三者の肖像・音声の可能性 | 使えない前提で §7.4 を書いた。使えるなら補助 visual の選択肢が増える |
| **U-04** | **Q17 — ポイント / 会員 Platform の 4 サービスのうち担当はどれか** | 未回答 | 確定すれば More 05 として追加でき、**決済**という未カバー領域が埋まる（§6.3） |
| **U-05** | **More 02 の tracked `cookies.txt` を、repository リンクを出す前にどう扱うか** | **`.env` 本体は More 02 / 03 のいずれにも無い**（`.env.example` 系のみ）。ただし More 02 に `admin-api/cookies.txt` / `file-api/cookies.txt` 等が tracked で存在する。**内容は取得していない** | 問題なしと確認できればリンクを出す。問題があればリンクのみ取り下げて掲載継続、または More 03 を `dfe` へ差し替え（§6.4） |
| **U-06** | **`--sig` の再割り当てと新色 2 色**（C-2） | art direction の判断事項 | 承認されれば Featured 5 件に pigment が揃う。されなければ pigment を持たない Featured を neutral で組む |
| **U-07** | **Q2 — Featured 01 の業種固有の機能名を出してよいか** | 未回答 | 出せれば copy をより具体にできる。本書は一般語で書いてある |

### 13.5 #7 の作業順（推奨）

1. `site.json` の `sections` を §2.1 の 7 要素へ更新（`contact.label` 付与 / `more` / `capabilities` / `footer` 追加）
2. 新規 6 件のレコードを **V4-only（`showcase` のみ）** で作成（§13.3）。**schema は変更しない**
3. C-1（Band 廃止）→ C-4（`data-hero-line`）→ C-2（pigment）の順でゲートを通す
4. `Hero.astro` の圧縮 + CTA 2 つ
5. `SelectedWork.astro` を Featured gallery へ再構成 / More register を分離
6. `HowIBuild.astro` → `/how-i-build/` へ移設、CAPABILITIES を新規作成
7. `About.astro` / `Footer.astro`（CONTACT 分離・URL のリンク化）
8. `MobileBar` に CONTACT 追加
9. §12.3 の 11 指標を 1440×900 / 390×844 で実測し、全項目が目標値を満たすことを確認

### 13.6 #7 が触らないもの

書体（`--f-min` / `--f-ui` / `--f-mono`）/ 色トークン（`--paper` / `--ink` / `.inv`）/
`.page` / `.tr` / `.msr` / `.bleed` のグリッド / Case Study ページと Evidence 機構 /
検証ゲートの**存在** / `site.json` の `stack` / `principles` / `evidenceSection` の**データ** /
`homepageRole` / `featuredOrder` の**データ**。

---

## 付録 A: Issue #6 Acceptance Criteria 対応

| 完了条件 | 対応 |
|---|---|
| #5 の掲載候補を前提に Work 構造を確定 | §5（Featured 5 件）/ §6（More 4 件）/ §6.5（現行 3 件の行き先） |
| トップページのセクション順を確定 | §2.1 |
| HERO で役割・強み・CTA が first viewport 内に入る設計を確定 | §3 / §4 |
| Featured / More の分離有無と表示件数を決定 | §2.1（分離する）/ §5.0（5 件）/ §6.1（4 件）/ §6.6（面積差） |
| Capabilities / About / Contact の内容を確定 | §8 / §9 / §10 |
| SYNTHETIC / internal review 表現の再配置方針を確定 | §7.7 / §11 |
| Desktop / Mobile の情報優先順位を確定 | §12 |
| #7 が追加の IA 判断なしで実装開始できる仕様になっている | §13 |

## 付録 B: 本書で変更していないもの

変更はこの設計文書 **1 ファイルのみ**。

未変更を確認済み: `portfolio-site/src/**` / CSS / Astro components / `site.json` / 作品 JSON /
`public/` / `dist/` / `.github/workflows/**` / deploy 設定 / staging / production / `main`。

顧客名・会社名・サービス名・発注元名・private repository 名・private URL・
内部ファイル名・secrets は、**本書へ一切記載していない。**
