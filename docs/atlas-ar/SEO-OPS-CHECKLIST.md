# Atlas AR — SEO ops checklist (www.atlasar.in)

Canonical host: **`https://www.atlasar.in`** (www wins). Code and sitemap assume this origin.

## Amplify / DNS (one-time)

- [ ] Custom domain `www.atlasar.in` attached to Amplify app (prod `main`)
- [ ] Apex `atlasar.in` **301** → `https://www.atlasar.in`
- [ ] `http://` → `https://` (Amplify / certificate)
- [ ] SSL valid for www + apex
- [ ] Confirm trailing-slash 301s from `amplify.yml` (`/pricing/` → `/pricing`, etc.)

## Post-deploy verification

- [ ] `https://www.atlasar.in/robots.txt` returns Allow/Disallow + Sitemap line
- [ ] `https://www.atlasar.in/sitemap.xml` lists exactly six URLs
- [ ] Home HTML has absolute `og:image` / `og:url` / Twitter tags
- [ ] Client nav to `/pricing` updates `document.title` + canonical + JSON-LD
- [ ] `/login`, `/admin`, `/sales-deck/` send `noindex` (SPA meta or static meta)

## Search Console / Bing (manual)

- [ ] Google Search Console property: `https://www.atlasar.in/`
- [ ] Submit sitemap: `https://www.atlasar.in/sitemap.xml`
- [ ] Bing Webmaster Tools property + same sitemap
- [ ] Request indexing for `/`, `/pricing`, `/about` after first crawl

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
