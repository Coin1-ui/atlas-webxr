#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  applyBillingEvent,
  billingEntitlementTier,
  normalizeBillingEvent,
  providerTimestampSequence,
} from "../backend/lambda/atlas-api/lib/billing-state.mjs";

assert.equal(providerTimestampSequence(1_700_000_000_000), 1_700_000_000_000_000);
assert.equal(
  providerTimestampSequence(1_700_000_000_000, 1_700_000_000_000_000),
  1_700_000_000_000_001
);

const baseEvent = {
  provider: "dodo",
  eventId: "evt_1",
  eventType: "subscription.active",
  workspaceId: "ws_1",
  providerSubscriptionId: "sub_1",
  tier: "growth",
  status: "active",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 100,
  currentPeriodEnd: "2026-08-18T10:00:00.000Z",
  amountMinor: 17900,
  currency: "USD",
};

const active = applyBillingEvent(null, baseEvent);
assert.equal(active.applied, true);
assert.equal(
  billingEntitlementTier(active.subscription, "2026-07-19T00:00:00.000Z"),
  "growth"
);
assert.equal(
  billingEntitlementTier(active.subscription, "2026-08-18T10:00:00.000Z"),
  null
);

const stale = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_0",
  status: "expired",
  occurredAt: "2026-07-18T09:59:59.000Z",
  providerSequence: 99,
  currentPeriodEnd: null,
  amountMinor: null,
  currency: null,
});
assert.equal(stale.applied, false);
assert.equal(stale.subscription.status, "active");

const pastDue = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_2",
  eventType: "payment.failed",
  status: "past_due",
  occurredAt: "2026-07-20T10:00:00.000Z",
  providerSequence: 101,
  graceUntil: "2026-07-27T10:00:00.000Z",
  amountMinor: null,
  currency: null,
});
assert.equal(
  billingEntitlementTier(pastDue.subscription, "2026-07-27T09:59:59.000Z"),
  "growth"
);
assert.equal(
  billingEntitlementTier(pastDue.subscription, "2026-07-27T10:00:00.000Z"),
  null
);

const canceled = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_3",
  eventType: "subscription.canceled",
  status: "canceled",
  occurredAt: "2026-07-21T10:00:00.000Z",
  providerSequence: 102,
  cancelAtPeriodEnd: true,
  amountMinor: null,
  currency: null,
});
assert.equal(
  billingEntitlementTier(canceled.subscription, "2026-08-18T09:59:59.000Z"),
  "growth"
);

assert.throws(
  () => applyBillingEvent(active.subscription, { ...baseEvent, provider: "zoho", eventId: "evt_4" }),
  /only after the prior subscription has ended/
);
assert.throws(
  () =>
    applyBillingEvent(active.subscription, {
      ...baseEvent,
      providerSubscriptionId: "sub_other",
      eventId: "evt_4",
    }),
  /only after the prior subscription has ended/
);
const equalSequence = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_equal_time",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 100,
  status: "expired",
  currentPeriodEnd: null,
  amountMinor: null,
  currency: null,
});
assert.equal(equalSequence.applied, false);

const resubscribed = applyBillingEvent(
  {
    ...canceled.subscription,
    currentPeriodEnd: "2026-07-21T10:00:00.000Z",
  },
  {
    ...baseEvent,
    provider: "zoho",
    eventId: "evt_new_subscription",
    providerSubscriptionId: "sub_new",
    occurredAt: "2026-07-22T10:00:00.000Z",
    providerSequence: 1,
  }
);
assert.equal(resubscribed.applied, true);
assert.equal(resubscribed.subscription.provider, "zoho");
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, amountMinor: 179.99 }),
  /non-negative safe integer/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, currency: null }),
  /provided together/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, status: "unknown" }),
  /Invalid billing status/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, providerSequence: undefined }),
  /providerSequence/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, providerSequence: "100" }),
  /providerSequence/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, amountMinor: "17900" }),
  /non-negative safe integer/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, eventId: "evt#unsafe" }),
  /unsupported characters/
);
assert.throws(
  () => normalizeBillingEvent({ ...baseEvent, occurredAt: "2026-07-18" }),
  /canonical UTC ISO timestamp/
);

// Scenario 1: same-plan renewal advances period end, keeps tier
const renewed = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_renewed_1",
  eventType: "subscription.renewed",
  occurredAt: "2026-08-18T10:00:01.000Z",
  providerSequence: 200,
  currentPeriodEnd: "2026-09-18T10:00:00.000Z",
  amountMinor: 17900,
  currency: "USD",
});
assert.equal(renewed.applied, true);
assert.equal(renewed.subscription.tier, "growth");
assert.equal(renewed.subscription.currentPeriodEnd, "2026-09-18T10:00:00.000Z");
assert.equal(
  billingEntitlementTier(renewed.subscription, "2026-09-18T09:59:59.000Z"),
  "growth"
);

// Scenario 2: renewal with plan change (new product/tier at period boundary)
const planChangedAtRenewal = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_plan_at_renewal",
  eventType: "subscription.plan_changed",
  tier: "launch",
  occurredAt: "2026-08-18T10:00:02.000Z",
  providerSequence: 201,
  currentPeriodEnd: "2026-09-18T10:00:00.000Z",
  amountMinor: 5900,
  currency: "USD",
});
assert.equal(planChangedAtRenewal.applied, true);
assert.equal(planChangedAtRenewal.subscription.tier, "launch");
assert.equal(
  billingEntitlementTier(planChangedAtRenewal.subscription, "2026-08-19T00:00:00.000Z"),
  "launch"
);

console.log("test:billing-state-machine-unit — OK");
