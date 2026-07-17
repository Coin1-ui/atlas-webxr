# Atlas Field AR — Logo PNG exports (DES-2)

Raster exports for marketing video, web UI, PWA, and favicons. Regenerate after any SVG master change:

```bash
npm run generate:brand
```

## Sources (`sources/`)

| File | Use |
|------|-----|
| `atlas-mark-transparent.svg` | Mark only — video overlays, transparent PNGs |
| `atlas-wordmark-raster-dark.svg` | Dark-bg wordmark (system fonts, no Google Fonts) |
| `atlas-wordmark-raster-light.svg` | Light-bg wordmark |
| `atlas-title-card-1920.svg` | Full HD title card for MKT-3 demo video |

SVG masters with Instrument Serif live in `../` (`atlas-wordmark.svg`, etc.).

## Export folders

| Folder | Sizes | Purpose |
|--------|-------|---------|
| `mark-app/` | 64–1024 px | App icon, nav mark |
| `mark-transparent/` | 128–1024 w | Video overlay |
| `wordmark-dark/` | 380–2280 w | Nav, dark marketing |
| `wordmark-light/` | 380–2280 w | Light backgrounds, print |
| `favicon/` | 16, 32, 180, 512 | Browser / PWA |
| `marketing/` | 1920×1080 title card, 1520w overlay | MKT-3 demo video |

## Web paths

Mirrored under `public/brand/` for production. Nav uses `/brand/wordmark-dark/wordmark-dark-380w.png`.

## Marketing video (MKT-3)

- **Title card:** `marketing/title-card-1920x1080-dark.png`
- **Overlay wordmark:** `marketing/wordmark-overlay-1520w-dark.png`
- **Transparent mark:** `mark-transparent/mark-transparent-512w.png`
