# Atlas AR — Sprint 3 QA (QA-3 & QA-4)

**Last updated:** 2026-05-21  
**Scope:** Close Phase 1 Sprint 3 with automated smoke + manual device sign-off.

---

## Automated tests

**One-time setup:** `npx playwright install chromium`

| Script | What it covers |
|--------|----------------|
| `npm run test:sprint3-api` | API health, public-config, catalog, analytics ingest, usage auth |
| `npm run test:sprint3-e2e` | Dev auth → tenant home → direct AR landing → admin → mobile/iOS UI |
| `npm run test:sprint3` | Both suites + existing auth/tenant/unit smokes |

Reports: `test-results/sprint3-api-smoke.json`, `test-results/sprint3-e2e.json`

E2E uses **Vite dev server** (port 5173) so the local `/v2/*` API middleware is available. Preview-only builds need `VITE_ATLAS_API_URL` set.

### Run against production API (optional)

```powershell
$env:ATLAS_API_URL = "https://YOUR-API-ID.execute-api.YOUR-REGION.amazonaws.com"
$env:ATLAS_TEST_WORKSPACE_SLUG = "your-workspace-slug"
$env:ATLAS_TEST_WORKSPACE_ID = "your-workspace-uuid"
$env:ATLAS_TEST_ID_TOKEN = "eyJ..."   # Cognito ID token from signed-in admin
npm run test:sprint3-api
```

### Run E2E against hosted app (optional)

```powershell
$env:ATLAS_TEST_URL = "https://your-app.amplifyapp.com"
$env:ATLAS_START_SERVER = "0"
$env:ATLAS_SEED_FIXTURE = "0"
npm run test:sprint3-e2e
```

---

## QA-3 — E2E: sign-up → upload → Android AR

**Automated (Playwright, local preview):**

- [x] Global home renders Atlas AR + primary CTA
- [x] Dev sign-in (no Cognito) or Cognito sign-in on staging
- [x] Workspace onboard / tenant home `/w/{slug}`
- [x] Direct model landing `/w/{slug}/ar/{modelId}` with Start AR + Back to catalog
- [x] Admin dashboard + models page (desktop)
- [x] Mobile tenant home hides admin/sign-in; blocks `/login`

**Manual — required for MVP sign-off (physical Android):**

Use a **real workspace** on Amplify + deployed `atlas-api`.

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Open `/signup` on desktop Chrome | Account created + email verified (Cognito) |
| 2 | Complete `/onboard` | Workspace slug created |
<<<<<<< Updated upstream
| 3 | `/admin/models` → upload GLB (≤50 MB) | Model appears in list; USDZ status ready or processing |
=======
| 3 | `/admin/models` → upload GLB (≤50 MB; storage ~2.5× GLB per model) | Model appears in list; USDZ status ready or processing |
>>>>>>> Stashed changes
| 4 | Copy **direct AR link** from admin | URL form `/w/{slug}/ar/{modelId}` |
| 5 | Open link on **Android Chrome** (HTTPS) | Start AR landing shows device line + model name |
| 6 | Tap **Run camera + AR check** | Camera permission granted; checks pass |
| 7 | Tap **Start AR** | WebXR session starts; floor scan UI appears |
| 8 | Complete floor scan (or Skip) | Model picker / auto-place for single model |
| 9 | Place model on floor | Model locks; dimensions toggle works |
| 10 | Tap **Exit AR** | Returns to Start AR landing (same URL) |
| 11 | Tap **Back to catalog** | Opens configured exit URL (per-model → workspace default → tenant home) |
| 12 | Admin → usage | Session count incremented after qualified session (≥1 placement) |

**Evidence to capture:** screenshot of placement, `Download session log (JSON)`, admin usage panel.

---

## QA-4 — E2E: iOS Quick Look from tenant catalog

**Automated (Playwright iPhone emulation):**

- [x] Direct landing shows **View in AR** (not WebXR-only Start AR)
- [x] Copy mentions Quick Look / Safari path

**Manual — required for MVP sign-off (physical iPhone):**

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Open tenant home `/w/{slug}` on **Safari iOS** | Quick Look CTA visible |
| 2 | Tap **View in AR** (or open direct model link) | Safari Quick Look sheet opens |
| 3 | USDZ loads | No 404; model preview visible |
| 4 | Place in room (Apple UI) | Model anchors in room view |
| 5 | Return to Safari | App state sane; can re-open link |

**Note:** USDZ is generated client-side on upload; confirm USDZ ready in admin before testing.

---

## API verification checklist (ENG-17 / ENG-13)

| Endpoint | Method | Auth | Expected |
|----------|--------|------|----------|
| `/health` | GET | None | `200 { ok: true, service: "atlas-api" }` |
| `/v2/workspaces/{slug}/public-config` | GET | None | `200` branding + slug |
| `/v2/workspaces/{slug}/catalog` | GET | None | `200` models array |
| `/v2/workspaces/{slug}/analytics/events` | POST | None | `202` after session_end + placement |
| `/v2/workspaces/{id}/usage` | GET | JWT admin | `200` plan, limits, usage, warnings |
| `/v2/workspaces/{id}/models/manifest` | GET | JWT admin | `200` admin manifest |

Run: `npm run test:sprint3-api` (set slug/token env vars for full coverage).

---

## Sprint 3 exit criteria

| ID | Criterion | Status |
|----|-----------|--------|
| QA-3a | Automated web flow green | ✅ `npm run test:sprint3-e2e` — 17 passed (2026-05-21) |
| QA-3b | Android physical AR placement | ✅ Signed — [SPRINT3-CLOSEOUT.md](./SPRINT3-CLOSEOUT.md) |
| QA-4a | iOS UI shows Quick Look path | ✅ Playwright iPhone 13 (2026-05-21) |
| QA-4b | iOS physical Quick Look | ✅ Signed — [SPRINT3-CLOSEOUT.md](./SPRINT3-CLOSEOUT.md) |
| ENG-17 | Analytics POST accepted + sessions counted | 🔄 API smoke + manual usage check |
| ENG-19 | Cognito env on Amplify branches | 🔄 [AMPLIFY-ENV-CHECKLIST.md](./AMPLIFY-ENV-CHECKLIST.md) + `npm run verify:amplify-env` |

When ENG-19 (main) passes, **Phase 1 Sprint 3 is complete**. QA-3b/4b signed; Phase 2 MKT-1/MKT-2 landing shipped.
