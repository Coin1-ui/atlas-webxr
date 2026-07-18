import { limitsForWorkspace } from "./plan-limits.mjs";
import { readManifest } from "./models-store.mjs";
import { safeModelId } from "./models-paths.mjs";

/** Max single GLB / USDZ / icon upload — same for every billing tier. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

/**
 * @param {import("./tenant-types.mjs").WorkspaceRecord} workspace
 */
export function maxAssetBytesForWorkspace(_workspace) {
  return MAX_ASSET_BYTES;
}

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
