# Batch 28 — Deploy checklist (LEG-1 + ENG-36)

**Date:** 2026-05-21  
**Prerequisite:** Frontend Batch 28 merged and built locally (`npm run build` ✅)  
**Live app:** https://main.d3t9wmef56h86w.amplifyapp.com  
**API:** `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com`

---

## What this deploy enables

| Feature | Frontend | Backend |
|---------|----------|---------|
| Signup Terms + Privacy checkbox | `auth-signup.ts` | — |
| Auth legal footer | `auth-shell.ts` | — |
| 14-day Growth trial on workspace create | onboard copy | `POST /v2/workspaces` |
| Trial countdown (Account / Admin) | `trial.ts` UI | workspace JSON fields |
| Growth limits during trial | `effectiveBillingTier` | `v2-usage.mjs` + DynamoDB |

---

## 1. Lambda patch summary (ENG-36)

**Package:** `backend/lambda/atlas-api/`

| File | Change |
|------|--------|
| `lib/trial.mjs` | **NEW** — `isTrialActive`, `trialEndsAtIso`, `effectiveBillingTier` |
| `lib/dynamodb.mjs` | `createWorkspace` sets `billingTier`, `trialPlan`, `trialEndsAt`; read/write fields; owner PATCH clears trial |
| `lib/plan-limits.mjs` | `limitsForWorkspace` + `buildUsageWarnings` use `effectiveBillingTier` |
| `handlers/v2-usage.mjs` | Growth limits during trial; returns `billingTier` in response |
| `handlers/v2-platform.mjs` | Accept `billingTier` on platform PATCH (matches owner dashboard) |

### DynamoDB fields (additive — no migration)

On **new** workspace `META` item:

```json
{
  "plan": "starter",
  "billingTier": "starter",
  "trialPlan": "growth",
  "trialEndsAt": "<ISO +14 days>"
}
```

**Owner sets plan** (`PATCH /v2/platform/workspaces/{id}` with `billingTier`): clears `trialEndsAt` and `trialPlan`.

**Existing workspaces:** no backfill — they keep current limits until owner assigns tier or customer creates a new workspace.

---

## 2. Lambda deploy steps

From repo root (adjust for your AWS profile/region):

```powershell
cd d:\AI\agency-agents\atlas-webxr\backend\lambda\atlas-api

# If you use a deploy script, run it; otherwise zip + update-function-code:
# Compress-Archive -Path * -DestinationPath atlas-api.zip -Force
# aws lambda update-function-code --function-name atlas-api --zip-file fileb://atlas-api.zip --region ap-south-1
```

**Verify after deploy:**

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run test:batch28:unit
curl https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health
```

---

## 3. Amplify frontend deploy

1. Push `main` (or trigger Amplify build on connected branch).
2. Confirm build includes Batch 28 assets:
   - Signup checkbox visible at `/signup`
   - Legal links in auth footer
3. **Env vars** (unchanged but verify): [AMPLIFY-ENV-CHECKLIST.md](./AMPLIFY-ENV-CHECKLIST.md)
   - `VITE_ATLAS_API_URL`
   - Cognito pool/client IDs

---

## 4. Smoke tests

### A. Unit (no AWS)

```powershell
npm run test:batch28:unit
```

### B. API — read-only (existing workspace)

```powershell
$env:ATLAS_TEST_ID_TOKEN = "<Cognito ID token or dev:you@company.com>"
$env:ATLAS_TEST_WORKSPACE_ID = "<workspace uuid>"
npm run test:batch28
```

**Pass:** During active trial → `limits.models === 100`, `limits.sessionsPerMonth === 10000`.

### C. API — create throwaway workspace

```powershell
$env:ATLAS_BATCH28_CREATE = "1"
$env:ATLAS_TEST_ID_TOKEN = "<token>"
npm run test:batch28
```

**Pass:** `trialPlan: growth`, `trialEndsAt` in future, `billingTier: starter`, usage limits = Growth.

### D. Manual UI (prod)

- [ ] `/signup` — cannot submit without Terms checkbox
- [ ] Sign up → onboard → **Account** shows “Growth trial · N days left”
- [ ] **Admin** — trial banner visible
- [ ] Usage panel shows **100** model limit (not 5)
- [ ] Owner dashboard — Save plan on Growth clears trial meta

### E. QA-5 spot (SAL-3 gate)

- [ ] New signup → upload GLB → floor placement ≤15 min (Android + iOS)

---

## 5. Rollback

| Layer | Action |
|-------|--------|
| Lambda | Redeploy previous `atlas-api` zip from last known good |
| Amplify | Redeploy previous successful build |
| Data | Trial fields on new workspaces are harmless; no destructive migration |

---

## 6. Post-deploy backlog updates

After smoke passes:

- [ ] Mark Batch 28 deploy complete in `backlog.md` immediate actions
- [ ] Update `PRICING-FEATURE-READINESS.md` — note **prod verified** date
- [ ] Proceed to **Batch 29** scope (BILL-1 + BILL-3 + ENG-37) — user confirm

---

## Related

- [BATCH-28-CONFIRMED.md](./BATCH-28-CONFIRMED.md)  
- [BATCH-28-SCOPE.md](./BATCH-28-SCOPE.md)  
- Dev plugin parity: `plugins/atlas-saas-api.ts` (local `npm run dev`)
