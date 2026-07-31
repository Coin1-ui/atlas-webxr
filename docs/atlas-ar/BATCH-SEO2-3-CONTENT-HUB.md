# SEO-2 Batch 3 — Content hub (`/learn`)

**Status:** **live PASS** · **Date:** 2026-07-31  
**Scope lock:** same-host hub only. **No** marketing host split. **No** MKT-3b media. **No** BILL-1 / PM-4.

## Acceptance criteria

- [x] Code: route-specific prerender shells for `/learn` + 3 articles (Amplify `834e2ba`; verified at `/learn/index.html`)
- [x] `sitemap.xml` lists hub + 3 articles (10 indexable URLs) — **live**
- [x] Marketing nav exposes **Learn**; CTAs to pricing / signup only
- [x] Amplify Console redirects include `/learn` + slug 301 strip + 200 shells **before** SPA catch-all — **live PASS 2026-07-31**
- [x] Clean URL live verify: `/learn` title ≠ home — **PASS** (Learn Atlas AR… · canonical `/learn`)
- [x] `/learn/` → 301 → `/learn` — **PASS**
- [x] Article shell: `/learn/browser-ar-product-demo` title + Article JSON-LD — **PASS**
- [x] GSC Request indexing for `/learn` + 3 articles — **done** (user, 2026-07-31)
- [x] SEO-OPS Phase 2 “Content hub” checked; backlog SEO-2 remains **partial** (host-split still todo)

## Seed URLs

| Path | Purpose |
|------|---------|
| `/learn` | Hub index |
| `/learn/browser-ar-product-demo` | Browser AR / share link without an app |
| `/learn/glb-usdz-workflow` | GLB upload → iOS Quick Look / Android Scene Viewer |
| `/learn/atlas-ar-for-teams` | Trial, workspaces, who it’s for |

## Out of scope

CMS, MDX, host split, demo mp4s, billing cutover.
