# Atlas AR — Hybrid pricing model

**Current (v2 — sales & onboarding):** June 2026 market research → [PRICING-RESEARCH.md](./PRICING-RESEARCH.md)

**Tax:** Published Starter / Launch / Growth list prices are **tax-inclusive**. Checkout may break out tax from the same total. Scale / custom order forms may state tax separately.

## Structure

**14-day Growth trial (no credit card)** → **monthly workspace fee** + **usage overage** at renewal.

## Tiers (v2 — recommended for quick onboarding)

| | **Starter** | **Launch** | **Growth** | **Scale** |
|---|-------------|------------|------------|-----------|
| **Base / mo (incl. tax)** | **$5** ($4 annual) | **$59** ($47 annual) | **$179** ($143 annual) | From **$499** |
| **Workspaces** | 1 | 1 | 1 | Multi-brand |
| **Workspace admins** | Not seat-metered | Not seat-metered | Not seat-metered | Not seat-metered |
| **Field reps / viewers** | Unlimited | Unlimited | Unlimited | Unlimited |
| **GLB models** | 5 | 30 | 100 | Custom |
| **Max GLB / USDZ file** | 50 MB | 50 MB | 50 MB | 50 MB |
| **AR sessions / mo** | 100/model (500 max) | 100/model (3,000 max) | 100/model (10,000 max) | Unlimited |
| **Storage** (models × 50 MB × 2.5) | 625 MB | 3.7 GB | 12.2 GB | ~1.2 TB |
| **White-label customer UI** | Branded link | Full | Full | Full + custom domain |
| **Browser-based AR (Chrome & Safari)** | ✓ | ✓ | ✓ | ✓ |
| **Analytics** | Usage dashboard | Usage dashboard | JSON session log (default on) | Custom (roadmap) |
| **Support** | Email 72h | Email 48h | Email 24h | SLA + CSM |

**Workspace admins:** Not seat-metered today (PM-4). Unlimited **field reps / viewers** remain a product promise on every plan.

**Trial:** 14 days of **Growth** limits · no credit card · self-serve signup.

## Overage (hybrid usage)

### How charging works (locked)

1. Atlas sends usage events to Dodo (`atlas.ar_session`, `atlas.model_count`, `atlas.storage_bytes`).
2. Dodo meters aggregate usage and bill **automatically each payment cycle** with the subscription fixed fee (Usage-Based hybrid SKUs).
3. Account “Accept & pay” is **not** the hybrid charge path — Dodo rejects `POST /subscriptions/{id}/charge` on usage-based products (`UNSUPPORTED_ACTION`).
4. Atlas pack estimates on Account / `/pricing` are a **customer guide**; the invoice uses Dodo **linear price-per-unit** after free thresholds. See [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md).

### Customer pack rates (Atlas estimate / marketing)

**Source of truth for pack math:** `backend/lambda/atlas-api/lib/overage-estimate.mjs` (mirrored in `src/shared/plan-display.ts`). Included session caps follow `plan-limits.ts` (100 sessions / model / mo → 500 / 3,000 / 10,000).

| Meter | Starter | Launch | Growth |
|-------|---------|--------|--------|
| Extra sessions | +$5 / 100 | +$8 / 1,000 | +$5 / 1,000 |
| Extra models | +$3 each | +$12 / 10 | +$8 / 10 |
| Extra storage | +$8 / 5 GB | +$6 / 10 GB | +$4 / 10 GB |

### Dodo meter billing (linear PPU at cycle)

Hybrid products bill meters on Usage-Based SKUs (sessions + models + storage_bytes). Effective per-unit rates match the pack SoT above (e.g. Starter sessions **5¢** each after 500 free ≈ +$5 / 100). Exact invoice = `(usage − free_threshold) × price_per_unit` + fixed fee.

## Conversion offers

| Offer | Terms |
|-------|--------|
| **14-day trial** | Growth features, no card |
| **Annual prepay** | 20% off Launch & Growth |
| **Founding 10** | Growth at Launch price ($59/mo) × 12 months |
| **Design partner** | 90-day Growth at Launch price; ≥50 sessions/mo → 15% off annual |

## Competitive anchor (sales)

- Below **Zolak Start ($99)** and **Roomle viewer (~$108/mo)**
- Above Shopify AR plugins ($10–65) — different product (white-label workspace)
- vs **custom AR app ($100k+)** — “live this week under $2k/year”

## Engineering spec (plan enum)

1. `workspace.plan`: `launch | growth | scale` (migrate from `starter | pro | enterprise`)
2. Counters: `modelCount`, `sessionCountMonthly`, `storageBytes`
3. Trial state: `trialEndsAt`, `trialPlan: growth`
4. **Max file size:** **50 MB** per GLB, USDZ, or icon on **all** plans (`upload-limits.mjs`)
5. **Storage quota:** `models × 50 MB × 2.5` per tier (Starter 625 MB · Launch 3.7 GB · Growth 12.2 GB · Scale ~1.2 TB)
6. **AR sessions:** **100 per model / month** on Starter, Launch, Growth (workspace caps: 500 / 3,000 / 10,000); **Scale unlimited**
7. MVP limits: **hard-block** model upload at plan cap; warn on session/storage overage; client preflight on file size
8. Session = `session-start` → `session-end` with ≥1 placement

---

## v1 draft (superseded — kept for reference)

| | **Starter** | **Pro** | **Enterprise** |
|---|-------------|---------|----------------|
| **Base / mo** | $99 | $299 | Custom |

See git history for full v1 table. v2 lowers entry and Growth price based on [PRICING-RESEARCH.md](./PRICING-RESEARCH.md).
