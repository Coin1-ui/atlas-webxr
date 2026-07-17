# Batch 28 — LEG-1 signup trust + ENG-36 auto Growth trial

**Date:** 2026-05-21  
**Status:** Shipped ✅ (2026-05-21 user confirm)  
**Orchestration:** NEXUS-Sprint (Agents Orchestrator → implement → QA gate → user confirm)  
**Unblocks:** SAL-3 slide 8 “14-day Growth trial, no card” · pricing page CTA truth · IT/legal signup trust

---

## Goals

| # | Goal | Success criterion |
|---|------|-------------------|
| G1 | **Self-serve trial matches sales copy** | New workspace gets **Growth limits for 14 days** without owner dashboard intervention |
| G2 | **Signup legal trust** | User explicitly accepts Terms + Privacy before account/workspace creation; policies reviewable in counsel-ready docs |
| G3 | **Visible trial state** | Admin + Account show “Growth trial · N days left” and post-trial fallback tier |
| G4 | **Owner overrides preserved** | Design partner / Founding 10 manual plan assignment still works and clears or supersedes trial |

---

## Current state (audit)

### LEG-1 — mostly built in UI, gaps in signup flow + counsel pack

| Asset | Status | Location |
|-------|--------|----------|
| Terms, Privacy, AUP content | ✅ In-app | [`src/ui/legal-content.ts`](../../src/ui/legal-content.ts) |
| Legal routes | ✅ | `/legal/terms`, `/legal/privacy`, `/legal/acceptable-use` |
| Marketing footer links | ✅ | [`marketingFooterLegalHtml()`](../../src/ui/marketing-nav.ts) |
| Signup terms checkbox | ❌ | [`auth-signup.ts`](../../src/ui/auth-signup.ts) — no consent |
| Onboard terms reminder | ❌ | [`auth-onboard.ts`](../../src/ui/auth-onboard.ts) |
| Auth shell legal links | ❌ | [`auth-shell.ts`](../../src/ui/auth-shell.ts) |
| Markdown export for counsel | ❌ | No `docs/atlas-ar/legal/*.md` |
| Legal entity / registered name | ⚠️ Partial | Copy says “Atlas AR”; MOU uses **Omni Manual Private Limited** |
| Subprocessor list | ❌ | Privacy §6 says “available on request” only |
| Cookie notice (EU) | ❌ | Deferred P2 — note in scope, not blocking batch |

### ENG-36 — not implemented

| Item | Today | Spec ([PRICING.md](./PRICING.md)) |
|------|-------|-------------------------------------|
| `trialEndsAt` | Not in schema | ISO timestamp |
| `trialPlan` | Not in schema | `"growth"` |
| Workspace create | `plan: "starter"`, no `billingTier` | Growth limits for 14 days |
| Effective limits | `billingTierFromWorkspace` → **starter** | Growth during active trial |
| Trial UI | None | Account + admin banner |
| Trial expiry | N/A | Downgrade to Starter limits (soft; no Stripe yet) |

**Create path today** ([`plugins/atlas-saas-api.ts`](../../plugins/atlas-saas-api.ts) `POST /v2/workspaces`):

```451:463:atlas-webxr/plugins/atlas-saas-api.ts
          const rec: WorkspaceRecord = {
            id,
            slug,
            name: name.slice(0, 80),
            plan: "starter",
            primaryColor: "#1565c0",
            featuresSessionLogDownload: false,
            featuresStartAr: true,
            featuresCameraCheck: false,
            featuresArControls: true,
            createdAt: now,
            updatedAt: now,
          };
```

Production Lambda (`handlers/v2-workspaces.mjs`) must mirror the same fields on deploy.

---

## Scope — LEG-1 (signup trust)

### In scope

1. **Signup consent UI** — Required checkbox on create-account form:
   - Copy: “I agree to the [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy).”
   - Block submit if unchecked; open legal in new tab or in-app route.
2. **Auth shell legal footer** — Terms · Privacy · AUP links on signup, verify, onboard panels (match marketing footer).
3. **Counsel review pack** — Export static markdown (generated from `LEGAL_DOCS` or hand-synced):
   - `docs/atlas-ar/legal/TERMS-OF-SERVICE.md`
   - `docs/atlas-ar/legal/PRIVACY-POLICY.md`
   - `docs/atlas-ar/legal/ACCEPTABLE-USE.md`
   - `docs/atlas-ar/legal/README.md` — entity name, effective date, review checklist, **not legal advice** banner.
4. **Entity block** — Add to Terms §14 / Privacy §1:
   - **Omni Manual Private Limited** (Atlas AR) — placeholder registered address TBD; `legal@atlas-ar.com`, `privacy@atlas-ar.com`.
5. **Optional lightweight audit field** — `termsAcceptedAt` ISO on Cognito custom attribute or dev session (best-effort; not blocking if Cognito custom attrs deferred).

### Out of scope (Batch 29+)

- Cookie consent banner / CMP (EU) — **LEG-2** candidate  
- Subprocessor public page — stub link in Privacy OK; full list **LEG-2**  
- Attorney sign-off — user/counsel action after markdown export  
- GDPR DPA template for enterprise — Scale sales  

### Files to touch (LEG-1)

| File | Change |
|------|--------|
| `src/ui/auth-signup.ts` | Terms checkbox + validation |
| `src/ui/auth-onboard.ts` | One-line “By launching, you agree…” + legal links |
| `src/ui/auth-shell.ts` | Footer legal nav on auth panels |
| `src/ui/legal-content.ts` | Entity name paragraph in controller section |
| `docs/atlas-ar/legal/*.md` | New counsel pack (4 files) |
| `docs/atlas-ar/backlog.md` | LEG-1 → done when shipped |

---

## Scope — ENG-36 (auto Growth trial)

### Data model

Add to `Workspace` ([`src/shared/tenant.ts`](../../src/shared/tenant.ts)) and backend record:

```typescript
/** ISO-8601 end of promotional trial; absent = no trial or consumed. */
trialEndsAt?: string | null;
/** Limits applied while trial active (default "growth"). */
trialPlan?: PlanTierId | null;
/** Post-trial paid tier if no upgrade (default "starter"). Stored as billingTier. */
billingTier?: PlanTierId;
```

**Rules:**

| Rule | Behavior |
|------|----------|
| Trial start | Set on **workspace create** (onboard), not Cognito signup alone |
| Duration | `trialEndsAt = now + 14 days` (UTC) |
| Active trial | `effectiveBillingTier(ws)` → `trialPlan` (growth) if `now < trialEndsAt` |
| Expired trial | `effectiveBillingTier(ws)` → `billingTier ?? "starter"` |
| One trial per workspace | Set at create only; no re-trial API in Batch 28 |
| Owner sets plan | Owner dashboard `onSetPlan` sets `billingTier`, **clears** `trialEndsAt` / `trialPlan` (paid or partner deal) |
| Design partner | Owner sets `billingTier: growth` + coupon note — same as today, clears trial fields |

### New shared helper

`src/shared/plan-display.ts` (or `trial.ts`):

```typescript
export function isTrialActive(ws: { trialEndsAt?: string | null }): boolean;
export function trialDaysRemaining(ws: { trialEndsAt?: string | null }): number;
export function effectiveBillingTier(ws: Workspace): PlanTierId;
```

Replace direct `billingTierFromWorkspace` in **limits + usage + warnings** paths with `effectiveBillingTier`. Keep `billingTierFromWorkspace` for “subscribed tier” display on account.

### Backend — workspace create

On `POST /v2/workspaces`:

```javascript
const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
rec.plan = "starter";
rec.billingTier = "starter";           // post-trial default
rec.trialPlan = "growth";
rec.trialEndsAt = trialEnd;
// features unchanged — sessionLogDownload still ENG-37 (Batch 29)
```

Return `trialEndsAt`, `trialPlan`, `billingTier` in workspace JSON.

**Lambda:** Same logic in `handlers/v2-workspaces.mjs` + DynamoDB attribute migration (additive; no backfill required — existing workspaces = no trial).

### Trial expiry (MVP — no cron)

**Lazy expiry on read:** usage API and workspace fetch compute effective tier from `trialEndsAt` vs `Date.now()`. No background job in Batch 28.

Optional **PATCH** on first request after expiry: clear `trialPlan`, leave `billingTier: starter` (idempotent).

### Frontend UX

| Surface | Change |
|---------|--------|
| **Account** (`account-page.ts`) | Plan row: “Growth trial (12 days left)” or “Starter (trial ended)” |
| **Admin dashboard** | Banner: `Growth trial — X days left · Upgrade or continue on Starter $5/mo after trial` |
| **Onboarding** (`auth-onboard.ts` / get-started) | Perk line: “14-day Growth trial active” after create |
| **Owner dashboard** | Show trial end date + clear-trial when setting plan |
| **Marketing/pricing** | No copy change if behavior matches |

### Files to touch (ENG-36)

| File | Change |
|------|--------|
| `src/shared/tenant.ts` | `trialEndsAt`, `trialPlan` on `Workspace` |
| `src/shared/plan-display.ts` | `effectiveBillingTier`, trial helpers |
| `src/shared/plan-limits.ts` | Use `effectiveBillingTier` in `limitsForWorkspace`, `usageWarnings` |
| `plugins/atlas-saas-api.ts` | Create + read + owner plan PATCH clears trial |
| `src/data/usage-api.ts` / usage handler | Effective tier for limits in response |
| `src/ui/account-page.ts` | Trial status display |
| `src/ui/admin-dashboard.ts` | Trial banner |
| `src/ui/owner-dashboard.ts` | Trial fields in workspace table |
| `src/data/platform-api.ts` | Pass trial clear on `platformSetWorkspacePlan` |
| Lambda `v2-workspaces.mjs`, `v2-usage.mjs`, platform handler | Mirror dev plugin |

### Out of scope (Batch 29)

- **ENG-37** — Auto-enable `sessionLogDownload` for Growth/trial (separate)  
- **BILL-1** — Stripe checkout at trial end  
- **BILL-2 / ENG-38** — Hard limit enforcement  
- Email reminders (“3 days left on trial”)  
- Re-trial / second workspace trial abuse prevention beyond one trial per workspace  

---

## QA gate (Evidence Collector + manual)

### LEG-1

- [ ] Signup blocked without terms checkbox  
- [ ] Terms/Privacy open from signup and auth footer  
- [ ] Counsel markdown files exist and match in-app effective date  
- [ ] Entity name visible in Terms/Privacy  

### ENG-36

- [ ] Dev: create workspace → usage limits = **Growth** (100 models / 5000 sessions)  
- [ ] Account shows trial countdown  
- [ ] Admin banner shows trial  
- [ ] Owner sets Launch/Growth → trial cleared; limits match owner tier  
- [ ] Simulated expiry (`trialEndsAt` in past) → limits = **Starter**  
- [ ] SAL-3 training slide 8 claim matches prod behavior  
- [ ] `npm run build` passes  

### Device (spot-check)

- [ ] Signup → onboard → upload → AR session still works on trial workspace  

---

## NEXUS-Sprint agent assignments

| Order | Agent | Deliverable |
|-------|-------|-------------|
| 1 | **Agents Orchestrator** | This scope doc → task split |
| 2 | **Frontend** | LEG-1 signup/auth UI + ENG-36 account/admin/owner display |
| 3 | **Backend / Full-stack** | Schema + create + effective tier + Lambda parity |
| 4 | **Technical Writer** | `docs/atlas-ar/legal/*.md` export + README |
| 5 | **Evidence Collector** | QA checklist above |
| 6 | **User gate** | Confirm → `BATCH-28-CONFIRMED.md` · backlog LEG-1 + ENG-36 → done |

---

## Deploy checklist

1. **Lambda redeploy** — workspace create + usage effective tier + platform plan PATCH  
2. **Amplify redeploy** — frontend trial UI + signup checkbox  
3. **Smoke** — new signup on staging/prod gets Growth limits without owner action  
4. **Sales note** — update [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md) row “14-day Growth trial” → **Ready** after confirm  

---

## Effort estimate

| Workstream | Size |
|------------|------|
| LEG-1 UI + markdown export | **S** (~0.5 day) |
| ENG-36 schema + effective tier + create | **M** (~1 day) |
| ENG-36 UI surfaces + owner clear | **S** (~0.5 day) |
| Lambda parity + deploy + QA | **M** (~0.5–1 day) |
| **Total** | **~2–3 days** |

---

## After Batch 28

| Batch | Focus |
|-------|-------|
| **29** | BILL-1 Stripe + ENG-37 plan-gated JSON log + BILL-3 overage |
| **30** | ENG-38 hard limits + PM-3 storage copy align |

---

## Related docs

- [backlog.md](./backlog.md) · [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md)  
- [PRICING.md](./PRICING.md) § Engineering spec (trial state)  
- [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md) (SAL-3 trial promise)  
- [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md) (entity name)
