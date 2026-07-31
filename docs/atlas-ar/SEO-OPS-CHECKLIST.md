# Atlas AR — SEO ops checklist (www.atlasar.in)

Canonical host: **`https://www.atlasar.in`** (www wins). Code and sitemap assume this origin.

## Amplify / DNS (one-time)

- [x] Custom domain `www.atlasar.in` attached to Amplify app (prod `main`)
- [x] Apex `atlasar.in` **301** → `https://www.atlasar.in` (live re-verify 2026-07-30)
- [x] `http://` → `https://` (Amplify / certificate)
- [x] SSL valid for www + apex
- [x] **Console redirects** match [`AMPLIFY-REDIRECTS.json`](./AMPLIFY-REDIRECTS.json) — see [`AMPLIFY-REDIRECTS.md`](./AMPLIFY-REDIRECTS.md)
  - SPA rule must be status **`200`** (regex), **not** only `/<*>` `404-200`
  - Slash-strip 301s for `/pricing/` `/about/` `/legal/*/`
  - sales-deck / storyboard 200 rewrites present
- [x] Incognito check: `/pricing` stays **no** trailing slash and returns **200**

## Post-deploy verification

- [x] `https://www.atlasar.in/robots.txt` returns Allow/Disallow + Sitemap line
- [x] `https://www.atlasar.in/sitemap.xml` lists exactly six URLs
- [x] Home HTML has absolute `og:image` / `og:url` / Twitter tags
- [x] Client nav to `/pricing` updates `document.title` + canonical + JSON-LD (SPA `applyRouteMeta`)
- [x] `/login`, `/admin`, `/sales-deck/` send `noindex` (SPA meta or static meta)

## Search Console / Bing (manual)

- [x] GSC HTML verification file live: `https://www.atlasar.in/google6baa8a3d0d627b22.html` (Amplify `cf78e70`, 200 + exact body 2026-07-31)
- [x] Google Search Console property: `https://www.atlasar.in/` — **Verified** (HTML file, 2026-07-31)
- [x] Submit sitemap: `https://www.atlasar.in/sitemap.xml` — **Success** in GSC (2026-07-31)
- [ ] Bing Webmaster Tools property + same sitemap (**next batch**)
- [x] Request indexing for `/`, `/pricing`, `/about` — done 2026-07-31 (URL Inspection)

## Indexable allowlist

- `https://www.atlasar.in/`
- `https://www.atlasar.in/pricing`
- `https://www.atlasar.in/about`
- `https://www.atlasar.in/legal/terms`
- `https://www.atlasar.in/legal/privacy`
- `https://www.atlasar.in/legal/acceptable-use`

## Always noindex

Auth, onboard, admin, account, owner, demo, `/ar/*`, `/w/*`, `/sales-deck/*`, `/mkt-3-storyboard/*`.

## Phase 2 (backlog SEO-2)

Prerender/static HTML shells for the six URLs, content hub, richer Offer schema, optional marketing host split — only after Phase 1 GSC coverage is healthy.

**Phase 1 GSC status (2026-07-31):** Ownership Verified · sitemap Success · Request indexing for `/` `/pricing` `/about` done. **Only open search-ops item:** Bing Webmaster. SEO-2 waits for healthy coverage.
