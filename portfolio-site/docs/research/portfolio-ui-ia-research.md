# エンジニア向け Portfolio の UI / IA 調査とデザイン方針

Issue: [#4 \[Phase 1\] エンジニア向けポートフォリオのUI/IA調査とデザイン方針策定](https://github.com/youshi-kanda/portfolio/issues/4)
Branch: `issue/4-ui-ia-research`（base: `release/portfolio-site-v4`）
調査日: 2026-09-12
対象: `portfolio-site`（V4 / `release/portfolio-site-v4` の `dist/` ビルド）

このドキュメントは **Research / Design specification** である。実装変更は含まない。

---

## 0. 計測方法（この文書の数値の出どころ）

推測を混ぜないため、すべての数値は実測値である。

- Chrome 150 (headless) を CDP 経由で操作し、各サイトを **1440 × 900** および **390 × 844** で読み込んだ。
- 各ページで `getBoundingClientRect()` / `getComputedStyle()` を実行し、first viewport 内の要素位置・font-size・font-family・色・border-radius、および `document.body.scrollHeight`、`img`/`video`/`canvas` の実寸を取得した。
- スクリーンショットは viewport 実撮。
- 現行 `portfolio-site` は `dist/` を `http://127.0.0.1:4321/` で配信して同じ手順で計測した。

計測できなかった項目は「未計測」と明記する。CSS を読まずに推測した記述はこの文書には無い。

**制約**: JS で連続アニメーションしているページ（emilkowal.ski / lynnandtonic.com / olaolu.dev / jarocki.me / bruno-simon.com 一部）は `captureScreenshot` がフレーム安定待ちでタイムアウトした。これらは DOM 実測値のみを根拠にしており、視覚的印象に踏み込んだ評価は避けている。

---

## 1. Executive Summary

### 結論

現行サイトの問題は「デザインが弱い」ことではない。**情報の並び順と面積配分が、ポートフォリオではなく技術報告書のもの**であることだ。

実測すると、現行トップページは:

| 指標 | 現行 | 調査 15 件の中央値付近 |
|---|---|---|
| ページ全長（1440幅） | **10,923 px** | 1,247 – 5,717 px |
| ページ全長（390幅） | **14,112 px**（= 16.7 画面） | 3,194 px（seanhalpin, = 3.8 画面） |
| 最初の作品画像の Y 座標（1440） | **1,044 px**（fold の 144px 下） | 0 – 500 px |
| 最初の作品画像の Y 座標（390） | **1,321 px**（1.6 画面下） | 113 px（seanhalpin） |
| トップページ本文の文字数 | **4,534 字** | — |
| `<h2>` の数 | **3** | — |

つまり **First viewport に作品が一切無く、モバイルでは 1.6 画面スクロールしないと製品画面が現れない**。そのうえページは同種サイトの 2〜10 倍の長さがある。

さらに面積配分が逆転している:

| セクション | 高さ (1440) | 比率 |
|---|---|---|
| 00 HERO | 783 px | 7% |
| Editorial Band（作品サムネ 3 枚, 高さ 112px） | 378 px | 3% |
| 01 WORK 見出し | 332 px | 3% |
| Lead work entry（CRM 1 件のみ） | **3,392 px** | **31%** |
| Work index（3 件） | 2,277 px | 21% |
| 02 HOW I BUILD（方法論・作品なし） | **2,220 px** | **20%** |
| 03 ABOUT | 783 px | 7% |
| CONTACT | 441 px | 4% |

**作品を 1 件も含まない方法論セクションが、ページの 20% を占め、しかも作品と Contact の間に挟まっている。** 採用担当者・発注者の導線上、最も価値の高い位置に、最も判断に使われない情報が置かれている。

### 推奨

IA 案 **A「Editorial Gallery」** を採用する（§10）。要点:

1. **First viewport に製品画面を入れる。** HERO を 783px → 約 560px に圧縮し、作品帯を fold の内側へ上げる。
2. **3 作品を等価に扱う。** 作品が 3 件しか無い状態で Featured / More Projects を分けるのは、調査結果から見て逆効果（§5-C）。Lead 1 件に 31% を割く現在の構成をやめ、3 件を同じ大きさの Gallery として並べる。
3. **HOW I BUILD をトップから外し、CAPABILITIES へ圧縮する。** 方法論は Case Study 側の資産として残す。
4. **CONTACT を CTA にする。** 現在は nav にリンクすら無く、暗転フッターに GitHub 行が 2 行あるだけ。
5. **Art Direction は捨てない。** 明朝ディスプレイ・紙/インク・作品別 pigment・罫線・rail は調査で有効性が裏付けられた（§6）。変えるのは**順序と面積**であって語彙ではない。

---

## 2. 現行 Portfolio の課題（実測ベース）

`http://127.0.0.1:4321/`（`dist/`）を 1440×900 / 390×844 で計測した結果。

### 2.1 First viewport（1440 × 900）に作品が無い

DOM 実測での F1 の構成は上から:

1. Nav — `youshi-kanda` + kicker + `01 WORK` / `02 HOW I BUILD` / `03 ABOUT`（**CONTACT リンク無し**）
2. `SYNTHETIC DATA / DEMO` 帯 — 「掲載している画面はすべて合成データです。実顧客・実案件・本番運用の記録ではありません。」
3. rail: `00` / ソフトウェアエンジニア / 業務システム・自動化・AI活用 / capability 3 組
4. display: 明朝 5 行（`min(90px, 8.65cqi)`）
5. stack line（緑）: `Python / Django · TypeScript / React · Google Apps Script · Node.js`
6. lede: 2 行

**画像・スクリーンショット・図版は 0 件。** 最初の `<img>` は y = 1,044px、fold の 144px 下にある Editorial Band のサムネイルである。

> **なぜ問題か（First View / Project discovery）**
> 調査した 15 件のうち、First viewport に何らかの作品ビジュアルが入っているのは ryanmulligan.dev（ギャラリーそのものが hero）、seanhalpin.xyz（カード上端が y=642 で fold 内）、adhamdannaway.com（人物＋直下に Work カード）、samuelkraft.com（Projects プレートが y=511）、maximeheckel.com（hero 自体が WebGL 作品）、leerob.com（464×801 の映像）の 6 件。
> 逆に brittanychiang.com は 1440 でも 390 でも作品画像がずっと下（390 では y=3,401）にある。つまり「作品を F1 に入れない」構成は実在するが、**それはテキストで職歴と実績を語り切れる人の構成**である。現行サイトは「合成データの業務システムを個人開発で作った」という、**画面を見せないと伝わらない**性質の作品を扱っている。ここで画像を後ろに置くのは不利が大きい。

### 2.2 F1 の 2 番目の要素が免責表示である

`SYNTHETIC BAR` は nav 直下、display より上にある。390px 幅では 2 行に折り返し、844px の画面のうち約 70px を占める。

内容自体は残すべき誠実さだが、**「この人は何ができるか」より先に「これは本物ではありません」を読ませる**のは、情報階層として自己申告の減点から始めていることになる。調査 15 件中、免責・注記を F1 に置いているサイトは 0 件（marcusmayo の GitHub Pages が MIT ライセンスの badge を上部に出しているのが最も近いが、これは §7 で採用しない例として挙げる形式）。

### 2.3 ページが長すぎる

- 1440: 10,923 px
- 390: **14,112 px** — 844px の画面で **16.7 画面分**

比較（すべて実測 / 1440 幅）:

| サイト | 全長 |
|---|---|
| jarocki.me | 900 px（スクロール無し） |
| lynnandtonic.com | 900 px（スクロール無し） |
| leerob.com | 1,247 px |
| olaolu.dev | 1,647 px |
| emilkowal.ski | 2,480 px |
| seanhalpin.xyz | 3,319 px |
| brittanychiang.com | 3,860 px |
| samuelkraft.com | 5,167 px |
| blog.maximeheckel.com | 5,717 px |
| **現行 portfolio-site** | **10,923 px** |

現行サイトは調査対象で最長である。2 位の maximeheckel（記事 index を数十件持つブログ）の 1.9 倍。**作品 3 件で 10,923px は、1 作品あたり 3,600px 使っている**ことを意味する。

### 2.4 1 作品に 31%、方法論に 20%

Lead work entry（`#w-crm`）は 3,392px（390 幅では 4,199px = 5 画面）。ほかの 2 作品は index の 1 行である。読者から見ると「3 作品ある」と言いながら実際には 1 作品の詳細ページがトップに埋め込まれている。

`02 HOW I BUILD` は 2,220px（390 幅で 2,508px = 3 画面）。内容は 8 ステップの workflow、3 レーンの図、roles テーブル、intent 3 項目、notClaimed 2 項目。**作品画像は 1 枚も無い。**

### 2.5 Contact が CTA になっていない

- nav に CONTACT が無い（`site.json` の `sections` で `label: null`）
- フッターは `dl` 2 行（GitHub / リポジトリ）のみ
- メールアドレス、フォーム、「相談する」に相当する動詞が無い

調査 15 件では、Email を明示しているのが emilkowal.ski / samuelkraft.com / jarocki.me / rauno.me（クリックで clipboard コピー、`Copied` 表示）/ adhamdannaway.com（nav に `contact`）/ seanhalpin.xyz（nav に `Contact` ボタン）/ olaolu.dev（`Contact me` ボタンが y=724、F1 内）。**副業案件獲得を目的に含めるなら、現行は導線が欠落している。**

### 2.6 見出しが 3 つしかない

ページ全体の `<h2>` は 3 つ:

1. 何のためのサービスを、どこまで実装したのか。
2. Human-Orchestrated / Spec-Driven / Agentic Development
3. リポジトリから確認できることだけ。

10,923px を 3 つの見出しで分割している。採用担当者は読まずに **走査する**。走査の足がかりが 3 箇所しかない。

### 2.7 Editorial Band のサムネイルが小さすぎる

実測: 448×112 / 355×112 / 257×112。高さ 112px では業務システムの画面は「何かの表」以上には読めない。**証拠として機能せず、装飾として機能している。**

対して samuelkraft.com は 626×413 のプレート、seanhalpin.xyz は 491–819 × 550 のカード、ryanmulligan.dev は最大 358×358 のタイルを使っている。

---

## 3. 参考サイト一覧

実在確認済み。すべて 2026-09-12 に実機読み込みで確認。

| # | サイト / 氏名 | URL | 職種・ポジション | デザイン方向 |
|---|---|---|---|---|
| 1 | Brittany Chiang | https://brittanychiang.com/ | Senior Frontend Engineer (Accessibility), Klaviyo | Dark / sticky split / editorial list |
| 2 | Lee Robinson | https://leerob.com/ | Engineer & writer, ML at SpaceX (ex-Vercel) | Editorial serif / index page |
| 3 | Rauno Freiberg | https://rauno.me/ | Interaction designer, Vercel / Devouring Details | Graphic / 2D 横スクロール canvas |
| 4 | Emil Kowalski | https://emilkowal.ski/ | Design Engineer, Linear (ex-Vercel) | Hyper-minimal 単一カラム |
| 5 | Lynn Fisher | https://lynnandtonic.com/ | Designer for the Web | Display type 1 画面表紙 |
| 6 | Bartosz Jarocki | https://jarocki.me/ | Software Engineer | 名刺型 1 画面 / dark |
| 7 | Anand Chowdhary | https://anandchowdhary.com/ | Head of Product / founder | Data dashboard / `/NOW` `/LIFE` |
| 8 | Olaolu Olawuyi | https://olaolu.dev/ | Software Engineer, Shopify | 全幅テキスト / 1 文 H1 |
| 9 | Ryan Mulligan | https://ryanmulligan.dev/ | Front-end builder / creative dev | 作品ギャラリーが hero |
| 10 | Adham Dannaway | https://www.adhamdannaway.com/ | Product designer & front-end developer | 分割ポートレート / 二面性 |
| 11 | Seán Halpin | https://www.seanhalpin.xyz/ | Product Designer | **Editorial Gallery / 大型カラーカード** |
| 12 | Bruno Simon | https://bruno-simon.com/ | Creative Developer (3D) | 全画面 WebGL ゲーム |
| 13 | Maxime Heckel | https://blog.maximeheckel.com/ | Creative / graphics engineer | WebGL hero + 年別記事 index |
| 14 | Samuel Kraft | https://samuelkraft.com/ | Design Engineer, Raycast | 極小タイポ + 大型作品プレート |
| 15 | Marcus Mayo | https://marcusmayo.github.io/machine-learning-portfolio/ | ML / AI Engineer | GitHub Pages README 型 |
| 16 | Henry Heffernan | https://henryheffernan.com/ | Creative Developer (3D) | CRT OS シミュレーション |
| 17 | Josh W. Comeau | https://www.joshwcomeau.com/ | Front-end educator / developer | イラスト hero + blog + sidebar |

### 調査したが対象外としたもの（記録）

| サイト | URL | 状態 |
|---|---|---|
| Cassie Evans | https://cassie.codes/ | **ポートフォリオを終了**。全画面 WebGL 背景に「Thanks for reading.」の別れの告知と LinkedIn / Discord リンクのみ。作品・IA は存在しない |
| Jacek Jeznach | https://jacekjeznach.com/ | **ドメインがパーク済み**。`<title>Redirecting...</title>`、日本語のカテゴリリンク集（自動車 / 不動産 / 旅行 …）。ポートフォリオではない |

いずれも「有名なポートフォリオ」として言及されることがあるが、2026-09-12 時点では参照できない。憶測で内容を書かないためここに記録する。

---

## 4. 各サイト分析

各項目の数値は 1440×900 実測。「採用しない点」は嗜好ではなく、**このポートフォリオの目的（採用 / 副業獲得・作品 3 件・業務システム）に対して**の判断である。

---

### 4.1 Brittany Chiang — https://brittanychiang.com/

**職種**: Senior Frontend Engineer (Accessibility), Klaviyo
**デザイン方向**: ダークネイビー `#0F172A` / 本文 `#94A3B8` / Inter 16px/26px / 全長 3,860px

**HERO（F1）**: 左カラムに氏名 48px bold（y=90）、職種 `Frontend Engineer` 20px、価値提案 1 文「I build accessible, pixel-perfect experiences for the web.」16px。その下に in-page nav（ABOUT / EXPERIENCE / PROJECTS、12px・アクティブ項目の罫線が伸びる）。ソーシャルアイコン 5 個を左カラム下端に固定。**左カラムは sticky、右カラムだけがスクロールする。** 右カラムは F1 時点で About の本文が始まっている。作品画像は F1 に無い。コピー量は氏名＋職種＋1 文で約 60 字。

**PROJECT**: Featured 4 件。各行は 140×79 のサムネイル＋タイトル＋説明＋技術 pill。Case Study への遷移は無く外部リンク（GitHub / 公開ページ）。Experience は 6 件で、左に年レンジ（`2024 — PRESENT`、12px 大文字）、右に役職・会社・説明・技術 pill という **rail + 内容** の構造。

**UI**: 2 カラム固定（左 x=121 幅 561、右 x=697 幅 607）。`<svg>` 29 / `<img>` 9 / video 0 / canvas 0。hover で罫線が伸びる、リンク色が teal に変わる。scroll animation は控えめ。

**Mobile（390×844 実測）**: **`nav { display: none }`** — セクション nav を完全に落とす。氏名 36px（desktop の 0.75）、職種 18px、1 文 16px、ソーシャル 5 個が y=224。**最初の作品画像は y=3,401px（4 画面下）。** 全長 5,387px。

**採用したい点**
- **Sticky identity column + scrolling content column.** 誰のページかが常に画面内にある。視線誘導として、スクロール中に「今どの節か」を左の rail が示し続ける。現行サイトの `.tr` は `200px + 1fr` の rail 構造をすでに持っており、**sticky 化だけで同じ効果が得られる**（構造変更が小さい）。
- **年レンジを左 rail に置いた register 行。** Experience / Projects が同じ骨格で並ぶので、走査コストが一定になる。
- **価値提案を 1 文・16px で置く**（氏名 48px との差は 3 倍）。氏名を大きくし、主張は小さく、という配分。

**採用しない点**
- **About を作品より先に、長文で置く構成。** 右カラムは F1 で About 本文から始まり、Projects は 390px 幅で y=3,401px。現行サイトが抱えている問題とまったく同じで、これを真似すると悪化する。彼女の場合は Klaviyo / Apple という**社名そのものが証拠**なので成立するが、個人開発の合成データデモには使えない。
- **サムネイル 140×79。** 業務システムの画面はこの寸法では読めない。
- **Case Study 導線が無い。** 現行サイトの最大の資産（検証つき Case Study）を殺す構造。

**応用方法**
現行の `.tr > .ins`（200px rail）を `position: sticky; top: <nav高>` にし、rail に「節番号・節名・現在位置」を持たせる。Brittany の左カラムに相当する役割を、すでにある rail に与える。ただし**中身の順序は逆にする**（About ではなく Work を先に流す）。

---

### 4.2 Lee Robinson — https://leerob.com/

**職種**: Engineer & writer、SpaceX で ML（前職 Vercel / Next.js）
**デザイン方向**: 白 `#FFF` / 本文 `#282828` / **Iowan Old Style, Palatino, Georgia（セリフ）17px / 27.2px** / 全長 **1,247px**

現行サイトの本文設定（17px / line-height 1.9、Source Serif 4 + Noto Serif JP）と**ほぼ同一の組版**である点が重要。

**HERO（F1）**: 左 x=49 に `@leerob` 42.4px セリフ 600。右 x=916 に **464×801 の video（poster 画像つき）** — 都市と花畑のイラストで、内容とは無関係の雰囲気画像。ページの縦のほぼ全部を占める。

**Bio**: `Bio` ラベルの右に **`Default` / `Long` のトグルボタン**（14px, sans）。既定は 3 行 + 3 行の 2 段落。

**PROJECT**: **作品セクションが無い。** あるのは `Notes`（2 カラムのリンク一覧 10 件）と `Blogs`（罫線区切りの行、左にタイトル・右に `July 2026` の日付）。`<a>` 22 / `<img>` 1 / video 1。

**UI**: 左カラム 600px 固定、右カラムは画像。grid ではなく 2 ブロック。hover 表現は下線のみ。scroll animation 無し。

**採用したい点**
- **Bio の Default / Long トグル。** About の長文問題に対する直接の解。既定は 3 行、読みたい人だけが展開する。現行 ABOUT の 3 行 × `sourceRef` 付きは「検証可能だが長い」ので、**既定を短く・詳細を展開**に変えれば誠実さを落とさず F1 の負荷を下げられる。
- **Blogs の register 行**（タイトル左・日付右・罫線区切り）。現行 `Register.astro` が既に持つ形で、調査した複数サイトで再出現した（§5-D）。
- **17px セリフ・行間 1.6–1.9 の本文が「読み物として上等」に見えること**の実例。現行の組版判断を変える理由は無い。

**採用しない点**
- **作品セクションを持たない構成。** Lee は「Vercel の DX を作っていた人」という文脈が先にあるので index ページで足りる。無名の個人開発者がこれをやると何も残らない。
- **内容と無関係の雰囲気画像で右半分を埋める。** 現行サイトの作品（業務画面）を置ける場所を装飾に使うのは、この目的では損失。

**応用方法**
ABOUT を「既定 3 行 + 展開で `sourceRef` と詳細」に変更。右半分の大型ビジュアル枠という**レイアウトの型**は採用し、中身を雰囲気画像ではなく**作品画面**に差し替える（= §4.11 seanhalpin の考え方と合流）。

---

### 4.3 Rauno Freiberg — https://rauno.me/

**職種**: Estonian interaction designer, Vercel / Devouring Details
**デザイン方向**: `#EDEDED` グレー地 / 黒 / neo-grotesque（カスタム `X`）/ **2D スクロール canvas（scrollWidth 6,648 × scrollHeight 6,108）**

**HERO**: **H1 は 32px しかない。** 「Rauno Freiberg is an Estonian interaction designer working with Vercel and Devouring Details」という一文を 771px 幅に組み、そこに巨大な黄色い円（CSS 図形）を重ねる。一方で **セクション見出し（`DD` / `Craft` / `Projects`）が 720px** という display サイズ。

つまり**ヒエラルキーが反転している**: 名前と肩書きは小さく、ナビゲーション語彙が display になっている。

**PROJECT**: 横方向のスライド。`Craft` `Projects` `History of Software Design` `Field Notes` が横に並ぶ。`<a>` 12 / `<img>` 0 / video 0 / canvas 0 — **画像を 1 枚も使わずタイポと CSS 図形だけで構成**。

**CONTACT**: `Twitter` / `Email` / `GitHub` を 85px で組む。Email はクリックで clipboard にコピーし `Copied` に差し替わる。

**採用したい点**
- **Email = クリックでコピー + `Copied` フィードバック。** mailto: を開かせない。実装コストが低く、Contact の摩擦を確実に下げる。
- **「名前を大きくしない」判断が成立しうる**という実例。現行サイトは既に display を**名前ではなく一文**に使っており（`業務の課題を整理し、…`）、この判断は調査で支持される（§4.8 olaolu も同型）。

**採用しない点**
- **横スクロールを主動線にする。** 採用担当者・発注者はスクロールの向きを学習しない。Project discovery のコストが跳ね上がる。keyboard / スクリーンリーダの走査順とも一致しない。
- **画像 0 枚。** インタラクションデザイナは「サイトそのものが作品」で成立するが、業務システムは画面を見せる必要がある。
- **セクション名を 720px にする。** 内容ではなく目次が主役になる。

**応用方法**
Email コピー UX のみ CONTACT に導入。レイアウト言語は採用しない。

---

### 4.4 Emil Kowalski — https://emilkowal.ski/

**職種**: Design Engineer, Linear（前職 Vercel Design）
**デザイン方向**: `#FDFDFC` / 黒 / sans 16px / 単一カラム 644px（x=391）/ 全長 2,480px

**HERO**: **`<h1>`〜`<h3>` が 0 個。** 氏名 `Emil Kowalski` は 16px のリンク（y=117）。y=333 から本文 2 段落:「I work on the Web team at Linear…」「Previously, I worked on the design team at Vercel.」

**PROJECT**: 4 行。各行 668×72 で「名前 + 一文」だけ:
- `aiforui.dev` — AI for Designers and Engineers.
- `Sonner` — An opinionated toast component for React.
- `animations.dev` — A course on web animations.
- `Vaul` — A drawer component for React.

**`<img>` 0 / video 0 / canvas 0。`<a>` 18。**

**採用したい点**
- **作品 1 件 = 名前 + 一文。** 説明を 1 文に固定すると、4 件が 288px に収まり比較可能になる。現行 `Register` の行は `problem` / `implementationScope` / `proves` / `meta` / `detail` と 5 ブロックあり、1 行が数百 px ある。**index に限っては 1 文に落とす**のが走査効率として正しい。

**採用しない点**
- **画像ゼロ。** Sonner / Vaul は npm で数百万 DL される既知のライブラリなので名前が証拠になる。合成データの業務システムには同じ前提が無い。
- **見出しタグを一切使わない。** アクセシビリティと SEO の両方で不利。現行サイトは `check:structure` で見出し構造を担保している方針であり、これを崩す理由が無い。

**応用方法**
Work index（Register）の 1 行を「番号 / タイトル / 製品種別 / **purpose 1 文** / 言語 / Case Study →」に減量する。`problem` と `proves` は Case Study 側へ。

---

### 4.5 Lynn Fisher — https://lynnandtonic.com/

**職種**: Designer for the Web
**デザイン方向**: クリーム `#E4E2D7` / 黒 / カスタム display（`Hubano-Rough`）/ **全長 900px = スクロール無し**

**HERO = ページ全体**: 氏名 96px（display、x=502 幅 436）、`Designer for the Web` 24px、その下に 6 リンクを縦積み（`ABOUT` / `WORK` / `THOUGHTS` / `ARCHIVE` / `RSS` / `GIFS`、16px）。最下部に `v. XIX`（サイトのバージョン）と mode トグル。`<a>` 7 / `<img>` 0 / `<svg>` 1。

**トップページに作品が 1 件も無い。** WORK は別ページ。

**採用したい点**
- **サイトのバージョンを明示する（`v. XIX`）。** 継続して作り直していることが一目で伝わる。現行サイトは V3.1 → V4 と実際に版を重ねており、これは事実として書ける。
- **クリーム地 + 黒 + 大型 display** が「編集物」として成立することの実例（現行の `--paper:#F4F2ED` / `--ink:#15171A` と同じ方向）。

**採用しない点**
- **トップを表紙だけにする。** 作品ページへの 1 クリックを全員に強制する。採用担当者は 1 クリックを惜しむ。Conversion の観点で不利。
- **6 つの並列リンク。** 優先順位が無い。

**応用方法**
採用しない。ただし「クリーム地に大型 display が耐える」という一点の裏付けとして扱う。

---

### 4.6 Bartosz Jarocki — https://jarocki.me/

**職種**: Software Engineer
**デザイン方向**: 黒 `#000` / `#D4D4D8` / Geist Sans 16px / 544px カラム（x=448）/ **全長 900px = スクロール無し**

**HERO = ページ全体**: 28px のアバター画像 + **氏名が 16px（本文と同サイズ）**。一文:「exploring what software engineering looks like when agents do most of the typing.」そのあと 13px のリンクが 4 つ（`notes` / `work` / `about` / `email`）。`<a>` 6 / `<img>` 1。

**採用したい点**
- **一文で立ち位置を宣言する。** 「AI エージェントが大半をタイプする時代のソフトウェアエンジニアリングを探っている」——これは現行サイトの `HOW I BUILD`（Human-Orchestrated / Spec-Driven / Agentic Development）が 2,220px かけて言っていることと、**主張としてはほぼ同じ**である。1 文で言えるものに 2,220px を使っている、という比較材料になる。
- `email` を主要 4 リンクの 1 つに入れている。

**採用しない点**
- **氏名を本文サイズにし、作品を 0 件にする。** 極端に削ると、既に知られている人にしか機能しない。

**応用方法**
**HOW I BUILD の圧縮の目標値。** 方法論は「AI へ実装を委譲しても、理解まで委譲しない。」の 1 行（既に `site.json` の `howIBuild.lede` にある）＋ 3 ロールの 1 行まで削り、詳細は Case Study / 別ページへ。

---

### 4.7 Anand Chowdhary — https://anandchowdhary.com/

**職種**: Head of Product / 連続起業家 / GitHub Star
**デザイン方向**: 白地 / sans / 手書き署名を mark に使用 / モノスペースの `/NOW` `/LIFE` セクションラベル

**HERO**: 中央に**手書き署名の画像**のみ。y=301 に `/NOW` ラベル（モノスペース、大文字）、その下に**箇条書き 4 行**:

1. Building **Sycamore**, the enterprise OS for autonomous AI agents, as Head of Product and founding team member.
2. Previously, founded and sold **FirstQuadrant**, an AI sales platform…, funded by **Y Combinator**.
3. Contributing to open source… as an award-winning **GitHub Star**.
4. Advising startups, angel investing and doing nonprofit work…

各項目にサービスのファビコンが inline で入る。y=701 から `/LIFE`: 8 枚のデータタイル（年齢 28.7241924 歳 / 所在地と現地時刻 / 今年のテーマ / 今日の歩数 / 睡眠 8.2h / 摂取カロリー / 最近よく聴くアーティスト / GitHub contributions）。すべて API 由来の実データ。

**採用したい点**
- **`/NOW` の 4 行構造。** 「今なにをしているか → 過去に何を出したか → 継続して何をしているか → 周辺で何をしているか」。**5 秒で経歴が読める。** 現行 ABOUT（実装形態 / 公開範囲 / データ）は「作品の前提条件」の説明であって、**本人の現在地が書かれていない**。ここは補える。
- **モノスペースの `/`付きセクションラベル。** 現行の rail ラベル（`--f-mono` 11px letter-spacing .2em 大文字）と同じ役割で、既存語彙と衝突しない。

**採用しない点**
- **ライフログのタイル。** 歩数・睡眠・カロリーは採用判断・発注判断に無関係で、作品の前に置くと本題を薄める。
- **作品のスクリーンショットが 1 枚も無い。** 社名・YC・GitHub Star が証拠として効く人の構成。

**応用方法**
ABOUT を「前提条件の列挙」から **「/NOW 型の 3〜4 行」＋展開で前提条件** に組み替える。現在の 3 行（実装形態・公開範囲・データ）は削らず、**順序として後ろ**にする。

---

### 4.8 Olaolu Olawuyi — https://olaolu.dev/

**職種**: Software Engineer, Shopify（15 年）
**デザイン方向**: `#F5F4FC` 薄紫 / `#474747` / sans 20px / **本文カラムが 1,246px（x=89、ほぼ全幅）** / 全長 1,647px

**HERO（F1）**: kicker `HEY, I'M OLAOLU` 15.84px（y=226）→ **H1 = 「A Software Engineer building fast, resilient web products at scale.」30.24px**（y=294）→ 16px の段落 4 つ（経歴 / Shopify での担当 / コンサル時代 / 車の趣味）→ **`Contact me` ボタン 20px が y=724**（= F1 内）。画像 0。

**採用したい点**
- **H1 が氏名ではなく「職種 + 何を + どの規模で」の 1 文。** 現行サイトの display（`業務の課題を整理し、画面・API・データ・自動処理へ落とし込み、動く仕組みとして設計・実装する。`）と**同じ設計判断**。調査で複数回再出現した（rauno / olaolu / 現行）ので、**この判断は維持してよい**。
- **`Contact me` が F1 内（y=724 / 900）にある。** 読者が「この人だ」と思った瞬間に押せる位置に CTA がある。現行は 10,482px まで行かないと Contact が無い。

**採用しない点**
- **本文カラム 1,246px。** 1 行が長すぎて Readability を損なう（現行の `.msr` = 720px の方が正しい）。
- **自己紹介 4 段落を F1 に詰める。** 作品が 1 枚も見えない。

**応用方法**
HERO 直下、fold の内側に **primary CTA（作品を見る）+ secondary（連絡する）** を置く。display の一文設計は現状維持。

---

### 4.9 Ryan Mulligan — https://ryanmulligan.dev/

**職種**: Front-end builder / creative developer
**デザイン方向**: 白 / セリフ寄り sans / 上部に nav（Home / Blog / RSS）+ **テーマ切替ピル（4 状態）**

**HERO（F1）**: **ページの最上部が作品ギャラリーそのもの。** 大小のタイル（178–358px 幅）を横方向のメイソンリーで並べ、全体を 3D で skew させている。下にスクラブ用のスライダーと **`UNSKEW` チェックボックス**（skew を解除できる）。

**氏名が出てくるのは y=693 の本文中**:「This is a website made by me, **Ryan Mulligan**, a front-end builder of the web and fellow passenger through space and time.」続けて箇条書き 3 行（最終ビルド日時 / デプロイ時の天気 / 聴いていた曲）。

**採用したい点**
- **作品ビジュアルを hero にする。** First View の判断材料が「何を作る人か」ではなく「**何を作ったか**」になる。目的（短時間で制作実績を伝える）に最も直接的に効く。
- **装飾を解除できるスイッチ（`UNSKEW`）。** 演出を入れつつ、演出が邪魔な読者に逃げ道を用意する。現行サイトが prefers-reduced-motion を持つのと同じ思想の、**明示的な** UI 版。

**採用しない点**
- **氏名・職種が y=693 まで出てこない。** CSS デモの作者としては成立するが、業務システムの実績を売る場合は「誰が・何のために作ったか」が先に要る。
- **3D skew されたタイル。** 業務システムの画面は歪めると読めない。現行 `ART_DIRECTION` が screenshot を filter / dim / blend しない方針（`tokens.css` のコメント）とも矛盾する。

**応用方法**
**「作品を F1 に入れる」という構成だけを採る。** 手段は skew ギャラリーではなく、seanhalpin / samuelkraft 型の静的プレート（§4.11 / §4.14）。

---

### 4.10 Adham Dannaway — https://www.adhamdannaway.com/

**職種**: Product designer & front-end developer
**デザイン方向**: 白 / 上部固定の黒 nav（`about` / `learn` / `portfolio` / `blog` / `contact` + SNS 4）

**HERO（F1）**: 中央に**半分がイラスト・半分が写真の顔画像**。左に `designer` 約 70px、右に `<coder>` 約 70px。それぞれの下に 1 文:
- designer: 「Product designer specialising in UI design and design systems.」
- coder: 「Front end developer who writes clean, elegant and efficient code.」

背景にコード片（`<html>`, `class="jedi"`, `CSS3 HTML5 jQuery`）が薄く敷かれる。

fold 直下に `SOME OF MY LATEST WORK`（罫線に挟まれた中央寄せラベル）と **3 枚のカード**。カードには実際の UI スクリーンショット（承認ステータス、ダッシュボード、スコア表）が入る。

**採用したい点**
- **二面性を対称構図で宣言する。** 現行サイトは「業務システム / 業務自動化」「AI と人の分界」という**二面性がまさに売り**なので、構図として転用可能。左「業務をシステムにする」右「任せる範囲を決める」のような対称は、現行の capability 3 組を**視覚的な主張**に変えられる。
- **`SOME OF MY LATEST WORK` を罫線ラベルで区切り、直後に実画面のカードを 3 枚置く。** fold のすぐ下に作品が来る。
- nav に `contact` がある。

**採用しない点**
- **顔写真を hero の主役にする。** 日本の採用文脈で必須ではなく、作品面積を奪う。
- **背景のコード片装飾。** 「技術っぽさ」の記号であって情報ではない。現行の art direction（意味の無い装飾を置かない）と合わない。

**応用方法**
capability 3 組を rail の小文字リストから、**fold 内の対称的な主張ブロック**へ格上げすることを検討（ただし §10 では作品優先のため簡素版を採る）。

---

### 4.11 Seán Halpin — https://www.seanhalpin.xyz/ ★最重要参照

**職種**: Product Designer
**デザイン方向**: **クリーム `#EDE7DE` 地 / 濃緑 `#025A4E` の文字**（= 現行の `--paper:#F4F2ED` / `--sig:#14654A` と同系）/ 全長 3,319px / `<a>` 15 / `<img>` 14

**HERO（F1）**: 上部にピル型 nav（`Work /` `About` `Play` `Notes` `Contact`、17.5px、radius 24px、`/` はキーボードショートカット表示）。中央に **H1 127.7px「Hi. I'm Seán. A Designer.」**（2 行、高さ 495px）。装飾の 4 芒星が 2 つ。lede 21.2px 2 行。背景は 1440×900 の canvas（グラデーション）。**1 枚目のカード上端が y=642** — fold 内に入っている。

**PROJECT**: **Featured / More の区別が無い。** 8 件すべてが同じカード形式。ただし**幅が交互に変わる**:

| 行 | 左 | 右 |
|---|---|---|
| 1 | 491 × 550（HELP SCOUT / AI） | 819 × 550（HELP SCOUT / Articles） |
| 2 | 819 × 550（FIGMA / Plugins） | 491 × 550（HELP SCOUT / Mobile） |

- **border-radius 64px**、背景は彩度の高いパステル（`#D094E5` / `#A3DCD4` / `#E8B89C` / `#BDDFF9`）
- カード内ラベル: **クライアント名を大文字トラッキングで小さく + 作品名を 42.3px** で右寄せ
- スクリーンショットはカードより大きい（491 幅のカードに 810×422 の画像）。**縮小せずクロップして下辺からはみ出させる。**

**UI**: H1 127.7 / H2 42.3 / lede 21.2 / body 16。色は 1 つの pigment を 1 カードに割り当てる。

**Mobile（390×844 実測）**:
- 全長 **3,194px = 3.8 画面**
- nav は横並びのまま（ハンバーガーにしない）、y=30
- H1 **51.2px**（desktop 比 0.40）、2 行、高さ 278px
- H2 **24.26px**（desktop 比 0.57）
- カードは **315×320 の均一サイズ、radius 24px**（desktop 比 0.375）、非対称リズムを捨てて 1 カラムに揃える
- **1 枚目のカード上端が y=399 — first viewport 内**
- カード内のスクリーンショットは**やはり縮小せずクロップ**され、右辺からはみ出す

**採用したい点**
- **「クリーム地 + 単色の濃い文字 + 作品ごとの pigment」** が Editorial Gallery として成立する直接の証拠。現行の色設計（`--paper` / `--ink` / 作品別 `--sig`）は**そのまま使える**。
- **非対称 2 カラム（狭 / 広の交互）。** 均一グリッドより編集物らしく、かつ作品ごとに与える面積を変えられる。**作品 3 件なら「広 / 狭 / 広」の 3 行**で組める。
- **カードラベルの二段構え**（小さい大文字のカテゴリ + 大きい作品名）。現行の `productType` + `title` にそのまま対応する。
- **画像はクロップしてはみ出させる。** 縮小して全体を見せるより、一部を原寸で見せる方が「実物」に見える。**112px のサムネイルを 400px のクロップに変えるだけで、Editorial Band の性質が装飾から証拠に変わる。**
- **Featured / More を分けない。** 8 件でも分けていない。**3 件なら分ける理由が無い。**
- **モバイルで非対称を捨てて均一 1 カラムにする。** 変奏はデスクトップだけの贅沢として扱う。

**採用しない点**
- **radius 64px の大型カード。** 現行の art direction は「箱・角丸・影・余白の島を作らない register」と明示している（`EditorialBand.astro` のコメント）。角丸カードはこの語彙を壊す。**面積配分とクロップの考え方だけを採り、形は罫線 + プレートで実装する。**
- **彩度の高いパステル 4 色。** 現行は 3 作品に 1 色ずつという規律があり、pigment の数を増やすのは規律の破壊。
- **H1 127.7px。** 日本語の明朝 5 行では物理的に入らない。現行の `min(90px, 8.65cqi)` を維持しつつ**行数を減らす**方が正しい。

**応用方法**
本ドキュメントの推奨 IA（§10）と UI Direction（§11）の主たる下敷き。

---

### 4.12 Bruno Simon — https://bruno-simon.com/

**職種**: Creative Developer（3D / WebGL）
**デザイン方向**: 全画面 WebGL。読み込み時点では紫のドット床にネオンのローディング曲線のみで、**テキストが 1 文字も無い**。実体は車を運転して作品を見に行くゲーム。

**採用したい点**
- **「サイト自体が最大の作品」という成立のさせ方**（同型: maximeheckel, henryheffernan）。ただし下記の通り、このポートフォリオでは採らない。

**採用しない点**
- **F1 に情報が 0。** 採用担当者・発注者は数十秒しか見ない。ロードを待たせた先に操作説明が要る構成は、Conversion の観点で最も不利。
- **キーボード操作前提。** モバイル・アクセシビリティの両方で破綻しやすい。

**応用方法**
採らない。**「Immersive HERO」案（§8-C）を却下する根拠**として記録する。

---

### 4.13 Maxime Heckel — https://blog.maximeheckel.com/

**職種**: Creative / graphics engineer（シェーダ、リアルタイム 3D）
**デザイン方向**: 暗色 `oklch(0.1468 0.01 262.04)` / Inter 16px / 本文カラム **663px**（x=384）/ 全長 5,717px / `<a>` 69 / `<img>` 0 / **canvas 1**

**HERO（F1）**: 1430×950 の canvas に青地のパーティクル無限大記号。上部に浮遊するピル nav（`Index` / `Articles` / `Cmd` / `Ask`）。y=600 から 2 カラム: 左に **H1「Experiments and essays on the modern web.」わずか 24px** + 自己紹介、右に補足段落。

**INDEX**: 記事一覧が**年でグルーピング**され、`2026` `2025` が**左ガター（x=400, 幅 32px, 高さ 89px）に縦組みの 14px ラベル**として置かれる。各行は 663×58 でタイトル + 日付。

**採用したい点**
- **hero のビジュアル自体が技能の証明になっている。** シェーダエンジニアがシェーダを hero に置く。**このポートフォリオに翻訳すると「業務システムを作る人の hero には業務システムの画面が要る」**という結論になる。装飾画像では代替できない。
- **縦組みの年ラベル + 罫線 register。** 現行 rail（`.ins` 200px + `.ix` 34px モノスペース）と同じ発想の、より圧縮された版。**Work index を年 / 作品種別でグルーピングする際の型**として使える。
- **H1 を 24px にしても成立する**（ビジュアルが主役のとき）。

**採用しない点**
- **記事 index が主役の構成。** 現行サイトはブログを持たない。
- **暗色地。** 現行は紙地 + CONTACT のみ反転という規律があり、全面暗色化は art direction の作り直しになる。

**応用方法**
Work index に「rail 側の縦ラベル（作品番号・種別）+ 罫線行」を適用。

---

### 4.14 Samuel Kraft — https://samuelkraft.com/ ★重要参照

**職種**: Design Engineer, Raycast（前職 Tracklib / Bitrefill、13 年）
**デザイン方向**: `#FDFDFC` / 黒 / Inter / **本文カラム 598px（x=414）** / 全長 5,167px / `<a>` 28 / `<img>` 18

**HERO（F1）**: 28px の丸アバター → **`<h1>` 氏名が 14px** → 短い段落 4 つ:
1. 「Design Engineer at ⊕ **Raycast** currently working on desktop app builder ⊞ **Glaze**.」（社名にファビコンが inline で入る）
2. 13 年の経歴と前職 2 社
3. 何に興味があるか（UI component API、デザインシステム、タイポグラフィ、アニメーション）
4. 「Based in Stockholm, Sweden. Before software I studied photography.」

→ **`𝕏` / `Email` / `GitHub` / `Strava` の 4 リンク（y=373、F1 内）**

**PROJECT**: `Projects` ラベル（14px）→ 各作品ブロックは **626 × 371〜413**:
- 上部: 暗色のプレートに製品アイコン（100–120px）を中央配置した**大型ビジュアル（598 × 約 280）**
- 下: 作品名（14px）+ 説明 2〜3 行（14px）

例:「**Shape Calendar** — Training planner for endurance athletes to track training load. Build structured workouts with LLMs using plain English and sync with your Apple Watch, Garmin, Wahoo etc. Available on web and iOS.」

**UI**: **ページ上のすべての文字が 14px。** 見出しも本文も作品名も同じ。**ヒエラルキーは完全に「余白」と「画像の大きさ」だけで作られている。** 罫線もカードも影も無い。

**採用したい点**
- **「タイポのサイズ差を使わず、画像サイズと余白だけで階層を作る」** という極端な実例。現行サイトは逆に**タイポの階層（90 / 56 / 40 / 26 / 19 / 17 / 14.5 / 11px）が非常に強く、画像が弱い**。この対比が、現行に足りないものを名指ししている：**足りないのは文字の大きさではなく、画像の大きさ**。
- **作品ブロック = 大きいビジュアル + 名前 + 2〜3 行。** これ以上は書かない。
- **Contact 4 リンクを F1 に置く。**
- **社名に inline ファビコン。** 現行で言えば作品名に pigment のスクエア（`.sq`）を添える既存表現と同じ役割。

**採用しない点**
- **すべて 14px。** 日本語（明朝・かな漢字混植）では 14px 均一は読みにくく、現行の組版資産を捨てることになる。
- **製品アイコンだけのプレート。** Raycast / ray.so は既知の製品なのでアイコンで通じる。無名の業務システムは**中身の画面**を見せる必要がある。

**応用方法**
Work entry のブロック設計:「**大型スクリーンショット（幅いっぱい）→ 作品名 → 2 行**」。現行の Work entry が持つ `problem` / `implementationScope` / `keyDecision` / `tests` / `limitations` はここには出さず Case Study へ送る。

---

### 4.15 Marcus Mayo — https://marcusmayo.github.io/machine-learning-portfolio/

**職種**: Machine Learning / AI Engineer
**デザイン方向**: GitHub Pages の README レンダリング（白地・ブラウザ既定のセリフ見出し・青リンク・水平罫線）

**構成**: リポジトリ名リンク → 🚀 絵文字つき H1 → **バッジ 4 個（Stars 5 / Forks 0 / Issues 0 open / License MIT）** → 概要 1 段落 → 🧑‍💻 About Me → **Core Competencies の箇条書き 8 行**（Machine Learning / MLOps / Cloud Platforms / Data Engineering / Programming / Healthcare AI / AI-Augmented Development / Prompt Engineering、各行が絵文字 + 太字ラベル + ダッシュ + 技術列挙）→ 💼 Overall Tech Stack Summary（表）→ 以降プロジェクト一覧。

**採用したい点**
- **AI / Automation Engineer 領域で実際に流通している形式**として記録する価値がある。「end-to-end で本番まで持っていける」ことを主張しようとしている意図は、現行サイトの主張と近い。

**採用しない点（このカテゴリで最も重要な反面教師）**
- **能力を「列挙」で主張している。** Core Competencies 8 行はすべて自己申告で、検証手段が無い。読者にとっては情報量ゼロに近い。
- **バッジ（Stars 5 / Forks 0）を上部に置く。** 数字が小さいと逆効果になる。
- **技術スタックの表を作品より先に置く。** 「どの技術を使えるか」は「何を作ったか」の後でしか意味を持たない。
- **絵文字による見出しの階層づけ。** 走査の手がかりにならない。

> **現行サイトへの含意（重要）**
> 現行の `ENGINEERING STACK`（言語 → 責務 → 作品の対応表）と `ENGINEERING PRINCIPLES`（判断 8 件 + sourceRef）は、marcusmayo の Core Competencies と**表面的には同じ形式**（表と箇条書き）である。決定的に違うのは、現行の各行が `sourceRef`（`ai-crm-demo/README.md`、`spec CS-6 判断 3` 等）を持つことだ。
> **したがって: 形式が似ていることを理由に捨ててはいけないが、位置は同じ理由で後ろにすべき。** V4 で既にトップから外している判断（`index.astro` のコメント）は、調査結果と整合する。**Phase 2 でも戻さない。**

---

### 4.16 Henry Heffernan — https://henryheffernan.com/

**職種**: Creative Developer（3D）
**デザイン方向**: 黒地の CRT ブート画面シミュレーション。`<a>` 0 / `<img>` 0 / **canvas 2 / video 2** / `document.body.scrollHeight` = **0**（全画面アプリでスクロール文書を持たない）。

body のテキストは `Heffernan, Henry Inc. Released: 01/13/2000 / HHBIOS (C)2000 … Checking RAM : 14000 OK / FINISHED LOADING RESOURCES / Loaded keyboardKeydown3 ... 63% …`（計 518 字）。実体は 3D の PC デスクの上で OS を操作する。

**採用したい点**
- 「技巧そのものを売る」極North。**現行サイトが目指すべきでない方向を明確にする**という意味で有用。

**採用しない点**
- **リンク 0・スクロール 0・見出し 0。** IA が存在しない。SEO・アクセシビリティ・モバイルすべてで破綻する。ロード完了まで何も判断できない。

**応用方法**
採らない。§8-C 却下の根拠。

---

### 4.17 Josh W. Comeau — https://www.joshwcomeau.com/

**職種**: Front-end developer / educator
**デザイン方向**: 水色のイラスト背景（丘 + 3D キャラクタ + 舞う記号）/ 上部 nav（`Categories` / `Courses` / `Goodies` / `About` + 検索・サウンド・テーマ・RSS の 4 ユーティリティ）

**構成**: hero イラスト → ピンクの kicker `ARTICLES AND TUTORIALS` → 本文 2 カラム（左 620px に記事、右 300px に `BROWSE BY CATEGORY` の pill 8 個と `POPULAR CONTENT` の矢印リスト）。

**採用したい点**
- **kicker を彩色した小さい大文字ラベルにして、セクションの性格を一目で示す。** 現行の rail ラベル（`.lb`）が既に同じ機能を持つ。
- **サイドバーに「人気 / 推奨」の入口を置く。** 現行に翻訳すると「どの Case Study から読むべきか」の推奨導線になりうる。

**採用しない点**
- **ブログ主導の IA。** 現行サイトに記事資産が無い。
- **イラスト hero。** 作品面積を装飾が奪う（§4.2 leerob と同じ理由）。

---

## 5. 共通 UI パターン（横断分析）

15 サイトを通して、目的（採用・発注判断）に効く構造として繰り返し現れたもの。

### 5-A. H1 は「氏名」ではなく「立ち位置の 1 文」になりつつある

| サイト | H1 / 最上位テキスト |
|---|---|
| olaolu.dev | A Software Engineer building fast, resilient web products at scale.（30.24px） |
| rauno.me | Rauno Freiberg is an Estonian interaction designer working with Vercel and Devouring Details.（32px） |
| jarocki.me | exploring what software engineering looks like when agents do most of the typing.（16px） |
| maximeheckel | Experiments and essays on the modern web.（24px） |
| 現行 portfolio | 業務の課題を整理し、画面・API・データ・自動処理へ落とし込み、動く仕組みとして設計・実装する。（最大 90px） |

一方、氏名を display にしているのは brittanychiang（48px）・lynnandtonic（96px）・seanhalpin（127.7px）。前者は「無名でも何ができるか伝わる」設計、後者は「名前が既にブランド」の設計。

> **判断**: 現行の「一文を display にする」は正しい。ただし**日本語 5 行は長い**（§11）。

### 5-B. First viewport に作品を入れるか、Contact を入れるか、少なくともどちらかは入っている

| サイト | F1 の作品 | F1 の Contact |
|---|---|---|
| ryanmulligan.dev | ◎（hero がギャラリー） | — |
| seanhalpin.xyz | ◎（カード上端 y=642） | ◎（nav の `Contact`） |
| samuelkraft.com | ◎（プレート y=511） | ◎（Email, y=373） |
| adhamdannaway.com | △（fold 直下） | ◎（nav の `contact`） |
| olaolu.dev | — | ◎（`Contact me`, y=724） |
| emilkowal.ski | — | ◎（作品 4 行 + email） |
| jarocki.me | — | ◎（`email`, y=332） |
| brittanychiang.com | — | ◎（SNS 5 個, y=780） |
| **現行 portfolio** | **—** | **—（nav にも無い）** |

**現行サイトだけが、両方とも欠けている。**

### 5-C. 作品が少ないとき Featured / More を分けない

- seanhalpin: 8 件すべて同形式のカード
- samuelkraft: Projects 配下に均一ブロック
- emilkowal.ski: 4 件を同じ行形式
- brittanychiang: Projects 4 件を同じ行形式
- 分けているのは実質 adhamdannaway（`SOME OF MY LATEST WORK` 3 枚 + `portfolio` ページ）のみ

> **判断**: **作品 3 件で Featured / More の 2 段構えを取る合理性は無い。** 現行の「Editorial Band（3 枚のサムネ）→ Lead 1 件を巨大に →  index で 3 件を再掲」は、**同じ 3 作品を 3 回見せている**。これが 10,923px の主因である。

### 5-D. Register（罫線行）はほぼ全サイトに出る

leerob の `Blogs`、maximeheckel の記事 index、brittanychiang の Experience / Projects、emilkowal.ski の作品行。共通形は:

```
[番号 or 年 or 種別]  タイトル                                  [日付 or 補足]
---------------------------------------------------------------- hairline
```

現行 `Register.astro` は既にこの形。**維持する。** ただし 1 行の情報量を減らす（§4.4）。

### 5-E. rail / ガターにメタ情報を置く

brittanychiang（年レンジ）、maximeheckel（縦組みの年）、現行（節番号 + モノスペースラベル）。3 者とも「本文の外側に走査用の目盛を置く」構造。

> **判断**: 現行の rail は調査対象中もっとも作り込まれている。**資産として維持し、sticky 化で強化する。**

### 5-F. 画像は縮小せずクロップする

seanhalpin: 491px のカードに 810×422 の画像を入れて下辺からはみ出させる。モバイルでも 315px のカードに同様。
samuelkraft: 598×280 のプレートで上下をクロップ。

**全体を縮小して見せる（= 現行の 112px サムネ）のではなく、一部を大きく見せる。** 業務システムの画面のように情報密度が高い画像ほど効く。

### 5-G. モバイルは「落とす」設計

- brittanychiang: **セクション nav を `display:none`**
- seanhalpin: 非対称グリッド → 均一 1 カラム、radius 64 → 24、H1 127.7 → 51.2（0.40 倍）、H2 42.3 → 24.3（0.57 倍）

縮小率が**要素ごとに違う**のが要点。display は大きく縮め、見出しは中くらい、本文は据え置き。

### 5-H. Contact の摩擦を下げる小技

- rauno.me: Email クリックで clipboard コピー、`Copied` 表示
- samuelkraft / emilkowal.ski / jarocki.me: `Email` をテキストリンクで並置
- seanhalpin: nav の `Contact` が button（モーダル）
- olaolu.dev: F1 内に `Contact me`

### 5-I. 進行中・現在地を書く

- anandchowdhary: `/NOW` の 4 行
- samuelkraft: 「currently working on desktop app builder Glaze」
- jarocki: 「exploring what … when agents do most of the typing」
- lynnandtonic: `v. XIX`

「今なにに取り組んでいるか」が、経歴の羅列より強い信号として使われている。

---

## 6. 採用するパターン

理由は「視線誘導 / 情報階層 / First View / Readability / Project discovery / Conversion / Responsive」のいずれかで説明する。

| # | パターン | 出典 | 採用理由 |
|---|---|---|---|
| 1 | **F1 に作品ビジュアルを入れる** | ryanmulligan, seanhalpin, samuelkraft | **First View**。現行は最初の画像が y=1,044（1440）/ y=1,321（390）。業務システムは画面を見ないと理解できないので、テキストだけの F1 は判断材料を与えていない |
| 2 | **Featured / More を分けない、3 件を等価に** | seanhalpin, samuelkraft, emilkowal.ski, brittanychiang | **Project discovery**。3 件を 3 回見せる現行構成が全長 10,923px の主因。等価に並べれば 1 回で済む |
| 3 | **画像はクロップして大きく** | seanhalpin, samuelkraft | **First View / Readability**。112px サムネは装飾。400px 級のクロップは証拠になる |
| 4 | **作品ブロック = 大画像 + 名前 + 1〜2 行** | samuelkraft, emilkowal.ski | **情報階層**。トップで判断に必要なのは「何のための何か」まで。`problem` / `keyDecision` / `limitations` は Case Study の仕事 |
| 5 | **非対称 2 カラム（広 / 狭の交互）** | seanhalpin | **視線誘導**。均一グリッドは目が滑る。幅の変化がリズムを作り、作品ごとの重みづけもできる |
| 6 | **Register（罫線行）を index に使う** | leerob, maximeheckel, brittanychiang | **走査性**。既に実装済みの資産 |
| 7 | **rail を sticky にする** | brittanychiang | **視線誘導**。長いページで現在地を失わせない。現行 `.tr > .ins` に `position: sticky` を足すだけ |
| 8 | **nav に CONTACT を入れ、F1 に CTA を置く** | olaolu, seanhalpin, adhamdannaway, samuelkraft | **Conversion**。現行は nav にすら無い |
| 9 | **Email はクリックでコピー + `Copied`** | rauno.me | **Conversion**。mailto: を開かせない |
| 10 | **About に「/NOW 型の現在地」を先に置く** | anandchowdhary, samuelkraft, jarocki | **情報階層**。現行 ABOUT は前提条件の列挙で、本人の現在地が無い |
| 11 | **About は既定を短く、展開で詳細** | leerob（Default / Long） | **Readability**。誠実さ（`sourceRef`）を落とさずに F1 負荷を下げる |
| 12 | **モバイルでセクション nav を落とす / 変換率の違う縮小** | brittanychiang, seanhalpin | **Responsive**。display 0.40 倍、見出し 0.57 倍、本文据え置き |
| 13 | **モバイルでも非対称を捨てて均一 1 カラム、ただし画像はクロップのまま** | seanhalpin | **Responsive**。縮小すると業務画面が読めなくなる |
| 14 | **サイトの版を明示する** | lynnandtonic（`v. XIX`） | 継続的に作り直している事実が伝わる。V4 という事実がある |
| 15 | **hero のビジュアルが技能の証明を兼ねる** | maximeheckel | **First View**。装飾画像（leerob の花畑、joshwcomeau のイラスト）では代替できない |

---

## 7. 採用しないパターン

| # | パターン | 出典 | 不採用の理由 |
|---|---|---|---|
| 1 | **Immersive / ゲーム化した hero** | bruno-simon, henryheffernan | F1 の情報量が 0。ロード待ちと操作学習を強制する。採用担当者の閲覧時間と合わない。henryheffernan は `<a>` 0 / scrollHeight 0 で IA が存在しない |
| 2 | **横スクロールを主動線にする** | rauno.me | Project discovery のコストが上がる。走査順とスクリーンリーダの順序が一致しない |
| 3 | **作品画像 0 枚** | emilkowal.ski, rauno.me, anandchowdhary, jarocki, olaolu | 既知の製品名・著名な社名が証拠として働く人の構成。合成データの個人開発デモには前提が無い |
| 4 | **About / 経歴を作品より前に長文で置く** | brittanychiang, olaolu | 現行の問題そのもの。brittanychiang は 390px で作品画像が y=3,401 |
| 5 | **能力を列挙で主張する（Core Competencies 型）** | marcusmayo | 自己申告で検証不能。読者に情報が渡らない |
| 6 | **バッジ / スター数を上部に置く** | marcusmayo | 数字が小さいと逆効果 |
| 7 | **技術スタック表を作品より前に置く** | marcusmayo | 「何を使えるか」は「何を作ったか」の後でしか意味を持たない。現行が V4 で STACK をトップから外した判断は正しい |
| 8 | **雰囲気画像で hero の半分を埋める** | leerob, joshwcomeau | 作品を置ける最良の面積を装飾に使う |
| 9 | **顔写真を hero の主役にする** | adhamdannaway | 日本の採用文脈で必須でなく、作品面積を奪う |
| 10 | **radius 64px の大型カラーカード** | seanhalpin | 現行 art direction の「箱・角丸・影を作らない register」語彙を壊す。**面積とクロップの考え方だけ採る** |
| 11 | **全文字 14px（タイポ階層を持たない）** | samuelkraft | 日本語の明朝混植では読みにくい。現行の組版資産を捨てることになる |
| 12 | **3D skew / フィルタをかけた作品画像** | ryanmulligan | 業務画面は歪むと読めない。`tokens.css` の「screenshot は filter / dim / blend しない」方針と矛盾 |
| 13 | **トップを表紙だけにする（作品 0 件）** | lynnandtonic, jarocki | 全員に 1 クリックを強制する。Conversion で不利 |
| 14 | **ライフログのデータタイル** | anandchowdhary | 採用・発注判断に無関係 |
| 15 | **セクション名を display サイズにする** | rauno.me | 目次が主役になり、内容が従になる |

---

## 8. IA 案

既存 IA を前提にしない。4 案を立てる（A / B / C は Issue 指定、D は「現行 V4 の延長」を比較の基準線として置く）。

すべての案で、作品は 3 件（AI CRM Demo / Project Progress Manager / Document Field Extraction Demo）という現実の制約を前提にする。

---

### 案 A — Editorial Gallery（作品等価ギャラリー型）

```
00  HERO            role / display（一文）/ stack line / CTA: 作品を見る・相談する
01  SELECTED WORK   3 作品を等価に。非対称リズム（広 / 狭 / 広）
                    各件: 大型スクリーンショット（クロップ）→ 作品名 → 製品種別 →
                          purpose 1 文 → 言語 → Case Study →
02  CAPABILITIES    できること 3 軸。各軸に「使う技術」と「その軸を含む作品」を対応
03  ABOUT           /NOW 3 行（現在地）+ 展開で前提条件（個人開発・公開範囲・合成データ）
04  CONTACT         反転バンド。Email（コピー）/ GitHub / リポジトリ
```

**強み**
- First View に作品が入る（案の中で最短距離）。
- 3 作品を 1 回だけ見せるので、全長が最短になる。
- 既存コンポーネント（`EditorialBand` / `Register` / `WorkEntry` / `Rail`）の**組み替えと寸法変更**で成立し、新規の表現様式を発明しない。
- Case Study / Evidence 資産が「詳細は各作品へ」という明確な役割を得る。

**弱み**
- 3 件しか無いことが露骨に見える（Lead を膨らませて量を演出できない）。
- 方法論（HOW I BUILD）という現状の差別化要素が前面から退く。
- 作品間に優劣をつけられないので、「まずこれを見てほしい」という誘導が弱くなる（→ 非対称リズムの「広」側に置くことで部分的に解決）。

---

### 案 B — Product Engineer（主張先行型）

```
00  HERO
01  WHAT I BUILD    3 つの capability を対称ブロックで主張（adhamdannaway 型の構図）
02  SELECTED WORK   3 作品
03  HOW I BUILD     方法論（圧縮版）
04  ABOUT
05  CONTACT
```

**強み**
- 「何ができる人か」を構図として強く打ち出せる。現行の capability 3 組が rail の小文字から主役に昇格する。
- 業務システム / 自動化 / AI 活用という守備範囲を、作品 3 件より抽象度の高い層で先に伝えられる（作品名を知らない読者に優しい）。
- HOW I BUILD を残せる。

**弱み**
- **作品が 1 セクション分後ろに下がる。** F1 に作品を入れるという最重要要件と直接衝突する。
- WHAT I BUILD は本質的に自己申告であり、marcusmayo の Core Competencies（§4.15）と構造が同じ。検証可能性という現行サイトの最大の強みを、最も目立つ場所で使わないことになる。
- セクションが 6 つに増え、全長が伸びる。

---

### 案 C — Creative Engineer（Immersive 型）

```
00  Immersive HERO   全画面のモーション / スクロール連動の導入演出
01  PROJECT SHOWCASE スクロールピン留め または 横スクロールで作品を順に見せる
02  PROJECT INDEX    罫線 register
03  SKILLS
04  ABOUT
05  CONTACT
```

**強み**
- 記憶に残る。「Web の作り込みができる」ことを、サイト自体で証明できる。
- モーション資産（`MotionStage` / `motion.css` 2,181 行）を最大限使える。

**弱み**
- **調査で最も明確に否定された方向。** bruno-simon は F1 の情報量 0、henryheffernan は `<a>` 0 / scrollHeight 0 で IA が存在しない。rauno.me の横スクロールは走査順を壊す。
- 現行サイトが売っているのは**業務システムの設計・実装**であり、Web 演出技巧ではない。演出が強いほど「見せ方は上手いが中身は？」という読まれ方に近づく。
- 演出のためにスクリーンショットを歪める・遅延させると、`tokens.css` の「screenshot は filter / dim / blend しない」方針に反する。
- モバイルとアクセシビリティの両方で実装コストとリスクが最大。

---

### 案 D — Lead Case（現行 V4 の延長 / 基準線）

```
00  HERO
    Editorial Band（3 サムネ）
01  WORK 見出し → Lead 1 件を詳細に → index 3 件
02  HOW I BUILD
03  ABOUT
04  CONTACT
```

**強み**
- 変更が最小。Phase 2 のコストが最も低い。
- Lead 1 件を深く見せるので、1 作品については「どこまで作ったか」が確実に伝わる。
- 既に稼働しており、検証ゲート（`check:structure` / `validate:content` / `check:attestation`）が全て通っている。

**弱み**
- 実測した課題（§2）がすべて温存される: F1 に作品が無い、全長 10,923px、同じ 3 作品を 3 回見せる、HOW I BUILD が 20%、Contact が CTA でない。
- Lead 1 件に 31% を割く構造は、「3 作品ある」という主張と画面上の事実が食い違う。

---

## 9. 比較

| 観点 | A. Editorial Gallery | B. Product Engineer | C. Immersive | D. Lead Case（現行） |
|---|---|---|---|---|
| **F1 に作品** | ◎ 設計の中心 | △ 1 セクション後ろ | △ ロード後まで不明 | ✕ y=1,044（実測） |
| **想定全長 (1440)** | 約 4,500–6,000px | 約 6,000–7,500px | 約 8,000px+ | **10,923px（実測）** |
| **情報階層の明快さ** | ◎ 作品→能力→人→連絡 | ○ 主張→作品→方法→人→連絡 | △ 演出が階層を覆う | ✕ 方法論が作品と連絡の間に 20% |
| **Project discovery** | ◎ 3 件を 1 回で等価に | ○ | △ 順送り / 横送り | ✕ 同じ 3 件を 3 回 |
| **採用向き**（技術力の判断） | ○ 作品→Case Study→Evidence の階段が明確 | ◎ 守備範囲が先に伝わる | ✕ 技巧の印象が実務能力の印象を上書きする | ○ 1 件は深い |
| **副業案件獲得向き**（発注判断） | ◎ 「何を作れるか」が画面で分かり、Contact が近い | ○ | ✕ 発注者は演出を評価しない | ✕ Contact 導線が実質不在 |
| **Readability** | ◎ 1 作品 1〜2 文 | ○ | △ | ✕ 本文 4,534 字 |
| **Conversion** | ◎ F1 CTA + nav CONTACT + Email コピー | ◎ | ✕ | ✕ |
| **実装難易度** | **低〜中** 既存コンポーネントの組み替えと寸法変更。新様式の発明なし | 中 WHAT I BUILD が新規セクション | **高** スクロール連動・ピン留め・モバイル退避の全新規 | 最低（変更なし） |
| **モバイル相性** | ◎ 1 カラム + クロップで素直に落ちる | ○ 対称 2 列の崩し方を決める必要 | ✕ 演出の退避設計が必須。現状 390px で 14,112px の問題も解けない | ✕ 14,112px = 16.7 画面（実測） |
| **art direction との整合** | ◎ 語彙（紙 / インク / pigment / 罫線 / rail）を維持したまま面積だけ変える | ○ | ✕ 新しい表現様式が必要 | ◎ |
| **既存の検証ゲートへの影響** | 小（構造チェックの期待値更新のみ） | 中 | 大 | なし |

### 却下理由

- **C を却下**: 調査で最も明確に不利が示された（§4.12 / §4.16 / §7-1, 7-2）。かつ実装コストが最大で、モバイル問題を何も解かない。
- **B を保留（部分採用）**: 「守備範囲を先に伝える」という長所は正しいが、専用セクションを作らなくても **HERO の capability 3 組**と **02 CAPABILITIES** で達成できる。作品を後ろに下げる代償に見合わない。
- **D を却下**: §2 の実測課題がすべて残る。

---

## 10. 最終推奨 IA

### **案 A「Editorial Gallery」を採用する。**

B の長所（守備範囲を先に伝える）は、HERO の capability 3 組を維持し、CAPABILITIES を作品の直後に置くことで取り込む。

### 10.1 セクション順

| # | id | 見出し（nav ラベル） | 目的 |
|---|---|---|---|
| 00 | `top` | —（INTRO） | 誰が・何を作る人かを 1 文で |
| 01 | `work` | **WORK** | 3 作品を等価に、画面で見せる |
| 02 | `build` | **CAPABILITIES** | 何ができるか / どの技術で / どの作品に |
| 03 | `about` | **ABOUT** | 現在地と前提条件 |
| 04 | `contact` | **CONTACT**（← 新規に nav へ追加） | 連絡する |

`site.json` の `sections` 配列がそのまま nav と節番号の正本なので、**`contact` の `label` を `null` から `"CONTACT"` に変えるだけで nav に出る**（`index.astro` の設計どおり、番号は位置から導出される）。

### 10.2 HERO（00）— 何を配置するか

**目標: HERO セクションの高さを 783px → 約 600px 以下にし、01 WORK の 1 枚目のビジュアルを fold の内側に入れる。**

配置（上から）:

1. **Nav** — handle + kicker + `01 WORK` / `02 CAPABILITIES` / `03 ABOUT` / **`04 CONTACT`**
2. **rail**（`.ins`）— `00` / ソフトウェアエンジニア / 業務システム・自動化・AI活用 / capability 3 組（現状維持）
3. **display**（`.dsp`）— 現行の一文をそのまま。**ただしサイズを下げて占有高さを削る**（§11.1）
4. **stack line**（`.ans`）— 現状維持
5. **lede** — 現状維持（2 行）
6. **CTA 2 つ（新規）** — primary「作品を見る」→ `#work` / secondary「連絡する」→ `#contact`

**SYNTHETIC DATA / DEMO 帯を F1 から外す。**
削除ではなく移設する。掲載先は (a) 各 Work entry の図版キャプション（既に `EvidenceCaption` / `synthetic` の語彙がある）と (b) 03 ABOUT の前提条件。**F1 から消えるだけで、サイト上の合成データ表明は減らない。**

> 根拠: 調査 15 件で免責を F1 に置くサイトは 0 件。誠実さは維持すべきだが、**「何ができるか」より先に読ませる必然性は無い**。作品画面に隣接して出る方が、注記としてはむしろ正確に働く。

### 10.3 WORK（01）— どう見せるか

**Featured / More を分けない。3 作品を等価に、1 回だけ並べる。**

セクション頭: rail（`01` / `SELECTED WORK` / `3 works`）+ h2 + lede（現状の `home.works.h2` / `home.works.lede` をそのまま使える）。

各作品ブロック（3 回反復）:

```
┌─ page ──────────────────────────────────────────────────┐
│ [rail]  01   ■ AI CRM Demo                              │
│         CRM                                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │  plate (--plate) に載せた大型スクリーンショット        │ │
│  │  16:10 クロップ / 縮小しない / filter なし            │ │
│  └────────────────────────────────────────────────────┘ │
│         小規模店舗向け 顧客・販促管理システム（CRM）        │
│         〈purpose を 1 文〉                              │
│         Python 3.12 · TypeScript          Case Study →  │
└─────────────────────────────────────────────────────────┘
```

- **非対称リズム**: 3 件を「広 / 狭 / 広」で組む（seanhalpin の 819 / 491 の考え方）。広 = 図版がページ幅いっぱい、狭 = 図版が `.msr` 幅（720px）。どの作品を「広」にするかは Phase 2 の判断（既存の `featuredOrder` / `homepageRole` が使える）。
- **図版は縮小せずクロップ**（§5-F）。表示高さの下限を決め、足りなければ横をクロップする。
- **1 ブロックのテキストは「製品種別 + purpose 1 文 + 言語」まで。** 現行 `Register` の `problem` / `implementationScope` / `proves` / `tests` / `limitations` は Case Study へ送る。
- **Case Study 導線を各ブロックに 1 つ。** 現行 `ui.work.caseStudyCta` をそのまま使う。

**現行の「Editorial Band（3 サムネ 112px）+ Lead 1 件 3,392px + index 3 件 2,277px」は、この 1 構造に統合される。** 同じ 3 作品を 3 回見せるのをやめる。

> 「Lead を深く見せたい」という現行の意図は捨てない。**深さの置き場所を Case Study に移す**だけである。トップでの役割は「3 件それぞれが何か」を等価に示すことに限定する。

### 10.4 More Projects — どう見せるか

**現時点では作らない。** 作品が 3 件であり、調査でも 4〜8 件までは分けないのが一般的（§5-C）。

**発動条件を決めておく**: 公開作品が **6 件以上**になった時点で、01 の下に罫線 register（`Register.astro` の減量版）を `MORE` として追加する。それまでは `/work/` 一覧ページが archive の役割を担う。

### 10.5 CAPABILITIES（02）— どう見せるか

現行 `HOW I BUILD`（2,220px）+ 非表示の `ENGINEERING STACK` を、**1 セクション・目標 700px 以下**に統合する。

構成:

1. **h2** — 「何ができるか」。lede に `howIBuild.lede`（"AI へ実装を委譲しても、理解まで委譲しない。"）を 1 行で置く。
2. **3 軸 × 対応表** — HERO の capability 3 組と同じ 3 軸を使い、各軸に「使う技術」と「その軸を含む作品」を対応させる:

```
業務をシステムにする   Python/Django · TypeScript/React · GAS · Node.js   → CRM / PPM / DFE
任せる範囲を決める     provider 抽象化 / 承認ゲート / 確信度スコア          → CRM / DFE
確認できる形で作る     pytest · node:test · GitHub Actions               → CRM / PPM / DFE
```

`site.json` の `stack.languages`（language → responsibility → work）が既にこの対応を持っているので、**新しいデータは要らない**。

3. **方法論へのリンク 1 本** — 8 ステップの workflow 図、roles テーブル、intent、notClaimed は**トップから外し**、`/work/{slug}/technical/` もしくは方法論ページへ移す。トップに残すのは lede 1 行 + リンク。

> 根拠: jarocki.me は同じ主張を 1 文で言っている（§4.6）。marcusmayo は能力の列挙で 8 行使い、検証不能な自己申告になっている（§4.15）。**現行の workflow 図は marcusmayo より遥かに実質があるが、トップの位置に 2,220px を占める理由にはならない。**

### 10.6 ABOUT（03）— 何を書くか

**2 層構造にする**（leerob の Default / Long、§4.2）。

**既定（3〜4 行、/NOW 型）** — anandchowdhary の `/NOW`（§4.7）に倣い、**現在地**を先に書く:

- いま何を作っているか
- 作品 3 件をどういう立場で作ったか（個人開発、1 人で画面〜API〜DB〜AI〜権限〜テストまで）
- 何を学習中か / どこを人の判断に残しているか
- サイトの版（`v4` — lynnandtonic の `v. XIX`、§4.5）

**展開（現行の 3 行をそのまま）** — 実装形態 / 公開範囲 / データ、各行の `sourceRef` 付き。**ここに合成データの注記を移す。**

> 現行 ABOUT は「作品の前提条件」だけで、**本人の現在地が書かれていない**。前提条件は削らず、順序を後ろにする。

### 10.7 CONTACT（04）— どう CTA を配置するか

現行: 反転フッター + `dl` 2 行（GitHub / リポジトリ）+ note。nav リンク無し。

変更:

1. **nav に `04 CONTACT` を追加**（`site.json` の `label` を埋めるだけ）
2. **HERO に secondary CTA「連絡する」** → `#contact`
3. **バンド内に 1 行の呼びかけ + 連絡手段**:
   - Email — **クリックで clipboard コピー、`Copied` に差し替え**（rauno.me、§4.3 / §5-H）
   - GitHub / リポジトリ（現状維持）
4. 反転（`.inv`）は維持。`Footer.astro` のコメントにある「ページに床を与える」という判断は調査とも整合する（seanhalpin も最下部で地色を変える）。

> Email を公開するか否かは本人の判断事項。**公開しない場合でも、GitHub Issues / Discussions など「返信できる窓口」を 1 つ明示する**必要がある。現行は窓口が 0。

### 10.8 Motion — どこに使うか

現行資産（`MotionStage.astro` / `motion.css` 2,181 行 / hero の entry build）は**維持する**。追加と削減:

| 位置 | 扱い |
|---|---|
| HERO entry build | **維持**。`11a44a9 feat(portfolio): build the hero into view on entry` の成果 |
| 作品ブロックの図版 | **追加**: scroll 進入時に図版のみ短く fade + 2〜4px の上昇。テキストは動かさない |
| rail | **追加**: `position: sticky`（brittanychiang、§4.1 / §6-7）。アニメーションではなく位置の固定 |
| セクション間 | **追加しない**。パララックス・ピン留め・横送りは使わない（§7-1, 7-2） |
| cursor | **使わない**。rauno.me の crosshair は採らない |
| `prefers-reduced-motion` | **維持**。既存のゲート script はそのまま |

原則: **モーションは「読む順序」を助けるためだけに使い、「見せ場」を作るためには使わない。**

### 10.9 Mobile — 何を削る / 何を優先する

§13 に詳述。要点のみ:

**優先（この順で first viewport に入れる）**
1. handle + kicker
2. display（4 行以内）
3. **1 枚目の作品ビジュアル**

**削る**
- SYNTHETIC DATA 帯（2 行 = 約 70px）→ ABOUT と図版キャプションへ
- HERO の capability 3 組 → 作品帯の**後ろ**へ移動（削除ではなく順序変更）
- rail のラベル文字列（`SELECTED WORK` 等）→ 節番号のみ残す
- CAPABILITIES の workflow 図 → トップから除去（デスクトップと同じ）

### 10.10 Phase 2 の受け入れ数値（実測で検証可能）

| 指標 | 現行（実測） | 目標 |
|---|---|---|
| 作品ビジュアル上端 Y @1440 | 1,044px | **≤ 780px**（fold 内に 120px 以上見える） |
| 作品ビジュアル上端 Y @390 | 1,321px | **≤ 760px**（fold 内） |
| ページ全長 @1440 | 10,923px | **≤ 6,000px** |
| ページ全長 @390 | 14,112px（16.7 画面） | **≤ 8,000px**（≤ 9.5 画面） |
| トップ本文の文字数 | 4,534 字 | **≤ 2,000 字** |
| `<h2>` の数 | 3 | **≥ 5** |
| nav の CONTACT | 無 | **有** |
| F1 内の CTA | 0 | **2**（作品を見る / 連絡する） |
| 作品の最大図版高さ | 112px（Band） | **≥ 320px @1440 / ≥ 200px @390** |
| 1 作品がトップで占める最大高さ | 3,392px | **≤ 900px** |

---

## 11. UI Design Direction

**方向性: `Editorial Gallery`（= Editorial + Graphic + Depth、Interactive は抑制）**

Issue の候補 `Editorial + Graphic + Depth + Interactive` から **`Interactive` の比重を下げる**。理由は §7-1 / §7-2 / §10.8。モーションは読む順序の補助に限定する。

**最重要の転換**: 現行は「Editorial **Document**」である。タイポ階層（90 / 56 / 40 / 26 / 19 / 17 / 14.5 / 11px）が極めて強く、画像が弱い（最大 112px の帯サムネ）。**Editorial Gallery にするために増やすべきは文字の大きさではなく、画像の大きさである**（samuelkraft の逆説、§4.14）。

### 11.1 Typography

**書体は変えない。** `--f-min`（Source Serif 4 / Noto Serif JP）/ `--f-ui`（Inter / Noto Sans JP）/ `--f-mono`。leerob.com が 17px セリフ・行間 1.6 で同じ組版を使っており（§4.2）、判断を変える理由が無い。

変更するのは**ディスプレイの占有高さ**のみ:

| 役割 | 現行 | 提案 | 理由 |
|---|---|---|---|
| `.dsp`（HERO 一文） | `min(90px, 8.65cqi)` / 5 行 / 約 472px | **`min(68px, 6.6cqi)`** / 5 行 / 約 357px | HERO を 600px 以下に収め、作品を fold 内へ上げる。行数は既存の authored cut（3 要素）を壊さない |
| `h2` | 40px | 維持 | |
| `.claim` | 26px | 維持 | |
| `.lede` | 19px | 維持 | |
| 本文 | 17px / 1.9 | 維持 | |
| `.mo` / `.lb`（モノ 11px, tracking .2em） | 維持 | 維持 | rail の語彙。joshwcomeau の kicker、anandchowdhary の `/NOW` と同じ機能 |
| 作品名（gallery 内） | h3 24px | **32px** | 図版が大きくなるぶん、キャプションの主語を強める |

> `.dsp` の縮小は art direction の凍結解除を要する（`tokens.css` ヘッダの注記）。Phase 2 の着手前に承認を取ること（§14）。

### 11.2 Spacing

- `.page` の `--mg: 72px` / `max-width: 1440px` — **維持**
- セクション間: `s-open` / `s-tight` の 2 段階 — **維持**
- **追加**: 作品ブロック間の間隔を、セクション間より小さく・ブロック内より大きい第 3 の値にする（gallery が「連続した 3 件」に見えるため）。目安 88–96px。
- 図版とキャプションの間: 16–20px（近接で 1 組に見せる）

### 11.3 Grid

- `.tr` = `200px + minmax(0,1fr)` / `column-gap: 56px` / 227px のヘアライン — **維持**
- `.msr` = 720px — **維持**（olaolu.dev の 1,246px は Readability で不利、§4.8）
- `.bleed` = `grid-column: 1 / -1` で `--mg` を打ち消す — **維持。作品図版の「広」側で使う**
- **追加**: 作品ギャラリーの非対称リズム
  - **広**: `.bleed` 幅（1440 − 144 = 1,296px）の図版
  - **狭**: `.msr` 幅（720px）の図版
  - 3 件を 広 / 狭 / 広 で組む

### 11.4 Image ratio / project thumbnail

| 用途 | 比率 | 表示寸法 | 処理 |
|---|---|---|---|
| Gallery 図版（広） | **16:10** | 幅 1,296px / 高さ 810px → **上下クロップして高さ 480–560px** | `object-fit: cover`。縮小しない |
| Gallery 図版（狭） | **16:10** | 幅 720px / 高さ 450px | 同上 |
| Mobile 図版 | **4:3 寄り** | 幅 = 画面幅 − 32px / 高さ **≥ 200px** | **横をクロップ**。縮小して全体を入れない（§5-F） |
| Work index 行（6 件以上になったとき） | 3:2 | 高さ 96–120px | 現行 `Register` の `.thumb` 相当 |

**原則（現行 `tokens.css` の方針を継承）: スクリーンショットには filter / dim / blend / skew を一切かけない。** 変えるのは周囲だけ。

### 11.5 Card shape / Border / Background

**カードを作らない。** seanhalpin の radius 64px は採らない（§7-10）。現行 `EditorialBand.astro` が明示する「箱・角丸・影・余白の島を作らない register」を維持する。

代わりに **plate + hairline + pigment** で同じ「まとまり」を作る:

| 要素 | 値 |
|---|---|
| 図版の下地 | `--plate`（`#E3DFD5` / dark `#181B1F`） |
| 図版の縁 | `--stage-ring`（`#B9B3A5`）1px。枠ではなく縁 |
| ブロック区切り | `--hair`（`#CFCABE`）1px のヘアライン |
| border-radius | **0** |
| box-shadow | **無し** |
| 作品の識別色 | `--sig` / `--sig-bg`（crm 緑 / ppm 青 / dfe 橙）を**作品名の前のスクエア（`.sq`）と rail の節番号にのみ**使う |
| 地色 | `--paper`。CONTACT のみ `.inv` で反転（現状維持） |

**pigment を増やさない。** 3 作品 = 3 色の規律を守る（seanhalpin の 4 パステルは採らない、§7-10）。

### 11.6 Visual depth

現行 HERO の 3 層（`hf-plate` の `--plate` 面 + 列グリッド / 罫線 / 前面のテキスト）は**成功している表現なので維持**する。これを**作品ギャラリーへ拡張**する:

- **背面**: `--plate` の面を、図版の下に図版より広く敷き、右または左へ `bleed` させる
- **中間**: ヘアラインと `data-mx-n` の大型背景数字（既存表現）
- **前面**: 図版本体 + キャプション

**図版が plate の端をまたぐ**ようにする（HERO の display が plate の左端をまたぐのと同じ構図）。これが「カードを使わずに深度を出す」唯一の手段であり、既に site 内で成立が確認できている表現である。

### 11.7 Hover

| 対象 | 現行 | 提案 |
|---|---|---|
| Gallery ブロック全体 | — | 図版の `--stage-ring` が `--sig` に変わる。**図版そのものは動かさない**（拡大・ズーム・パンをしない） |
| Case Study リンク | `.lk` + `.ar`（→） | 矢印が 4px 右へ。維持 |
| Register 行 | 既存 | 維持 |
| Evidence 図 | `ui.evidence.zoom`（原寸で開く） | 維持 |

**画像を hover で拡大しない。** 業務画面は既に情報密度が高く、動くと読みにくくなる。

### 11.8 Entry animation

- HERO: 現行の build-into-view を維持（`11a44a9`）
- 作品図版: 初回進入時のみ `opacity 0→1`（180–240ms）+ `translateY(4px→0)`。**テキストは動かさない**
- `prefers-reduced-motion: reduce` で全て無効（既存ゲート）

### 11.9 Scroll animation

- **rail を sticky にする**（§6-7）。`.tr > .ins` に `position: sticky; top: <nav 高 + 16px>`。1023px 以下では解除
- **それ以外のスクロール連動は追加しない**。パララックス無し、ピン留め無し、横送り無し

### 11.10 Mobile transition

- ページ遷移アニメーションは**追加しない**（Astro の標準遷移のまま）
- セクション内の入場アニメーションはデスクトップと同じ（reduced-motion 尊重）
- MobileBar（下部固定）は**維持**し、**`CONTACT` を含める**

---

## 12. Desktop 方針

**基準ビューポート: 1440 × 900。検証は 1440 / 1280 / 1024 の 3 点。**

### 12.1 First viewport（≤ 900px）に入れるもの

| Y（目安） | 要素 |
|---|---|
| 0–72 | nav（handle + kicker + 4 セクション、CONTACT を含む） |
| 96–520 | rail（`00` / role / capability 3 組）+ display（一文）|
| 520–600 | stack line + lede + **CTA 2 つ** |
| 600–900 | **01 WORK の 1 枚目の図版上端（≥ 120px 可視）** |

SYNTHETIC DATA 帯は F1 に置かない。

### 12.2 レイアウト

- `.page` 1440 / `--mg` 72px / `.tr` = 200 + 1fr / gap 56 / 227px ヘアライン — 維持
- `.msr` 720px（散文）/ `.fld` 全幅（図版・表）— 維持
- 作品ギャラリー: 広（`.bleed` 1,296px）/ 狭（`.msr` 720px）/ 広 の 3 行
- rail は sticky

### 12.3 セクション高さの上限（目標）

| セクション | 上限 |
|---|---|
| 00 HERO | 600px |
| 01 WORK（3 件合計、見出し含む） | 3,200px（1 件 ≤ 900px） |
| 02 CAPABILITIES | 700px |
| 03 ABOUT | 600px（既定表示時） |
| 04 CONTACT | 450px |
| **合計** | **≤ 6,000px** |

### 12.4 1280 / 1024 での退避

- 1280: `--mg` を 56px へ。広い図版は 1,168px
- 1024: `.tr` の rail を 160px、gap 40px。非対称リズムを**維持**（まだ 2 幅が区別できる）
- 1023px 以下: rail の sticky を解除し、rail をセクション頭の横並びへ（既存 `responsive.css` の挙動を踏襲）

---

## 13. Mobile 方針

**基準ビューポート: 390 × 844。検証は 390 / 360 / 320。**
既存ブレークポイント（1279 / 1023 / 767 / 389）を変えない。

### 13.1 First viewport（≤ 844px）の優先順位

| 順位 | 要素 | Y（目標） |
|---|---|---|
| 1 | nav（handle + kicker + INDEX） | 0–90 |
| 2 | display（**4 行以内**、34–36px） | 110–320 |
| 3 | stack line（1 行に省略）+ lede（2 行） | 340–430 |
| 4 | CTA（作品を見る / 連絡する） | 450–510 |
| 5 | **1 枚目の作品図版上端** | **≤ 760** |

現行は display が 40px × 6 行 = 302px、その上に SYNTHETIC 帯 70px があり、capability 3 組が続くため、最初の図版が y=1,321px にある。

### 13.2 削る / 移す

| 要素 | 現行（390px） | 方針 |
|---|---|---|
| SYNTHETIC DATA 帯 | 2 行・約 70px、F1 内 | **F1 から除去**。図版キャプションと ABOUT へ |
| HERO の capability 3 組 | display の直後 | **作品帯の後ろへ移動**（削除しない） |
| rail のラベル文字列 | `SELECTED WORK` 等を表示 | **節番号のみ**。ラベルは非表示 |
| CAPABILITIES の workflow 図（8 ステップ 3 レーン） | 2,508px | **トップから除去**（デスクトップと同じ） |
| Lead work entry | 4,199px（5 画面） | **廃止**。等価な 3 ブロックへ |
| セクション nav | MobileBar（下部固定） | **維持** + `CONTACT` を追加 |

> brittanychiang は mobile でセクション nav を `display:none` にしている（§4.1）。現行は MobileBar という良い解を既に持っているので、そちらを維持する方が上。**ただし CONTACT が無い**のは直す。

### 13.3 タイポの縮小率

seanhalpin の実測比（§4.11）を基準にする。

| 役割 | Desktop | Mobile | 比 |
|---|---|---|---|
| `.dsp` | 68px | **34px** | 0.50 |
| 作品名 | 32px | **22px** | 0.69 |
| `h2` | 40px | **26px** | 0.65 |
| `.lede` | 19px | **17px** | 0.89 |
| 本文 | 17px | **16px** | 0.94 |
| `.mo` / `.lb` | 11px | 11px | 1.0 |

**display を最も強く縮め、本文は据え置く。**

### 13.4 図版

- **1 カラム**。非対称リズムは捨てる（seanhalpin も mobile では 315×320 の均一）
- 幅 = 画面幅 − 32px（390 なら 358px）
- **高さ ≥ 200px を確保し、足りない分は横をクロップする。縮小して全体を入れない**（§5-F）
- `loading`: 1 枚目は `eager`、2 枚目以降は `lazy`（現行の方針を踏襲）

### 13.5 全長

| 指標 | 現行 | 目標 |
|---|---|---|
| 全長 @390 | 14,112px（16.7 画面） | **≤ 8,000px（≤ 9.5 画面）** |
| 1 作品ブロック | 4,199px（Lead） | **≤ 1,100px** |

参考: seanhalpin は 8 作品で 3,194px（3.8 画面）。

### 13.6 320px

- `.dsp` を 30px へ。display は 5 行まで許容
- 図版の高さ下限は 180px
- CTA は縦積み

---

## 14. Phase 2 / Phase 3 への引き継ぎ事項

### 14.1 Phase 2 着手前に承認が必要なもの（ブロッカー）

| # | 項目 | 理由 |
|---|---|---|
| B-1 | **`.dsp` のサイズ変更（`min(90px,8.65cqi)` → `min(68px,6.6cqi)`）** | `tokens.css` / `base.css` は凍結プロトタイプからの再出力であり、ヘッダに「Do not restyle here: a visual change needs the freeze re-opened.」と明記されている。**art direction の凍結解除の承認が要る** |
| B-2 | **`site.json` の `sections` 変更**（`build` のラベルを `HOW I BUILD` → `CAPABILITIES`、`contact` の `label` を `null` → `CONTACT`） | nav と節番号の正本。`check:structure` の期待値に影響する |
| B-3 | **SYNTHETIC DATA 帯の F1 からの移設** | 掲載ポリシーに関わる。**表示を減らすのではなく場所を変える**という理解の共有が要る |
| B-4 | **Lead work entry のトップからの廃止** | `homepageRole: "lead"` と `lib/review/lead-candidate.ts`（Lead A/B レビュー機構）の前提が変わる。Phase 5 で決めた「Lead = AI CRM」という決定の**扱い**を確認する必要がある |
| B-5 | **HOW I BUILD 詳細の移設先** | `/work/{slug}/technical/` に入れるか、方法論専用ページを新設するか未決。`site.json.howIBuild` のデータ自体は削らない |
| B-6 | **Email を公開するか** | 公開しない場合の代替窓口（GitHub Issues / Discussions / フォーム）を決める必要がある |

### 14.2 Phase 2 で実装するもの（承認後）

1. `site.json` の `sections` 更新（B-2）
2. HERO の圧縮 — display サイズ、SYNTHETIC 帯の移設、CTA 2 つの追加
3. `SelectedWork.astro` の再構成 — Band / Lead / index の 3 構造を、等価な 3 ブロックの gallery に統合
4. 作品図版コンポーネント — 16:10 クロップ、plate + ring、広 / 狭の 2 幅
5. `HowIBuild.astro` → CAPABILITIES への圧縮（workflow 図の移設）
6. `About.astro` の 2 層化（/NOW + 展開）
7. `Footer.astro` に CTA と Email コピー
8. `MobileBar` に CONTACT を追加
9. rail の sticky 化
10. `motion.css` に図版の進入アニメーションを追加

### 14.3 Phase 2 で触らないもの

- 書体（`--f-min` / `--f-ui` / `--f-mono`）
- 色トークン（`--paper` / `--ink` / `--sig` 3 色 / `.inv`）
- `.page` / `.tr` / `.msr` / `.bleed` のグリッド
- Case Study ページ（`/work/{slug}/`）と Evidence 機構
- 検証ゲート（`validate:content` / `check:links` / `check:structure` / `check:attestation` / `scan:public`）の**存在**
- `site.json` の `stack` / `principles` / `evidenceSection` の**データ**（表示位置は変えるが、内容は残す）

### 14.4 検証ゲートへの影響（Phase 2 で更新が必要）

| ゲート | 影響 |
|---|---|
| `check:structure` | `data-hero-line` を 3 で固定している。display の行数・要素構成を変えるなら期待値の更新が要る。Band の 3 パネル前提（`B-BAND-COUNT` / `W-BAND-PARTIAL`）も、Band を廃止するなら見直す |
| `validate:content` | `homepageRole` / `featured` / `featuredOrder` の意味が変わるなら schema 側も |
| `check:links` | Case Study 導線が 3 本に増える（現行は Lead + index） |
| `check:attestation` | 新規コピー（CTA の文言、/NOW の 3 行）は**承認済みコピーとして登録が必要**。`src/content/copy/shipping.json` の `publication.reviewStatus` |

### 14.5 Phase 3 以降の検討事項

1. **作品が 6 件以上になったときの MORE セクション**（§10.4 の発動条件）
2. **方法論ページの独立**（HOW I BUILD の完全版をどこに置くか）
3. **Evidence をトップに 1 枚だけ戻すか**（`site.json.evidenceSection` は「1 枚だけ先に出す」設計で残っている）。調査では該当する前例が 15 件中 0 件のため、**このサイト固有の判断**になる
4. **英語版**（採用・案件の対象読者によっては必要）
5. **OG 画像**（SNS で共有されたときの first view。今回の調査対象外）
6. **性能計測**（図版が大きくなるため LCP への影響。Phase 2 完了後に Lighthouse で確認）

### 14.6 Phase 2 の完了判定

§10.10 の 10 指標を、本ドキュメントと同じ方法（`dist/` をローカル配信し 1440×900 / 390×844 で DOM 実測）で再計測し、全項目が目標値を満たすこと。

---

## 付録: Issue #4 Acceptance Criteria 対応

| Issue の完了条件 | 対応 | 状態 |
|---|---|---|
| 参考サイト 10 件以上を比較 | §3 に 17 件（うち稼働 15 件 + 終了・パーク 2 件を記録）、§4 に個別分析 | ✅ |
| HERO / Work / Projects / Skills / About / Contact の推奨構成を決定 | §10.2 / §10.3 / §10.4 / §10.5 / §10.6 / §10.7 | ✅ |
| Editorial Gallery + Engineering Portfolio としての UI 方向性を文章化 | §11（Typography / spacing / grid / image ratio / card shape / border / background / accent / depth / hover / entry / scroll / mobile transition） | ✅ |
| デスクトップ / モバイル双方の基本方針を定義 | §12 / §13 | ✅ |
| 次 Phase で実装可能な粒度まで落とし込む | §10.10（受け入れ数値 10 項目）/ §14（ブロッカー 6 件・実装項目 10 件・不変更項目・ゲート影響） | ✅ |

### Issue 本文の追加要求への対応

| 要求 | 対応 |
|---|---|
| 参考サイト最低 10 件・目標 15 件、URL を記録 | §3（17 URL） |
| 各サイトの HERO / PROJECT / UI / その他を記録 | §4 |
| 採用したい点 / 採用しない点 / 応用方法 | §4 各節 + §6 + §7 |
| 「おしゃれだから採用」の禁止 | 全評価に視線誘導 / 情報階層 / First View / Readability / Project discovery / Conversion / Responsive のいずれかの根拠を付記 |
| 現行 Portfolio の維持するもの / 捨てる候補 | §2（課題）+ §6（採用）+ §14.3（触らないもの） |
| 新トップページ案を最低 3 案 | §8（A / B / C + 基準線 D） |
| 各案の強み / 弱み / 採用向き / 副業向き / 実装難易度 / モバイル相性 | §9 |
| 最終推奨案 1 つ | §10（案 A） |
| 実装変更をしない | 本 Issue の成果物はこの Markdown 1 件のみ。`src/` 配下の変更は無い |
