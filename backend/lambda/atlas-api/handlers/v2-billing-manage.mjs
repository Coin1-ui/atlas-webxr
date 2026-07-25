import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { jsonResponse, parseJsonBody } from "../lib/http.mjs";
import {
  getBillingSubscription,
  markBillingCancelCleared,
  markBillingCancelScheduled,
} from "../lib/billing-store.mjs";
import {
  assertHybridMetersMatchProduct,
  cancelDodoSubscription,
  cancelDodoScheduledPlanChange,
  changeDodoPlan,
  createDodoPortalSession,
  getDodoSubscription,
  isDodoUsageHybridEnabled,
  uncancelDodoSubscription,
} from "../lib/billing-provider-dodo.mjs";
import {
  cancelZohoSubscription,
  changeZohoPlan,
  createZohoPortalSession,
} from "../lib/billing-provider-zoho.mjs";
import { createHybridPlanRemountCheckout } from "../lib/billing-hybrid-remount.mjs";
import { planChangeEffectiveAt } from "../lib/billing-policy.mjs";
import { billingEntitlementTier } from "../lib/billing-state.mjs";

async function activeSubscription(event, workspaceId) {
  if (process.env.ATLAS_BILLING_ENABLED !== "true") {
    throw Object.assign(new Error("Billing is not enabled"), { statusCode: 503 });
  }
  await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
  const subscription = await getBillingSubscription(workspaceId);
  if (!subscription) {
    throw Object.assign(new Error("No provider subscription exists"), { statusCode: 404 });
  }
  return subscription;
}

function errorResponse(error, fallback) {
  const status = error?.statusCode || 500;
  const detail =
    error instanceof Error && typeof error.message === "string" ? error.message.trim() : "";
  // Prefer provider/detail messages even on 5xx — masking as a generic fallback hid Dodo
  // INTERNAL_SERVER_ERROR / PENDING_PLAN_CHANGE_EXISTS causes on Account Upgrade/Downgrade.
  return jsonResponse(status, {
    error: detail && detail !== "Error" ? detail : fallback,
  });
}

export async function handleBillingPortal(event, workspaceId) {
  try {
    const body = parseJsonBody(event);
    const billingCountry =
      typeof body?.billingCountry === "string" ? body.billingCountry.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(billingCountry)) {
      return jsonResponse(400, { error: "billingCountry must be an ISO country code" });
    }
    const subscription = await activeSubscription(event, workspaceId);
    if (subscription.provider === "dodo") {
      if (!subscription.providerCustomerId) {
        return jsonResponse(409, { error: "Dodo customer mapping is not ready" });
      }
      return jsonResponse(200, await createDodoPortalSession(subscription.providerCustomerId));
    }
    return jsonResponse(200, createZohoPortalSession());
  } catch (error) {
    return errorResponse(error, "Unable to create billing portal session");
  }
}

export async function handleBillingCancel(event, workspaceId) {
  try {
    const subscription = await activeSubscription(event, workspaceId);
    const body = parseJsonBody(event);
    if (body?.cancelScheduledPlanChange === true) {
      if (subscription.provider !== "dodo") {
        return jsonResponse(501, {
          error: "Canceling a scheduled plan change is only supported for Dodo subscriptions",
        });
      }
      if (["canceled", "expired"].includes(subscription.status)) {
        return jsonResponse(409, {
          error: "This subscription has ended. Start a new checkout instead.",
        });
      }
      await cancelDodoScheduledPlanChange(subscription.providerSubscriptionId);
      return jsonResponse(200, { ok: true, scheduledPlanChange: null });
    }
    if (body?.undoCancel === true) {
      if (["canceled", "expired"].includes(subscription.status)) {
        return jsonResponse(409, {
          error: "This subscription has ended. Start a new checkout instead.",
        });
      }
      if (subscription.provider === "dodo") {
        await uncancelDodoSubscription(subscription.providerSubscriptionId);
      } else {
        return jsonResponse(501, {
          error:
            "Undo cancel is only supported for Dodo on Account. Use Manage payment method & invoices for Zoho.",
        });
      }
      await markBillingCancelCleared(workspaceId);
      return jsonResponse(200, { ok: true, cancelAtPeriodEnd: false });
    }
    if (["canceled", "expired"].includes(subscription.status)) {
      return jsonResponse(200, { ok: true, pending: false, status: subscription.status });
    }
    if (subscription.provider === "dodo") {
      // Product rule: cancel-at-renewal clears any pending plan change so both
      // intents cannot coexist (cancel wins; scheduled upgrade would never activate).
      await cancelDodoScheduledPlanChange(subscription.providerSubscriptionId, {
        ignoreMissing: true,
      });
      await cancelDodoSubscription(subscription.providerSubscriptionId);
    } else {
      await cancelZohoSubscription(subscription.providerSubscriptionId);
    }
    await markBillingCancelScheduled(workspaceId);
    return jsonResponse(202, {
      ok: true,
      pending: true,
      cancelAtPeriodEnd: true,
      scheduledPlanChange: null,
    });
  } catch (error) {
    return errorResponse(error, "Unable to schedule cancellation");
  }
}

export async function handleBillingChangePlan(event, workspaceId) {
  try {
    const subscription = await activeSubscription(event, workspaceId);
    const body = parseJsonBody(event);
    const targetTier =
      typeof body?.tier === "string" ? body.tier.trim().toLowerCase() : "";
    const billingCountry =
      typeof body?.billingCountry === "string" ? body.billingCountry.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(billingCountry)) {
      return jsonResponse(400, { error: "billingCountry must be an ISO country code" });
    }
    if (!["starter", "launch", "growth"].includes(targetTier)) {
      return jsonResponse(400, { error: "tier must be starter, launch, or growth" });
    }
    if (
      subscription.status === "expired" ||
      (subscription.status !== "canceled" && billingEntitlementTier(subscription) === null)
    ) {
      return jsonResponse(409, {
        error: "This subscription has ended. Start a new checkout instead of changing plan.",
      });
    }
    if (subscription.cancelAtPeriodEnd === true) {
      return jsonResponse(409, {
        error:
          "This subscription is set to cancel at renewal. Undo cancellation first, then Upgrade or Downgrade.",
        code: "CANCEL_SCHEDULED_BLOCKS_PLAN_CHANGE",
      });
    }
    const effectiveAt = planChangeEffectiveAt(subscription.tier, targetTier);
    const immediate = effectiveAt === "after_confirmed_payment";
    const sameTier = targetTier === subscription.tier;
    if (subscription.provider === "dodo") {
      const dodoSub = await getDodoSubscription(subscription.providerSubscriptionId);
      if (dodoSub?.cancel_at_next_billing_date === true) {
        return jsonResponse(409, {
          error:
            "This subscription is set to cancel at renewal. Undo cancellation first, then Upgrade or Downgrade.",
          code: "CANCEL_SCHEDULED_BLOCKS_PLAN_CHANGE",
        });
      }
      if (dodoSub?.on_demand === true) {
        return jsonResponse(409, {
          error:
            "This subscription was created with on-demand billing, which cannot change plans in Dodo. Cancel and Subscribe again to the target plan (new checkouts are standard recurring and support Upgrade/Downgrade).",
          code: "ON_DEMAND_PLAN_CHANGE_NOT_SUPPORTED",
        });
      }
      // BILL-METER-SYNC: usage hybrids must remount via checkout so meters match the new product.
      // Same-tier remount is allowed when live meters do not match the product catalog.
      if (isDodoUsageHybridEnabled()) {
        if (sameTier) {
          const meterAssert = await assertHybridMetersMatchProduct(dodoSub);
          if (meterAssert.ok || meterAssert.skipped) {
            return jsonResponse(200, { ok: true, pending: false, tier: targetTier });
          }
        }
        const email =
          typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        const couponCode =
          typeof body?.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
        let customerId = subscription.providerCustomerId || null;
        if (!customerId && dodoSub?.customer?.customer_id) {
          customerId = String(dodoSub.customer.customer_id);
        }
        const remount = await createHybridPlanRemountCheckout({
          workspaceId,
          subscription: {
            providerSubscriptionId: subscription.providerSubscriptionId,
            providerCustomerId: customerId,
          },
          targetTier,
          billingCountry,
          email,
          couponCode: couponCode || undefined,
        });
        return jsonResponse(200, {
          ok: true,
          pending: true,
          remount: true,
          checkoutUrl: remount.checkoutUrl,
          operationId: remount.operationId,
          provider: remount.provider,
          tier: targetTier,
          currentTier: subscription.tier,
          replacesProviderSubscriptionId: remount.replacesProviderSubscriptionId,
          // Entitlement switches when the new checkout subscription becomes active.
          activatesOnAtlas: "when_remount_checkout_completes",
          message: sameTier
            ? "Complete checkout to refresh overage meters for your current plan."
            : "Complete checkout to switch plans. Overage limits update from the new plan meters after payment.",
        });
      }
      if (sameTier) {
        return jsonResponse(200, { ok: true, pending: false, tier: targetTier });
      }
      await changeDodoPlan(
        subscription.providerSubscriptionId,
        targetTier,
        immediate ? "immediately" : "next_billing_date"
      );
    } else {
      if (sameTier) {
        return jsonResponse(200, { ok: true, pending: false, tier: targetTier });
      }
      await changeZohoPlan(subscription.providerSubscriptionId, targetTier, !immediate);
    }
    return jsonResponse(202, {
      ok: true,
      pending: true,
      tier: targetTier,
      currentTier: subscription.tier,
      effectiveAt,
      // Atlas entitlements stay on currentTier until Dodo applies the change
      // (period end / cancel-at-period-end) and webhooks update product_id.
      activatesOnAtlas: "when_current_period_ends",
    });
  } catch (error) {
    return errorResponse(error, "Unable to change billing plan");
  }
}

/** POST /v2/workspaces/{id}/billing/plan/scheduled/cancel — clear pending Dodo plan change. */
export async function handleBillingCancelScheduledPlan(event, workspaceId) {
  try {
    const subscription = await activeSubscription(event, workspaceId);
    if (subscription.provider !== "dodo") {
      return jsonResponse(501, {
        error: "Canceling a scheduled plan change is only supported for Dodo subscriptions",
      });
    }
    if (["canceled", "expired"].includes(subscription.status)) {
      return jsonResponse(409, {
        error: "This subscription has ended. Start a new checkout instead.",
      });
    }
    await cancelDodoScheduledPlanChange(subscription.providerSubscriptionId);
    return jsonResponse(200, { ok: true, scheduledPlanChange: null });
  } catch (error) {
    return errorResponse(error, "Unable to cancel scheduled plan change");
  }
}
