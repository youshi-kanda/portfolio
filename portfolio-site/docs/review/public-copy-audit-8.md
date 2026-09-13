# Public Copy Audit — Issue #8

Issue: [#8 \[Phase 5\] 公開文面・CONTACT・Case Studyの閲覧者向け整理](https://github.com/youshi-kanda/portfolio/issues/8)
Branch: `issue/8-public-copy-case-study` / Base: `release/portfolio-site-v4` / Start SHA: `aaaebcc`
作業日: 2026-09-13

この文書は #8 の判断根拠である。**成果物は監査レポートではなく、公開 UI の修正そのもの**で、
本書はそれを後から検証できるようにするための記録に過ぎない。

---

## 0. Baseline（#7 完成時点 = `aaaebcc`）

`npm run qa` = **PASS**。以下は #8 着手前の実測値であり、#7 の状態と #8 の変更を分けるための基準。

> **#8 完了時点の `npm run qa` は PASS。** 公開コピーは PR #17 上で 2 回に分けて本人承認済み —
> 4 文が 2026-09-13T07:17:12Z、公開 Email 関連 3 件が 2026-09-13T07:35:52Z（§6.1）。
> 承認前は意図的に production build を止めていた。

| 指標 | 値 | 取得方法 |
|---|---|---|
| top page body copy | **3,811 字** | `dist/index.html` の `<main>` 内可視テキスト、空白を除いた文字数 |
| top page 可視日本語文字 | 1,610 字 | 同上のうち かな / 漢字 / 半角カナ |
| W-SITE-UNMANAGED | **183** 件（managed 3 / 全 186） | `npm run validate:content` |
| W-DUAL-SOURCE | **3** 件（crm / dfe / ppm） | 同上 |
| `caseStudyPublished = true` | **2** 件（crm / ppm） | `src/content/work/*.json` |
| `/work/<slug>/` routes | **3**（crm / ppm / dfe） | `astro build` |
| public repository links | **3 作品 × 4 本**（crm / ppm / dfe の Case Study CS-16） | `src/content/case-study/*.json` |
| GitHub Actions / CI links | **3 本**（各 Case Study に 1 本の run URL） | 同上 |
| CONTACT links | **2 本**（GitHub / リポジトリ。#7 でクリック可能化済み） | `dist/index.html` |
| internal-looking public strings | **下表のとおり** | 全公開ルートの走査 |

> #7 Visual Review は top body copy を 3,871 字と記録している。本書の 3,811 は
> **同じ対象を同じ方法で測り直した値**で、以降の before / after は一貫してこの測り方による。

---

## 1. Phase A — Public Copy Audit

走査対象: `/` · `/work/` · `/how-i-build/` · `/work/crm/` · `/work/ppm/` · `/work/dfe/` ·
各 `technical` · `/404.html`。

分類は #8 §3 の A〜F。**C（内部レビュー / implementation control に見える）が #8 の主対象**である。

### C — 内部レビュー / implementation control に見える（= 全件修正した）

| # | 出ていた場所 | 文字列 | なぜ外すか | 対応 |
|---|---|---|---|---|
| C-1 | 全 Case Study の節 rail と目次 | `CS-1` … `CS-16` | case study 仕様の節 ID。読者は仕様書を持っていない。spec §11.1 が公開面禁止としている | 節の**位置**（`01`…`n`）へ。anchor `#cs9` は不変 |
| C-2 | 全 Technical ページの節 rail と目次 | `T-0` … `T-8` と、その列に混ざった `CS-13` | 同上。別文書の ID が 1 つだけ紛れており、継ぎ目が読者に見えていた | 同じく位置番号へ。anchor 不変 |
| C-3 | Case Study hero（CRM / PPM / DFE） | `walkthrough` / `ledger` / `pipeline` | spine の**描画テンプレート名**。作品の性質ではない。`v-stage` 等と同じ類 | hero の readout 行ごと削除 |
| C-4 | Case Study hero | テスト件数チップ・repository path チップ | 冒頭で「この記録は検証済み」と言っている。作品の話ではない | 削除。件数は CS「品質の担保方法」、repo は「証拠へのリンク」に元からある |
| C-5 | CRM / PPM / DFE 規模の目安 | `工数 / 未計測 / 推定値を書かない` | **測定値の表に編集方針が 1 行入っている。** 読者に対する情報が 0 | 行ごと削除（3 件） |
| C-6 | CRM できること・含めていないこと | `未着手。作品全体の性質として書かない` | 同上。執筆者から校閲者への注記 | 事実の文へ書き換え |
| C-7 | CRM 規模の目安 | `grep -rho 'def test_' … \| wc -l = 480` | **shell コマンドが公開 DOM に出ている。** 数の出どころは文で言える | 「backend/apps のテスト定義を数えた静的件数 480 件」へ |
| C-8 | PPM / DFE 規模の目安 | `find src -name '*.js' = 9` 等 | 同上 | 文へ書き換え（3 件） |
| C-9 | 全 Evidence の provenance | `状態 / PUBLISH READY` | **publication review の自己判定。** spec §11.1 が公開面禁止としている | 行を削除。`evidence.status` フィールドは維持 |
| C-10 | 全 Case Study 証拠へのリンク | `公開 claim の正本 — README.md` / `CI 定義 — .github/workflows/…` | Truth System の内部語と生パス | 読者向けラベルへ |
| C-11 | PPM 規模の目安 | `tests/run-tests.js:1569（T-STATIC-2）` | 内部 locator | 事実の文へ |
| C-12 | PPM / DFE できること | `…とは書かない` / `…の範囲で書く` / `…主張しない` | 執筆方針の語り口 | 同じ事実を読者の文で |

### D — 同じ意味を別 Section で繰り返している

| # | 場所 | 内容 | 対応 |
|---|---|---|---|
| D-1 | 02 MORE 01（PPM） | `purpose` と `productType` が**どちらも説明文**で、1 行に説明が 2 本並んでいた | `productType` を #6 spec §6.1 の `Automation / 情報設計` へ、`purpose` を同 §6.1 の 1 行へ |
| D-2 | 05 CONTACT | synthetic data の注記が、figure caption 5 本・04 ABOUT `データ` 行・`/work/` の帯に続く **4 回目**として出ていた | CONTACT から削除（#8 §16）。ABOUT と caption は維持 |

### F — リンク先・CTA と文言が一致しない

| # | 場所 | 内容 | 対応 |
|---|---|---|---|
| F-1 | 05 CONTACT | 窓口が `<dl>` の 2 行だけで、**明確な CTA が 0 本** | **`メールで相談する →`（相談）と `GitHub で実装を見る →`（実装確認）の 2 本**に分けて追加（§5.5） |
| F-2 | 各 Case Study の CI 実行ログ | **サインインが必要な場合がある**が、その説明が無い | run URL がある節にだけ注記を 1 行（#8 §15） |

### A — 閲覧者向けとして残す（変更しない）

01 FEATURED WORK 全 5 件の `copy` / `Role` / `Selected technology`、03 CAPABILITIES の
4 カテゴリ、04 ABOUT 本文 3 行、00 HERO 一式、05 CONTACT の見出しとリード。

**いずれも #6（PR #15 merged）で本人が確定した文面**であり、#8 が書き換える対象ではない。
→ §2 の文字数の扱いを参照。

### B / E — 該当なし

- **B（長すぎる）**: Featured の `copy` は #6 §5.0 が「1〜2 文」と決めた上限の中にある。
- **E（事実根拠が弱い）**: Truth Gate を通っているものだけが出ているため、本 audit では 0 件。
  根拠の弱さは **新規 Case Study の可否**として現れており、§3 で扱う。

---

## 2. 文字数目標（≤ 2,600）についての報告

**達成していない。3,811 → 3,811 字（±0）。** 理由を隠さずに書く。

> **内訳**: #8 の整理で −37 字、その後 U-01 の解消で CONTACT に公開 Email と
> 相談 CTA が入って +37 字。**相談導線を得るための増加**であり、削減目標より
> Issue #8 の完了条件（「CONTACT から最低 1 つ明確な相談導線がある」）を優先した。

節ごとの内訳（`<main>` 内・空白を除く）:

| 節 | before | after | 差 |
|---|---|---|---|
| 00 HERO | 122 | 122 | 0 |
| 01 FEATURED WORK | 1,670 | 1,670 | 0 |
| 02 MORE PROJECTS | 679 | 633 | **−46** |
| 03 CAPABILITIES | 805 | 805 | 0 |
| 04 ABOUT | 309 | 317 | +8 |
| 05 CONTACT | 226 | 264 | +38 |
| **合計** | **3,811** | **3,811** | **±0** |

2,600 まで削るには 1,211 字、つまり本文の **32%** を落とす必要がある。
どこから落とせるかを実際に数えると、次の 3 つしかない。

1. **01 FEATURED WORK（1,670 字）** — 5 作品 ×（category / title / caption / copy /
   Role / Selected technology）。この `copy` は #6 spec §5.1〜5.5 の確定文面そのままで、
   Role と tech も #8 §4 が「残す」と名指ししている項目である。
2. **03 CAPABILITIES（805 字）** — 4 カテゴリの「何を任せられるか」「使う技術」「実例」。
   全文が #6 spec §8.2 の表から来ており、#8 §17 が 1 カテゴリに残せと言う 3 要素と一致する。
3. **02 MORE / 04 ABOUT / 05 CONTACT（1,176 字）** — 合計しても目標に届かない。

つまり **2,600 を満たす方法は「#6 で本人が承認した文面を捨てること」だけ**で、
それは #8 §4 の「数値達成のために意味を壊さない」と #8 §20 の禁止事項の両方に反する。
**数値ではなく重複を基準に削り、重複は 2 件しか無かった**（D-1 / D-2）という結論になる。

**PR review での決定（2026-09-13）: 3,811 字を accepted とし、Capabilities は変更しない。**

#8 §17 の「Capabilities が Featured 本文を再説明しないこと」について検討したが、
現在の 4 カテゴリの構成（**何を任せられるか → 使う技術 → 実例作品**）は
**Portfolio の横断索引として成立している** — 作品を縦に読む 01 FEATURED に対して、
能力から作品を引く経路を与えており、再掲ではなく別の入口である。

**2,600 達成のためだけに Featured / Capabilities を削らない。** 文字数目標は達成しない。

---

## 3. Phase E — 新 Featured 01〜04 の Case Study eligibility

#8 §8 のとおり、**4 件すべてに Case Study を作ることを目的にしていない。**
`caseStudySchema` が必須とする項目に対し、**merged #5 / #6 と現在確認できる source で
直接支えられるか**を 1 項目ずつ当てた。

### 3.1 判定表

`✓` = 直接根拠あり / `△` = 断片のみ / `✗` = 根拠なし（書けば創作になる）

| 必須項目 | ins-ai | hire | assist | ops |
|---|---|---|---|---|
| Business Context | ✓ | ✓ | ✓ | ✓ |
| Problem（真の業務課題） | ✓ | **✗** | △ | **✗** |
| What was built | ✓ | ✓ | ✓ | ✓ |
| Role | ✓ (Q5 回答済) | ✓ | △ (Q6) | △ (Q7) |
| Key decision + **却下した案** | ✗ | ✗ | ✗ | ✗ |
| 使う人と、いまのやり方 | ✗ | ✗ | ✗ | ✗ |
| 満たすべきこと（機能 / 制約） | △ | △ | △ | △ |
| Quality（`testsSummary` 必須） | ✗ | ✗ | ✗ | ✗ |
| Safety / Data handling | △ | △ | △ | △ |
| Technology | ✓ | ✓ | ✓ | ✓ |
| Evidence（`evidence[]`） | **✗** | **✗** | **✗** | **✗** |
| 証拠へのリンク（repository） | ✗ withheld | ✗ withheld | ✗ withheld | ✗ withheld |
| Public-safe visual | 再構成 SVG のみ | 再構成 SVG のみ | 再構成 SVG のみ | 再構成 SVG のみ |

### 3.2 全 4 件に共通する 2 つの壁

1. **Evidence が正当に作れない。** 4 件とも `evidence: []`。手元にあるのは
   Portfolio のために描いた再構成 SVG で、`Reconstructed interface / dummy data` と
   caption にも書いてある。これを `evidence/*.json` にすると
   `sourceFile` / `sha` / `dims` を持つ **製品の記録**として提示することになり、
   実物の記録ではないものを証拠として出すことになる。**作れないのではなく、作ってはいけない。**
2. **`caseStudySchema` の必須項目が創作を要求する。** `decisions` は
   *「却下した案の無い決定は決定ではなく説明である」* として `reason` を必須にし、
   `technical.testsSummary` / `architectureSummary` / `currentPractice` も必須。
   #5 / #6 はプロダクトの**内容**を記録しているが、却下案・テスト件数・
   「いまのやり方」は記録していない。埋めれば、それは調査結果ではなく創作である。

### 3.2.1 本人回答（2026-09-13）と、blocker / constraint の区別

**この会話で 2 件の Human Question に回答を得た。**

| Q | 回答 | 種別 |
|---|---|---|
| **Q5** `ANON-AI-01`（ins-ai）の生成 AI 開発環境経由コミットは本人の作業か | **YES** — 生成 AI 開発環境経由のコミットも、本人が指示・設計・実装を進めた作業 | **担当範囲の確定** |
| **Q11** `ANON-WEBAPP-01`（hire）の発注元名を出してよいか | **NO** — 発注元名は出さない | **copy constraint** |

**この 2 つを混同しないために、未決事項を 2 種類に分けて記録する。**

| 種別 | 意味 | 例 |
|---|---|---|
| **copy constraint** | **公開してよい語彙を制限する。** 制限を守った書き方をすれば公開は成立する。Case Study の可否そのものは左右しない | Q11（発注元名を出さない）／ **Q2**（業種固有機能名 — 使わなければ回避できる） |
| **hard blocker** | **回答が無いと Case Study 自体が成立しない。** 書けば設問を先取りするか、根拠の無い主張になる | **Q12**（掲載可否そのもの）／ **Q7**（ops の起草者性）／ **Q6**（assist の担当範囲）／ Evidence 不在 ／ 必須項目の根拠不足 |

**Q5 が YES になったことで、ins-ai の HOLD 理由から担当範囲が外れた。**
残る理由は §3.2 の 2 つ（Evidence 不在・必須項目の根拠不足）だけであり、
**「担当範囲が曖昧だから出せない」ではなく「Case Study として書く材料が無い」**が正しい説明になる。

**Q11 が NO で確定したことで、hire の repository link は "未回答だから保留" ではなくなった。**
#5 §9-3 が「公開 repository の名称そのものに発注元名が含まれる」と記録しているため、
**リンクを出すこと自体が回答に反する。** withheld は保留ではなく**確定した結論**である（§4）。

---

### 3.3 各 Work の判定

| Work | 判定 | 決め手 |
|---|---|---|
| **ins-ai** | **HOLD** | **§3.2 の 2 つの壁のみ** — Evidence が無く、`currentPractice` / 却下した案 / `testsSummary` 等の必須項目に直接根拠が無い。**担当範囲は blocker ではない**（Q5 回答済 → §3.2.1） |
| **hire** | **HOLD** | **Q12「匿名 Case Study として掲載するか」が未回答** — Case Study を作ってよいかを直接問う設問で、これは hard blocker。加えて §3.2 の 2 つの壁。**Q11 は回答済**（発注元名を出さない）で、これは copy constraint であり blocker ではない |
| **assist** | **HOLD** | **Q6「要件定義・プロダクト判断まで担当したか、実装のみか」が未回答。** Case Study の `decisions` は設計判断の帰属を本人に寄せる節なので、Q6 の答えが出るまで書けない。Q10（アバター素材）は U-03 により今回不使用。加えて §3.2 |
| **ops** | **HOLD** | **Q7「権限設計は本人が起草したか、受領したか」が未回答**（#8 §11 が名指し）。#5 は本 Work の Featured 理由の第 1 位を *「権限設計を成果物として見せられる数少ない Work」* としており、**Case Study を書けば必ず起草者性に触れる**。触れずに書くと Featured 理由が消える。加えて §3.2 |

### 3.4 結論

**新規公開 Case Study = 0 件。4 件とも `caseStudyPublished: false` のまま。**

#8 §10 / #6 spec §5.0.1 のとおり、**CTA は出さない。「準備中」も出さない。**
これは欠陥ではなく、#6 が *「無いものは、無いものとして何も置かない」* と決めた状態である。

**HOLD を解くのに必要なもの**（本人回答 → その後に実装）:

| Work | 必要な回答 | それに加えて必要な作業 |
|---|---|---|
| ins-ai | **なし**（本人回答は揃っている） | 公開可能な Evidence の作成方針（Q9）と、必須項目の根拠となる 1 次情報 |
| hire | **Q12** | 同上 |
| assist | Q6 | 同上 |
| ops | **Q7** | 同上 |

**Q9（実画面を使えるか）が 4 件すべての前提**である。これが決まらない限り、
どの Work も Evidence を持てず、Case Study は「確かめに行ける場所」を 1 つも示せない。

---

## 4. Phase G — Repository / GitHub / CI リンク

#8 §12 のとおり、**公開 repository であることは自動的にリンク理由にならない。**
判定は C-8 の `showcase.source.access` と `linkPolicy` の **両方**が決める
（`workSourceIsLinkable`）。

| Work | access | linkPolicy | DOM に URL | 理由 |
|---|---|---|---|---|
| crm / ppm / dfe | public-repo | **linked** | あり（Case Study 4 本ずつ） | 本 repository 内の公開デモ。`scan:public` の継続対象 |
| **hire** | public-repo | **withheld** | **なし** | **Q11 回答済 —「発注元名は出さない」。** #5 §9-3 が *「公開 repository の名称そのものに発注元名が含まれる」* と記録しているため、**repository へリンクすると repo 名から発注元名が読める。** 回答を守るには withheld が唯一の選択肢（#8 §12） |
| **minio** | public-repo | **withheld** | **なし** | #8 §13 — `cookies.txt` 系 tracked file の security 確認が未完了。**内容は取得も表示もしていない**。U-05 |
| **docai** | public-repo | **withheld** | **なし** | #8 §14 — §6.4 は現況で `.env` 本体なし・`.env.example` のみと記録しているが、**public-safe を確定できていない**。`showcase.source.path` も未記録で、リンクを出すには URL を新たに構成することになる。**不確実なので withheld 維持** |
| ins-ai / assist / ops / agri | private-repo | withheld | なし | 非公開 |

**CI リンク**: 3 本（各 Case Study の run URL 1 本）。#8 §15 のとおり、
run URL を持つ節にだけ `CI 実行ログは GitHub Actions で確認できます。閲覧には GitHub へのサインインが必要な場合があります。` を 1 行添えた。
**CI を能力の主証拠にはしていない** — 「証拠へのリンク」節の 4 本目であり、本文はこれを主役にしていない。

---

## 5. Phase H — Synthetic / disclaimer

#7 が first viewport から大型免責帯を外した方向を維持する。#8 §16 のとおり **回数を減らした**。

| 場所 | before | after |
|---|---|---|
| 01 FEATURED の各図 | `Reconstructed interface / dummy data` × 4、CRM は実画面の説明 | 変更なし。**この粒度で十分** |
| 04 ABOUT `データ` 行 | 全文 1 文 | 変更なし。#6 spec §9.3 が指定した移設先 |
| **05 CONTACT** | 全文 1 文（**4 回目**） | **削除。** 転換点の最後に置く文ではない |
| `/work/<slug>/` · その technical · `/how-i-build/` · `/404` の帯 | あり | 変更なし。その画面を修飾する節なので残す |

> **訂正**: 本書の初版と PR 本文は残る場所を「`/work/` · Case Study の帯」と書いていたが、
> **`/work/` アーカイブに `SyntheticBar` は無い**（#7 で外れている）。
> `SyntheticBar` を描画しているのは `/work/<slug>/` · `/work/<slug>/technical/` ·
> `/how-i-build/` · `/404` の 4 ルートで、`/work/` 一覧は作品を列挙するだけで画面を出さない。

Case Study 本文の `安全性とデータの扱い` に集約されている記述は、そのまま。

---

## 5.5 CONTACT の到達状態 — **U-01 RESOLVED**

**Issue #8 の完了条件「CONTACT から最低 1 つ明確な相談導線がある」は達成。**

本人が 2026-09-13 に公開用 Email を指定したことで、
**読むための導線と、相談を始めるための導線が別々に存在する**状態になった。

| 窓口 | 役割 | 表示 | href | CTA |
|---|---|---|---|---|
| **Email** | **問い合わせ・相談** | 開発のご相談 / `kanda02.1203@gmail.com` | `mailto:kanda02.1203@gmail.com` | **メールで相談する →** |
| GitHub | 実装確認 | `github.com/youshi-kanda` ／ `github.com/youshi-kanda/portfolio` | `https://github.com/youshi-kanda` | GitHub で実装を見る → |

**GitHub を問い合わせ窓口として扱っていない。** 節の構成でも語彙でも分けてある:

- Email ブロックが**先**に来る。相談したい読者が、ソースコードの説明を読み飛ばさずに済む
- GitHub ブロックは 1 行の説明（「実装例・公開コード・リポジトリは GitHub で確認できます。」）を先に置き、**読むことだけを約束する**
- CTA の重みも分けた。Email = 600 / GitHub = 400

テスト `holds the #8 strings at the wording the owner approved` が、
**GitHub 側の 2 文に「問い合わせ／連絡する／相談する／メール」が入らないこと**を検査している。

### 掲載した個人情報は Email 1 件のみ

電話番号・住所・本名の追加情報・git commit email・他の Gmail・SNS は**掲載していない。**
テスト `publishes exactly one contact address, and nothing else personal` が
**registry 全体で Email が 1 件だけであること**と、電話番号・郵便番号・SNS URL が
1 つも入らないことを検査する。

`check:structure` の **`CONTACT_EMAIL`（新規）** は、描画結果に対して
**可視の住所が 1 件だけ / `mailto:` が同じ住所を指す / GitHub 導線が残っている**ことを確認する。

---

## 6. Phase I — Copy registry

### 6.1 #8 が触った公開コピーの区分

| 区分 | 件数 | 中身 |
|---|---|---|
| **approved（#6 以前）** | 23 | 01 FEATURED / 03 CAPABILITIES / 04 ABOUT 本文 / 00 HERO。**#8 は 1 字も変えていない** |
| **#8 で変更・新規（`in_review` / 未承認）** | **4** | `home.about.h2` / `ui.contact.channels` / `ui.contact.githubCta` / `ui.caseStudy.repositoryAuthNote` |
| **internal / non-shipping** | — | `sourceRef` / `reviewStatus` / spec ID / 描画 variant 名。全部データとしては維持 |

#### 承認の経緯 — 一度捏造し、撤回し、実際の承認を取った

**初版は、実際には発生していない承認イベントを記録していた。**
4 件を `approvedBy: "user"` / `approvedAt: "2026-09-12T07:28:05Z"` として
`ISSUE-8-PUBLIC-COPY` バッチにまとめていたが、**この timestamp は Issue #8 の created_at** であり、
その時点で本人がこの 4 文を読んで承認した事実は無い（Issue 本文にこの 4 文は含まれていない）。
**`A-BATCH` が検出するために存在する種類の捏造を、`A-BATCH` が読むテーブルの中で行っていた。**

**バッチを撤回し、4 件を `in_review` に戻した。** その状態では `T-UNAPPROVED` により
production build が止まり、`npm run qa` は exit 1 になった。**この状態を報告し、承認を偽装して通さなかった。**

**その後、本人が PR #17 上で 4 文を確定・承認した。**

| | 値 |
|---|---|
| approval event | [PR #17 comment 5651891248](https://github.com/youshi-kanda/portfolio/pull/17#issuecomment-5651891248) |
| `approvedAt` | **2026-09-13T07:17:12Z**（当該コメントの created_at） |
| `approvedBy` | `user`（youshi-kanda） |
| batch | `ISSUE-8-PUBLIC-COPY (PR #17 comment 5651891248)` |

**timestamp は GitHub 上の公開レコードの投稿時刻である。** Issue の created_at でも commit 時刻でもない。
誰でもそのコメントを開いて、何が・誰に・いつ承認されたかを読める。

#### 確定した 4 文

| id | registry | 確定文面 |
|---|---|---|
| `home.about.h2` | `shipping.json` | 業務要件を整理し、設計から実装・運用まで形にする。 |
| `ui.contact.channels` | `ui.json` | 実装例・公開コード・リポジトリは GitHub で確認できます。 |
| `ui.contact.githubCta` | `ui.json` | GitHub で実装を見る |
| `ui.caseStudy.repositoryAuthNote` | `ui.json` | CI 実行ログは GitHub Actions で確認できます。閲覧には GitHub へのサインインが必要な場合があります。 |

4 段階すべてを揃えた: `APPROVAL_BATCHES` 追加 / `APPROVED_TEXT` 登録 /
registry 4 行を `approved` + `approvedBy: user` / `PENDING_APPROVAL` を空に。

#### 2 回目の承認 — 公開 Email（U-01）

| | 値 |
|---|---|
| approval event | [PR #17 comment 5651971896](https://github.com/youshi-kanda/portfolio/pull/17#issuecomment-5651971896) |
| `approvedAt` | **2026-09-13T07:35:52Z** |
| batch | `ISSUE-8-PUBLIC-EMAIL (PR #17 comment 5651971896)` |
| ids | `home.contact.emailKey` / `home.contact.email` / `ui.contact.emailCta` |

**バッチを分けた。** 1 回目に 3 件を足す方が記述は短いが、**1 回目の承認は 07:17:12Z に
住所を含まない 4 文を対象に行われた**ものであり、そこへ住所を混ぜれば承認時刻を遡らせることになる。
**1 バッチ = 1 回の機会**であり、その台帳があって初めて `approvedAt` に意味がある。
**既存 4 文の approval metadata は変更していない。**

**`home.contact.email` はこのサイト初の `user-fact` である。** 分類自体は content model 制定時から
存在していたが、該当するものが 1 件も無かった —「本人しか知らない値は、本人が提供するまで埋めない」
という規則があり、#6 の全走査でも `@example.com` のフィクスチャしか出てこなかった。
provenance matrix はこのセルに **非空の値と承認者の両方**を要求する。まさにその 2 つが、
「もっともらしい値で埋めてしまう」誘惑が生じるたびに欠けていたものである。

#### 承認機構に足したもの

- **`PENDING_APPROVAL`（空のまま維持）** — 「ブランチ上で変更されたが未承認」という状態に名前を与える。
  #8 が最初に捏造へ倒れたのは、この状態に置き場所が無かったためである。
- **`keeps every batched id approved in its own registry, with the batch by / at`** —
  `approvedCopyGate` は `shipping.json` しか見ないため、`ui.json` 側の 3 件は `A-BATCH` の比較対象外だった。
  このテストが**両 registry にまたがって**バッチと行の by / at 一致を検証する。
- **`holds the #8 strings at the wording the owner approved`** — 4 文を逐語で固定し、
  CONTACT の 2 文が「問い合わせ／連絡する／メール」等の**送信を示唆する語を含まない**ことも検査する。

### 6.2 W-SITE-UNMANAGED

| | 件数 |
|---|---|
| before | **183**（managed 3 / 全 186） |
| after | **167**（managed 2 / 全 169） |
| 差 | **−16** |

**減らし方は「登録」ではなく「そもそもコピーではないものを数えるのをやめた」である。**

| 免除した leaf | 件数 | 根拠 |
|---|---|---|
| `capabilities.categories.*.examples.*` | 13 | **作品の slug。** 既存の `work` 免除と同じ理由 — 読者が見るのは work レコードの title で、ここにあるのは参照。綴りは `capabilitiesGate` が別途守る |
| `capabilities.categories.*.key` | 3 | **カテゴリの序数（`01`…`04`）。** 既存の `index` 免除と同じ理由・同じ `valuePattern: /^\d+$/` 条件付き |

**0 にしていない理由**（残 167 件の内訳）:

| ブロック | 件数 | なぜ残るか |
|---|---|---|
| `capabilities` | 36 | 描画されている。登録するには承認イベントが要る（§6.1）。#6 承認済みだがバッチ記録が無く、**#8 が代わりに署名しない** |
| `howIBuild` | 41 | `/how-i-build/` で描画。site.json 側に *「依頼者の記述をそのまま使用」* の出所はあるが、同上 |
| `stack` | 26 | **どのルートでも描画されていない。** コンポーネントは残っているが `index.astro` から外れている |
| `principles` | 27 | 同上 |
| `evidenceSection` | 4 | 同上 |
| `about` / `contact` / `sections` / その他 | 33 | 描画されている。同上 |

つまり **57 件（stack / principles / evidenceSection）は「出荷文字列」として数えられているが、
実際にはどの公開ルートにも出ていない。** ゲートのメッセージは「出荷文字列」と言っており、
この 57 件についてはその言葉が現状と合っていない。**#8 はこれを直していない** —
コンポーネントを再び描画すれば出荷されるため、免除にするのは正しくなく、
数え方の変更は #8 の範囲を超える。**件数と理由として報告するに留める。**

### 6.3 W-DUAL-SOURCE

**3 件のまま。1 件も触っていない。**

#8 §19 が *「数字を消すためだけに触らない」* としているとおり、これは crm / ppm / dfe が
legacy フィールドと `showcase` を両方持っている移行途中の状態を指しており、
**公開文面の問題ではない。** 解消は `showcase` 一本化の作業であって #8 のスコープではない。

---

## 7. Human Questions（#8 完了時点）

| ID | 内容 | 状態 | #8 での扱い |
|---|---|---|---|
| **U-01** | 公開 Email | **RESOLVED**（2026-09-13T07:35:52Z） | 本人が `kanda02.1203@gmail.com` を **Portfolio の公開問い合わせ先**として指定・承認（[PR #17 comment 5651971896](https://github.com/youshi-kanda/portfolio/pull/17#issuecomment-5651971896)）。CONTACT に可視テキストと `mailto:` の両方で掲載し、CTA「メールで相談する」を追加。**Issue #8 完了条件「CONTACT から最低 1 つ明確な相談導線がある」は達成**（§5.5） |
| **U-02** | Q7 権限設計の起草者（ops） | **未回答（hard blocker）** | **ownership を断定していない。** ops の公開文面は #6 のまま（「先に設計として確定させ」— 主語を本人に置いていない）。**Case Study は HOLD**（§3.3） |
| **U-03** | Q10 avatar（assist） | 未回答 | 今回不使用 |
| **U-04** | Q17 ポイント基盤の担当範囲 | 未回答 | 今回掲載しないため blocker ではない |
| **U-05** | MinIO `cookies.txt` | **未確認** | **repo link は withheld 維持。ファイル内容は取得も表示もしていない。** Case Study も追加していない |
| **U-06** | pigment | #7 で現状維持決定済み | 変更なし |
| **U-07** | 業種固有の機能名 | Q1 回答済 / **Q2 未回答** | **確認できない名称を新規公開していない。** ins-ai の「保険代理店」は #6 spec §9.4 が *「Q1 で確認済みの例外」* と明記した既存表記。**Q2 は copy constraint** — 業種固有機能名を使わなければ回避でき、Case Study の hard blocker ではない |
| **U-08**（新規） | `docai` repository link の public-safe 確認 | **未実施** | withheld 維持（§4）。`.env.example` のみという §6.4 の記録は、**リンク公開の十分条件ではない** |

---

## 8. 変更していないもの

- **Truth Gate / sourceRefs / evidence IDs / publication review / attestation** — すべて内部で維持。
  1 件も削除していない。**ゲートは 1 つも緩めていない**（§6.1 — むしろ 4 件で止まっている）。
- **03 CAPABILITIES** — 変更なし。横断索引として成立しているため（§2）。
- **Hero の「相談する」** — CONTACT へ送る既存仕様を維持。変更なし。
- **既存 4 文の approval metadata**（2026-09-13T07:17:12Z）— Email 承認時に変更していない（§6.1）。
- **Hero / pigment / layout / responsive / motion timing / animation** — #8 §20 の禁止事項。変更なし。
  CSS の追加は CONTACT の 2 行（`.ct-ch` / `.ct-cta`）のみで、削除した注記と追加した CTA の
  余白を埋めるための局所調整である。
- **W-DUAL-SOURCE** — §6.3。
- **`caseStudyPublished`** — crm / ppm の 2 件のまま。**1 件も増やしていない**（§3.4）。
