# Public Copy Audit — Issue #8

Issue: [#8 \[Phase 5\] 公開文面・CONTACT・Case Studyの閲覧者向け整理](https://github.com/youshi-kanda/portfolio/issues/8)
Branch: `issue/8-public-copy-case-study` / Base: `release/portfolio-site-v4` / Start SHA: `aaaebcc`
作業日: 2026-09-13

この文書は #8 の判断根拠である。**成果物は監査レポートではなく、公開 UI の修正そのもの**で、
本書はそれを後から検証できるようにするための記録に過ぎない。

---

## 0. Baseline（#7 完成時点 = `aaaebcc`）

`npm run qa` = **PASS**。以下は #8 着手前の実測値であり、#7 の状態と #8 の変更を分けるための基準。

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
| F-1 | 05 CONTACT | 窓口が `<dl>` の 2 行だけで、**明確な CTA が 0 本** | `GitHubを見る →` を 1 本追加（#8 §6） |
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

**達成していない。3,811 → 3,773 字（−38）。** 理由を隠さずに書く。

節ごとの内訳（`<main>` 内・空白を除く）:

| 節 | before | after | 差 |
|---|---|---|---|
| 00 HERO | 122 | 122 | 0 |
| 01 FEATURED WORK | 1,670 | 1,670 | 0 |
| 02 MORE PROJECTS | 679 | 633 | **−46** |
| 03 CAPABILITIES | 805 | 805 | 0 |
| 04 ABOUT | 309 | 310 | +1 |
| 05 CONTACT | 226 | 233 | +7 |
| **合計** | **3,811** | **3,773** | **−38** |

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

**未決として残す 1 点**: #8 §17 は「Capabilities が Featured 本文を再説明しないこと」を求めている。
現在の 4 カテゴリの「何を任せられるか」は Featured の実装範囲と語彙が重なる。
ただしこれは #6 で確定した文面のため、**#8 が独断で書き換えず、PR review の判断に残す。**

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
| Role | △ (Q5) | ✓ | △ (Q6) | △ (Q7) |
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

### 3.3 各 Work の判定

| Work | 判定 | 決め手 |
|---|---|---|
| **ins-ai** | **HOLD** | 業種名は Q1 で確認済みだが、**Q2（業種固有の機能名）と Q5（生成 AI 開発環境経由 commit の帰属）が未回答**。Q5 は #5 が *「Portfolio に『担当: フルスタック / AI 実装』と書けるかはこの回答で決まる」* と明記した項目で、Case Study の `role` はまさにそれを 1 段落で書く節である。加えて §3.2 の 2 つの壁 |
| **hire** | **HOLD** | **Q12「匿名 Case Study として掲載するか」が未回答。** これは Case Study を作ってよいかを直接問う設問であり、未回答のまま作るのは設問の先取りになる。さらに Q11（発注元名）も未回答で、#5 §9-3 が *「公開 repository の名称そのものに発注元名が含まれる」* と記録している。加えて §3.2 |
| **assist** | **HOLD** | **Q6「要件定義・プロダクト判断まで担当したか、実装のみか」が未回答。** Case Study の `decisions` は設計判断の帰属を本人に寄せる節なので、Q6 の答えが出るまで書けない。Q10（アバター素材）は U-03 により今回不使用。加えて §3.2 |
| **ops** | **HOLD** | **Q7「権限設計は本人が起草したか、受領したか」が未回答**（#8 §11 が名指し）。#5 は本 Work の Featured 理由の第 1 位を *「権限設計を成果物として見せられる数少ない Work」* としており、**Case Study を書けば必ず起草者性に触れる**。触れずに書くと Featured 理由が消える。加えて §3.2 |

### 3.4 結論

**新規公開 Case Study = 0 件。4 件とも `caseStudyPublished: false` のまま。**

#8 §10 / #6 spec §5.0.1 のとおり、**CTA は出さない。「準備中」も出さない。**
これは欠陥ではなく、#6 が *「無いものは、無いものとして何も置かない」* と決めた状態である。

**HOLD を解くのに必要なもの**（本人回答 → その後に実装）:

| Work | 必要な回答 | それに加えて必要な作業 |
|---|---|---|
| ins-ai | Q2 / Q5 | 公開可能な Evidence の作成方針（Q9 の (a)〜(d) のどれを採るか） |
| hire | Q11 / Q12 | 同上 |
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
| **hire** | public-repo | **withheld** | **なし** | #5 §9-3 — **repository 名そのものに発注元名が含まれる。** Q11 / Q12 未回答（#8 §12） |
| **minio** | public-repo | **withheld** | **なし** | #8 §13 — `cookies.txt` 系 tracked file の security 確認が未完了。**内容は取得も表示もしていない**。U-05 |
| **docai** | public-repo | **withheld** | **なし** | #8 §14 — §6.4 は現況で `.env` 本体なし・`.env.example` のみと記録しているが、**public-safe を確定できていない**。`showcase.source.path` も未記録で、リンクを出すには URL を新たに構成することになる。**不確実なので withheld 維持** |
| ins-ai / assist / ops / agri | private-repo | withheld | なし | 非公開 |

**CI リンク**: 3 本（各 Case Study の run URL 1 本）。#8 §15 のとおり、
run URL を持つ節にだけ `GitHubへのサインインが必要な場合があります` を 1 行添えた。
**CI を能力の主証拠にはしていない** — 「証拠へのリンク」節の 4 本目であり、本文はこれを主役にしていない。

---

## 5. Phase H — Synthetic / disclaimer

#7 が first viewport から大型免責帯を外した方向を維持する。#8 §16 のとおり **回数を減らした**。

| 場所 | before | after |
|---|---|---|
| 01 FEATURED の各図 | `Reconstructed interface / dummy data` × 4、CRM は実画面の説明 | 変更なし。**この粒度で十分** |
| 04 ABOUT `データ` 行 | 全文 1 文 | 変更なし。#6 spec §9.3 が指定した移設先 |
| **05 CONTACT** | 全文 1 文（**4 回目**） | **削除。** 転換点の最後に置く文ではない |
| `/work/` · Case Study の帯 | あり | 変更なし。その画面を修飾する節なので残す |

Case Study 本文の `安全性とデータの扱い` に集約されている記述は、そのまま。

---

## 6. Phase I — Copy registry

### 6.1 #8 が触った公開コピーの区分

| 区分 | 件数 | 中身 |
|---|---|---|
| **approved / source-derived（#6 以前）** | — | 01 FEATURED / 03 CAPABILITIES / 04 ABOUT 本文 / 00 HERO。**#8 は 1 字も変えていない** |
| **#8 で本人の文面を採用（`ISSUE-8-PUBLIC-COPY`）** | **4** | `home.about.h2` / `ui.contact.channels` / `ui.contact.githubCta` / `ui.caseStudy.repositoryAuthNote` |
| **#8 が自分で書いた公開コピー** | **0** | — |
| **internal / non-shipping** | — | `sourceRef` / `reviewStatus` / spec ID / 描画 variant 名。全部データとしては維持 |

**「#8 が自分で書いた公開コピーが 0 件」が、この registry 整理の要点である。**
新規の 4 件はいずれも **#8 作業指示に本人が書いた文そのまま**で、
`sourceRefs` にその出所を書いてある。

- `home.about.h2` = 「業務を理解して、動く仕組みまで作る。」← #8 §5
- `ui.contact.channels` = 「開発のご相談・実装内容については、GitHubの公開情報もご確認いただけます。」← #8 §6
- `ui.contact.githubCta` = 「GitHubを見る」← #8 §6
- `ui.caseStudy.repositoryAuthNote` = 「GitHubへのサインインが必要な場合があります」← #8 §15

この site の gate は **出荷される文字列に `reviewStatus = approved` を要求する**（`T-UNAPPROVED`）。
したがって「#8 が書いた新しい文を in_review のまま出荷する」経路は**存在しない** —
出すなら承認が要り、承認が無いなら出せない。**#8 はこれを緩めず、後者を選んだ**:
自分で文を書かず、本人の文だけを採用した。

**PR merge 前に「本人承認済み」を先取りした箇所は無い。**
上の 4 件は「PR review で承認される予定」ではなく「**すでに本人が書いた文**」として記録している。
文面そのものの最終確認は PR review で行う。

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
| **U-01** | 公開 Email | **未回答** | **Email を追加していない。** 架空 CTA も作っていない。GitHub を公開窓口として構成し、`channels` は「公開情報を確認できる」と言うに留め、**受信箱があるとは言っていない** |
| **U-02** | Q7 権限設計の起草者（ops） | **未回答** | **ownership を断定していない。** ops の公開文面は #6 のまま（「先に設計として確定させ」— 主語を本人に置いていない）。**Case Study は HOLD**（§3.3） |
| **U-03** | Q10 avatar（assist） | 未回答 | 今回不使用 |
| **U-04** | Q17 ポイント基盤の担当範囲 | 未回答 | 今回掲載しないため blocker ではない |
| **U-05** | MinIO `cookies.txt` | **未確認** | **repo link は withheld 維持。ファイル内容は取得も表示もしていない。** Case Study も追加していない |
| **U-06** | pigment | #7 で現状維持決定済み | 変更なし |
| **U-07** | 業種固有の機能名 | Q1 のみ確認済み / **Q2 未回答** | **確認できない名称を新規公開していない。** ins-ai の「保険代理店」は #6 spec §9.4 が *「Q1 で確認済みの例外」* と明記した既存表記 |
| **U-08**（新規） | `docai` repository link の public-safe 確認 | **未実施** | withheld 維持（§4）。`.env.example` のみという §6.4 の記録は、**リンク公開の十分条件ではない** |

---

## 8. 変更していないもの

- **Truth Gate / sourceRefs / evidence IDs / publication review / attestation** — すべて内部で維持。
  1 件も削除していない。
- **Hero / pigment / layout / responsive / motion timing / animation** — #8 §20 の禁止事項。変更なし。
  CSS の追加は CONTACT の 2 行（`.ct-ch` / `.ct-cta`）のみで、削除した注記と追加した CTA の
  余白を埋めるための局所調整である。
- **W-DUAL-SOURCE** — §6.3。
- **`caseStudyPublished`** — crm / ppm の 2 件のまま。**1 件も増やしていない**（§3.4）。
