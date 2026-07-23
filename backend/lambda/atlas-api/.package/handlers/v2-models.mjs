import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import {
  completeUpload,
  deleteModel,
  getAssetBytes,
  presignUpload,
  readManifest,
  sumWorkspaceStorageBytes,
  updateModelSettings,
} from "../lib/models-store.mjs";
import { requireWorkspaceAdmin, resolveWorkspaceBySlug } from "../lib/authz.mjs";
import { incrementModelCount } from "../lib/usage.mjs";
import { ingestDodoModelCount, ingestDodoStorageBytes } from "../lib/dodo-usage-ingest.mjs";
import { isTrialSuspended } from "../lib/trial.mjs";
import { assertModelUploadAllowed, maxAssetBytesForWorkspace } from "../lib/upload-limits.mjs";

function publicWorkspaceBlocked(workspace) {
  if (workspace.restricted) {
    return jsonResponse(403, { error: "Showroom unavailable", restricted: true });
  }
  if (isTrialSuspended(workspace)) {
    return jsonResponse(403, { error: "Showroom paused — subscription required", suspended: true });
  }
  return null;
}

/**
 * Public catalog manifest by workspace slug (AR viewer).
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} slug
 */
export async function handlePublicCatalog(event, slug) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  const workspace = await resolveWorkspaceBySlug(slug);
  const blocked = publicWorkspaceBlocked(workspace);
  if (blocked) return blocked;
  const manifest = await readManifest(workspace.id);
  return jsonResponse(200, manifest);
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} slug
 * @param {string} filename
 */
export async function handlePublicAsset(event, slug, filename) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  const workspace = await resolveWorkspaceBySlug(slug);
  const blocked = publicWorkspaceBlocked(workspace);
  if (blocked) return blocked;
  try {
    const { bytes, contentType } = await getAssetBytes(workspace.id, filename);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": process.env.ATLAS_CORS_ORIGIN || "*",
        "Cache-Control": "public, max-age=3600",
      },
      body: Buffer.from(bytes).toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return jsonResponse(404, { error: "Asset not found" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleAdminManifest(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requireWorkspaceAdmin(event, workspaceId);
    const manifest = await readManifest(workspaceId);
    return jsonResponse(200, manifest);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleModelUpload(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    const { workspace } = await requireWorkspaceAdmin(event, workspaceId);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const maxAssetBytes = maxAssetBytesForWorkspace(workspace);
    if (body.action === "presign") {
      await assertModelUploadAllowed(workspace, body);
      const payload = await presignUpload(workspaceId, body, maxAssetBytes);
      return jsonResponse(200, payload);
    }
    if (body.action === "complete") {
      const before = await readManifest(workspaceId);
      const beforeCount = before.models?.length ?? 0;
      await assertModelUploadAllowed(workspace, body);
      const result = await completeUpload(workspaceId, body, maxAssetBytes);
      const afterCount = result.modelCount ?? beforeCount;
      if (afterCount > beforeCount) {
        await incrementModelCount(workspaceId);
      }
      // Best-effort Dodo gauges for hybrid usage products (never block upload).
      void ingestDodoModelCount(workspaceId, afterCount);
      void sumWorkspaceStorageBytes(workspaceId)
        .then((bytes) => ingestDodoStorageBytes(workspaceId, bytes))
        .catch(() => {});
      return jsonResponse(200, result);
    }
    return jsonResponse(400, {
      error: 'Use action "presign" or "complete"',
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 * @param {string} modelId
 */
export async function handleModelPatch(event, workspaceId, modelId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requireWorkspaceAdmin(event, workspaceId);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const result = await updateModelSettings(workspaceId, modelId, {
      arExitUrl:
        body.arExitUrl === null || typeof body.arExitUrl === "string" ? body.arExitUrl : undefined,
    });
    return jsonResponse(200, result);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 * @param {string} modelId
 */
export async function handleModelDelete(event, workspaceId, modelId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requireWorkspaceAdmin(event, workspaceId);
    const result = await deleteModel(workspaceId, modelId);
    return jsonResponse(200, result);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
