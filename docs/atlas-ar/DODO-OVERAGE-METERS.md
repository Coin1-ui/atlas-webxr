# Dodo meters + add-ons for Atlas overage (test mode)

**Status:** Catalog seeded 2026-07-22 via test API (Option A — no `on_demand`, plan changes stay available).  
**Does not replace** live Starter/Launch/Growth product IDs used by Lambda env (`DODO_PRODUCT_*_MONTHLY`) until Atlas is wired to ingest events + map hybrid products.

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
2. Prefer **hybrid `usage_based_price` products** for automatic session overage at period end (Dodo meters + event ingest).
3. Keep Atlas **Accept & pay** for models/storage settle (or add those meters later with careful unit design).
4. Use **Session Pack add-on** for optional prepaid top-ups in portal/checkout.
5. Only switch Lambda `DODO_PRODUCT_*` to hybrid IDs after: event ingest from Atlas session analytics + webhook reconciliation + plan-change QA.

## Event ingest (next engineering step)

```http
POST https://test.dodopayments.com/events/ingest
Authorization: Bearer <DODO_PAYMENTS_API_KEY>
```

```json
{
  "events": [{
    "event_id": "unique-id",
    "customer_id": "cus_…",
    "event_name": "atlas.ar_session",
    "timestamp": "2026-07-22T00:00:00.000Z",
    "metadata": { "workspace_id": "…" }
  }]
}
```

Wire from Atlas when an AR session is recorded (same place usage counters increment).

## Script

`scripts/setup-dodo-overage-meters.mjs` — idempotent list/create helpers for re-runs.
