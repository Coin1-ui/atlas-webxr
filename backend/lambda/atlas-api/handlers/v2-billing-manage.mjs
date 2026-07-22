import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { jsonResponse, parseJsonBody } from "../lib/http.mjs";
import { getBillingSubscription, markBillingCancelScheduled } from "../lib/billing-store.mjs";
import {
  cancelDodoSubscription,
  cancelDodoScheduledPlanChange,
  changeDodoPlan,
  createDodoPortalSession,
  getDodoSubscription,
} from "../lib/billing-provider-dodo.mjs";
import {
  cancelZohoSubscription,
  changeZohoPlan,
  createZohoPortalSession,
} from "../lib/billing-provider-zoho.mjs";
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
  return jsonResponse(status, {
    error: status >= 500 ? fallback : error instanceof Error ? error.message : "Error",
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
    if (["canceled", "expired"].includes(subscription.status)) {
      return jsonResponse(200, { ok: true, pending: false, status: subscription.status });
    }
    if (subscription.provider === "dodo") {
      await cancelDodoSubscription(subscription.providerSubscriptionId);
    } else {
      await cancelZohoSubscription(subscription.providerSubscriptionId);
    }
    await markBillingCancelScheduled(workspaceId);
    return jsonResponse(202, { ok: true, pending: true, cancelAtPeriodEnd: true });
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
    if (targetTier === subscription.tier) {
      return jsonResponse(200, { ok: true, pending: false, tier: targetTier });
    }
    const effectiveAt = planChangeEffectiveAt(subscription.tier, targetTier);
    const immediate = effectiveAt === "after_confirmed_payment";
    if (subscription.provider === "dodo") {
      const dodoSub = await getDodoSubscription(subscription.providerSubscriptionId);
      if (dodoSub?.on_demand === true) {
        return jsonResponse(409, {
          error:
            "This subscription was created with on-demand billing, which cannot change plans in Dodo. Cancel and Subscribe again to the target plan (new checkouts are standard recurring and support Upgrade/Downgrade).",
          code: "ON_DEMAND_PLAN_CHANGE_NOT_SUPPORTED",
        });
      }
      await changeDodoPlan(
        subscription.providerSubscriptionId,
        targetTier,
        immediate ? "immediately" : "next_billing_date"
      );
    } else {
      await changeZohoPlan(subscription.providerSubscriptionId, targetTier, !immediate);
    }
    return jsonResponse(202, {
      ok: true,
      pending: true,
      tier: targetTier,
      effectiveAt,
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
