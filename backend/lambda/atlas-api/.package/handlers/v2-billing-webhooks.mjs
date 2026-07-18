import { jsonResponse, rawRequestBody } from "../lib/http.mjs";
import {
  getDodoSubscription,
  normalizeDodoSubscriptionSnapshot,
  verifyDodoWebhook,
} from "../lib/billing-provider-dodo.mjs";
import {
  applyVerifiedBillingEvent,
  ensureProviderSubscriptionBinding,
  getBillingSubscription,
  withBillingReconciliationLock,
} from "../lib/billing-store.mjs";
import { providerTimestampSequence } from "../lib/billing-state.mjs";

const DODO_SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.failed",
  "subscription.updated",
  "subscription.on_hold",
  "subscription.plan_changed",
  "subscription.update_payment_method",
  "subscription.cancelled",
  "subscription.expired",
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
        const providerSequence = providerTimestampSequence(
          providerTimestamp,
          current?.provider === "dodo" &&
            current?.providerSubscriptionId === subscriptionId
            ? current.providerSequence
            : null
        );
        const subscription = await getDodoSubscription(subscriptionId);
        const normalized = normalizeDodoSubscriptionSnapshot({
          subscription,
          eventId,
          eventType: String(webhook.type),
          occurredAt: new Date(providerTimestamp).toISOString(),
          providerSequence,
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
