#!/usr/bin/env bash
#
# stg-portfolio.neppepe.net の staging smoke test。rsync 後に GitHub runner から
# 実行する。隣にある production smoke と同じく、ディスク上のファイルではなく
# 公開 origin 越しに叩くので、nginx・TLS・成果物をまとめて検証できる。
# ただし production smoke とは目的が逆で、この script の第一の仕事は
# 「origin が公開されていないこと」を証明することにある。
#
# staging は公開前レビュー環境であり、Issue #36 はそれを「運用上の慣習」から
# 「アクセス境界」へ格上げするもの。すなわち、credentials が無ければ origin は
# 応答を拒否しなければならず、この script はその拒否を gate にする。
#
# `noindex` は別レイヤであり、ここでは意図的に検証しない。staging は既に nginx
# から `X-Robots-Tag: noindex, nofollow, noarchive` を全 response に返している。
# これは検索エンジン向けのレイヤで Issue #34 の管轄であり、アクセス制御ではない
# ——crawler に「URL を一覧に載せないでくれ」と頼むだけで、既に URL を知っている
# 相手には何も要求しない。両方を一つの script で gate すると、この 2 つの層が
# 混ざって区別できなくなる。
#
# credentials は argv にも log にも出さない。環境変数（GitHub Secrets）から
# mode-0600 の netrc file へ書き出し、curl にはその file を指定する。`--user`
# だと process 一覧に user:pass が載ってしまうし、どちらも echo しない。runner は
# 使い捨てで、file は exit 時に削除する。
#
# 最初の失敗で止めない。staging deploy が 3 箇所壊れているなら、3 回 re-run させる
# のではなく 1 回で 3 箇所とも報告すべきだから。

set -uo pipefail

ORIGIN="${STG_ORIGIN:-https://stg-portfolio.neppepe.net}"
HOST=${ORIGIN#*://}
HOST=${HOST%%/*}
HOST=${HOST%%:*}

# ローカル変数へ複製せず、その場で default を与えている。`scan:public` は本
# repository の tracked file を全て読み、その CREDENTIAL rule は「credential 的な
# 名前に quote 付きの値を代入している行」に一致する。ここで password を受ける
# ローカル変数を作ると、まさにその形になって検出される——そしてそれは rule が
# 正しく働いている。rule には環境変数経由の間接参照とハードコードの区別がつかず、
# 区別しようとする rule はむしろ弱い rule になる。だから secret ごとに名前は 1 つ、
# しかも GitHub 側で登録されている名前そのものを使う。
: "${STG_BASIC_USER:=}"
: "${STG_BASIC_PASS:=}"

# hero にしか存在しない文字列。placeholder にも error page にも含まれ得ない。
# home page が返ってきてもこれが無ければ、staging はこの build を配信していない。
HERO_MARKER='業務で使える Web・AI システムへ。'
# build 後のサイト自身の error document。
NOTFOUND_TITLE='404 — ページが見つかりません。'

fails=0
ok()    { printf '  ok    %s\n' "$*"; }
bad()   { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }
note()  { printf '  --    %s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }

body=$(mktemp)
hdrs=$(mktemp)
netrc=$(mktemp)
trap 'rm -f "$body" "$hdrs" "$netrc"' EXIT
chmod 600 "$netrc"

# mode は 2 つ。どちらで動くかは credentials が設定されているかどうかだけで決まる。
# 誰かが切り替えを覚えておかなければならない flag にはしない。
#
#   guarded  — STG_BASIC_USER と STG_BASIC_PASS の両方が設定済み。アクセス境界を
#              検証する。すなわち anonymous request は拒否されなければならず、
#              認証ありの request は成功しなければならない。
#   open     — どちらも未設定。portfolio-site/DEPLOY.md §10 の一度きりの server
#              作業が終わるまでの、この repository の現状。到達性の check は
#              anonymous のまま従来どおり実行される（以前の inline smoke と同じ）。
#              境界は「黙って前提にする」のではなく NOT VERIFIED と明示する。
#
# 第 3 の mode は無い。片方だけ設定された状態は設定ミスなので、推測で補わず拒否する。
if [ -n "$STG_BASIC_USER" ] && [ -n "$STG_BASIC_PASS" ]; then
  MODE=guarded
  printf 'machine %s\n  login %s\n  password %s\n' "$HOST" "$STG_BASIC_USER" "$STG_BASIC_PASS" > "$netrc"
elif [ -z "$STG_BASIC_USER" ] && [ -z "$STG_BASIC_PASS" ]; then
  MODE=open
else
  echo "::error::Exactly one of STG_BASIC_USER / STG_BASIC_PASS is set. Set both or neither." >&2
  exit 1
fi

printf 'origin: %s\nmode:   %s\n' "$ORIGIN" "$MODE"

# anonymous 用。netrc を渡さないので、事故で credential が混入する余地が無い。
anon() { curl -sS --max-time 20 "$@"; }

# 認証材料がある場合のみ認証する。`open` mode では `anon` と同一の request になる
# ——それが狙いで、到達性の check は両 mode で全く同じように読め、違うのは
# 境界を検証するかどうかだけになる。
auth() {
  if [ "$MODE" = guarded ]; then
    curl -sS --max-time 20 --netrc-file "$netrc" "$@"
  else
    curl -sS --max-time 20 "$@"
  fi
}

# ------------------------------------------------------------------ home page --
head_ "home page"

# deploy 直後は nginx の open_file_cache と競合することがある。数秒の窓のせいで
# 正常な release を落とさないよう、回数を区切って retry する（無制限には待たない）。
status=""
for attempt in 1 2 3 4 5 6; do
  status=$(auth -o "$body" -w '%{http_code}' "$ORIGIN/")
  if [ "$status" = "200" ] && grep -qF "$HERO_MARKER" "$body"; then break; fi
  [ "$attempt" -lt 6 ] && sleep 5
done

[ "$status" = "200" ] && ok "/ -> 200" || bad "/ -> $status (expected 200)"

if grep -qF "$HERO_MARKER" "$body"; then
  ok "hero copy present"
else
  bad "hero copy absent — staging is not serving this build"
fi

# このホストの TLS は Certbot 管理。更新が静かに止まっていた場合、ここで気付けば
# 安いが、browser で気付くと高くつく。なお更新はこの境界の影響を受けない。
# Certbot の nginx authenticator は port 80 上で HTTP-01 を解決し、DEPLOY.md §10 は
# `auth_basic` を :443 の server block にしか置かないので、challenge path が
# 境界の内側に入ることは無い。:443 側に `/.well-known/acme-challenge/` の例外を
# 作っていないのはそのためで、だから検証すべき例外も存在しない。
if [ "$(auth -o /dev/null -w '%{ssl_verify_result}' "$ORIGIN/")" = "0" ]; then
  ok "TLS verifies"
else
  bad "TLS did not verify"
fi

# asset 名はここに書かず、今取得した page から読み取る。hash 付き asset 名は build
# ごとに変わるので、script に列挙すると次の build で必ず陳腐化するから。
asset=$(grep -o '/_astro/[A-Za-z0-9._-]*\.\(css\|js\)' "$body" | head -n 1)
if [ -n "$asset" ]; then
  note "asset: $asset"
else
  bad "no /_astro/ asset referenced by / — cannot check the asset boundary"
fi

# ------------------------------------------------------------------ boundary --
head_ "access boundary"

if [ "$MODE" = open ]; then
  note "no credentials configured — boundary NOT VERIFIED (portfolio-site/DEPLOY.md §10)"
else
  # `/` だけでなく、第三者が入力し得る path を全て見る。`auth_basic` を server
  # レベルではなく `location /` の中に書いてしまうと、home page だけが守られて
  # 残りは全部読めてしまう。しかもその設定ミスは、誰かが実際にそれらの path を
  # 叩くまで「動いているように見える」。
  #
  # 期待する拒否は「200 以外なら何でもよい」ではなく 401 そのもの。§10 が設定する
  # のは nginx の `auth_basic` で、その拒否は Basic challenge を伴う 401 になる。
  # 403 でも build は非公開のままなので leak としては報告しない——が、この runbook
  # が記述している境界ではないので、黙って受け入れることもしない。
  anon_refused() {
    local lbl=$1 url=$2 st
    st=$(anon -o /dev/null -D "$hdrs" -w '%{http_code}' "$url")
    case "$st" in
      401) ok   "anonymous $lbl -> 401" ;;
      403) bad  "anonymous $lbl -> 403 — refused, but not by auth_basic (§10 configures a 401 boundary)" ;;
      *)   bad  "anonymous $lbl -> $st — SERVED WITHOUT CREDENTIALS" ;;
    esac
  }

  anon_refused "/" "$ORIGIN/"

  # status line だけでなく challenge 本体も確認する。nginx は `auth_basic` による
  # 401 には必ずこの header を付けるので、この header が無い 401 は auth_basic 由来
  # ではない（=想定した境界が効いていない）ということになる。
  if grep -qi '^WWW-Authenticate:[[:space:]]*Basic' "$hdrs"; then
    ok "anonymous / carries WWW-Authenticate: Basic"
  else
    bad "anonymous / has no WWW-Authenticate: Basic challenge"
  fi

  # hash 付き asset は未公開 build そのもの。crawler 向けの header は、これらに
  # 対しては何の防御にもならない。
  [ -n "$asset" ] && anon_refused "asset ($asset)" "$ORIGIN$asset"

  # robots.txt と sitemap.xml は「公開しておくもの」という先入観のせいで、最も
  # 境界の外に取り残されやすい 2 つ。とくに sitemap は未公開 build の全 route を
  # 列挙してしまう。
  anon_refused "/robots.txt"  "$ORIGIN/robots.txt"
  anon_refused "/sitemap.xml" "$ORIGIN/sitemap.xml"

  # 未知の path は error document に到達する前に拒否されなければならない。ここが
  # 404 なら error document が anonymous に応答しているということで、遠回りに
  # 同じ穴を開けているのと変わらない。
  anon_refused "/no-such-page/" "$ORIGIN/no-such-page/"
fi

# --------------------------------------------------------------------- assets --
head_ "assets"

if [ -n "$asset" ]; then
  [ "$(auth -o /dev/null -w '%{http_code}' "$ORIGIN$asset")" = "200" ] \
    && ok "authenticated asset -> 200" \
    || bad "authenticated asset -> not 200"
fi

# --------------------------------------------------------------------- routes --
head_ "routes"

# route 一覧は、この deploy が今公開した sitemap から取る。script に書いた件数と
# 突き合わせるのではなく、staging 自身の「何が存在するか」という申告と突き合わせる
# ことになる。
#
# 成果物が宣言している origin は *production* のもの（astro.config.mjs の `site:`）
# で、それが正しい——staging は production 成果物をそのまま配信しており、この
# script もそれ以外を主張しない。したがって sitemap の絶対 URL は、request する前に
# staging の origin へ読み替える。
sitemap=$(mktemp)
sm_status=$(auth -o "$sitemap" -w '%{http_code}' "$ORIGIN/sitemap.xml")
if [ "$sm_status" = "200" ] && grep -qi '<urlset' "$sitemap"; then
  ok "/sitemap.xml -> 200, XML"
  count=0
  while read -r path; do
    [ -n "$path" ] || continue
    count=$((count + 1))
    st=$(auth -o /dev/null -w '%{http_code}' "$ORIGIN$path")
    [ "$st" = "200" ] && ok "$path -> 200" || bad "$path -> $st (expected 200)"
  done < <(grep -o '<loc>[^<]*</loc>' "$sitemap" \
             | sed -e 's|</\?loc>||g' -e 's|^https\?://[^/]*||' \
             | sed -e 's|^$|/|' | sort -u)
  note "sitemap routes checked: $count"
  [ "$count" -gt 0 ] || bad "sitemap contained no <loc> entries"
else
  bad "/sitemap.xml -> $sm_status (expected 200 XML)"
fi
rm -f "$sitemap"

[ "$(auth -o /dev/null -w '%{http_code}' "$ORIGIN/robots.txt")" = "200" ] \
  && ok "/robots.txt -> 200" \
  || bad "/robots.txt -> not 200"

# ------------------------------------------------------------------- not found --
head_ "error document"

# こちらは認証ありの request なので 404 が正解——200 でも 401 でもない。200 なら
# runbook §4.1 が blocker として扱う SPA catch-all が効いているということ。401 なら
# credentials 自体が受け付けられていないということになる（anonymous でここが拒否に
# なることは、上の boundary section で既に確認済みだから）。
nf_status=$(auth -o "$body" -w '%{http_code}' "$ORIGIN/no-such-page/")
[ "$nf_status" = "404" ] && ok "/no-such-page/ -> 404" \
  || bad "/no-such-page/ -> $nf_status (expected 404)"
grep -qF "$NOTFOUND_TITLE" "$body" && ok "site's own 404 body" \
  || bad "404 body is not the site's own error document"

# ---------------------------------------------------------------------- verdict --
printf '\n'
if [ "$fails" -eq 0 ]; then
  if [ "$MODE" = open ]; then
    echo "STAGING_SMOKE = PASS (boundary NOT VERIFIED — see portfolio-site/DEPLOY.md §10)"
  else
    echo "STAGING_SMOKE = PASS"
  fi
  exit 0
fi
echo "STAGING_SMOKE = FAIL ($fails check(s))"
exit 1
