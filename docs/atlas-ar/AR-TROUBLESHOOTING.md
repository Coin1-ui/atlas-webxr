# Atlas AR — AR troubleshooting (SUP-2)

**Last updated:** 2026-05-21  
**Audience:** Support, customer success, and workspace admins  
**In-app mirror:** Desktop admin → **Help** (`/admin/help`) — HTTPS, camera, WebXR, and common fixes sections

---

## Quick triage

| Symptom | First check |
|---------|-------------|
| No camera prompt | URL must be **https://** (not http) |
| “Permission denied” | Reset site camera permission (see below) |
| Blank showroom | At least one GLB uploaded; refresh `/w/{slug}` |
| iPhone shows Start AR only | Use **View in AR** on catalog cards (Quick Look) |
| AR button missing | Owner dashboard → **Start AR** enabled for workspace |

---

## HTTPS requirements

Browsers expose camera and WebXR only on **secure contexts**:

- Production Amplify URLs are HTTPS by default.
- **Never** share `http://` showroom links with shoppers — Android Chrome will not grant camera access.
- Local phone testing: `npx vite --host --https` → open `https://PC-IP:5173` and accept the certificate warning once.
- Embedded iframes on HTTP parent pages cannot run camera AR — open Atlas in a top-level browser tab.
- Corporate TLS inspection may break WebXR — test on cellular if store Wi‑Fi fails.

**Customer message:** “Open the link we sent — the address bar should show a lock icon and start with https.”

---

## Camera permissions — Android (Chrome)

1. Shopper taps **Start AR** (direct tap required for WebXR).
2. Chrome prompts **Allow camera** → must tap Allow.
3. If denied previously:
   - Chrome **⋮** → **Settings** → **Site settings** → **Camera**
   - Find the Atlas domain → **Allow**
   - Reload the page and tap Start AR again
4. Use **Chrome**, not Instagram/Facebook in-app browsers.
5. **Camera in use:** close Camera app and other apps using the rear camera.

| Error | Meaning |
|-------|---------|
| `NotAllowedError` | Permission denied — reset in site settings |
| `NotFoundError` | No usable camera |
| `NotReadableError` | Camera busy in another app |

---

## Camera & AR — iPhone (Safari)

- Catalog **View in AR** → **Quick Look** (USDZ generated at upload).
- **Settings → Safari → Camera** → Ask or Allow for your domain.
- Train staff: **View in AR** on iPhone, not Start AR on catalog cards.
- Private browsing may re-prompt every session.

If Quick Look opens but model is missing: confirm USDZ generation completed in admin after GLB upload.

---

## WebXR vs Quick Look

| Platform | Path | UX |
|----------|------|-----|
| Android Chrome | WebXR | Start AR → floor scan → place → AR/3D toggle |
| iPhone Safari | Quick Look | View in AR → place in room |
| Desktop | N/A | Upload/branding only — AR on phone |

---

## Common fixes

- **Empty showroom** — upload GLB from desktop admin; wait for success toast; reload showroom.
- **Invalid GLB** — must be glTF 2.0 binary; admin shows validation error on bad files.
- **Floating / wrong scale** — Atlas uses floor planes; use floor-tuned assets.
- **AR disabled** — platform owner: `/owner` → enable **Start AR** for customer workspace.
- **Diagnostics** — shopper can **Download session log (JSON)** from AR UI; attach to support ticket.

---

## Related

- [QA-SPRINT3.md](./QA-SPRINT3.md) — device sign-off checklist  
- [backlog.md](./backlog.md) — SUP-2 / Batch 22 orchestration log  
- Admin help in app: `/admin/help` (desktop)
