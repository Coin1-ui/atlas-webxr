import { limitsForWorkspace } from "./plan-limits.mjs";
import { readManifest, sumWorkspaceStorageBytes } from "./models-store.mjs";
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
 * @param {unknown} value
 */
function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/**
 * Incoming upload size from client (presign) or 0 when unknown.
 * @param {object} body
 */
export function incomingUploadBytes(body) {
  return (
    nonNegInt(body.glbBytes) +
    nonNegInt(body.iconBytes) +
    nonNegInt(body.usdzBytes)
  );
}

/**
 * Pure storage gate used by assertModelUploadAllowed (BILL-2).
 * @param {{ isNew: boolean; currentBytes: number; incomingBytes: number; limitBytes: number }} input
 */
export function isStorageUploadBlocked(input) {
  const limitBytes = Number(input.limitBytes) || 0;
  if (limitBytes <= 0) return false;
  const currentBytes = Math.max(0, Number(input.currentBytes) || 0);
  const incomingBytes = Math.max(0, Number(input.incomingBytes) || 0);
  if (input.isNew) {
    return incomingBytes > 0
      ? currentBytes + incomingBytes > limitBytes
      : currentBytes >= limitBytes;
  }
  return currentBytes >= limitBytes && incomingBytes > 0;
}

/**
 * @param {import("./tenant-types.mjs").WorkspaceRecord} workspace
 * @param {object} body presign / complete body
 */
export async function assertModelUploadAllowed(workspace, body) {
  const limits = limitsForWorkspace(workspace);
  const manifest = await readManifest(workspace.id);
  const models = manifest.models ?? [];
  const id = safeModelId(body.id || body.name || "");
  const isNew = Boolean(id && !models.some((m) => m.id === id));

  if (isNew && models.length >= limits.models) {
    const err = new Error(
      `Model limit reached (${models.length} / ${limits.models} on your plan). Upgrade on Account to add more models.`,
    );
    err.statusCode = 403;
    err.code = "MODEL_LIMIT_REACHED";
    throw err;
  }

  if (limits.storageBytes > 0) {
    const current = await sumWorkspaceStorageBytes(workspace.id);
    const incoming = incomingUploadBytes(body);
    if (
      isStorageUploadBlocked({
        isNew,
        currentBytes: current,
        incomingBytes: incoming,
        limitBytes: limits.storageBytes,
      })
    ) {
      const err = new Error(
        `Storage limit reached on your plan. Free space or upgrade on Account to upload more.`,
      );
      err.statusCode = 403;
      err.code = "STORAGE_LIMIT_REACHED";
      throw err;
    }
  }
}
