# Atlas AR — MiroFish-style success prediction report

**Method:** Swarm simulation specification aligned with [MiroFish](https://github.com/666ghj/MiroFish) workflow (seed → graph → multi-agent social evolution → report).  
**Seed:** [SEED-ATLAS-AR.md](./SEED-ATLAS-AR.md)  
**Run date:** 2026-06-16 (spec) · **Live run 1:** 2026-06-17 (`sim_4fa4b86a352a`) · **Live run 2:** 2026-06-18 (`sim_e6b7b440cb5a`, UI/UX scope)  
**Live report (EN):** [LIVE-REPORT-EN.md](./LIVE-REPORT-EN.md) · **Run 2 artifact:** [runs/2026-06-18T16-26-48-673Z](./runs/2026-06-18T16-26-48-673Z/) · **Run 1 artifact:** [runs/2026-06-17T14-06-45-424Z](./runs/2026-06-17T14-06-45-424Z/)

---

## Executive summary

| Outcome | Probability (12 mo) | Confidence | Live run note |
|---------|---------------------|------------|---------------|
| **Sustainable product** (≥30 paying workspaces, <8% monthly churn) | **71%** | Medium | Unchanged |
| **Retail-led wedge wins** (≥60% of revenue from ICP 1) | **68%** | Medium | Live sim: furniture retail ICP explicit in graph |
| **Field sales meaningful** (≥15% of revenue from ICP 2) | **54%** | Low–medium | Launch tier ramp from **month 4** in live report |
| **$500k ARR within 18 months** | **40%** | Low | Live report **42%**; spec **38%** — use **~40%** in decks |
| **Failure mode:** stall at free/demo usage, no paid conversion | **22%** | Medium | Live adds “complexity / no ROI story” as top stall reason |

**Verdict:** Atlas AR has a **credible path to success** if GTM doubles down on **retail pilots with provable 10-minute onboarding** and treats field sales as a **month-6 expansion** motion, not day-one hero.

**Live MiroFish merge (2026-06-17):** Full engine run completed (Gemini simulation + local Ollama report). See [LIVE-REPORT-EN.md](./LIVE-REPORT-EN.md). Key additions: **security/privacy** as late-stage blocker, **~30% complexity objection**, **~25% price objection**, tier timing **Starter M1–3 → Launch M4+ → Growth M6+**.

**Live run 2 merge (2026-06-18):** Second 40-round sim (`sim_e6b7b440cb5a`) scoped **UI/UX + owner toggles + marketing story**. Ollama report **partial** (section 2 tool-call failure); English synthesis in [runs/2026-06-18T16-26-48-673Z/LIVE-REPORT-EN.md](./runs/2026-06-18T16-26-48-673Z/LIVE-REPORT-EN.md). Confirms **persona-tier messaging** and **UX-as-conversion** (dock, onboarding, dimensions, catalog CTA). **$500k ARR @ 18 mo unchanged at ~40%.** NEXUS-Sprint close-out: [backlog.md](../backlog.md) Batch 7.

---

## Simulated agent consensus (round 40)

### What accelerates adoption

1. **$5 Starter + live `/demo`** — Elena and Jordan agents treat this as low-risk proof; Marcus still waits for admin case study.
2. **“No app install” + floor scale** — strongest message across retail and shopper agents; repeated in 78% of positive threads.
3. **Unlimited viewers/reps** — Marcus and Ana agents cite this vs. per-seat showroom tools.
4. **Self-serve signup** — beats demo-gated incumbents (David agent switches only after migration checklist exists).
5. **Founding offer (Growth @ Launch price)** — CFO Ana agent approves 12-month lock-in for 2–3 store pilot.

### What blocks adoption

1. **“Who uploads GLBs and how long?”** — #1 drop-off if not answered above the fold (predicted 34% trial abandon).
2. **“Too complex / no clear value”** — **~30%** in live sim social feedback; overlaps with upload/onboarding friction.
3. **iOS vs Android path confusion** — Jordan agent on iOS succeeds; Elena’s store staff fails if training says “Start AR” on iPhone.
4. **Desktop-only admin** — Marcus’s reps on phone cannot fix catalog; needs clear “PC admin, phone AR” diagram.
5. **Security & privacy (late stage)** — live sim: IT and showroom buyers block without data-handling story.
6. **Launch/Growth “still expensive”** — **~25%** price objection in live sim; counter with $5 Starter + $59 Launch anchors.
7. **Weak interactivity / viewer-only perception** — **~20%** in live sim; counter with floor lock + shareable workspace link.
8. **No published ROI number** — Ana agent delays budget until case study or calculator.
9. **Plugin comparison** — Lisa agent churns early (“I just need Shopify embed”); needs explicit “workspace vs plugin” copy.

### Competitor reaction (month 9 injection)

David and Competitor PM agents respond with **bundled onboarding calls** and **“enterprise security” FUD on WebXR**. Atlas retains price-sensitive pilots if **tenant isolation + HTTPS** are visible on landing.

---

## 12-month customer forecast (simulated distribution)

| Scenario | Paying workspaces @ M12 | ARR range |
|----------|-------------------------|-----------|
| Bear (22%) | 8–18 | $15k–$45k |
| Base (50%) | 35–65 | $80k–$180k |
| Bull (28%) | 70–120 | $200k–$420k |

**Most likely base case:** ~**48 paying workspaces**, ~**$110k ARR**, blended **$190/mo** after Starter → Launch upgrades.

**Live run tier timing (directional):** Starter-heavy **months 1–3** (retail e-comm, small merchants) → **Launch from month 4** (field sales, larger retail) → **Growth from month 6** (IT-led, showroom migrations, Shopify Plus–type accounts).

---

## ICP wedge recommendation

| Priority | ICP | Why |
|----------|-----|-----|
| **1** | Regional furniture / home retail | Faster self-serve trial, clear ROI (returns), aligns with $5–$59 entry |
| **2** | DTC sofa/bed brands | Same motion, smaller sales cycle than field sales |
| **3** | B2B field sales (fixtures, equipment) | Higher ACV but needs proof assets + IT checklist |

---

## Top 5 objections (sales)

1. “We tried AR — models floated / wrong scale.” *(live: “too complex / no value” ~30%)*
2. “Our IT won’t approve — security and privacy aren’t clear.” *(live: late-stage blocker)*
3. “Launch/Growth still feel expensive.” *(live: ~25%)*
4. “We already pay for a 3D viewer — why switch?”
5. “Who maintains the 3D catalog?” / “What happens on iPhones vs Android?”

→ Handled in [SALES-PLAYBOOK.md](../SALES-PLAYBOOK.md) · Live quotes in [LIVE-REPORT-EN.md](./LIVE-REPORT-EN.md)

---

## Product UX conversion killers (QA priority)

| Rank | Friction | Predicted impact | Test priority | Live run |
|------|----------|------------------|---------------|----------|
| 1 | First AR placement >15 min after signup | −28% trial conversion | P0 | “Too complex” #1 |
| 2 | Wrong CTA on iOS (WebXR vs Safari AR) | −19% shopper success | P0 | Trust break on iOS path |
| 3 | Empty catalog / broken GLB | −15% showroom bounce | P0 | — |
| 4 | No security/privacy story on site | −12% late-stage deals | P0 | **New from live sim** |
| 5 | Mobile user cannot find Account/billing | −8% upgrade | P1 | — |
| 6 | Overage surprise without in-app warning | −12% churn at renewal | P1 | — |
| 7 | AR feels non-interactive / viewer-only | −10% eval completion | P1 | **~20% live objection** · run 2: dimensions + dock |

→ Scenarios in [MIROFISH-QA-SCENARIOS.md](./MIROFISH-QA-SCENARIOS.md)

---

## Recommended changes (implemented)

### Marketing

- [x] Objection-buster section on landing (“Pass the buying committee”)
- [x] Outcome stats strip from simulation (time-to-live, no per-seat, price anchor)
- [x] Explicit workspace-vs-plugin callout in copy
- [x] iOS/Android path clarity in trust row

### Sales

- [x] [SALES-PLAYBOOK.md](../SALES-PLAYBOOK.md) with persona-specific talk tracks
- [x] Founding offer script + pilot close checklist

### Product / QA

- [x] [MIROFISH-QA-SCENARIOS.md](./MIROFISH-QA-SCENARIOS.md) — prediction-driven test matrix
- [x] E2E smoke for `/about` and signed-in `/account` routes
- [x] MF-1 guided onboarding (`/admin/get-started`) — upload → share → preview checklist
- [x] Landing “Who uploads GLBs?” FAQ + PC admin → phone AR diagram + ROI strip
- [x] Empty showroom state with setup guidance (MF-4)

---

## Re-run with live MiroFish

**Latest completed:** 2026-06-18 · `sim_e6b7b440cb5a` · report `report_b697138997db` · [CHECKPOINT](./runs/CHECKPOINT-live-run.json)

Report-only (Ollama):

```powershell
npm run mirofish:ollama-report
```

Full pipeline:

```powershell
npm run mirofish:multi
```

Outputs land in `docs/atlas-ar/mirofish/runs/{timestamp}/`. English synthesis: update [LIVE-REPORT-EN.md](./LIVE-REPORT-EN.md) and merge [PREDICTION-REPORT.md](./PREDICTION-REPORT.md) per NEXUS-Sprint Batch 7 in [backlog.md](../backlog.md).

---

## Appendix: persona vote (simulated)

| Persona | Buy / adopt @ M6 | Plan tier |
|---------|------------------|-----------|
| Elena (retail e-comm) | Yes | Launch → Growth |
| Marcus (field VP) | Pilot only | Starter |
| Priya (IT) | Conditional yes | Launch + security FAQ |
| David (incumbent) | No → yes @ M9 | Launch after migration doc |
| Lisa (Shopify) | No | Wrong product |
| Jordan (shopper) | N/A | Drives retail ROI story |
| Ana (CFO) | Yes @ M4 | Launch annual |
| Competitor PM | N/A | Forces onboarding counter-offer |
