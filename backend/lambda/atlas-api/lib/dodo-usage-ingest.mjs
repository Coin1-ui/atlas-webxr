/**
 * Best-effort Dodo meter event ingest from Atlas usage counters.
 * Failures are logged and never block AR analytics or uploads.
 */
import { randomUUID } from "node:crypto";
import { getBillingSubscription } from "./billing-store.mjs";
import { ingestDodoUsageEvents } from "./billing-provider-dodo.mjs";

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
