#!/usr/bin/env node
<<<<<<< Updated upstream
/** Batch 33 — plan gates, tier feature defaults, storage alignment. */
import assert from "node:assert/strict";
import { sessionLogDownloadDefaultForTier } from "../backend/lambda/atlas-api/lib/workspace-feature-defaults.mjs";
import { limitsForBillingTier, limitsForWorkspace } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";
=======
/** Batch 33 — plan gates, tier feature defaults, storage alignment (50 MB × 2.5). */
import assert from "node:assert/strict";
import { sessionLogDownloadDefaultForTier } from "../backend/lambda/atlas-api/lib/workspace-feature-defaults.mjs";
import { limitsForBillingTier, limitsForWorkspace } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";
import { maxAssetBytesForWorkspace, MAX_ASSET_BYTES } from "../backend/lambda/atlas-api/lib/upload-limits.mjs";
>>>>>>> Stashed changes
import { trialEndsAtIso } from "../backend/lambda/atlas-api/lib/trial.mjs";

assert.equal(sessionLogDownloadDefaultForTier("starter"), false);
assert.equal(sessionLogDownloadDefaultForTier("launch"), false);
assert.equal(sessionLogDownloadDefaultForTier("growth"), true);
assert.equal(sessionLogDownloadDefaultForTier("scale"), true);

<<<<<<< Updated upstream
const starterStorage = limitsForBillingTier("starter").storageBytes;
const launchStorage = limitsForBillingTier("launch").storageBytes;
const growthStorage = limitsForBillingTier("growth").storageBytes;
assert.equal(starterStorage, 2 * 1024 ** 3);
assert.equal(launchStorage, 5 * 1024 ** 3);
assert.equal(growthStorage, 25 * 1024 ** 3);
=======
const MAX = 50 * 1024 * 1024;
const MULT = 2.5;
assert.equal(MAX_ASSET_BYTES, MAX);
assert.equal(maxAssetBytesForWorkspace({ billingTier: "starter" }), MAX);
assert.equal(maxAssetBytesForWorkspace({ billingTier: "scale" }), MAX);

assert.equal(limitsForBillingTier("starter").storageBytes, Math.round(5 * MAX * MULT));
assert.equal(limitsForBillingTier("launch").storageBytes, Math.round(30 * MAX * MULT));
assert.equal(limitsForBillingTier("growth").storageBytes, Math.round(100 * MAX * MULT));
assert.equal(limitsForBillingTier("scale").storageBytes, Math.round(10000 * MAX * MULT));

assert.equal(limitsForBillingTier("starter").sessionsPerMonth, 500);
assert.equal(limitsForBillingTier("launch").sessionsPerMonth, 3000);
assert.equal(limitsForBillingTier("growth").sessionsPerMonth, 10000);
assert.equal(limitsForBillingTier("scale").sessionsPerMonth, 0);
>>>>>>> Stashed changes

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
