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
  - `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `Scan`, and `TransactWriteItems` on `atlas-billing`.
  - `dynamodb:UpdateItem` and `TransactWriteItems` on `atlas-workspaces`.
- API Gateway routes:
  - `POST /v2/billing/webhooks/dodo` — no Cognito authorizer.
  - `POST /v2/workspaces/{workspaceId}/billing/checkout` — Cognito authorizer.
  - `GET /v2/workspaces/{workspaceId}/billing/status` — Cognito authorizer.
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

When all dashboard values are configured, report only that setup is complete—do not send secret values.
