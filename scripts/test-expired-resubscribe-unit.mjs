#!/usr/bin/env node
import assert from "node:assert/strict";
import { hasLiveBillingSubscription } from "../src/shared/trial.ts";

assert.equal(
  hasLiveBillingSubscription({
    plan: "starter",
    billingSubscriptionId: "sub_old",
    billingStatus: "expired",
  }),
  false,
);

assert.equal(
  hasLiveBillingSubscription({
    plan: "starter",
    billingSubscriptionId: "sub_live",
    billingStatus: "active",
  }),
  true,
);

assert.equal(
  hasLiveBillingSubscription({
    plan: "starter",
    billingStatus: "active",
  }),
  false,
);

console.log("test:expired-resubscribe-unit — OK");
