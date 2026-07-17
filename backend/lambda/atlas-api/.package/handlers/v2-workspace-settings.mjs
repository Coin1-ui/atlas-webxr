import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { cacheWorkspaceLogoFromUrl } from "../lib/branding-store.mjs";
import { updateWorkspaceSettings } from "../lib/dynamodb.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleUpdateWorkspaceSettings(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    await requireWorkspaceAdmin(event, workspaceId);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }

    const workspace = await updateWorkspaceSettings(workspaceId, {
      name: typeof body.name === "string" ? body.name : undefined,
      logoUrl: body.logoUrl === null || typeof body.logoUrl === "string" ? body.logoUrl : undefined,
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
      arExitUrl: body.arExitUrl === null || typeof body.arExitUrl === "string" ? body.arExitUrl : undefined,
    });

    if (typeof body.logoUrl === "string" && body.logoUrl.trim().startsWith("http")) {
      try {
        await cacheWorkspaceLogoFromUrl(workspaceId, body.logoUrl.trim());
      } catch (e) {
        console.warn("cacheWorkspaceLogoFromUrl", e);
      }
    }

    return jsonResponse(200, { workspace });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
