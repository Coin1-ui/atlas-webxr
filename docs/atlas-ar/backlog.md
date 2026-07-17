# Atlas AR — Product backlog

**Last updated:** 2026-07-06 (Batch 36 design audit · QA-5 on hold)
**Sprint cadence:** 2-week sprints  
**Phase 0:** Complete → **Phase 1:** COMPLETE ✅ (QA-3b/4b signed · ENG-19 verified 4/4 · DES-1/DES-2 shipped) → **Post-28: DEPLOYED + verified live** (prod FE bundle hash matches Post-28 build; Lambda returns `promo` field; platform routes healthy — authenticated coupon→banner / suspension E2E pending owner token) → **Phase 2:** ENG-23–31 + MF-1 MiroFish conversion (2026-06-18)

**Orchestration (NEXUS-Sprint):** Agents Orchestrator → PM backlog → Frontend/DevOps implement → Evidence Collector / `npm run test:sprint3` QA gate → backlog update → **user confirmation** before next batch. See [strategy/QUICKSTART.md](../../strategy/QUICKSTART.md) (NEXUS-Sprint mode).

**Latest orchestration batch (2026-07-06):** Batch 36b–e — **DES-3–11 design audit fixes** ✅ · model icon slug fix · mobile admin hub · `npm run test:design-audit`

**Previous batch (2026-07-06):** Batch 36 — Graphics / UI / UX design audit ✅

**Previous batch (2026-07-05):** Batch 33 — Limits, plan gates & copy truth · **DEPLOYED** ✅ (pricing storage live on prod).

**Previous batch (2026-07-05):** Batch 32 — coupon offer-type form · **deployed** ✅ (Post-AUD-2 Amplify bundle).

**Previous batch (2026-07-04):** Post-28 — trial suspension + per-tier Subscribe/Upgrade matrix + owner coupon → pricing banner promo · **DEPLOYED + verified live** ✅ (prod bundle `main-BB60yeu-.js` matches build; Lambda `public-settings.promo` live; `check:platform-api` ownerDashboardReady=true; `check:owner-ui-deploy` all Post-28 markers present). See [POST-28-DEPLOY.md](./POST-28-DEPLOY.md). Phase 1 closed: ENG-19 ✅, DES-1 ✅, DES-2 ✅.

**Previous batch (2026-05-21):** Batch 28 — LEG-1 signup trust + ENG-36 auto Growth trial · **confirmed** ✅

**Previous batch:** Batch 27 — SAL-2 design partner outreach + interactive module · **confirmed** ✅

**Previous batch:** Batch 25 — SAL-3 presenter script + training · **confirmed** ✅ (design-partner close revision)

**Previous batch:** Batch 26 — MKT-3 demo video + storyboard · shipped (MKT-3 storyboard module)

**Pricing batches (13–21):** Dimension thickness tuning, nav loading, market ladder UI, mobile onboarding — **Batch 21 confirmed**.

---

## Legend

- **P0** = blocker for MVP  
- **P1** = should have for launch  
- **P2** = post-launch  
- Status: `todo` | `in_progress` | `done` | `on_hold`

**Sprint 3 close-out:** [SPRINT3-CLOSEOUT.md](./SPRINT3-CLOSEOUT.md) · [QA-SPRINT3.md](./QA-SPRINT3.md) · [AMPLIFY-ENV-CHECKLIST.md](./AMPLIFY-ENV-CHECKLIST.md) · `npm run test:sprint3`

---

## Phase 0 — Planning ✅

| ID | Task | Owner | Status |
|----|------|-------|--------|
| PM-1 | PRD v1 | PM | done |
| PM-2 | Backlog (this file) | PM | done |
| PROD-1 | ICP doc | Product | done |
| PROD-2 | Hybrid pricing | Product | done |
| ENG-0 | ADR-001 tenant architecture | Architect | done |
| SEC-1 | Threat model baseline | Security | done |
| PE-1 | Agent brief template | Prompt Eng | done |

---

## Phase 1 — Build (Sprints 1–3, ~6 weeks)

### Sprint 1: Identity + tenant foundation ✅

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| ENG-1 | DynamoDB tables: workspaces, members, usage | P0 | Backend | done |
| ENG-2 | Cognito User Pool + app client (dev/staging) | P0 | Backend | done |
| ENG-3 | Lambda JWT authorizer | P0 | Backend | done |
| ENG-4 | `GET /v2/workspaces/{slug}/public-config` | P0 | Backend | done |
| ENG-5 | Migration: default `legacy` workspace + S3 prefix | P0 | Backend | done |
| ENG-6 | Frontend: Amplify Auth sign-up/sign-in pages | P0 | Frontend | done |
| ENG-7 | Workspace creation flow post-login | P0 | Frontend | done |
| QA-1 | Auth smoke tests | P0 | QA | done |

### Sprint 2: Tenant catalog API + admin v1 ✅

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| ENG-8 | API v2: list/upload/delete models (tenant-scoped) | P0 | Backend | done |
| ENG-9 | Presigned upload URLs per tenant prefix | P0 | Backend | done |
| ENG-10 | USDZ generation hook on upload | P0 | Backend | done (client-side USDZ) |
| ENG-11 | Admin dashboard: model list + upload UI | P0 | Frontend | done |
| ENG-12 | Remove/replace `#manage-models` for tenants | P1 | Frontend | done |
| ENG-13 | Usage counters: increment on upload/session | P1 | Backend | done |
| QA-2 | Cross-tenant isolation tests | P0 | QA | done |

### Sprint 3: White-label + AR client integration (QA close-out)

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| ENG-14 | Tenant theme loader (logo, primary color) | P0 | Frontend | done |
| ENG-15 | Slug routing: `/w/{slug}` + direct AR URLs | P0 | Frontend | done |
| ENG-16 | Catalog fetch uses workspace context | P0 | Frontend | done |
| ENG-17 | Session analytics events → API | P1 | Frontend | done (verify on Post-28 deploy) |
| ENG-18 | Admin: branding + exit URL settings | P1 | Frontend | done |
| ENG-19 | Amplify env vars for Cognito (main) | P0 | DevOps | **done** — `verify:amplify-env` 4/4 ✅ (home, API URL, Cognito, /health); single-branch `main` deploy ([checklist](./AMPLIFY-ENV-CHECKLIST.md)) |
| DES-1 | Admin UI wireframes | P1 | Design | **done** ([DES-1-ADMIN-WIREFRAMES.md](./DES-1-ADMIN-WIREFRAMES.md)) |
| DES-2 | Atlas AR brand kit (logo wordmark + PNG exports) | P1 | Design | **done** ([DES-2-BRAND-KIT.md](./DES-2-BRAND-KIT.md) · `assets/logo/` · `npm run generate:brand`) |
| QA-3 | E2E: sign-up → upload → Android AR | P0 | QA | done (QA-3a ✅ auto · QA-3b ✅ signed) |
| QA-4 | E2E: iOS Quick Look from tenant catalog | P0 | QA | done (QA-4a ✅ auto · QA-4b ✅ signed) |

**Sprint 3 extras (shipped):** per-model direct AR links, Back to catalog / Exit AR flow, mobile AR-only UX, SPA redirects, S3 storage in usage API.

---

## Phase 2 — Go-to-market (Sprints 4–5)

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| MKT-1 | Landing page copy + hero | P0 | Marketing | done |
| MKT-2 | Pricing page (from PRICING.md) | P0 | Marketing | done · v2 research [PRICING-RESEARCH.md](./PRICING-RESEARCH.md) |
| ENG-22 | Signed-in pricing nav + manage models UI polish | P1 | Frontend | done |
| ENG-23 | Owner dashboard (`/owner`): demo catalog, plans, coupons, restrictions | P1 | Frontend | done |
| ENG-24 | Signed-in nav: Account & billing vs Admin dashboard; mobile-only `/demo` | P1 | Frontend | done |
| ENG-25 | AR/catalog/branding UI refresh + MiroFish security section (MF-16) | P1 | Frontend | done |
| MKT-4 | Security/privacy copy on landing + `/about` (MiroFish P0) | P0 | Marketing | done |
| ENG-26 | Owner plan tiers aligned with pricing; admin owner link; storage usage fix; operator unlimited usage display | P1 | Frontend | done |
| ENG-27 | Launch tier limits (pricing-aligned); dual local+S3 demo upload; operator self-delete blocked | P1 | Full-stack | done |
| ENG-28 | Owner dashboard: delete customer accounts; platform owner workspace protected (UI + API) | P1 | Full-stack | done (code) · deploy pending |
| ENG-29 | Platform API diagnostics (`check:platform-api`, `check:owner-ui-deploy`, `check:live-owner`) | P1 | DevOps | done |
| ENG-30 | Client-side operator workspace protection fallback (`enrichPlatformWorkspaces`) | P1 | Frontend | done |
| OPS-1 | Lambda redeploy + API Gateway `DELETE /v2/platform/workspaces/{id}` + Amplify redeploy delete UI | P0 | DevOps | done (live verified 2026-06-18) |
| ENG-31 | MF-1 guided 10-min onboarding (`/admin/get-started`) + admin banner + landing upload FAQ / PC→phone diagram | P0 | Frontend | done |
| MKT-5 | MiroFish empty catalog state + ROI strip on landing (MF-4 partial) | P0 | Marketing | done |
| MKT-6 | Product story: browser AR + 3D inspect on landing, onboarding, admin help | P1 | Marketing | done |
| ENG-32 | SUP-1 in-app admin help (`/admin/help`) — upload, share link, iOS/Android, troubleshooting | P0 | Frontend | done |
| ENG-33 | Owner dashboard: per-customer toggles for JSON log, **Start AR**, and **Camera check** (independent; only Start AR blocks AR entry) | P0 | Full-stack | done (code) · Lambda redeploy for `featuresStartAr` / `featuresCameraCheck` |
| ENG-34 | AR session UI: AR/3D slide toggle, dimensions chip, bottom dock chrome | P1 | Frontend | done |
| ENG-35 | AR dock redesign; AR/3D toggle fix (rebind + availability); PC admin SVG diagram icons | P1 | Frontend | done |
| MF-5 | Broken GLB upload validation (glTF header check before USDZ) | P0 | Frontend | done |
| MKT-3 | Demo video script + production storyboard | P1 | Marketing | done ([MKT-3-DEMO-VIDEO-SCRIPT.md](./MKT-3-DEMO-VIDEO-SCRIPT.md) · [mkt-3-storyboard/](../../public/mkt-3-storyboard/)) |
| SAL-1 | Sales deck (10 slides) | P0 | Sales | done ([SALES-DECK.md](./SALES-DECK.md) · [public/sales-deck/](../../public/sales-deck/) · [BATCH-23-CONFIRMED.md](./BATCH-23-CONFIRMED.md)) |
| SAL-2 | Design partner outreach template + interactive module | P1 | Sales | done ([SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md) · [outreach.html](../../public/sales-deck/outreach.html) · [BATCH-27-CONFIRMED.md](./BATCH-27-CONFIRMED.md)) |
| SAL-3 | Sales deck presenter script + training module | P1 | Sales | done ([PRESENTER-SCRIPT.md](./sales-deck/PRESENTER-SCRIPT.md) · [training.html](../../public/sales-deck/training.html) · [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md)) |
| SUP-1 | Admin help docs (upload, share link) | P0 | Support | done (`/admin/help`) |
| SUP-2 | Troubleshooting: AR permissions, HTTPS | P0 | Support | done ([AR-TROUBLESHOOTING.md](./AR-TROUBLESHOOTING.md) + `/admin/help`) |
| LEG-1 | Privacy + Terms draft + signup consent | P1 | Legal | done ([legal/](./legal/) · signup checkbox · [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md)) |
| **ENG-36** | **Auto 14-day Growth trial** on signup (`trialEndsAt`, Growth limits, no card) | **P0** | Full-stack | done · [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md) |
| **ENG-37** | **Plan-gate features:** `sessionLogDownload` on by default for Growth+; tier-driven feature flags | **P0** | Full-stack | **done** (Batch 33) · owner explicit override via `featuresSessionLogDownloadExplicit` |
| **ENG-38** | **Hard-block upload** at model limit (or explicit upgrade gate UX) | P1 | Full-stack | **done** (Batch 33) · API 403 + admin UI gate |
<<<<<<< Updated upstream
| **PM-3** | **Align storage copy:** PRICING.md Starter 2 GB vs `plan-limits.ts` 5 GB | P1 | PM | **done** (Batch 33) · code + pricing page aligned to 2/5/25 GB |
=======
| **PM-3** | **Align storage copy:** PRICING.md vs `plan-limits.ts` | P1 | PM | **done** · code + pricing page aligned to derived storage (models × 50 MB × 2.5): Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB |
>>>>>>> Stashed changes
| **PM-4** | **Admin seat copy vs product:** implement seat limits or remove 2/10 seat claims from PRICING + pricing page | P2 | PM | todo |
| **BILL-3** | **Overage billing via Stripe** (replace localStorage ack in `/account`) | P1 | Backend | **on_hold** · blocked by Batch 29 |
| **BILL-4** | **Annual prepay SKUs** (20% off Launch/Growth) | P2 | Backend | **on_hold** · blocked by Batch 29 |
| **MKT-7** | **Analytics story alignment** — “basic” vs “export” vs owner JSON toggle; per-model analytics deferred | P2 | Marketing | todo |
| **SAL-4** | **Design partner ops runbook** — owner workflow for $59 Growth, coupons, session log, slot tracking | P2 | Sales/Ops | todo |
| **ENG-39** | **Owner dashboard: customer owner emails in Customers table** | P1 | Full-stack | **done** ✅ (Batch 34) |
| **QA-5** | **SAL-3 QA gate on prod:** sign-up → upload → floor placement ≤15 min (Android + iOS) | P1 | QA | **on_hold** · `qa:5-prod` pre-flight 13/0/0 ✅ · device E2E deferred |
| **DES-AUD** | **Graphics / UI / UX design audit** (Batch 36) | P1 | Design | **done** · 14 findings (3 P0, 7 P1, 4 P2) · canvas: `atlas-design-audit` |
| **DES-3** | Design token + button unification (mkt / app / catalog / AR) | P1 | Design | **done** ✅ (Batch 36b) |
| **DES-4** | Accessibility foundation: zoom, focus rings, reduced motion | P0 | Design | **done** ✅ (Batch 36a) |
| **DES-5** | Brand coherence: naming, default accent, catalog fallback | P1 | Design | **done** ✅ (Batch 36c) |
| **DES-6** | AR CTA taxonomy + iOS picker a11y note | P1 | UX | **done** ✅ (Batch 36d) |
| **DES-7** | Mobile admin hub (replace abrupt desktop gate) | P1 | UX | **done** ✅ (Batch 36d) |
| **DES-8** | Owner dashboard visual polish | P2 | UI | **done** ✅ (Batch 36e) |
| **DES-9** | Prune legacy UI/CSS (halo, camera-error, model-manager) | P2 | Frontend | **done** ✅ (Batch 36e) |
| **DES-10** | Pricing page CTA deduplication | P2 | Marketing | **done** ✅ (Batch 36e) |
| **DES-11** | Marketing hero WebP + responsive images | P2 | Performance | **done** ✅ (Batch 36e) |
| **MKT-3b** | **Record + embed demo video** (A1/B1 cuts from storyboard) | P1 | Marketing | todo · script + storyboard done |

---

## SAL-3 & sales orchestration — promised vs built

**Source:** [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md) · [PRESENTER-SCRIPT.md](./sales-deck/PRESENTER-SCRIPT.md) · [SALES-PLAYBOOK.md](./SALES-PLAYBOOK.md) QA handoff · [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md)

SAL-3 **content** is done (deck + training + four-path close). These **product gaps** block fully self-serve delivery of what reps say on calls:

| SAL-3 / deck promise | Rep says (slide / training) | Product today | Backlog |
|----------------------|----------------------------|---------------|---------|
| 14-day Growth trial, no card | Slide 8, CTA slide 10 | Auto on workspace create (Growth limits 14d) | **ENG-36** ✅ |
| Design partner — Growth @ $59, 90 days | Slide 10 path 3 · SAL-2 outreach | Owner dashboard plan + coupon; manual invoice | **SAL-4** · **BILL-1** |
| Founding 10 — Growth @ $59 × 12 mo | Slide 10 path 4 | Same manual ops | **SAL-4** · **BILL-1** |
| Growth “analytics export for sales ops” | Slide 8 · Growth tier | JSON log exists; **owner toggle**, not plan-gated | **ENG-37** |
| Launch “basic session analytics” | Slide 8 · Launch tier | Usage dashboard only (models/sessions/storage) | **MKT-7** (copy) · future ENG |
| “Pay overage” in account | Pricing FAQ | Local ack until Stripe API | **BILL-3** |
| Starter 5 models / session limits | Slide 8 | Warnings only; upload not blocked | **ENG-38** · **BILL-2** |
| Scale tier (SSO, custom domain, multi-workspace) | Slide 8 | Not built | **ENG-20** · **ENG-21** · Phase 3 |
| First placement ≤15 min | SAL-3 intro · MiroFish #1 objection | Works **if guided** on call | **QA-5** verify on prod |
| iOS “View in AR” not “Start AR” | Slide 4 demo · admin help | Ready; staff training required | SUP-2 ✅ · SAL-3 training ✅ |
| IT one-pager / security | Slide 9 | Landing + `/about` ✅ | LEG-1 for signup trust |
| Demo video on landing | Optional SAL-3 follow-up | Script + storyboard only | **MKT-3b** |

**Sales-safe today (no engineering):** Starter $5 narrative · live `/demo` · manual Growth trial · design partner / Founding 10 via owner dashboard · enable JSON log toggle per workspace.

---

## Pricing readiness — not done (audit summary)

Full matrix: [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md)

| Category | Not built / partial | Priority | Backlog ID |
|----------|---------------------|----------|------------|
| Billing | Self-serve checkout (Stripe/Dodo/Razorpay) | P0 for scale | **BILL-1** **on_hold** |
| Billing | Automated 14-day trial | P0 | **ENG-36** ✅ |
| Billing | Overage collection | P1 | **BILL-3** **on_hold** |
| Billing | Annual prepay 20% | P2 | **BILL-4** |
| Enforcement | Hard limits (models/sessions/storage) | P1 | **ENG-38** · **BILL-2** |
| Plan features | Analytics export tied to Growth tier | P0 | **ENG-37** |
| Copy / truth | Storage GB mismatch (2 vs 5) | P1 | **PM-3** |
| Copy / truth | Admin seat counts (2 / 10) | P2 | **PM-4** |
| Scale | Multi-workspace, SSO, custom domain, analytics API, SLA | P2 | **ENG-20** · **ENG-21** · Phase 3 |
| Support | In-app SLA timers (72h / 48h / 24h) | P2 | ops process only |

---

## Recommended NEXUS batches (post Batch 27)

| Batch | Theme | Scope | Unblocks |
|-------|-------|-------|----------|
| **28** | **LEG-1 + trial automation** | Privacy/Terms + **ENG-36** auto Growth trial | **confirmed** ✅ [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md) |
| **29** | **Billing MVP** ⏸ | **BILL-1** checkout · **BILL-3** overage · **ENG-37** plan-gated JSON log | **on hold** — user decision pending (Dodo vs Razorpay) |
| **30** | ~~Limits & copy truth~~ → **33** | See Batch 33 below | Merged into Batch 33 |
| **31** | **MKT-3 production** | Record A1/B1 · **MKT-3b** landing embed | Marketing hero · SAL-3 “watch demo” follow-up |
| **32** | **SAL-4 ops** | Design partner tracker · owner checklist UI · CRM export optional | Scale SAL-2 outbound without founder bottlenecks |
| **33** | **Limits, plan gates & copy truth** ✅ | **ENG-37** · **ENG-38** · **PM-3** | **shipped locally** — deploy pending |
| **36** | **Design audit (graphics / UI / UX)** ✅ | DES-AUD · DES-3–11 scoped | **audit done** — implement 36a→e |
| **35** | **QA-5 prod gate** ⏸ | Sign-up → upload → placement ≤15 min | **on hold** |

**Orchestration gate:** Each batch = Agents Orchestrator scope → implement → Evidence Collector / QA-5 spot-check → **user confirm** → backlog update (NEXUS-Sprint model).

---

## Phase 3 — Scale (post-MVP)

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| BILL-1 | Stripe / Dodo / Razorpay checkout (Starter/Launch/Growth) | **P1** ↑ | Backend | **on_hold** · user will request when ready · [readiness audit](./PRICING-FEATURE-READINESS.md) |
| BILL-2 | Hard enforce plan limits (upload + session + storage) | **P1** ↑ | Backend | todo · pairs with **ENG-38** (Batch 33) |
| SEC-2 | External pen test | P2 | Security | todo |
| ENG-20 | Custom domain per workspace (Scale) | P2 | DevOps | todo · do not promise in SAL-3 |
| ENG-21 | SAML SSO (Scale) | P2 | Backend | todo · do not promise in SAL-3 |
| ENG-39 | Multi-workspace / catalog (Scale) | P2 | Backend | todo |
| ENG-40 | Analytics API + export dashboard (Scale) | P2 | Backend | todo |

---

## Immediate next actions

1. **Deploy Batch 36a–e** — Amplify push (a11y + design audit fixes + model icons)
2. **Deploy Lambda** — default accent `#2dd4bf` in `dynamodb.mjs` (optional `package:atlas-api`)
3. **Batch 35 — QA-5** ⏸ **ON HOLD**
4. **Batch 29 — Billing MVP** ⏸ **ON HOLD**

---

## NEXUS-Sprint orchestration log (2026-06-18) — Batch 7

### Batch 7 — MiroFish run 2 report close-out

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped EN synthesis + PREDICTION merge for `sim_e6b7b440cb5a` (UI/UX + owner toggles sim) |
| 2 | **Technical Writer / PM** | [LIVE-REPORT-EN.md](./mirofish/LIVE-REPORT-EN.md) + [run synthesis](./mirofish/runs/2026-06-18T16-26-48-673Z/LIVE-REPORT-EN.md) |
| 3 | **Senior PM** | [PREDICTION-REPORT.md](./mirofish/PREDICTION-REPORT.md) live run 2 merge |
| 4 | **Evidence Collector** | Report quality **NEEDS WORK** — Ollama section 2 tool-call leak; sections 1+3 translated; objection weights from run 1 |
| 5 | **User gate** | **Pending your confirm** before next product batch |

**Optional follow-up:** MF-6 re-run report with `qwen2.5:14b` for sales-ready persona quotes.

---

## NEXUS-Sprint orchestration log (2026-06-18) — Batch 8

### Batch 8 — MiroFish P0 product implementation (`sim_e6b7b440cb5a`)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped P0 from run 2: dimension overlay visibility on custom GLBs; remove built-in demo models from shopper catalog |
| 2 | **Frontend Developer** | `ar-placement-fx.ts` — rendering group 1 + depth clear + `ALWAYS` depth; `session.ts` — retry placement FX attach; `model-catalog.ts` — `isDemoCatalogModel()` filter |
| 3 | **Backend / DevOps** | `models-api` empty manifest fallback; `public/custom-models/manifest.json` — removed builtins |
| 4 | **Evidence Collector / QA** | `npx tsc --noEmit` ✅ · `test:placement` ✅ · device verify **pending** (dims toggle on custom GLB after Amplify deploy) |
| 5 | **User gate** | **Failed device test** — session `1781852371842`: shadow ok, 3D tubes invisible (Batch 9 fix) |

**P0 items addressed:** dimension lines/labels when toggled · demo model removal  
**P0 already shipped (prior batches):** AR dock polish · catalog View in AR contrast · onboarding · owner toggles · MKT-6

---

## NEXUS-Sprint orchestration log (2026-06-19) — Batch 9

### Batch 9 — Dimension overlay + admin help nav + loading UX

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped from session log `1781852371842` + user report |
| 2 | **Evidence Collector** | Placement ok (`blobShadowVisible`); tubes in rendering group 1 not drawn in WebXR |
| 3 | **Frontend** | Move dimension meshes to RG0 (same as model); dynamic tube radius; toggle logged |
| 4 | **Frontend** | Admin help TOC → buttons + `scrollIntoView` (hash anchors broken in `#app` scroller) |
| 5 | **Frontend** | `nav-loading.ts` spinner on marketing/admin/auth navigation buttons |
| 6 | **User gate** | **Pending** — re-test Bar Chair Dimensions after Amplify deploy |
| 7 | **Hotfix** | Nav loading broke clicks (`pointerdown` + `disabled`) → click-capture visual-only spinner |

---

## NEXUS-Sprint orchestration log (2026-06-19) — Batch 10

### Batch 10 — Dimension world-space + nav loading + unverified auth flow

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped from session `1781859871405`: dims built+visible in log but not on device; nav spinner missing on Sign in/Create account; unverified login flow |
| 2 | **Evidence Collector** | `dimensionLinesBuilt: true` / `dimensionLinesVisible: true` on toggle — rendering/parenting issue, not attach failure |
| 3 | **Frontend** | Dimension tubes/labels in **world space** on scene root; **rendering group 2** (floor scan); thicker tubes |
| 4 | **Frontend** | Body-level `is-route-loading` overlay survives route `innerHTML` swaps; auth submit buttons arm spinner |
| 5 | **Frontend** | Login with `UserNotConfirmedException` → verify screen → auto sign-in → dashboard (signup-verify path unchanged) |
| 6 | **User gate** | **Pending** — re-test dimensions + nav loading + auth flow on device after Amplify deploy |

---

## NEXUS-Sprint orchestration log (2026-06-19) — Batch 11

### Batch 11 — Dimension hierarchy fix + nav hold-until-paint + viewer defaults

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped from session `1781862360745`: dims still invisible; spinner stops before route paint; JSON log + camera check should default off |
| 2 | **Evidence Collector** | Lines built+visible in log; blob shadow (wrapper child, RG0) renders — dimension root on scene root did not |
| 3 | **Frontend** | Parent dimension FX under placed wrapper (same hierarchy as blob); RG0; normal depth; `alwaysSelectAsActiveMesh: false` |
| 4 | **Frontend** | Nav spinner held until `releaseNavLoadingAfterPaint()` on destination screen (no 480ms cutoff) |
| 5 | **Frontend** | `DEFAULT_WORKSPACE_FEATURES`: only `startAr: true`; JSON log + camera check opt-in |
| 6 | **User gate** | **Pending** — re-test after Amplify deploy |

---

## NEXUS-Sprint orchestration log (2026-06-19) — Batch 12

### Batch 12 — Box dimension lines + nav MutationObserver + API feature defaults

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped from session `1781865154091`: dims still invisible; Sign in spinner stops early; admin spinner never stops; new workspaces all controls on |
| 2 | **Evidence Collector** | Rapid dimension on/off in log = `pointerup`+`click` double-fire on AR panel; API `!== false` defaulted all features true on create |
| 3 | **Frontend** | Dimension **box** meshes (not tubes); `alwaysSelectAsActiveMesh: true`; AR toggle single-fire fix |
| 4 | **Frontend** | `MutationObserver` on `#app` + 400ms min hold releases spinner when route paints (fixes admin stuck spinner) |
| 5 | **Backend** | `createWorkspace` persists `featuresSessionLogDownload: false`, `featuresStartAr: true`, `featuresCameraCheck: false`; read path opt-in |
| 6 | **User gate** | **Pending** — Amplify + **Lambda** redeploy, then device re-test |

---

## NEXUS-Sprint orchestration log (2026-05-21) — Batches 13–20

### Batch 13 — Thin dims + path-targeted nav + pricing ladder v1

| Step | Result |
|------|--------|
| AR | W/D/H box thickness 2–4 mm; path-targeted `notifyRouteContentReady` |
| Nav | Spinner held until destination route paints |
| Pricing | Market ladder replaces compare strip |

### Batch 14 — Double dims + single spinner + ladder spacing

| Step | Result |
|------|--------|
| AR | Dims 4–8 mm |
| Nav | Suppress button spinner when route overlay active |
| Pricing | Wider pin spacing; mobile vertical timeline |

### Batch 15 — Ladder position revert + showroom width

| Step | Result |
|------|--------|
| Pricing | Positions 6/22/34/58/94 restored; showroom `$99–450/mo` nowrap |

### Batch 16 — Hybrid ladder + home nav loading

| Step | Result |
|------|--------|
| Nav | `data-nav-path`, `goHome()` → `navigateTo("/")`, mobile menu signed-in links |
| Pricing | Mobile vertical + desktop anti-overlap positions |

### Batch 17 — Mobile vertical restore + home spinner fix

| Step | Result |
|------|--------|
| Nav | Spinner release when `navTargetPath` unset; hamburger trim (no sign-in/create account) |
| Pricing | Vertical mobile + `$100k+` rail bottom anchor |

### Batch 18 — Vertical mobile + desktop spacing (confirmed design)

| Step | Result |
|------|--------|
| Pricing | Vertical stack mobile; desktop stagger without overlap |

### Batch 19 — Plugins/showroom dots on horizontal rail ✅ **confirmed**

| Step | Result |
|------|--------|
| Pricing | Even pins: dot on rail, card in lower row, vertical stem |

### Batch 20 — QA gate + deploy handoff ✅ **confirmed**

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Returned to AR/deploy track after pricing close-out |
| 2 | **QA** | `npm run test:sprint3` — **26 passed, 0 failed**; camera check opt-in E2E |
| 3 | **DevOps** | Lambda + Amplify deploy handoff documented |
| 4 | **User gate** | **Confirmed** |

### Batch 21 — MiroFish run 3 mobile UX + pricing rail ✅ **confirmed**

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped from `sim_4e90f5c5bcd6`: mobile showroom-first, pricing rail, nav/auth |
| 2 | **Frontend** | Mobile pricing axis alignment; About nav; mobile auth/onboard/branding/owner; admin desktop gate |
| 3 | **QA** | `npm run build` ✅ · E2E updated for mobile login |
| 4 | **User gate** | **Confirmed** 2026-05-21 |

### Batch 22 — SUP-2 AR troubleshooting ✅ **confirmed**

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | SUP-2 after Batch 21 |
| 2 | **Support / Technical Writer** | [AR-TROUBLESHOOTING.md](./AR-TROUBLESHOOTING.md) |
| 3 | **Frontend** | `ar-troubleshooting-content.ts` → `/admin/help` |
| 4 | **User gate** | **Confirmed** 2026-05-21 |

### Batch 23 — SAL-1 sales deck (10 slides) · **confirmed** ✅

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped SAL-1 from [SALES-PLAYBOOK.md](./SALES-PLAYBOOK.md) + ICP + pricing |
| 2 | **UI Designer** | [sales-deck/DESIGN-SYSTEM.md](./sales-deck/DESIGN-SYSTEM.md) — 16:9 tokens, 9 templates |
| 3 | **Visual Storyteller** | [SALES-DECK.md](./SALES-DECK.md) — 10 slides + speaker notes |
| 4 | **Image Prompt Engineer** | 8 hero PNGs in [sales-deck/assets/](./sales-deck/assets/) (slides 1–5, 7, 9–10) |
| 4b | **Dedicated subagents** | Blocked — usage limit; UI/layout work done inline ([SLIDE-LAYOUTS.md](./sales-deck/SLIDE-LAYOUTS.md)) |
| 5 | **Frontend / Three.js** | Interactive web deck at `/sales-deck/index.html` — [public/sales-deck/](../../public/sales-deck/) |
| 6 | **Admin toggle** | Platform owner slide toggle on `/admin` → DynamoDB via `/v2/platform/settings` |
| 7 | **Production API (Option B)** | Lambda GET/PATCH `/v2/platform/settings` + public GET `/v2/platform/public-settings` |
| 8 | **User gate** | **Confirmed** 2026-05-21 · [BATCH-23-CONFIRMED.md](./BATCH-23-CONFIRMED.md) |

### Batch 24 — SAL-1b graphics refresh · **confirmed** ✅

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scope SAL-1b: hero graphics quality, complete image prompts, PNG regen |
| 2 | **UI Designer** | Safe zones, opacity table, overlay spec — [DESIGN-SYSTEM.md](./sales-deck/DESIGN-SYSTEM.md) |
| 3 | **Image Prompt Engineer** | All 8 hero prompts — [IMAGE-PROMPTS.md](./sales-deck/IMAGE-PROMPTS.md) |
| 4 | **Visual Storyteller** | Narrative audit — [VISUAL-AUDIT.md](./sales-deck/VISUAL-AUDIT.md) |
| 4b | **Dedicated subagents** | Blocked — usage limit; inline + image generation |
| 5 | **Image generation** | 8 PNGs refreshed; slides **3, 5, 9** kept at Batch 23 originals (user preference) |
| 6 | **Evidence Collector** | `npm run build` ✅ |
| 7 | **User gate** | **Confirmed** 2026-05-21 · [BATCH-24-CONFIRMED.md](./BATCH-24-CONFIRMED.md) |

### Batch 25 — SAL-3 presenter script · **confirmed** ✅

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1–6 | SAL-3 training + script | [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md) |
| 7 | **Revision (2026-05-21)** | Four-path design-partner close · slide 10 CTAs · follow-up email |
| 8 | **User gate** | **Confirmed** 2026-05-21 |

### Batch 26 — MKT-3 demo video + storyboard · **shipped**

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1–3 | Script + storyboard | [MKT-3-DEMO-VIDEO-SCRIPT.md](./MKT-3-DEMO-VIDEO-SCRIPT.md) · [mkt-3-storyboard/](../../public/mkt-3-storyboard/) |
| 4 | **User gate** | MKT-3 storyboard module shipped; video record optional follow-up |

### Batch 27 — SAL-2 design partner outreach · **confirmed** ✅

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Sales Outreach + MiroFish** | [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md) |
| 2 | **Pricing audit** | [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md) |
| 3 | **Frontend** | Interactive SAL-2 module — [outreach.html](../../public/sales-deck/outreach.html) |
| 4 | **User gate** | **Confirmed** 2026-05-21 · [BATCH-27-CONFIRMED.md](./BATCH-27-CONFIRMED.md) |

---

## NEXUS-Sprint orchestration log (2026-05-21)

### Batch 6 — MiroFish multi-API simulation

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped full GTM sim: UI/UX, marketing, sales, demographics, pricing |
| 2 | **PM** | `SEED-ATLAS-AR.md` updated; `RUN-MULTI-API.md` added |
| 3 | **DevOps** | `npm run mirofish:multi` — Gemini×2 → OpenAI → OpenRouter fallback; report skipped for Ollama |
| 4 | **Your action** | After sim: `npm run mirofish:report` with local Ollama (offline) |

### Batch 5 — MKT-6 product story (AR + 3D)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped MKT-6: add 3D inspect to marketing product story (not in-app viewer restyle) |
| 2 | **Senior PM** | Backlog updated (`MKT-6`) |
| 3 | **Marketing / Frontend** | `marketing-copy.ts`, landing section + hero badge, onboarding diagram + preview step, admin help devices |
| 4 | **QA gate** | `npm run test:sprint3` — **25 passed, 0 failed** · `npm run build` ✅ |
| 5 | **Your action** | Amplify redeploy (frontend only) |

### Batch 4 — AR UI fixes + split owner toggles

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped ENG-35: AR dock UI, AR/3D toggle fix, split `startAr` / `cameraCheck` flags, PC SVG icons |
| 2 | **Senior PM** | Backlog updated (ENG-35, ENG-33 split) |
| 3 | **Frontend + Backend** | `workspace-features.ts` split; owner 3 toggles; `patchArModelPicker` rebind; `objectModeAvailable` relaxed; dock CSS; diagram SVGs |
| 4 | **QA gate** | `npm run test:sprint3` — **25 passed, 0 failed** · `npm run build` ✅ |
| 5 | **Your action** | Lambda + Amplify deploy (`featuresStartAr`, `featuresCameraCheck`) |

## NEXUS-Sprint orchestration log (2026-06-18)

### Batch 3 — MF-5 + owner controls + AR UI

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped MF-5, ENG-33 (owner toggles), ENG-34 (AR/3D slide + panel polish) |
| 2 | **Senior PM** | Backlog updated (this file) |
| 3 | **Frontend + Backend** | Feature flags, owner slide toggles, GLB validation, AR panel redesign |
| 4 | **QA gate** | `npm run test:sprint3` — **25 passed, 0 failed** |
| 5 | **Your action** | Lambda + Amplify deploy (features need API) |

### Batch 2 — SUP-1

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | SUP-1 after MF-1 live |
| 5 | **QA gate** | **25 passed, 0 failed** |

### Batch 1 — MF-1 + OPS-1

| Step | Agent / gate | Result |
|------|----------------|--------|
| 4 | **Evidence Collector** | OPS-1 live verified |
| 5 | **QA gate** | **24 passed, 0 failed** |

**Process reminder:** Every batch ends with backlog update + `test:sprint3` + explicit deploy checklist before marking `done` on live-facing items.

---

## NEXUS-Sprint orchestration log (2026-07-05) — Batch 32

### Batch 32 — Coupon offer-type form fix

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped owner coupon UX bug: irrelevant fields visible + percent create failing on hidden defaults |
| 2 | **Frontend Developer** | `coupon-offer-form.ts` — fieldset groups, disable hidden inputs, typed payload, `novalidate` |
| 3 | **Backend Architect** | Verified Lambda already rejects cross-type fields; root cause was FE sending hidden defaults |
| 4 | **QA gate** | `npm run test:coupon-offer-form` ✅ · `npm run build` ✅ |
| 5 | **Deploy gate** | **Pending** — Amplify push |

**Root cause:** All offer-type fields lived in one grid; `[hidden]` on labels was unreliable, and hidden inputs (promo price 59, duration 12) were still submitted for percent offers → API 400.

---

## NEXUS-Sprint orchestration log (2026-07-05) — Batch 31

### Batch 31 — DES-2 logo PNG rollout + app wiring

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped DES-2 raster exports for MKT-3 video + prod favicon/PWA/nav wiring |
| 2 | **UI Designer (DES-2)** | Raster-safe SVG sources + `assets/logo/` folder structure + README |
| 3 | **Frontend Developer** | `generate-brand-assets.mjs`, `brand-assets.ts`, marketing nav/footer `<img>`, PWA manifest, favicon links |
| 4 | **DevOps / Technical Writer** | DES-2 asset inventory, MKT-3 storyboard asset paths, backlog update |
| 5 | **Build gate** | `npm run generate:brand` ✅ · `npm run build` ✅ |
| 6 | **Deploy gate** | **Pending** — Amplify push for `/brand/*` + favicons in prod |

**Deliverables:** `docs/atlas-ar/assets/logo/` (all size variants) · `public/brand/` · `marketing/title-card-1920x1080-dark.png`

---

## NEXUS-Sprint orchestration log (2026-07-05) — Batch AUD-2

### Batch AUD-2 — Security audit remediation (B-A through B-G)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | User approved all audit fix batches; scoped AUD-2 parallel to deploy backlog |
| 2 | **Security Engineer** | B-A: billing stub 501 gate · dev auth double-lock · legacy models-api 410 |
| 3 | **Backend Architect** | B-B: plan upload limits · S3 HeadObject on complete · SSRF safe-url · analytics validation · restricted public-config 403 |
| 4 | **Backend Architect** | B-C: coupon redeem after purchase · percent coupon maxUses |
| 5 | **DevOps Automator** | B-D: `npm audit fix` → 0 vulns · B-E: `verify-production-env.mjs` · CSP headers · `.gitignore` `.env*` |
| 6 | **Frontend Developer** | B-F: `platformFetch` mutations · no localStorage on API 404 · trial/restrict gates on `/w/*` + admin sub-routes · owner screen race guard |
| 7 | **QA / Evidence Collector** | B-G: `test:audit-remediation` · `test:coupon-offer-form` · `audit:aws-live` (pre-deploy baseline) |
| 8 | **DevOps** | `npm run package:atlas-api` → `atlas-api-deploy.zip` · `models-api-deploy.zip` (3.06 MB) |
| 9 | **Deploy gate** | **Done** ✅ — atlas-api + models-api + Amplify deployed |
| 10 | **Evidence Collector** | Post-deploy `audit:aws-live` → **9 pass · 1 warn · 0 fail** (2026-07-05) |

**Live AWS (verified):** CORS ✅ · legacy `/models/*` **410** ✅ · billing upgrade **501** ✅ · dev token **401** ✅ · owner email in bundle **WARN** (expected)

**Production env vars (post-deploy):**

| Variable | Production | Staging |
|----------|------------|---------|
| `ATLAS_ALLOW_STUB_BILLING` | **unset** (501 on upgrade) | `true` if testing upgrades |
| `ATLAS_ALLOW_DEV_AUTH` | **unset** | optional |
| `ATLAS_LEGACY_MODELS_API` | **unset** (410 on `/models/*`) | **unset** |
| `ATLAS_CORS_ORIGIN` | exact Amplify URL | same |
| `ATLAS_PLATFORM_OWNER_EMAILS` | operator emails | same as `VITE_*` |

---

## NEXUS-Sprint orchestration log (2026-07-05) — Batch 33

### Batch 33 — Limits, plan gates & copy truth ✅ (local)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped ENG-37 + ENG-38 + PM-3; billing remains on hold |
| 2 | **Backend Architect** | Tier-default `sessionLogDownload` for Growth+ · explicit owner override flag · upload 403 message |
| 3 | **Frontend Developer** | Admin upload gate UI + Account upgrade CTA · presign error parsing |
<<<<<<< Updated upstream
| 4 | **Product Manager** | Storage limits aligned: Starter 2 GB · Launch 5 GB · Growth 25 GB (code + pricing page) |
=======
| 4 | **Product Manager** | Storage limits aligned: Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB (50 MB max file all plans; code + pricing page) |
>>>>>>> Stashed changes
| 5 | **QA** | `npm run test:batch33` ✅ · `npm run build` ✅ |
| 6 | **Deploy gate** | **Pending** — `npm run package:atlas-api` + Amplify push |

**ENG-37 behavior:** New Growth/Scale workspaces (and Growth trials) get JSON session log by default. Owner toggle sets explicit override.

**ENG-38 behavior:** At model cap, upload form disabled + API returns 403 with upgrade message.

---

## NEXUS-Sprint orchestration log (2026-07-06) — Batch 34

### Batch 34 — Owner customer emails + live QA (through Batch 33)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Owner email visibility + prod QA scope through Batch 33 |
| 2 | **Backend Architect** | Cognito `ListUsers` fallback by sub · persist `email` on member at signup |
| 3 | **Frontend Developer** | Dedicated **Owner email** column + mailto links in Customers table |
| 4 | **Evidence Collector** | `qa:batch33-live` 8/5/0 · `audit:aws-live` 9/1/0 · browser: home/pricing/login ✅ |
| 5 | **Deploy gate** | **Done** ✅ — Lambda + Cognito IAM · `check:owner-emails-api` pass |

**Live QA highlights:** Owner emails visible in Customers panel · Cognito backfill on platform list.

---

## NEXUS-Sprint orchestration log (2026-07-06) — Batch 35

### Batch 35 — QA-5 prod gate (SAL-3 ≤15 min promise)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped QA-5 after Batch 34 close-out · Batch 29 billing stays on hold |
| 2 | **Evidence Collector** | `npm run qa:5-prod` automated pre-flight **13/0/0** on prod |
| 3 | **QA / User gate** | **Pending** — Android WebXR + iOS Quick Look device runs (≤15 min each) |

**Manual runbook:** `npm run qa:5-prod` → `manualRunbook` in JSON output.

---

## NEXUS-Sprint orchestration log (2026-07-06) — Batch 36

### Batch 36 — Graphics / UI / UX design audit

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | QA-5 on hold · scoped full graphics/UI/UX audit |
| 2 | **UI Designer** | 4 visual languages identified · token/spacing gaps |
| 3 | **UX Researcher** | Mobile admin gate friction · CTA taxonomy matrix needed |
| 4 | **Accessibility Auditor** | 3 P0: zoom lock, focus rings, reduced motion |
| 5 | **XR Interface Architect** | AR dock strengths · iOS GUI picker a11y gap |
| 6 | **Evidence Collector** | 32 UI modules inventoried · prod pricing snapshot |
| 7 | **Deliverable** | Canvas `atlas-design-audit` · 14 findings · DES-3–11 backlog |

**Recommended implement order:** ~~36a~~ ✅ → 36b (tokens) → 36c (brand) → 36d (AR/mobile) → 36e (polish)

---

## NEXUS-Sprint orchestration log (2026-07-06) — Batch 36a

### Batch 36a — DES-4 accessibility foundation

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped DES-4 from audit P0 list |
| 2 | **Accessibility Auditor** | Viewport zoom · focus-visible · reduced-motion |
| 3 | **Frontend Developer** | `index.html` + `style.css` tokens `--focus-ring` |
| 4 | **Evidence Collector** | `npm run test:des4` ✅ · `npm run build` ✅ (`main-BtUQuXE5.css`) |
| 5 | **Deploy gate** | **Pending** — Amplify push |

**Changes:** `maximum-scale=5.0` (removed `user-scalable=no`) · unified keyboard focus on app/AR/catalog/owner controls · `prefers-reduced-motion` disables nav spinners + AR scan bar animation.

---

<<<<<<< Updated upstream
=======
## NEXUS-Sprint orchestration log (2026-07-17) — Plan limits doc sweep

### Batch — 50 MB file cap + 2.5× storage alignment (docs + copy)

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped full-repo alignment after code change (50 MB all plans; storage = models × 50 MB × 2.5) |
| 2 | **Product Manager** | PRICING-RESEARCH, PRICING-FEATURE-READINESS, backlog PM-3, PRD FR-M1, PRICING engineering spec |
| 3 | **Frontend Developer** | marketing FAQ, admin-help-content, marketing-copy onboarding/upload FAQ |
| 4 | **UX / Design** | DES-1 wireframe usage panel → 12.2 GB (Growth tier) |
| 5 | **QA** | QA-SPRINT3 upload step note · `test:batch33` ✅ · `tsc --noEmit` ✅ |
| 6 | **Memory steward** | ATLAS-AR-PROJECT-MEMORY rule #11 + changelog |

**Canonical limits:** Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB · max file 50 MB all tiers · AR sessions 100/model (500/3K/10K caps) · Scale unlimited.

---

## NEXUS-Sprint orchestration log (2026-07-17) — AR session limits

### Batch — 100 sessions per model; Scale unlimited

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped session policy change across code + copy |
| 2 | **Backend Architect** | `plan-limits.mjs` — sessions = model slots × 100; Scale `0` (unlimited) |
| 3 | **Frontend Developer** | `plan-limits.ts`, account + admin dashboard “Unlimited” for Scale |
| 4 | **Product Manager** | Pricing page, FAQ, PRICING.md, PRICING-RESEARCH, feature readiness |
| 5 | **QA** | `test:batch33` + `test-batch28-trial-smoke` session asserts · `tsc` ✅ |
| 6 | **Memory steward** | Rule #12 + changelog |

---

>>>>>>> Stashed changes
## Dependency graph (Sprint 1)

```
ENG-2 Cognito ──► ENG-3 Authorizer ──► ENG-8 API v2
ENG-1 DynamoDB ──► ENG-4 public-config ──► ENG-16 catalog client
ENG-6 Auth UI ──► ENG-7 workspace create ──► ENG-11 admin
```
