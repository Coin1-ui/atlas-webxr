import { limitsForWorkspace, limitsForBillingTier } from "./plan-limits.mjs";
import { effectiveBillingTier } from "./trial.mjs";
import { readManifest } from "./models-store.mjs";
import { safeModelId } from "./models-paths.mjs";

/** Max single GLB/icon upload bytes per billing tier. */
const MAX_ASSET_BYTES = {
  starter: 50 * 1024 * 1024,
  launch: 100 * 1024 * 1024,
  growth: 200 * 1024 * 1024,
  scale: 500 * 1024 * 1024,
};

/**
 * @param {import("./tenant-types.mjs").WorkspaceRecord} workspace
 * @param {object} body presign body
 */
export async function assertModelUploadAllowed(workspace, body) {
  const limits = limitsForWorkspace(workspace);
  const manifest = await readManifest(workspace.id);
  const models = manifest.models ?? [];
  const id = safeModelId(body.id || body.name || "");
  const isNew = id && !models.some((m) => m.id === id);
  if (isNew && models.length >= limits.models) {
    const err = new Error(
      `Model limit reached (${models.length} / ${limits.models} on your plan). Upgrade on Account to add more models.`,
    );
    err.statusCode = 403;
    err.code = "MODEL_LIMIT_REACHED";
    throw err;
  }
}

/**
 * @param {import("./tenant-types.mjs").WorkspaceRecord} workspace
 */
export function maxAssetBytesForWorkspace(workspace) {
  const tier = effectiveBillingTier(workspace);
  return MAX_ASSET_BYTES[tier] ?? MAX_ASSET_BYTES.starter;
}
