# Atlas AR — Project Memory (READ BEFORE EVERY TASK)

**Path:** `D:\AI\atlas-webxr\Edit_logs\Memory\ATLAS-AR-PROJECT-MEMORY.md`  
**Rule:** Before implementing or diagnosing any Atlas AR task, read this file + the relevant domain memory below. Update this file after each completed task so mistakes are not repeated.

Last updated: 2026-07-31 (SEO-2 Batch 2b OG JPEG harden)

---

## Product snapshot

| Item | Value |
|------|--------|
| Product | **Atlas AR** (SaaS) — multi-tenant AR catalog → Android WebXR + iOS Quick Look |
| **Dev / implement (Cursor)** | `D:\AI\agency-agents\atlas-webxr` — stay on **`main`**; do **not** create feature branches for deploy |
| **Git push (GitHub → Amplify)** | `D:\AI\atlas-webxr\atlas-webxr` — copy changed files here → commit → `git push origin main` |
| GitHub remote | `https://github.com/Coin1-ui/atlas-webxr.git` |
| Hosting | AWS Amplify + Lambda + S3 + Cognito |
| Prod | `https://main.d7vfdpujdozkj.amplifyapp.com` |
| Session logs | `D:\AI\atlas-webxr\Edit_logs\Android Logs\` · `...\iOS Logs\` |
| Domain memories | See “Memory index” |

---

## Memory index (always check)

| Domain | File |
|--------|------|
| **This master memory** | `Edit_logs/Memory/ATLAS-AR-PROJECT-MEMORY.md` |
| 3D viewer / PBR / chrome wire | `Edit_logs/Memory/3D-VIEWER-PBR-MEMORY.md` |
| Android log index | `Edit_logs/Android Logs/README-MEMORY.md` |
| iOS log index | `Edit_logs/iOS Logs/README-MEMORY.md` |
| Repo pointer | `atlas-webxr/docs/3D-VIEWER-MEMORY-POINTER.md` |
| Decisions / PRD | `atlas-webxr/docs/atlas-ar/DECISIONS.md`, `PRD-v1.md` |

---

## Hard product rules (do not regress)

1. **iOS v1 = Quick Look only** (USDZ) — not full WebXR placement.
2. **Android = WebXR** immersive-AR + optional 3D object preview.
3. **3D preview:** model must appear **immediately**; chrome wire metallic; leather/fabric **not** plastic.
4. **Marketing CTAs:** prefer **free trial** language on pricing (not “demo” as primary Growth CTA on mobile).
5. **Sales training:** do **not** lead with / highlight “AR technology” — outcome-first copy only.
6. **Sales deck must work on Amplify** — no CDN imports blocked by CSP (`script-src 'self'` only for scripts).
7. **Never `setEnabled(false)` on AssetContainer templates** — clones inherit disabled → blank 3D viewer.
8. **Never block 3D instantiate on HDR decode** — fallback IBL first, HDR in background.
9. Prefer Vite-bundled `/assets/neutral-*.hdr` over blob URLs during WebXR.
10. Do not invent Stripe/billing automation unless asked — manual billing MVP.
11. **Upload limits:** max **50 MB** per GLB/USDZ/icon on **all** plans. Workspace storage = **models × 50 MB × 2.5** (GLB + USDZ headroom). Client must preflight with warning on oversized files; upload pages show the size note. **Prefer GLBs under ~33 MB** when relying on auto-USDZ (warning + note in `upload-size-limits.ts`).
12. **AR sessions:** **100 per model / month** on Starter, Launch, Growth (workspace caps 500 / 3,000 / 10,000). **Scale = unlimited** (`sessionsPerMonth: 0` — no cap warnings).
13. **Public pricing page:** show **calculated storage totals only** (625 MB / 3.7 GB / 12.2 GB) — **do not** expose the `(50 MB max GLB × 2.5)` formula on `/pricing`. Engineering docs (PRICING.md) may keep the formula.
14. **Deploy hygiene:** never push `main` with merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) — Amplify `npm run build` fails on syntax errors. Merge to `main` on GitHub (not orphan feature branches). Verify with `git grep` + local `npm run build` before push.
15. **Two-repo workflow:** implement in `agency-agents\atlas-webxr`; **copy** changed files to `atlas-webxr\atlas-webxr`; commit and push **only** from the push repo. Never rely on GitHub Desktop feature branches — Amplify builds **`main`** only.
16. **Upload size note** must appear on **tenant Manage models** (`admin-models.ts`), not only owner demo upload (`model-manager-pc.ts`).
17. **Admin UI chrome** keeps Atlas teal (`--tenant-accent-default`) — tenant primary color applies on customer `/w/{slug}` only (do not let branding recolor admin/account buttons).
18. **Branding logo:** users upload an image file on `/admin/branding` → S3 via `POST /v2/workspaces/{id}/branding/logo` (presign → PUT → complete). Optional Logo URL remains as fallback.
19. **Tenant Preview AR:** never open the live-demo / another workspace catalog when the tenant has **0 models** — gate Preview AR → Manage models. Clear `globalDemoLanding` on `/w/{slug}` routes.
20. **Sales deck Starter copy:** sessions are **100 / model / month** (not a flat “100 sessions”). Slide 8: `5 models · 100 sessions / model`.

---

## Repo workflow (copy → push)

```
1. Implement + test in  D:\AI\agency-agents\atlas-webxr
2. Copy changed files   →  D:\AI\atlas-webxr\atlas-webxr  (same relative paths)
3. In push repo:
     cd D:\AI\atlas-webxr\atlas-webxr
     git pull origin main
     git status / git diff
     npm run build
     git add … && git commit -m "…"
     git push origin main
4. Confirm Amplify build green on main
```

**Do not:** push from `agency-agents\atlas-webxr` unless remotes are intentionally unified.  
**Do not:** create `cursor/*` or other feature branches for production deploys.  
**Removed (2026-07-17):** `cursor/align-upload-storage-limits` (local only; was never on remote).

## Mistakes already made (do not repeat)

| Mistake | Symptom | Correct approach |
|---------|---------|------------------|
| Await HDR before model | Spinner ~10s / “model never loaded” | Parallel: show model on fallback IBL |
| Bind HDR then clear fallback on failure | Invisible / no env | Keep fallback until HDR ready |
| Prefer blob: HDR URL | `previewHdrError: "0 "` | Bundled asset URL first |
| `setEnabled(false)` on templates | `previewMeshCount: 2` but blank | Visibility-only hide + enable instances |
| Same MR boost for all mats | Leather looks plastic | Chrome vs dielectric recipes |
| USDZ multi-material / roughness≠1 | iOS missing PBR | Bake MR factors + split meshes |
| `getChildMeshes(true)` | Missed wire+top mats | Use `false` (descendants) |
| Sales deck Three.js from jsDelivr | Blank deck on Amplify CSP | Vendor Three under `/sales-deck/` |
| Sales deck only vendored `three.module.js` | Toolbar shows, slides empty — module fails on missing `./three.core.js` (r183 split) | Vendor **both** `three.module.js` + `three.core.js`; sync in `sync-sales-deck-config.mjs`; dynamic-import WebGL so slides still render |
| Mobile pricing Growth CTA → demo | User wants free trial | Use trial CTA; demo secondary if needed |
| Merge conflict markers on `main` | Amplify build fails (esbuild parse error) | Resolve conflicts; `git grep '<<<<<<<'`; build locally; push clean `main` (repair commit `a2f985d`) |
| Pricing page shows storage formula | User wants simple tier copy | Totals only on `/pricing`; formula stays in docs/admin upload note |
| GitHub Desktop creates branch instead of merging | Changes never reach Amplify `main` | Copy to push repo; commit on `main`; push `origin/main`; confirm Amplify branch = `main` |
| Feature branch `cursor/align-upload-storage-limits` | Divergent deploy path; Amplify never sees changes | **Removed.** Work on `main` in dev repo; copy → push repo → `main` |
| Preview AR with 0 models → demo catalog | Trial user sees another account’s models | Gate Preview AR; `openTenantShowroom` clears demo context; empty tenant AR blocked |
| Sales deck “100 sessions” on Starter | Sounds like 100 total | “100 sessions / model” (500 included at full Starter catalog) |

---

## Major systems map

| Area | Key paths |
|------|-----------|
| SPA entry | `src/main.ts`, `index.html` |
| Marketing | `src/ui/marketing-*.ts`, `/`, `/pricing` |
| Auth / tenants | Cognito, `src/ui/auth-*.ts`, `/w/{slug}` |
| Android AR | `src/xr/android/session.ts`, `webxr-ar.ts` |
| 3D preview | `src/ui/ar-object-viewer.ts`, `ar-pbr-environment.ts` |
| iOS QL | `src/xr/ios/quick-look-open.ts`, `glb-to-usdz.ts` |
| Sales deck | `public/sales-deck/` (+ Amplify redirects) |
| Training SAL-3 | `public/sales-deck/training.*`, `training-slides.js` |
| Backend | `backend/lambda/atlas-api/` |
| Plan / upload limits | `src/shared/plan-limits.ts`, `src/shared/upload-size-limits.ts`, `backend/.../upload-limits.mjs`, `backend/.../plan-limits.mjs` |
| Amplify CSP | `amplify.yml` customHeaders |

---

## 3D / AR status (Bar-Chair)

- Test GLB: `D:\3D_GLB\Bar_chair\Bar_chair_V3.glb`
- Materials: `wire_228184153` (chrome), `top` (leather)
- Android healthy signals: `previewNeutralHdr: true`, `previewMeshesVisible: 2`, load &lt;300ms
- iOS healthy: `convertMaterialCount: 2`, `convertMrMapCount: 2`, `convertError: null`
- Chrome vs dielectric tuning: `tunePbrMaterialForObjectPreview` in `ar-pbr-environment.ts`
- **User confirmed (2026-07-17):** first placement is smooth in under ~15 min

---

## QA expectations

User-reported (2026-07-17) — **code fixed; verify on prod after Amplify green:**

| Issue | Status |
|-------|--------|
| Sales deck blank (CSP + missing `three.core.js`) | Fixed in code — verify `/sales-deck/` after deploy |
| Mobile pricing demo vs free trial | Fixed — `marketing-pricing.ts` |
| Training mentions “technology” | Fixed — `training-slides.js`, `slides.js` |
| Amplify deploy failed (merge conflicts on `main`) | Fixed — `a2f985d` on `origin/main` |

**Still open (see `QA-REPORT-2026-07-17.md`):** `test:gui` layout failures (pre-existing); landing mobile CTA still “Try live demo”.

Run: `npm run test:all`, `npm run test:design-audit`, `npm run test:des4`, `npm run test:batch33`, Bar-Chair `test-bar-chair-v3-pbr.mjs`, and manual/browser checks for sales-deck + pricing + training.

---

## Agent checklist (every task)

1. Read **this** memory file.
2. Read domain memory if task touches 3D/iOS/Android.
3. Copy newest session logs into Edit_logs Android/iOS folders when provided.
4. **Agents Orchestrator mode:** scope → specialist agent(s) → implement → QA gate → backlog log → memory changelog → user confirmation before next batch.
5. Implement minimal fix; do not reintroduce listed mistakes.
6. Build / targeted tests (`npm run build` before any `main` push).
7. Append a changelog row below.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-17 | Master project memory created (full Atlas AR, not only 3D viewer) |
| 2026-07-17 | 3D chrome vs leather dielectric split |
| 2026-07-17 | QA pass: sales deck CSP/Three vendor, pricing free-trial CTA, training copy; report `QA-REPORT-2026-07-17.md` |
| 2026-07-17 | Sales deck blank slides: missing `three.core.js` + optional WebGL boot |
| 2026-07-17 | Upload/storage: 50 MB max file all plans; storage = models × 50 MB × 2.5; upload page note + size warnings |
| 2026-07-17 | Doc/copy sweep: PRICING-RESEARCH, backlog, PRICING-FEATURE-READINESS, wireframes, PRD, admin help, FAQ aligned to new limits |
| 2026-07-17 | AR sessions: 100/model/mo on Starter/Launch/Growth (500/3K/10K caps); Scale unlimited; account/admin UI + docs + tests |
| 2026-07-17 | Auto-USDZ ~33 MB guidance in upload warning + `uploadSizeNoteHtml()` |
| 2026-07-17 | Pricing page: storage totals only (no 2.5× formula on public `/pricing`) |
| 2026-07-17 | Amplify `main` repair: resolved merge conflict markers; pushed `a2f985d`; rules #13–14 + deploy hygiene |
| 2026-07-17 | Two-repo workflow documented; deleted local `cursor/align-upload-storage-limits`; both repos on `main` @ `a2f985d` |
| 2026-07-17 | Manage models: upload size note + preflight warnings (`admin-models.ts`) |
| 2026-07-17 | Admin/account button colors locked to Atlas teal (tenant accent only on customer showroom) |
| 2026-07-17 | Branding: direct logo file upload → S3 (`uploadWorkspaceLogo` + Lambda route) |
| 2026-07-17 | User confirmed first AR placement smooth (~15 min) |
| 2026-07-17 | Sales deck slide 8: Starter “100 sessions / model”; Preview AR gated when catalog empty (no demo leak) |
| 2026-07-17 | Amplify app recreated `d136z8ddo8kiye`; env restored; `verify:amplify-env` 4/4 ✅ |
| 2026-07-17 | **Sign-in broken:** Cognito OK from browser; API `Failed to fetch` — **CORS headers absent** (API GW still allowlists old origin `d3t9wmef56h86w`). Fix: API Gateway CORS + Lambda `ATLAS_CORS_ORIGIN` → `https://main.d136z8ddo8kiye.amplifyapp.com` |
| 2026-07-18 | Production moved to `https://main.d7vfdpujdozkj.amplifyapp.com`; user confirmed sign-in is good; active deploy scripts/docs updated. Historical log URLs retained as evidence. |
| 2026-07-18 | Sales deck CSP: self-hosted DM Sans + Instrument Serif under `/sales-deck/fonts`; removed Google Fonts from deck/training/outreach; design audit 74/74. |
| 2026-07-18 | Billing foundation: Dodo international + Zoho India decision; added provider-neutral event validation, monotonic ordering, global subscription binding, transactional `atlas-billing` ledger/workspace projection, time-bounded entitlements, explicit manual grants, and fail-closed retired direct upgrades. Checkout/webhooks remain disabled pending server-owned mapping and signed sandbox adapters. |
| 2026-07-18 | Billing adapters: added idempotent routed checkout, Dodo hosted checkout + signed webhook reconciliation, Zoho India hosted checkout/OAuth client, server-owned provider mappings, isolated reconciliation locks, strict URL/input/CORS controls, and independent rollout flags. All flags remain disabled; tests/build/package and independent security/provider reviews passed. |
| 2026-07-19 | Billing lifecycle expanded with provider portal/plan/cancel actions, signed Zoho Payments reconciliation, manual idempotent refunds, Zoho Books retry/dead-letter accounting jobs, checkout UI, fixed USD/INR routing policy, and environment validation. Recovered Dodo evidence proves a successful $5 test charge and active Starter subscription; release remains blocked because the Dodo product shows a yearly subscription period with monthly payment frequency, and webhook 2xx plus Atlas billing-status evidence are not yet recorded. |
| 2026-07-19 | Billing security remediation passed independent re-review: fail-closed entitlement expiry, transactional checkout leases, Dodo provider idempotency, guarded refund reservations, Zoho ambiguity reconciliation, Zoho Books unique-field upserts, expiring worker claims, acknowledged SQS dead-letter delivery, strict deployment validation, and provider contract tests. Build/tests/package pass; only external sandbox/deployment evidence remains. |
| 2026-07-19 | User corrected Dodo Starter to payment frequency 1 Month / subscription period 1 Month and uploaded the hardened Lambda. API Gateway deployment verified: portal/plan/cancel/refund/status routes reject anonymous calls with 401, Dodo rejects unsigned webhook with 400, and disabled Zoho webhook fails closed with 503. A fresh Dodo checkout is still required because product edits do not retroactively change the earlier annual-period test subscription. |
| 2026-07-19 | Diagnosed “checkout created separate account”: PowerShell explicitly created the disposable Billing Sandbox via `POST /v2/workspaces`; checkout did not create an Atlas account. Found deployment-repo frontend drift: it still called retired `/billing/upgrade`. Wired hosted checkout/portal/plan/cancel into deploy repo, build passed, and pushed `ab71a0c` to `main` for Amplify. |
| 2026-07-19 | Dodo test cleanup complete: both obsolete subscriptions were cancelled immediately. The first retains historical Year/Month configuration; the second proves corrected Month/Month. Both share customer `cus_0NjUvFmQSrwEVxMsaLu15`, confirming checkout did not create a second Dodo customer account. |
| 2026-07-19 | Fresh Dodo checkout verified end to end for workspace `1ee2cb65-6252-4679-ab53-84ea36b2518f`: USD 5 payment `pay_0NjVduFke9QpJiCmQvgYQ`, Month/Month Starter subscription `sub_0NjVduFvyLgtljNZmXMoU`, signed webhook replay with no Lambda errors, authenticated Atlas status `active`, entitlement `starter`, and period end `2026-08-19T08:12:37.451Z`. Remediations made during evidence capture: recover matching checkout leases, scope reused provider customers per workspace, process `payment.succeeded`, canonicalize Dodo microsecond timestamps, and raise Lambda to 256 MB / 15 seconds. Duplicate replay preserved state. Rotate the exposed Dodo test API key and update Lambda before further provider testing. |
| 2026-07-19 | Owner refund UI added (`platformRefundPayment` + `/owner` Issue refund). Commit `dbd3111` created in push repo; Cursor dropped before push completed. |
| 2026-07-20 | BILL-1 account UX bugs fixed: (1) cancel-at-period-end optimistic projection + account merges `/billing/status`; (2) Growth upgrade visible during Growth trial via `subscribedBillingTier`; (3) plan changes always `next_billing_date` (no immediate upgrade charge); (4) billing country required with no US default for checkout/plan/portal. Lambda ZIP rebuilt. Memory + backlog updated. **Next:** push Amplify `main` (refund commit + UX fix), upload Lambda ZIP, sandbox re-test. |
| 2026-07-20 | Sandbox verification checklist run (`npm run qa:billing-sandbox`). GitHub `main`=`d109b05`. Amplify live bundle `main-BOJuRz6l.js` contains all BILL-1 UI markers (country required, no US default, next-billing copy, cancel hint, Issue refund). Anonymous API gates PASS (401/400). Growth-trial upgrade options unit PASS. Auth/Lambda country-gate and mutating cancel/upgrade **SKIP** — need `ATLAS_TEST_ID_TOKEN` + confirm Lambda ZIP uploaded. Evidence: `docs/atlas-ar/BILLING-SANDBOX-VERIFY-2026-07-20.md`. |
| 2026-07-20 | Authenticated sandbox re-run with owner JWT (token not stored). **PASS 22 / FAIL 0 / SKIP 3.** Workspace `1ee2cb65-…`: Growth trial through `2026-08-02`, entitlement **launch**, `cancelAtPeriodEnd=true`, period end `2026-08-19`. Lambda country gate live: plan/portal without country → `400 billingCountry`. Same-tier plan with country → `200 pending:false`. Mutating upgrade/cancel skipped (already cancelled at period end). Manual Amplify Account UI still recommended for Growth card visibility. |
| 2026-07-20 | Sandbox period-end without waiting until Aug 19: use Dodo test-mode `PATCH /subscriptions/{id}` with `next_billing_date` set **2–5 minutes in the future** (UTC `Z`; past dates rejected). Documented in `BILLING-SANDBOX-SETUP.md` §9. Current sub already cancel-at-period-end → advancing date proves cancel/expiry path; for renewal/upgrade-at-renewal use a fresh sub or clear cancel flag first. |
| 2026-07-20 | Dodo webhook failures in CloudWatch: Lambda `atlas-api` reports **Memory Size: 128 MB** with Max Memory Used **114–124 MB** (regression from prior 256 MB / 15s fix). Near-OOM / prior timeouts explain failed webhook deliveries. Remediation: set Memory **256 MB**, Timeout **15 seconds**, then replay failed Dodo events. |
| 2026-07-20 | User confirmed Lambda restored: **256 MB / 15 s** (`atlas-api`, ap-south-1). Post-fix CloudWatch shows Max Memory Used ~126 MB (healthy headroom). Next: replay failed Dodo webhooks → verify Atlas `/billing/status` sync. |
| 2026-07-20 | Dodo webhook **replay** after Lambda fix: some deliveries log `Transaction cancelled … ConditionalCheckFailed`. Expected when replay uses a **new webhook-id** for an event already reflected in subscription projection, or when multiple replays run concurrently. Dodo may show delivery failed (HTTP 500) even though Atlas state is already current. Fix for sandbox: replay **one** newest failed event at a time, or verify `/billing/status` before re-replaying. |
| 2026-07-20 | **BILL-1 sandbox checklist PASSED (authenticated):** `npm run qa:billing-sandbox` → **22 PASS / 0 FAIL / 3 SKIP**. Workspace `1ee2cb65-…`: entitlement **launch**, status **active**, `cancelAtPeriodEnd=true`, tier **launch**. Amplify UI markers + Lambda country gate + policy units all green. Mutating cancel/upgrade skipped by design. |
| 2026-07-29 | **Get started incomplete across browsers — root cause & fix.** Onboarding (upload/share/preview/dismiss) lived only in browser `localStorage`, so a second browser looked incomplete. Fix: persist `onboarding` on workspace META (`tenant-types.mjs`, `dynamodb.mjs` normalize/merge, `v2-workspace-settings.mjs` PATCH); FE hydrates server ∪ local on admin entry, persists on mark/dismiss (`onboarding-progress.ts` + `setOnboardingServerPersist` in `main.ts`), skips forced `/admin/get-started` when `modelCount>0`, banner until dismiss/complete. Tests: `npm run test:onboarding-cross-browser`. |
| 2026-07-29 | **Deploy gap caught:** first attempt updated Lambda but the FE files were never copied to the push repo, so prod bundle still had localStorage-only code (user still saw incomplete). Copied FE files, pushed `7fe9707`; added localStorage→server **backfill** in `hydrateOnboardingFromWorkspace` (one-shot PATCH via `serverOnboardingEquals` guard). |
| 2026-07-29 | **Get started stuck at 33%:** share/preview were only credited inside the wizard, never from real dashboard actions. Credited `preview` on dashboard Preview AR (`main.ts onOpenAr`), `share` on model-manager Copy link (`admin-models.ts`, `model-manager-pc.ts`), and added a one-click **Copy link** button to the dashboard Customer AR link block that credits `share` (`admin-dashboard.ts` + `onCopyShareLink` in `main.ts`). Commits `d7b318c`, `179f6d4`. |
| 2026-07-29 | **Design sandbox rebuild (approval gate).** Wiped old cinematic/MotionLab mocks in `atlas-sandbox/`. Rebuilt 19 pages with UI UX Pro Max skill (**Spatial UI / VisionOS**). Harness: PC/Tablet/Mobile frames + Atlas/VisionOS theme toggle + iOS/Android AR OS toggle. iOS bug previewed via `arCopy(platform)` (showroom/get-started/help/AR session/device test). Delete account moved to Account → Danger zone (type slug). **Production untouched** until design approval. Preview: `npm run dev -- --host 127.0.0.1 --port 5174`. |
| 2026-07-29 | **Sandbox review 1 — theme approved.** User signed off **Atlas (teal + dark navy)**. Deleted the `[data-theme="visionos"]` token block and the toolbar theme switch; viewport is hard-set to `data-theme="atlas"` and the toolbar shows a lock chip (`.sb-theme-lock`). |
| 2026-07-29 | **AR session excluded from the refresh** (user: "keep as it is in production"). Audited production first — Android composites a `dom-overlay` glass dock (scan dock → picker with floor pill / AR-3D segment / model tiles / `Dimensions`·`JSON`·`Exit`) and the cyan-red reticle is a **Babylon mesh, not DOM**; on iOS `tryStartWebXR` returns null so Atlas renders **no** camera UI — it shows its own `View in AR` page then hands off to native Quick Look. Sandbox had invented a top bar + model chip + X, a "Surface preview" Cyan/Red toggle, Place/Reset/Exit AR buttons, and a fake Apple toolbar; all removed. `ArSession.tsx` rewritten to production strings/classes; production CSS isolated in new `.arprod`-scoped `src/styles/ar-production.css` so it cannot leak into redesign pages. A dashed "Sandbox inspector" strip steps through Starting/Scanning/Ready/Blocked. |
| 2026-07-29 | **Animated landing hero.** Source `docs/atlas-ar/assets/Images for BG scroll/Home_images/Output/Home_page_PS.gif` is 1280×720 / 15 s / **85 MB** — unusable as a background. Transcoded via `ffmpeg-static` (installed then uninstalled; commands recorded in sandbox README) to `public/media/`: `home-hero.mp4` **3.4 MB**, `home-hero-480.mp4` **1.1 MB** (phone), `home-hero-poster.jpg` **124 KB**. **WebM/VP9 rejected — 19 MB on this grainy particle footage, worse than H.264.** New `HeroVideo.tsx`: muted + `playsInline`, `IntersectionObserver` off-screen pause, `visibilitychange` pause, no playback under `prefers-reduced-motion` (poster fallback), user **Pause motion** control. Retired the static `hero-ar-phone.png` from the hero — same phone-in-a-room subject, competed with the clip; the platform-correct caption moved into a new glass "What your customer sees" card so the iOS-vs-Android demo survives. |
| 2026-07-29 | **Hero contrast measured, not estimated.** A flat scrim heavy enough for the headline buried the clip, so darkness is pooled behind the copy (radial) over a lighter directional wash. Verified by sampling the composited hero at the clip's **brightest** frame (t≈2.0 s) with the copy hidden, worst-cell per region: badge 8.08:1, h1 12.77:1, lede 6.10:1, stat value 12.75:1, **stat label 5.94:1 (tightest)**, motion toggle 12.85:1 — all clear WCAG AA. Phone keeps a flat 0.82→0.90 scrim because the small muted labels fail below that. |
| 2026-07-30 | **Production UI refresh port** (user: implement sandbox design; AR session unchanged). Additive layer `src/styles/refresh/` imported after `style.css` — never edits AR rules. Batches: marketing (cinema hero via `hero-video.ts` + `public/marketing/home-hero*.mp4`), auth, admin (no sandbox sidebar), account Danger zone, owner, showroom iOS branch, device-test. `npm run guard:ar` + `tsc` + `build` + design-audit **75/75**. |
| 2026-07-30 | **main.ts wiring closed:** Account `onDeleteAccount`/`canDeleteAccount`; showroom `{ usageWarning, iosSafariAr: isIOS() }`; unused `isIosSafari` import removed. Delete already gone from onboard/dashboard call sites. |
| 2026-07-30 | **Amplify CSP fonts fix.** `amplify.yml` has `font-src 'self'` / `style-src 'self'` — Google Fonts blocked on every deploy. Removed Google Fonts from `index.html`. Inter via `@fontsource/inter` (Vite emits woff2 under `/assets`). DM Sans `@font-face` reuses `/sales-deck/fonts/*.woff2`. Verified `document.fonts.check('600 16px Inter')===true` and no `fonts.googleapis` link on built preview. **Amplify push still pending** (copy → push repo → `main`). |
| 2026-07-30 | **Amplify deploy:** copied UI refresh into push repo `D:\AI\atlas-webxr\atlas-webxr`, `npm run build` + `guard:ar` (baseline saved for push-repo `style.css`), committed `67e05df` on `main`, pushed `origin/main`. Prod URL `https://main.d7vfdpujdozkj.amplifyapp.com`. Live bundle **`main-D0WE6NMo.js`** — markers: home-hero, Pause motion, Inter, Danger zone, Safari AR all present. |
| 2026-07-30 | **False “overage” on plan upgrade (omnimanual / Testing ops).** Live `/billing/status`: `inOverage=false`, `usageHybrid=true`, `planChangeMode=remount_checkout`; usage 2 models / 0 sessions / ~3 MB — under Starter limits. Remount is required because all Atlas Dodo SKUs are usage-hybrid (change-plan 500s). Bug: `planChangeRemountConfirmMessage` / checkout success always said “You are in overage”. Fixed in FE to reason-aware copy (`overage` \| `hybrid` \| `meter_sync`). Account page hint was already correct; confirm dialog was not. **Amplify copy/push still needed for live.** Do not store customer JWTs. |
| 2026-07-30 | **SEO Phase 1 (www.atlasar.in).** Track = SPA head-only (no prerender). `src/shared/seo.ts` + `applyRouteMeta` in `routeApp`; `public/robots.txt` + `sitemap.xml` (6 URLs); absolute OG/Twitter in `index.html`; noindex on sales-deck/storyboard HTML; Amplify 301s for marketing trailing slashes. Canonical host `https://www.atlasar.in`. Ops: [SEO-OPS-CHECKLIST.md](../../docs/atlas-ar/SEO-OPS-CHECKLIST.md). Phase 2 = prerender + content hub (backlog SEO-2). Pushed Amplify `14932b4`. |
| 2026-07-30 | **Amplify Console redirects overrode yml.** Live Hosting only had apex→www + `/<*>` `404-200` — SEO slash strips / sales-deck missing. Amplify then 301 `/pricing`→`/pricing/` with **404** SPA body. Fix: full JSON in `docs/atlas-ar/AMPLIFY-REDIRECTS.json` + SPA **200** regex rewrite (not 404-200); `amplify.yml` synced; push `d6a6a06`. **User must paste JSON in Console and Save** (Console is source of truth). |
| 2026-07-30 | **Live re-verify after Console Save:** PASS — apex HTTPS now **301**→www; `/pricing` `/about` `/legal/*` **200** no slash; slash variants **301** strip; robots+sitemap 200 (6 locs); home OG/canonical absolute; sales-deck/storyboard noindex. SPA shell still ships home canonical until JS `applyRouteMeta` (Phase 1 expected). |
| 2026-07-30 | **False meter-mismatch banner (aryan Growth `1ee2cb65-…`).** Not usage overage (`inOverage=false`). `meterSync` failed on storage meter only: catalog free `13107200000` vs Dodo sub `222298112` (= `13107200000 >>> 0`). Prior Launch int32 wrap (`-362807296`) was handled; Growth multi-wrap positive residue was not. Fix `freeThresholdsMatch` + unit test. Warning text sounds like overage but is BILL-METER-SYNC. Remount/checkout NOT needed for this false positive. Source pushed `f349623`; ZIP rebuilt `backend/lambda/atlas-api-deploy.zip` (4.67 MB, fix verified inside). **Manual step: upload ZIP to Lambda `atlas-api` (ap-south-1) to clear the banner.** Do not store JWTs. |
| 2026-07-31 | **Launch JWT meterSync probe OK** (`aryan.barua007` / CT202 Sofa) — not the Growth banner account. Growth gate still needs Lambda ZIP upload + Growth JWT (`aryan.barua57`). Doc: `docs/atlas-ar/LAMBDA-METER-BANNER-CHECK.md`. |
| 2026-07-31 | **MKT-3b + SAL-4 batch.** Checklist `MKT-3b-PRODUCTION-CHECKLIST.md` (drop `public/marketing/demo-a1-android.mp4` / `demo-b1-ios.mp4`). Landing `#product-demo` + `demo-video.ts` empty-state; sales-deck slide 4 “Watch product demo”. SAL-4 runbook + Owner **Design partners** tab (3 slots + checklist) on platform settings `designPartners`. Do not replace `home-hero*.mp4`. Amplify push for FE; Lambda redeploy for designPartners PATCH. Mp4s still founder-recorded. |
| 2026-07-31 | **Lambda ZIP uploaded** — `/health` ok. Doc `LAMBDA-UPLOAD-CHECK-2026-07-31.md`. Sandbox Dodo ingest still true in health — set false after seeds. |
| 2026-07-31 | **QA-5 PASS** · Batch 35 closed. First placement ≤15 min on prod (user 2026-07-17). |
| 2026-07-31 | **MVP P0 confirm:** no open MVP P0 ship blockers; BILL-1 remains on_hold (scale). |
| 2026-07-31 | **MKT-7 done** — analytics copy aligned: Launch/Starter = usage dashboard; Growth = JSON session log default on (ENG-37); no per-model funnel claims. Pricing page, landing, sales deck, PRICING.md, readiness updated. |
| 2026-07-31 | **GSC HTML verify file live.** `public/google6baa8a3d0d627b22.html` → `https://www.atlasar.in/google6baa8a3d0d627b22.html` (200, exact `google-site-verification:` body). Amplify `cf78e70`. **User:** click Verify in Search Console, then submit `sitemap.xml`. Bing still open. |
| 2026-07-31 | **GSC ownership Verified** (HTML file). Next: submit sitemap + Request indexing for `/`, `/pricing`, `/about`. |
| 2026-07-31 | **GSC sitemap Success** — `https://www.atlasar.in/sitemap.xml`. Phase 1 GSC ownership + sitemap closed. Checklist DNS/post-deploy ticks aligned to live PASS. **Still open:** Request indexing (if not done) · Bing Webmaster · SEO-2. |
| 2026-07-31 | **GSC Request indexing done** for `/`, `/pricing`, `/about`. Phase 1 Google search-ops complete. **Still open:** Bing Webmaster · SEO-2. |
| 2026-07-31 | **Bing Webmaster sitemap Success** (user). Live probe: `sitemap.xml` 200 / 6 `<loc>` · robots Sitemap line OK. **Phase 1 search-ops complete** (GSC + Bing). SEO-2 still later. |
| 2026-07-31 | **SEO-2 Batch 1:** prerender shells for 6 indexable URLs (`scripts/prerender-seo-shells.ts` after Vite). Richer pricing Offer + `UnitPriceSpecification`. Amplify redirects add `/pricing`→`/pricing/index.html` 200 (etc.) before SPA — **user must re-paste AMPLIFY-REDIRECTS.json in Console**. Hub / host-split / per-page OG deferred. |
| 2026-07-31 | **SEO-2 Batch 1 live PASS** after Console redirect paste: `/pricing` `/about` `/legal/*` shells with route meta + JSON-LD; `/pricing/` 301→`/pricing`. |
| 2026-07-31 | **SEO-2 Batch 2:** per-route `ogImage` in `seo.ts` (home phone · pricing steps · about field · legal workspace). SPA + prerender. Hub / host-split still open. |
| 2026-07-31 | **SEO-2 Batch 2b OG harden:** Live HTML already had correct Batch 2 `og:image` (not a rewrite miss). User “not showing” = OG is meta-only / scraper cache / ~2 MB PNGs. Added `public/marketing/og-{home,pricing,about,legal}.jpg` @ 1200×630 (~60–90 KB) + `og:image:width/height/alt`. Refresh FB/LinkedIn debugger after deploy. |
| 2026-07-31 | **SEO-2 Batch 3 — Content hub.** `/learn` index + 3 guides (`browser-ar-product-demo`, `glb-usdz-workflow`, `atlas-ar-for-teams`). Amplify `834e2ba`. |
| 2026-07-31 | **SEO-2 Batch 3 live PASS.** Console redirects confirmed: `/learn` 200 Learn title/canonical (not home); `/learn/` 301→`/learn`; article shell + Article JSON-LD; sitemap 10 locs. Host split still deferred. **User:** GSC Request indexing for `/learn` + 3 articles. |
| 2026-07-31 | **SEO-2 Batch 3 re-verified PASS.** Independent probe: `/learn` 200 · `/learn/` 301→`/learn` · three article shells + Article JSON-LD · sitemap 10 `/learn*` locs. Docs unchanged except this note. **Still user:** GSC Request indexing for `/learn*`. |
| 2026-07-31 | **SEO-2 Batch 3 GSC Request indexing done** for `/learn` + 3 articles (user confirm). Batch 3 search-ops closed; host-split still deferred. |
| 2026-07-31 | **Lead research batch (US/EU/peer).** Outbound Strategist + Sales Outreach + Account Strategist. Deliverable: `docs/atlas-ar/LEAD-SHEET-2026-07-31.md` — 8 Tier-1 design-partner candidates + 20 Tier-2; First 5: Snug, Cozey, Star Furniture, Furniture Mart USA, OPTO. Public research only. **Stop for founder:** pick 3 DP targets + SAL-2 outreach. |
