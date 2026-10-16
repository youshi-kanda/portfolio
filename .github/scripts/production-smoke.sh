#!/usr/bin/env bash
#
# Production smoke for portfolio.neppepe.net, run from the GitHub runner after
# the atomic switch. It talks to the public origin, so it exercises nginx, TLS
# and the artifact together rather than the files on disk.
#
# It does not stop at the first failure. A deploy that is wrong in three ways
# should say so once, not across three re-runs.
#
# Nothing here hard-codes how many routes the site has. The route list comes
# out of the sitemap the deploy just published, so this checks the live site
# against its own claim about what exists.

set -uo pipefail

ORIGIN="${PROD_ORIGIN:-https://portfolio.neppepe.net}"

# A string from the hero that the placeholder cannot possibly contain. If the
# home page is served but this is absent, the switch pointed somewhere wrong.
HERO_MARKER='現場で使える仕組みをつくる。'
# The placeholder that occupied this document root before the first deploy.
PLACEHOLDER_MARKER='Portfolio Test'
# The site's own error document, as built.
NOTFOUND_TITLE='404 — ページが見つかりません。'

fails=0
ok()   { printf '  ok    %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }
head_() { printf '\n== %s\n' "$*"; }

body=$(mktemp)
trap 'rm -f "$body"' EXIT

# ---------------------------------------------------------------- home page --
head_ "home page"

# nginx can hold a cached file descriptor for a moment after the symlink moves
# (open_file_cache). Give the switch a bounded chance to become visible rather
# than rolling a good release back over a two-second window.
status=""
for attempt in 1 2 3 4 5 6; do
  status=$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "$ORIGIN/")
  if [ "$status" = "200" ] && grep -qF "$HERO_MARKER" "$body"; then break; fi
  [ "$attempt" -lt 6 ] && sleep 5
done

[ "$status" = "200" ] && ok "/ -> 200" || bad "/ -> $status (expected 200)"

if grep -qF "$HERO_MARKER" "$body"; then
  ok "hero copy present"
else
  bad "hero copy absent — the live root is not serving this release"
fi

if grep -qF "$PLACEHOLDER_MARKER" "$body"; then
  bad "placeholder '$PLACEHOLDER_MARKER' still served"
else
  ok "placeholder absent"
fi

canonical=$(grep -o 'rel="canonical" href="[^"]*"' "$body" | head -1 | sed 's/.*href="//; s/"$//')
if [ "$canonical" = "$ORIGIN/" ]; then
  ok "canonical = $canonical"
else
  bad "canonical = '${canonical:-<none>}' (expected $ORIGIN/)"
fi

# --------------------------------------------------------------------- TLS ---
head_ "TLS"
verify=$(curl -sS -o /dev/null -w '%{ssl_verify_result}' --max-time 20 "$ORIGIN/")
[ "$verify" = "0" ] && ok "ssl_verify_result = 0" || bad "ssl_verify_result = $verify (expected 0)"

# ------------------------------------------------------- HTTP -> HTTPS -------
head_ "HTTP -> HTTPS"
read -r hstatus hredirect < <(
  curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 \
    "http://${ORIGIN#https://}/"
)
case "$hstatus" in
  301|308) ok "http:// -> $hstatus" ;;
  *)       bad "http:// -> $hstatus (expected 301 or 308)" ;;
esac
case "$hredirect" in
  "$ORIGIN/"*) ok "redirects to $hredirect" ;;
  *)           bad "redirects to '${hredirect:-<none>}' (expected $ORIGIN/)" ;;
esac

# ------------------------------------------------------------------ robots ---
head_ "robots.txt"
rstatus=$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "$ORIGIN/robots.txt")
[ "$rstatus" = "200" ] && ok "/robots.txt -> 200" || bad "/robots.txt -> $rstatus (expected 200)"
if grep -qF "Sitemap: $ORIGIN/" "$body"; then
  ok "Sitemap: line names the production origin"
else
  bad "Sitemap: line does not name $ORIGIN — got: $(grep -i '^sitemap' "$body" || echo '<none>')"
fi
# A placeholder-serving catch-all answers this as HTML rather than 404ing.
if grep -qF "$PLACEHOLDER_MARKER" "$body"; then
  bad "/robots.txt served the HTML placeholder — nginx has a catch-all rewrite"
fi

# ----------------------------------------------------------------- sitemap ---
head_ "sitemap"
sstatus=$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "$ORIGIN/sitemap.xml")
[ "$sstatus" = "200" ] && ok "/sitemap.xml -> 200" || bad "/sitemap.xml -> $sstatus (expected 200)"
if grep -qE '<(urlset|sitemapindex)' "$body"; then
  ok "sitemap is XML"
else
  bad "sitemap is not XML — first line: $(head -1 "$body")"
fi

mapfile -t urls < <(grep -o '<loc>[^<]*</loc>' "$body" | sed 's/<[^>]*>//g')
if [ "${#urls[@]}" -eq 0 ]; then
  bad "sitemap lists no URLs"
else
  ok "sitemap lists ${#urls[@]} URL(s)"
fi

# ------------------------------------------------------------ every route ----
# Every URL the sitemap claims, and no redirects: a 301 here is normally a lost
# trailing slash, which means the canonical address and the served address
# disagree.
head_ "sitemap routes (${#urls[@]})"
for url in "${urls[@]}"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  [ "$code" = "200" ] && ok "$code  $url" || bad "$code  $url (expected 200)"
done

# Named explicitly as well as via the sitemap, so a sitemap that silently lost
# a route cannot make this pass by listing less.
head_ "key routes"
for path in / /work/ /how-i-build/ /work/crm/; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$ORIGIN$path")
  [ "$code" = "200" ] && ok "$code  $path" || bad "$code  $path (expected 200)"
done

# --------------------------------------------------------------------- 404 ---
# The status and the body have to be right together. A page that renders the
# site's 404 but answers 200 is a soft 404, and tells a crawler the address
# exists.
head_ "404"
nstatus=$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "$ORIGIN/no-such-page/")
[ "$nstatus" = "404" ] && ok "/no-such-page/ -> 404" || bad "/no-such-page/ -> $nstatus (expected 404)"
if grep -qF "$NOTFOUND_TITLE" "$body"; then
  ok "site's own 404 document served"
else
  bad "404 body is not the site's own — title: $(grep -o '<title>[^<]*</title>' "$body" | head -1)"
fi

# ------------------------------------------------------------------ verdict --
printf '\n'
if [ "$fails" -eq 0 ]; then
  echo "PRODUCTION_SMOKE = PASS"
  exit 0
fi
echo "PRODUCTION_SMOKE = FAIL ($fails check(s))"
exit 1
