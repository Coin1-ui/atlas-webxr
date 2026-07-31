# Atlas AR — Launch readiness (2026-07-31)

**Agents:** Orchestrator · Reality Checker · Evidence Collector · Sales ops  
**Sources:** Project memory · backlog · PRICING-FEATURE-READINESS · live `/health` · QA-5 / SEO notes  
**Live API:** `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health`  
**Product:** `https://www.atlasar.in`

---

## Verdict

| Launch type | Readiness | Meaning |
|-------------|-----------|---------|
| **MVP soft launch** — design partners / Founding 10 / manual ops | **GO WITH CAVEATS** | Core loop works on prod; sell with owner coupons + sales@; do not over-promise Scale features |
| **Full self-serve public GTM** — automated paid checkout at scale | **NOT READY** | BILL-1 Zoho/India cutover incomplete; BILL-4 annual on_hold; no pen test |

**Bottom line:** You can run **outreach + pilots today** if caveats below are accepted. Do **not** claim “fully automated self-serve SaaS at Scale.”

---

## READY (MVP must-haves) — PASS

- **QA-5 PASS** — signup → upload → floor placement ≤15 min on prod (Batch 35)
- **Auth / tenant / branded `/w/{slug}`**
- **Android WebXR + iOS Quick Look**
- **14-day Growth trial** (ENG-36)
- **Plan gates / session log Growth+** (ENG-37); MKT-7 copy aligned
- **SEO-1** — GSC + Bing sitemap Success; Request indexing for core + `/learn*`
- **SEO-2 Batches 1–3** — prerender + OG + `/learn` hub live PASS (host-split deferred ≠ blocker)
- **Contacts** — support@ / sales@ live receiving
- **Ops docs** — SAL-4 DP · SAL-5 Scale · SERVICES-1 modeling · OPS-SCALE-1 Owner Scale CTA
- **PM-4** — false admin-seat claims removed
- **BILL-2 / ENG-38** — model + storage hard-block at limit (sessions soft-allow + meters)

---

## CAVEATS (must accept or fix before paid traffic)

| ID | Issue | Severity | Action |
|----|--------|----------|--------|
| **OPS-INGEST** | Live `/health` (2026-07-31 probe): `sandboxDodoIngest: true`, `sandboxUsageSeed: true` | **P0 ops** | Founder: set `ATLAS_SANDBOX_DODO_INGEST=false` (and usage-seed flags off) on atlas-api Lambda — see [OPS-SANDBOX-INGEST-OFF.md](./OPS-SANDBOX-INGEST-OFF.md) |
| **MKT-3b** | Demo A1/B1 mp4s missing; landing empty-state | P1 marketing | Record/drop mp4s or launch without “Watch product demo” |
| **BILL-1** | Self-serve checkout not closed for India/Zoho | P1 for GTM | Soft launch = owner coupon + manual invoice OK |
| **Scale tier** | SSO / custom domain / multi-workspace **Not built** | Sales risk | Use [SAL-5-SCALE-OPS.md](./SAL-5-SCALE-OPS.md); do not promise ENG-20/21/39 |
| **Sessions** | Soft-allow + meters (not hard kill switch) | Sales honesty | Do not claim hard session cut-off |

---

## NOT REQUIRED for soft launch (park)

- SEO-2 host-split · BILL-4 annual SKUs · SEC-2 pen test · ENG-20/21/39/40 · picking 3 DP targets (founder ops)

---

## Founder checklist before flipping “we’re live”

1. Confirm Lambda env: **sandbox Dodo ingest = false** ([OPS-SANDBOX-INGEST-OFF.md](./OPS-SANDBOX-INGEST-OFF.md)) — probe `/health` until `sandboxDodoIngest: false`
2. Pick **3** leads from [LEAD-SHEET-2026-07-31.md](./LEAD-SHEET-2026-07-31.md); send SAL-2 from **sales@atlasar.in**
3. Time first placement on kickoff (≤15 min)
4. Optional: drop MKT-3b mp4s in `public/marketing/`
5. Do not sell Scale features that are Not built

---

## Related

- [PRICING-FEATURE-READINESS.md](./PRICING-FEATURE-READINESS.md) (refreshed 2026-07-31)  
- [backlog.md](./backlog.md) · [SAL-2](./SAL-2-DESIGN-PARTNER-OUTREACH.md) · [SAL-4](./SAL-4-DESIGN-PARTNER-OPS.md) · [SAL-5](./SAL-5-SCALE-OPS.md)
