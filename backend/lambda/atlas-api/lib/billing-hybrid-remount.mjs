import { createHash, randomUUID } from "node:crypto";
import {
  createBillingCheckoutOperation,
  markBillingCheckoutProviderCallStarted,
  recordProviderCheckout,
  releaseCheckoutLease,
} from "./billing-store.mjs";
import {
  cancelDodoScheduledPlanChange,
  createDodoCheckout,
  isDodoUsageHybridEnabled,
  preflightDodoCheckout,
} from "./billing-provider-dodo.mjs";

/**
 * BILL-METER-SYNC: open a new USAGE hybrid checkout so meters snapshot from the
 * target product. Dodo change-plan updates product_id but keeps stale free thresholds.
 *
 * @param {{
 *   workspaceId: string;
 *   subscription: { providerSubscriptionId: string; providerCustomerId?: string | null };
 *   targetTier: string;
 *   billingCountry: string;
 *   email: string;
 *   couponCode?: string;
 * }} input
 */
export async function createHybridPlanRemountCheckout(input) {
  if (!isDodoUsageHybridEnabled()) {
    throw Object.assign(new Error("Hybrid usage remount is not configured"), { statusCode: 409 });
  }
  const workspaceId = String(input.workspaceId || "").trim();
  const targetTier = String(input.targetTier || "").trim().toLowerCase();
  const billingCountry = String(input.billingCountry || "").trim().toUpperCase();
  const email = String(input.email || "").trim().toLowerCase();
  const replacesId = String(input.subscription?.providerSubscriptionId || "").trim();
  if (!workspaceId || !replacesId) {
    throw Object.assign(new Error("Subscription mapping is incomplete for remount"), {
      statusCode: 409,
    });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw Object.assign(new Error("A valid billing email is required for plan remount checkout"), {
      statusCode: 400,
    });
  }

  // Clear any pending change-plan so it cannot fight the remount.
  await cancelDodoScheduledPlanChange(replacesId, { ignoreMissing: true });

  const provider = "dodo";
  const idempotencyKey = `hybrid-remount-${randomUUID()}`;
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        provider,
        tier: targetTier,
        billingCountry,
        purpose: "hybrid_plan_remount",
        replaces: replacesId,
        email,
        couponCode: input.couponCode || null,
      })
    )
    .digest("hex");

  preflightDodoCheckout(targetTier);
  let operation = await createBillingCheckoutOperation({
    workspaceId,
    provider,
    tier: targetTier,
    billingCountry,
    couponCode: input.couponCode,
    idempotencyKey,
    requestHash,
    purpose: "hybrid_plan_remount",
    replacesProviderSubscriptionId: replacesId,
  });

  if (
    operation.status === "provider_created" &&
    operation.checkoutUrl &&
    operation.reused &&
    operation.idempotencyKey !== idempotencyKey
  ) {
    await releaseCheckoutLease(workspaceId, operation.operationId);
    operation = await createBillingCheckoutOperation({
      workspaceId,
      provider,
      tier: targetTier,
      billingCountry,
      couponCode: input.couponCode,
      idempotencyKey,
      requestHash,
      purpose: "hybrid_plan_remount",
      replacesProviderSubscriptionId: replacesId,
    });
  }

  if (operation.status === "provider_created" && operation.checkoutUrl) {
    return {
      operationId: operation.operationId,
      provider,
      checkoutUrl: String(operation.checkoutUrl),
      reused: true,
      remount: true,
      replacesProviderSubscriptionId: replacesId,
      tier: targetTier,
    };
  }

  if (operation.status === "pending_provider") {
    await markBillingCheckoutProviderCallStarted(operation.operationId, provider);
  } else if (!(operation.status === "provider_call_started" && operation.reused)) {
    throw Object.assign(new Error("Checkout creation is pending reconciliation"), {
      statusCode: 409,
      operationId: operation.operationId,
    });
  }

  const customerId =
    typeof input.subscription?.providerCustomerId === "string"
      ? input.subscription.providerCustomerId.trim()
      : "";
  const providerResult = await createDodoCheckout(operation, {
    email,
    billingAddress: {},
    ...(customerId ? { customerId } : {}),
  });
  await recordProviderCheckout({
    operationId: operation.operationId,
    provider,
    providerCheckoutId: providerResult.providerCheckoutId,
    checkoutUrl: providerResult.checkoutUrl,
  });
  return {
    operationId: operation.operationId,
    provider,
    checkoutUrl: providerResult.checkoutUrl,
    reused: false,
    remount: true,
    replacesProviderSubscriptionId: replacesId,
    tier: targetTier,
  };
}
