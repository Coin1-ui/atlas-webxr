#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Webhook } from "../backend/lambda/atlas-api/node_modules/standardwebhooks/dist/index.js";
import {
  normalizeDodoSubscriptionSnapshot,
  verifyDodoWebhook,
} from "../backend/lambda/atlas-api/lib/billing-provider-dodo.mjs";
import {
  normalizeZohoSubscriptionSnapshot,
  verifyZohoPaymentsWebhook,
} from "../backend/lambda/atlas-api/lib/billing-provider-zoho.mjs";
import { handleBillingCheckout } from "../backend/lambda/atlas-api/handlers/v2-billing-checkout.mjs";
import { handleDodoWebhook } from "../backend/lambda/atlas-api/handlers/v2-billing-webhooks.mjs";

delete process.env.ATLAS_BILLING_ENABLED;
delete process.env.ATLAS_DODO_WEBHOOK_ENABLED;
assert.equal(
  (await handleBillingCheckout({ requestContext: { http: { method: "POST" } } }, "ws_1"))
    .statusCode,
  503
);
assert.equal(
  (await handleDodoWebhook({ requestContext: { http: { method: "POST" } } })).statusCode,
  503
);

process.env.DODO_PRODUCT_GROWTH_MONTHLY = "prod_growth";
process.env.ZOHO_PLAN_LAUNCH_MONTHLY = "atlas-launch-monthly";

const standardSecret = Buffer.from("atlas-test-webhook-secret").toString("base64");
process.env.DODO_PAYMENTS_WEBHOOK_SECRET = `whsec_${standardSecret}`;
const dodoPayload = JSON.stringify({ business_id: "biz_1", type: "subscription.active" });
const dodoId = "evt_delivery_1";
const dodoTimestamp = new Date();
const dodoSigner = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
const dodoHeaders = {
  "webhook-id": dodoId,
  "webhook-timestamp": String(Math.floor(dodoTimestamp.getTime() / 1000)),
  "webhook-signature": dodoSigner.sign(dodoId, dodoTimestamp, dodoPayload),
};
assert.deepEqual(verifyDodoWebhook(dodoPayload, dodoHeaders), JSON.parse(dodoPayload));
assert.throws(() => verifyDodoWebhook(`${dodoPayload} `, dodoHeaders));

const dodoEvent = normalizeDodoSubscriptionSnapshot({
  eventId: dodoId,
  eventType: "subscription.active",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 1,
  subscription: {
    subscription_id: "sub_1",
    product_id: "prod_growth",
    status: "active",
    next_billing_date: "2026-08-18T10:00:00.000Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
    metadata: { atlas_billing_operation_id: "op_1" },
  },
});
assert.equal(dodoEvent.tier, "growth");
assert.equal(dodoEvent.status, "active");
assert.equal(dodoEvent.checkoutOperationId, "op_1");

process.env.ZOHO_PAYMENTS_WEBHOOK_SECRET = "zoho-payments-test-secret";
const zohoPaymentPayload = JSON.stringify({ event_id: "zp_evt_1" });
const zohoTimestamp = Date.now();
const zohoPaymentSignature = createHmac(
  "sha256",
  process.env.ZOHO_PAYMENTS_WEBHOOK_SECRET
)
  .update(`${zohoTimestamp}.${zohoPaymentPayload}`)
  .digest("hex");
verifyZohoPaymentsWebhook(
  zohoPaymentPayload,
  `t=${zohoTimestamp},v=${zohoPaymentSignature}`,
  zohoTimestamp
);
assert.throws(() =>
  verifyZohoPaymentsWebhook(
    `${zohoPaymentPayload} `,
    `t=${zohoTimestamp},v=${zohoPaymentSignature}`,
    zohoTimestamp
  )
);

const zohoEvent = normalizeZohoSubscriptionSnapshot({
  eventId: "zoho_evt_1",
  eventType: "subscription_updated",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 4,
  subscription: {
    subscription_id: "sub_z_1",
    customer_id: "cus_z_1",
    status: "non_renewing",
    current_term_ends_at: "2026-08-18",
    plan: { plan_code: "atlas-launch-monthly" },
    reference_id: "op_z_1",
  },
});
assert.equal(zohoEvent.tier, "launch");
assert.equal(zohoEvent.status, "canceled");
assert.equal(zohoEvent.cancelAtPeriodEnd, true);
assert.equal(zohoEvent.currentPeriodEnd, "2026-08-17T18:30:00.000Z");

console.log("test:billing-provider-adapters-unit — OK");
