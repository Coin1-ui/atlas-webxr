# Atlas Field AR Web

Zero-cost, browser-only procedural training for **Android and iOS**. No app store, no Unity license.

## Features

- Guided step-by-step modules (JSON)
- **Guided camera mode** — works on iOS Safari and all mobile browsers
- **WebXR AR** — automatic on Android Chrome when supported
- QR scan to start (`atlas:module-id` or `?module=`)
- Offline PWA after first load
- Completion export (JSON) stored on device

## Home screen

Two actions only:

- **Start AR** (phone) — tap **Start AR camera**, scan the floor, then tap model icons to place or swap. Model buttons appear **over** the AR camera (no need to exit fullscreen).
- **Manage 3D models (PC only)** — on your computer, upload `.glb` + icon files to the dev server (`npm run dev:phone`). The phone loads them from the same HTTPS URL on Wi‑Fi.
- **Run camera + AR check** — runs the hardware test; download the JSON report only when you tap **Download report (JSON)** on the results screen.

## On-phone hardware check (camera + AR)

After camera checks, tap **Start AR camera** (required on Android). Slowly scan the floor for the blue ring. On the results screen, tap **Download report (JSON)** to save `atlas-device-test-<timestamp>.json` (not auto-downloaded).

Share that JSON file for support or QA records. Last 20 runs are also kept in browser storage.

## Automated mobile tests (emulator JSON report)

Simulates **Pixel 5 / Android Chrome** (not your physical phone):

```bash
npm run test:mobile
```

Report: `test-results/mobile-test-report.json`

## Quick start (dev)

```bash
cd atlas-webxr
npm install
npm run dev
```

Open the URL on your phone (same Wi‑Fi). **HTTPS is required for camera/WebXR on mobile** — use:

```bash
npx vite --host --https
```

HTTPS for phone testing (camera requires this on Android):

```bash
npm run dev:phone
```

Open the **https://** Network URL on your phone (not http). Accept the certificate warning once.

## Deploy (free)

1. Push repo to GitHub
2. Enable **Pages** → source: GitHub Actions (workflow included)
3. App URL: `https://<user>.github.io/<repo>/atlas-webxr/`

Set `base` in `vite.config.ts` if your Pages path differs.

## QR codes for modules

Encode either:

- `atlas:loto-pump-7a`
- `https://your-site.example/?module=loto-pump-7a`

## Modules

| File | Description |
|------|-------------|
| `public/modules/loto-pump-7a.json` | LOTO disconnect training |
| `public/modules/ppe-zone-entry.json` | PPE zone entry |

Add JSON files and register in `src/ui/training-halo.ts` home list.

## What you need

| Item | Required? |
|------|-----------|
| Node.js 20+ | Yes (build) |
| Android or iPhone | Yes (test camera) |
| HTTPS URL | Yes (camera on mobile) |
| GitHub account | Only for free hosting |
| Paid services | **No** for v0.1 |

## Platform notes

| Platform | Experience |
|----------|------------|
| Android Chrome | WebXR AR when available, else camera |
| iOS Safari | Guided camera + QR (reliable) |
| Desktop | Dev preview; camera may work |

## License

Part of agency-agents workspace. Use and modify freely.
