# Dodo meters + add-ons for Atlas overage (test mode)

**Status:** Catalog seeded 2026-07-22 via test API (Option A — no `on_demand`, plan changes stay available).  
**Event ingest (code):** wired 2026-07-22/23 — `dodo-usage-ingest.mjs` from session analytics + model upload (best-effort; off if `ATLAS_DODO_USAGE_INGEST=false`).  
**Hybrid checkout:** still **off** by default — live `DODO_PRODUCT_*_MONTHLY` unchanged until QA + explicit `ATLAS_DODO_USAGE_HYBRID=true` or `DODO_PRODUCT_*_USAGE` env.  
**List prices:** Atlas plan amounts are **tax-inclusive** (`tax_inclusive: true` on Dodo products; marketing/docs match).

## Best Dodo combination (plan + usage overage)

Per [Dodo Products](https://docs.dodopayments.com/features/products) and [Hybrid billing — Subscription + Usage](https://docs.dodopayments.com/features/hybrid-billing):

| Setting | Choose | Why |
|---------|--------|-----|
| **Pricing model / Pricing Type** | **Usage-Based** | API `price.type: usage_based_price` — fixed monthly fee **plus** meter overage on one invoice |
| **Product shape** | One product per tier (Starter / Launch / Growth) with meters attached | Dashboard: Create Product → attach usage meter (Hybrid Model 1 / Tiered base + overage) |
| **Tax category** | `saas` | Matches Atlas SaaS |
| **Tax inclusive** | **`true`** | Displayed plan price = what customer pays; Dodo breaks out tax on checkout/invoice |
| **Meters (primary)** | Sessions — Count on `atlas.ar_session` | Matches included session allowances + overage rates |
| **Do not use for plan SKUs** | Pure **Subscription** (`recurring_price` only) | No automatic usage overage |
| **Do not use for new checkouts** | **On-demand** subscription | Blocks Dodo `change-plan` (Option A) |
| **Optional add-on** | Session Pack (prepaid) | Top-ups; keep off the hybrid meter path to avoid conflicting usage rules |

**Not recommended as the plan SKU:** One-Time products, pure usage-only (no `fixed_price`), or Subscription + On-Demand charges for overage.

Atlas already seeded hybrids with this shape (`usage_based_price` + session meter + free thresholds). Switch Lambda `DODO_PRODUCT_*` only after ingest QA.

## Can Dodo do this?

| Mechanism | Supported? | Fit for Atlas overage |
|-----------|------------|------------------------|
| **Meters** + `usage_based_price` (fixed fee + usage) | Yes | **Best** for automatic session overage at renewal — keeps standard recurring (plan change OK) |
| **Add-ons** | Yes | Good for **prepaid packs** (buy 1k sessions), not automatic overage |
| **`on_demand` + `/charge`** | Yes | Card overage now — but **blocks** `change-plan` (rejected in Option A) |

Dodo docs: meters and add-ons should **not** both drive complex usage on the same product in conflicting ways; we use meters on **hybrid products**, add-on on the existing Launch catalog product as a pack.

## Created in test business `bus_0NiRCeAygFrKyx6k11gSw`

### Meters

| Name | Meter ID | Event | Aggregation |
|------|----------|-------|-------------|
| Atlas AR sessions | `mtr_0Njk5Q0tl4kMjH8lLff75` | `atlas.ar_session` | count |
| Atlas models | `mtr_0Njk5Q5csiO6F5ThJXfAs` | `atlas.model_count` | max(`model_count`) |
| Atlas storage GB | `mtr_0Njk5QA3t5MsRzt32hVsG` | `atlas.storage_bytes` | max(`storage_bytes`) |

### Add-on

| Name | ID | Price |
|------|-----|-------|
| Atlas Session Pack 1k | `adn_0Njk5E8xaOBpo1PAT1pOv` | $8.00 (`800` cents) |

Attached to existing Launch product `pdt_0NjSYfJ2iwd7x9Qyfydwv` as optional add-on list entry.

### Hybrid usage products (parallel to current plans — **not** wired to Lambda yet)

| Name | Product ID | Fixed | Free sessions | `price_per_unit` |
|------|------------|-------|---------------|------------------|
| Starter (usage hybrid) | `pdt_0Njk5Xz9AdIoBNmgRoIEK` | $5 | 1,000 | **5** cents/session (= Atlas $5/100) |
| Launch usage hybrid | `pdt_0Njk5QMJ8uCwSvseuHeo0` | $59 | 5,000 | **0.8** cents/session (= Atlas $8/1k) |
| Growth (usage hybrid) | `pdt_0Njk5Y261cDq9TWLto4dR` | $179 | 15,000 | **0.5** cents/session (= Atlas $5/1k) |

## Recommended architecture (best path under Option A)

1. Keep **checkout without `on_demand`** so Upgrade/Downgrade works.
2. Prefer **Usage-Based (`usage_based_price`) products** for plan + automatic session overage at period end (Dodo meters + event ingest).
3. Set **`tax_inclusive: true`** so list prices match tax-inclusive marketing copy.
4. Keep Atlas **Accept & pay** for models/storage settle (or add those meters later with careful unit design).
5. Use **Session Pack add-on** for optional prepaid top-ups in portal/checkout.
6. Only switch Lambda `DODO_PRODUCT_*` to hybrid IDs after: event ingest from Atlas session analytics + webhook reconciliation + plan-change QA.

## Event ingest (implemented in Lambda source)

```http
POST https://test.dodopayments.com/events/ingest
Authorization: Bearer <DODO_PAYMENTS_API_KEY>
```

Wired in:
- `lib/dodo-usage-ingest.mjs` → `ingestDodoArSession` / `ingestDodoModelCount` / `ingestDodoStorageBytes`
- `lib/usage.mjs` (session dedupe success) → AR session events
- `handlers/v2-models.mjs` (upload complete) → model + storage gauges

**Deploy gate:** rebuild/upload Lambda zip so production includes `dodo-usage-ingest.mjs` (not only Amplify).  
**Next product gate:** flip hybrid product env after ingest smoke on a paid test sub.

## Script

`scripts/setup-dodo-overage-meters.mjs` — idempotent list/create helpers for re-runs.
