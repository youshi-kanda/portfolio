# Deployment runbook

Target: **https://portfolio.neppepe.net**
Served tree: **`/var/www/portfolio-live/current`** — a **symlink** to the live release
Releases: **`/var/www/portfolio-live/releases/<git-sha>-<run-id>-<attempt>/`**
Artifact: **`dist/`** — static files only. No Node process, no database, no
environment configuration in production.

Staging is a separate site with a separate root and a separate workflow, and the
two never cross:

| | branch | workflow | nginx `root` | origin |
|---|---|---|---|---|
| production | `main` | `.github/workflows/deploy-production.yml` | `/var/www/portfolio-live/current` (symlink) | https://portfolio.neppepe.net |
| staging | `develop` | `.github/workflows/deploy-staging.yml` | `/var/www/portfolio-stg` (directory) | https://stg-portfolio.neppepe.net — **Basic Auth 未適用（§10 参照）** |

---

## 0. The host, as measured

Read-only preflight, 2026-09-14 JST. These are the facts the rest of this runbook is
built on; re-check them if a deploy behaves unexpectedly.

| | |
|---|---|
| OS / nginx | Ubuntu 24.04.4 LTS / nginx 1.24.0 |
| effective site file | `/etc/nginx/sites-enabled/portfolio` (per `sudo nginx -T`) |
| deploy account | `deployer`, uid 1000, groups `deployer,sudo,users` |
| **passwordless sudo** | **none** — `SUDO_NONINTERACTIVE=NO` |
| nginx processes | master `root`, workers `www-data` |
| `/var/www` | `root:root 755` |
| `/var/www/portfolio` | `root:root 755`, a **real directory** (the placeholder) |
| disk | 139G available of 145G |
| TLS | Certbot-managed on `:443`; `http://` → `301` → `https://` |

**`deployer` cannot write anywhere under `/var/www` and cannot escalate without
a password.** That single fact determines the whole design below.

---

## 1. Why the deploy owns its own directory

The obvious layout — a `/var/www/portfolio` symlink swapped between releases —
cannot be operated by `deployer`, because moving that symlink means writing
inside `/var/www`, which is `root:root`. The only ways to reach it from Actions
would be a passwordless sudo rule or a sudo password in a secret. **Neither is
acceptable**, so neither is used.

Instead every path the deploy touches lives under one directory that `deployer`
owns outright, and nginx is pointed at it once:

```
/var/www/
├── portfolio/                        ← the old placeholder. root:root. Untouched.
│                                       Kept as a fallback until production is proven.
└── portfolio-live/                   ← deployer:deployer 755
    ├── releases/
    │   ├── initial-placeholder/      ← a copy of the placeholder, made at migration
    │   └── <sha>-<run-id>-<attempt>/  ← one directory per deploy attempt
    ├── current -> releases/<…>/       ← the symlink nginx serves
    └── previous                      ← a text file: what `current` pointed at before
```

Root is needed exactly once, by a human, to create `portfolio-live/`, hand it to
`deployer`, and change nginx's `root` (§3, §4). **After that the deploy runs no
`sudo` at all** — the workflow contains none, and the account has none.

Two properties this buys, and why each matters:

- **The served tree is never written to.** `rsync` only ever targets a release
  directory. There is no window in which the document root is half a build.
- **Activation is one rename.** A fresh temporary symlink is created beside
  `current` and renamed over it, inside a directory `deployer` owns. There is no
  instant in which `current` does not exist, so no request can arrive while the
  document root is missing.

`rm -rf current && ln -s ...` would violate both, and is never the procedure —
not in the workflow, and not by hand. See §7.

**nginx's `root` never changes after §4.** It stays
`/var/www/portfolio-live/current` through every deploy and every rollback. Only
what that name points at moves, and nginx resolves it per request, so a deploy
needs no reload.

---

## 2. The gate

Run from `portfolio-site/`, on the build machine:

```sh
npm run qa
```

**The gate is `npm run qa` exiting 0.** That is the whole condition. `qa` is the
project's own definition of green:

```
validate:content → check → test → build → check:links
                 → check:structure → check:attestation → scan:public
```

Confirm each contract line reports PASS (or a zero count):

| contract | expected |
|---|---|
| `Truth Gate` | `PASS`, `0 errors` |
| tests | `fail 0` |
| `DEAD_LINKS` | `0` |
| `DEAD_ANCHORS` | `0` |
| `ACCESSIBILITY_CONTRACT` | `PASS` |
| `STRUCTURE_CONTRACT` | `PASS` |
| `SEO_METADATA` | `PASS` |
| `CANONICAL_URLS` | `PASS` |
| `SITEMAP` | `PASS` |
| `ROBOTS` | `PASS` |
| `NOINDEX_RESIDUAL` | `0` |
| `ERROR_DOCUMENT` | `PASS` |
| `PUBLIC_ARTIFACT_ATTESTATION` | `PASS` |
| `PUBLIC_SAFE_SCAN` | `PASS` |

**Counts are a log, not a gate.** `qa` also prints how many tests ran, how many
pages were built, how many routes are public, how many files were scanned. Those
numbers belong in the run log and are useful when reading a diff between two
runs — they are *not* thresholds, and a runbook that pins them breaks every time
a page or a test is added. At the time of writing they were `tests 194`,
`checked 10 page(s)`, `public routes: 9`, `488 files scanned`. If they differ
when you run it, that is not by itself a failure; a contract line that is not
PASS is.

Do not deploy a `dist/` produced by a bare `npm run build`. `check:links`,
`check:structure` and `scan:public` all run **after** the build, and they are
what prove the canonical URLs, the sitemap and `robots.txt` in the artifact
agree with the pages actually emitted, and that nothing unpublishable is in the
tree. A build alone checks none of that.

The origin is declared once, in `astro.config.mjs` (`site:`). Everything
absolute in the artifact — canonical links, `og:url`, the sitemap, the
`Sitemap:` line in `robots.txt` — derives from it, and `check-links` reads it
back out of the config to verify. Serving this artifact from any other hostname
publishes canonical links pointing at `portfolio.neppepe.net`.

---

## 3. One-time migration (root, interactive, by a human)

**Run once, before the first automatic deploy**, and only when someone is at a
terminal to type a sudo password. Until it is done, the workflow's
`Assert host preconditions` step fails and nothing is uploaded.

Two things this migration is careful about:

- **`/var/www/portfolio` is copied, not moved, and never deleted.** It stays
  exactly as it is, as a fallback: if anything about `portfolio-live` goes
  wrong, pointing nginx's `root` back at it restores the previous behaviour in
  one line (§7).
- **Migration publishes nothing.** When it and §4 are done, the site still
  serves the placeholder. Only a GitHub Actions run can move `current` onto a
  real release, so nginx work and site publication stay separate events.

```sh
set -eu
LIVE=/var/www/portfolio-live

# 0. Refuse to run twice.
[ -e "$LIVE" ] && { echo "$LIVE already exists — stop and inspect"; exit 1; }

# 1. The tree, owned by the deploy account from the moment it exists.
sudo install -d -o deployer -g deployer -m 755 "$LIVE" "$LIVE/releases" \
  "$LIVE/releases/initial-placeholder"

# 2. COPY the placeholder in as the first release. /var/www/portfolio is left
#    untouched — this is a copy, not a move.
sudo cp -a /var/www/portfolio/. "$LIVE/releases/initial-placeholder/"

# 3. Ownership and modes: deployer writes, www-data reads, nobody else writes.
sudo chown -R deployer:deployer "$LIVE"
sudo find "$LIVE" -type d -exec chmod 755 {} +
sudo find "$LIVE" -type f -exec chmod 644 {} +

# 4. Initialise the pointers AS deployer, so nothing under $LIVE ends up
#    root-owned and unmovable by the deploy.
sudo -u deployer ln -s "$LIVE/releases/initial-placeholder" "$LIVE/current"
printf '%s\n' "$LIVE/releases/initial-placeholder" \
  | sudo -u deployer tee "$LIVE/previous" >/dev/null
```

Verify — every line here is a precondition the workflow asserts:

```sh
ls -ld /var/www/portfolio-live /var/www/portfolio-live/releases /var/www/portfolio-live/current
readlink /var/www/portfolio-live/current
sudo -u deployer test -w /var/www/portfolio-live          && echo "ok: deployer can write \$LIVE"
sudo -u deployer test -w /var/www/portfolio-live/releases && echo "ok: deployer can write releases/"
find /var/www/portfolio-live ! -user deployer -print      # must print nothing
ls -ld /var/www/portfolio                                 # still root:root, untouched
```

Nothing is published by this step. `portfolio.neppepe.net` is still served from
`/var/www/portfolio` until §4 changes `root`.

---

## 4. nginx configuration

### 4.1 The defect

The production server block currently answers **every** path with the same
208-byte placeholder, `200 text/html`:

```
/                200 text/html  <title>Portfolio Test</title>
/robots.txt      200 text/html  <title>Portfolio Test</title>
/sitemap.xml     200 text/html  <title>Portfolio Test</title>
/no-such-page/   200 text/html  <title>Portfolio Test</title>
```

The cause is in the block itself:

```nginx
location / {
    try_files $uri $uri/ /index.html;   # ← SPA catch-all
}
```

Every miss falls back to `index.html` and answers 200, so every unknown URL is a
**soft 404** — it tells a crawler the address exists. `/robots.txt` and
`/sitemap.xml` come back as HTML for the same reason. Treated as a **BLOCKER**:
the site cannot be published over this configuration.

Staging, on the same host, already has the correct shape, and is the reference:

```nginx
root /var/www/portfolio-stg;
location / {
    try_files $uri $uri/ =404;
}
error_page 404 /404.html;
```

### 4.2 The minimal diff

Effective file, per `sudo nginx -T`: **`/etc/nginx/sites-enabled/portfolio`**.
If that path is a symlink, edit its target:

```sh
readlink -f /etc/nginx/sites-enabled/portfolio
sudo cp -a "$(readlink -f /etc/nginx/sites-enabled/portfolio)"{,.bak-$(date +%Y%m%d-%H%M%S)}
```

Change these lines and **nothing else**. `server_name`, `listen`, the Certbot
TLS and certificate lines, the `http` → `https` redirect server, and any
security headers stay exactly as they are:

```diff
-    root /var/www/portfolio;
+    root /var/www/portfolio-live/current;
     index index.html;

     location / {
-        try_files $uri $uri/ /index.html;
+        try_files $uri $uri/ =404;
     }
+
+    # The site's own error document. Without this, the =404 above is answered
+    # by nginx's default error page. `internal` keeps /404.html from being
+    # requested directly as if it were a route — it is not one, and it is not
+    # in the sitemap.
+    error_page 404 /404.html;
+    location = /404.html {
+        internal;
+    }
```

Three notes on the `root` line:

- The site is static with `trailingSlash: 'always'`, so `try_files $uri $uri/`
  is what resolves `/work/crm/` to `/work/crm/index.html`. The `=404` is what
  makes it *stop* instead of falling back.
- `root` points at the **symlink**, not at a release. nginx resolves it per
  request, so an atomic switch needs no reload.
- nginx must be allowed to follow it. The default is fine; confirm nothing
  overrides it:

  ```sh
  sudo nginx -T | grep -n disable_symlinks   # expect no output
  ```

### 4.3 Applying it

```sh
sudo nginx -t          # must pass before anything is reloaded
sudo systemctl reload nginx
```

If `nginx -t` fails, stop. Nothing has been reloaded and the previous
configuration is still live.

### 4.4 Expected state after §3 and §4, before the first deploy

`current` still points at `initial-placeholder`, now served by a correct block:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/                # 200
curl -s https://portfolio.neppepe.net/ | grep -o '<title>[^<]*</title>'                # Portfolio Test
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/no-such-page/   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/sitemap.xml     # 404
```

`/sitemap.xml` answering 404 is correct here and is the clearest proof the
catch-all is gone. The 404 **body** will still be nginx's default page, because
`initial-placeholder` has no `404.html` — that is expected, and the first real
release fixes it. The status is what matters at this stage.

---

## 5. The automatic path

`.github/workflows/deploy-production.yml`. Nothing needs to be run by hand for a
normal release.

| | |
|---|---|
| trigger | `push` to `main` touching `portfolio-site/**`, this workflow, or `production-smoke.sh` |
| not triggered by | `pull_request`, the release branch, `workflow_dispatch` — there is none |
| `permissions` | `contents: read` |
| `concurrency` | `portfolio-production`, `cancel-in-progress: false` |
| environment | `production` → https://portfolio.neppepe.net |
| Node | 24 |
| SSH user | `deployer` |
| **sudo** | **never** — the workflow contains no `sudo` |
| contract test | `portfolio-site/tests/deploy-contract.test.ts`, run by `npm run qa` |

Steps, in order:

1. `npm ci`
2. **`npm run qa`** — the gate from §2, **and the build**
3. Configure SSH — `~/.ssh/config` from the five `VPS_*` secrets
4. **Assert host preconditions** — see §5.1
5. **Upload release** — `rsync` into `releases/$RELEASE_ID/` — see §5.0
6. **Verify release contents** — see §5.2
7. **Activate** — record `previous`, then one atomic rename; report `switched`
8. **Production smoke** — `.github/scripts/production-smoke.sh`
9. **Roll back** — only on the condition in §5.3

### 5.0 One release directory per attempt

```
RELEASE_ID = <github.sha>-<github.run_id>-<github.run_attempt>
```

Not the commit SHA alone. Once a commit is deployed, `releases/<sha>/` *is*
what `current` points at — so keying the upload on the SHA meant that
re-running the workflow aimed `rsync --delete` at the tree nginx was serving
and rewrote it in place. That happened during upload, before activation had any
say, and regardless of what activation later reported: the site could be
modified by a run that went on to conclude it had changed nothing.

`run_attempt` increments on every re-run of a run, and `run_id` differs between
runs, so this name can never collide with a release that is already serving.
The SHA stays at the front, so a directory on the host still says which commit
it holds:

```
releases/
├── 8d44e0c…-34763173686-1/
├── 8d44e0c…-34763173686-2/     ← a re-run of that same run
└── ca87226…-34836555973-1/
```

The consequence to know about: **a re-run is no longer a no-op.** It builds a
new release directory and really does switch `current` onto it. That is the
safe direction — the alternative was mutating the live tree — but it does mean
attempts accumulate on disk (§8).

**There is no separate build step, deliberately.** `qa` ends in
`build → check:links → check:structure → check:attestation → scan:public`, so
`dist/` already exists when the gate passes *and it is the exact tree those
stages inspected*. A second `npm run build` would overwrite the inspected
artifact with one nothing had looked at, and upload that. Nothing after the
gate may write `dist/`.

A re-run is safe because it never touches the release that is serving: the
upload goes to a directory named after *this attempt* (§5.0), and `--delete`
can therefore only remove leftovers from a previous attempt at the same upload,
never files out from under the running site.

### 5.1 Preconditions, asserted before anything is uploaded

- `/var/www/portfolio-live` and `.../releases` exist and are writable by the
  SSH account
- `/var/www/portfolio-live/current` **is a symlink**

Each is something §3 establishes and none is something a deploy should quietly
fix — they are all root-owned changes, and the job has no root. If any fails the
run stops before the first byte is uploaded and names §3.

### 5.2 What must be in a release before it is activated

`index.html`, `404.html`, `robots.txt`, at least one `sitemap*.xml`, and a
non-empty `_astro/`. A release missing any of them is not activated.

Uploads use `--chmod=D755,F644`, so the nginx worker (`www-data`) can read the
release but not write it, regardless of what the runner's checkout produced.

### 5.3 When rollback runs, and when it must not

Rollback needs **two** things to be true, not one:

```yaml
if: >-
  failure()
  && steps.activate.outcome == 'success'
  && steps.activate.outputs.switched == 'true'
```

**`outcome == 'success'`** — a failure in checkout, `npm ci`, the QA gate, SSH
configuration, the precondition assert, upload or release verification means
`current` was never moved. There is nothing to roll back, and moving the pointer
would be the only change the run made.

**`outputs.switched == 'true'`** — the activation step reports whether it
actually renamed anything. It emits `SWITCHED=true` when it moved the pointer
and `SWITCHED=false` when `current` already pointed at this release, and the
workflow publishes that as a step output. If the marker is missing or
unrecognised the step fails rather than defaulting: not knowing whether the
pointer moved is not a state to guess from.

The case this second condition exists for is an **activation that succeeds
without moving anything**. Such a run does *not* rewrite `previous`, because
`previous` must keep describing the switch that actually happened. Without the
`switched` guard, a smoke failure on such a run would "roll back" onto whatever
target an earlier deploy had left in `previous` — moving production to an older
release that nothing asked for, in response to a run that had changed nothing.

Since §5.0 gave every attempt its own release directory this is a guard rather
than an everyday path: a re-run now genuinely switches. It stays because it is
what makes "we did not move the pointer" and "do not roll back" the same
statement, however the host got into that state — including a `current` that
was repointed by hand, or a manual deploy (§9) run twice.

`Re-smoke after rollback` carries the same condition, for the same reason.

Both branches of that decision are covered by
`portfolio-site/tests/deploy-contract.test.ts`, which runs inside `npm run qa`:
it asserts the guard text, that the no-op branch writes neither `previous` nor a
rename, and that the switching branch records `previous` *before* renaming.

After a rollback the run **stays failed**. The release was not accepted, and a
green check would say it was. The failed release directory is left on disk on
purpose — it is the evidence. Nothing prunes releases automatically (§8).

### 5.4 Secrets

`VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `VPS_HOST`, `VPS_USER`, `VPS_PORT` — the same
five staging uses. `VPS_USER` is `deployer`.

`known_hosts` is written from the secret and `StrictHostKeyChecking` stays on.
`ssh-keyscan` is never run inside the workflow: a host key learned at deploy
time authenticates nothing. No secret is ever echoed or logged; host, user and
port are written into `~/.ssh/config` on the runner and referenced by the alias
`portfolio-prod`.

---

## 6. Smoke

One script, run from the repository root, used identically by the workflow and
by hand:

```sh
PROD_ORIGIN=https://portfolio.neppepe.net bash .github/scripts/production-smoke.sh
```

It checks, and reports every failure rather than stopping at the first:

- `/` → 200, carries the hero copy, does **not** carry `Portfolio Test`
- `rel="canonical"` on `/` names the production origin
- TLS `ssl_verify_result = 0`
- `http://` → 301 or 308 to `https://`
- `/robots.txt` → 200, `Sitemap:` line names the production origin, and is not
  the HTML placeholder
- `/sitemap.xml` → 200 and is XML
- **every URL in the sitemap** → 200, no redirects
- `/`, `/work/`, `/how-i-build/`, `/work/crm/` → 200
- `/no-such-page/` → **404** *and* the body is the site's own
  `404 — ページが見つかりません。`

**The route list is not written down here.** It is read out of the sitemap the
deploy just published, so this checks the live site against its own claim about
what exists rather than against a count typed into a runbook. A `301` on a
sitemap URL usually means a trailing slash was lost.

The home-page check retries for up to 30s, so a good release is not rolled back
over a momentary blip.

Ends in `PRODUCTION_SMOKE = PASS` or `PRODUCTION_SMOKE = FAIL (n check(s))`.

---

## 7. Rollback

### 7.1 To the previous release (no root)

Moving `current` back. It does not rebuild, re-upload or delete anything, so it
is as fast as a rename and cannot fail halfway. The workflow does this
automatically under the condition in §5.3. By hand, **as `deployer`**:

```sh
set -eu
LIVE=/var/www/portfolio-live

# 1. What was live before the last switch.
PREV=$(cat "$LIVE/previous"); echo "$PREV"
[ -d "$PREV" ] || { echo "not a directory — pick one from $LIVE/releases/"; exit 1; }

# 2. Temporary link beside `current`, then one atomic rename over it.
ln -s "$PREV" "$LIVE/.current.rollback.$$"
mv -T "$LIVE/.current.rollback.$$" "$LIVE/current"

# 3. Confirm, then re-run §6.
readlink "$LIVE/current"
```

To roll back to something other than the immediately previous release, list
`$LIVE/releases/` and use that directory as `$PREV` — every release is a
complete document root, so any of them can be made live the same way. Rolling
back to `initial-placeholder` restores the pre-launch placeholder.

**Not the procedure**, and not to be reintroduced:

```sh
rm -rf /var/www/portfolio-live/current    # ← the document root ceases to exist
ln -s ... current
```

`ln -sfn` is also avoided: when the destination is a symlink to a directory it
can resolve *through* the link and create the new link inside the old release.
A temp link plus `mv -T` is a single `rename(2)`; that is the only form used.

### 7.2 All the way out of `portfolio-live` (root)

The old placeholder is still there, untouched, so the whole migration can be
abandoned by putting one line back and reloading:

```sh
# in /etc/nginx/sites-enabled/portfolio
#   root /var/www/portfolio-live/current;  ->  root /var/www/portfolio;
sudo nginx -t && sudo systemctl reload nginx
```

Keep `/var/www/portfolio` until production has been proven green. Removing it is
a separate, later decision — not part of any deploy.

---

## 8. Release retention

Nothing prunes `/var/www/portfolio-live/releases/` automatically, deliberately:
a rollback target removed by a cron job is the one thing rollback cannot recover
from. Keep the live release, the previous one, and `initial-placeholder`; remove
older ones by hand after confirming they are not what `previous` names.

Since §5.0 every *attempt* leaves a directory, so a commit that took three tries
leaves three. Each is a full copy of the site (small — the artifact is tens of
files), but they do accumulate, which is why this section is a periodic chore
rather than an optional one.

```sh
du -sh /var/www/portfolio-live/releases/*
readlink -f /var/www/portfolio-live/current    # never delete this
cat /var/www/portfolio-live/previous           # nor this
df -h /var/www                                 # 139G free at migration
```

---

## 9. Manual deploy (fallback only)

The workflow is the supported path. Use this only when Actions is unavailable.
Same sequence, by hand, same invariant: **never `rsync` into `current`.** No
`sudo` anywhere.

```sh
set -eu
# Same rule as §5.0: the target must be a directory nothing is serving, so it
# carries a timestamp where the workflow would carry run id and attempt.
RELEASE_ID="$(git rev-parse HEAD)-manual-$(date +%Y%m%d-%H%M%S)"
LIVE=/var/www/portfolio-live

npm run qa                                    # §2 — the gate

ssh deployer@<host> "test -L $LIVE/current || { echo 'not migrated — see §3'; exit 1; }
                     mkdir -p $LIVE/releases/$RELEASE_ID"
rsync -rlptz --delete --chmod=D755,F644 dist/ "deployer@<host>:$LIVE/releases/$RELEASE_ID/"

ssh deployer@<host> "
  readlink -f $LIVE/current > $LIVE/previous
  ln -s $LIVE/releases/$RELEASE_ID $LIVE/.current.new.\$\$
  mv -T $LIVE/.current.new.\$\$ $LIVE/current
  readlink $LIVE/current"
```

Then run §6. If it fails, run §7.1.

---

## 10. staging のアクセス制御（Basic Auth）

staging は production の成果物を、誰でも到達できるホストから配信している。つまり
このセクションを適用するまでは、**URL を知っているかどうかだけ**が、第三者と未公開
build との間に立っている唯一のものになる。

**`noindex` は既に有効だが、それはこれとは別物。** staging は nginx から
`X-Robots-Tag: noindex, nofollow, noarchive` を全 response に返している——推測では
なく実測値（§10.3）。この header は crawler に「この URL を一覧に載せないでくれ」
と頼むだけで、既に URL を知っている相手には何も要求しない。したがってこれは
検索エンジン向けのレイヤであり、**Issue #34** で別途管理する。本セクションはそれを
一切変更しない。本セクションが担当するのはアクセス境界の方。どちらも他方の
代わりにはならず、smoke test が検証するのはアクセス境界だけ。

**production は対象外。** ここでは
`/etc/nginx/sites-enabled/portfolio`、`/var/www/portfolio-live`、
`portfolio.neppepe.net` のいずれにも触れない。staging の server block は別 file で、
両者が交差することは無い（§0 および本 runbook 冒頭の表）。

### 10.1 CI が既にやっていること、CI にはできないこと

`.github/scripts/staging-smoke.sh` は staging の rsync 後に毎回実行される。mode は
2 つで、どちらになるかは credentials が存在するかどうかだけで決まる（flag では
切り替えない）:

| `STG_BASIC_USER` / `STG_BASIC_PASS` | mode | smoke test が検証すること |
|---|---|---|
| 両方未設定 | `open` | 到達性のみ。境界は `boundary NOT VERIFIED` と報告する。 |
| 両方設定済み | `guarded` | anonymous での `/`・その build 自身の `/_astro/` asset・`/robots.txt`・`/sitemap.xml`・存在しない path の全てが **`401` で拒否**され、かつ anonymous の `/` が `WWW-Authenticate: Basic` challenge を伴うこと。認証ありでは `/`（hero コピー入り）・sitemap の全 route・`/robots.txt`・サイト自身の 404 body が全て成功すること。 |
| 片方だけ設定 | — | 実行を拒否する。境界が半分だけ設定された状態は設定ミスであり、default として扱ってよいものではない。 |

つまり本 Issue の **repository 側は server 作業より前に完成しており、green**。
そして credentials が登録された瞬間から gate として効き始める。**以下の手順が残り
全部で、そのどれもホスト上の人間か GitHub Settings 上の人間を必要とする。CI には
`sudo` も password も無いので、CI 側からは実行できない。**

### 10.2 順序が重要

上の mode 表には「server は設定済みだが secret が未登録」という状態が無い。そして
それを正直に足すこともできない——401 を見て見逃す smoke test は、壊れた deploy も
同じように見逃すから。したがって **§10.4 と §10.5 は同じ作業時間内に続けて実施し、
その後 workflow を dispatch すること。** その間に staging が 1 回走れば red になるが、
それは正しい挙動であり、だからこそ中途半端な状態で放置しない価値がある。

### 10.3 現状（実測値）

read-only の調査を **2026-09-19 JST** に実施（Issue #36）。§10.4 はこの事実を前提に
書かれている。staging の挙動が想定と違うときは以下のコマンドを再実行し、出力は
保管しておくこと——rollback 時の比較対象になる。

| | |
|---|---|
| site file | `/etc/nginx/sites-available/portfolio-stg` |
| `server_name` | `stg-portfolio.neppepe.net` |
| `root` / `index` | `/var/www/portfolio-stg` / `index.html` |
| `:443` | `listen 443 ssl`、Certbot 管理 |
| `:80` | **別の** server block: `return 404` |
| `location /` | `try_files $uri $uri/ =404;` |
| error document | `error_page 404 /404.html;` — **`location = /404.html` block は存在しない** |
| 現在のアクセス制御 | **無し** — `auth_basic`・`satisfy`・`allow`・`deny` はどこにも無い |
| anonymous `/` | **`200`** — §10.4 が終わらせるのはこの状態 |
| `X-Robots-Tag` | `noindex, nofollow, noarchive`。nginx が付与し、実レスポンスに存在する（Issue #34） |
| 前段の proxy | **無し** — `Server: nginx/1.24.0 (Ubuntu)`、`cf-ray` も `via` も無いので §10.6 は現状該当しない |
| Certbot | `authenticator = nginx`、`installer = nginx`、`certbot.timer` は active |

このうち 2 つが §10.4 の差分の形を決める。どちらも記憶に頼ると間違えやすい:

- **ACME challenge に応答するのは port 80 で、443 ではない。** Certbot の *nginx*
  authenticator が解決するのは **HTTP-01** で、ACME server はそれを `http://` 越しに
  取得する。したがって §10.4 は `:443` の block だけに触り、`:80` の block は
  そのまま残す。`/.well-known/acme-challenge/` の例外は不要（§10.4 参照）。
- **そもそも「残しておくべき」`location = /404.html` block は存在しない。** §10.4 も
  それを新設しない。Issue #36 はアクセス制御であり、error document は既に機能して
  いる。

再実行用のコマンド:

```sh
# 実際に staging を配信している file と、その server block 全体。
sudo nginx -T | sed -n '/stg-portfolio\.neppepe\.net/,/^}/p'
readlink -f /etc/nginx/sites-enabled/*stg* 2>/dev/null

# 既に何かで保護されていないか。
sudo nginx -T | grep -n 'auth_basic\|satisfy\|allow\|deny'

# 現在 origin が返しているもの（header 込み）。
curl -sSI https://stg-portfolio.neppepe.net/
curl -sSI https://stg-portfolio.neppepe.net/no-such-page/

# 前段に proxy がいないか。（ここに Cloudflare の `server`/`cf-ray` header が出る
# なら §10.6 の話になる。nginx が edge だと決めつける前に必ず読むこと）
curl -sSI https://stg-portfolio.neppepe.net/ | grep -i 'server\|cf-ray\|via'
```

### 10.4 VPS 上での作業（root・対話的・人間が実施）

`htpasswd` は `apache2-utils` に含まれる。このホストにパッケージを追加したくない
場合は、`openssl passwd -apr1` が同じ file 形式を生成するので、下に併記した代替手段
を使う。

```sh
set -eu

# 1. credential file。あらゆる web root の外に置き、nginx worker からのみ読める
#    ようにする。この設定では /etc/nginx はどの `root` directive からも配信されて
#    いない。また、この file は決して /var/www 配下に置かない——document root の
#    中にある .htpasswd はダウンロードできてしまう。
sudo install -o root -g www-data -m 640 /dev/null /etc/nginx/.htpasswd-stg

# 2. user と password。ホスト上のこの shell で決める。
#    Issue・PR・commit・この file に貼り付けないこと。
#    -B = bcrypt。-c は file を切り詰めてしまうので意図的に付けていない。
sudo apt-get update && sudo apt-get install -y apache2-utils
sudo htpasswd -B /etc/nginx/.htpasswd-stg stg-review
#   …パッケージを追加せずに済ませる場合:
#   printf 'stg-review:%s\n' "$(openssl passwd -apr1)" | sudo tee -a /etc/nginx/.htpasswd-stg

sudo chown root:www-data /etc/nginx/.htpasswd-stg
sudo chmod 640 /etc/nginx/.htpasswd-stg
sudo test -s /etc/nginx/.htpasswd-stg && echo "ok: credential file written"

# 3. staging の server block を編集する前に backup を取る。
STG=$(readlink -f /etc/nginx/sites-enabled/portfolio-stg)   # §10.3 で確認すること
sudo cp -a "$STG"{,.bak-$(date +%Y%m%d-%H%M%S)}
```

次に、**`listen 443 ssl` の server block だけ**——`server_name
stg-portfolio.neppepe.net` を持つ方——を編集し、以下の 2 行だけを追加する:

```diff
     root /var/www/portfolio-stg;
     index index.html;

+    # アクセス境界（Issue #36）。`location /` の中ではなく server レベルで宣言する。
+    # そうすることで asset・/robots.txt・/sitemap.xml・error document まで含めて
+    # 覆える——穴のある境界は境界ではない。
+    auth_basic           "staging";
+    auth_basic_user_file /etc/nginx/.htpasswd-stg;
+
     location / {
         try_files $uri $uri/ =404;
     }
```

**2 行だけで、それ以外は何も足さない。** 特に以下の 3 点に注意する:

**ACME の例外は作らない。これは意図的な判断。** このホストの TLS は Certbot の
`authenticator = nginx` で、この authenticator が解決するのは **HTTP-01**
——ACME server は `/.well-known/acme-challenge/...` を **`http://`、port 80** で
取得する。port 80 は別の server block（§10.3）であり、本セクションはそこに触れない。
したがって challenge path が上の `auth_basic` を通ることは無く、`:443` 側に例外を
作る対象がそもそも存在しない。それでも
`location ^~ /.well-known/acme-challenge/ { auth_basic off; }` を足した場合、
更新が守られるわけではなく、**境界の内側に無認証の path を 1 本開けるだけ**で
見返りが無い。authenticator を HTTP-01 / port 80 以外へ変更する場合は、まずこの
段落を読み直すこと。

**port 80 の server block は本セクションでは編集しない。** 現在は `return 404` を
返しており、それを維持する。更新時に port 80 側で必要になるものは Certbot の nginx
plugin が面倒を見る。

**`location = /404.html` は追加しない。** `error_page 404 /404.html;` は既に
`location /` 経由で機能しており、§10.3 に記録したとおり編集対象となる
`location = /404.html` block は存在しない。Issue #36 はアクセス制御であり、本
セクションはその範囲に留まる。また error document を境界の内側に置くために専用の
block は要らない——server レベルの `auth_basic` は error page に到達する前に
request を拒否する。だからこそ smoke test は、存在しない path に対して anonymous
なら `401`、認証ありならサイト自身の `404` を期待している。

適用:

```sh
sudo nginx -t                  # reload の前に必ず pass させる
sudo systemctl reload nginx
```

`nginx -t` が失敗したらそこで中止する。まだ reload していないので、staging は
従来の設定で配信され続けている。

検証。ホスト上でも外部からでもよい。`/` だけでなく**境界全体**を見る——ここで
検出したいのは `auth_basic` を `location /` の中に書いてしまう間違いで、それは
home page だけを守り、その下を全部読めるままにするもの:

```sh
for p in / /robots.txt /sitemap.xml /no-such-page/; do
  printf 'anonymous %-16s %s\n' "$p" \
    "$(curl -sS -o /dev/null -w '%{http_code}' "https://stg-portfolio.neppepe.net$p")"
done
# /no-such-page/ を含め、全て 401 になること

# status だけでなく challenge 本体も確認する
curl -sSI https://stg-portfolio.neppepe.net/ | grep -i '^www-authenticate'
# 期待値: WWW-Authenticate: Basic realm="staging"

curl -sS -o /dev/null -w 'authenticated: %{http_code}\n' \
  -u 'stg-review' https://stg-portfolio.neppepe.net/     # -u に :pass を付けなければ対話入力になる
# 期待値: 200

# 証明書更新が影響を受けていないこと（port 80 の block は編集していない）
sudo certbot renew --dry-run
# 期待値: Congratulations, all simulated renewals succeeded

# 上記すべてによって production が影響を受けていないこと
curl -sS -o /dev/null -w 'production:    %{http_code}\n' https://portfolio.neppepe.net/
# 期待値: 200
```

### 10.5 GitHub Settings 上での作業（人間が実施）

Settings → Secrets and variables → Actions → **Repository secrets**:

| secret | 値 |
|---|---|
| `STG_BASIC_USER` | §10.4 の手順 2 で決めた user |
| `STG_BASIC_PASS` | その user の password（平文。GitHub 側で保存時に暗号化される） |

`STG_BASIC_PASS` に入れるのは **password で、bcrypt hash ではない**。ここでの runner
は server 側ではなく client 側だから。両方とも §5.4 の 5 つと同じく repository
レベルの secret なので、`workflow_dispatch` 実行時にも読まれる。

その後 staging deploy を再実行する（Actions → **Deploy Portfolio Staging** → Run
workflow）。smoke の出力を読み、`mode: guarded` かつ `STAGING_SMOKE = PASS` と
出ていることを確認する。`PASS` でも `boundary NOT VERIFIED` と出ている場合は、
secret が実行に渡っていないということ。

### 10.6 staging が Cloudflare の背後にある場合

**2026-09-19 の実測では背後に無い**——`cf-ray` も `via` も無く、
`Server: nginx/1.24.0 (Ubuntu)`（§10.3）——ので、現状ここは該当しない。将来変わった
ときのために残しておく。その場合は次の 2 点が変わり、どちらも「Basic Auth が効いて
いる」と結論づける前に確認する価値がある:

- 後続の認証あり request に cache された `401` が返る、あるいは anonymous request に
  cache された `200` が返ると、edge 側で境界が破られる。`401` は default では
  cache 対象ではなく、origin もそれを可能にする `Cache-Control` を付けていないが、
  前提にせず 2 回 request して確認すること。
- Cloudflare Access は本セクションの**代替**であって、追加ではない。それが良い答えに
  なるのは、ホストが既に他の理由で Access の背後にある場合だけ。レビュー環境 1 つを
  守るために identity provider を新規導入するのは `auth_basic` 1 行より可動部が
  多く、本 runbook は両方を抱えない。

### 10.7 Rollback

staging のみ。ここでの操作が production に影響することは無い。

```sh
STG=$(readlink -f /etc/nginx/sites-enabled/portfolio-stg)
sudo cp -a "$(ls -t "$STG".bak-* | head -n 1)" "$STG"
sudo nginx -t && sudo systemctl reload nginx
```

その後 GitHub Settings で `STG_BASIC_USER` と `STG_BASIC_PASS` を削除する。削除し
ないと、次の staging smoke が既に存在しない境界を検証しようとして red になる。両方
削除すれば smoke は `open` mode に戻る。

---

## Known gaps

- **No `og:image`.** Shared links render as a text-only card. The only images on
  this site are Evidence screenshots, and those carry a provenance contract that
  a social card strips off.
- **No automatic release pruning.** By design; see §8.
- **The smoke reaches the site over the public origin only.** It cannot
  distinguish "nginx is serving the previous release" from "`current` did not
  move" except through the hero-copy check, which is why that check is not
  optional.
- **`/var/www/portfolio` is still on disk** and is not managed by anything after
  §3. It is a deliberate fallback (§7.2), not a live path.
