# Dodo meters + add-ons for Atlas overage (test mode)

**Last setup:** 2026-07-23 — existing hybrids patched to **1 Day payment / 1 Month period** + **3 meters** (sessions, models, storage_bytes) + `tax_inclusive: true`.  
**Result JSON (local):** `DODO-HYBRID-SETUP-RESULT.json` (gitignored).  
**API key:** local `D:\AI\atlas-webxr\DOdo_api.txt` only — never commit. Chat-pasted candidate key returned **401**; setup used the prior working test key.

## Best Dodo combination (locked)

| Setting | Value |
|---------|--------|
| **Pricing Type** | **Usage-Based** (`usage_based_price`) |
| **Products** | Starter / Launch / Growth hybrids (edit in place) |
| **Payment frequency** | **1 Day** |
| **Subscription period** | **1 Month** |
| **Tax** | `saas` · `tax_inclusive: true` |
| **Meters (all 3 per product)** | sessions · models · storage_bytes |
| **On-demand** | **Off** |
| **Overage rates** | Pack guide: `overage-estimate.mjs` / `plan-display.ts`; invoice: Dodo meter PPU (table below) |

Later you may also use **Month/Year** products; this catalog is **Day/Month** for renewal testing.

## How charging works

```
Atlas usage → POST /events/ingest → Dodo meters → auto-bill on payment cycle (+ fixed fee)
```

| Path | Behavior |
|------|----------|
| **Meter overage (hybrid)** | Charged automatically with the subscription payment when usage exceeds free thresholds |
| **`POST …/subscriptions/{id}/charge`** | **Unsupported** on usage-based products (`UNSUPPORTED_ACTION`) — do not treat Account Accept & pay as a card charge |
| **Atlas Account estimate** | Pack-rounded guide only; may differ slightly from linear meter invoice |
| **`on_demand`** | **Off** — required for plan change; not used for meter overage |

**Ingest event names (must match meters):** `atlas.ar_session` (count) · `atlas.model_count` (max) · `atlas.storage_bytes` (max).

### Sandbox Seed → Dodo (prod-readiness)

Account **Seed overage** writes Atlas Dynamo usage for UI. To also ingest **real** Dodo meter events:

1. Lambda env `ATLAS_SANDBOX_USAGE_SEED=true` (Seed button)
2. Lambda env **`ATLAS_SANDBOX_DODO_INGEST=true`** (opt-in meter ingest)
3. Workspace must have an active Dodo subscription + customer mapping
4. FE shows a confirm warning before Seed when ingest is on

Sessions are batched (100/event request) with ids `atlas_sandbox_session_{workspaceId}_{seedRunId}_{i}`. Models/storage are single gauge events. **Clear test overage does not reverse Dodo meters** — turn `ATLAS_SANDBOX_DODO_INGEST=false` after readiness tests.

`GET /health` exposes `sandboxDodoIngest` for verification.

## Live hybrid product IDs (test)

| Tier | Product ID | Fixed | Session free / PPU | Model free / PPU | Storage free (bytes) |
|------|------------|-------|--------------------|------------------|----------------------|
| Starter | `pdt_0Njk5Xz9AdIoBNmgRoIEK` | $5 | 500 / 5¢ | 5 / $3 | 655,360,000 |
| Launch | `pdt_0Njk5QMJ8uCwSvseuHeo0` | $59 | 3,000 / 0.8¢ | 30 / $1.20 | 3,932,160,000 |
| Growth | `pdt_0Njk5Y261cDq9TWLto4dR` | $179 | 10,000 / 0.5¢ | 100 / $0.80 | 13,107,200,000 |

**Meters:** `mtr_0Njk5Q0tl…` sessions · `mtr_0Njk5Q5c…` models · `mtr_0Njk5QA3…` storage  
**Add-on:** `adn_0Njk5E8xaOBpo1PAT1pOv` Session Pack 1k ($8) on classic Launch

## Lambda env (test checkouts) — set in AWS Console

```
DODO_PRODUCT_STARTER_USAGE=pdt_0Njk5Xz9AdIoBNmgRoIEK
DODO_PRODUCT_LAUNCH_USAGE=pdt_0Njk5QMJ8uCwSvseuHeo0
DODO_PRODUCT_GROWTH_USAGE=pdt_0Njk5Y261cDq9TWLto4dR
ATLAS_DODO_USAGE_HYBRID=true
ATLAS_DODO_USAGE_INGEST=true
```

Keep classic `DODO_PRODUCT_*_MONTHLY` until hybrids are validated; with `ATLAS_DODO_USAGE_HYBRID=true`, checkout prefers USAGE IDs (see `billing-provider-dodo.mjs`).

Also ensure Lambda zip includes `dodo-usage-ingest.mjs` (session + model/storage ingest).

## Re-run

```powershell
cd D:\AI\agency-agents\atlas-webxr
$env:DODO_PAYMENTS_API_KEY = "<from DOdo_api.txt>"
node scripts/setup-dodo-overage-meters.mjs
```

## Overage rate source

| Meter | Starter | Launch | Growth |
|-------|---------|--------|--------|
| Sessions | +$5 / 100 | +$8 / 1,000 | +$5 / 1,000 |
| Models | +$3 each | +$12 / 10 | +$8 / 10 |
| Storage | +$8 / 5 GB | +$6 / 10 GB | +$4 / 10 GB |

## Architecture notes

1. No `on_demand` — plan changes stay available; meter overage still bills without it.  
2. Storage meter remains `max(storage_bytes)`; free threshold in bytes; PPU rounded to ≤12 decimal places.  
3. Month/Year SKUs can be added later as parallel products without replacing Day/Month test SKUs.  
4. Sandbox QA: confirm ingest + renewal invoice — do **not** treat Accept & pay → `accepted` as proof of card charge.
