# Atlas AR — Sales playbook (MiroFish-informed)

**Source:** [mirofish/PREDICTION-REPORT.md](./mirofish/PREDICTION-REPORT.md) · [mirofish/LIVE-REPORT-EN.md](./mirofish/LIVE-REPORT-EN.md) · **ICP:** [ICP.md](./ICP.md)  
**Live run:** `sim_4fa4b86a352a` · Report `report_2796d7237aa1` (2026-06-17)

---

## Win theme

> **Same floor AR outcome as showroom incumbents — self-serve in an afternoon, from $5/mo, no per-seat tax on field reps.**

---

## Live sim: objection frequency (use in discovery)

| Objection theme | ~Weight in sim | First response |
|-----------------|----------------|----------------|
| Too complex / unclear value | 30% | `/demo` + one SKU on their floor in &lt;10 min |
| Launch/Growth too expensive | 25% | $5 Starter → $59 Launch vs $99–450 showroom SaaS |
| Feels non-interactive / viewer-only | 20% | Floor lock, shareable link, field + showroom workspace |
| Security & privacy | Late stage | IT one-pager: tenant isolation, HTTPS, no shopper login |
| CFO cost-benefit | Budget gate | One avoided $2k return ≈ 34 months of Launch |

**18-month $500k ARR probability (live sim): ~42%** — position as ambitious but plausible with retail wedge + founding offer.

---

## Tier timing (when to pitch what)

| Month | Lead with | Buyer |
|-------|-----------|-------|
| 1–3 | **Starter $5** | Retail e-comm, solo merchants, “try one SKU” |
| 4+ | **Launch $59** | Field sales teams, multi-store retail |
| 6+ | **Growth $179** | IT/security sign-off, showroom migration, Shopify Plus |

---

## Persona talk tracks

### Elena — Head of e-commerce (retail ICP)

**Pain:** Returns citing wrong size; associates embarrassed by bad AR.

**Pitch:** Upload catalog once → QR on tags → customer places sofa at true scale in Chrome/Safari. No app store.

**Proof to show:** Live `/demo` + your `/w/{slug}` + “cyan ring = floor” screenshot.

**Close:** 14-day Growth trial → Launch $59 or Founding 10 (Growth @ $59 × 12 mo).

**Objection:** “We tried AR and it floated.”  
**Response:** “Atlas locks to floor planes, not tables — session-tuned placement. Try one SKU on your phone in 2 minutes on our demo.”

**Objection (live sim):** “AR seems too complex for our team.”  
**Response:** “Admin is PC-only upload once; associates and shoppers only open a link. Most pilots place the first model in under 15 minutes — we’ll time it on this call.”

---

### Marcus — VP Sales (field ICP)

**Pain:** Custom AR quotes stall in IT; reps use PDFs.

**Pitch:** Branded `/w/your-brand` link, curated SKUs, session analytics for ops. Unlimited reps.

**Proof:** Admin uploads approved models; rep shares link on-site.

**Close:** Starter $5 pilot one product line → Launch when catalog grows.

**Objection:** “Reps won’t adopt.”  
**Response:** “No install — link in email or SMS. You control catalog centrally on PC; reps only share and view.”

---

### Priya — IT / security

**Checklist to send:**
- HTTPS-only customer links
- Tenant-isolated S3 prefixes + workspace IDs
- Cognito auth for admin; shoppers need no account
- No native app = no store MDM rollout

**Objection:** “WebXR isn’t enterprise.”  
**Response:** “Shopper path is browser-only Quick Look / WebXR — no device agent. Admin is standard OAuth/JWT to our API.”

**Objection (live sim):** “We need clarity on data privacy before pilot.”  
**Response:** “Shoppers never create accounts; sessions are workspace-scoped. We’ll send tenant isolation + HTTPS-only links. Happy to walk your security reviewer through admin vs customer data paths.”

---

### David — Incumbent showroom SaaS ($99–450/mo)

**Objection:** “We already pay for 3D viewer.”  
**Response:** “Viewer embeds one site. Atlas is a **workspace**: white-label link, field reps, analytics, unlimited viewers. Launch is **$59 self-serve** vs. demo-gated contracts.”

**Migration offer:** Founding 10 + free onboarding call for first catalog import.

**Objection (live sim):** “Launch/Growth still cost too much.”  
**Response:** “Start at **$5/mo** for one workspace — prove floor placement before you commit to Launch. Founding customers get **Growth at Launch price ($59)** for 12 months if you join the first 10.”

---

### Lisa — Shopify merchant

**Pain:** Wants embed-only; not a full workspace.

**Objection:** “I just need a Shopify iframe.”  
**Response:** “Atlas is a **branded workspace** — same link for PDP, email, and field reps. If you only need one embed with no white-label, a plugin may fit; if associates share AR outside the store, you need a workspace.”

**When to walk:** Buyer refuses any workspace model — see anti-ICP below.

---

### Ana — CFO

**ROI frame (use their numbers):**
- One avoided return on a $2k sofa ≈ 34 months of Launch
- Associate time saved vs. measuring room manually
- No per-seat fees vs. rep-count pricing

**Pilot structure:** 90 days Launch, success = ≥50 AR sessions/mo with ≥1 placement each.

**Objection (live sim):** “We need cost-benefit before AR budget.”  
**Response:** “Pilot success = measurable sessions + placements in 90 days. One size-related return avoided on a $2k sofa pays for Launch for nearly three years. We’ll agree the metric before trial starts.”

---

### Competitor PM (internal — month 9 injection)

**Expected move:** Bundled onboarding calls + “enterprise security” FUD on WebXR.

**Counter:** Price-sensitive pilots stay if **tenant isolation + HTTPS** are visible on landing; don’t over-promise SOC2 on first call — offer security FAQ + roadmap honesty.

---

## Discovery questions (MEDDPICC-lite)

1. How many SKUs need AR in the next 90 days?
2. Who uploads 3D today (agency, internal, supplier GLBs)?
3. Android vs iPhone mix for end users?
4. Current return rate on size-related claims?
5. Existing 3D/AR spend line item?
6. **Who owns security review** — and what would “pass” look like? *(live sim late-stage gate)*
7. **What would prove value in the first 10 minutes** of a trial? *(complexity objection)*

---

## Pilot close checklist

- [ ] Decision maker + technical owner on call
- [ ] 3–10 GLBs ready (or sample from demo catalog)
- [ ] Success metric agreed (sessions, placements, or return proxy)
- [ ] Trial end date + Launch vs Growth tier pre-agreed
- [ ] Customer link live on one touchpoint (QR, email, PDP)

---

## Competitive anchors (no competitor names in customer decks)

| They say | You say |
|----------|---------|
| Single-store plugin $10–65/mo | “Plugin = one embed. We’re a branded workspace for stores **and** field teams.” |
| Showroom SaaS $99–450/mo | “Same placement outcome, **$59 Launch**, no sales gate.” |
| Custom AR $100k+ | “Live this week under **$2k/year** — not a 12-month build.” |
| “Demo feels like a passive viewer” | “Shoppers **place on their floor** — cyan ring = floor lock. Not a spinning widget.” |

---

## QA handoff (what sales promises must work)

Before promising a pilot close, confirm with QA/dev:

- [ ] Signup → first floor placement ≤15 min (desktop admin + phone AR)
- [ ] Security/privacy language matches [Priya checklist](#priya--it--security) above
- [ ] iOS gets Quick Look path; Android gets WebXR Start AR
- [ ] Pricing page + signed-in nav show **Open dashboard** for evaluators

See [MIROFISH-QA-SCENARIOS.md](./mirofish/MIROFISH-QA-SCENARIOS.md).

---

## When to walk away (anti-ICP)

- Native iOS app-only requirement
- Shared multi-user AR session in one room
- Game / VFX pipeline
- Buyer only wants Shopify iframe with zero workspace
