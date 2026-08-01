# Amplify rewrites & redirects — paste into Console

## Why Console did not show `amplify.yml` SEO rules

Editing **Hosting → Rewrites and redirects** in the Amplify Console becomes the **live source of truth**. Your screenshot only had:

1. Apex `https://atlasar.in` → `https://www.atlasar.in` (301)
2. SPA `/<*>` → `/index.html` (`404-200`)

That **replaced** the richer rules from `amplify.yml` (slash strips + sales-deck). With `404-200`, Amplify’s “clean URL” behavior also **301s `/pricing` → `/pricing/`**, then serves the SPA under a **404** status — bad for SEO.

## Fix (do this in Console now)

1. Open **Amplify → atlas-webxr → Hosting → Rewrites and redirects → Manage redirects**.
2. Replace the entire JSON with the contents of [`AMPLIFY-REDIRECTS.json`](./AMPLIFY-REDIRECTS.json) (same repo: `docs/atlas-ar/AMPLIFY-REDIRECTS.json`).
3. Click **Save**.
4. Wait 1–2 minutes; test in an **incognito** window (301s cache hard).

### What the new rules do

| Order | Rule | Purpose |
|-------|------|---------|
| 1–2 | Apex → www (301) | Canonical host |
| 3–11 | `/pricing/` `/about/` `/learn/` `/learn/*/` `/legal/*/` → strip slash | Strip trailing slash |
| 12–21 | `/pricing` `/about` `/learn` + articles `/legal/*` → `…/index.html` **200** | SEO-2 prerender shells |
| 22–30 | sales-deck / storyboard → real HTML (200) | Enablement pages |
| Last | SPA regex → `/index.html` (**200**, not 404-200) | Serve app **without** Amplify adding `/` on miss |

Static files with extensions (`.js`, `.css`, `.txt`, `.xml`, images, video, `.html`, **`.glb`**, **`.usdz`**) are **not** rewritten by the SPA rule — `robots.txt` / `sitemap.xml` / shells keep working.

### Showcase GLBs (2026-08-01)

If `/showcase/*.glb` returns `text/html`, the Console SPA allowlist is stale **or** the file is missing from the deploy. Working fallback used by the app:

- Serve sales demo models from `/custom-models/showcase/*.glb` (proven `model/gltf-binary` on prod).
- Still paste full [`AMPLIFY-REDIRECTS.json`](./AMPLIFY-REDIRECTS.json) so `/showcase` redirects and `glb|usdz` exclusions stay correct.

**Verify after Console save:**

```text
https://www.atlasar.in/custom-models/showcase/ct202.glb  → 200, Content-Type model/gltf-binary (or octet-stream)
https://www.atlasar.in/sales-deck/showcase               → 200 SPA
https://www.atlasar.in/showcase/ct202.glb                → ideally binary after Console sync (not HTML)
```

## After Save — verify

```text
https://www.atlasar.in/pricing     → 200, URL stays /pricing (no slash)
https://www.atlasar.in/pricing/    → 301 → /pricing
https://www.atlasar.in/learn       → 200, Learn title/canonical (not home)
https://www.atlasar.in/learn/browser-ar-product-demo → 200, article shell
View-source /pricing               → title/canonical for Pricing (not home) + JSON-LD
https://www.atlasar.in/robots.txt  → 200
https://www.atlasar.in/sitemap.xml → 200 (10 locs after SEO-2 Batch 3)
https://atlasar.in/                → 301 → https://www.atlasar.in/
```

## Keep Console and `amplify.yml` in sync

- After any Console edit, copy the JSON back into `docs/atlas-ar/AMPLIFY-REDIRECTS.json` and mirror `amplify.yml` `customRedirects`.
- Re-deploy alone does **not** reliably overwrite Console redirects once they were edited in the UI.
