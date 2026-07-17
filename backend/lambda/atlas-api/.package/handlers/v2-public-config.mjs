import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { getWorkspaceBySlug, toPublicConfig } from "../lib/dynamodb.mjs";
import { isTrialSuspended } from "../lib/trial.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} slug
 */
export async function handlePublicConfig(event, slug) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return jsonResponse(404, { error: "Workspace not found" });
  }
  if (isTrialSuspended(workspace)) {
    return jsonResponse(403, { error: "Showroom paused — subscription required", suspended: true });
  }
  if (workspace.restricted) {
    return jsonResponse(403, { error: "Showroom unavailable", restricted: true });
  }
  return jsonResponse(200, toPublicConfig(workspace));
}
