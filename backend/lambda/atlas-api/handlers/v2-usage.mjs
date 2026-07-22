import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { getWorkspaceById } from "../lib/dynamodb.mjs";
import { readManifest, sumWorkspaceStorageBytes } from "../lib/models-store.mjs";
import { getMonthlyUsage } from "../lib/usage.mjs";
import { buildUsageWarnings, limitsForWorkspace } from "../lib/plan-limits.mjs";
import {
  effectiveBillingTier,
  hasPurchasedTrialFallback,
  isOverageBillable,
  isTrialActive,
  isTrialSuspended,
} from "../lib/trial.mjs";
import { estimateOverageUsd } from "../lib/overage-estimate.mjs";
import { getWorkspaceOverage } from "../lib/billing-store.mjs";
import {
  displayUsageCounts,
  effectiveUsageLimits,
  isSandboxUsageContext,
  OVERAGE_ENTITLEMENT_MATRIX,
} from "../lib/overage-entitlements.mjs";
import { isSandboxUsageSeedEnabled } from "../lib/sandbox-seed-flag.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleWorkspaceUsage(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  if (event.requestContext?.http?.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return jsonResponse(404, { error: "Workspace not found" });
    }

    const [monthly, manifest, storageBytes] = await Promise.all([
      getMonthlyUsage(workspaceId),
      readManifest(workspaceId),
      sumWorkspaceStorageBytes(workspaceId),
    ]);
    const modelCount = Array.isArray(manifest.models) ? manifest.models.length : monthly.modelCount;
    const usage = {
      month: monthly.month,
      modelCount,
      sessionCount: monthly.sessionCount,
      storageBytes,
    };
    const limits = limitsForWorkspace(workspace);
    const planLimits = { ...limits };
    const warnings = buildUsageWarnings(workspace, usage);
    const billingTier = effectiveBillingTier(workspace);
    const trialSuspended = isTrialSuspended(workspace);
    const overageBillable = isOverageBillable(workspace);
    const estimatedOverageUsd = overageBillable
      ? estimateOverageUsd(billingTier, usage, limits)
      : 0;
    const overageRecord = await getWorkspaceOverage(workspaceId, usage.month);
    const overagePaid = overageRecord?.status === "paid";
    const overageAccepted = overageRecord?.status === "accepted";
    const overageAmountUsd =
      typeof overageRecord?.amountUsd === "number" ? overageRecord.amountUsd : null;
    const sandboxSeededAt = monthly.sandboxSeededAt ?? null;
    const sandboxContext = isSandboxUsageContext(
      sandboxSeededAt,
      overageRecord,
      planLimits,
      usage,
    );
    const effectiveLimits = effectiveUsageLimits(planLimits, overageRecord);
    const displayUsage = displayUsageCounts(usage, overageRecord);
    if (!displayUsage.month) displayUsage.month = usage.month;

    return jsonResponse(200, {
      plan: workspace.plan,
      billingTier,
      trialActive: isTrialActive(workspace),
      trialSuspended,
      purchasedBillingTier: workspace.purchasedBillingTier ?? null,
      trialPlan: workspace.trialPlan ?? null,
      trialEndsAt: workspace.trialEndsAt ?? null,
      hasPurchasedTrialFallback: hasPurchasedTrialFallback(workspace),
      limits: planLimits,
      effectiveLimits,
      overageEntitlements: OVERAGE_ENTITLEMENT_MATRIX,
      usage: displayUsage,
      liveUsage: usage,
      warnings,
      estimatedOverageUsd,
      overageBillable,
      overagePaid,
      overageAccepted,
      overageAmountUsd,
      overageStatus: overageRecord?.status ?? (estimatedOverageUsd > 0 ? "unpaid" : "none"),
      overageSandbox: Boolean(overageRecord?.sandbox) || sandboxContext,
      overageHasPayment: Boolean(overageRecord?.providerPaymentId),
      modelsRetained: trialSuspended && usage.modelCount > 0,
      sandboxSeedEnabled: isSandboxUsageSeedEnabled(),
      sandboxSeededAt,
      usageIsSandboxSeeded: Boolean(sandboxSeededAt),
      sandboxClearAvailable: sandboxContext,
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
