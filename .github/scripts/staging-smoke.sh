#!/usr/bin/env bash
#
# Staging smoke for stg-portfolio.neppepe.net, run from the GitHub runner after
# the rsync. Like the production smoke beside it, it talks to the public origin
# so it exercises nginx, TLS and the artifact together rather than the files on
# disk. Unlike the production smoke, its first job is the opposite one: proving
# that the origin is *not* public.
#
# Staging is a pre-production review environment, and Issue #36 makes that a
# boundary rather than a convention: without credentials the origin must refuse
# to serve, and that refusal is what this script gates on. `noindex` is a
# separate layer (#34) and is deliberately not asserted here — keeping a URL out
# of a search index is not access control, and a script that checked both would
# blur the two.
#
# Credentials never reach argv or the log. They are read from the environment
# (GitHub Secrets) into a mode-0600 netrc file, and curl is pointed at that
# file; `--user` would put the pair in the process list, and echoing either is
# never done. The runner is ephemeral and the file is removed on exit.
#
# It does not stop at the first failure. A staging deploy that is wrong in three
# ways should say so once, not across three re-runs.

set -uo pipefail

ORIGIN="${STG_ORIGIN:-https://stg-portfolio.neppepe.net}"
HOST=${ORIGIN#*://}
HOST=${HOST%%/*}
HOST=${HOST%%:*}

# Defaulted in place rather than copied into local names. `scan:public` reads
# every tracked file in this repository, and its CREDENTIAL rule matches a
# credential-shaped word assigned a quoted value — which a local variable named
# after the password here does, correctly: the rule cannot tell an env
# indirection from a hard-coded value, and a rule that tried to would be the
# weaker rule. One name per secret, and it is the name GitHub knows it by.
: "${STG_BASIC_USER:=}"
: "${STG_BASIC_PASS:=}"

# A string from the hero that no placeholder and no error page can contain. If
# the home page is served but this is absent, staging is not serving this build.
HERO_MARKER='業務で使える Web・AI システムへ。'
# The site's own error document, as built.
NOTFOUND_TITLE='404 — ページが見つかりません。'

fails=0
ok()    { printf '  ok    %s\n' "$*"; }
bad()   { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }
note()  { printf '  --    %s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }

body=$(mktemp)
netrc=$(mktemp)
trap 'rm -f "$body" "$netrc"' EXIT
chmod 600 "$netrc"

# Two modes, and which one is running is decided by whether the credentials are
# configured — not by a flag someone has to remember to flip.
#
#   guarded  — STG_BASIC_USER and STG_BASIC_PASS are both set. The access
#              boundary is asserted: anonymous requests must be refused and
#              authenticated ones must succeed.
#   open     — neither is set, which is the state of this repository before the
#              one-time server work in portfolio-site/DEPLOY.md §10 is done.
#              The reachability checks still run, anonymously, exactly as the
#              previous inline smoke did. The boundary is reported as NOT
#              VERIFIED rather than silently assumed.
#
# There is no third mode. Half-configured credentials are a configuration error
# and are refused rather than guessed at.
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

# Anonymous. No netrc, and no credential can leak into it by accident.
anon() { curl -sS --max-time 20 "$@"; }

# Authenticated when there is anything to authenticate with. In `open` mode this
# is the same request as `anon`, which is the point: the reachability checks read
# identically in both modes and only the boundary assertion differs.
auth() {
  if [ "$MODE" = guarded ]; then
    curl -sS --max-time 20 --netrc-file "$netrc" "$@"
  else
    curl -sS --max-time 20 "$@"
  fi
}

# ------------------------------------------------------------------ boundary --
head_ "access boundary"

anon_status=$(anon -o /dev/null -w '%{http_code}' "$ORIGIN/")
if [ "$MODE" = guarded ]; then
  case "$anon_status" in
    401|403) ok "anonymous / -> $anon_status (refused)" ;;
    *)       bad "anonymous / -> $anon_status (expected 401) — staging is readable without credentials" ;;
  esac
else
  note "anonymous / -> $anon_status; boundary NOT VERIFIED (no credentials configured)"
  [ "$anon_status" = "200" ] && ok "/ reachable" \
    || bad "/ -> $anon_status (expected 200 while unguarded)"
fi

# ------------------------------------------------------------------ home page --
head_ "home page"

# A deploy that has just finished can race nginx's open_file_cache. Give it a
# bounded chance rather than failing a good release over a two-second window.
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

# TLS is Certbot-managed on this host and renewal is HTTP-01. A Basic Auth block
# that also covers /.well-known/acme-challenge/ breaks renewal silently, weeks
# later, so the certificate is checked here where a failure is still cheap.
if [ "$(auth -o /dev/null -w '%{ssl_verify_result}' "$ORIGIN/")" = "0" ]; then
  ok "TLS verifies"
else
  bad "TLS did not verify"
fi

# --------------------------------------------------------------------- assets --
head_ "assets are inside the boundary"

# Taken out of the page that was just fetched rather than written down here: a
# hashed asset name changes every build, and a list in a script would be stale
# by the next one.
asset=$(grep -o '/_astro/[A-Za-z0-9._-]*\.\(css\|js\)' "$body" | head -n 1)
if [ -z "$asset" ]; then
  bad "no /_astro/ asset referenced by / — cannot check the asset boundary"
else
  note "asset: $asset"
  [ "$(auth -o /dev/null -w '%{http_code}' "$ORIGIN$asset")" = "200" ] \
    && ok "authenticated asset -> 200" \
    || bad "authenticated asset -> not 200"

  if [ "$MODE" = guarded ]; then
    case "$(anon -o /dev/null -w '%{http_code}' "$ORIGIN$asset")" in
      401|403) ok "anonymous asset refused" ;;
      *)       bad "anonymous asset served — assets are outside the boundary" ;;
    esac
  fi
fi

# --------------------------------------------------------------------- routes --
head_ "routes"

# The route list comes out of the sitemap this deploy just published, so this
# checks staging against its own claim about what exists rather than against a
# count typed into a script.
#
# The artifact declares the *production* origin (astro.config.mjs `site:`), and
# that is correct — staging serves the production artifact unmodified and this
# script does not assert otherwise. So the sitemap's absolute URLs are mapped
# onto the staging origin before they are requested.
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

# 404, not 401 and not 200. An unknown path inside the boundary must reach the
# site's own error document: a 200 here would mean the SPA catch-all that §4.1
# of the runbook treats as a blocker, and a 401 would mean the error document
# itself sits outside the boundary.
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
