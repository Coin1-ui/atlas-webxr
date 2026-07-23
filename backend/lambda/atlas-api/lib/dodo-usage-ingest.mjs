/**
 * Best-effort Dodo meter event ingest from Atlas usage counters.
 * Failures are logged and never block AR analytics or uploads.
 */
import { randomUUID } from "node:crypto";
import { getBillingSubscription } from "./billing-store.mjs";
import { ingestDodoUsageEvents } from "./billing-provider-dodo.mjs";
import { isSandboxDodoIngestEnabled } from "./sandbox-seed-flag.mjs";

const SANDBOX_SESSION_BATCH = 100;

function usageIngestEnabled() {
  if (process.env.ATLAS_BILLING_ENABLED !== "true") return false;
  if (process.env.ATLAS_DODO_USAGE_INGEST === "false") return false;
  return Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim());
}

/**
 * @param {string} workspaceId
 * @returns {Promise<string | null>}
 */
async function dodoCustomerIdForWorkspace(workspaceId) {
  try {
    const sub = await getBillingSubscription(workspaceId);
    if (
      sub?.provider === "dodo" &&
      typeof sub.providerCustomerId === "string" &&
      sub.providerCustomerId.trim() &&
      ["active", "past_due", "canceled"].includes(String(sub.status))
    ) {
      return sub.providerCustomerId.trim();
    }
  } catch (error) {
    console.warn("dodo usage ingest: billing lookup failed", {
      workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  return null;
}

/**
 * @param {string} workspaceId
 * @param {string} sessionId
 */
export async function ingestDodoArSession(workspaceId, sessionId) {
  if (!usageIngestEnabled()) return;
  const customerId = await dodoCustomerIdForWorkspace(workspaceId);
  if (!customerId) return;
  try {
    await ingestDodoUsageEvents([
      {
        event_id: `atlas_ar_session_${workspaceId}_${sessionId}`,
        customer_id: customerId,
        event_name: "atlas.ar_session",
        timestamp: new Date().toISOString(),
        metadata: {
          workspace_id: workspaceId,
          session_id: sessionId,
        },
      },
    ]);
  } catch (error) {
    console.warn("dodo usage ingest: ar_session failed", {
      workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Gauge event — meter aggregation is max(model_count).
 * @param {string} workspaceId
 * @param {number} modelCount
 */
export async function ingestDodoModelCount(workspaceId, modelCount) {
  if (!usageIngestEnabled()) return;
  const customerId = await dodoCustomerIdForWorkspace(workspaceId);
  if (!customerId) return;
  const count = Math.max(0, Math.floor(Number(modelCount) || 0));
  try {
    await ingestDodoUsageEvents([
      {
        event_id: `atlas_model_count_${workspaceId}_${count}_${randomUUID()}`,
        customer_id: customerId,
        event_name: "atlas.model_count",
        timestamp: new Date().toISOString(),
        metadata: {
          workspace_id: workspaceId,
          model_count: count,
        },
      },
    ]);
  } catch (error) {
    console.warn("dodo usage ingest: model_count failed", {
      workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Gauge event — meter aggregation is max(storage_bytes).
 * @param {string} workspaceId
 * @param {number} storageBytes
 */
export async function ingestDodoStorageBytes(workspaceId, storageBytes) {
  if (!usageIngestEnabled()) return;
  const customerId = await dodoCustomerIdForWorkspace(workspaceId);
  if (!customerId) return;
  const bytes = Math.max(0, Math.floor(Number(storageBytes) || 0));
  try {
    await ingestDodoUsageEvents([
      {
        event_id: `atlas_storage_${workspaceId}_${bytes}_${randomUUID()}`,
        customer_id: customerId,
        event_name: "atlas.storage_bytes",
        timestamp: new Date().toISOString(),
        metadata: {
          workspace_id: workspaceId,
          storage_bytes: bytes,
        },
      },
    ]);
  } catch (error) {
    console.warn("dodo usage ingest: storage_bytes failed", {
      workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Sandbox Seed → real Dodo meters (prod-readiness). Opt-in via ATLAS_SANDBOX_DODO_INGEST.
 * Dynamo seed must already have succeeded; this never throws to the caller.
 *
 * @param {string} workspaceId
 * @param {{
 *   sessionCount: number;
 *   modelCount: number;
 *   storageBytes: number;
 *   seedRunId?: string;
 * }} input
 * @returns {Promise<{
 *   enabled: boolean;
 *   skippedReason?: string;
 *   seedRunId: string | null;
 *   sessionsIngested: number;
 *   modelsIngested: boolean;
 *   storageIngested: boolean;
 *   errors: string[];
 * }>}
 */
export async function ingestSandboxOverageToDodo(workspaceId, input) {
  const seedRunId =
    typeof input.seedRunId === "string" && input.seedRunId.trim()
      ? input.seedRunId.trim()
      : randomUUID();
  const empty = {
    enabled: false,
    seedRunId: null,
    sessionsIngested: 0,
    modelsIngested: false,
    storageIngested: false,
    errors: /** @type {string[]} */ ([]),
  };

  if (!isSandboxDodoIngestEnabled()) {
    return { ...empty, skippedReason: "ATLAS_SANDBOX_DODO_INGEST is not true" };
  }
  if (!usageIngestEnabled()) {
    return {
      ...empty,
      enabled: true,
      seedRunId,
      skippedReason: "Dodo usage ingest disabled or missing API key",
      errors: ["Dodo usage ingest is not configured"],
    };
  }

  const customerId = await dodoCustomerIdForWorkspace(workspaceId);
  if (!customerId) {
    return {
      ...empty,
      enabled: true,
      seedRunId,
      skippedReason: "No active Dodo subscription customer on workspace",
      errors: ["No Dodo customer mapping for this workspace"],
    };
  }

  const sessionCount = Math.max(0, Math.floor(Number(input.sessionCount) || 0));
  const modelCount = Math.max(0, Math.floor(Number(input.modelCount) || 0));
  const storageBytes = Math.max(0, Math.floor(Number(input.storageBytes) || 0));
  const errors = [];
  let sessionsIngested = 0;
  let modelsIngested = false;
  let storageIngested = false;
  const ts = new Date().toISOString();

  for (let offset = 0; offset < sessionCount; offset += SANDBOX_SESSION_BATCH) {
    const end = Math.min(offset + SANDBOX_SESSION_BATCH, sessionCount);
    /** @type {Array<{ event_id: string; customer_id: string; event_name: string; timestamp: string; metadata: Record<string, string|number|boolean> }>} */
    const batch = [];
    for (let i = offset; i < end; i += 1) {
      batch.push({
        event_id: `atlas_sandbox_session_${workspaceId}_${seedRunId}_${i}`,
        customer_id: customerId,
        event_name: "atlas.ar_session",
        timestamp: ts,
        metadata: {
          workspace_id: workspaceId,
          sandbox: true,
          seed_run_id: seedRunId,
          session_index: i,
        },
      });
    }
    try {
      await ingestDodoUsageEvents(batch);
      sessionsIngested += batch.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "session batch failed";
      errors.push(`sessions[${offset}-${end}): ${msg}`);
      console.warn("dodo sandbox ingest: session batch failed", {
        workspaceId,
        offset,
        end,
        error: msg,
      });
      break;
    }
  }

  if (modelCount > 0) {
    try {
      await ingestDodoUsageEvents([
        {
          event_id: `atlas_sandbox_model_${workspaceId}_${seedRunId}_${modelCount}`,
          customer_id: customerId,
          event_name: "atlas.model_count",
          timestamp: ts,
          metadata: {
            workspace_id: workspaceId,
            model_count: modelCount,
            sandbox: true,
            seed_run_id: seedRunId,
          },
        },
      ]);
      modelsIngested = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "model gauge failed";
      errors.push(`models: ${msg}`);
    }
  }

  if (storageBytes > 0) {
    try {
      await ingestDodoUsageEvents([
        {
          event_id: `atlas_sandbox_storage_${workspaceId}_${seedRunId}_${storageBytes}`,
          customer_id: customerId,
          event_name: "atlas.storage_bytes",
          timestamp: ts,
          metadata: {
            workspace_id: workspaceId,
            storage_bytes: storageBytes,
            sandbox: true,
            seed_run_id: seedRunId,
          },
        },
      ]);
      storageIngested = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "storage gauge failed";
      errors.push(`storage: ${msg}`);
    }
  }

  return {
    enabled: true,
    seedRunId,
    sessionsIngested,
    modelsIngested,
    storageIngested,
    errors,
  };
}
