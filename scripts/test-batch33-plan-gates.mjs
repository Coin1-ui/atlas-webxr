#!/usr/bin/env node
/** Batch 33 — plan gates, tier feature defaults, storage alignment. */
import assert from "node:assert/strict";
import { sessionLogDownloadDefaultForTier } from "../backend/lambda/atlas-api/lib/workspace-feature-defaults.mjs";
import { limitsForBillingTier, limitsForWorkspace } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";
import { trialEndsAtIso } from "../backend/lambda/atlas-api/lib/trial.mjs";

assert.equal(sessionLogDownloadDefaultForTier("starter"), false);
assert.equal(sessionLogDownloadDefaultForTier("launch"), false);
assert.equal(sessionLogDownloadDefaultForTier("growth"), true);
assert.equal(sessionLogDownloadDefaultForTier("scale"), true);

const starterStorage = limitsForBillingTier("starter").storageBytes;
const launchStorage = limitsForBillingTier("launch").storageBytes;
const growthStorage = limitsForBillingTier("growth").storageBytes;
assert.equal(starterStorage, 2 * 1024 ** 3);
assert.equal(launchStorage, 5 * 1024 ** 3);
assert.equal(growthStorage, 25 * 1024 ** 3);

const growthTrial = {
  plan: "starter",
  billingTier: "starter",
  trialPlan: "growth",
  trialEndsAt: trialEndsAtIso(14),
};
assert.equal(limitsForWorkspace(growthTrial).models, 100);

const atLimit = limitsForWorkspace(growthTrial).models;
assert.equal(atLimit, 100);

console.log("test:batch33 — all passed");
