#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  effectiveUsageLimits,
  displayUsageCounts,
  isSandboxUsageContext,
} from "../backend/lambda/atlas-api/lib/overage-entitlements.mjs";
import { limitsForBillingTier } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";

const launch = limitsForBillingTier("launch");

const extended = effectiveUsageLimits(launch, {
  status: "paid",
  usageSnapshot: { modelCount: 1, sessionCount: 5150, storageBytes: 2_000_000 },
});
assert.equal(extended.sessionsPerMonth, 5150);
assert.equal(extended.models, 30);
assert.equal(extended.overageExtended.sessions, true);

const noExtend = effectiveUsageLimits(launch, {
  status: "paid",
  usageSnapshot: { modelCount: 1, sessionCount: 100, storageBytes: 2_000_000 },
});
assert.equal(noExtend.sessionsPerMonth, 5000);
assert.equal(noExtend.overageExtended.sessions, false);

const display = displayUsageCounts(
  { month: "2026-07", modelCount: 0, sessionCount: 0, storageBytes: 0 },
  {
    status: "paid",
    usageSnapshot: { modelCount: 1, sessionCount: 5150, storageBytes: 2_000_000 },
  }
);
assert.equal(display.sessionCount, 5150);
assert.equal(display.month, "2026-07");

assert.equal(isSandboxUsageContext("2026-07-22T00:00:00Z", null), true);
assert.equal(isSandboxUsageContext(null, { sandbox: true }), true);
assert.equal(isSandboxUsageContext(null, { sandbox: false, status: "paid" }), true);
assert.equal(
  isSandboxUsageContext(null, {
    status: "accepted",
    providerPaymentId: null,
  }),
  true
);
// Orphaned paid row after usage reset (sessions 0) — clearable even with payment id.
assert.equal(
  isSandboxUsageContext(
    null,
    {
      status: "paid",
      providerPaymentId: "pay_test",
      usageSnapshot: { sessionCount: 5150, modelCount: 1 },
    },
    { sessionsPerMonth: 5000, models: 30 },
    { sessionCount: 0, modelCount: 1 }
  ),
  true
);
// Still in overage with live excess + real payment — not clearable.
assert.equal(
  isSandboxUsageContext(
    null,
    {
      status: "paid",
      providerPaymentId: "pay_real",
      usageSnapshot: { sessionCount: 6000 },
    },
    { sessionsPerMonth: 5000 },
    { sessionCount: 6000 }
  ),
  false
);

console.log("test:overage-entitlements — OK");
