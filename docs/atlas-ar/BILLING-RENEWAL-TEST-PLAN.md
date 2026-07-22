# Billing renewal test plan (live Dodo + Atlas)

**Workspace:** `1ee2cb65-6252-4679-ab53-84ea36b2518f`  
**API:** `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com`  
**App:** `https://main.d7vfdpujdozkj.amplifyapp.com`  
**Constraint:** In this Dodo **test** sandbox, both (a) `PATCH` clock-advance of
`next_billing_date` and (b) **natural** wait on some **Day**-frequency products have
produced **`expired` with no renewal charge** (example: `sub_0Njf5rgrGbzHmpClzzG0B`,
waited ~24h, card 4242, no advance). Cancel-at-period-end clock advance and **immediate**
`change-plan` still work. Prefer **Month** products for Track B until Dodo confirms daily renewals.

Use **three tracks**. Track A proves Atlas reconciliation. Track B proves Dodo money movement when possible. Track C is the only reliable same-day upgrade charge today.

---

## What must be proven

| # | Scenario | Success criteria |
|---|----------|------------------|
| **1** | Same-plan renewal at `next_billing_date` | New payment for current product; sub stays `active`; `next_billing_date` +1 period; Atlas `status: active`, same `entitlementTier`, new `currentPeriodEnd` |
| **2** | Renewal **with** scheduled upgrade/downgrade | At period end: product switches; charge matches **new** product; Atlas `entitlementTier` updates; Plan UI matches |

---

## Track A — Atlas layer (run anytime, no Dodo wait)

Proves our webhook → Dynamo → entitlement path for the events Dodo will eventually send.

```bash
cd atlas-webxr
npm run test:billing-state
npm run test:billing-providers
npm run test:plan-change-matrix
```

These cover:

- `subscription.renewed` / updated period end keeps entitlement
- product_id change on renewal maps to new tier (`plan_changed` / renewed with new product)
- UI matrix Current / Upgrade / Downgrade

**Does not** prove Dodo charged a card.

---

## Track B — Real Dodo renewal (scenario 1 & 2)

### B1. Same-plan renewal (natural clock)

1. Ensure one **active** sub, `cancel_at_next_billing_date: false`, success test card on file.
2. Note `subscription_id`, product, `next_billing_date`, last `payment_id`.
3. **Do not** clock-advance (broken for renewals here).
4. Wait until real `next_billing_date` (or ask Dodo for a **daily** test product / shorter cycle if they can enable it).
5. After that time, check:
   - Dodo: new payment, status `active`, new `next_billing_date`
   - Webhooks: `payment.succeeded` + `subscription.renewed` (Succeeded)
   - Atlas: `GET /v2/workspaces/{id}/billing/status`

### B2. Upgrade/downgrade at renewal (natural clock)

1. From Atlas Plan & billing → choose Upgrade/Downgrade (schedules `effective_at: next_billing_date`).
2. Confirm Dodo shows scheduled change (or `GET` subscription + change history).
3. Wait for natural `next_billing_date` (again: **no** clock-advance).
4. Expect: product = target plan, charge = new price, Atlas `entitlementTier` = target, Plan name matches.

### B3. If you need faster proof from Dodo

Open a ticket / support chat with:

- Business + sandbox mode
- Evidence: `PATCH { next_billing_date }` → `expired`, no `payment.succeeded`
- Ask: supported way to accelerate renewals in test, or a short-cycle product for QA

Until that works, Track B is **calendar wait** or Dodo-enabled short cycle — not our clock script.

---

## Track C — Same-day upgrade charge (partial stand-in for scenario 2)

**Works today** in this sandbox:

```http
POST /subscriptions/{id}/change-plan
{ "product_id": "<growth|starter>", "proration_billing_mode": "prorated_immediately", "effective_at": "immediately" }
```

Proves: upgrade money movement + Atlas entitlement update after webhook.  
**Does not** prove Atlas’s default `next_billing_date` schedule path or same-plan renewal.

Use for: “can Dodo charge / can Atlas apply plan change webhooks?”  
Keep Atlas UI on scheduled changes for production behavior; use immediate only in sandbox QA.

---

## Recommended order for this project

1. **Always green:** Track A unit suite (CI / pre-deploy).
2. **Same-day product confidence:** Track C once per billing release if plan SKUs change.
3. **True renewal (1) and scheduled change (2):** Track B natural wait on one Launch sub, then one scheduled Growth change on another (or sequential after first renews).
4. **Escalate to Dodo** so Track B can become same-day via short cycle or fixed clock-advance.

---

## Live checklist commands

```bash
# Readiness snapshot (sub status, NBD, cancel flag, Atlas status)
node scripts/qa-dodo-renewal-checklist.mjs

# After natural billing time — same script re-run should show new payment / period
node scripts/qa-dodo-renewal-checklist.mjs --expect-renewed
```

Env: `DODO_PAYMENTS_API_KEY`, optional `ATLAS_JWT`, `ATLAS_WORKSPACE_ID`, `DODO_SUBSCRIPTION_ID`.

---

## Pass / fail summary

| Proof | Track | Same-day? |
|-------|-------|-----------|
| Atlas renews entitlement on renewed event | A | Yes |
| Atlas applies new tier on plan change event | A | Yes |
| Dodo charges recurring same plan | B1 | Only after NBD (or Dodo short cycle) |
| Dodo charges + switches plan at NBD | B2 | Only after NBD |
| Dodo charges upgrade now | C | Yes (not the Atlas UI path) |
