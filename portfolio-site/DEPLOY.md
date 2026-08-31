# Deployment runbook

Target: **https://portfolio.neppepe.net**
Document root: **`/var/www/portfolio`**
Artifact: **`dist/`** — static files only. No Node process, no database, no
environment configuration in production.

This runbook was written against the conditions known at IMPLEMENT-03. Two of
them are stated rather than verified, because this repository has no access to
the server: the exact nginx site file and the user nginx workers run as. Both
are marked below. **Confirm them on the host before the first deploy** — do not
take the values here as facts about the machine.

---

## 0. Preconditions

Run on the build machine, from the repository root:

```sh
npm run qa
```

`qa` is `validate:content` → `check` → `test` → `build` → `check:links`, and it
is the gate. It must end with:

```
Truth Gate: PASS
0 errors
tests 78 / pass 78 / fail 0
8 page(s) built
DEAD_LINKS = 0 / DEAD_ANCHORS = 0 / ACCESSIBILITY_CONTRACT = PASS
SEO_METADATA = PASS / CANONICAL_URLS = PASS / SITEMAP = PASS / ROBOTS = PASS / NOINDEX_RESIDUAL = 0
```

Do not deploy a `dist/` produced by a bare `npm run build`. `check:links` runs
**after** the build and is what proves the canonical URLs, the sitemap and
`robots.txt` in the artifact agree with the pages actually emitted. A build
alone does not check any of that.

The origin is declared once, in `astro.config.mjs` (`site:`). Everything
absolute in the artifact — canonical links, `og:url`, the sitemap, the
`Sitemap:` line in `robots.txt` — is derived from it, and `check-links` reads it
back out of the config to verify. Serving this artifact from any other hostname
publishes canonical links pointing at `portfolio.neppepe.net`.

---

## 1. Back up the current document root

Before anything is written. The timestamp is the rollback handle.

```sh
STAMP=$(date +%Y%m%d-%H%M%S)
sudo cp -a /var/www/portfolio "/var/www/portfolio.bak-$STAMP"
echo "$STAMP"          # write this down — step 8 needs it
```

`cp -a` preserves ownership, permissions and timestamps, so the backup can be
moved back as-is.

---

## 2. Copy the artifact

```sh
sudo rsync -a --delete dist/ /var/www/portfolio/
```

`--delete` is deliberate: `dist/` is the whole site, and files left behind from
an earlier build are stale routes that still serve. It is also the reason step 1
is not optional — `--delete` removes anything in the document root that this
build did not produce.

CSS is content-hashed (`_astro/BaseLayout.<hash>.css`), so a browser holding the
old stylesheet is not served new HTML against a stale cached file.

---

## 3. Permissions

Files must be readable by the user nginx workers run as — **assumed
`www-data`; confirm with `ps -o user= -C nginx | sort -u`**.

```sh
sudo chown -R root:root /var/www/portfolio
sudo find /var/www/portfolio -type d -exec chmod 755 {} +
sudo find /var/www/portfolio -type f -exec chmod 644 {} +
```

Directories need `x` to be traversable; 755/644 gives the worker read access
without giving it write access to the content it serves.

---

## 4. nginx configuration test

```sh
sudo nginx -t
```

The site is static with `trailingSlash: 'always'`, so the location block needs
to resolve `/work/crm/` to `/work/crm/index.html`:

```nginx
root /var/www/portfolio;
index index.html;
location / {
    try_files $uri $uri/ =404;
}

# The site's own 404 document. Without this line the =404 above is answered by
# nginx's default error page. `internal` keeps /404.html from being requested
# directly as if it were a route — it is not one, and it is not in the sitemap.
error_page 404 /404.html;
location = /404.html {
    internal;
}
```

The status code stays 404: `error_page` substitutes the body, not the status.
Verify both together after the reload — a page that renders correctly but
answers 200 is a soft 404, which tells a crawler the address exists.

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/no-such-page/   # 404
curl -s https://portfolio.neppepe.net/no-such-page/ | grep -o '<title>[^<]*</title>'   # 404 — ページが見つかりません。
```

**Assumed to be at `/etc/nginx/sites-available/portfolio.neppepe.net`; confirm
with `sudo nginx -T | grep -n portfolio`.** If `nginx -t` fails, stop — nothing
has been reloaded yet, and the previous configuration is still live.

Reload only after `nginx -t` passes:

```sh
sudo systemctl reload nginx
```

A configuration change is usually not needed for a content-only deploy. Reload
only if you changed the site file.

---

## 5. HTTP smoke

The canonical origin is HTTPS, so plain HTTP should redirect rather than serve.

```sh
curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://portfolio.neppepe.net/
```

Expect a `301` (or `308`) to `https://portfolio.neppepe.net/`.

---

## 6. HTTPS smoke

```sh
curl -sSI https://portfolio.neppepe.net/ | head -1
curl -sS https://portfolio.neppepe.net/robots.txt
curl -sS -o /dev/null -w '%{http_code}\n' https://portfolio.neppepe.net/sitemap.xml
```

Expect `200`, the three-line robots file ending in the `Sitemap:` URL, and `200`
for the sitemap. Also confirm the certificate is valid for the host:

```sh
curl -sS -o /dev/null -w 'tls=%{ssl_verify_result} (0 = ok)\n' https://portfolio.neppepe.net/
```

---

## 7. Route smoke

Every published route, taken from the sitemap the deploy just published — so
this checks the live site against its own claim about what exists rather than
against a list typed here that can go stale:

```sh
curl -sS https://portfolio.neppepe.net/sitemap.xml \
| grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' \
| while read -r url; do
    printf '%s  %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' "$url")" "$url"
  done
```

Expect `200` on all **8** URLs, with no redirects. A `301` here usually means a
trailing slash was lost.

Then confirm the canonical link on the live site names the live host:

```sh
curl -sS https://portfolio.neppepe.net/work/crm/ | grep -o 'rel="canonical" href="[^"]*"'
```

Expect `https://portfolio.neppepe.net/work/crm/`.

---

## 8. Rollback

If any smoke step fails, put the backup back. This is a directory swap, so it is
as fast as the deploy was and does not depend on rebuilding anything:

```sh
STAMP=<the value from step 1>
sudo rm -rf /var/www/portfolio
sudo mv "/var/www/portfolio.bak-$STAMP" /var/www/portfolio
sudo nginx -t && sudo systemctl reload nginx
```

Then re-run step 7 against the restored site before investigating.

Keep the last two or three backups and remove older ones by hand. Nothing here
prunes them automatically, because a rollback target deleted by a cron job is
the one thing this step cannot recover from.

---

## Known gaps

- **The 404 page needs the `error_page` line to be reached.** `dist/404.html` is
  built and its copy is approved, but nginx serves its own default error page
  until §4's `error_page 404 /404.html;` is in the site file. Until that line is
  deployed, an unknown URL still gets the nginx default. Nothing on the site
  links to a missing route (`check-links` proves `DEAD_LINKS = 0`), so this is
  reachable only by typing a URL by hand.
- **No `og:image`.** Shared links render as a text-only card. The only images on
  this site are Evidence screenshots, and those carry a provenance contract that
  a social card strips off.
