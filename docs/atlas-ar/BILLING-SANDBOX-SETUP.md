# Atlas AR billing sandbox setup

## Dodo test-mode checklist

Do not paste API keys or webhook secrets into chat, source files, screenshots, or Git. Store them in encrypted Lambda configuration or AWS Secrets Manager.

### 1. Create monthly recurring products

In Dodo **test mode**, create three recurring monthly products:

| Atlas tier | USD price | Lambda variable |
|------------|-----------|-----------------|
| Starter | $5/month | `DODO_PRODUCT_STARTER_MONTHLY` |
| Launch | $59/month | `DODO_PRODUCT_LAUNCH_MONTHLY` |
| Growth | $179/month | `DODO_PRODUCT_GROWTH_MONTHLY` |

Use quantity `1`. Do not create Scale as self-service; Scale remains sales-assisted.
Verify both the payment frequency and subscription period are **Month**. A monthly charge
attached to a yearly subscription period is not an approved monthly product configuration.

### 2. Create test credentials

Collect these values from the Dodo test dashboard:

- Test read/write API key → `DODO_PAYMENTS_API_KEY`
- Business ID → `DODO_PAYMENTS_BUSINESS_ID`
- The three product IDs above
- Set `DODO_PAYMENTS_ENV=test_mode`

### 3. Configure the signed webhook

Create a webhook pointing to:

```text
https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/v2/billing/webhooks/dodo
```

Subscribe to:

- `subscription.active`
- `subscription.renewed`
- `subscription.failed`
- `subscription.updated`
- `subscription.on_hold`
- `subscription.plan_changed`
- `subscription.update_payment_method`
- `subscription.cancelled`
- `subscription.expired`
- `payment.succeeded`
- `payment.failed`

Store the signing secret as `DODO_PAYMENTS_WEBHOOK_SECRET`.

### 4. Configure Atlas URLs

```text
ATLAS_BILLING_APP_ORIGIN=https://main.d7vfdpujdozkj.amplifyapp.com
ATLAS_BILLING_RETURN_URL=https://main.d7vfdpujdozkj.amplifyapp.com/account?billing=return
ATLAS_BILLING_CANCEL_URL=https://main.d7vfdpujdozkj.amplifyapp.com/account?billing=cancel
ATLAS_BILLING_TABLE=atlas-billing
```

### 5. Keep rollout flags disabled

During initial deployment, leave these unset or `false`:

```text
ATLAS_BILLING_ENABLED
ATLAS_DODO_WEBHOOK_ENABLED
ATLAS_ZOHO_CHECKOUT_ENABLED
```

### 6. AWS prerequisites

- Create `atlas-billing` using `node backend/scripts/create-dynamodb-tables.mjs`.
- Give the Lambda role:
  - `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Scan`, and `TransactWriteItems` on `atlas-billing`.
  - `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` on `atlas-usage`.
  - `dynamodb:UpdateItem` and `TransactWriteItems` on `atlas-workspaces`.
  - Prefer **not** granting `dynamodb:DeleteItem` in production IAM. Clear uses **soft-clear Put** (`status: cleared`) when Delete is denied, so sandbox cleanup works without DeleteItem.
  - If you added DeleteItem for testing, remove that inline policy before go-live — IAM cannot limit DeleteItem to “sandbox rows only” on the same `atlas-billing` / `atlas-usage` tables.
  - App gate: `clearTestOverage` only deletes/clears when `isSandboxUsageContext` (or platform-owner `force`). Real in-period overage is never cleared.
- API Gateway routes:
  - `POST /v2/billing/webhooks/dodo` — no Cognito authorizer.
  - `POST /v2/workspaces/{workspaceId}/billing/checkout` — Cognito authorizer.
  - `GET /v2/workspaces/{workspaceId}/billing/status` — Cognito authorizer.
  - `GET /v2/workspaces/{workspaceId}/billing/overage` — Cognito authorizer.
  - `POST /v2/workspaces/{workspaceId}/billing/overage` — Cognito authorizer.
  - `POST /v2/workspaces/{workspaceId}/sandbox/usage` — Cognito authorizer (overage seed; no local AWS keys).
- CORS headers: `content-type, authorization, idempotency-key`.

### 7. Safe activation order

1. Deploy the reviewed Lambda ZIP with every billing flag disabled.
2. Send a Dodo test webhook and confirm invalid signatures return `400`.
3. Enable only `ATLAS_DODO_WEBHOOK_ENABLED=true`; replay signed lifecycle fixtures.
4. Confirm duplicate events are idempotent and no entitlement appears without a server-owned checkout mapping.
5. Enable `ATLAS_BILLING_ENABLED=true` for a test workspace.
6. Complete Starter checkout, renewal, failed payment, recovery, period-end cancellation, and expiry tests.
7. Keep production/live-mode credentials and flags disabled until evidence is signed off.

### 8. Test evidence recorded on 2026-07-19

The initial recovered payload exposed a Year/Month product mismatch. After correcting the product,
a fresh USD 5 checkout produced Month/Month Starter subscription
`sub_0NjVduFvyLgtljNZmXMoU` for workspace
`1ee2cb65-6252-4679-ab53-84ea36b2518f`.

Recorded evidence:

- Dodo payment `pay_0NjVduFke9QpJiCmQvgYQ` succeeded.
- Signed `payment.succeeded` and `subscription.active` webhook replays completed without Lambda
  errors after canonicalizing Dodo's microsecond timestamps.
- Authenticated Atlas billing status returned `active` / `starter`, provider `dodo`, and period end
  `2026-08-19T08:12:37.451Z`.
- Duplicate replay preserved the existing subscription state.
- Lambda was raised from 128 MB / 3 seconds to 256 MB / 15 seconds after the original allocation
  timed out and reached 120 MB.

Before further testing, rotate any test API key exposed during diagnostics and update
`DODO_PAYMENTS_API_KEY` in Lambda.

## 9. Accelerate period-end testing (do not wait for natural renewal)

Dodo **test mode** supports advancing the billing clock. Official FAQ: you can set
`next_billing_date` via `PATCH /subscriptions/{id}` — the timestamp must be **in the
future** (ISO 8601 UTC with `Z`). See Dodo “Testing Process” / FAQ Q139.

### Recommended sandbox procedure

Use subscription `sub_0NjVduFvyLgtljNZmXMoU` (or a fresh disposable sub).

1. Pick a time **2–5 minutes ahead** (UTC):
   ```powershell
   $next = (Get-Date).ToUniversalTime().AddMinutes(3).ToString("yyyy-MM-ddTHH:mm:ssZ")
   Write-Output $next
   ```
2. In **Dodo Dashboard (test mode)** → Subscription → Update / API, or:
   ```http
   PATCH https://test.dodopayments.com/subscriptions/sub_0NjVduFvyLgtljNZmXMoU
   Authorization: Bearer <DODO_TEST_API_KEY>
   Content-Type: application/json

   { "next_billing_date": "2026-07-20T04:10:00Z" }
   ```
   (Replace the timestamp with your `$next` value. Do not paste the API key into chat/git.)
3. Wait for Dodo to fire lifecycle webhooks (`subscription.renewed` / `subscription.cancelled` /
   `subscription.expired` / `subscription.updated` as applicable).
4. Confirm Atlas:
   ```text
   GET /v2/workspaces/{workspaceId}/billing/status
   ```
   Expect updated `currentPeriodEnd` and, if cancel-at-period-end was already true,
   status moving toward canceled/expired and entitlement clearing after period end.

### How to verify a recurring renewal (same plan)

Dodo renews by charging the saved payment method when `next_billing_date` is reached.
Expected webhooks: `payment.succeeded` + `subscription.renewed` (+ often `subscription.updated`).

**Checks after renewal:**

1. **Dodo Dashboard (test)** → Subscriptions → open the sub:
   - Status still **active**
   - Product unchanged (e.g. Launch)
   - `next_billing_date` advanced by one period
   - New payment row for the recurring amount (e.g. $59 Launch)
2. **Dodo API:**
   ```http
   GET https://test.dodopayments.com/subscriptions/{subscription_id}
   GET https://test.dodopayments.com/payments?page_size=10
   ```
   Confirm a new `payment_id` on that subscription after the billing time, and status `active`.
3. **Dodo Webhooks → Message Attempts:** look for `subscription.renewed` / `payment.succeeded` around the billing time (Succeeded).
4. **Atlas:** `GET /v2/workspaces/{id}/billing/status` → `status: active`, same `entitlementTier`, new `currentPeriodEnd`.

**Clock advance caveat (this sandbox):** advancing `next_billing_date` with
`PATCH /subscriptions/{id}` has repeatedly moved active subs to **`expired` without a
renewal charge**. Cancel-at-period-end clock advance still works.

**Natural daily NBD caveat (observed 2026-07-22):** waiting for real `next_billing_date`
on a **Day**-frequency Growth test sub (`sub_0Njf5rgrGbzHmpClzzG0B`, card `4242`, no clock
advance) also ended **`expired` ~15s after NBD with only the initial checkout payment** —
no renewal `payment.succeeded` / no failed retry. Atlas correctly applied
`subscription.expired`. Escalate to Dodo with that subscription id; do not treat as an
Atlas webhook bug. Prefer proving renewal on a **Month**-frequency product, or Track C
immediate `change-plan`, until Dodo confirms daily renewals in test.

**Full renewal test plan (scenarios 1 & 2):** see
[`BILLING-RENEWAL-TEST-PLAN.md`](./BILLING-RENEWAL-TEST-PLAN.md) — Track A (Atlas unit),
Track B (natural NBD), Track C (immediate upgrade stand-in). Checklist:
`node scripts/qa-dodo-renewal-checklist.mjs`

### Scenario matrix

| What you want to prove | Setup | Then advance `next_billing_date` |
|------------------------|-------|----------------------------------|
| **Cancel at period end** | Already `cancel_at_next_billing_date: true` | Yes → expect cancel/expire webhooks, Atlas loses entitlement after end |
| **Renewal charge** | New active sub, cancel flag **false**, success test card | Prefer **natural** period in this sandbox; clock advance may expire without charge |
| **Upgrade/downgrade at renewal** | `POST …/billing/plan` (Atlas schedules `next_billing_date`) | Same caveat as renewal; or use `effective_at: immediately` for upgrade-only proof |
| **Immediate cancel only** | Dashboard / API cancel now (not period-end) | Not needed for period-end proof |

### Do not

- Set `next_billing_date` to a **past** time (Dodo rejects it).
- Only edit DynamoDB `billingCurrentPeriodEnd` without a provider event — Atlas must reconcile from signed webhooks.
- Use live-mode credentials for this clock advance.

When all dashboard values are configured, report only that setup is complete—do not send secret values.

## 10. Discount coupons (Dodo + Atlas)

End-to-end checkout requires **both**:

1. **Dodo discount** — provider applies the actual billing discount at hosted checkout (`discount_codes`).
2. **Atlas platform coupon** — owner dashboard → Coupons; same code string. Atlas validates active/uses/tier before forwarding to Dodo.

### Create Dodo test discount (script)

```powershell
cd D:\AI\atlas-webxr\atlas-webxr
npm run create:dodo-discount
# Or custom: node scripts/create-dodo-discount.mjs MYCODE 15 "My 15% promo" 50
```

Uses `DODO_PAYMENTS_API_KEY` or `DOdo_api.txt` (`Test_mode API Key = …`). Calls `POST https://test.dodopayments.com/discounts` with `type: percentage`, amount in basis points (2000 = 20%).

**Sandbox coupon created 2026-07-21:**

| Field | Value |
|-------|--------|
| Code | `ATLAS20` |
| Discount ID | `dsc_0NjembK27qeRQhP817iZ5` |
| Amount | 20% off |
| Usage limit | 100 |

### Create matching Atlas coupon

Owner dashboard → **Coupons** → create percent offer:

- **Code:** `ATLAS20` (must match Dodo)
- **Label:** e.g. Atlas Sandbox 20% Off
- **Discount:** 20%
- **Max uses:** 100 (optional)
- **Show on pricing:** optional

Then at **Account → Plan & billing**, enter `ATLAS20` in **Coupon (optional)** when starting a new checkout (trial or expired workspace).

**Owner dashboard sync:** `GET /v2/platform/coupons` (and **Sync from Dodo** on Owner → Discount coupons) pulls `times_used` / `usage_limit` from Dodo `GET /discounts` and updates Atlas `usesCount` so the panel matches Dodo (e.g. Dodo **2 / 10** → Atlas **8 of 10 spots left · 2 used**). Requires Lambda with Dodo API env vars.

**Note:** Dodo only supports **percentage** discounts via API. Atlas fixed-price promos (`promoPriceMonthly`) are Atlas-only until mapped to Dodo products.

## 11. Usage overage (BILL-3)

Account → **Usage overage** shows an estimated USD total when models, sessions, or storage exceed plan limits (see `PRICING.md`).

**Dodo meters / add-ons (test catalog):** see [`DODO-OVERAGE-METERS.md`](./DODO-OVERAGE-METERS.md) — hybrid `usage_based_price` products + session pack add-on (keeps plan changes; avoids `on_demand`).

### API routes (Cognito authorizer)

- `GET /v2/workspaces/{workspaceId}/billing/overage?month=YYYY-MM` — overage status for a month
- `POST /v2/workspaces/{workspaceId}/billing/overage` — body `{ month, amountUsd, accept: true }`

Usage API (`GET …/usage`) also returns `estimatedOverageUsd`, `overagePaid`, and `overageAccepted`.

### Charge path

1. Server recomputes overage (client `amountUsd` is validated, not trusted).
2. For active **Dodo** subscriptions that are **on-demand**, Atlas calls `POST /subscriptions/{id}/charge`.
3. New checkouts are **standard recurring** (not on-demand) so **Upgrade/Downgrade** via `change-plan` works. Dodo forbids plan changes on on-demand subs.
4. If automatic charge is unavailable (non–on-demand / legacy), status is stored as **`accepted`** — UI shows invoicing pending.
5. `payment.succeeded` webhooks with `metadata.atlas_overage_month` mark the month **paid** in `atlas-billing`.

**Note:** Existing on-demand test subs (created while checkout set `on_demand`) still cannot use `change-plan`. Resubscribe via a new checkout after this deploy to get a schedulable plan.

### Sandbox test (no AWS CLI / no access keys)

**Preferred:** Cognito-authenticated seed API (uses your Amplify login).

1. **Lambda** env (not Amplify): `ATLAS_SANDBOX_USAGE_SEED=true` on function **`atlas-api`** → Configuration → Environment variables. Amplify env vars do **not** control Seed UI.
2. Confirm after zip upload: `GET https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health` must include `"sandboxUsageSeed":true` and `"clearTestOverage":true`.
3. API Gateway: `POST /v2/workspaces/{workspaceId}/sandbox/usage` — Cognito authorizer.
4. Upload rebuilt Lambda zip (`backend/lambda/atlas-api-deploy.zip`).
5. Sign in on Amplify → **Account** → **Seed overage (sandbox)** (shown when usage API returns `sandboxSeedEnabled: true`).
6. Click **Accept & pay overage**.
7. **Clear test overage** when done.

Or call the API while logged in (browser DevTools Network → copy any `Authorization: Bearer …` from Account):

```http
POST /v2/workspaces/65784606-8cdf-44a2-a22f-d80cf8d1a5be/sandbox/usage
{ "preset": "overage" }
```

**Fallback (AWS Console only, no keys on laptop):** DynamoDB → table `atlas-usage` → Create item  
`pk` = `WORKSPACE#65784606-8cdf-44a2-a22f-d80cf8d1a5be`, `sk` = `MONTH#2026-07`, `sessionCount` = `650` (number), `month` = `2026-07`.

### Sandbox test (local AWS keys — optional)

1. **Seed usage** (no real AR sessions needed):
   ```powershell
   cd D:\AI\atlas-webxr\atlas-webxr
   # Default sandbox workspace from project memory:
   $ws = "1ee2cb65-6252-4679-ab53-84ea36b2518f"
   npm run seed:sandbox-usage -- $ws --preset overage
   # Or explicit session count (Starter limit 500 → 650 = ~$20 overage):
   npm run seed:sandbox-usage -- $ws --sessions 650
   ```
   Requires AWS credentials with `dynamodb:PutItem` on `atlas-usage` and read on `atlas-workspaces`.
   Region defaults to `ap-south-1`. If you see auth errors, set a profile first:
   ```powershell
   $env:AWS_PROFILE = "default"   # or your admin profile name
   $env:AWS_REGION = "ap-south-1"
   ```
   **Session count** is the easiest lever — model count comes from the manifest, storage from S3 totals.

2. Open **Account** → confirm estimated overage > $0.
3. Click **Accept & pay overage** — expect paid (Dodo charge) or accepted (manual fallback on legacy subs).
4. Re-open account — button hidden; status shows paid or invoicing pending.
5. **Cleanup** when done:
   ```powershell
   npm run seed:sandbox-usage -- $ws --reset
   npm run seed:sandbox-usage -- $ws --reset-overage
   ```

