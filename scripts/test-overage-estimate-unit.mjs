#!/usr/bin/env node
import assert from "node:assert/strict";
import { estimateOverageUsd, normalizeOverageMonth } from "../backend/lambda/atlas-api/lib/overage-estimate.mjs";
import { limitsForBillingTier } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";

assert.equal(normalizeOverageMonth("2026-07"), "2026-07");
assert.throws(() => normalizeOverageMonth("07-2026"));

const starterLimits = limitsForBillingTier("starter");
assert.equal(
  estimateOverageUsd(
    "starter",
    { modelCount: 5, sessionCount: 600, storageBytes: starterLimits.storageBytes },
    starterLimits
  ),
  20
);
assert.equal(
  estimateOverageUsd(
    "growth",
    { modelCount: 100, sessionCount: 10000, storageBytes: limitsForBillingTier("growth").storageBytes },
    limitsForBillingTier("growth")
  ),
  0
);

console.log("test:overage-estimate-unit — OK");
