#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  scheduledPlanChangeFromDodoSubscription,
} from "../backend/lambda/atlas-api/lib/billing-provider-dodo.mjs";

process.env.DODO_PRODUCT_LAUNCH_MONTHLY = "pdt_launch";
process.env.DODO_PRODUCT_GROWTH_MONTHLY = "pdt_growth";

assert.deepEqual(
  scheduledPlanChangeFromDodoSubscription({
    scheduled_change: {
      product_id: "pdt_launch",
      effective_at: "2026-08-20T19:49:10Z",
    },
  }),
  {
    tier: "launch",
    productId: "pdt_launch",
    effectiveAt: "2026-08-20T19:49:10Z",
  },
);

assert.equal(scheduledPlanChangeFromDodoSubscription({ scheduled_change: null }), null);
assert.equal(scheduledPlanChangeFromDodoSubscription({}), null);

console.log("test:scheduled-plan-change-dodo — OK");
