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
| 3–7 | `/pricing/` → `/pricing` (etc.) | Strip trailing slash |
| 8–12 | `/pricing` → `/pricing/index.html` (etc.) **200** | SEO-2 prerender shells |
| 13–21 | sales-deck / storyboard → real HTML (200) | Enablement pages |
| Last | SPA regex → `/index.html` (**200**, not 404-200) | Serve app **without** Amplify adding `/` on miss |

Static files with extensions (`.js`, `.css`, `.txt`, `.xml`, images, video, `.html`) are **not** rewritten by the SPA rule — `robots.txt` / `sitemap.xml` / shells keep working.

## After Save — verify

```text
https://www.atlasar.in/pricing     → 200, URL stays /pricing (no slash)
https://www.atlasar.in/pricing/    → 301 → /pricing
View-source /pricing               → title/canonical for Pricing (not home) + JSON-LD
https://www.atlasar.in/robots.txt  → 200
https://www.atlasar.in/sitemap.xml → 200
https://atlasar.in/                → 301 → https://www.atlasar.in/
```

## Keep Console and `amplify.yml` in sync

- After any Console edit, copy the JSON back into `docs/atlas-ar/AMPLIFY-REDIRECTS.json` and mirror `amplify.yml` `customRedirects`.
- Re-deploy alone does **not** reliably overwrite Console redirects once they were edited in the UI.
