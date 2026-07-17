import { requireAuthUser } from "./auth.mjs";
import { getMembership, getWorkspaceById, getWorkspaceBySlug } from "./dynamodb.mjs";
import { isTrialSuspended } from "./trial.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 * @param {import("./tenant-types.mjs").MemberRole[]} [roles]
 * @param {{ allowSuspended?: boolean }} [opts]
 */
export async function requireWorkspaceAccess(event, workspaceId, roles = ["owner", "admin", "viewer"], opts = {}) {
  const user = await requireAuthUser(event);
  const membership = await getMembership(user.sub, workspaceId);
  if (!membership || !roles.includes(membership.role)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }
  if (workspace.restricted) {
    const err = new Error("Workspace access restricted");
    err.statusCode = 403;
    throw err;
  }
  if (isTrialSuspended(workspace) && !opts.allowSuspended) {
    const err = new Error("Workspace suspended — subscribe to restore service");
    err.statusCode = 403;
    throw err;
  }
  return { user, membership, workspace };
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 * @param {{ allowSuspended?: boolean }} [opts]
 */
export async function requireWorkspaceAdmin(event, workspaceId, opts = {}) {
  return requireWorkspaceAccess(event, workspaceId, ["owner", "admin"], opts);
}

/**
 * @param {string} slug
 */
export async function resolveWorkspaceBySlug(slug) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }
  return workspace;
}
