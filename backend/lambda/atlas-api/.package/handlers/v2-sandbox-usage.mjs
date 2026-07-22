import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { requirePlatformOwner } from "../lib/platform-authz.mjs";
import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { getWorkspaceById } from "../lib/dynamodb.mjs";
import { limitsForWorkspace } from "../lib/plan-limits.mjs";
import { effectiveBillingTier } from "../lib/trial.mjs";
import { estimateOverageUsd } from "../lib/overage-estimate.mjs";
import {
  clearMonthlyUsage,
  getMonthlyUsage,
  setMonthlySessionCount,
} from "../lib/usage.mjs";
import { deleteWorkspaceOverage, getWorkspaceOverage } from "../lib/billing-store.mjs";

function sandboxSeedEnabled() {
  return process.env.ATLAS_SANDBOX_USAGE_SEED === "true";
}

/**
 * Seed or clear monthly session usage for overage testing — no local AWS keys.
 * Auth: platform owner always, or workspace admin when ATLAS_SANDBOX_USAGE_SEED=true.
 *
 * POST /v2/workspaces/{id}/sandbox/usage
 * Body: { preset: "overage" } | { sessions: number } | { reset: true } | { resetOverage: true }
 *
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleSandboxSeedUsage(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  if (event.requestContext?.http?.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    let asOwner = false;
    try {
      await requirePlatformOwner(event);
      asOwner = true;
    } catch {
      if (!sandboxSeedEnabled()) {
        return jsonResponse(403, {
          error:
            "Sandbox usage seed is disabled. Set Lambda env ATLAS_SANDBOX_USAGE_SEED=true, or sign in as platform owner.",
        });
      }
      await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    }

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) return jsonResponse(404, { error: "Workspace not found" });

    const body = parseJsonBody(event) || {};

    if (body.resetOverage === true) {
      const monthly = await getMonthlyUsage(workspaceId);
      await deleteWorkspaceOverage(workspaceId, monthly.month);
      return jsonResponse(200, {
        ok: true,
        action: "reset-overage",
        month: monthly.month,
        asOwner,
      });
    }

    if (body.reset === true) {
      const cleared = await clearMonthlyUsage(workspaceId);
      return jsonResponse(200, { ok: true, action: "reset-usage", ...cleared, asOwner });
    }

    const limits = limitsForWorkspace(workspace);
    const tier = effectiveBillingTier(workspace);
    let sessions = null;
    if (body.preset === "overage") {
      sessions = limits.sessionsPerMonth + 150;
    } else if (typeof body.sessions === "number" && Number.isFinite(body.sessions)) {
      sessions = body.sessions;
    } else {
      return jsonResponse(400, {
        error:
          'Provide { "preset": "overage" }, { "sessions": N }, { "reset": true }, or { "resetOverage": true }',
      });
    }

    const seeded = await setMonthlySessionCount(workspaceId, sessions);
    const usage = {
      modelCount: 0,
      sessionCount: seeded.sessionCount,
      storageBytes: 0,
    };
    const estimatedOverageUsd = estimateOverageUsd(tier, usage, limits);
    const overage = await getWorkspaceOverage(workspaceId, seeded.month);

    return jsonResponse(200, {
      ok: true,
      action: "seed",
      asOwner,
      billingTier: tier,
      limits,
      usage: { month: seeded.month, ...usage },
      estimatedOverageUsd,
      overagePaid: overage?.status === "paid",
      overageStatus: overage?.status ?? (estimatedOverageUsd > 0 ? "unpaid" : "none"),
      next: "Refresh Account — Usage overage should show estimated USD > 0",
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return jsonResponse(status, {
      error:
        status >= 500
          ? "Unable to seed sandbox usage"
          : error instanceof Error
            ? error.message
            : "Error",
    });
  }
}
