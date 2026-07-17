import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { requireAuthUser } from "../lib/auth.mjs";
import { createWorkspace, listWorkspacesForUser, syncMemberEmailsForUser } from "../lib/dynamodb.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleListMyWorkspaces(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    const user = await requireAuthUser(event);
    await syncMemberEmailsForUser(user.sub, user.email);
    const workspaces = await listWorkspacesForUser(user.sub);
    return jsonResponse(200, { workspaces });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleCreateWorkspace(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();

  try {
    const user = await requireAuthUser(event);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const name = typeof body.name === "string" ? body.name : "";
    const slug = typeof body.slug === "string" ? body.slug : undefined;
    if (!name.trim()) {
      return jsonResponse(400, { error: "Workspace name is required" });
    }
    const workspace = await createWorkspace(user.sub, name, slug, {
      trialPlan: body.trialPlan === "launch" ? "launch" : "growth",
      ownerEmail: user.email,
    });
    return jsonResponse(201, { workspace });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
