/**
 * Current-month usage snapshot for overage gating (mirrors GET /usage).
 */
import { readManifest, sumWorkspaceStorageBytes } from "./models-store.mjs";
import { getMonthlyUsage } from "./usage.mjs";

/**
 * @param {string} workspaceId
 * @returns {Promise<{ month: string; modelCount: number; sessionCount: number; storageBytes: number }>}
 */
export async function loadWorkspaceUsageSnapshot(workspaceId) {
  const [monthly, manifest, storageBytes] = await Promise.all([
    getMonthlyUsage(workspaceId),
    readManifest(workspaceId),
    sumWorkspaceStorageBytes(workspaceId),
  ]);
  const sandboxSeeded = Boolean(monthly.sandboxSeededAt);
  const modelCount = sandboxSeeded
    ? monthly.modelCount
    : Array.isArray(manifest.models)
      ? manifest.models.length
      : monthly.modelCount;
  return {
    month: monthly.month,
    modelCount,
    sessionCount: monthly.sessionCount,
    storageBytes: sandboxSeeded ? monthly.storageBytes : storageBytes,
  };
}
