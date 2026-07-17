# Post-28 Deploy — Trial Suspension + Subscribe/Upgrade Matrix + Coupon Promo

**Date:** 2026-07-04
**Builds on:** [BATCH-28-DEPLOY.md](./BATCH-28-DEPLOY.md) (14-day trial base)
**Live app:** https://main.d3t9wmef56h86w.amplifyapp.com
**API:** `https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com` (Lambda `atlas-api`, region `ap-south-1`)

> This ships the code developed **after** Batch 28: trial → **suspension** (not silent downgrade),
> the per-tier **Subscribe vs Upgrade** messaging matrix, and the **owner coupon → pricing banner**
> promo system. FE + Lambda **must ship together**.

> ## ✅ DEPLOY STATUS: LIVE (verified 2026-07-04, read-only)
> - **Frontend:** prod bundle `main-BB60yeu-.js` = exact content hash of the Post-28 build; contains
>   `On pricing banner`, `showOnPricing`, `billing/upgrade`, `Subscribe` markers (`check:owner-ui-deploy`).
> - **Lambda:** `GET /v2/platform/public-settings` returns `promo` (`null` until a banner coupon exists);
>   all `/v2/platform/*` routes reachable w/ CORS; `check:platform-api` → `ownerDashboardReady: true`.
> - **Still to verify (needs owner/customer Cognito token):** authenticated coupon→banner E2E, trial
>   suspension enforcement, `test:batch28` Growth-limits regression. See §4.
>
> The build/package steps below remain the canonical procedure for the **next** redeploy.

---

## 0. Artifacts (already built locally)

| Artifact | Path | Status |
|----------|------|--------|
| Frontend bundle | `atlas-webxr/dist/` | ✅ `npm run build` clean (tsc + vite) |
| Lambda zip | `atlas-webxr/backend/lambda/atlas-api-deploy.zip` (~4.75 MB) | ✅ `npm run package` (prod deps only) |
| Unit gate | `npm run test:batch28:unit` | ✅ pass |
| ENG-19 env verify | `npm run verify:amplify-env` | ✅ 4/4 (home, API URL, Cognito, /health) |

Rebuild any time with:

```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run build
cd backend\lambda\atlas-api
npm run package   # -> ..\atlas-api-deploy.zip
```

---

## 1. What changed since Batch 28

### Backend (`atlas-api` Lambda)

| File | Change |
|------|--------|
| `lib/trial.mjs` | `trialFallbackTier` → always `"starter"` (universal paid floor); `isTrialSuspended`, `SUSPENDED_LIMITS`, `hasPurchasedTrialFallback`; per-tier `planActionVerbForTier` + workspace `planActionVerb`; `purchasedBillingTier` awareness |
| `lib/plan-limits.mjs` | `limitsForWorkspace` returns **zero** `SUSPENDED_LIMITS` when trial expired w/o qualifying purchase |
| `lib/dynamodb.mjs` | `PlatformCouponRecord` gains `showOnPricing` + `bannerText`; `couponFromItem` normalizer; **`getActivePromo()`** (most-recent non-expired coupon flagged `showOnPricing`); persist `purchasedBillingTier` |
| `handlers/v2-billing.mjs` | **NEW** `handleBillingUpgrade` → `POST /v2/workspaces/{id}/billing/upgrade` records the paid tier into `purchasedBillingTier` |
| `handlers/v2-platform.mjs` | `handleCreatePlatformCoupon` accepts `showOnPricing`/`bannerText`; `handleGetPlatformPublicSettings` now embeds `promo` from `getActivePromo()` |
| `handlers/v2-public-config.mjs` | Suspension gate — suspended workspace returns paused state |
| `handlers/v2-models.mjs` | Suspension gate on public catalog + upload |
| `handlers/v2-usage.mjs` | Emits trial/suspension detail (`trialPlan`, `trialEndsAt`, `billingTier`, `purchasedBillingTier`, suspended flag) |

### Frontend (Amplify)

| File | Change |
|------|--------|
| `src/shared/trial.ts` | `planActionVerbForTier`, `trialCtaTiers`, `trialCtaSentence`; banners use dynamic Subscribe/Upgrade sentence |
| `src/shared/plan-display.ts` | Suspended workspaces see all self-serve tiers as re-subscribe options |
| `src/ui/account-page.ts` | Per-tier CTA verb on plan cards; live countdown |
| `src/ui/owner-dashboard.ts` | Coupon form gains **Show on pricing banner** checkbox + **Banner text**; list shows "On pricing banner" badge |
| `src/ui/marketing-pricing.ts` | Banner renders from live `promo` (text + code) instead of hardcoded founding offer |
| `src/data/platform-api.ts` | `PlatformCoupon` + `PublicPromo` types; `fetchPublicPromo()` (no-auth, resilient) |
| `src/main.ts` | `showPricingPage` async — fetches promo, re-renders banner |
| `plugins/atlas-saas-api.ts` | Dev-server parity for coupon fields + `promo` in public-settings |

### DynamoDB (additive — no migration)

- New workspace fields: `purchasedBillingTier` (null until a paid upgrade is recorded).
- Coupon items gain `showOnPricing` (bool) + `bannerText` (string).
- Existing rows unaffected; missing fields treated as `null`/`false`.

---

## 2. Deploy — Lambda (`atlas-api`)

AWS CLI is not required if you use the Console. **Region: `ap-south-1`.**

### Option A — Console upload
1. Lambda → Functions → **`atlas-api`** → **Code** tab.
2. **Upload from** → **.zip file** → select `atlas-webxr\backend\lambda\atlas-api-deploy.zip`.
3. **Save** and wait for "Successfully updated".

### Option B — AWS CLI
```powershell
aws lambda update-function-code `
  --function-name atlas-api `
  --zip-file fileb://d:\AI\agency-agents\atlas-webxr\backend\lambda\atlas-api-deploy.zip `
  --region ap-south-1
```

### Verify Lambda live
```powershell
# health
curl https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/health
# public-settings MUST now contain a "promo" key (null if no active coupon)
curl https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/v2/platform/public-settings
```
**Pass:** `public-settings` JSON includes a `promo` field (value `null` until a `showOnPricing` coupon exists).

---

## 3. Deploy — Amplify frontend

1. Push `main` (Amplify auto-builds the connected branch), **or** trigger a redeploy in the Amplify console.
2. Env vars unchanged — ENG-19 verify already confirms `VITE_ATLAS_API_URL` + Cognito are baked (see §5).
3. Wait for the Amplify build to reach **Deployed**.

> Ship order: **Lambda first, then Amplify** (or together). Never ship FE promo UI before the
> Lambda returns `promo`, or the banner fetch is a no-op (fails safe to no banner — non-breaking).

---

## 4. Smoke tests (post-deploy)

### A. Offline (no AWS) — already green
```powershell
cd d:\AI\agency-agents\atlas-webxr
npm run test:batch28:unit
```

### B. Coupon → pricing banner (owner + public)
1. Owner dashboard → Discounts → create coupon, e.g. `FOUNDING10`, 34% off Growth, **Show on pricing banner ✓**, banner text = `Founding offer — Growth at Launch price for 12 months`.
2. `curl .../v2/platform/public-settings` → `promo.code === "FOUNDING10"`, `promo.text` set.
3. Load `/pricing` (hard refresh) → banner shows the coupon text + code.
4. Delete the coupon in owner dashboard → `public-settings.promo` returns to `null` → banner disappears on reload.

### C. Subscribe vs Upgrade matrix (account page)
- **Launch trial** workspace → banner/CTAs say **Subscribe** to Starter/Launch, **Upgrade** to Growth/Scale.
- **Growth trial** workspace → **Subscribe** to Starter/Launch/Growth, **Upgrade** to Scale.

### D. Trial suspension
- Force an expired trial with **no** qualifying purchase (`purchasedBillingTier` null) → `/usage` returns suspended (zero limits); `/public-config` + `/catalog` return paused; `/account` still reachable to re-subscribe.
- Record a purchase via `POST /v2/workspaces/{id}/billing/upgrade` (tier ≥ starter) → suspension clears; limits restored.

### E. Regression (Batch 28 base)
```powershell
$env:ATLAS_TEST_ID_TOKEN = "<Cognito ID token or dev:you@company.com>"
$env:ATLAS_TEST_WORKSPACE_ID = "<workspace uuid>"
npm run test:batch28
```
**Pass:** active trial → Growth limits (`models 100`, `sessionsPerMonth 10000`).

---

## 5. ENG-19 sign-off (Amplify env)

```powershell
$env:ATLAS_DEPLOY_URL="https://main.d3t9wmef56h86w.amplifyapp.com"
npm run verify:amplify-env
```
**Current result: 4/4 pass** — home 200, bundle references API Gateway URL, bundle includes Cognito
config, API `/health` 200. Report at `test-results/amplify-env-verify.json`.

> Single-branch deploy (`main`). `staging`/`develop` are not connected — if added later, re-run this
> verify with `ATLAS_DEPLOY_URL` pointed at that branch's Amplify URL before promoting.

---

## 6. Rollback

| Layer | Action |
|-------|--------|
| Lambda | Re-upload the previous `atlas-api-deploy.zip` (keep last-known-good), or Lambda → **Versions** → revert alias |
| Amplify | Redeploy the previous successful build from the Amplify console |
| Data | All new fields are additive/nullable — **no destructive migration**; safe to roll back FE/Lambda independently |

**Fail-safe:** if only the Lambda rolls back, `fetchPublicPromo()` on the FE simply returns no promo
(banner hidden). If only the FE rolls back, the Lambda `promo` field is ignored. Neither breaks.

---

## 7. Post-deploy backlog updates

- [ ] `backlog.md` — mark Post-28 (coupon promo + Subscribe/Upgrade matrix + suspension) **prod verified**
- [ ] `PRICING-FEATURE-READINESS.md` — note prod-verified date for suspension + promo
- [ ] Confirm Phase 1 close-out (ENG-17 analytics events verified live; ENG-19 ✅; DES-1/DES-2 docs landed)
- [ ] Proceed to **Batch 29** (Zoho Billing MVP) once merchant entity (US vs India) is decided
