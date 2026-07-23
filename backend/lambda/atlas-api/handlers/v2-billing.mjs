import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { billingEntitlementTier } from "../lib/billing-state.mjs";
import { getBillingSubscription } from "../lib/billing-store.mjs";
import { scheduledPlanChangeFromDodoSubscription, getDodoSubscription } from "../lib/billing-provider-dodo.mjs";
import { reconcileDodoSubscriptionIfDrifted } from "../lib/billing-reconcile-dodo.mjs";

/**
 * GET /v2/workspaces/{id}/billing/status — authoritative provider subscription state.
 * Reconciles cancel/terminal drift from live Dodo when Dynamo lags (missed webhooks).
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleBillingStatus(event, workspaceId) {
  if (event.requestContext?.http?.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }
  try {
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    let subscription = await getBillingSubscription(workspaceId);
    let scheduledPlanChange = null;

    if (
      process.env.ATLAS_BILLING_ENABLED === "true" &&
      subscription?.provider === "dodo" &&
      subscription.providerSubscriptionId
    ) {
      try {
        const reconciled = await reconcileDodoSubscriptionIfDrifted({
          workspaceId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          current: subscription,
        });
        subscription = reconciled.subscription ?? subscription;
        scheduledPlanChange = reconciled.scheduledPlanChange;
      } catch (error) {
        // Soft-fail: still return Dynamo projection + best-effort schedule read.
        console.error("billing/status Dodo reconcile failed", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        try {
          if (!["expired", "canceled"].includes(String(subscription.status || ""))) {
            const live = await getDodoSubscription(subscription.providerSubscriptionId);
            scheduledPlanChange = scheduledPlanChangeFromDodoSubscription(live);
          }
        } catch {
          scheduledPlanChange = null;
        }
      }
    }

    return jsonResponse(200, {
      subscription,
      entitlementTier: billingEntitlementTier(subscription),
      scheduledPlanChange,
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, {
      error: status >= 500 ? "Unable to load billing status" : e instanceof Error ? e.message : "Error",
    });
  }
}

/**
 * POST /v2/workspaces/{id}/billing/upgrade — retired direct-mutation endpoint.
 * Checkout creation will replace this route after provider sandbox approval.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleBillingUpgrade(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  if (event.requestContext?.http?.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  return jsonResponse(501, {
    error: "Payment required",
    paymentRequired: true,
    hint: "Direct tier upgrades are retired. Use provider checkout when billing is enabled.",
  });
}
