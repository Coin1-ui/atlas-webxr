# ENG-19 — Amplify environment variables checklist

**Owner:** DevOps Automator · **Gate:** Sprint 3 close-out · **Last updated:** 2026-05-21

Set these on **every Amplify branch** that serves Atlas AR (`main`, `staging`, `develop` as applicable).

---

## Required variables (production / staging)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_ATLAS_API_URL` | `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com` | API v2 (catalog, admin, analytics). **No trailing slash.** |
| `VITE_COGNITO_REGION` | `ap-south-1` | Cognito region |
| `VITE_COGNITO_USER_POOL_ID` | `ap-south-1_XXXXXXXXX` | User Pool for sign-up / sign-in |
| `VITE_COGNITO_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` | SPA app client (no secret) |
| `VITE_PLATFORM_OWNER_EMAILS` | `director@omnimanual.com` | Platform operator — `/owner` dashboard (comma-separated) |

Optional: `VITE_BASE_PATH=/` (only if hosting under a subpath).

---

## Lambda / API Gateway (same account)

Ensure `atlas-api` Lambda has:

| Variable | Purpose |
|----------|---------|
| `COGNITO_REGION` | Match pool region |
| `COGNITO_USER_POOL_ID` | JWT validation |
| `COGNITO_CLIENT_ID` | JWT audience |
| `ATLAS_CORS_ORIGIN` | Amplify URL(s), comma-separated if multiple branches |
| `ATLAS_S3_BUCKET` | `atlas-xr-models` (or your bucket) |
| `ATLAS_PLATFORM_OWNER_EMAILS` | `director@omnimanual.com` | Platform operator API auth for `/v2/platform/*` |
| DynamoDB table names | `atlas-workspaces`, `atlas-members`, `atlas-usage` |

---

## Cognito app client callback URLs

For each Amplify branch URL, add to **Allowed callback URLs** and **Sign-out URLs**:

```
https://main.YOUR-APP.amplifyapp.com/
https://main.YOUR-APP.amplifyapp.com/login
https://main.YOUR-APP.amplifyapp.com/onboard
https://main.YOUR-APP.amplifyapp.com/admin
```

Repeat for `staging.*` if used. Local dev: `http://localhost:5173` (see `backend/scripts/create-cognito-pool.mjs`).

---

## Console steps (Amplify)

1. AWS Console → **Amplify** → your app → **Hosting** → **Environment variables**
2. Add all four `VITE_*` keys for **main** (and each branch)
3. **Redeploy** the branch (env vars are baked at build time)
4. Confirm build log shows variables (names only — values are masked)

---

## Verification (automated)

From repo root:

```powershell
# Default: https://main.d3t9wmef56h86w.amplifyapp.com
$env:ATLAS_DEPLOY_URL = "https://main.d3t9wmef56h86w.amplifyapp.com"
npm run verify:amplify-env
```

Pass criteria:

- Home returns 200
- Built JS bundle includes Cognito pool id pattern (not dev-auth-only build)
- `GET {VITE_ATLAS_API_URL}/health` returns `{ ok: true, service: "atlas-api" }`

Full tenant API checks (optional):

```powershell
$env:ATLAS_API_URL = "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com"
$env:ATLAS_TEST_WORKSPACE_SLUG = "owner"
$env:ATLAS_TEST_WORKSPACE_ID = "2a727889-a0a2-49dc-8da8-ffb2822cbb85"
$env:ATLAS_TEST_ID_TOKEN = "eyJ..."   # Cognito ID token from browser after sign-in
npm run test:sprint3-api
```

---

## Sign-off

| Branch | Env vars set | Redeployed | verify:amplify-env | Signed |
|--------|--------------|------------|--------------------|--------|
| main | ☐ | ☐ | ☐ | |
| staging | ☐ | ☐ | ☐ | |
| develop | ☐ | ☐ | ☐ | |

When all **main** checks pass → mark **ENG-19 done** in [backlog.md](./backlog.md).
