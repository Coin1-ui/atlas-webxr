import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import {
  LOGO_UPLOAD_MARKER_URL,
  assertLogoUploadComplete,
  presignLogoUpload,
} from "../lib/branding-store.mjs";
import { updateWorkspaceSettings } from "../lib/dynamodb.mjs";

/**
 * Direct logo upload — presign PUT to tenant S3, then complete + set logo marker URL.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleBrandingLogoUpload(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    await requireWorkspaceAdmin(event, workspaceId);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }

    if (body.action === "presign") {
      const payload = await presignLogoUpload(workspaceId, {
        contentType: typeof body.contentType === "string" ? body.contentType : undefined,
        filename: typeof body.filename === "string" ? body.filename : undefined,
      });
      return jsonResponse(200, payload);
    }

    if (body.action === "complete") {
      const ext = typeof body.ext === "string" ? body.ext : ".png";
      await assertLogoUploadComplete(workspaceId, ext);
      const workspace = await updateWorkspaceSettings(workspaceId, {
        logoUrl: LOGO_UPLOAD_MARKER_URL,
      });
      return jsonResponse(200, { ok: true, workspace });
    }

    return jsonResponse(400, { error: 'Use action "presign" or "complete"' });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
