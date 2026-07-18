import { jsonResponse, optionsResponse } from "../lib/http.mjs";
import { resolveWorkspaceBySlug } from "../lib/authz.mjs";
import {
  cacheWorkspaceLogoFromUrl,
  fetchRemoteLogoBytes,
  LOGO_UPLOAD_MARKER_URL,
  readWorkspaceLogoBytes,
} from "../lib/branding-store.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} slug
 */
export async function handleWorkspaceLogo(event, slug) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    const workspace = await resolveWorkspaceBySlug(slug);
    const sourceUrl = workspace.branding.logoUrl;
    if (!sourceUrl) {
      return jsonResponse(404, { error: "Logo not configured" });
    }

    let payload = await readWorkspaceLogoBytes(workspace.id);
    if (!payload && sourceUrl.startsWith("http") && sourceUrl !== LOGO_UPLOAD_MARKER_URL) {
      payload = await fetchRemoteLogoBytes(sourceUrl);
      if (payload) {
        try {
          await cacheWorkspaceLogoFromUrl(workspace.id, sourceUrl);
        } catch (e) {
          console.warn("logo cache failed", e);
        }
      }
    }

    if (!payload) {
      return jsonResponse(404, { error: "Logo not found" });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": payload.contentType,
        "Access-Control-Allow-Origin": process.env.ATLAS_CORS_ORIGIN || "*",
        "Cache-Control": "public, max-age=3600",
      },
      body: Buffer.from(payload.bytes).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
