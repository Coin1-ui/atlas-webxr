#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  billingPlanDisplayStatus,
  billingPlanStatusLabel,
} from "../backend/lambda/atlas-api/lib/trial.mjs";

const period = new Date(Date.now() + 20 * 864e5).toISOString();
const past = new Date(Date.now() - 864e5).toISOString();

const active = {
  billingProvider: "dodo",
  billingStatus: "active",
  billingEntitlementTier: "starter",
  billingCurrentPeriodEnd: period,
  billingSubscriptionId: "sub_1",
  billingCancelAtPeriodEnd: false,
};
assert.equal(billingPlanDisplayStatus(active), "active");
assert.equal(billingPlanStatusLabel(active), "Active");

const scheduled = { ...active, billingCancelAtPeriodEnd: true };
assert.equal(billingPlanDisplayStatus(scheduled), "cancel_scheduled");
assert.equal(billingPlanStatusLabel(scheduled), "Cancel scheduled");

const expiredImmediateCancel = {
  billingProvider: "dodo",
  billingStatus: "expired",
  billingEntitlementTier: null,
  billingCurrentPeriodEnd: past,
  billingSubscriptionId: "sub_1",
  billingCancelAtPeriodEnd: false,
};
assert.equal(billingPlanDisplayStatus(expiredImmediateCancel), "canceled");
assert.equal(billingPlanStatusLabel(expiredImmediateCancel), "Canceled");

const endedNoTier = {
  billingProvider: "dodo",
  billingStatus: "active",
  billingEntitlementTier: "starter",
  billingCurrentPeriodEnd: past,
  billingSubscriptionId: "sub_1",
};
assert.equal(billingPlanDisplayStatus(endedNoTier), "canceled");

const pastDue = {
  billingProvider: "dodo",
  billingStatus: "past_due",
  billingEntitlementTier: "launch",
  billingGraceUntil: period,
  billingSubscriptionId: "sub_1",
};
assert.equal(billingPlanDisplayStatus(pastDue), "past_due");
assert.equal(billingPlanStatusLabel(pastDue), "Past due");

console.log("test:billing-plan-display-status — OK");
