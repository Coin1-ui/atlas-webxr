#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Webhook } from "../backend/lambda/atlas-api/node_modules/standardwebhooks/dist/index.js";
import {
  createDodoCheckout,
  createDodoRefund,
  normalizeDodoSubscriptionSnapshot,
  verifyDodoWebhook,
} from "../backend/lambda/atlas-api/lib/billing-provider-dodo.mjs";
import {
  createZohoHostedCheckout,
  createZohoPortalSession,
  normalizeZohoSubscriptionSnapshot,
  verifyZohoPaymentsWebhook,
} from "../backend/lambda/atlas-api/lib/billing-provider-zoho.mjs";
import { handleBillingCheckout } from "../backend/lambda/atlas-api/handlers/v2-billing-checkout.mjs";
import {
  handleDodoWebhook,
  handleZohoPaymentsWebhook,
} from "../backend/lambda/atlas-api/handlers/v2-billing-webhooks.mjs";
import { handleBillingPortal } from "../backend/lambda/atlas-api/handlers/v2-billing-manage.mjs";
import { handlePlatformBillingRefund } from "../backend/lambda/atlas-api/handlers/v2-billing-refunds.mjs";

delete process.env.ATLAS_BILLING_ENABLED;
delete process.env.ATLAS_DODO_WEBHOOK_ENABLED;
delete process.env.ATLAS_ZOHO_WEBHOOK_ENABLED;
assert.equal(
  (await handleBillingCheckout({ requestContext: { http: { method: "POST" } } }, "ws_1"))
    .statusCode,
  503
);
assert.equal(
  (await handleDodoWebhook({ requestContext: { http: { method: "POST" } } })).statusCode,
  503
);
assert.equal(
  (await handleZohoPaymentsWebhook({ requestContext: { http: { method: "POST" } } })).statusCode,
  503
);
assert.equal(
  (
    await handleBillingPortal(
      {
        requestContext: { http: { method: "POST" } },
        body: JSON.stringify({ billingCountry: "US" }),
      },
      "ws_1"
    )
  ).statusCode,
  503
);
assert.equal(
  (await handlePlatformBillingRefund({ requestContext: { http: { method: "POST" } } }))
    .statusCode,
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
    next_billing_date: "2026-08-18T10:00:00.451503Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
    metadata: { atlas_billing_operation_id: "op_1" },
  },
});
assert.equal(dodoEvent.tier, "growth");
assert.equal(dodoEvent.status, "active");
assert.equal(dodoEvent.checkoutOperationId, "op_1");
assert.equal(dodoEvent.currentPeriodEnd, "2026-08-18T10:00:00.451Z");

assert.equal(dodoEvent.cancelAtPeriodEnd, false);

const renewedSnapshot = normalizeDodoSubscriptionSnapshot({
  eventId: "evt_renewed_norm",
  eventType: "subscription.renewed",
  occurredAt: "2026-08-18T10:00:01.000Z",
  providerSequence: 2,
  subscription: {
    subscription_id: "sub_1",
    product_id: "prod_growth",
    status: "active",
    next_billing_date: "2026-09-18T10:00:00.000Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
  },
});
assert.equal(renewedSnapshot.status, "active");
assert.equal(renewedSnapshot.tier, "growth");
assert.equal(renewedSnapshot.currentPeriodEnd, "2026-09-18T10:00:00.000Z");

process.env.DODO_PRODUCT_LAUNCH_MONTHLY = "prod_launch";
const planChangeSnapshot = normalizeDodoSubscriptionSnapshot({
  eventId: "evt_plan_norm",
  eventType: "subscription.updated",
  occurredAt: "2026-08-18T10:00:02.000Z",
  providerSequence: 3,
  subscription: {
    subscription_id: "sub_1",
    product_id: "prod_launch",
    status: "active",
    next_billing_date: "2026-09-18T10:00:00.000Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
  },
});
assert.equal(planChangeSnapshot.tier, "launch");
assert.equal(planChangeSnapshot.status, "active");

const expiredDodoEvent = normalizeDodoSubscriptionSnapshot({
  eventId: "evt_expired_1",
  eventType: "subscription.expired",
  occurredAt: "2026-07-20T13:44:32.000Z",
  providerSequence: 9,
  subscription: {
    subscription_id: "sub_expired",
    product_id: "prod_growth",
    status: "cancelled",
    cancel_at_next_billing_date: true,
    cancelled_at: "2026-07-20T13:44:32.048953Z",
    customer: { customer_id: "cus_1" },
    metadata: { atlas_billing_operation_id: "op_1" },
  },
});
assert.equal(expiredDodoEvent.status, "expired");
assert.equal(expiredDodoEvent.cancelAtPeriodEnd, false);

const cancelScheduledDodoEvent = normalizeDodoSubscriptionSnapshot({
  eventId: "evt_cancel_scheduled",
  eventType: "subscription.updated",
  occurredAt: "2026-07-18T10:00:00.000Z",
  providerSequence: 2,
  subscription: {
    subscription_id: "sub_1",
    product_id: "prod_growth",
    status: "active",
    next_billing_date: "2026-08-18T10:00:00.451503Z",
    cancel_at_next_billing_date: true,
    customer: { customer_id: "cus_1" },
    metadata: { atlas_billing_operation_id: "op_1" },
  },
});
assert.equal(cancelScheduledDodoEvent.cancelAtPeriodEnd, true);

const dodoPaymentEvent = normalizeDodoSubscriptionSnapshot({
  eventId: "evt_payment_1",
  eventType: "payment.succeeded",
  occurredAt: "2026-07-19T04:19:14.627Z",
  providerSequence: 2,
  providerPaymentId: "pay_0NjUvFmb396Bs88Nt7sXu",
  amountMinor: 500,
  currency: "USD",
  subscription: {
    subscription_id: "sub_0NjUvFmfYUyK21QpBF2AL",
    product_id: "prod_growth",
    status: "active",
    next_billing_date: "2026-08-19T04:19:14.655Z",
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_0NjUvFmQSrwEVxMsaLu15" },
    metadata: { atlas_billing_operation_id: "74875648-441e-4118-8655-cdb28af8c295" },
  },
});
assert.equal(dodoPaymentEvent.providerPaymentId, "pay_0NjUvFmb396Bs88Nt7sXu");
assert.equal(dodoPaymentEvent.amountMinor, 500);
assert.equal(dodoPaymentEvent.currency, "USD");

const originalFetch = globalThis.fetch;
process.env.DODO_PAYMENTS_ENV = "test_mode";
process.env.DODO_PAYMENTS_API_KEY = "test_api_key";
process.env.DODO_PRODUCT_STARTER_MONTHLY = "prod_starter";
process.env.ATLAS_BILLING_APP_ORIGIN = "https://main.example.com";
process.env.ATLAS_BILLING_RETURN_URL = "https://main.example.com/account?billing=return";
process.env.ATLAS_BILLING_CANCEL_URL = "https://main.example.com/account?billing=cancel";
let capturedDodoRequest;
globalThis.fetch = async (url, init) => {
  capturedDodoRequest = { url: String(url), init };
  return new Response(
    JSON.stringify({ session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/1" }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
await createDodoCheckout(
  {
    operationId: "op_checkout_12345678",
    tier: "starter",
    billingCountry: "US",
    couponCode: null,
  },
  { email: "buyer@example.com", billingAddress: {} }
);
assert.equal(capturedDodoRequest.init.headers["Idempotency-Key"], "op_checkout_12345678");
assert.equal(
  JSON.parse(capturedDodoRequest.init.body).metadata.atlas_billing_operation_id,
  "op_checkout_12345678"
);
assert.equal(
  JSON.parse(capturedDodoRequest.init.body).subscription_data,
  undefined,
  "checkout must not set on_demand (blocks Dodo change-plan)"
);

await createDodoRefund("pay_1", 250, "partial refund", "op_refund_12345678");
assert.equal(capturedDodoRequest.init.headers["Idempotency-Key"], "op_refund_12345678");
assert.equal(JSON.parse(capturedDodoRequest.init.body).amount, 250);

process.env.ZOHO_CLIENT_ID = "client_1";
process.env.ZOHO_CLIENT_SECRET = "secret_1";
process.env.ZOHO_BILLING_REFRESH_TOKEN = "refresh_1";
process.env.ZOHO_BILLING_ORGANIZATION_ID = "org_1";
process.env.ZOHO_PLAN_STARTER_MONTHLY = "atlas-starter-monthly";
let capturedZohoBody;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("/oauth/v2/token")) {
    assert.match(String(init.body), /refresh_token=refresh_1/);
    return new Response(JSON.stringify({ access_token: "access_1", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  capturedZohoBody = JSON.parse(init.body);
  return new Response(
    JSON.stringify({
      code: 0,
      hostedpage: { hostedpage_id: "hp_1", url: "https://billing.zoho.in/hostedpage/1" },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
await createZohoHostedCheckout(
  { operationId: "op_zoho_12345678", tier: "starter", couponCode: null },
  { email: "india@example.com", name: "India Test", billingAddress: {} }
);
assert.equal(capturedZohoBody.reference_id, "op_zoho_12345678");
assert.equal(capturedZohoBody.plan.plan_code, "atlas-starter-monthly");
process.env.ZOHO_BILLING_PORTAL_URL = "https://billing.zoho.in/portal/atlas";
assert.equal(createZohoPortalSession().portalUrl, "https://billing.zoho.in/portal/atlas");
process.env.ZOHO_BILLING_PORTAL_URL = "https://evil.zoho.in/portal/atlas";
assert.throws(() => createZohoPortalSession());
globalThis.fetch = originalFetch;

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
