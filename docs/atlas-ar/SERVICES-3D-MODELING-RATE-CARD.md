# Atlas AR — 3D modeling services rate card

**Product:** Omni Manual / Atlas AR professional services (optional add-on)  
**Quote / invoice:** **sales@atlasar.in** (not self-serve SaaS checkout)  
**Related SaaS limits:** [PRICING.md](./PRICING.md) — max **50 MB** per GLB/USDZ; storage = models × 50 MB × 2.5  
**Status:** Rate card locked 2026-07-31 · backlog **SERVICES-1**

---

## How we charge (locked)

**Charge by complexity tier + job type + variants** — not “$X per 1,000 polygons.”

| Axis | What it means |
|------|----------------|
| **Job type** | Optimize existing CAD/high-poly · or create from photos/dims + PBR |
| **Complexity** | Simple hard-surface · standard furniture · complex / multi-part / soft goods |
| **Add-ons** | Extra fabric/finish variants · rush · multi-SKU packs |

**Poly count and PBR are delivery acceptance criteria**, not the primary price formula. Peers (Eyedex, Zebrar-style WebAR agencies, Reydar bands, furniture AR studios) quote fixed tiers the same way.

---

## Atlas AR delivery spec (every paid SKU)

| Spec | Target | Hard limit |
|------|--------|------------|
| Real-world scale | Meters, accurate to product dims | Required |
| Topology / UVs | Clean, atlas-friendly UVs | Required |
| PBR (metallic-roughness) | baseColor + metallicRoughness (+ normal; AO optional) | Required on Create + PBR |
| Triangle budget | **≤ 50K** preferred (Simple ≤ 25K) | Soft; Complex may approach ~65K with QA |
| GLB size | **≤ 5 MB** preferred | Atlas upload hard fail at **50 MB** |
| Formats | **GLB** primary | USDZ via Atlas client path or quoted export |
| Revisions | **2 rounds** on Standard quote | Extra rounds billed |

CAD / film / high-poly sources almost always need **retopo + bake**, not a raw export — price as **Optimize**, not free “conversion.”

---

## Public rate card (USD, services tax-exclusive)

India ops may quote INR equivalent at current FX. Margin target: **≥40%** after contractor cost.

| Tier | Examples | Poly / texture target | **Optimize existing** | **Create + PBR (from refs)** |
|------|----------|------------------------|------------------------|------------------------------|
| **A — Simple** | Side table, lamp, simple chair, boxy casegood | ≤25K tris · 1–2K PBR | **$99–$149** | **$199–$299** |
| **B — Standard furniture** | Sofa, bed, dining set, typical retail hero | ≤50K tris · 2K PBR | **$179–$249** | **$349–$499** |
| **C — Complex** | Tufted sofa, detailed appliances, many parts | ≤50–65K tris · 2K–4K bake | **$299–$449** | **$599–$999** |
| **Variant** | Extra fabric/finish (same mesh) | Texture set only | **$39–$79** each | same |
| **Pack** | 10+ SKUs same brief | Volume | **−15%** | **−15%** |
| **Rush** | &lt;5 business days | — | **+30%** | **+30%** |

### Quoting script (sales@)

1. Ask: photos? dims? CAD/high-poly? already GLB?  
2. Classify A / B / C + Optimize vs Create.  
3. Count variants (finishes).  
4. Send fixed quote + 2 revision rounds + delivery targets (tris / MB).  
5. Upload into customer Atlas workspace after QA on phone AR.

---

## Intake checklist (customer)

- [ ] Product name / SKU list  
- [ ] Ortho or clear photos (or CAD / existing 3D)  
- [ ] Overall dimensions (L × W × H) in mm or inches  
- [ ] Material notes (wood, fabric, metal, gloss)  
- [ ] Brand hex / finish names for variants  
- [ ] Deadline (standard vs rush)

---

## Market context (why these bands)

| Signal (2025–26) | Band |
|------------------|------|
| Furniture / catalog base models (Eyedex-style) | ~$180–$500 base · variants ~$20–$80 |
| AR-ready from existing 3D | ~$200–$500 / product |
| WebAR agency furniture tiers | ~$250 basic · ~$400–$540 detailed · $1k–$4k+ complex interiors |
| UK AR studio ladders | From ~£95 basic · £195–£395 mid · £795+ high |
| Budget CGI listings | As low as ~$35–$95 (quality variance — not our floor for hero retail) |

WebAR practice: **≤ ~50K tris** and **≤ ~4–5 MB** GLB for mid-range phones; PBR carries surface detail.

---

## Do not sell

- Unlimited free modeling bundled into SaaS plans  
- “Unlimited polygons” for browser AR  
- Admin-seat / per-rep modeling retainers without SKU caps  
- Confusing this card with [PRICING.md](./PRICING.md) subscription tiers or PM-4 admin seats

---

## Related

- SaaS pricing: [PRICING.md](./PRICING.md)  
- Outreach: [SAL-2-DESIGN-PARTNER-OUTREACH.md](./SAL-2-DESIGN-PARTNER-OUTREACH.md) · mailbox **sales@atlasar.in**  
- Leads: [LEAD-SHEET-2026-07-31.md](./LEAD-SHEET-2026-07-31.md)
