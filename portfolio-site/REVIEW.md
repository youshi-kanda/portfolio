# REVIEW — art direction layer, V3.1

このディレクトリは Astro 製のポートフォリオサイト本体です。
このファイルは **レビューを頼まれた人向けの入口** で、どこを・どの順で読めばいいかだけを書いています。

- 対象ブランチ: `review/portfolio-site-art-direction-v3`
- 状態: **未 merge / 未 deploy**。`main` には入っていません。
- レビューして欲しいもの: **art direction layer の設計判断**（UI の構図・階層・グリッド）

---

## 1. まず前提

このサイトには **frozen stylesheet** という取り決めがあります。

```
src/styles/tokens.css      色・書体
src/styles/base.css        要素の既定値・タイプスケール
src/styles/layout.css      グリッド
src/styles/components.css  デザインシステム
src/styles/evidence.css    証跡まわり
src/styles/responsive.css  ブレークポイント
```

この 6 本は **凍結** されていて、art direction では触りません。
構図を動かす権限を持つのは次の 1 本だけです。

```
src/styles/motion.css              ← レビュー対象の本体（約 1,800 行）
src/components/motion/MotionStage.astro   ← 固定グラフィック層の DOM
```

`motion.css` を削除し、`<MotionStage />` と `data-mx-*` 属性を外すと、
サイトは art direction 着手前の姿に完全に戻ります。これは意図した設計です。

なお `motion.css` はコメントが非常に多いですが、**そのコメントが設計判断の記録そのもの**です。
「なぜその数値なのか」は基本的に該当箇所のコメントに書いてあります。

---

## 2. 読む順序

### (a) 冒頭 1–120 行 — 語彙の定義

art direction は **4 つの視覚文法しか使わない**と宣言しています。
5 つ目を足していないか、という観点が全体のレビュー軸になります。

| | 文法 |
|---|---|
| A | SECTION NUMBER — セクション番号を背景の大きな数字（folio）として置く |
| B | GATE / RULE — 「1px の罫を signal colour で左から引く」というシステム既存の唯一のジェスチャ |
| C | PLATE — 次のセクションが物理的な板として下から覆う（opacity フェードではない） |
| D | OFFSET — グリッドは保持したまま、開始位置だけをずらす |

### (b) セクション別（`motion.css` 内の見出しを追う）

```
  1. HERO                   100svh stage
  2. INSTRUMENT RAIL        sticky
  3. FIXED GRAPHIC LAYER    grammar B を連続した線にしたもの
  A. SECTION NUMBER         folio
  4. DISPLAY TYPOGRAPHY     drawn in
  B. SECTION TRANSITION     signal colour + rule-draw
  C. PLATE
  D. WORK REGISTER          held grid / moved starts
  WORK 01 CRM / 02 PPM / 03 DFE   3 作品それぞれ別の到着の仕方
  02 HOW I BUILD            3 レーンを横断する 1 本の path
  ===== ART DIRECTION V3 =====
  03 ENGINEERING STACK      two related instruments, each on its own gutter
  04 ENGINEERING PRINCIPLES the index, and a rhythm the content owns
  05 FEATURED EVIDENCE
  06 ABOUT
```

---

## 3. 直近で決着した論点（再提案不要）

### §1 STACK の軸を 1 本に統合する案 → **REJECT 済み**

03 ENGINEERING STACK には縦罫（axis）が 2 本あり、x が 50px ずれています。
これを 1 本に揃える案を実装して実測した結果、棄却しました。

```
LANGUAGES  ラベル列 210px + column-gap 32px  → 溝の中央 226px（page x 554 @1440）
PLATFORM   tbody th 184px + padding-right 20px → 溝の中央 176px（page x 504 @1440）
```

50px の差は drift ではなく、**各グループのラベル列が開く gutter の中心の差そのもの**です。
`th, td` は `padding-left: 0` なので detail セルの本文インクは th の右端から始まり、
226px に統一すると軸が detail セルに 42px 食い込んで **6 行すべての本文を横切りました**
（1024 / 1440 / 1920 のいずれでも侵入量は同じ 42px）。

`tbody th` を 184 → 236px にすれば貫通は解消しますが、それは frozen table の
column geometry の変更にあたるため不採用としました。

根拠フレーム:

```
review-pack-v3.1/stack/_abc-seam.png       現行 / 統合案 / th 236px 案 の 3 段比較
review-pack-v3.1/stack/_zoom-row1-10x.png  10 倍。統合案の軸が PostgreSQL の g と r の
                                           あいだを通っているところ
```

この経緯は `motion.css` の該当宣言ブロックに `DO NOT UNIFY THESE` として残してあります。

---

## 4. まだ決まっていない論点（**ここに意見が欲しい**）

どちらも **ソースには入れていません**。ブラウザに CSS を実行時注入して撮った A/B だけがあります。

### 未決 1 — 04 PRINCIPLES の階層

各 decision 行の頭にある index 数字（01…08）が 34px あり、
Mincho の decision 見出し（19px）より大きい。判断の記述より通し番号のほうが強い、という状態です。

提案 B: index を 34px → 11px の kicker に落とし、色を `--tx3` 固定にする
（現行は work が変わる行だけ signal colour）。96px の shoulder と decision の書体は維持。

```
review-pack-v3.1/principles-ab/_ab-index-closeup.png   A / B / B' の等倍クローズアップ
review-pack-v3.1/principles-ab/_ab-principles.png      A|B の 5 フレーム比較
```

`B'` は kicker を shoulder の x=0 に置いた別解です（B は decision と同じ x に置いたもの）。

副作用: B は行高が +20px、document height が 18081 → 18241 になります。

### 未決 2 — モバイルの folio を残すか

390x844 では、セクション冒頭の大きな番号（folio）が、その 12px 下のレールが
印字している番号と重複して見えます。消す案の比較:

```
review-pack-v3.1/mobile-folio-ab/_ab-mobile-folio.png
```

folio は geometry を一切持たないため、ON / OFF どちらも document height は 24409 で同一です。
つまり判断は純粋に「薄い数字を置くかどうか」だけです。

---

## 5. 品質ゲートの現状

```
npm run qa   = validate:content → astro check → node:test → build → check:links
```

現在: tests 80/80 pass、DEAD_LINKS 0 / DEAD_ANCHORS 0 /
ACCESSIBILITY_CONTRACT・SEO_METADATA・CANONICAL_URLS・SITEMAP・ROBOTS・ERROR_DOCUMENT
すべて PASS。

art direction は **copy を一切変更していません**。9 ルートすべての可視テキストは
着手前と同一です。Evidence（スクリーンショット）にも filter / transform / opacity /
crop を一切かけていません。これは `review-pack-v3.1/qa/_runtime-final.json` に実測値があります。

---

## 6. 画像について

`review-pack-v3.1/` の PNG は **すべて実ブラウザの描画**です（Chrome + CDP,
deviceScaleFactor 1）。filter・色補正・演出目的のトリミングは一切かけていません。
個別 PNG は等倍のビューポートそのまま、contact sheet は元 PNG を比例縮小して
並べただけで、ラベルは画像の外側に置いてあります。

全実測値は `review-pack-v3.1/README.txt` にあります。

---

## 7. レビューで見て欲しい観点

1. **4 つの文法に収まっているか** — 5 つ目の語彙が紛れ込んでいないか
2. **数値が導出されているか** — 目分量の数字が残っていないか（コメントに導出が書かれているはず）
3. **未決 1 / 未決 2 の採否**
4. frozen stylesheet の 6 本に手が入っていないこと（`git log` / diff で確認できます）
