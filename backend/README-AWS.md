# Atlas XR — AWS Amplify deploy

Private repo: [Coin1-ui/atlas-webxr](https://github.com/Coin1-ui/atlas-webxr)

## Frontend (Amplify Hosting)

1. Connect the GitHub repo in **AWS Amplify Console** (private repo via GitHub OAuth).
2. Set **app root** to repository root (or `atlas-webxr` if monorepo).
3. Use `amplify.yml` in this folder (or repo root).
4. Environment variables in Amplify → **Environment variables**:

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_ATLAS_API_URL` | `https://abc123.execute-api.us-east-1.amazonaws.com/prod` | Model upload + manifest API |
| `VITE_BASE_PATH` | `/` | Use `/` for Amplify; `/atlas-webxr/` for GitHub Pages |

Live app: https://main.d7vfdpujdozkj.amplifyapp.com/

## Backend (Lambda + S3)

Deploy `backend/lambda/models-api` as a Lambda behind API Gateway (v1 models catalog).

Deploy `backend/lambda/atlas-api` for **Atlas AR SaaS v2** (Sprint 1+):

| Method | Path | Auth | Action |
|--------|------|------|--------|
| GET | `/health` | — | Health check |
| GET | `/v2/workspaces/{slug}/public-config` | — | Tenant branding (public) |
| GET | `/v2/me/workspaces` | Cognito JWT | List workspaces for user |
| GET | `/v2/workspaces/{slug}/catalog` | — | Public model manifest (AR viewer) |
| GET | `/v2/workspaces/{slug}/catalog/assets/{file}` | — | Public GLB/icon/USDZ asset |
| GET | `/v2/workspaces/{workspaceId}/models/manifest` | Cognito JWT + admin | Admin model list |
| POST | `/v2/workspaces/{workspaceId}/models/upload` | Cognito JWT + admin | `{ action: "presign" \| "complete" }` |
| DELETE | `/v2/workspaces/{workspaceId}/models/{modelId}` | Cognito JWT + admin | Remove model |
| GET | `/v2/workspaces/{workspaceId}/billing/status` | Cognito JWT + admin | Provider subscription and current entitlement |
| POST | `/v2/workspaces/{workspaceId}/billing/checkout` | Cognito JWT + admin | Routed hosted checkout; requires `Idempotency-Key` |
| POST | `/v2/workspaces/{workspaceId}/billing/portal` | Cognito JWT + admin | Provider customer portal |
| POST | `/v2/workspaces/{workspaceId}/billing/plan` | Cognito JWT + admin | Immediate upgrade or renewal downgrade |
| POST | `/v2/workspaces/{workspaceId}/billing/cancel` | Cognito JWT + admin | Cancel at renewal, or `{ cancelScheduledPlanChange: true }` to clear pending plan change |
| POST | `/v2/billing/webhooks/dodo` | Dodo signature | Public Dodo event trigger; no Cognito authorizer |
| POST | `/v2/billing/webhooks/zoho-payments` | Zoho Payments signature | Public Zoho event trigger; no Cognito authorizer |
| POST | `/v2/platform/billing/refunds` | Platform owner JWT | Manual approved refund; requires `Idempotency-Key` |

S3 layout: `tenants/{workspaceId}/models/` (legacy workspace can use `models/` when `ATLAS_LEGACY_USE_ROOT_PREFIX=true`).

Additional Lambda env:

| Variable | Purpose |
|----------|---------|
| `ATLAS_MODELS_BUCKET` | S3 bucket for all tenant assets |
| `ATLAS_USAGE_TABLE` | Monthly usage counters |
| `ATLAS_TENANTS_PREFIX` | Default `tenants` |
| `ATLAS_LEGACY_USE_ROOT_PREFIX` | `true` maps legacy workspace to old `models/` prefix |


```powershell
cd backend/lambda/atlas-api
npm ci
npm run package
# Upload backend/lambda/atlas-api-deploy.zip to Lambda (handler: index.handler)
```

Lambda environment (atlas-api):

| Variable | Example | Purpose |
|----------|---------|---------|
| `ATLAS_WORKSPACES_TABLE` | `atlas-workspaces` | DynamoDB workspaces + slug index |
| `ATLAS_MEMBERS_TABLE` | `atlas-members` | User ↔ workspace membership |
| `ATLAS_USAGE_TABLE` | `atlas-usage` | Monthly usage and session deduplication |
| `ATLAS_BILLING_TABLE` | `atlas-billing` | Immutable provider events and subscription projection |
| `ATLAS_BILLING_ENABLED` | `false` until sandbox approval | Enables hosted checkout creation |
| `ATLAS_ZOHO_CHECKOUT_ENABLED` | `false` until Zoho reconciliation approval | Independently enables India checkout |
| `ATLAS_DODO_WEBHOOK_ENABLED` | `false` until sandbox approval | Enables signed Dodo webhook reconciliation |
| `ATLAS_ZOHO_WEBHOOK_ENABLED` | `false` until Zoho sandbox approval | Enables signed Zoho Payments reconciliation |
| `ATLAS_ZOHO_BOOKS_SYNC_ENABLED` | `false` until accounting approval | Enables scheduled Zoho Books invoice/payment mirror |
| `ATLAS_BILLING_DLQ_URL` | SQS queue URL | Receives exhausted accounting jobs |
| `ATLAS_BILLING_APP_ORIGIN` | Exact HTTPS Amplify origin | Allowlist for all billing return URLs |
| `ATLAS_BILLING_RETURN_URL` | Account return URL | Hosted checkout and portal return |
| `ATLAS_BILLING_CANCEL_URL` | Account cancellation URL | Dodo checkout cancellation return |
| `DODO_PAYMENTS_ENV` | `test_mode` or `live_mode` | Explicit Dodo API environment |
| `DODO_PAYMENTS_API_KEY` | secret | Dodo server API credential |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | secret | Standard Webhooks signing secret |
| `DODO_PAYMENTS_BUSINESS_ID` | Dodo business ID | Reject events for another business |
| `DODO_PRODUCT_*_MONTHLY` | Dodo product IDs | Environment-specific tier mapping |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_BILLING_REFRESH_TOKEN` | secrets | India Zoho Billing OAuth |
| `ZOHO_BILLING_ORGANIZATION_ID` | Zoho organization ID | Billing API organization |
| `ZOHO_BILLING_PORTAL_URL` | Zoho customer portal HTTPS URL | India subscription management |
| `ZOHO_PAYMENTS_WEBHOOK_SECRET` | secret | Zoho Payments webhook HMAC |
| `ZOHO_PLAN_*_MONTHLY` | Zoho plan codes | India tier mapping |
| `ZOHO_BOOKS_REFRESH_TOKEN` | secret | Zoho Books OAuth |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Zoho Books organization ID | Accounting destination |
| `ZOHO_BOOKS_SUBSCRIPTION_ITEM_ID` | Zoho Books item ID | Invoice line item |
| `ZOHO_BOOKS_CLEARING_CONTACT_<CURRENCY>` | Zoho Books contact ID | One clearing contact per accepted currency |
| `ZOHO_BOOKS_INVOICE_UNIQUE_FIELD_API_NAME` / `_ID` | Unique custom field | Crash-safe invoice upsert |
| `ZOHO_BOOKS_PAYMENT_UNIQUE_FIELD_API_NAME` / `_ID` | Unique custom field | Crash-safe customer-payment upsert |
| `COGNITO_USER_POOL_ID` | `ap-south-1_xxxxx` | JWT validation |
| `COGNITO_CLIENT_ID` | `xxxxxxxx` | JWT audience |
| `COGNITO_REGION` | `ap-south-1` | Cognito region |
| `ATLAS_CORS_ORIGIN` | `https://main.dxxx.amplifyapp.com` | CORS allow origin |
| `ATLAS_PLATFORM_OWNER_EMAILS` | `you@company.com` | Owner dashboard + sales deck toggle |
| `ATLAS_DEV_MODE` | `false` | Set `true` only in local dev stacks |

Billing ledger IAM for the `atlas-api` Lambda role:

- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:Query`, and `dynamodb:TransactWriteItems` on the `ATLAS_BILLING_TABLE` ARN.
- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem` on the `ATLAS_USAGE_TABLE` ARN.
- `dynamodb:UpdateItem` and `dynamodb:TransactWriteItems` on the `ATLAS_WORKSPACES_TABLE` ARN.
- `sqs:SendMessage` on the queue referenced by `ATLAS_BILLING_DLQ_URL`.
- Keep both table resources in the same account and region so the ledger append and workspace entitlement projection can use one DynamoDB transaction.

Create an EventBridge Scheduler rule (for example, every five minutes) targeting the same
`atlas-api` Lambda. The scheduled event runs the Zoho Books accounting worker. Configure a
Lambda destination or SQS DLQ for failed asynchronous invocations; jobs also move to the
`dead_letter` state after five provider failures for operator reconciliation.

**Platform routes** (add in API Gateway → same Lambda):

| Method | Path | Auth | Action |
|--------|------|------|--------|
| GET | `/v2/platform/workspaces` | Platform owner JWT | List all workspaces |
| PATCH | `/v2/platform/workspaces/{id}` | Platform owner JWT | Plan / features / restrict |
| GET | `/v2/platform/coupons` | Platform owner JWT | List coupons |
| GET | `/v2/platform/settings` | Platform owner JWT | Read sales deck active flag |
| PATCH | `/v2/platform/settings` | Platform owner JWT | `{ "salesDeckActive"?: boolean, "mkt3StoryboardActive"?: boolean }` (at least one) |
| GET | `/v2/platform/public-settings` | — | Public `{ "salesDeckActive", "mkt3StoryboardActive" }` for `/sales-deck/` and `/mkt-3-storyboard/` |

Settings persist in DynamoDB (`pk=PLATFORM#SETTINGS`, `sk=SETTINGS` on workspaces table). No new table required.

After Lambda deploy, verify:

```powershell
node scripts/check-platform-api.mjs
```

Then redeploy Amplify so `VITE_ATLAS_API_URL` is baked into `public/sales-deck/config.json` at build time.

### DynamoDB + Cognito setup scripts

```powershell
node backend/scripts/create-dynamodb-tables.mjs
node backend/scripts/create-cognito-pool.mjs   # prints AWS CLI commands
node backend/scripts/migrate-legacy-workspace.mjs
```

### Frontend Cognito env (Amplify)

| Variable | Purpose |
|----------|---------|
| `VITE_COGNITO_REGION` | Same as Lambda |
| `VITE_COGNITO_USER_POOL_ID` | User pool id |
| `VITE_COGNITO_CLIENT_ID` | SPA app client id |

Without Cognito env vars, **local dev** uses mock auth (`dev:{sub}` tokens) and `.atlas-dev/workspaces.json`.

---

### v1 models API (existing)

Deploy `backend/lambda/models-api` as a Lambda behind API Gateway:

| Method | Path | Action |
|--------|------|--------|
| GET | `/models/manifest` | Read manifest.json from S3 |
| GET | `/models/assets/{file}` | Serve icon/glb from S3 |
| POST | `/models/upload` | JSON `{ action: "presign" \| "complete" }` or multipart (legacy) |
| DELETE | `/models/{id}` | Remove model + update manifest |

Lambda environment:

- `ATLAS_MODELS_BUCKET` — S3 bucket name (e.g. `atlas-xr-models-prod`)
- `ATLAS_MODELS_PREFIX` — optional prefix (default `models/`)

### Quick S3 setup

1. Create bucket `atlas-xr-models-prod` (block public access OK).
2. Lambda role: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `bucket/*`.
3. API Gateway: enable **CORS** for your Amplify domain.
4. Binary media types: `multipart/form-data`, `model/gltf-binary`, `image/*`.

**API Gateway CORS (required for Manage 3D models in the browser)**

HTTP API must allow your Amplify origin or the browser blocks manifest/upload requests.

1. Open [API Gateway → your HTTP API → CORS](https://ap-south-1.console.aws.amazon.com/apigateway/main/apis?region=ap-south-1).
2. **Configure CORS**:
   - **Access-Control-Allow-Origin**: `https://main.d7vfdpujdozkj.amplifyapp.com` (**no trailing slash** — the browser sends the origin without `/`)
   - **Access-Control-Allow-Methods**: `GET, POST, DELETE, OPTIONS`
   - **Access-Control-Allow-Headers**: `content-type, authorization, idempotency-key`
3. Save, wait ~1 minute, then verify (see below).

**Important:** When API Gateway CORS is enabled, it **ignores** CORS headers from Lambda. If the allowed origin does not **exactly** match the browser `Origin` header, API Gateway adds **no** `Access-Control-Allow-Origin` at all — and the browser shows “Failed to fetch”.

Common mistake: setting origin to `https://main.d7vfdpujdozkj.amplifyapp.com/` (with trailing slash). That does **not** match the browser origin and CORS will fail silently.

**Verify CORS is working** (must show `access-control-allow-origin` in output):

```powershell
node -e "fetch('https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/models/manifest',{headers:{Origin:'https://main.d7vfdpujdozkj.amplifyapp.com'}}).then(r=>{console.log('acao',r.headers.get('access-control-allow-origin')); return r.json()}).then(console.log)"
```

Expected: `acao https://main.d7vfdpujdozkj.amplifyapp.com`

If `acao null`, CORS is still wrong — fix origin (no slash) or temporarily set origin to `*` to test.

Without working CORS, **Manage 3D models** shows “Failed to fetch”.

### S3 bucket CORS (required for large uploads)

API Gateway limits request bodies to **~10 MB**. The app uploads GLB/USDZ **directly to S3** via presigned URLs. The bucket needs CORS for browser `PUT`:

1. Open [S3 → your models bucket → Permissions → CORS](https://s3.console.aws.amazon.com/s3/home?region=ap-south-1).
2. Paste (replace origin if needed):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["https://main.d7vfdpujdozkj.amplifyapp.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

3. Save. Without this, uploads fail at ~99% with S3/CORS errors after the API presign step.

### Upload 413 (payload too large)

If you see **HTTP 413** at ~99%, the old single-request upload exceeded API Gateway’s ~10 MB cap. Fix:

1. Redeploy Lambda with presign on **POST /models/upload** (JSON `action: "presign"`) — v0.1.121+.
2. Redeploy Amplify frontend (same version).
3. Add **S3 bucket CORS** (above).

After that, icon + GLB + USDZ upload separately to S3 (each file can be much larger).

### Wire API to Amplify

After API deploy, set `VITE_ATLAS_API_URL` in Amplify and **redeploy** the frontend.

### Upload returns HTML or stuck at low %

1. Open **Manage 3D models (PC)** — the subtitle must say **Connected to AWS API**, not "Local dev API".
2. In Amplify → **Environment variables**, add:
   - Name: `VITE_ATLAS_API_URL`
   - Value: `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com` (no trailing slash)
3. **Redeploy** the Amplify app (env vars are baked in at build time; changing them does not affect a running build).
4. In Amplify build logs, confirm: `VITE_ATLAS_API_URL is set for this build.`
5. Re-upload. Progress 2–10% is GLB→USDZ conversion; 10%+ is the actual POST to API Gateway.

### Redeploy Lambda (USDZ support, v0.1.118+)

The handler accepts optional `usdz` on POST `/models/upload`, serves `.usdz` as `model/vnd.usdz+zip`, and deletes USDZ on model removal.

**Option A — AWS Console (no CLI)**

1. Open [Lambda → ap-south-1](https://ap-south-1.console.aws.amazon.com/lambda/home?region=ap-south-1#/functions).
2. Find the function linked to API Gateway `rusf3nnyu7` (search **atlas** or **model**).
3. **Code** → **Upload from** → **.zip file**.
4. Select `backend/lambda/models-api-deploy.zip` (create it first — see below).
5. Confirm **Handler** = `index.handler`, **Runtime** = Node.js 18.x or 20.x.
6. Env vars: `ATLAS_MODELS_BUCKET`, optional `ATLAS_MODELS_PREFIX` (default `models/`).
7. **Configuration** → **General** → **Timeout** ≥ **30 seconds** (uploads with USDZ can be slow).
8. Save, then smoke-test: `POST /models/upload` should accept multipart with `icon`, `glb`, optional `usdz`.

**Option B — package + AWS CLI**

```powershell
cd backend/lambda/models-api
npm run package
# Replace YOUR_FUNCTION_NAME with the Lambda name from the console
npm run deploy -- -FunctionName YOUR_FUNCTION_NAME
```

Or manually:

```powershell
aws lambda update-function-code `
  --region ap-south-1 `
  --function-name YOUR_FUNCTION_NAME `
  --zip-file "fileb://D:/AI/agency-agents/atlas-webxr/backend/lambda/models-api-deploy.zip"
```

**Create / refresh the zip**

```powershell
cd backend/lambda/models-api
npm run package
```

Output: `backend/lambda/models-api-deploy.zip` (~3 MB) containing `index.mjs`, `package.json`, `node_modules/`.

**Verify after deploy**

```powershell
# Should return {"error":"multipart required"} — proves POST route + new code
node -e "fetch('https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/models/upload',{method:'POST'}).then(r=>r.text().then(console.log))"
```

## Local dev (no AWS)

```bash
npm run dev:phone
```

Uses the built-in Vite plugin — uploads go to `public/custom-models/`.

## GitHub Pages (optional)

Set `VITE_BASE_PATH=/atlas-webxr/` at build time. Models can stay on AWS via `VITE_ATLAS_API_URL`.
