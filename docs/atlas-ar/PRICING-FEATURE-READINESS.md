# Pricing feature readiness audit

**Date:** 2026-05-21  
**Purpose:** Verify every service listed on the pricing page and in [PRICING.md](./PRICING.md) is **ready to use** before SAL-2 design-partner outreach and paid pilots.  
**Sources:** [marketing-pricing.ts](../../src/ui/marketing-pricing.ts) · [plan-limits.ts](../../src/shared/plan-limits.ts) · codebase review · [MiroFish PREDICTION-REPORT.md](./mirofish/PREDICTION-REPORT.md)

---

## Executive summary

| Verdict | Detail |
|---------|--------|
| **Pilot-ready (Starter → Growth core AR)** | ✅ Signup, upload, branded link, Android WebXR floor AR, iOS Quick Look, branding, usage tracking, admin onboarding |
| **Sell with manual ops** | Founding 10 / design-partner pricing (owner sets plan + coupon); JSON session log is **on by default for Growth+** (ENG-37; owner can override) |
| **Self-serve trial** | ✅ 14-day Growth trial on workspace create ([ENG-36](./BATCH-28-CONFIRMED.md)) |
| **Do not promise as self-serve yet** | Scale tier (SSO, custom domain, multi-workspace), SLA support, annual SKUs |

**MiroFish alignment:** ~30% “too complex” and ~25% “too expensive” objections — only close design partners when you can **time first placement on the call** (≤15 min) and set **Starter $5** or **Growth @ $59 founding** via owner dashboard.

---

## Tier-by-tier matrix

Legend: **Ready** = customer can use today without you intervening · **Partial** = works with limits or manual setup · **Not built** = do not promise in outreach

### Starter ($5/mo)

| Promised feature | Status | Evidence / notes |
|------------------|--------|------------------|
| 1 workspace | **Ready** | One workspace per signup |
| 5 GLB models | **Partial** | Limits tracked + warnings at 80%/100%; **upload not hard-blocked** ([plan-limits.ts](../../src/shared/plan-limits.ts)) |
| 100 AR sessions / model / mo | **Partial** | Session counted on `session_end` + ≥1 placement; workspace cap = model slots × 100; warnings only |
| Unlimited shoppers & reps | **Ready** | No seat metering |
| Browser AR + 3D inspect (Chrome & Safari) | **Ready** | WebXR + Quick Look + object mode |
| Branded `/w/your-brand` | **Ready** | Slug routing + theme |
| Email support (72h) | **Partial** | **support@atlasar.in live** (inbox receiving) — process OK; no in-app SLA timer |
| Overage (+$5/100 sessions pack guide, etc.) | **Ready** | Dodo hybrid meters auto-bill each payment cycle; Account estimate is a pack guide (not `/charge`) — [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md) · [PRICING.md](./PRICING.md) |

### Launch ($59/mo)

| Promised feature | Status | Evidence / notes |
|------------------|--------|------------------|
| 30 models · 3,000 sessions (100/model) | **Partial** | Same warn-only enforcement |
| Full white-label customer UI | **Ready** | Logo, accent, exit URL, branded catalog |
| Usage dashboard (models · sessions · storage) | **Ready** | Admin / Account usage panel. **Not** per-model funnel UI — copy aligned **MKT-7** |
| 2 admin seats (PRICING.md) | **Not built** | No admin-seat limit in product; any workspace member with admin role works |

### Growth ($179/mo)

| Promised feature | Status | Evidence / notes |
|------------------|--------|------------------|
| 100 models · 10,000 sessions (100/model) | **Partial** | Warn-only |
| JSON session log download | **Ready** | `sessionLogDownload` **on by default for Growth+** ([ENG-37](./backlog.md)); owner can override. Not a CSV/sales-ops dashboard — **MKT-7** |
| Custom logo & accent | **Ready** | Admin branding |
| Priority email (24h) | **Partial** | Operational promise only |
| 10 admin seats (PRICING.md) | **Not built** | Same as Launch |

### Scale (from $499/mo)

| Promised feature | Status |
|------------------|--------|
| Multiple workspaces & catalogs | **Not built** (single workspace per account) |
| Custom session tiers & SSO | **Not built** (ENG-21 SAML todo) |
| Dedicated CSM & SLA | **Not built** |
| Custom domain | **Not built** (ENG-20 todo) |
| Volume session pricing | **Manual** (sales/owner) |
| Analytics API | **Not built** |

---

## Cross-tier promises (pricing page & FAQ)

| Promise | Status | Sales guidance |
|---------|--------|----------------|
| **14-day Growth trial, no card** | **Ready** | Auto on workspace create; Growth limits 14 days · [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md) |
| **Annual prepay 20% off** | **Not built** | Quote manually; no Stripe annual SKU |
| **Founding 10 — Growth @ $59 × 12 mo** | **Partial** | Create coupon in owner dashboard + set plan; invoice manually until Stripe |
| **Design partner — 90-day Growth @ Launch** | **Partial** | Same; document in [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md) |
| **Self-serve paid checkout** | **Not built** | BILL-1 Stripe todo; upgrades queue API or noop in dev |
| **Hard limit enforcement** | **Not built** | PRICING.md: “MVP soft warnings”; do not promise hard cut-off unless owner restricts account |
| **Storage limits** | **Done** | Aligned; max **50 MB** per GLB/USDZ on all plans; storage = models × 50 MB × 2.5 → Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB ([plan-limits.ts](../../src/shared/plan-limits.ts)), matching PRICING.md |

---

## Core product flows (MiroFish QA gate)

From [SALES-PLAYBOOK.md](./SALES-PLAYBOOK.md) · [MIROFISH-QA-SCENARIOS.md](./mirofish/MIROFISH-QA-SCENARIOS.md):

| Flow | Ready? | Notes |
|------|--------|-------|
| Signup → upload GLB → share link | **Ready** | `/admin/get-started` onboarding |
| Android Chrome floor AR | **Ready** | Start AR + floor lock |
| iOS Safari Quick Look | **Ready** | “View in AR” — train staff, not “Start AR” |
| Session analytics event → API | **Ready** | When API deployed |
| Security story on site | **Ready** | Landing + `/about` |
| First placement ≤15 min | **PASS** | **QA-5** closed 2026-07-31 — guided prod placement ≤15 min |
| Dimension overlay on custom GLB | **Ready** | ENG-34 shipped; verify on device post-deploy |

---

## What to sell in SAL-2 outreach (safe list)

**Lead with these (all ready):**

1. Branded browser floor AR — Chrome + Safari, no app install  
2. Upload GLB on PC → share one link (QR, SMS, email)  
3. Unlimited viewers and field reps  
4. Starter **$5/mo** pilot or **live demo** at `/demo`  
5. 14-day **Growth limits** (you enable manually)  
6. Founding / design-partner **$59/mo Growth** (manual coupon + plan)

**Qualify before promising:**

- “JSON session log” → Growth default on; enable toggle only for Launch or if owner turned it off  
- “Usage / basic analytics” → show admin usage panel (models · sessions · storage)  
- Overage billing → **Dodo meters** with subscription payment cycle (Account estimate is a guide)  
- Scale / SSO / custom domain → **contact sales, roadmap**
- Per-model funnel analytics → **not built** (deferred)

**Do not offer in self-serve outreach:**

- Multi-workspace Scale  
- Per-seat admin licensing (not implemented)

---

## Recommended fixes (post–SAL-2, pre-scale sales)

| Priority | Item | Owner |
|----------|------|-------|
| P0 | Auto-provision 14-day Growth trial on signup (or post-verify) | ENG | **ENG-36** ✅ |
| P0 | Tie `sessionLogDownload` to Growth tier by default | ENG | **ENG-37** ✅ |
| P2 | Analytics copy alignment (usage vs JSON log) | MKT | **MKT-7** ✅ (2026-07-31) |
| P1 | Hard-block upload at model limit (or clear UX when over) | ENG | **ENG-38** · **BILL-2** |
| P1 | Align storage numbers: PRICING.md vs `plan-limits.ts` | PM | **PM-3** |
| P1 | Dodo + Zoho self-serve checkout | BILL | **BILL-1** |
| P1 | Overage via Dodo meters (done) | BILL | **BILL-3** ✅ · [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md) |
| P2 | Admin seat limits or remove from PRICING.md | PM | **PM-4** |
| P2 | Annual prepay SKUs | BILL | **BILL-4** |

---

## Related docs

- [PRICING.md](./PRICING.md) · [marketing-pricing.ts](../../src/ui/marketing-pricing.ts)  
- [backlog.md](./backlog.md) — **ENG-36–40, BILL-1–4, PM-3/4, QA-5 ✅, MKT-7 ✅, MKT-3b, SAL-4**  
- **MVP P0 (2026-07-31):** no open MVP ship blockers; **BILL-1** remains on_hold (P0-for-scale) |
- [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md)  
- [BATCH-25-CONFIRMED.md](./BATCH-25-CONFIRMED.md) · [sales-deck/PRESENTER-SCRIPT.md](./sales-deck/PRESENTER-SCRIPT.md)  
- [SALES-PLAYBOOK.md](./SALES-PLAYBOOK.md) · [mirofish/PREDICTION-REPORT.md](./mirofish/PREDICTION-REPORT.md)
