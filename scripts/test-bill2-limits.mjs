#!/usr/bin/env node
/** BILL-2 — session SoT + storage upload hard-block (sessions soft-allow). */
import assert from "node:assert/strict";
import {
  limitsForBillingTier,
  buildUsageWarnings,
} from "../backend/lambda/atlas-api/lib/plan-limits.mjs";
import {
  incomingUploadBytes,
  isStorageUploadBlocked,
} from "../backend/lambda/atlas-api/lib/upload-limits.mjs";

assert.equal(limitsForBillingTier("starter").sessionsPerMonth, 500);
assert.equal(limitsForBillingTier("launch").sessionsPerMonth, 3000);
assert.equal(limitsForBillingTier("growth").sessionsPerMonth, 10000);
assert.equal(limitsForBillingTier("scale").sessionsPerMonth, 0);

assert.equal(incomingUploadBytes({ glbBytes: 10, iconBytes: 2, usdzBytes: 3 }), 15);
assert.equal(incomingUploadBytes({}), 0);
assert.equal(incomingUploadBytes({ glbBytes: -1, iconBytes: "x" }), 0);

const starterLimit = limitsForBillingTier("starter").storageBytes;

assert.equal(
  isStorageUploadBlocked({
    isNew: true,
    currentBytes: starterLimit,
    incomingBytes: 0,
    limitBytes: starterLimit,
  }),
  true,
);
assert.equal(
  isStorageUploadBlocked({
    isNew: true,
    currentBytes: starterLimit - 10,
    incomingBytes: 20,
    limitBytes: starterLimit,
  }),
  true,
);
assert.equal(
  isStorageUploadBlocked({
    isNew: true,
    currentBytes: 0,
    incomingBytes: 100,
    limitBytes: starterLimit,
  }),
  false,
);
assert.equal(
  isStorageUploadBlocked({
    isNew: false,
    currentBytes: starterLimit,
    incomingBytes: 1,
    limitBytes: starterLimit,
  }),
  true,
);
assert.equal(
  isStorageUploadBlocked({
    isNew: false,
    currentBytes: starterLimit - 1,
    incomingBytes: 1,
    limitBytes: starterLimit,
  }),
  false,
);

const starterWs = { plan: "starter", billingTier: "starter" };
const sessionCritical = buildUsageWarnings(starterWs, {
  modelCount: 1,
  sessionCount: 500,
  storageBytes: 0,
}).find((w) => w.metric === "sessions" && w.level === "critical");
assert.ok(sessionCritical);
assert.match(sessionCritical.message, /meters bill|subscription payment/i);

const storageCritical = buildUsageWarnings(starterWs, {
  modelCount: 1,
  sessionCount: 0,
  storageBytes: starterLimit,
}).find((w) => w.metric === "storage" && w.level === "critical");
assert.ok(storageCritical);
assert.match(storageCritical.message, /uploads are blocked/i);

console.log("test:bill2 — all passed");
