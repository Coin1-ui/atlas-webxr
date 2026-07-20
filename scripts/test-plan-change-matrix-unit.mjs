#!/usr/bin/env node
/**
 * Unit checks for paid-plan upgrade/downgrade matrix (no AWS).
 */
import assert from "node:assert/strict";
import {
  planActionVerbForTier,
  planChangeMatrix,
} from "../backend/lambda/atlas-api/lib/trial.mjs";

const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function paidWs(tier) {
  return {
    plan: "starter",
    billingProvider: "dodo",
    billingStatus: "active",
    billingEntitlementTier: tier,
    billingCurrentPeriodEnd: periodEnd,
  };
}

// Launch paid matrix
const launch = paidWs("launch");
assert.deepEqual(planChangeMatrix(launch), {
  current: "launch",
  upgrades: ["growth"],
  downgrades: ["starter"],
});
assert.equal(planActionVerbForTier(launch, "starter"), "Downgrade");
assert.equal(planActionVerbForTier(launch, "launch"), "Current");
assert.equal(planActionVerbForTier(launch, "growth"), "Upgrade");
assert.equal(planActionVerbForTier(launch, "scale"), "Upgrade");

// Starter paid matrix
const starter = paidWs("starter");
assert.deepEqual(planChangeMatrix(starter), {
  current: "starter",
  upgrades: ["launch", "growth"],
  downgrades: [],
});
assert.equal(planActionVerbForTier(starter, "starter"), "Current");
assert.equal(planActionVerbForTier(starter, "launch"), "Upgrade");
assert.equal(planActionVerbForTier(starter, "growth"), "Upgrade");

// Growth paid matrix
const growth = paidWs("growth");
assert.deepEqual(planChangeMatrix(growth), {
  current: "growth",
  upgrades: [],
  downgrades: ["starter", "launch"],
});
assert.equal(planActionVerbForTier(growth, "starter"), "Downgrade");
assert.equal(planActionVerbForTier(growth, "launch"), "Downgrade");
assert.equal(planActionVerbForTier(growth, "growth"), "Current");

// Paid reference wins over active Growth trial elevation
const launchWhileGrowthTrial = {
  ...paidWs("launch"),
  trialPlan: "growth",
  trialEndsAt: periodEnd,
};
assert.equal(planActionVerbForTier(launchWhileGrowthTrial, "starter"), "Downgrade");
assert.equal(planActionVerbForTier(launchWhileGrowthTrial, "growth"), "Upgrade");
assert.equal(planActionVerbForTier(launchWhileGrowthTrial, "launch"), "Current");

// No paid → Subscribe
const unpaid = { plan: "starter" };
assert.deepEqual(planChangeMatrix(unpaid), { current: null, upgrades: [], downgrades: [] });
assert.equal(planActionVerbForTier(unpaid, "starter"), "Subscribe");

console.log("test:plan-change-matrix — OK");
