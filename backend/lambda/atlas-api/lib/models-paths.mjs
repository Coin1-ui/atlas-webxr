/**
 * @param {string} workspaceId
 */
export function tenantModelsPrefix(workspaceId) {
  const root = process.env.ATLAS_TENANTS_PREFIX || "tenants";
  return `${root}/${workspaceId}/models/`;
}

export function legacyModelsPrefix() {
  return process.env.ATLAS_MODELS_PREFIX || "models/";
}

/**
 * Resolve S3 prefix for a workspace. Legacy workspace may use old prefix when ATLAS_LEGACY_USE_ROOT_PREFIX=true.
 * @param {string} workspaceId
 */
export function modelsPrefixForWorkspace(workspaceId) {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  if (workspaceId === legacyId && process.env.ATLAS_LEGACY_USE_ROOT_PREFIX === "true") {
    return legacyModelsPrefix();
  }
  return tenantModelsPrefix(workspaceId);
}

export function safeModelId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 48) || `model-${Date.now()}`;
}

export function extFromFilename(name, fallback = ".png") {
  const i = String(name).lastIndexOf(".");
  return i >= 0 ? String(name).slice(i) : fallback;
}

export function iconContentType(ext) {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "image/png";
}

export function assetContentType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "glb") return "model/gltf-binary";
  if (ext === "usdz") return "model/vnd.usdz+zip";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

export const EMPTY_MANIFEST = { version: 1, models: [] };
