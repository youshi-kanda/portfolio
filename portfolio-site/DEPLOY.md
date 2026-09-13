# Deployment runbook

Target: **https://portfolio.neppepe.net**
Stable document root: **`/var/www/portfolio`** — a **symlink** to the live release
Releases: **`/var/www/portfolio-releases/<git-sha>/`**
Artifact: **`dist/`** — static files only. No Node process, no database, no
environment configuration in production.

Staging is a separate site with a separate root and a separate workflow, and the
two never cross:

| | branch | workflow | document root | origin |
|---|---|---|---|---|
| production | `main` | `.github/workflows/deploy-production.yml` | `/var/www/portfolio` (symlink) | https://portfolio.neppepe.net |
| staging | `release/portfolio-site-v4` | `.github/workflows/deploy-staging.yml` | `/var/www/portfolio-stg` (directory) | https://stg-portfolio.neppepe.net |

---

## 0. How a production deploy works

A push to `main` that touches `portfolio-site/**` builds, gates, uploads to a
**new release directory named after the commit SHA**, and then moves the
document-root symlink onto it with a single `rename(2)`.

```
/var/www/
├── portfolio            -> portfolio-releases/<sha>/     ← the symlink nginx serves
└── portfolio-releases/
    ├── <sha-a>/         ← an earlier release, kept
    ├── <sha-b>/         ← the live release
    └── previous         ← a text file: the path the symlink pointed at before
```

Two properties this buys, and why each matters:

- **The live root is never written to.** `rsync` only ever targets a release
  directory. There is no window in which the document root is half a build.
- **Activation is one rename.** A fresh temporary symlink is created beside the
  live root and renamed over it. There is no instant in which
  `/var/www/portfolio` does not exist, so no request can arrive while the
  document root is missing.

`rm -rf /var/www/portfolio && ln -s ...` would violate both, and is never the
procedure — not in the workflow, and not by hand. See §7.

**nginx's `root` never changes.** It stays `/var/www/portfolio` through every
deploy and every rollback. Only what that name points at moves.

---

## 1. The gate

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
numbers are recorded in the run log and are useful when reading a diff between
two runs — they are *not* thresholds, and a runbook that pins them breaks every
time a page or a test is added. At the time of writing they were `tests 194`,
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

## 2. The automatic path

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

Steps, in order:

1. `npm ci`
2. **`npm run qa`** — the gate from §1
3. `npm run build`
4. Configure SSH from `VPS_SSH_KEY` / `VPS_KNOWN_HOSTS`
5. **Probe remote privileges** — see §2.1
6. **Upload release** — `rsync` into `/var/www/portfolio-releases/$GITHUB_SHA/`
7. **Verify release contents** — see §2.2
8. **Activate** — assert, record previous, atomic rename
9. **Production smoke** — `.github/scripts/production-smoke.sh`
10. **Roll back** — only on the condition in §2.3

A re-run of the same SHA is safe: the upload is `rsync --delete` into a
directory named after that SHA, so it converges on the same tree rather than
accumulating, and activation notices the symlink already points there.

### 2.1 Remote privileges

The atomic switch renames an entry *inside* `/var/www`, so the deploy account
needs write **and** execute on that directory — not merely on the release tree.
The workflow probes for this once and picks a mode:

- `direct` — the account can write `/var/www` itself. Nothing runs as root.
- `sudo` — it cannot, but `sudo -n true` succeeds. `rsync` runs under
  `--rsync-path="sudo -n rsync"` and the link operations under `sudo -n`.
- `none` — neither. **The workflow fails here and deploys nothing.** Fix the
  host; do not weaken the deploy to get past it.

### 2.2 What must be in a release before it is activated

`index.html`, `404.html`, `robots.txt`, at least one `sitemap*.xml`, and a
non-empty `_astro/`. A release missing any of them is not activated.

### 2.3 When rollback runs, and when it must not

Rollback runs **only** when activation succeeded and a later step failed —
in practice, when the smoke in §6 fails:

```yaml
if: failure() && steps.activate.outcome == 'success'
```

A failure in checkout, `npm ci`, the QA gate, the build, SSH configuration,
upload or release verification means the symlink was never moved. There is
nothing to roll back, and moving the pointer would be the only change the run
made. That is why the condition tests the activation step and not just
`failure()`.

After a rollback the run **stays failed**. The release was not accepted, and a
green check would say it was. The failed release directory is left on disk on
purpose — it is the evidence. Nothing prunes releases automatically (§8).

### 2.4 Secrets

`VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `VPS_HOST`, `VPS_USER`, `VPS_PORT` — the same
five staging uses.

`known_hosts` is written from the secret and `StrictHostKeyChecking` stays on.
`ssh-keyscan` is never run inside the workflow: a host key learned at deploy
time authenticates nothing. No secret is ever echoed or logged.

---

## 3. One-time migration — placeholder directory → release symlink

**Run once, before the first automatic deploy.** Until it is done, the
`Activate` step asserts and fails rather than converting the live root
mid-deploy.

The goal is to end with `/var/www/portfolio` as a symlink **without changing
what the site serves**. The existing placeholder is preserved as the first
release, so immediately after this migration `portfolio.neppepe.net` still shows
exactly what it showed before, and the very next thing to move the pointer is
GitHub Actions.

The current placeholder directory is **not deleted** at any point.

```sh
set -eu
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASES=/var/www/portfolio-releases
LIVE=/var/www/portfolio

# 0. Refuse to run twice.
if [ -L "$LIVE" ]; then echo "already migrated: $LIVE -> $(readlink "$LIVE")"; exit 0; fi
[ -d "$LIVE" ] || { echo "$LIVE is not a directory — stop and investigate"; exit 1; }

# 1. Releases directory, on the same filesystem as $LIVE's parent.
sudo mkdir -p "$RELEASES"

# 2. Move — not copy — the placeholder in as the initial release, so there is
#    never a second copy of the document root to diverge from.
sudo mv "$LIVE" "$RELEASES/initial-$STAMP"

# 3. Point the stable root at it, atomically into place.
sudo ln -s "$RELEASES/initial-$STAMP" "/var/www/.portfolio.new.$$"
sudo mv -T "/var/www/.portfolio.new.$$" "$LIVE"

# 4. Seed the rollback pointer.
printf '%s\n' "$RELEASES/initial-$STAMP" | sudo tee "$RELEASES/previous" >/dev/null

# 5. Confirm.
ls -ld "$LIVE"; readlink "$LIVE"
```

Between steps 2 and 3 the document root does not exist and requests get an
error, so run them together — the gap is milliseconds, and it is the only such
gap in the whole design. It exists once, at migration, and never again.

Then confirm the site is unchanged:

```sh
curl -sS https://portfolio.neppepe.net/ | grep -o '<title>[^<]*</title>'
```

Still the placeholder title. Nothing was published by this step.

**Ownership.** After migrating, make sure the deploy account satisfies §2.1 —
either it owns `/var/www` and `/var/www/portfolio-releases`, or it has a
passwordless `sudo` rule. Files must also stay readable by the user nginx
workers run as (`ps -o user= -C nginx | sort -u`). The workflow uploads with
`--chmod=D755,F644`, which gives the worker read access without write access to
the content it serves.

---

## 4. nginx configuration

> **This section is written against the effective server block on the host.
> Confirm it with `sudo nginx -T` before editing, and change only the lines
> named here.** `server_name`, `listen`, TLS, certificate paths, security
> headers and everything else in the block stay as they are.

Find the block that actually serves the name:

```sh
sudo nginx -T | grep -n 'portfolio.neppepe.net'
```

### The defect

As of this writing the production server block answers **every** path with the
same 208-byte placeholder, `200 text/html`:

```
/                200 text/html  <title>Portfolio Test</title>
/robots.txt      200 text/html  <title>Portfolio Test</title>
/sitemap.xml     200 text/html  <title>Portfolio Test</title>
/no-such-page/   200 text/html  <title>Portfolio Test</title>
```

This is not a missing `error_page`. `/robots.txt` and `/sitemap.xml` are real
files that would be served with their own content type if the request reached
the filesystem — that they come back as HTML means the block rewrites
everything to `index.html` (an SPA-style catch-all, e.g.
`try_files $uri $uri/ /index.html;`). Every unknown URL is therefore a **soft
404**: it tells a crawler the address exists. Treated as a **BLOCKER** — the
site cannot be published over this configuration.

Staging, on the same host, already answers `/no-such-page/` with `404`, so a
correct block for this artifact exists on the machine to compare against.

### The intended shape

The site is static with `trailingSlash: 'always'`, so the location block has to
resolve `/work/crm/` to `/work/crm/index.html`, and has to *stop* rather than
fall back when there is no such file:

```nginx
root /var/www/portfolio;
index index.html;

location / {
    try_files $uri $uri/ =404;
}

# The site's own error document. Without this, the =404 above is answered by
# nginx's default error page. `internal` keeps /404.html from being requested
# directly as if it were a route — it is not one, and it is not in the sitemap.
error_page 404 /404.html;
location = /404.html {
    internal;
}
```

`root` is `/var/www/portfolio` — the symlink — and stays that way. nginx
resolves it per request, so the atomic switch needs no reload.

The status stays 404: `error_page` substitutes the body, not the status. Verify
both together — a page that renders correctly but answers 200 is the same soft
404 in a nicer costume.

### Applying it

```sh
sudo nginx -t          # must pass before anything is reloaded
sudo systemctl reload nginx
```

If `nginx -t` fails, stop. Nothing has been reloaded and the previous
configuration is still live.

### Expected state after the nginx fix but *before* the first site deploy

At this point the live root is still the placeholder release from §3, now served
by a correct block:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/                # 200  (placeholder)
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/no-such-page/   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/sitemap.xml     # 404  (not published yet)
```

`/sitemap.xml` answering 404 here is correct, and is the clearest proof the
catch-all is gone.

---

## 5. Manual deploy (fallback only)

The workflow is the supported path. Use this only when Actions is unavailable.
It is the same sequence, by hand, and it keeps the same invariant: **never
`rsync` into the live root.**

```sh
set -eu
SHA=$(git rev-parse HEAD)
RELEASES=/var/www/portfolio-releases
LIVE=/var/www/portfolio

npm run qa                                    # §1 — the gate

ssh <deploy> "mkdir -p $RELEASES/$SHA"
rsync -rlptz --delete --chmod=D755,F644 dist/ "<deploy>:$RELEASES/$SHA/"

ssh <deploy> "test -L $LIVE || { echo 'live root is not a symlink — see §3'; exit 1; }
  readlink -f $LIVE | tee $RELEASES/previous
  ln -s $RELEASES/$SHA /var/www/.portfolio.new.\$\$
  mv -T /var/www/.portfolio.new.\$\$ $LIVE"
```

Then run §6. If it fails, run §7.

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

The home-page check retries for up to 30s. nginx can hold a cached file
descriptor for a moment after the symlink moves (`open_file_cache`), and a good
release should not be rolled back over a two-second window.

Ends in `PRODUCTION_SMOKE = PASS` or `PRODUCTION_SMOKE = FAIL (n check(s))`.

---

## 7. Rollback

Rolling back is moving the symlink back. It does not rebuild, re-upload or
delete anything, so it is as fast as a rename and cannot fail halfway.

The workflow does this automatically under the condition in §2.3. By hand:

```sh
set -eu
RELEASES=/var/www/portfolio-releases
LIVE=/var/www/portfolio

# 1. What was live before the last switch.
PREV=$(cat "$RELEASES/previous")
echo "$PREV"
[ -d "$PREV" ] || { echo "previous target is not a directory — pick one from $RELEASES"; exit 1; }

# 2. Temporary link beside the live root, then one atomic rename over it.
sudo ln -s "$PREV" "/var/www/.portfolio.rollback.$$"
sudo mv -T "/var/www/.portfolio.rollback.$$" "$LIVE"

# 3. Confirm and re-smoke.
readlink "$LIVE"
```

Then re-run §6 against the restored site before investigating.

To roll back to something other than the immediately previous release, list
`/var/www/portfolio-releases/` and use that directory as `$PREV` — every release
is a complete document root, so any of them can be made live the same way.

**Not the procedure**, and not to be reintroduced:

```sh
rm -rf /var/www/portfolio        # ← the document root ceases to exist
mv /var/www/portfolio.bak-... /var/www/portfolio
```

That is the pre-symlink runbook. It has a window in which nginx has no document
root, and it destroys the thing it is trying to recover before it has the
replacement in place. The only place a `.bak`-style move still appears is the
one-time migration in §3, which is a different operation with a different
purpose.

---

## 8. Release retention

Nothing prunes `/var/www/portfolio-releases/` automatically, deliberately: a
rollback target removed by a cron job is the one thing rollback cannot recover
from. Keep the live release, the previous one, and the initial placeholder from
§3; remove older ones by hand after confirming they are not what
`$RELEASES/previous` names.

```sh
du -sh /var/www/portfolio-releases/*
readlink -f /var/www/portfolio      # never delete this
cat /var/www/portfolio-releases/previous   # nor this
```

Watch free space with `df -h /var/www`.

---

## Known gaps

- **No `og:image`.** Shared links render as a text-only card. The only images on
  this site are Evidence screenshots, and those carry a provenance contract that
  a social card strips off.
- **No automatic release pruning.** By design; see §8.
- **The smoke reaches the site over the public origin only.** It cannot
  distinguish "nginx is serving the previous release" from "the symlink did not
  move" except through the hero-copy check, which is why that check is not
  optional.
