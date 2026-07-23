import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { getWorkspaceBySlug, toPublicConfig } from "../lib/dynamodb.mjs";
import { isServicePaused, servicePauseReason, servicePauseShowroomSub, servicePauseTitle } from "../lib/trial.mjs";

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
  if (isServicePaused(workspace)) {
    const pauseReason = servicePauseReason(workspace);
    return jsonResponse(403, {
      error: servicePauseShowroomSub(pauseReason),
      suspended: true,
      pauseReason,
      pauseTitle: servicePauseTitle(pauseReason),
    });
  }
  if (workspace.restricted) {
    return jsonResponse(403, { error: "Showroom unavailable", restricted: true });
  }
  return jsonResponse(200, toPublicConfig(workspace));
}
