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
import { isSandboxUsageContext } from "../lib/overage-entitlements.mjs";

function sandboxSeedEnabled() {
  return process.env.ATLAS_SANDBOX_USAGE_SEED === "true";
}

/** Seed requires env or platform owner; clear also allowed for leftover test rows. */
async function assertSandboxAccess(event, workspaceId) {
  let asOwner = false;
  try {
    await requirePlatformOwner(event);
    asOwner = true;
  } catch {
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    // Workspace admins may always attempt clear; seed still gated below.
  }
  return { asOwner, denied: null };
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
    const access = await assertSandboxAccess(event, workspaceId);
    if (access.denied) return access.denied;
    const { asOwner } = access;

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) return jsonResponse(404, { error: "Workspace not found" });

    const body = parseJsonBody(event) || {};

    if (body.resetOverage === true) {
      const monthly = await getMonthlyUsage(workspaceId);
      const overage = await getWorkspaceOverage(workspaceId, monthly.month);
      const limits = limitsForWorkspace(workspace);
      const force = body.force === true && asOwner;
      const sandboxCtx = isSandboxUsageContext(
        monthly.sandboxSeededAt,
        overage,
        limits,
        monthly,
      );
      if (!force && !sandboxCtx) {
        return jsonResponse(403, {
          error: "Only leftover test overage can be cleared.",
          code: "OVERAGE_NOT_SANDBOX",
        });
      }
      await deleteWorkspaceOverage(workspaceId, monthly.month);
      return jsonResponse(200, {
        ok: true,
        action: "reset-overage",
        month: monthly.month,
        asOwner,
        forced: force,
      });
    }

    if (body.reset === true || body.resetAll === true) {
      const monthly = await getMonthlyUsage(workspaceId);
      const overage = await getWorkspaceOverage(workspaceId, monthly.month);
      const limits = limitsForWorkspace(workspace);
      const force = body.force === true && asOwner;
      const sandboxCtx = isSandboxUsageContext(
        monthly.sandboxSeededAt,
        overage,
        limits,
        monthly,
      );
      if (!force && !sandboxCtx) {
        return jsonResponse(403, {
          error: "Only leftover test usage can be cleared.",
          code: "USAGE_NOT_SANDBOX",
        });
      }
      const cleared = await clearMonthlyUsage(workspaceId, monthly.month);
      await deleteWorkspaceOverage(workspaceId, monthly.month);
      return jsonResponse(200, {
        ok: true,
        action: "reset-all",
        ...cleared,
        overageCleared: true,
        asOwner,
        forced: force,
      });
    }

    if (!sandboxSeedEnabled() && !asOwner) {
      return jsonResponse(403, {
        error:
          "Sandbox usage seed is disabled. Set Lambda env ATLAS_SANDBOX_USAGE_SEED=true, or sign in as platform owner.",
      });
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
