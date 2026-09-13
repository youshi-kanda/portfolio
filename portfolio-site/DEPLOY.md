# Deployment runbook

Target: **https://portfolio.neppepe.net**
Served tree: **`/var/www/portfolio-live/current`** — a **symlink** to the live release
Releases: **`/var/www/portfolio-live/releases/<git-sha>/`**
Artifact: **`dist/`** — static files only. No Node process, no database, no
environment configuration in production.

Staging is a separate site with a separate root and a separate workflow, and the
two never cross:

| | branch | workflow | nginx `root` | origin |
|---|---|---|---|---|
| production | `main` | `.github/workflows/deploy-production.yml` | `/var/www/portfolio-live/current` (symlink) | https://portfolio.neppepe.net |
| staging | `release/portfolio-site-v4` | `.github/workflows/deploy-staging.yml` | `/var/www/portfolio-stg` (directory) | https://stg-portfolio.neppepe.net |

---

## 0. The host, as measured

Read-only preflight, 2026-09-13. These are the facts the rest of this runbook is
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
    │   └── <git-sha>/                ← one directory per deployed commit
    ├── current -> releases/<git-sha> ← the symlink nginx serves
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
| trigger | `push` to `main` touching `portfolio-site/**` or the workflow file |
| not triggered by | `pull_request`, the release branch, `workflow_dispatch` — there is none |
| `permissions` | `contents: read` |
| `concurrency` | `portfolio-production`, `cancel-in-progress: false` |
| environment | `production` → https://portfolio.neppepe.net |
| Node | 24 |
| SSH user | `deployer` |
| **sudo** | **never** — the workflow contains no `sudo` |

Steps, in order:

1. `npm ci`
2. **`npm run qa`** — the gate from §2
3. `npm run build`
4. Configure SSH — `~/.ssh/config` from the five `VPS_*` secrets
5. **Assert host preconditions** — see §5.1
6. **Upload release** — `rsync` into `releases/$GITHUB_SHA/`
7. **Verify release contents** — see §5.2
8. **Activate** — record `previous`, then one atomic rename
9. **Production smoke** — `.github/scripts/production-smoke.sh`
10. **Roll back** — only on the condition in §5.3

A re-run of the same SHA is safe: the upload is `rsync --delete` into a
directory named after that SHA, so it converges on the same tree rather than
accumulating, and activation notices `current` already points there.

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

Rollback runs **only** when activation succeeded and a later step failed — in
practice, when the smoke in §6 fails:

```yaml
if: failure() && steps.activate.outcome == 'success'
```

A failure in checkout, `npm ci`, the QA gate, the build, SSH configuration, the
precondition assert, upload or release verification means `current` was never
moved. There is nothing to roll back, and moving the pointer would be the only
change the run made. That is why the condition tests the activation step and not
just `failure()`.

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
SHA=$(git rev-parse HEAD)
LIVE=/var/www/portfolio-live

npm run qa                                    # §2 — the gate

ssh deployer@<host> "test -L $LIVE/current || { echo 'not migrated — see §3'; exit 1; }
                     mkdir -p $LIVE/releases/$SHA"
rsync -rlptz --delete --chmod=D755,F644 dist/ "deployer@<host>:$LIVE/releases/$SHA/"

ssh deployer@<host> "
  readlink -f $LIVE/current > $LIVE/previous
  ln -s $LIVE/releases/$SHA $LIVE/.current.new.\$\$
  mv -T $LIVE/.current.new.\$\$ $LIVE/current
  readlink $LIVE/current"
```

Then run §6. If it fails, run §7.1.

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
