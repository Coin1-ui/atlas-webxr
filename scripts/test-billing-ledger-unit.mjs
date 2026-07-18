#!/usr/bin/env node
import assert from "node:assert/strict";
import { applyBillingEvent, normalizeBillingEvent } from "../backend/lambda/atlas-api/lib/billing-state.mjs";
import {
  billingLedgerKeys,
  buildBillingTransactionItems,
  providerCheckoutUrl,
} from "../backend/lambda/atlas-api/lib/billing-store.mjs";

assert.equal(
  providerCheckoutUrl("https://checkout.dodopayments.com/session/1", "dodo").hostname,
  "checkout.dodopayments.com"
);
assert.equal(
  providerCheckoutUrl("https://billing.zoho.in/hostedpage/1", "zoho").hostname,
  "billing.zoho.in"
);
assert.throws(() => providerCheckoutUrl("https://dodopayments.com.evil.example/1", "dodo"));
assert.throws(() => providerCheckoutUrl("https://evil.example/1", "zoho"));

const receivedAt = "2026-07-18T10:01:00.000Z";
const event = normalizeBillingEvent({
  provider: "zoho",
  eventId: "evt_zoho_1",
  eventType: "subscription.renewed",
  workspaceId: "ws_india",
  providerSubscriptionId: "sub_zoho_1",
  tier: "launch",
  status: "active",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 100,
  currentPeriodEnd: "2026-08-18T10:00:00.000Z",
  amountMinor: 490000,
  currency: "INR",
});
const transition = applyBillingEvent(null, event);
const keys = billingLedgerKeys(event);
const writes = buildBillingTransactionItems(event, transition, receivedAt);

assert.deepEqual(keys.current, {
  pk: "WORKSPACE#ws_india",
  sk: "SUBSCRIPTION#CURRENT",
});
assert.equal(writes.length, 5);
assert.equal(writes[0].Put.ConditionExpression, "attribute_not_exists(pk)");
assert.equal(writes[0].Put.Item.amountMinor, 490000);
assert.equal(writes[0].Put.Item.currency, "INR");
assert.equal(writes[1].Put.Item.entityType, "billing_subscription_binding");
assert.match(writes[1].Put.ConditionExpression, /workspaceId = :workspaceId/);
assert.equal(writes[2].Put.Item.entityType, "billing_timeline_event");
assert.equal(writes[3].Put.ConditionExpression, "attribute_not_exists(pk)");
assert.match(writes[4].Update.UpdateExpression, /billingEntitlementTier = :entitlementTier/);
assert.equal(writes[4].Update.ExpressionAttributeValues[":entitlementTier"], "launch");

const crossWorkspaceKeys = billingLedgerKeys({ ...event, workspaceId: "ws_other" });
assert.deepEqual(crossWorkspaceKeys.binding, keys.binding);

const renewed = applyBillingEvent(transition.subscription, {
  ...event,
  eventId: "evt_zoho_renewed",
  occurredAt: "2026-07-19T10:00:00.000Z",
  providerSequence: 101,
});
const renewedWrites = buildBillingTransactionItems(renewed.event, renewed, receivedAt);
assert.match(renewedWrites[3].Put.ConditionExpression, /lastEventId = :previousEventId/);
assert.equal(
  renewedWrites[3].Put.ExpressionAttributeValues[":previousSequence"],
  100
);

const stale = applyBillingEvent(transition.subscription, {
  ...event,
  eventId: "evt_zoho_0",
  occurredAt: "2026-07-18T09:00:00.000Z",
  providerSequence: 99,
  status: "expired",
  currentPeriodEnd: null,
  amountMinor: null,
  currency: null,
});
const staleWrites = buildBillingTransactionItems(stale.event, stale, receivedAt);
assert.equal(staleWrites.length, 3);
assert.equal(staleWrites[0].Put.Item.outcome, "ignored_stale");

const expired = applyBillingEvent(transition.subscription, {
  ...event,
  eventId: "evt_zoho_2",
  eventType: "subscription.expired",
  occurredAt: "2026-08-18T10:00:01.000Z",
  providerSequence: 101,
  status: "expired",
  currentPeriodEnd: null,
  amountMinor: null,
  currency: null,
});
const expiredWrites = buildBillingTransactionItems(expired.event, expired, receivedAt);
assert.match(expiredWrites[4].Update.UpdateExpression, /REMOVE billingEntitlementTier$/);
assert.equal(
  Object.hasOwn(expiredWrites[4].Update.ExpressionAttributeValues, ":entitlementTier"),
  false
);

console.log("test:billing-ledger-unit — OK");
