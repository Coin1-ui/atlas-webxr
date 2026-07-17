# Atlas AR — Market & audience research (2026)

**Orchestration:** Trend Researcher + Product Manager + Brand Guardian  
**Date:** 2026-05-21 · **ICP source:** [ICP.md](./ICP.md)

---

## Target audiences (primary)

### ICP 1 — Furniture & home retail

| Dimension | Insight |
|-----------|---------|
| **Buyer** | Head of e-commerce, digital product owner, showroom ops |
| **User** | Store associate + end shopper on phone |
| **Job** | Reduce “wrong size” returns; increase confidence on high-AOV items |
| **Decision drivers** | No app install (Android WebXR), Quick Look on iOS, true floor scale |
| **Competitors** | Shopify AR plugins, generic 3D viewers, IKEA-style apps, Snap/8th Wall agencies |
| **Messaging** | “See it on your floor before you buy it.” |

### ICP 2 — B2B field sales

| Dimension | Insight |
|-----------|---------|
| **Buyer** | VP Sales, marketing ops, product marketing |
| **User** | Field rep with Android phone on customer site |
| **Job** | Place approved catalog in buyer’s space during visit — credible, branded |
| **Decision drivers** | White-label link, no IT project, session analytics for sales ops |
| **Competitors** | Custom AR apps ($100k+), PowerPoint, generic Sketchfab links |
| **Messaging** | “Your catalog in their space — one link, no app store.” |

---

## 2026 design & GTM trends (applied to Atlas AR)

| Trend | Source | Atlas AR application |
|-------|--------|-------------------|
| **Product-led hero** — show interface, not abstract blobs | B2B SaaS 2026 | Hero with phone mock + cyan placement ring; “Upload → Share → Place” |
| **Dark premium + single accent** | Landdding 2026 | Deep navy base + cyan/teal AR accent (spatial / tech trust) |
| **Use-case pages over feature lists** | WebMoghuls | Split “Retail” vs “Field sales” cards on landing |
| **Typography with personality** | Landdding, SaaSFrame | Display serif headline + clean sans body (not system UI only) |
| **Trust at objection points** | SaaS Hero | Device badges (Android WebXR, iOS Quick Look), scale accuracy callout |
| **Minimal nav, one primary CTA** | involve.me | Sticky nav: Pricing · Sign in · **Start free** |
| **Spatial commerce = fit confidence** | Retail AR 2026 | Dimensions toggle, floor-lock accuracy as differentiator |
| **Component-based design system** | SaaS Hero | Reusable `mkt-*` + `catalog-*` CSS for Phase 2 iterations |

---

## Positioning statement (MKT-1)

**Atlas AR** is the white-label AR placement platform for **furniture retailers** and **B2B field teams** who need **true-scale floor AR** from existing GLB catalogs — **without a native app** on Android (WebXR) and with **Quick Look on iOS**.

---

## Landing page information architecture

1. **Hero** — dual-audience headline + primary CTA (Start free) + secondary (See pricing)
2. **Social proof strip** — platform badges + “Built for showrooms & field reps”
3. **Product preview** — animated phone mock (ring + chair silhouette)
4. **Use cases** — Retail card · Field sales card
5. **How it works** — 3 steps
6. **Features** — Scale · Brand · Analytics
7. **Pricing teaser** — Starter $99 → link to `/pricing`
8. **Footer** — Sign in · Admin · Legal placeholders

---

## Tenant showroom IA (customer-facing `/w/{slug}`)

Replace plain button stack with:

- Branded header (logo + workspace name)
- Short welcome line (vertical-agnostic)
- **Product grid** — icon, name, “View in AR” per SKU
- Trust footer (HTTPS · Android · iOS Quick Look) — not dev jargon

---

## Anti-patterns to avoid

- Generic “AI” hype — buyers want **placement that works**
- WebXR on iOS claims — Quick Look only
- Cluttered admin-style landing for shoppers
- Inter font + flat blue buttons only (reads as internal tool)

---

## References

- [ICP.md](./ICP.md) · [PRICING.md](./PRICING.md) · [PRD-v1.md](./PRD-v1.md)
- B2B SaaS Web Design Trends 2026 (WebMoghuls)
- SaaS Hero landing trends 2026
- Landdding State of Landing Pages 2026
