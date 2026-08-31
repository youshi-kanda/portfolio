VISUAL REVIEW PACK — V3.1
TASK: STACK AXIS（結論: 統合 REJECT・現行 2 軸を維持）
      + PRINCIPLES A/B + MOBILE FOLIO A/B
branch feature/motion-experience-v2 / 未 commit / main (a4e8ee8) は無変更

撮影対象: http://localhost:5002/ (dist / production build を静的配信)
撮影環境: Chrome headful + CDP / deviceScaleFactor 1 / 実ブラウザ描画のみ
加工: filter / colour correction / 演出 crop は一切なし。個別 PNG は
      ビューポートそのまま等倍。sheet 類は元 PNG を比例縮小して並べただけで、
      ラベルはフレームの外の紙地に置いてある。


── §1 STACK AXIS の結論 ────────────────────────────────────────

  226px への統合は REJECT。PLATFORM は 176px のまま。

    STACK_AXIS  LANGUAGES 226px（page x 554 @1440）
                PLATFORM  176px（page x 504 @1440）
    STACK_TEXT_INTERSECTION = 0   （1024 / 1440 / 1920 で実測、下記）
    TABLE_GEOMETRY_CHANGED  = NO  （tbody th は 184px のまま）

  50px の差は drift ではなく、各 group の label column が開く gutter の
  中心の差そのもの:
    LANGUAGES  ラベル列 210px + column-gap 32px → 溝の中央 226px
    PLATFORM   tbody th 184px + padding-right 20px → 溝の中央 176px

  統合を一度実装して実測した結果、th の右端 = detail 本文インクの開始位置
  （th,td は padding-left:0）なので、軸は detail セルに 42px 食い込み、
  6 行すべての本文を貫いた。1024 / 1920 でも侵入量は同じ 42px。
  C 案（tbody th 184 → 236px）は貫通を解消するが frozen table の column
  geometry 変更にあたるため不採用。よって統合は棄却し、元に戻した。

  実測（現行 = 最終状態、3 幅とも）:
    PLATFORM 軸上のグリフ交差 = 0 行
    LANGUAGES 軸を PLATFORM に流用した場合の交差 = 6 行（全行）

  ソースの状態:
    --mx-ax2: 176px            復元
    background-position        var(--mx-ax2) 0 に復元
    CSS 宣言レベルの diff       着手前の V3 と完全一致（0 件）

  コメントも現在の事実に合わせて修正した:
    §03 の見出し
      "two instruments at two scales, on one axis"
    →"two related instruments, each on its own gutter"
    AXIS の段落に「各軸は自分の group の gutter に置く。共有の page x では
    ない」旨を追記。宣言ブロックには両方の x の導出、統合を試して測った
    結果（42px 侵入・全 6 行貫通）、C 案が不可である理由を DO NOT UNIFY
    として残した。次に同じ統合を思いついた人が測り直さずに済むようにした。

  ファイル:
    stack/final/                      現行 = 最終状態 A–D
                                      _geom-reshoot-after-revert.json は
                                      revert 後の再撮影で得た実測値
    stack/rejected-unified-226/       統合案（REJECT）の記録
    stack/rejected-variantC-th236/    C 案（REJECT）の記録・injection のみ
    stack/_abc-seam.png               現行 / 統合案 / C 案の 3 段比較
    stack/_zoom-row1-10x.png          10 倍。統合案の軸が PostgreSQL の
                                      g と r のあいだを通っている
    stack/_zoom-axis-4x.png           4 倍比較
    stack/_ab-stack.png               現行|統合案 の 4 フレーム

  A stack-top / B stack-languages / C stack-seam / D stack-platform。
  C は最終 language 行・platform の group head・table 冒頭が 1 画面に入る
  停止位置で、2 本の軸を同時に見るために作ってある。


── §5 で直した stale comment ───────────────────────────────────

  folio §A は
    「numeral を持つ 3 つの section はいずれも .ev / .mfs plate を含まない
      ので、新しい stacking context が fixed layer の z-order を乱すことは
      ない」
  と書いてあった。V3 が folio を 03/04/05/06 へ広げた時点でこれは
  事実と食い違っている（#evidence は .ev を含む）。

  実際には §A の isolation:isolate が #evidence を stacking context にして
  .ev{z-index:4} を閉じ込めるため、`.ad #evidence{z-index:4}` が必要になる。
  その rule は 80 行下に既にあるが、§A 側が「その問題は起きない」と
  言い切ったままだったので、次の作業者が #evidence の z-index を
  装飾だと誤解して消せる状態だった。

  §A に、folio を持つ section に plate が入るときは section 自体を
  z-index:4 に上げる必要があること、その rule は load-bearing であること、
  #stack / #principles / #about には plate が無いので不要であることを
  明記した。§3 の .ev / .mfs 側にも §A への相互参照を 1 文だけ足した。

  実測での裏づけ（qa/_runtime-after.json）:
    #evidence z=4 / isolation=isolate / .ev z=4 / .mx-stage z=3
    fixed rule の x 上、Evidence 画像の上端 +20px にある要素 = IMG
    （= instrument line は screenshot を横切っていない）


── §2 PRINCIPLES — A/B のみ・ソース未変更 ──────────────────────

  ソースには 1 文字も入れていない。B は runtime injection（<style>）。

  B の中身:
    index  34px → 11px / letter-spacing .16em
    色     --tx3 固定（open 行の --sig を外す）
    位置   decision text の上の kicker へ
    保持   96px shoulder / Mincho decision は無改訂（19px のまま row 最大）

  「decision text 上の kicker へ」は kicker の x について 2 通りに読めた
  （decision と同じ x か、shoulder の x=0 か）。宣言 1 行差で結論が変わる
  ので両方撮ってある。B が前者、B' が後者。

  フレーム（1440x900）:
    1 entry / 2 first-open-group / 3 continuation /
    4 group-transition / 5 final-07-08
    principles-ab/_ab-principles.png       A|B 5 段
    principles-ab/_ab-index-closeup.png    A / B / B' の等倍クローズアップ

  副作用として B は row 高が +20px（177/133 → 197/153）、
  document height が 18081 → 18241 になる。採用する場合は
  progress tick の位置がこの docH 変化ぶんだけ動く。


── §6 MOBILE FOLIO — A/B のみ・ソース未変更 ────────────────────

  390x844。B（folio OFF）は runtime injection で 03–06 の numeral を
  content:none にしただけ。他は何も触っていない。

    mobile-folio-ab/A-folio-on/    03 / 04 / 05 / 06
    mobile-folio-ab/B-folio-off/   同上
    mobile-folio-ab/_ab-mobile-folio.png

  document height は ON / OFF どちらも 24409 で完全一致。停止位置も 4 点とも
  同値。folio は geometry を一切持っていないので、判断は純粋に
  「section 冒頭に薄い numeral を置くかどうか」だけになる。


── §7 QA / REGRESSION ──────────────────────────────────────────

  比較方法: motion.css を着手前の V3 に戻して rebuild → 同じ script で
  同じ 31 フレームを撮影 → pixel diff（channel delta > 2）。
  qa/_pixel-diff.txt に 2 パス分の全結果がある。

  PASS 2（= 最終状態）: 31 フレームすべて IDENTICAL。差分ゼロ。
    desktop 12（hero 0/281/545 の frozen 3 点を含む）/ mobile 7 /
    他 8 ルート / reduced-motion 2 / no-JS 2 — すべて 1px も動いていない。
    runtime 値（_runtime-final.json）も着手前と完全一致。
    stack の 4 フレームも revert 後の再撮影で着手前と完全一致を確認済み。

  PASS 1 は棄却した統合案が何を動かしていたかの記録として残してある:

    差分は reduced-motion stack の 1 フレームのみ・674px / 0.0520% で、
    x-columns = [504, 554] の 2 列に完全に閉じていた。つまり統合案は
    「504 の rule が消えて 554 に現れる」以外に何も動かしていなかった。
    それでも本文を貫くため棄却した、という順序で読むこと。

  Evidence invariant（qa/_runtime-*.json、前後で完全一致）:
    natural 1100x1276 / box 937x560 / x=116 / crop 937 / block 72+1025
    filter none / transform none / opacity 1 / blend normal / clip none

  no-JS / reduced-motion での軸の状態（最終状態）:
    LANGUAGES srowPos 226px / PLATFORM trPos 176px / どちらも size 1px 100%
    → JS 無し・motion 抑制でも軸は初期状態に取り残されず全高で描かれる。

  PROGRESS TICK:
    .mx-tick は animation-timeline: scroll(root block) で駆動されるので、
    位置は scrollY / (docH - vh) の関数であり docH に依存する。
    今回 docH は desktop 18081 / mobile 24409 で着手前・最終とも同値のため、
    「docH 由来の位置差」は 0 であり、geometry regression も 0。
    実測（qa/_tick.json）: x=298 固定、translateY は 0 → 761 の線形。
    この 2 つは別物なので、docH が変わる変更（例: §2 の B）を採る場合は
    tick が動くこと自体は regression ではない、と切り分けて読むこと。

  npm run qa: validate:content / astro check / node:test (80/80) /
              build / check:links すべて PASS。
              DEAD_LINKS 0 / DEAD_ANCHORS 0 / ACCESSIBILITY_CONTRACT PASS /
              SEO_METADATA PASS / CANONICAL_URLS PASS / SITEMAP PASS /
              ROBOTS PASS / NOINDEX_RESIDUAL 0 / ERROR_DOCUMENT PASS


── 変更していないもの ──────────────────────────────────────────

  §1 STACK 軸        LANGUAGES 226px / PLATFORM 176px（着手前と同じ）。
                     tbody th 184px も無改訂。
  §3 FEATURED EVIDENCE   horizontal rule 終端・Evidence の x / w / crop /
                         pixels・#evidence{z-index:4}  すべて現状維持。
  §4 ABOUT               rule 1025px / value measure 720px /
                         folio 06 opacity  すべて現状維持。motion 追加なし。
  copy                   9 ルートすべて無改訂。
  commit / merge / deploy  いずれも未実行。
