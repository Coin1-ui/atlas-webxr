import { jsonResponse, rawRequestBody } from "../lib/http.mjs";
import {
  getDodoSubscription,
  normalizeDodoSubscriptionSnapshot,
  verifyDodoWebhook,
} from "../lib/billing-provider-dodo.mjs";
import {
  getZohoSubscription,
  normalizeZohoSubscriptionSnapshot,
  verifyZohoPaymentsWebhook,
} from "../lib/billing-provider-zoho.mjs";
import {
  applyVerifiedBillingEvent,
  ensureProviderSubscriptionBinding,
  getBillingSubscription,
  withBillingReconciliationLock,
} from "../lib/billing-store.mjs";
import { providerTimestampSequence } from "../lib/billing-state.mjs";
import { assertProviderPaymentCurrency } from "../lib/billing-policy.mjs";

const DODO_SUBSCRIPTION_EVENTS = new Set([
  "payment.succeeded",
  "subscription.active",
  "subscription.renewed",
  "subscription.failed",
  "subscription.updated",
  "subscription.on_hold",
  "subscription.plan_changed",
  "subscription.update_payment_method",
  "subscription.cancelled",
  "subscription.expired",
  "payment.succeeded",
  "payment.failed",
]);

function header(event, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function subscriptionIdFromDodoEvent(webhook) {
  if (String(webhook.type || "").startsWith("subscription.")) {
    return webhook.data?.subscription_id ? String(webhook.data.subscription_id) : null;
  }
  return webhook.data?.subscription_id ? String(webhook.data.subscription_id) : null;
}

/**
 * Signed public route. API Gateway must not attach the Cognito authorizer.
 * Entitlements still come from an authoritative Dodo subscription read.
 */
export async function handleDodoWebhook(event) {
  if (process.env.ATLAS_DODO_WEBHOOK_ENABLED !== "true") {
    return jsonResponse(503, { error: "Dodo webhook ingestion is not enabled" });
  }
  const rawBody = rawRequestBody(event);
  let webhook;
  try {
    webhook = verifyDodoWebhook(rawBody, event.headers || {});
  } catch {
    return jsonResponse(400, { error: "Invalid webhook signature" });
  }

  const expectedBusinessId = process.env.DODO_PAYMENTS_BUSINESS_ID?.trim();
  if (!expectedBusinessId || webhook?.business_id !== expectedBusinessId) {
    return jsonResponse(400, { error: "Invalid webhook business" });
  }
  if (!DODO_SUBSCRIPTION_EVENTS.has(String(webhook.type))) {
    return jsonResponse(200, { received: true, ignored: true });
  }

  const subscriptionId = subscriptionIdFromDodoEvent(webhook);
  const eventId = header(event, "webhook-id");
  if (!subscriptionId || !eventId) {
    return jsonResponse(400, { error: "Webhook is missing required identifiers" });
  }

  try {
    const operationId =
      webhook.data?.metadata?.atlas_billing_operation_id || undefined;
    const customerId = webhook.data?.customer?.customer_id || undefined;
    await ensureProviderSubscriptionBinding({
      provider: "dodo",
      providerSubscriptionId: subscriptionId,
      checkoutOperationId: operationId,
      providerCustomerId: customerId,
    });
    const result = await withBillingReconciliationLock(
      "dodo",
      subscriptionId,
      async ({ workspaceId }) => {
        const providerTimestamp = Date.parse(String(webhook.timestamp || ""));
        if (!Number.isSafeInteger(providerTimestamp) || providerTimestamp < 0) {
          throw new Error("Dodo webhook timestamp is invalid");
        }
        const current = await getBillingSubscription(workspaceId);
        const subscription = await getDodoSubscription(subscriptionId);
        const authoritativeTimestamp = subscription.updated_at
          ? Date.parse(String(subscription.updated_at))
          : providerTimestamp;
        if (!Number.isSafeInteger(authoritativeTimestamp) || authoritativeTimestamp < 0) {
          throw new Error("Dodo subscription revision time is invalid");
        }
        const providerSequence = providerTimestampSequence(
          authoritativeTimestamp,
          current?.provider === "dodo" &&
            current?.providerSubscriptionId === subscriptionId
            ? current.providerSequence
            : null
        );
        if (String(webhook.type) === "payment.succeeded") {
          assertProviderPaymentCurrency("dodo", webhook.data?.currency);
        }
        const normalized = normalizeDodoSubscriptionSnapshot({
          subscription,
          eventId,
          eventType: String(webhook.type),
          occurredAt: new Date(authoritativeTimestamp).toISOString(),
          providerSequence,
          providerPaymentId: webhook.data?.payment_id,
          amountMinor:
            String(webhook.type) === "payment.succeeded" &&
            Number.isSafeInteger(webhook.data?.total_amount)
              ? webhook.data.total_amount
              : null,
          currency:
            String(webhook.type) === "payment.succeeded"
              ? webhook.data?.currency
              : null,
        });
        return applyVerifiedBillingEvent(normalized);
      }
    );
    return jsonResponse(200, {
      received: true,
      duplicate: result?.duplicate === true,
      applied: result?.applied === true,
    });
  } catch (error) {
    console.error("Dodo webhook reconciliation failed", {
      eventId,
      subscriptionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse(error?.statusCode === 503 ? 503 : 500, {
      error: "Webhook reconciliation failed",
    });
  }
}

export async function handleZohoPaymentsWebhook(event) {
  if (process.env.ATLAS_ZOHO_WEBHOOK_ENABLED !== "true") {
    return jsonResponse(503, { error: "Zoho webhook ingestion is not enabled" });
  }
  try {
    const rawBody = rawRequestBody(event);
    verifyZohoPaymentsWebhook(
      rawBody,
      header(event, "x-zpayments-signature") || header(event, "x-zoho-webhook-signature")
    );
    const webhook = JSON.parse(rawBody);
    const eventId = String(webhook.event_id || webhook.id || "");
    const eventType = String(webhook.event_type || webhook.type || "");
    const resource = webhook.data?.subscription || webhook.subscription || webhook.data?.object;
    const subscriptionId = String(
      resource?.subscription_id || webhook.data?.subscription_id || ""
    );
    if (!eventId || !eventType || !subscriptionId) {
      return jsonResponse(400, { error: "Invalid Zoho Payments webhook payload" });
    }
    const checkoutOperationId =
      resource?.reference_id ||
      (Array.isArray(resource?.custom_fields)
        ? resource.custom_fields.find(
            (field) => field?.label === "Atlas Billing Operation ID"
          )?.value
        : null);
    await ensureProviderSubscriptionBinding({
      provider: "zoho",
      providerSubscriptionId: subscriptionId,
      providerCustomerId: resource?.customer_id,
      checkoutOperationId,
    });
    const rawOccurredAt = webhook.created_time || webhook.created_at;
    if (!rawOccurredAt || Number.isNaN(Date.parse(String(rawOccurredAt)))) {
      return jsonResponse(400, { error: "Zoho webhook is missing provider event time" });
    }
    const occurredAt = new Date(rawOccurredAt).toISOString();
    const result = await withBillingReconciliationLock(
      "zoho",
      subscriptionId,
      async ({ workspaceId }) => {
        const current = await getBillingSubscription(workspaceId);
        const authoritative = await getZohoSubscription(subscriptionId);
        const authoritativeTime =
          authoritative.updated_time || authoritative.updated_at || occurredAt;
        const authoritativeTimestamp = Date.parse(String(authoritativeTime));
        if (!Number.isSafeInteger(authoritativeTimestamp)) {
          throw new Error("Zoho subscription revision time is invalid");
        }
        const providerSequence = providerTimestampSequence(
          authoritativeTimestamp,
          current?.provider === "zoho" &&
            current?.providerSubscriptionId === subscriptionId
            ? current.providerSequence
            : null
        );
        if (Number.isSafeInteger(webhook.data?.amount_minor)) {
          assertProviderPaymentCurrency("zoho", webhook.data?.currency);
        }
        return applyVerifiedBillingEvent(
          normalizeZohoSubscriptionSnapshot({
            subscription: authoritative,
            eventId,
            eventType,
            occurredAt: new Date(authoritativeTimestamp).toISOString(),
            providerSequence,
            providerPaymentId:
              webhook.data?.payment?.payment_id ||
              resource?.payment_id ||
              webhook.data?.payment_id,
            amountMinor: Number.isSafeInteger(webhook.data?.amount_minor)
              ? webhook.data.amount_minor
              : null,
            currency: webhook.data?.currency || null,
          })
        );
      }
    );
    return jsonResponse(200, { ok: true, duplicate: result.duplicate, applied: result.applied });
  } catch (error) {
    console.error("Zoho Payments webhook rejected", error);
    return jsonResponse(400, { error: "Invalid webhook" });
  }
}
