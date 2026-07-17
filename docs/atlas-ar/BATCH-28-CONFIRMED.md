# Batch 28 — LEG-1 signup trust + ENG-36 auto Growth trial · confirmed

**Date:** 2026-05-21  
**User gate:** Confirmed ✅

## Deliverables

| Item | Location |
|------|----------|
| Auto 14-day Growth trial on workspace create | [`src/shared/trial.ts`](../../src/shared/trial.ts) · [`plugins/atlas-saas-api.ts`](../../plugins/atlas-saas-api.ts) |
| Effective tier for limits/usage | `effectiveBillingTier()` · plan-limits + dev usage API |
| Trial UI (admin banner, account label, owner meta) | account-page · admin-dashboard · owner-dashboard |
| Signup Terms + Privacy checkbox | [`auth-signup.ts`](../../src/ui/auth-signup.ts) |
| Auth legal footer | [`auth-shell.ts`](../../src/ui/auth-shell.ts) |
| Entity: Omni Manual Private Limited | [`legal-content.ts`](../../src/ui/legal-content.ts) |
| Counsel review pack | [`docs/atlas-ar/legal/`](./legal/) |
| Scope doc | [BATCH-28-SCOPE.md](./BATCH-28-SCOPE.md) |

## Behavior

1. **New workspace** → `billingTier: starter`, `trialPlan: growth`, `trialEndsAt: +14 days`
2. **During trial** → Growth limits (100 models / 5k sessions) without owner action
3. **After trial** → Starter limits (lazy on read; no cron)
4. **Owner sets plan** → clears `trialEndsAt` / `trialPlan`
5. **Signup** → required Terms + Privacy consent before account creation

## Deploy

- **Checklist:** [BATCH-28-DEPLOY.md](./BATCH-28-DEPLOY.md)
- **Lambda:** `backend/lambda/atlas-api` — trial fields + usage effective tier
- **Smoke:** `npm run test:batch28:unit` · `npm run test:batch28` (with `ATLAS_TEST_ID_TOKEN`)

## QA

- [ ] New signup → onboard → usage shows Growth limits
- [ ] Account shows “Growth trial · N days left”
- [ ] Owner Save plan clears trial
- [ ] Signup blocked without checkbox

## Next

- **Batch 29:** BILL-1 Stripe + ENG-37 plan-gated JSON log + BILL-3 overage
