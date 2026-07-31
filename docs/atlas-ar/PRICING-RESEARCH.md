# Atlas AR — Market & sales pricing research (June 2026)

> **Internal use only.** Competitor names in this document are for sales research — do **not** appear on customer-facing UI, ads, or legal pages.
>
> **Rates & overage SoT (2026-07-23):** Customer pack rates and meter billing are defined in [PRICING.md](./PRICING.md) and [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md). Historical `$20/$15/$10` session packs and “invoice manually until Stripe” in this research doc are **superseded**.

**Orchestration:** Trend Researcher · FP&A Analyst · Deal Strategist · Product Manager  
**Goal:** Attractive, competitive pricing that drives **quick self-serve onboarding** without racing to the bottom on per-view fees.

---

## Executive summary

| Finding | Implication for Atlas AR |
|---------|--------------------------|
| Entry AR viewers cluster at **$10–$65/mo** (Shopify apps) | We are **not** a single-store plugin — don’t compete on $19 |
| Furniture / showroom SaaS clusters at **$99–$450/mo** (Zolak, Roomle) | **$59 Launch** and **$179 Growth** sit **below** mid-market incumbents |
| White-label WebAR runs **$249–$499/mo** (Blippar, SAMUAR) | **Unlimited field reps** + tenant workspace is our wedge vs per-project fees |
| Custom AR apps = **$80k–$500k** build | Anchor enterprise value: “1% of a custom build” |
| 8th Wall commercial hosting **shut down Feb 2026** | Displaced WebAR buyers need **hosted, no-code** replacement |
| **14-day no-card trial** = PLG standard (62% of B2B SaaS) | Required for quick onboarding at sub-$2k ACV |
| Median trial→paid **18.5%**; top quartile **35–45%** with fast activation | Price + **time-to-first-AR-placement** matter more than feature lists |

**Recommended go-to-market price (v2):** Launch **$59/mo incl. tax** · Growth **$179/mo incl. tax** · Scale **custom from $499/mo** · **14-day Growth trial, no credit card** · **Founding 10: Growth at Launch price for 12 months**. Published plan list prices are **tax-inclusive**.

---

## Competitive landscape (June 2026)

### Tier A — E-commerce / Shopify AR (low ACV, single store)

| Vendor | Starting price | Model cap | Views / sessions | White-label | Floor AR |
|--------|----------------|-----------|------------------|-------------|----------|
| Shopify AR (native) | Free | Limited | N/A | No | Scene Viewer |
| Virtual AR Experience | $10/mo | Variant-mapped | — | No | Spatial mode |
| SwiftXR | $25/mo | 100 projects | 5k views/mo + $1/1k | No | Yes |
| Sceneview (Growth) | $29/mo | — | 500 renders | Partial | Yes |
| Visuality / Zakeke / Aryel | ~€30/mo | Tiered | Quota | No | WebAR |

**Atlas position:** Too expensive for “one Shopify SKU.” Target **multi-SKU showrooms** and **field teams**, not $10 plugin buyers.

### Tier B — Furniture & home retail (primary ICP)

| Vendor | Starting price | Notes |
|--------|----------------|-------|
| **Zolak** Showroom Start | **$99/mo** | Showroom + modules; setup fee extra |
| **Zolak** Standard | **$449/mo** | High render limits |
| **Roomle** 3D & AR Viewer | **€100/mo** (~$108) | 150 uploads/mo, 100k views/yr |
| **Roomle** Material Configurator | **€280/mo** | Configuration logic |
| **Zolak** blog anchor | **$140–190/mo** | Configurator / showroom modules |

**Atlas position:** **Launch $59** undercuts Zolak Start and Roomle viewer while offering **true floor WebXR + Quick Look + white-label workspace** — not just an iframe viewer.

### Tier C — White-label WebAR / field sales (secondary ICP)

| Vendor | Price | White-label | Unlimited views |
|--------|-------|-------------|-----------------|
| Blippar WebAR SDK Pro | £250/mo (~$315) | Custom domain | Yes (per license) |
| SAMUAR Standard | **$499/mo** (annual) | Yes | Unlimited |
| XRKit Business | $99/mo | Add-on | 50k scans/mo |
| MyWebAR Ultimate | ~$1,200+/mo equiv. | Full | Unlimited* |

**Atlas position:** **Growth $179** with **unlimited reps (no per-seat)** beats per-project commercial licenses (historical 8th Wall **$700/project/mo**).

### Tier D — Enterprise CPQ / configurator (not direct competitor)

| Vendor | Typical ACV |
|--------|-------------|
| Threekit | $50k–100k+/yr |
| Tacton CPQ | $50k+/yr |
| Custom AR agency build | $80k–500k one-time |

**Sales anchor:** “Enterprise CPQ starts at $4k/mo. Atlas AR starts at $59/mo with live floor placement this week.”

---

## Pricing psychology for quick onboarding

### What converts at Atlas ACV (~$708–$2,148 ARR)

| Lever | Benchmark | Atlas recommendation |
|-------|-----------|---------------------|
| Trial length | 14 days median for B2B | **14-day Growth trial** |
| Credit card at signup | Opt-in: more signups, 8–22% convert; opt-out: 35–55% convert | **No card** for launch (new brand PLG) |
| Time to first value | Elite <10 min to “aha” | Onboarding = upload 1 GLB → open `/w/slug/ar/model` on phone |
| Price anchoring | Show higher tier first or vs custom build | Compare to **$99 Zolak** and **$100k custom app** |
| Urgency | Annual = ~20% discount | **20% off annual** Launch & Growth |
| Founding offer | First 5–10 logos | **Growth features at Launch price × 12 months** (first 10 workspaces) |

### Anti-patterns to avoid

- **Per-session sticker shock** on marketing page ($0.08/session reads expensive vs SwiftXR $0.001/view) → quote **per 1,000 sessions** or **generous included buckets**
- **Demo-only pricing** (Zolak “book a demo”) → Atlas wins with **self-serve signup + trial**
- **Seat-based field rep pricing** → kills B2B field sales ICP; keep **unlimited viewers**

---

## Recommended pricing v2 (sales-ready)

**File & storage policy (all tiers):** max **50 MB** per GLB or USDZ file. Workspace storage = **model slots × 50 MB × 2.5**. AR sessions = **100 per model / month** on Starter, Launch, Growth; **Scale unlimited**.

### Launch — $59/mo ($47/mo billed annually)

**For:** Single showroom, pilot field team, design partners converting from trial.

| Included | Limit |
|----------|-------|
| Workspaces | 1 |
| GLB models | 30 |
| Max GLB / USDZ file | 50 MB |
| AR sessions / mo | 100 per model (3,000 max) |
| Storage | 3.7 GB |
| Android WebXR floor AR | ✓ |
| iOS Quick Look (USDZ) | ✓ |
| Branded `/w/{slug}` link | ✓ |
| Analytics | Basic |
| Support | Email 48h |

### Growth — $179/mo ($143/mo billed annually) · **Most popular**

**For:** Regional retail, active field sales, multiple product lines.

| Included | Limit |
|----------|-------|
| Workspaces | 1 (multi-brand: Scale) |
| GLB models | 100 |
| Max GLB / USDZ file | 50 MB |
| AR sessions / mo | 100 per model (10,000 max) |
| Storage | 12.2 GB |
| White-label (no Atlas badge on customer UI) | ✓ |
| Analytics + CSV export | ✓ |
| Custom accent + logo | ✓ |
| Support | Email 24h |

### Scale — from $499/mo (custom)

**For:** Multi-brand groups, SSO, compliance, dedicated success.

- Unlimited workspaces · custom session tiers · SSO · SLA · security review · custom domain · integrations

### Overage (hybrid — warn in MVP, invoice manually)

| Meter | Launch | Growth |
|-------|--------|--------|
| Extra sessions (per 1,000) | $15 | $10 |
| Extra models (per 10) | $12 | $8 |
| Extra storage (per 10 GB) | $6 | $4 |

*Effective per-session overage at Growth: **$0.01/session** — competitive vs legacy WebAR view metering when sold as B2B workspace value.*

---

## Onboarding & conversion offers

### 1. Default — 14-day Growth trial (no credit card)

- Full Growth limits during trial
- Day 0: upload GLB · Day 1: share link · Day 3: nudge if no session logged
- Day 12: “Choose Launch or Growth” · Day 14: soft downgrade to read-only unless converted

### 2. Founding customer (first 10 paid workspaces)

- **Growth plan at Launch price ($59/mo) for 12 months**
- Free 30-min onboarding call
- Logo on site (“Early partners”) optional

### 3. Design partner pilot (existing PRICING.md)

- 90 days Growth features at Launch price
- Success: ≥50 sessions/mo, ≥5 models → 15% off annual if signed within 30 days of pilot end

### 4. Annual prepay

- **20% discount** on Launch & Growth
- 2 months free equivalent

---

## Sales talk tracks

### vs Zolak / Roomle ($99–450/mo)

> “Same floor AR outcome, self-serve in an afternoon — no demo gate, no implementation quote. Launch is **$59/mo** with 100 sessions per model (3,000 included).”

### vs Shopify AR app ($10–65/mo)

> “Shopify apps are one store, one embed. Atlas is a **branded workspace** your reps and showrooms share — one catalog, one link, Android WebXR + iOS Quick Look.”

### vs custom AR app ($100k+)

> “Custom build is 6–12 months and six figures. Atlas is live when your first GLB uploads — **under $2k/year** for Growth.”

### vs displaced 8th Wall users

> “Hosted WebAR with floor placement and tenant branding — no engine ops, no $700/project commercial license.”

---

## Metrics to track post-launch

| Metric | Target (90 days) |
|--------|------------------|
| Signup → first model uploaded | >60% in 24h |
| Signup → first AR session | >40% in 7d |
| Trial → paid (Launch or Growth) | >20% (opt-in trial) |
| CAC payback | <6 months at Growth $179 |
| Expansion Launch → Growth | >25% within 6 months |

---

## Migration from v1 draft ($99 / $299)

| v1 | v2 | Rationale |
|----|-----|-----------|
| Starter $99 | Launch **$59** | Undercut Zolak $99; faster yes |
| Pro $299 | Growth **$179** | Still premium vs Shopify; below Roomle €280 |
| 500 sessions Starter | **500** (5 × 100/model) | Per-model session buckets scale with catalog slots |
| 25 models Starter | **30** | Round number; enough for pilot catalog |
| No trial spec | **14-day Growth trial** | PLG standard |

*v1 numbers remain in git history; implement v2 on pricing page and sales collateral.*

---

## Sources (June 2026)

- [Zolak pricing / TrustRadius](https://www.trustradius.com/products/zolak/pricing) — $99–$899/mo tiers  
- [Roomle Rubens pricing](https://www.roomle.com/en/pricing) — €100–€1,450/mo  
- [Visuality AR comparison 2026](https://visuality.fr/en/article/augmented-reality-ecommerce-solutions-comparison-2026) — €29.99+ entry  
- [CPQ3D vendor cost survey 2026](https://cpq3d.com/3d-product-configurator-cost/)  
- [SwiftXR Shopify pricing](https://apps.shopify.com/swiftxr-viewer) — $25–150/mo + view overage  
- [Blippar WebAR SDK](https://www.blippar.com/pricing/) — £250/mo unlimited commercial  
- [SAMUAR white-label](https://samuar.net/en/) — $499/mo unlimited views  
- [XRKit pricing](https://xrkit.app/) — $29–99/mo + 14-day trial  
- [8th Wall shutdown / open source](https://8thwall.org/blog/8th-wall-open-source) — Feb 2026  
- [ChartMogul SaaS conversion report](https://chartmogul.com/reports/saas-conversion-report/) — trial benchmarks  
- [B2B trial conversion benchmarks 2026](https://www.growthspreeofficial.com/blogs/b2b-saas-trial-to-paid-conversion-rate-benchmarks-2026-by-trial-type-acv-length-credit-card)  
- Internal: [PRICING.md](./PRICING.md) · [ICP.md](./ICP.md) · [MARKET-RESEARCH.md](./MARKET-RESEARCH.md)
