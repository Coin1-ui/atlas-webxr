#!/usr/bin/env node
import assert from "node:assert/strict";
import { estimateOverageUsd, normalizeOverageMonth } from "../backend/lambda/atlas-api/lib/overage-estimate.mjs";
import { limitsForBillingTier } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";

assert.equal(normalizeOverageMonth("2026-07"), "2026-07");
assert.throws(() => normalizeOverageMonth("07-2026"));

const starterLimits = limitsForBillingTier("starter");
assert.equal(starterLimits.sessionsPerMonth, 1000);
assert.equal(
  estimateOverageUsd(
    "starter",
    { modelCount: 5, sessionCount: 1150, storageBytes: starterLimits.storageBytes },
    starterLimits
  ),
  10
);

const growthLimits = limitsForBillingTier("growth");
assert.equal(growthLimits.sessionsPerMonth, 15000);
assert.equal(
  estimateOverageUsd(
    "growth",
    { modelCount: 100, sessionCount: 15000, storageBytes: growthLimits.storageBytes },
    growthLimits
  ),
  0
);
assert.equal(
  estimateOverageUsd(
    "launch",
    { modelCount: 30, sessionCount: 6000, storageBytes: limitsForBillingTier("launch").storageBytes },
    limitsForBillingTier("launch")
  ),
  8
);

console.log("test:overage-estimate-unit — OK");
