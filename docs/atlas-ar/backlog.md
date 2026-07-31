# Atlas AR — Product backlog

**Last updated:** 2026-07-30 (UI refresh live on Amplify `67e05df`)

**Parked (billing):** Natural renewal check on test-admin `sub_0NkDIEC…` ~2026-07-30T05:21Z — corrected PPUs · meterSync · no old-sub charge. Live cutover / Zoho on hold.

**Latest orchestration batch (2026-07-30):** **Production UI refresh LIVE** on Amplify. Push repo commit `67e05df` → `origin/main`. Additive `src/styles/refresh/` layer; cinema hero; Account Danger zone; iOS showroom branch; Inter self-hosted for CSP. AR session frozen (`guard:ar`). Prod: `https://main.d7vfdpujdozkj.amplifyapp.com`.

**Previous orchestration batch (2026-07-30):** **Production UI refresh port** from approved sandbox. Additive `src/styles/refresh/` layer (never edits `style.css`). Marketing (cinema hero), auth, admin, account (Danger zone), owner, showroom, device-test. **AR session frozen** (`npm run guard:ar`). Delete account only on Account. Showroom `iosSafariAr: isIOS()`. Inter + DM Sans self-hosted for Amplify CSP (`font-src 'self'`). Design audit 75/75. **Dev-repo code ready; Amplify push not done yet.**

**Previous orchestration batch (2026-07-29):** Sandbox review round 1 signed off. **Atlas (teal) theme approved** — VisionOS palette + theme switch deleted, toolbar shows a lock chip. **AR session excluded from the refresh** — rewritten to replicate production (`dom-overlay` dock, Babylon cyan/red ring, iOS = "View in AR" page then native Quick Look with no Atlas UI); invented top bar / Cyan-Red toggle / Place-Reset-Exit buttons removed; production classes isolated in `.arprod`-scoped `ar-production.css`. **Animated landing hero** — 85 MB `Home_page_PS.gif` transcoded to H.264 (3.4 MB desktop / 1.1 MB phone / 124 KB poster; WebM rejected at 19 MB), replaces the now-redundant static `hero-ar-phone.png`; off-screen + hidden-tab pause, `prefers-reduced-motion` fallback, user Pause-motion control; hero text measured at worst case **5.94:1** against the clip's brightest frame. **Still no production port until the full design is approved.**

**Previous orchestration batch (2026-07-29):** Get started cross-browser — closed FE deploy gap (Lambda was live but FE never copied to push repo); localStorage→server backfill on hydrate; credited share/preview from real actions (dashboard Preview AR, model-manager Copy link) + new one-click Copy link on dashboard. Live bundles `main-CSboLQ4q.js` → `179f6d4`.

**Previous orchestration batch (2026-07-29):** Get started progress persisted on workspace META; skip forced wizard when catalog has models

**Previous orchestration batch (2026-07-29):** Hybrid plan change always remounts (Dodo change-plan 500 workaround); `/health` clearTestOverage follows `ATLAS_CLEAR_TEST_OVERAGE` (default false)

**Previous orchestration batch (2026-07-25):** BILL-METER-SYNC — hybrid Upgrade/Downgrade → checkout remount + meter assert (Dodo change-plan leaves stale meters)

**Previous orchestration batch (2026-07-25):** BILL-2 — session SoT 500/3k/10k · storage upload hard-block · sessions soft-allow under hybrid meters

**Previous orchestration batch (2026-07-20):** BILL-1 account UX bugs + owner refund UI · Lambda zip ready · Amplify push pending

**Sprint cadence:** 2-week sprints  
**Phase 0:** Complete → **Phase 1:** COMPLETE ✅ (QA-3b/4b signed · ENG-19 verified 4/4 · DES-1/DES-2 shipped) → **Post-28: DEPLOYED + verified live** → **Phase 2:** ENG-23–31 + MF-1 MiroFish conversion (2026-06-18)

**Orchestration (NEXUS-Sprint):** Agents Orchestrator → PM backlog → Frontend/DevOps implement → Evidence Collector / QA gate → backlog update → **user confirmation** before next batch. See [strategy/QUICKSTART.md](../../strategy/QUICKSTART.md) (NEXUS-Sprint mode).

**Previous batch (2026-07-06):** Batch 36b–e — **DES-3–11 design audit fixes** ✅ · model icon slug fix · mobile admin hub · `npm run test:design-audit`

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
| **PM-3** | **Align storage copy:** PRICING.md vs `plan-limits.ts` | P1 | PM | **done** · code + pricing page aligned to derived storage (models × 50 MB × 2.5): Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB |
| **PM-4** | **Admin seat copy vs product:** implement seat limits or remove 2/10 seat claims from PRICING + pricing page | P2 | PM | todo |
| **BILL-3** | **Overage via Dodo meters** (hybrid Usage-Based; auto-bill at payment cycle) | P1 | Backend | **done** (meters + ingest) · Account shows estimate/guide only — `/charge` unsupported on hybrids · see [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md) |
| **BILL-4** | **Annual prepay SKUs** (20% off Launch/Growth) | P2 | Backend | **on_hold** · blocked by Batch 29 |
| **MKT-7** | **Analytics story alignment** — usage dashboard vs JSON session log vs owner override; per-model analytics deferred | P2 | Marketing | **done** ✅ (2026-07-31) · copy only |
| **SEO-1** | **Technical SEO Phase 1** — www.atlasar.in canonicals, robots/sitemap, SPA per-route meta + JSON-LD, noindex private tools | P0 | Marketing/Eng | **done** (2026-07-30) · [SEO-OPS-CHECKLIST.md](./SEO-OPS-CHECKLIST.md) |
| **SEO-2** | **SEO Phase 2** — prerender shells for `/` `/pricing` `/about` legal; content hub; optional marketing host split; per-page OG | P2 | Marketing/Eng | todo · after GSC green on SEO-1 |
| **SAL-4** | **Design partner ops runbook** — owner workflow for $59 Growth, coupons, session log, slot tracking | P2 | Sales/Ops | **done** ✅ · runbook + Owner Design partners tab (3 slots); CRM export out of scope |
| **ENG-39** | **Owner dashboard: customer owner emails in Customers table** | P1 | Full-stack | **done** ✅ (Batch 34) |
| **QA-5** | **SAL-3 QA gate on prod:** sign-up → upload → floor placement ≤15 min (Android + iOS) | P1 | QA | **done / PASS** ✅ (2026-07-17 confirm · Batch 35 closed 2026-07-31) |
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
| **MKT-3b** | **Record + embed demo video** (A1/B1 cuts from storyboard) | P1 | Marketing | **partial** · checklist + landing `#product-demo` empty-state + sales-deck link; **awaiting A1/B1 mp4 drop** in `public/marketing/` |

---

## SAL-3 & sales orchestration — promised vs built

**Source:** [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md) · [PRESENTER-SCRIPT.md](./sales-deck/PRESENTER-SCRIPT.md) · [SALES-PLAYBOOK.md](./SALES-PLAYBOOK.md) QA handoff · [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md)

SAL-3 **content** is done (deck + training + four-path close). These **product gaps** block fully self-serve delivery of what reps say on calls:

| SAL-3 / deck promise | Rep says (slide / training) | Product today | Backlog |
|----------------------|----------------------------|---------------|---------|
| 14-day Growth trial, no card | Slide 8, CTA slide 10 | Auto on workspace create (Growth limits 14d) | **ENG-36** ✅ |
| Design partner — Growth @ $59, 90 days | Slide 10 path 3 · SAL-2 outreach | Owner dashboard plan + coupon; manual invoice | **SAL-4** · **BILL-1** |
| Founding 10 — Growth @ $59 × 12 mo | Slide 10 path 4 | Same manual ops | **SAL-4** · **BILL-1** |
| Growth “analytics export for sales ops” | Slide 8 · Growth tier | JSON session log **on by default** (ENG-37); owner can override | **ENG-37** ✅ · **MKT-7** ✅ |
| Launch “basic session analytics” | Slide 8 · Launch tier | **Usage dashboard** only (models/sessions/storage) — copy aligned | **MKT-7** ✅ |
| “Pay overage” in account | Pricing FAQ | **Meters auto-bill** at cycle; Account estimate is a guide (no hybrid card `/charge`) | **BILL-3** ✅ |
| Starter 5 models / session limits | Slide 8 | Warnings only; upload not blocked | **ENG-38** · **BILL-2** |
| Scale tier (SSO, custom domain, multi-workspace) | Slide 8 | Not built | **ENG-20** · **ENG-21** · Phase 3 |
| First placement ≤15 min | SAL-3 intro · MiroFish #1 objection | **PASS** on prod (guided ≤15 min) | **QA-5** ✅ |
| iOS “View in AR” not “Start AR” | Slide 4 demo · admin help | Ready; staff training required | SUP-2 ✅ · SAL-3 training ✅ |
| IT one-pager / security | Slide 9 | Landing + `/about` ✅ | LEG-1 for signup trust |
| Demo video on landing | Optional SAL-3 follow-up | Embed + empty-state live; mp4s pending | **MKT-3b** |

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
| Plan features | Analytics export tied to Growth tier | P0 | **ENG-37** ✅ · copy **MKT-7** ✅ |
| Copy / truth | Storage GB mismatch (2 vs 5) | P1 | **PM-3** |
| Copy / truth | Admin seat counts (2 / 10) | P2 | **PM-4** |
| Scale | Multi-workspace, SSO, custom domain, analytics API, SLA | P2 | **ENG-20** · **ENG-21** · Phase 3 |
| Support | In-app SLA timers (72h / 48h / 24h) | P2 | ops process only |

---

## Recommended NEXUS batches (post Batch 27)

| Batch | Theme | Scope | Unblocks |
|-------|-------|-------|----------|
| **28** | **LEG-1 + trial automation** | Privacy/Terms + **ENG-36** auto Growth trial | **confirmed** ✅ [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md) |
| **29** | **Billing MVP** ▶ | **BILL-1** Dodo · **BILL-3** hybrid meters · **BILL-2** limits | **in progress** — hybrid renewal verified 2026-07-25; BILL-2 done; Zoho India + Month SKU cutover remain |
| **30** | ~~Limits & copy truth~~ → **33** | See Batch 33 below | Merged into Batch 33 |
| **31** | **MKT-3 production** | Embed plumbing ✅ · **await A1/B1 mp4** · then Amplify media push | Marketing hero · SAL-3 “watch demo” follow-up |
| **32** | **SAL-4 ops** | Runbook + Owner 3-slot UI ✅ · CRM export out of scope | Scale SAL-2 outbound without founder bottlenecks |
| **33** | **Limits, plan gates & copy truth** ✅ | **ENG-37** · **ENG-38** · **PM-3** | **shipped locally** — deploy pending |
| **36** | **Design audit (graphics / UI / UX)** ✅ | DES-AUD · DES-3–11 scoped | **audit done** — implement 36a→e |
| **35** | **QA-5 prod gate** ✅ | Sign-up → upload → placement ≤15 min | **done / PASS** (2026-07-31) |

**MVP P0 status (2026-07-31):** No open MVP P0 ship blockers. Auth/tenant/AR E2E, SEO-1, ENG-36/37, DES-4, BILL-METER-SYNC (Lambda uploaded) are done. **BILL-1** remains **on_hold** (P0-for-scale, not MVP launch blocker). Remaining work is P1/P2 (MKT-3b media, PM-4, SEO-2, etc.).

**Orchestration gate:** Each batch = Agents Orchestrator scope → implement → Evidence Collector / QA-5 spot-check → **user confirm** → backlog update (NEXUS-Sprint model).

---

## Phase 3 — Scale (post-MVP)

| ID | Task | Priority | Owner | Status |
|----|------|----------|-------|--------|
| BILL-1 | Dodo international + Zoho India checkout (Starter/Launch/Growth) | **P1** ↑ | Backend | **in_progress** · Dodo sandbox automated gate **PASSED** (22/22, 2026-07-20) · Zoho India sandbox next · optional period-end clock E2E |
| BILL-2 | Hard enforce plan limits (upload + session + storage) | **P1** ↑ | Backend | **done** (2026-07-25) · models+storage hard-block; sessions soft-allow + meter warnings · `npm run test:bill2` |
| BILL-METER-SYNC | Hybrid plan change remounts meters via checkout (not change-plan alone) | **P0** ↑ | Backend | **done** (code 2026-07-25) · int32 free-threshold harden 2026-07-26 · `npm run test:bill-meter-sync` · **deploy:** Lambda zip |
| BILL-STUCK-HINT | Clear stuck_payment META after live entitlement / resubscribe | **P1** | Backend | **done** (2026-07-26) · webhook + billing/status · `npm run test:stuck-payment-cancel` · **deploy:** Lambda zip |
| SEC-2 | External pen test | P2 | Security | todo |
| ENG-20 | Custom domain per workspace (Scale) | P2 | DevOps | todo · do not promise in SAL-3 |
| ENG-21 | SAML SSO (Scale) | P2 | Backend | todo · do not promise in SAL-3 |
| ENG-39 | Multi-workspace / catalog (Scale) | P2 | Backend | todo |
| ENG-40 | Analytics API + export dashboard (Scale) | P2 | Backend | todo |

---

## Immediate next actions

1. **Deploy Batch 36a–e** — Amplify push (a11y + design audit fixes + model icons)
2. **Deploy Lambda** — default accent `#2dd4bf` in `dynamodb.mjs` (optional `package:atlas-api`)
3. **Batch 35 — QA-5** ✅ **PASS** (closed 2026-07-31)
4. **Batch 29 — Billing MVP** ▶ **IN PROGRESS** — Dodo/Zoho adapters and server-owned checkout mapping next

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
| `ATLAS_ALLOW_STUB_BILLING` | **unset** (direct Lambda upgrade retired) | `true` only for explicit local Vite-plugin tests |
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
| 4 | **Product Manager** | Storage limits aligned: Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB (50 MB max file all plans; code + pricing page) |
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
| 3 | **QA / User gate** | **PASS** — first placement smooth ≤15 min (2026-07-17) · Batch 35 closed 2026-07-31 |

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

## NEXUS-Sprint orchestration log (2026-07-17) — Upload note · branding logo · admin colors

### Batch — Manage models note + logo S3 upload + button color fix

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped: missing note on Manage models; branding logo file→S3; admin button color drift |
| 2 | **Frontend Developer** | `admin-models.ts` — `uploadSizeNoteHtml` + size preflight; CSS admin accent lock |
| 3 | **Backend Architect** | `POST /v2/workspaces/{id}/branding/logo` presign/complete; `uploadWorkspaceLogo` client |
| 4 | **Frontend Developer** | Branding UI file input; optional URL kept |
| 5 | **QA** | `test:design-audit` 72 ✅ · `test:batch33` ✅ · `test:des4` ✅ · `tsc` ✅ · `build` ✅ |
| 6 | **Memory steward** | Rules #16–18 + placement confirmed |

**Deploy:** Amplify FE from push repo + **Lambda redeploy** (new branding logo route).

---

## NEXUS-Sprint orchestration log (2026-07-17) — Preview AR isolation + sales deck Starter

### Batch — Empty catalog must not show demo; Starter sessions copy

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | User: slide 8 “100 sessions”; trial Preview AR → another account’s AR |
| 2 | **Content / Sales** | `slides.js` + `training-slides.js` → 100 sessions **/ model** |
| 3 | **Frontend Developer** | Gate Preview AR when 0 models; `openTenantShowroom`; block empty tenant AR enter |
| 4 | **QA** | `tsc --noEmit` ✅ |
| 5 | **Memory steward** | Rules #19–20 |

**Deploy:** copy → push `main` (FE only for this batch).

---

## NEXUS-Sprint orchestration log (2026-07-18) — Production domain migration

### Batch — Amplify production URL → `d7vfdpujdozkj`

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Scoped active production URL references; preserved historical AR session evidence |
| 2 | **DevOps Automator** | Deploy/QA script defaults + current deployment docs → `https://main.d7vfdpujdozkj.amplifyapp.com` |
| 3 | **Evidence Collector** | `verify:amplify-env` **4/4** · `qa:5-prod` **13/0/0** · `audit:aws-live` **9/1/0** |
| 4 | **Build gate** | `npm run build` ✅ |
| 5 | **User gate** | Sign-in confirmed working on the new domain |

---

## NEXUS-Sprint orchestration log (2026-07-18) — Sales deck font/CSP remediation

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Selected highest-priority independent P1 after domain migration |
| 2 | **Frontend Developer** | Self-hosted DM Sans + Instrument Serif; removed Google Fonts from deck, training, and outreach |
| 3 | **Security Engineer** | Preserved strict `font-src 'self' data:` CSP; added remote-font regression check |
| 4 | **QA** | `test:design-audit` **74/74** · `npm run build` ✅ |

---

## NEXUS-Sprint orchestration log (2026-07-18) — Billing ledger foundation

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Agents Orchestrator** | Confirmed Dodo for international and existing Zoho Billing Premium + Books Standard for India |
| 2 | **Backend Architect** | Provider-neutral normalized events, monotonic ordering, global subscription binding, transactional ledger and entitlement projection |
| 3 | **Security Engineer** | Retired direct Lambda tier mutation; provider expiry suppresses legacy paid fallback; strict identifiers, timestamps, and integer money |
| 4 | **QA** | Billing state, ledger, trial/suspension, audit remediation, TypeScript build, and Lambda package ✅ |
| 5 | **Activation gate** | Checkout and webhook routes remain disabled until server-owned checkout/customer mapping and signed provider adapters pass sandbox QA |

---

## NEXUS-Sprint orchestration log (2026-07-18) — Dodo/Zoho adapter foundation

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Provider research** | Official Dodo + Zoho India checkout, lifecycle, OAuth, webhook, portal, cancellation, and refund contracts mapped |
| 2 | **Backend Architect** | Routed hosted checkout with full-request idempotency binding; Dodo signed webhook reconciliation; Zoho hosted checkout/OAuth client; provider preflight and at-most-once call boundary |
| 3 | **Security Engineer** | Server-owned tenant mapping, business binding, isolated reconciliation locks, URL/origin allowlists, strict inputs, provider-time ordering, independent fail-closed rollout flags |
| 4 | **QA** | Billing state, ledger, provider, suspension, and audit suites ✅ · build ✅ · Lambda package ✅ · ZIP/source parity verified |
| 5 | **Activation gate** | Keep all billing rollout flags disabled until credentials, product mappings, API Gateway CORS/routes, and sandbox evidence are complete |

---

## NEXUS-Sprint orchestration log (2026-07-19) — Billing lifecycle and Dodo evidence

| Step | Agent / gate | Result |
|------|----------------|--------|
| 1 | **Backend Architect** | Added customer portal, immediate upgrade / renewal downgrade, period-end cancellation, owner-approved idempotent refunds, and signed Zoho Payments reconciliation |
| 2 | **Accounting** | Added Zoho Books invoice/payment mirror with currency clearing contacts, retry backoff, and dead-letter state |
| 3 | **Frontend Developer** | Replaced local purchased-tier stub with routed hosted checkout and provider-backed account management |
| 4 | **Security / QA** | Fixed USD/INR provider policy, fail-closed flags, strict redirect hosts, provider-call boundaries, environment validator; billing policy/state/ledger/provider/audit suites and build ✅ |
| 5 | **Dodo sandbox evidence** | Successful USD 5 Starter payment and active subscription; Atlas operation ID preserved; live unsigned webhook probe returns `400` and status route requires auth (`401`) |
| 6 | **Release blockers** | Dodo product reports yearly subscription period with monthly payment frequency; record webhook HTTP `2xx`, authenticated Atlas `billing/status=active`, duplicate replay, and add/deploy new API Gateway management routes |

---

### Billing rollout update — 2026-07-19 11:28 IST

- Dodo Starter corrected to payment frequency `1 Month` and subscription period `1 Month`.
- Hardened Lambda package uploaded.
- API Gateway routes verified live: portal, plan, cancel, refund, and status return `401`
  without JWT; Dodo unsigned webhook returns `400`; disabled Zoho webhook returns `503`.
- Remaining Dodo gate: perform a fresh disposable checkout because the prior subscription keeps
  its original annual period; capture signed webhook `2xx`, authenticated `billing/status=active`,
  Month/Month subscription payload, and duplicate replay evidence.

### Billing rollout update — 2026-07-19 16:10 IST

- Fresh USD 5 Starter checkout verified for workspace `1ee2cb65-6252-4679-ab53-84ea36b2518f`.
- Dodo payment `pay_0NjVduFke9QpJiCmQvgYQ` succeeded; subscription
  `sub_0NjVduFvyLgtljNZmXMoU` is active with Month/Month frequency and period.
- Signed `payment.succeeded` and `subscription.active` replays completed without Lambda errors;
  duplicate replay preserved the subscription projection.
- Authenticated Atlas billing status now returns provider `dodo`, tier/status
  `starter`/`active`, entitlement `starter`, and period end `2026-08-19T08:12:37.451Z`.
- Runtime corrected to 256 MB / 15 seconds after evidence showed a 3-second timeout and
  near-exhausted 128 MB allocation.
- Sandbox security follow-up: rotate the test Dodo API key exposed during diagnostics and update
  the Lambda environment before further provider testing.

### Billing rollout update — 2026-07-20 09:05 IST

- Interrupted mid-work recovered: owner refund UI was committed locally as `dbd3111`
  (`feat: add owner payment refunds`) but not yet pushed when Cursor dropped.
- User-reported BILL-1 account bugs investigated and fixed in code:
  1. Cancel-at-period-end now optimistically updates subscription + workspace projection
     (`markBillingCancelScheduled`) and account UI merges `/billing/status` on load.
  2. Growth upgrade options during Growth trial use paid `subscribedBillingTier`, not
     trial-elevated `effectiveBillingTier`.
  3. Plan changes schedule at `next_billing_date` (no immediate upgrade proration charge).
  4. Billing country is required (no `US` default) before checkout, plan change, and portal.
- Owner refund controls: `/owner` “Issue refund” → `POST /v2/platform/billing/refunds`.
- Tests: `test:billing-policy` ✅ · frontend `npm run build` ✅ · Lambda ZIP rebuilt
  (`backend/lambda/atlas-api-deploy.zip`).
- **Still required:** upload Lambda ZIP to `atlas-api`; push Amplify `main` with frontend;
  re-test cancel / Growth upgrade visibility / country gate / renewal-only upgrade;
  then Zoho India sandbox + optional owner-approved refund E2E.

### Billing rollout update — 2026-07-20 09:26 IST (authenticated sandbox)

- Re-ran `npm run qa:billing-sandbox` with Cognito ID token (not persisted in git/memory).
- Result: **PASS 22 · FAIL 0 · SKIP 3** (mutating cancel/upgrade intentionally skipped).
- Workspace `1ee2cb65-6252-4679-ab53-84ea36b2518f` (`test-admin`):
  - Trial: Growth through `2026-08-02T07:23:42.821Z`
  - Entitlement: **launch** / status **active** / `cancelAtPeriodEnd=true`
  - Period end: `2026-08-19T11:32:53.048Z` · sub `sub_0NjVduFvyLgtljNZmXMoU`
- Lambda ZIP confirmed live for country gate:
  - `POST …/billing/plan` without country → `400 billingCountry must be an ISO country code`
  - `POST …/billing/portal` without country → `400`
  - Same-tier plan with `billingCountry=US` → `200 { ok, pending:false, tier:launch }`
- Remaining manual: signed-in Account UI — Growth upgrade card (paid Launch → show Growth),
  country empty blocks CTA, cancel message already expected (`cancelAtPeriodEnd=true`).
- Do **not** run a live Growth upgrade smoke unless asked (would schedule provider plan change).

### Billing rollout update — 2026-07-20 09:33 IST (period-end acceleration)

- **Do not wait until 19 Aug.** Dodo test mode supports advancing the clock via
  `PATCH /subscriptions/{id}` `{ "next_billing_date": "<future UTC Z>" }` (2–5 minutes ahead).
- Procedure recorded in [BILLING-SANDBOX-SETUP.md](./BILLING-SANDBOX-SETUP.md) §9.
- Current `test-admin` sub already has cancel-at-period-end → advancing date validates
  cancel/expiry webhooks + Atlas entitlement drop. For renewal or upgrade-at-renewal proofs,
  use a fresh Month/Month sub (or clear cancel flag) before advancing the date.

### Billing rollout update — 2026-07-20 17:52 IST (authenticated checklist GREEN)

- User ran `npm run qa:billing-sandbox` with fresh Cognito token from project dir.
- **Result: PASS 22 · FAIL 0 · SKIP 3**
- Auth status: **launch / active / cancelAtPeriodEnd=true**
- All BILL-1 UX markers live on Amplify; country gate on Lambda confirmed.
- **BILL-1 automated sandbox gate: PASSED** ✅
- Remaining optional: manual Account UI glance; period-end acceleration via Dodo
  `next_billing_date` if testing cancel/expiry before 19 Aug; Zoho India sandbox.

## NEXUS-Sprint orchestration log (2026-07-20) — BILL-1 sandbox sign-off

| # | Agent / role | Outcome |
|---|--------------|---------|
| 1 | **Evidence Collector / QA** | Authenticated checklist 22/22 pass (3 mutating skips) |
| 2 | **Senior PM** | Memory updated; BILL-1 automated gate closed |
| 3 | **Next gate** | Optional: Dodo clock advance for period-end E2E · Zoho India · owner refund E2E |

---

## Dependency graph (Sprint 1)

```
ENG-2 Cognito ──► ENG-3 Authorizer ──► ENG-8 API v2
ENG-1 DynamoDB ──► ENG-4 public-config ──► ENG-16 catalog client
ENG-6 Auth UI ──► ENG-7 workspace create ──► ENG-11 admin
```
