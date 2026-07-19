#!/usr/bin/env node
/** Unit checks for Batch 28 trial helpers (no AWS). */
import assert from "node:assert/strict";
import {
  effectiveBillingTier,
  hasPurchasedTrialFallback,
  isTrialActive,
  isTrialSuspended,
  planActionVerb,
  planActionVerbForTier,
  trialEndsAtIso,
  trialFallbackTier,
} from "../backend/lambda/atlas-api/lib/trial.mjs";
import { limitsForWorkspace } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";

const future = trialEndsAtIso(14);
const past = new Date(Date.now() - 86400000).toISOString();

const growthTrialWs = {
  plan: "starter",
  billingTier: "starter",
  trialPlan: "growth",
  trialEndsAt: future,
};

assert.equal(isTrialActive(growthTrialWs), true);
assert.equal(effectiveBillingTier(growthTrialWs), "growth");
assert.equal(limitsForWorkspace(growthTrialWs).models, 100);

const growthExpiredNoPurchase = { ...growthTrialWs, trialEndsAt: past };
assert.equal(isTrialActive(growthExpiredNoPurchase), false);
assert.equal(hasPurchasedTrialFallback(growthExpiredNoPurchase), false);
assert.equal(isTrialSuspended(growthExpiredNoPurchase), true);
assert.equal(limitsForWorkspace(growthExpiredNoPurchase).models, 0);

const growthExpiredWithStarter = {
  ...growthExpiredNoPurchase,
  purchasedBillingTier: "starter",
};
assert.equal(hasPurchasedTrialFallback(growthExpiredWithStarter), true);
assert.equal(isTrialSuspended(growthExpiredWithStarter), false);
assert.equal(effectiveBillingTier(growthExpiredWithStarter), "starter");
assert.equal(limitsForWorkspace(growthExpiredWithStarter).models, 5);

const growthExpiredWithProviderEntitlement = {
  ...growthExpiredNoPurchase,
  billingEntitlementTier: "launch",
  billingProvider: "dodo",
  billingStatus: "active",
  billingCurrentPeriodEnd: future,
};
assert.equal(hasPurchasedTrialFallback(growthExpiredWithProviderEntitlement), true);
assert.equal(isTrialSuspended(growthExpiredWithProviderEntitlement), false);
assert.equal(effectiveBillingTier(growthExpiredWithProviderEntitlement), "launch");
assert.equal(planActionVerb(growthExpiredWithProviderEntitlement), "Upgrade");

const providerCannotDowngradeManualGrant = {
  ...growthExpiredNoPurchase,
  manualBillingTier: "growth",
  billingEntitlementTier: "launch",
  billingProvider: "zoho",
  billingStatus: "active",
  billingCurrentPeriodEnd: future,
};
assert.equal(effectiveBillingTier(providerCannotDowngradeManualGrant), "growth");

const missedExpiryWebhookFailsClosed = {
  ...growthExpiredWithProviderEntitlement,
  billingCurrentPeriodEnd: past,
};
assert.equal(hasPurchasedTrialFallback(missedExpiryWebhookFailsClosed), false);
assert.equal(isTrialSuspended(missedExpiryWebhookFailsClosed), true);

const expiredProviderCannotFallBackToLegacyPurchase = {
  plan: "pro",
  billingTier: "growth",
  purchasedBillingTier: "growth",
  billingEntitlementTier: null,
  billingProvider: "dodo",
  trialPlan: null,
  trialEndsAt: null,
};
assert.equal(isTrialSuspended(expiredProviderCannotFallBackToLegacyPurchase), true);
assert.equal(limitsForWorkspace(expiredProviderCannotFallBackToLegacyPurchase).models, 0);

const launchTrialWs = {
  plan: "starter",
  billingTier: "launch",
  trialPlan: "launch",
  trialEndsAt: future,
};
// Starter is the universal floor after any trial.
assert.equal(trialFallbackTier("launch"), "starter");
assert.equal(trialFallbackTier("growth"), "starter");
assert.equal(effectiveBillingTier(launchTrialWs), "launch");

const launchExpiredNoPurchase = { ...launchTrialWs, trialEndsAt: past };
assert.equal(isTrialSuspended(launchExpiredNoPurchase), true);

const launchExpiredWithLaunch = {
  ...launchExpiredNoPurchase,
  purchasedBillingTier: "launch",
};
assert.equal(isTrialSuspended(launchExpiredWithLaunch), false);
assert.equal(limitsForWorkspace(launchExpiredWithLaunch).models, 30);

// Any paid plan (even Starter) keeps a Launch trial live — Starter is the floor.
const launchExpiredWithStarter = { ...launchExpiredNoPurchase, purchasedBillingTier: "starter" };
assert.equal(isTrialSuspended(launchExpiredWithStarter), false);
assert.equal(limitsForWorkspace(launchExpiredWithStarter).models, 5);

const ownerSet = {
  plan: "pro",
  billingTier: "growth",
  trialPlan: null,
  trialEndsAt: null,
};
assert.equal(effectiveBillingTier(ownerSet), "growth");

// Workspace-level Subscribe vs Upgrade — keys off whether a plan was ever purchased.
assert.equal(planActionVerb(growthTrialWs), "Subscribe"); // active trial, never paid
assert.equal(planActionVerb(launchTrialWs), "Subscribe"); // launch trial, never paid
assert.equal(planActionVerb(growthExpiredNoPurchase), "Subscribe"); // suspended, never paid
assert.equal(planActionVerb(growthExpiredWithStarter), "Upgrade"); // paying starter → higher
assert.equal(planActionVerb(launchExpiredWithLaunch), "Upgrade"); // paying launch
assert.equal(planActionVerb(ownerSet), "Subscribe"); // no purchasedBillingTier recorded

// Per-tier matrix — Subscribe for tiers ≤ trial, Upgrade for tiers above.
// Launch trial → Starter/Launch = Subscribe · Growth/Scale = Upgrade
assert.equal(planActionVerbForTier(launchTrialWs, "starter"), "Subscribe");
assert.equal(planActionVerbForTier(launchTrialWs, "launch"), "Subscribe");
assert.equal(planActionVerbForTier(launchTrialWs, "growth"), "Upgrade");
assert.equal(planActionVerbForTier(launchTrialWs, "scale"), "Upgrade");
// Growth trial → Starter/Launch/Growth = Subscribe · Scale = Upgrade
assert.equal(planActionVerbForTier(growthTrialWs, "starter"), "Subscribe");
assert.equal(planActionVerbForTier(growthTrialWs, "launch"), "Subscribe");
assert.equal(planActionVerbForTier(growthTrialWs, "growth"), "Subscribe");
assert.equal(planActionVerbForTier(growthTrialWs, "scale"), "Upgrade");
// Paying customer (Starter) moving up → Upgrade for higher tiers.
assert.equal(planActionVerbForTier(growthExpiredWithStarter, "growth"), "Upgrade");

console.log("test:batch28-unit — trial helpers OK");
