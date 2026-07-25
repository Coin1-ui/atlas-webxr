import { jsonResponse, rawRequestBody } from "../lib/http.mjs";
import {
  assertHybridMetersMatchProduct,
  cancelDodoSubscription,
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
  getBillingCheckoutOperation,
  getBillingSubscription,
  resolveBillingWorkspace,
  setWorkspaceBillingMeterSync,
  workspaceRecordExists,
  withBillingReconciliationLock,
} from "../lib/billing-store.mjs";
import { providerTimestampSequence } from "../lib/billing-state.mjs";
import { assertProviderPaymentCurrency } from "../lib/billing-policy.mjs";
import { clearAtlasSandboxUsageIfPresent } from "../lib/sandbox-usage-clear.mjs";
import { resetMonthlySessionCount } from "../lib/usage.mjs";

const DODO_METER_ASSERT_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.updated",
  "subscription.plan_changed",
]);

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

const TERMINAL_DODO_SUBSCRIPTION_STATUSES = new Set(["cancelled", "failed", "expired"]);

function dodoSubscriptionIsObsolete(subscription) {
  return TERMINAL_DODO_SUBSCRIPTION_STATUSES.has(String(subscription?.status || "").toLowerCase());
}

function ignorableDodoWebhookResponse(reason) {
  return jsonResponse(200, { received: true, ignored: true, reason });
}

function isIgnorableDodoWebhookError(error) {
  // Do NOT treat TransactionCanceledException as success — that caused Dodo to show
  // "Succeeded" while Atlas may not have applied the event (false-positive delivery).
  // Return 500 so Dodo retries until the transaction commits or a true ignore reason applies.
  const message = error instanceof Error ? error.message : "";
  return message === "Billing provider can change only after the prior subscription has ended";
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
    let workspaceId;
    try {
      workspaceId = await resolveBillingWorkspace({
        provider: "dodo",
        providerSubscriptionId: subscriptionId,
        checkoutOperationId: operationId,
        providerCustomerId: customerId,
      });
    } catch (mappingError) {
      const message = mappingError instanceof Error ? mappingError.message : "";
      if (
        message === "No server-owned billing mapping exists" ||
        message === "Provider billing mappings disagree"
      ) {
        const subscription = await getDodoSubscription(subscriptionId);
        if (dodoSubscriptionIsObsolete(subscription)) {
          console.info("Dodo webhook ignored (orphan subscription)", {
            eventId,
            subscriptionId,
            operationId,
          });
          return ignorableDodoWebhookResponse("orphan_subscription");
        }
      }
      throw mappingError;
    }
    if (!(await workspaceRecordExists(workspaceId))) {
      console.info("Dodo webhook ignored (deleted workspace)", {
        eventId,
        subscriptionId,
        workspaceId,
      });
      return ignorableDodoWebhookResponse("deleted_workspace");
    }
    await ensureProviderSubscriptionBinding({
      provider: "dodo",
      providerSubscriptionId: subscriptionId,
      checkoutOperationId: operationId,
      providerCustomerId: customerId,
    });

    let allowRemountFromSubscriptionId;
    let replacesProviderSubscriptionId;
    if (operationId) {
      try {
        const operation = await getBillingCheckoutOperation(String(operationId));
        if (
          operation?.purpose === "hybrid_plan_remount" &&
          operation.replacesProviderSubscriptionId
        ) {
          replacesProviderSubscriptionId = String(operation.replacesProviderSubscriptionId);
          allowRemountFromSubscriptionId = replacesProviderSubscriptionId;
        }
      } catch (opErr) {
        console.warn("Dodo webhook: remount checkout lookup failed", {
          eventId,
          operationId,
          error: opErr instanceof Error ? opErr.message : "unknown",
        });
      }
    }

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
        // Ops / hosted remount: Dodo subscription metadata carries the prior sub id
        // even when Atlas has no checkout_operation Dynamo row.
        if (!allowRemountFromSubscriptionId) {
          const metaReplaces = subscription?.metadata?.atlas_replaces_subscription_id;
          const metaPurpose = subscription?.metadata?.atlas_checkout_purpose;
          if (
            metaPurpose === "hybrid_plan_remount" &&
            typeof metaReplaces === "string" &&
            metaReplaces.trim()
          ) {
            replacesProviderSubscriptionId = metaReplaces.trim();
            allowRemountFromSubscriptionId = replacesProviderSubscriptionId;
          }
        }
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
        return applyVerifiedBillingEvent({
          ...normalized,
          checkoutOperationId: operationId,
          allowRemountFromSubscriptionId,
        });
      }
    );

    // After hybrid remount activates, schedule-cancel the prior sub so it does not renew.
    // Also reset Atlas AR session counters only (models/storage stay live).
    if (
      result?.applied === true &&
      replacesProviderSubscriptionId &&
      replacesProviderSubscriptionId !== subscriptionId &&
      ["subscription.active", "payment.succeeded"].includes(String(webhook.type))
    ) {
      try {
        await cancelDodoSubscription(replacesProviderSubscriptionId);
        console.info("Dodo remount: prior subscription set to cancel at next billing", {
          eventId,
          workspaceId,
          priorSubscriptionId: replacesProviderSubscriptionId,
          newSubscriptionId: subscriptionId,
        });
      } catch (cancelErr) {
        console.warn("Dodo remount: failed to cancel prior subscription", {
          eventId,
          workspaceId,
          priorSubscriptionId: replacesProviderSubscriptionId,
          error: cancelErr instanceof Error ? cancelErr.message : "unknown",
        });
      }
      try {
        const sessionReset = await resetMonthlySessionCount(workspaceId);
        console.info("Dodo remount: Atlas AR sessions reset", {
          eventId,
          workspaceId,
          month: sessionReset.month,
        });
      } catch (sessionErr) {
        console.warn("Dodo remount: Atlas session reset failed", {
          eventId,
          workspaceId,
          error: sessionErr instanceof Error ? sessionErr.message : "unknown",
        });
      }
    }

    // BILL-METER-SYNC: assert live meters match product catalog after plan lifecycle events.
    if (DODO_METER_ASSERT_EVENTS.has(String(webhook.type))) {
      try {
        const live = await getDodoSubscription(subscriptionId);
        const meterAssert = await assertHybridMetersMatchProduct(live);
        if (!meterAssert.ok) {
          console.error("BILL-METER-SYNC mismatch", {
            eventId,
            workspaceId,
            subscriptionId,
            productId: meterAssert.productId,
            mismatches: meterAssert.mismatches,
          });
        }
        await setWorkspaceBillingMeterSync(workspaceId, meterAssert);
      } catch (meterErr) {
        console.warn("BILL-METER-SYNC assert failed", {
          eventId,
          workspaceId,
          subscriptionId,
          error: meterErr instanceof Error ? meterErr.message : "unknown",
        });
      }
    }

    // Atlas-only: sandbox seed clear + session-only reset after bill cycle.
    // Never calls Dodo — meter events / invoices stay. Best-effort; never fail the webhook.
    if (String(webhook.type) === "subscription.renewed") {
      try {
        const sandboxClear = await clearAtlasSandboxUsageIfPresent(workspaceId);
        if (sandboxClear.cleared) {
          console.info("Dodo renew: Atlas sandbox usage cleared", {
            eventId,
            workspaceId,
            month: sandboxClear.month,
          });
        }
      } catch (clearErr) {
        console.warn("Dodo renew: Atlas sandbox clear failed", {
          eventId,
          workspaceId,
          error: clearErr instanceof Error ? clearErr.message : "unknown",
        });
      }
      try {
        const sessionReset = await resetMonthlySessionCount(workspaceId);
        console.info("Dodo renew: Atlas AR sessions reset", {
          eventId,
          workspaceId,
          month: sessionReset.month,
        });
      } catch (sessionErr) {
        console.warn("Dodo renew: Atlas session reset failed", {
          eventId,
          workspaceId,
          error: sessionErr instanceof Error ? sessionErr.message : "unknown",
        });
      }
    }
    return jsonResponse(200, {
      received: true,
      duplicate: result?.duplicate === true,
      applied: result?.applied === true,
    });
  } catch (error) {
    if (isIgnorableDodoWebhookError(error)) {
      console.info("Dodo webhook ignored (reconciliation conflict)", {
        eventId,
        subscriptionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return ignorableDodoWebhookResponse("reconciliation_conflict");
    }
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
