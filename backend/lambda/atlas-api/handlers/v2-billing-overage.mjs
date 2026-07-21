import { randomUUID } from "node:crypto";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { getWorkspaceById } from "../lib/dynamodb.mjs";
import { readManifest, sumWorkspaceStorageBytes } from "../lib/models-store.mjs";
import { getMonthlyUsage } from "../lib/usage.mjs";
import { limitsForWorkspace } from "../lib/plan-limits.mjs";
import { effectiveBillingTier } from "../lib/trial.mjs";
import { estimateOverageUsd, normalizeOverageMonth } from "../lib/overage-estimate.mjs";
import {
  getBillingSubscription,
  getWorkspaceOverage,
  recordWorkspaceOverageCharge,
} from "../lib/billing-store.mjs";
import { createDodoOverageCharge } from "../lib/billing-provider-dodo.mjs";

async function loadUsageSnapshot(workspaceId) {
  const [monthly, manifest, storageBytes] = await Promise.all([
    getMonthlyUsage(workspaceId),
    readManifest(workspaceId),
    sumWorkspaceStorageBytes(workspaceId),
  ]);
  const modelCount = Array.isArray(manifest.models) ? manifest.models.length : monthly.modelCount;
  return {
    month: monthly.month,
    modelCount,
    sessionCount: monthly.sessionCount,
    storageBytes,
  };
}

function overageResponse(record, computedAmountUsd) {
  const paid = record?.status === "paid";
  return {
    month: record?.month ?? null,
    amountUsd: record?.amountUsd ?? computedAmountUsd ?? 0,
    estimatedAmountUsd: computedAmountUsd ?? 0,
    overagePaid: paid,
    status: record?.status ?? (computedAmountUsd > 0 ? "unpaid" : "none"),
    paymentId: record?.providerPaymentId ?? null,
    paidAt: record?.paidAt ?? null,
  };
}

export async function handleBillingOverage(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  const method = event.requestContext?.http?.method;
  if (method !== "GET" && method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    if (process.env.ATLAS_BILLING_ENABLED !== "true") {
      return jsonResponse(503, { error: "Billing is not enabled" });
    }
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) return jsonResponse(404, { error: "Workspace not found" });

    const usage = await loadUsageSnapshot(workspaceId);
    const tier = effectiveBillingTier(workspace);
    const limits = limitsForWorkspace(workspace);
    const estimatedAmountUsd = estimateOverageUsd(tier, usage, limits);

    if (method === "GET") {
      const month =
        typeof event.queryStringParameters?.month === "string"
          ? normalizeOverageMonth(event.queryStringParameters.month)
          : usage.month;
      const record = await getWorkspaceOverage(workspaceId, month);
      return jsonResponse(200, overageResponse(record, estimatedAmountUsd));
    }

    const body = parseJsonBody(event);
    if (body?.accept !== true) {
      return jsonResponse(400, { error: "accept must be true" });
    }
    const month = normalizeOverageMonth(body?.month ?? usage.month);
    if (month !== usage.month) {
      return jsonResponse(400, { error: "Overage can only be accepted for the current usage month" });
    }
    if (estimatedAmountUsd <= 0) {
      return jsonResponse(400, { error: "No overage charges apply for this period" });
    }
    if (tier === "scale") {
      return jsonResponse(400, { error: "Scale workspaces are invoiced manually" });
    }

    const clientAmountUsd =
      typeof body?.amountUsd === "number" && Number.isFinite(body.amountUsd)
        ? Math.round(body.amountUsd * 100) / 100
        : null;
    if (clientAmountUsd !== null && Math.abs(clientAmountUsd - estimatedAmountUsd) > 0.02) {
      return jsonResponse(409, {
        error: "Overage amount changed. Refresh the page and try again.",
        amountUsd: estimatedAmountUsd,
      });
    }

    const existing = await getWorkspaceOverage(workspaceId, month);
    if (existing?.status === "paid") {
      return jsonResponse(200, {
        ok: true,
        alreadyPaid: true,
        ...overageResponse(existing, estimatedAmountUsd),
      });
    }
    if (existing?.status === "accepted") {
      return jsonResponse(200, {
        ok: true,
        alreadyAccepted: true,
        paymentPending: true,
        ...overageResponse(existing, estimatedAmountUsd),
      });
    }

    const operationId = randomUUID();
    const subscription = await getBillingSubscription(workspaceId);
    const amountMinor = Math.round(estimatedAmountUsd * 100);

    if (
      subscription?.provider === "dodo" &&
      subscription.providerSubscriptionId &&
      ["active", "past_due"].includes(subscription.status)
    ) {
      try {
        const charge = await createDodoOverageCharge(subscription.providerSubscriptionId, {
          amountMinor,
          month,
          workspaceId,
          operationId,
        });
        const record = await recordWorkspaceOverageCharge({
          workspaceId,
          month,
          amountUsd: estimatedAmountUsd,
          status: "paid",
          provider: "dodo",
          providerPaymentId: charge.paymentId,
          operationId,
          paidAt: new Date().toISOString(),
        });
        return jsonResponse(200, {
          ok: true,
          method: "dodo_charge",
          ...overageResponse(record, estimatedAmountUsd),
        });
      } catch (chargeError) {
        const message = chargeError instanceof Error ? chargeError.message : "Charge failed";
        const record = await recordWorkspaceOverageCharge({
          workspaceId,
          month,
          amountUsd: estimatedAmountUsd,
          status: "accepted",
          provider: subscription.provider,
          operationId,
          note: message.slice(0, 500),
        });
        return jsonResponse(200, {
          ok: true,
          method: "accepted",
          paymentPending: true,
          message:
            "Overage accepted. Automatic card charge is unavailable for this subscription — our team will follow up on invoicing.",
          ...overageResponse(record, estimatedAmountUsd),
        });
      }
    }

    const record = await recordWorkspaceOverageCharge({
      workspaceId,
      month,
      amountUsd: estimatedAmountUsd,
      status: "accepted",
      provider: subscription?.provider ?? null,
      operationId,
      note: subscription ? "No chargeable subscription" : "No active subscription",
    });
    return jsonResponse(200, {
      ok: true,
      method: "accepted",
      paymentPending: true,
      message: "Overage accepted. We will follow up on invoicing for this period.",
      ...overageResponse(record, estimatedAmountUsd),
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return jsonResponse(status, {
      error: status >= 500 ? "Unable to process overage" : error instanceof Error ? error.message : "Error",
    });
  }
}
