import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { getWorkspaceById } from "../lib/dynamodb.mjs";
import { readManifest, sumWorkspaceStorageBytes } from "../lib/models-store.mjs";
import { getMonthlyUsage } from "../lib/usage.mjs";
import { buildUsageWarnings, limitsForWorkspace } from "../lib/plan-limits.mjs";
import { effectiveBillingTier, hasPurchasedTrialFallback, isTrialActive, isTrialSuspended, isServicePaused, servicePauseReason } from "../lib/trial.mjs";

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
    const warnings = buildUsageWarnings(workspace, usage);

    return jsonResponse(200, {
      plan: workspace.plan,
      billingTier: effectiveBillingTier(workspace),
      trialActive: isTrialActive(workspace),
      trialSuspended: isTrialSuspended(workspace),
      servicePaused: isServicePaused(workspace),
      pauseReason: servicePauseReason(workspace),
      purchasedBillingTier: workspace.purchasedBillingTier ?? null,
      trialPlan: workspace.trialPlan ?? null,
      trialEndsAt: workspace.trialEndsAt ?? null,
      hasPurchasedTrialFallback: hasPurchasedTrialFallback(workspace),
      limits,
      usage,
      warnings,
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
