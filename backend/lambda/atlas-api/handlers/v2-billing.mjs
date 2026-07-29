import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { billingEntitlementTier } from "../lib/billing-state.mjs";
import { getBillingSubscription } from "../lib/billing-store.mjs";
import {
  assertHybridMetersMatchProduct,
  dodoSubscriptionIsUsageHybrid,
  getDodoSubscription,
  scheduledPlanChangeFromDodoSubscription,
} from "../lib/billing-provider-dodo.mjs";
import { reconcileDodoSubscriptionIfDrifted } from "../lib/billing-reconcile-dodo.mjs";
import {
  clearWorkspaceStuckPaymentCancel,
  enforceStuckPaymentsForSubscription,
  workspaceStuckPaymentCancelInfo,
} from "../lib/billing-stuck-payment.mjs";
import { needsOveragePlanRemount } from "../lib/overage-estimate.mjs";
import { limitsForBillingTier } from "../lib/plan-limits.mjs";
import { loadWorkspaceUsageSnapshot } from "../lib/workspace-usage-snapshot.mjs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function workspaceMeterMismatchFlag(workspaceId) {
  try {
    const row = await doc.send(
      new GetCommand({
        TableName: process.env.ATLAS_WORKSPACES_TABLE || "atlas-workspaces",
        Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
        ConsistentRead: true,
      })
    );
    const at = row.Item?.billingMeterMismatchAt;
    if (!at) return null;
    return {
      flaggedAt: String(at),
      detail: row.Item?.billingMeterMismatchDetail
        ? String(row.Item.billingMeterMismatchDetail)
        : null,
    };
  } catch {
    return null;
  }
}

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
        if (!["expired", "canceled"].includes(String(subscription.status || ""))) {
          const stuck = await enforceStuckPaymentsForSubscription({
            workspaceId,
            providerSubscriptionId: subscription.providerSubscriptionId,
            providerCustomerId: subscription.providerCustomerId || null,
          });
          if (stuck.cancelled) {
            console.info("billing/status stuck payment cancel", {
              workspaceId,
              paymentId: stuck.paymentId,
              subscriptionId: stuck.subscriptionId,
            });
          }
        }
        const reconciled = await reconcileDodoSubscriptionIfDrifted({
          workspaceId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          current: await getBillingSubscription(workspaceId),
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

    // Healthy live entitlement → drop stale stuck-payment Account hint (post-resubscribe).
    if (billingEntitlementTier(subscription)) {
      try {
        await clearWorkspaceStuckPaymentCancel(workspaceId);
      } catch {
        /* best-effort */
      }
    }
    const stuckCancelInfo = await workspaceStuckPaymentCancelInfo(workspaceId);

    let meterSync = { ok: true, checked: false };
    let usageHybrid = false;
    let inOverage = false;
    if (
      process.env.ATLAS_BILLING_ENABLED === "true" &&
      subscription?.provider === "dodo" &&
      subscription.providerSubscriptionId &&
      !["expired", "canceled"].includes(String(subscription.status || ""))
    ) {
      try {
        const live = await getDodoSubscription(subscription.providerSubscriptionId);
        usageHybrid = dodoSubscriptionIsUsageHybrid(live);
        const assert = await assertHybridMetersMatchProduct(live);
        meterSync = {
          ok: assert.ok === true || assert.skipped === true,
          checked: true,
          productId: assert.productId || null,
          mismatches: assert.ok || assert.skipped ? [] : assert.mismatches,
          message:
            assert.ok || assert.skipped
              ? null
              : "Overage meters on your subscription do not match your plan. Resubscribe via checkout (Upgrade/Downgrade or Refresh overage limits) — your current plan will be canceled after the new subscription is active — so the next bill uses the correct plan limits.",
        };
        if (!scheduledPlanChange) {
          scheduledPlanChange = scheduledPlanChangeFromDodoSubscription(live);
        }
      } catch (meterErr) {
        console.error("billing/status meter sync check failed", {
          workspaceId,
          error: meterErr instanceof Error ? meterErr.message : "Unknown error",
        });
        const flagged = await workspaceMeterMismatchFlag(workspaceId);
        if (flagged) {
          meterSync = {
            ok: false,
            checked: false,
            flaggedAt: flagged.flaggedAt,
            message:
              "Overage meter sync could not be verified. Contact support if plan limits look wrong after an upgrade.",
          };
        }
      }
      try {
        const usage = await loadWorkspaceUsageSnapshot(workspaceId);
        const limits = limitsForBillingTier(subscription.tier);
        inOverage = needsOveragePlanRemount(subscription.tier, usage, limits);
      } catch (usageErr) {
        console.error("billing/status overage check failed", {
          workspaceId,
          error: usageErr instanceof Error ? usageErr.message : "Unknown error",
        });
      }
    }

    return jsonResponse(200, {
      subscription,
      entitlementTier: billingEntitlementTier(subscription),
      scheduledPlanChange,
      meterSync,
      usageHybrid,
      inOverage,
      // Usage hybrids always remount (Dodo change-plan 500s / stale meters).
      // Classic: remount only while in overage; otherwise scheduled change-plan.
      planChangeMode: usageHybrid || inOverage ? "remount_checkout" : "scheduled",
      cancelReason: stuckCancelInfo?.cancelReason || null,
      stuckPaymentCancel: stuckCancelInfo,
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
