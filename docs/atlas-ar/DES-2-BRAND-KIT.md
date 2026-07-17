# DES-2 — Atlas Field AR Brand Kit

**Status:** Spec complete · wordmark + PNG export pipeline shipped
**Wordmark asset:** [`assets/atlas-wordmark.svg`](./assets/atlas-wordmark.svg)
**Source of truth:** design tokens below mirror `src/style.css` `:root`. If they drift, the CSS wins —
update this doc to match.

---

## 1. Logo / wordmark

Horizontal lockup: **AR-placement mark** + **"Atlas"** wordmark + **"FIELD AR"** tagline.

- **Mark** — a rounded square (matches `--radius-lg` 16–20px) containing an "A" tent anchored to a
  ground plane with an AR reticle at the apex. It reads as *placing an object on a detected surface*
  — the core product moment.
- **Wordmark** — "Atlas" set in **Instrument Serif** (the display face), light text on dark.
- **Tagline** — "FIELD AR" in **DM Sans**, uppercase, `letter-spacing: 4.5`, muted.

### Usage rules
| Do | Don't |
|----|-------|
| Use the SVG at any size (vector) | Rasterize below 120px wide (tagline blurs) |
| Keep clear space ≥ height of the mark on all sides | Recolor the mark to a flat single color |
| On light backgrounds, swap wordmark fill to `#0a1628` and tagline to `#475569` | Put the dark-text version on a busy photo |
| Use mark-only (drop text) as app icon / favicon at ≤ 48px | Stretch, skew, or add drop shadows |

- **Min size:** full lockup 140px wide; mark-only 24px.
- **Clear space:** ≥ 20px (or the mark's corner radius × 2) around the lockup.
- **Favicon / app icon:** mark-only on `--bg` (#050a14) with the accent gradient stroke.

---

## 2. Color palette (tokens)

| Token | Hex / value | Role |
|-------|-------------|------|
| `--bg` | `#050a14` | App background (near-black navy) |
| `--bg-elevated` | `#0f1829` | Raised background |
| `--surface` | `rgba(15,28,52,0.88)` | Cards / panels (glass) |
| `--text` | `#f8fafc` | Primary text |
| `--muted` | `#94a3b8` | Secondary text, taglines, meta |
| `--accent` | `#2dd4bf` | **Primary brand** (teal) — CTAs, links, focus |
| `--accent-secondary` | `#38bdf8` | Sky — gradients, secondary highlight |
| `--accent-press` | `#14b8a6` | Pressed/active accent |
| `--accent-glow` | `rgba(45,212,191,0.4)` | Accent glow / focus halo |
| `--accent-warm` | `#fbbf24` | Warm highlight (amber) — trial/attention |
| `--accent-cool` | `#a78bfa` | Cool highlight (violet) — tertiary gradient stop |
| `--danger` | `#ef5350` | Errors, destructive, suspended/paused |
| `--success` | `#66bb6a` | Success, healthy usage |

**Brand gradient** (mark, hero accents): `#2dd4bf → #38bdf8 → #a78bfa`.
**Hero background:** `--gradient-hero` (layered radial teal/amber/violet on `--bg`).

### Contrast (WCAG)
- `--text` on `--bg`: ~17:1 (AAA).
- `--accent` on `--bg`: ~8:1 (AA for large + normal text).
- `--muted` on `--bg`: ~6:1 (AA normal). Do not use muted for < 14px critical text.
- Never rely on color alone — pair `--danger`/`--success` with an icon or label (see paused states).

---

## 3. Typography

| Role | Family | Token | Usage |
|------|--------|-------|-------|
| Display / headings | **Instrument Serif** (Georgia fallback) | `--font-display` | H1/H2, wordmark, hero |
| Body / UI | **DM Sans** (Segoe UI / system fallback) | `--font-body` | Paragraphs, buttons, labels, tables |

- Display is used sparingly for personality (headings, marketing). UI chrome stays DM Sans for legibility.
- Tagline / eyebrow labels: DM Sans uppercase, `letter-spacing: 3–5px`, `--muted`.
- Numerals in usage/countdowns: DM Sans tabular where possible (avoids jitter in live countdown).

---

## 4. Shape, elevation, motion

- **Radius:** `--radius` 12px (buttons, inputs, cards), `--radius-lg` 20px (large panels, mark).
- **Surfaces:** glass — `--surface` over `--bg-elevated`, subtle 1px border `rgba(148,163,184,.15)`.
- **Focus:** `outline: 2px solid var(--accent)` (never remove; visible on all interactive elements).
- **Glow:** primary CTAs and the AR reticle may use `--accent-glow` for depth; keep subtle.
- **Motion:** countdown ticks 1s; transitions 150–250ms ease; respect `prefers-reduced-motion`
  (disable non-essential animation).

---

## 5. Voice & tone

- **Confident, plain, technical-credible.** We sell to operations/field-training buyers — no hype.
- Verbs are specific: *Subscribe*, *Upgrade*, *Manage plan*, *Restrict*, *Reactivate* — never vague
  ("Get started" only on first-run).
- Trial + billing copy is honest about consequences: "…before your showroom **pauses**", not
  euphemisms. Suspension says "paused/ended" clearly.
- Sentence case for UI; Title Case only for proper product names (Atlas Field AR, Growth, Launch).

---

## 6. Asset inventory

| Asset | Path | Notes |
|-------|------|-------|
| Wordmark — dark bg | `assets/atlas-wordmark.svg` | Light text; web font via `@import`; vector |
| Wordmark — light bg | `assets/atlas-wordmark-light.svg` | Dark ink (`#0a1628`) + deeper gradient for contrast |
| Mark-only (app icon) | `assets/atlas-mark.svg` | Dark rounded tile + gradient "A" tent; no text (font-free) |
| **Logo PNG exports** | `assets/logo/` | All raster sizes — see [`assets/logo/README.md`](./assets/logo/README.md) |
| Mark PNGs | `assets/logo/mark-app/` | 64–1024 px |
| Transparent mark | `assets/logo/mark-transparent/` | Video overlays |
| Wordmark dark PNGs | `assets/logo/wordmark-dark/` | 380–2280 w (nav + marketing) |
| Wordmark light PNGs | `assets/logo/wordmark-light/` | Light-bg exports |
| Marketing title card | `assets/logo/marketing/title-card-1920x1080-dark.png` | MKT-3 demo video intro |
| Favicon 16 | `assets/favicon-16.png` | Browser tab (also `public/favicon-16.png`) |
| Favicon 32 | `assets/favicon-32.png` | Browser tab / bookmarks |
| Apple touch icon | `assets/apple-touch-icon-180.png` | iOS home screen |
| App icon 512 | `assets/icon-512.png` | PWA / store / high-DPI |
| Brand generator | `scripts/generate-brand-assets.mjs` | `npm run generate:brand` — rebuilds all PNGs + copies to `public/brand/` |
| Web brand mirror | `public/brand/` | Served in prod; nav uses `wordmark-dark-380w.png` |
| Brand paths (TS) | `src/shared/brand-assets.ts` | Canonical URLs for UI + MKT-3 |
| Tokens | `src/style.css` `:root` | Live source of truth |

> **App wiring (Batch 31 — shipped):** `public/favicon.svg` is the DES-2 mark; PNG favicons + apple-touch-icon linked in
> `index.html` and sales-deck HTML; PWA manifest icons + `theme_color: #050a14`; marketing nav/footer use raster wordmark
> from `/brand/wordmark-dark/`.
