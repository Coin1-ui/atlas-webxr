/** @typedef {'starter' | 'pro' | 'enterprise'} WorkspacePlan */
/** @typedef {'owner' | 'admin' | 'viewer'} MemberRole */

/**
 * @typedef {object} WorkspaceBranding
 * @property {string} [logoUrl]
 * @property {string} [primaryColor]
 */

/**
 * @typedef {object} Workspace
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {WorkspacePlan} plan
 * @property {WorkspaceBranding} branding
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} WorkspaceMember
 * @property {string} userSub
 * @property {string} workspaceId
 * @property {MemberRole} role
 * @property {string} createdAt
 */

/**
 * @typedef {object} PublicWorkspaceConfig
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {WorkspacePlan} plan
 * @property {WorkspaceBranding} branding
 */

export const WORKSPACE_PLANS = /** @type {const} */ (["starter", "pro", "enterprise"]);
export const MEMBER_ROLES = /** @type {const} */ (["owner", "admin", "viewer"]);

/** @param {string} slug */
export function normalizeSlug(slug) {
  return slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** @param {string} slug */
export function isValidSlug(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(slug);
}

/** @param {string} name @param {string} slug */
export function slugFromName(name, slug) {
  const base = normalizeSlug(slug || name);
  return base.slice(0, 32) || `ws-${Date.now().toString(36)}`;
}
