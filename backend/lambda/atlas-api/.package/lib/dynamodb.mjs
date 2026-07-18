import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { isValidSlug, slugFromName } from "./tenant-types.mjs";
import { deleteWorkspaceStorage } from "./models-store.mjs";
import { adminDeleteCognitoUser, adminGetUserEmail } from "./cognito-admin.mjs";
import { emailFromDevSub, isPlatformOwnerUser } from "./platform-owner.mjs";
import { trialEndsAtIso, effectiveBillingTier } from "./trial.mjs";
import { couponIsActive, publicPromoFromCoupon } from "./coupon.mjs";
import { sessionLogDownloadDefaultForTier } from "./workspace-feature-defaults.mjs";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function workspacesTable() {
  return process.env.ATLAS_WORKSPACES_TABLE || "atlas-workspaces";
}

function membersTable() {
  return process.env.ATLAS_MEMBERS_TABLE || "atlas-members";
}

/**
 * @param {string} slug
 * @returns {Promise<import("./tenant-types.mjs").Workspace | null>}
 */
export async function getWorkspaceBySlug(slug) {
  const slugKey = slug.trim().toLowerCase();
  const slugRow = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: `SLUG#${slugKey}`, sk: "WORKSPACE" },
    })
  );
  const workspaceId = slugRow.Item?.workspaceId;
  if (!workspaceId) return null;
  return getWorkspaceById(String(workspaceId));
}

/**
 * @param {string} workspaceId
 * @returns {Promise<import("./tenant-types.mjs").Workspace | null>}
 */
export async function getWorkspaceById(workspaceId) {
  const row = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
    })
  );
  if (!row.Item) return null;
  return workspaceFromItem(row.Item);
}

/** @param {Record<string, unknown>} item */
function currentBillingEntitlementTier(item) {
  const tier = item.billingEntitlementTier ? String(item.billingEntitlementTier) : null;
  if (!tier) return null;
  const status = String(item.billingStatus || "");
  const endValue = status === "past_due" ? item.billingGraceUntil : item.billingCurrentPeriodEnd;
  const end = endValue ? Date.parse(String(endValue)) : Number.NaN;
  if (!["active", "past_due", "canceled"].includes(status) || Number.isNaN(end) || Date.now() >= end) {
    return null;
  }
  return tier;
}

/** @param {Record<string, unknown>} item */
function workspaceTierContext(item) {
  return {
    plan: item.plan || "starter",
    billingTier: item.billingTier,
    trialEndsAt: item.trialEndsAt,
    trialPlan: item.trialPlan,
    purchasedBillingTier: item.purchasedBillingTier,
    billingEntitlementTier: currentBillingEntitlementTier(item),
    manualBillingTier: item.manualBillingTier,
    billingProvider: item.billingProvider,
  };
}

/** @param {Record<string, unknown>} item */
function workspaceFeatureSessionLog(item) {
  if (item.featuresSessionLogDownloadExplicit === true) {
    return item.featuresSessionLogDownload === true;
  }
  return sessionLogDownloadDefaultForTier(effectiveBillingTier(workspaceTierContext(item)));
}

/** @param {Record<string, unknown>} item */
function workspaceFeatureStartAr(item) {
  if (item.featuresStartAr !== undefined && item.featuresStartAr !== null) {
    return item.featuresStartAr !== false;
  }
  if (item.featuresArControls !== undefined && item.featuresArControls !== null) {
    return item.featuresArControls !== false;
  }
  return true;
}

/** @param {Record<string, unknown>} item */
function workspaceFeatureCameraCheck(item) {
  if (item.featuresCameraCheck !== undefined && item.featuresCameraCheck !== null) {
    return item.featuresCameraCheck === true;
  }
  if (item.featuresArControls === false) return false;
  return false;
}

/** @param {Record<string, unknown>} item */
function workspaceFromItem(item) {
  const billingEntitlementTier = currentBillingEntitlementTier(item);
  return {
    id: String(item.id),
    slug: String(item.slug),
    name: String(item.name),
    plan: /** @type {import("./tenant-types.mjs").WorkspacePlan} */ (item.plan || "starter"),
    billingTier: item.billingTier ? /** @type {import("./plan-limits.mjs").BillingTierId} */ (String(item.billingTier)) : undefined,
    trialEndsAt: item.trialEndsAt ? String(item.trialEndsAt) : null,
    trialPlan: item.trialPlan ? /** @type {import("./plan-limits.mjs").BillingTierId} */ (String(item.trialPlan)) : null,
    purchasedBillingTier: item.purchasedBillingTier
      ? /** @type {import("./plan-limits.mjs").BillingTierId} */ (String(item.purchasedBillingTier))
      : null,
    billingEntitlementTier: billingEntitlementTier
      ? /** @type {import("./plan-limits.mjs").BillingTierId} */ (billingEntitlementTier)
      : null,
    manualBillingTier: item.manualBillingTier
      ? /** @type {import("./plan-limits.mjs").BillingTierId} */ (String(item.manualBillingTier))
      : null,
    billingProvider: item.billingProvider ? String(item.billingProvider) : null,
    billingStatus: item.billingStatus ? String(item.billingStatus) : null,
    billingSubscriptionId: item.billingSubscriptionId ? String(item.billingSubscriptionId) : null,
    billingCurrentPeriodEnd: item.billingCurrentPeriodEnd
      ? String(item.billingCurrentPeriodEnd)
      : null,
    billingGraceUntil: item.billingGraceUntil ? String(item.billingGraceUntil) : null,
    billingCancelAtPeriodEnd: item.billingCancelAtPeriodEnd === true,
    branding: {
      logoUrl: item.logoUrl ? String(item.logoUrl) : undefined,
      primaryColor: item.primaryColor ? String(item.primaryColor) : "#2dd4bf",
    },
    arExitUrl: item.arExitUrl ? String(item.arExitUrl) : null,
    restricted: Boolean(item.restricted),
    restrictionReason: item.restrictionReason ? String(item.restrictionReason) : undefined,
    ownerContactEmail: item.ownerContactEmail
      ? String(item.ownerContactEmail).trim().toLowerCase()
      : undefined,
    features: {
      sessionLogDownload: workspaceFeatureSessionLog(item),
      startAr: workspaceFeatureStartAr(item),
      cameraCheck: workspaceFeatureCameraCheck(item),
      sessionLogDownloadExplicit: item.featuresSessionLogDownloadExplicit === true,
    },
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
}

/**
 * @param {string} ownerSub
 * @param {string} name
 * @param {string} [requestedSlug]
 */
export async function createWorkspace(ownerSub, name, requestedSlug, opts = {}) {
  const slug = slugFromName(name, requestedSlug || name);
  if (!isValidSlug(slug)) {
    const err = new Error("Invalid workspace slug. Use 3–32 lowercase letters, numbers, and hyphens.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await getWorkspaceBySlug(slug);
  if (existing) {
    const err = new Error("Workspace slug already taken");
    err.statusCode = 409;
    throw err;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const trimmedName = name.trim().slice(0, 80) || slug;
  const trialEndsAt = trialEndsAtIso(14);
  const trialPlan = opts.trialPlan === "launch" ? "launch" : "growth";
  const billingTier = trialPlan === "launch" ? "launch" : "starter";
  const ownerEmail =
    typeof opts.ownerEmail === "string" ? opts.ownerEmail.trim().toLowerCase() : undefined;

  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: workspacesTable(),
            Item: {
              pk: `WORKSPACE#${id}`,
              sk: "META",
              id,
              slug,
              name: trimmedName,
              plan: "starter",
              billingTier,
              trialPlan,
              trialEndsAt,
              logoUrl: null,
              primaryColor: "#2dd4bf",
              featuresStartAr: true,
              featuresCameraCheck: false,
              featuresArControls: true,
              ...(ownerEmail ? { ownerContactEmail: ownerEmail } : {}),
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: workspacesTable(),
            Item: { pk: `SLUG#${slug}`, sk: "WORKSPACE", workspaceId: id, slug },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: membersTable(),
            Item: {
              pk: `USER#${ownerSub}`,
              sk: `WORKSPACE#${id}`,
              userSub: ownerSub,
              workspaceId: id,
              role: "owner",
              ...(ownerEmail ? { email: ownerEmail } : {}),
              createdAt: now,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    })
  );

  return getWorkspaceById(id);
}

/**
 * Record a paid subscription tier (Stripe / upgrade flow).
 * @param {string} workspaceId
 * @param {import("./plan-limits.mjs").BillingTierId} billingTier
 */
export async function recordWorkspacePurchase(workspaceId, billingTier) {
  const allowed = ["starter", "launch", "growth", "scale"];
  if (!allowed.includes(billingTier)) {
    const err = new Error("Invalid billing tier");
    err.statusCode = 400;
    throw err;
  }
  const existing = await getWorkspaceById(workspaceId);
  if (!existing) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  let plan = "starter";
  if (billingTier === "growth") plan = "pro";
  else if (billingTier === "scale") plan = "enterprise";

  await client.send(
    new UpdateCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
      UpdateExpression:
        "SET billingTier = :billingTier, purchasedBillingTier = :purchasedBillingTier, #plan = :plan, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#plan": "plan" },
      ExpressionAttributeValues: {
        ":billingTier": billingTier,
        ":purchasedBillingTier": billingTier,
        ":plan": plan,
        ":updatedAt": now,
      },
    })
  );

  return getWorkspaceById(workspaceId);
}

/**
 * @param {string} userSub
 * @returns {Promise<import("./tenant-types.mjs").Workspace[]>}
 */
export async function listWorkspacesForUser(userSub) {
  const rows = await client.send(
    new QueryCommand({
      TableName: membersTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${userSub}` },
    })
  );
  const workspaces = [];
  for (const item of rows.Items ?? []) {
    const ws = await getWorkspaceById(String(item.workspaceId));
    if (ws) workspaces.push(ws);
  }
  return workspaces;
}

/**
 * @param {string} userSub
 * @param {string} workspaceId
 */
export async function getMembership(userSub, workspaceId) {
  const row = await client.send(
    new GetCommand({
      TableName: membersTable(),
      Key: { pk: `USER#${userSub}`, sk: `WORKSPACE#${workspaceId}` },
    })
  );
  if (!row.Item) return null;
  return {
    userSub: String(row.Item.userSub),
    workspaceId: String(row.Item.workspaceId),
    role: /** @type {import("./tenant-types.mjs").MemberRole} */ (row.Item.role),
    createdAt: String(row.Item.createdAt),
  };
}

/**
 * @param {import("./tenant-types.mjs").Workspace} workspace
 * @returns {import("./tenant-types.mjs").PublicWorkspaceConfig}
 */
export function toPublicConfig(workspace) {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    plan: workspace.plan,
    branding: workspace.branding,
    arExitUrl: workspace.arExitUrl ?? null,
    features: {
      sessionLogDownload: workspace.features?.sessionLogDownload === true,
      startAr: workspace.features?.startAr !== false,
      cameraCheck: workspace.features?.cameraCheck === true,
    },
  };
}

/**
 * @param {string} [ownerSub]
 */
export async function ensureLegacyWorkspace(ownerSub = "system") {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  const existing = await getWorkspaceById(legacyId);
  if (existing) return existing;

  const now = new Date().toISOString();
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: workspacesTable(),
            Item: {
              pk: `WORKSPACE#${legacyId}`,
              sk: "META",
              id: legacyId,
              slug: "legacy",
              name: "Legacy workspace",
              plan: "pro",
              logoUrl: null,
              primaryColor: "#2dd4bf",
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: workspacesTable(),
            Item: { pk: "SLUG#legacy", sk: "WORKSPACE", workspaceId: legacyId, slug: "legacy" },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: membersTable(),
            Item: {
              pk: `USER#${ownerSub}`,
              sk: `WORKSPACE#${legacyId}`,
              userSub: ownerSub,
              workspaceId: legacyId,
              role: "owner",
              createdAt: now,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    })
  );
  return getWorkspaceById(legacyId);
}

/**
 * Remove memberships and owned workspaces for account deletion (keeps legacy workspace).
 * @param {string} userSub
 */
export async function deleteUserAccount(userSub) {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  const email = emailFromDevSub(userSub) || (await adminGetUserEmail(userSub));
  if (isPlatformOwnerUser({ sub: userSub, email })) {
    const err = new Error("Platform operator accounts cannot be deleted");
    err.statusCode = 403;
    throw err;
  }

  const workspaces = await listWorkspacesForUser(userSub);

  for (const ws of workspaces) {
    if (ws.id === legacyId) {
      await client.send(
        new DeleteCommand({
          TableName: membersTable(),
          Key: { pk: `USER#${userSub}`, sk: `WORKSPACE#${legacyId}` },
        })
      );
      continue;
    }

    const membership = await getMembership(userSub, ws.id);
    if (membership?.role === "owner") {
      await deleteWorkspaceStorage(ws.id);
      await client.send(
        new DeleteCommand({
          TableName: workspacesTable(),
          Key: { pk: `WORKSPACE#${ws.id}`, sk: "META" },
        })
      );
      await client.send(
        new DeleteCommand({
          TableName: workspacesTable(),
          Key: { pk: `SLUG#${ws.slug}`, sk: "WORKSPACE" },
        })
      );
    }

    await client.send(
      new DeleteCommand({
        TableName: membersTable(),
        Key: { pk: `USER#${userSub}`, sk: `WORKSPACE#${ws.id}` },
      })
    );
  }
}

function normalizeHexColor(raw) {
  const value = String(raw || "").trim();
  if (!value) return "#2dd4bf";
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  const err = new Error("Primary color must be a hex value like #2dd4bf");
  err.statusCode = 400;
  throw err;
}

function normalizeLogoUrl(raw) {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    const err = new Error("Logo URL must be a valid http(s) URL");
    err.statusCode = 400;
    throw err;
  }
}

function normalizeArExitUrl(raw) {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    const err = new Error("Exit URL must be a path starting with / or a valid http(s) URL");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * @param {string} workspaceId
 * @param {{ name?: string; logoUrl?: string | null; primaryColor?: string; arExitUrl?: string | null }} input
 */
export async function updateWorkspaceSettings(workspaceId, input) {
  const existing = await getWorkspaceById(workspaceId);
  if (!existing) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const name =
    input.name !== undefined ? String(input.name).trim().slice(0, 80) || existing.name : existing.name;
  const logoUrl = input.logoUrl !== undefined ? normalizeLogoUrl(input.logoUrl) : existing.branding.logoUrl ?? null;
  const primaryColor =
    input.primaryColor !== undefined
      ? normalizeHexColor(input.primaryColor)
      : existing.branding.primaryColor || "#2dd4bf";
  const arExitUrl =
    input.arExitUrl !== undefined ? normalizeArExitUrl(input.arExitUrl) : existing.arExitUrl ?? null;

  await client.send(
    new UpdateCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
      UpdateExpression:
        "SET #name = :name, logoUrl = :logoUrl, primaryColor = :primaryColor, arExitUrl = :arExitUrl, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: {
        ":name": name,
        ":logoUrl": logoUrl,
        ":primaryColor": primaryColor,
        ":arExitUrl": arExitUrl,
        ":updatedAt": now,
      },
    })
  );

  return getWorkspaceById(workspaceId);
}

/**
 * List all customer workspaces (platform operator).
 * @returns {Promise<import("./tenant-types.mjs").Workspace[]>}
 */
export async function listAllWorkspaces() {
  /** @type {import("./tenant-types.mjs").Workspace[]} */
  const workspaces = [];
  let lastKey;
  do {
    const page = await client.send(
      new ScanCommand({
        TableName: workspacesTable(),
        FilterExpression: "sk = :meta AND begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":meta": "META", ":prefix": "WORKSPACE#" },
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of page.Items ?? []) {
      workspaces.push(workspaceFromItem(item));
    }
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  workspaces.sort((a, b) => a.name.localeCompare(b.name));
  return workspaces;
}

/**
 * @param {string} workspaceId
 * @param {{ plan?: string; billingTier?: string; restricted?: boolean; restrictionReason?: string; features?: { sessionLogDownload?: boolean; startAr?: boolean; cameraCheck?: boolean } }} patch
 */
export async function updatePlatformWorkspace(workspaceId, patch) {
  const existing = await getWorkspaceById(workspaceId);
  if (!existing) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const parts = ["updatedAt = :updatedAt"];
  /** @type {Record<string, unknown>} */
  const values = { ":updatedAt": now };

  if (patch.billingTier !== undefined) {
    parts.push("billingTier = :billingTier");
    values[":billingTier"] = patch.billingTier;
    parts.push("manualBillingTier = :manualBillingTier");
    values[":manualBillingTier"] = patch.billingTier;
    parts.push("purchasedBillingTier = :purchasedBillingTier");
    values[":purchasedBillingTier"] = null;
    const tier = String(patch.billingTier);
    parts.push("#plan = :plan");
    if (tier === "growth") values[":plan"] = "pro";
    else if (tier === "scale") values[":plan"] = "enterprise";
    else values[":plan"] = "starter";
    parts.push("trialEndsAt = :trialEndsAt");
    values[":trialEndsAt"] = null;
    parts.push("trialPlan = :trialPlan");
    values[":trialPlan"] = null;
  } else if (patch.plan !== undefined) {
    parts.push("#plan = :plan");
    values[":plan"] = patch.plan;
  }
  if (patch.restricted !== undefined) {
    parts.push("restricted = :restricted");
    values[":restricted"] = patch.restricted;
    parts.push("restrictionReason = :restrictionReason");
    values[":restrictionReason"] = patch.restricted ? patch.restrictionReason || "Policy violation" : null;
    parts.push("restrictedAt = :restrictedAt");
    values[":restrictedAt"] = patch.restricted ? now : null;
  }
  if (patch.features?.sessionLogDownload !== undefined) {
    parts.push("featuresSessionLogDownload = :featuresSessionLogDownload");
    values[":featuresSessionLogDownload"] = Boolean(patch.features.sessionLogDownload);
    parts.push("featuresSessionLogDownloadExplicit = :featuresSessionLogDownloadExplicit");
    values[":featuresSessionLogDownloadExplicit"] = true;
  }
  if (patch.features?.startAr !== undefined) {
    parts.push("featuresStartAr = :featuresStartAr");
    values[":featuresStartAr"] = Boolean(patch.features.startAr);
  }
  if (patch.features?.cameraCheck !== undefined) {
    parts.push("featuresCameraCheck = :featuresCameraCheck");
    values[":featuresCameraCheck"] = Boolean(patch.features.cameraCheck);
  }
  const clearLegacyArLock =
    patch.features?.startAr === true || patch.features?.cameraCheck === true;
  if (clearLegacyArLock) {
    parts.push("featuresArControls = :featuresArControls");
    values[":featuresArControls"] = true;
  }

  await client.send(
    new UpdateCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeNames:
        patch.plan !== undefined || patch.billingTier !== undefined ? { "#plan": "plan" } : undefined,
      ExpressionAttributeValues: values,
    })
  );

  return getWorkspaceById(workspaceId);
}

function couponKey(code) {
  return String(code).trim().toUpperCase();
}

/**
 * @typedef {Object} PlatformCouponRecord
 * @property {string} code
 * @property {string} label
 * @property {number} [discountPercent] - Percent off (optional when promoPriceMonthly is set).
 * @property {string} [targetTier]
 * @property {string} [expiresAt]
 * @property {boolean} showOnPricing - Drive the public pricing-page promo banner.
 * @property {string} [bannerText] - Marketing line shown on the pricing banner (falls back to label).
 * @property {number} [maxUses] - Expire after this many redemptions (omit = unlimited).
 * @property {number} [usesCount] - Times redeemed (default 0).
 * @property {number} [promoPriceMonthly] - Fixed promo price in USD/mo for targetTier (e.g. 59).
 * @property {number} [durationMonths] - Promo price duration in months (e.g. 12).
 * @property {string} createdAt
 */

/**
 * @param {Record<string, any>} item
 * @returns {PlatformCouponRecord}
 */
function couponFromItem(item) {
  const discountPercent =
    item.discountPercent != null && item.discountPercent !== "" ? Number(item.discountPercent) : undefined;
  const maxUses = item.maxUses != null && item.maxUses !== "" ? Number(item.maxUses) : undefined;
  const usesCount = item.usesCount != null && item.usesCount !== "" ? Number(item.usesCount) : 0;
  const promoPriceMonthly =
    item.promoPriceMonthly != null && item.promoPriceMonthly !== ""
      ? Number(item.promoPriceMonthly)
      : undefined;
  const durationMonths =
    item.durationMonths != null && item.durationMonths !== "" ? Number(item.durationMonths) : undefined;
  return {
    code: String(item.code),
    label: String(item.label),
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : undefined,
    targetTier: item.targetTier ? String(item.targetTier) : undefined,
    expiresAt: item.expiresAt ? String(item.expiresAt) : undefined,
    showOnPricing: item.showOnPricing === true,
    bannerText: item.bannerText ? String(item.bannerText) : undefined,
    maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : undefined,
    usesCount: Number.isFinite(usesCount) && usesCount >= 0 ? usesCount : 0,
    promoPriceMonthly:
      Number.isFinite(promoPriceMonthly) && promoPriceMonthly > 0 ? promoPriceMonthly : undefined,
    durationMonths: Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : undefined,
    createdAt: String(item.createdAt),
  };
}

/**
 * @returns {Promise<PlatformCouponRecord[]>}
 */
export async function listPlatformCoupons() {
  const rows = await client.send(
    new QueryCommand({
      TableName: workspacesTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "PLATFORM#COUPONS" },
    })
  );
  return (rows.Items ?? [])
    .map(couponFromItem)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * @param {string} code
 * @returns {Promise<PlatformCouponRecord | null>}
 */
export async function getPlatformCouponByCode(code) {
  const row = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: "PLATFORM#COUPONS", sk: `CODE#${couponKey(code)}` },
    })
  );
  return row.Item ? couponFromItem(row.Item) : null;
}

/**
 * Active public promo = most recent, active coupon flagged showOnPricing.
 * @returns {Promise<ReturnType<import("./coupon.mjs").publicPromoFromCoupon> | null>}
 */
export async function getActivePromo() {
  const coupons = await listPlatformCoupons();
  const promo = coupons.find((c) => c.showOnPricing && couponIsActive(c));
  if (!promo) return null;
  return publicPromoFromCoupon(promo);
}

/**
 * Atomically increment redemption count. Fails when sold out or missing.
 * @param {string} code
 * @returns {Promise<PlatformCouponRecord>}
 */
export async function incrementPlatformCouponUse(code) {
  const normalized = couponKey(code);
  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: workspacesTable(),
        Key: { pk: "PLATFORM#COUPONS", sk: `CODE#${normalized}` },
        UpdateExpression: "SET usesCount = if_not_exists(usesCount, :zero) + :one",
        ConditionExpression:
          "attribute_exists(pk) AND (attribute_not_exists(maxUses) OR if_not_exists(usesCount, :zero) < maxUses)",
        ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
        ReturnValues: "ALL_NEW",
      })
    );
    return couponFromItem(result.Attributes);
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") {
      throw Object.assign(new Error("Coupon sold out or not found"), { statusCode: 409 });
    }
    throw e;
  }
}

/**
 * @param {{
 *   offerType?: "fixed" | "percent";
 *   code: string;
 *   label: string;
 *   discountPercent?: number;
 *   targetTier?: string;
 *   expiresAt?: string;
 *   showOnPricing?: boolean;
 *   bannerText?: string;
 *   maxUses?: number;
 *   promoPriceMonthly?: number;
 *   durationMonths?: number;
 * }} input
 */
export async function savePlatformCoupon(input) {
  const code = couponKey(input.code);
  const now = new Date().toISOString();
  const existing = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: "PLATFORM#COUPONS", sk: `CODE#${code}` },
    })
  );
  const isFixed = input.offerType === "fixed";
  const isPercent = input.offerType === "percent";
  const item = {
    pk: "PLATFORM#COUPONS",
    sk: `CODE#${code}`,
    code,
    label: input.label.trim().slice(0, 120),
    offerType: isFixed ? "fixed" : isPercent ? "percent" : null,
    discountPercent: isPercent && input.discountPercent != null ? input.discountPercent : null,
    targetTier: input.targetTier || null,
    expiresAt: isPercent && input.expiresAt ? input.expiresAt : null,
    showOnPricing: input.showOnPricing === true,
    bannerText: input.bannerText ? input.bannerText.trim().slice(0, 160) : null,
    maxUses: input.maxUses != null && input.maxUses > 0 ? input.maxUses : null,
    usesCount: existing.Item?.usesCount != null ? Number(existing.Item.usesCount) : 0,
    promoPriceMonthly:
      isFixed && input.promoPriceMonthly != null && input.promoPriceMonthly > 0
        ? input.promoPriceMonthly
        : null,
    durationMonths:
      isFixed && input.durationMonths != null && input.durationMonths > 0 ? input.durationMonths : null,
    createdAt: existing.Item?.createdAt ? String(existing.Item.createdAt) : now,
  };
  await client.send(
    new PutCommand({
      TableName: workspacesTable(),
      Item: item,
    })
  );
  return couponFromItem(item);
}

/** @param {string} code */
export async function deletePlatformCoupon(code) {
  await client.send(
    new DeleteCommand({
      TableName: workspacesTable(),
      Key: { pk: "PLATFORM#COUPONS", sk: `CODE#${couponKey(code)}` },
    })
  );
}

const PLATFORM_SETTINGS_PK = "PLATFORM#SETTINGS";
const PLATFORM_SETTINGS_SK = "SETTINGS";

/**
 * @returns {Promise<{ salesDeckActive: boolean; mkt3StoryboardActive: boolean; demoWorkspaceSlug?: string; updatedAt?: string }>}
 */
export async function getPlatformSettings() {
  const row = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: PLATFORM_SETTINGS_PK, sk: PLATFORM_SETTINGS_SK },
    })
  );
  if (!row.Item) {
    return { salesDeckActive: true, mkt3StoryboardActive: true };
  }
  const demoWorkspaceSlug =
    typeof row.Item.demoWorkspaceSlug === "string" && row.Item.demoWorkspaceSlug.trim()
      ? String(row.Item.demoWorkspaceSlug).trim().toLowerCase()
      : undefined;
  return {
    salesDeckActive: row.Item.salesDeckActive !== false,
    mkt3StoryboardActive: row.Item.mkt3StoryboardActive !== false,
    demoWorkspaceSlug,
    updatedAt: row.Item.updatedAt ? String(row.Item.updatedAt) : undefined,
  };
}

/**
 * @param {{ salesDeckActive?: boolean; mkt3StoryboardActive?: boolean; demoWorkspaceSlug?: string | null }} input
 * @returns {Promise<{ salesDeckActive: boolean; mkt3StoryboardActive: boolean; demoWorkspaceSlug?: string; updatedAt: string }>}
 */
export async function updatePlatformSettings(input) {
  const now = new Date().toISOString();
  const existing = await getPlatformSettings();
  const salesDeckActive =
    input.salesDeckActive !== undefined ? input.salesDeckActive !== false : existing.salesDeckActive;
  const mkt3StoryboardActive =
    input.mkt3StoryboardActive !== undefined
      ? input.mkt3StoryboardActive !== false
      : existing.mkt3StoryboardActive;
  let demoWorkspaceSlug = existing.demoWorkspaceSlug;
  if (input.demoWorkspaceSlug !== undefined) {
    demoWorkspaceSlug =
      typeof input.demoWorkspaceSlug === "string" && input.demoWorkspaceSlug.trim()
        ? input.demoWorkspaceSlug.trim().toLowerCase()
        : undefined;
  }
  /** @type {Record<string, unknown>} */
  const item = {
    pk: PLATFORM_SETTINGS_PK,
    sk: PLATFORM_SETTINGS_SK,
    salesDeckActive,
    mkt3StoryboardActive,
    updatedAt: now,
  };
  if (demoWorkspaceSlug) item.demoWorkspaceSlug = demoWorkspaceSlug;
  await client.send(
    new PutCommand({
      TableName: workspacesTable(),
      Item: item,
    })
  );
  return { salesDeckActive, mkt3StoryboardActive, demoWorkspaceSlug, updatedAt: now };
}

/** @type {{ slug: string | null; at: number }} */
let demoWorkspaceSlugCache = { slug: null, at: 0 };
const DEMO_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

/** @returns {string} */
function legacyWorkspaceId() {
  return process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
}

/**
 * Workspace slug backing anonymous Try live demo (/demo).
 * Explicit platform setting wins; otherwise the real platform operator workspace (not legacy).
 * @returns {Promise<string | null>}
 */
export async function resolvePlatformDemoWorkspaceSlug() {
  const now = Date.now();
  if (demoWorkspaceSlugCache.slug !== null && now - demoWorkspaceSlugCache.at < DEMO_SLUG_CACHE_TTL_MS) {
    return demoWorkspaceSlugCache.slug;
  }

  const settings = await getPlatformSettings();
  if (settings.demoWorkspaceSlug && settings.demoWorkspaceSlug !== legacyWorkspaceId()) {
    demoWorkspaceSlugCache = { slug: settings.demoWorkspaceSlug, at: now };
    return settings.demoWorkspaceSlug;
  }

  const legacyId = legacyWorkspaceId();
  const workspaces = await listAllWorkspacesForPlatform();
  const operator =
    workspaces.find((w) => w.protectedFromDeletion && w.id !== legacyId) ??
    workspaces.find((w) => w.protectedFromDeletion && w.slug !== legacyId);
  const slug = operator?.slug ? String(operator.slug).toLowerCase() : null;
  demoWorkspaceSlugCache = { slug, at: now };
  return slug;
}

/**
 * @param {string} workspaceId
 */
export async function listMembersForWorkspace(workspaceId) {
  /** @type {{ userSub: string; role: string }[]} */
  const members = [];
  let lastKey;
  do {
    const page = await client.send(
      new ScanCommand({
        TableName: membersTable(),
        FilterExpression: "sk = :sk",
        ExpressionAttributeValues: { ":sk": `WORKSPACE#${workspaceId}` },
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of page.Items ?? []) {
      members.push({
        userSub: String(item.userSub ?? item.pk?.replace(/^USER#/, "") ?? ""),
        role: String(item.role ?? "member"),
        email: item.email ? String(item.email).trim().toLowerCase() : undefined,
      });
    }
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  return members;
}

/**
 * @param {{ userSub: string; role: string }[]} members
 */
function pickOwnerMembers(members) {
  const owners = members.filter((m) => m.role === "owner");
  if (owners.length) return owners;
  const admins = members.filter((m) => m.role === "admin");
  if (admins.length) return admins;
  return members;
}

/**
 * @param {string} userSub
 * @param {string} workspaceId
 * @param {string} email
 */
async function persistMemberEmail(userSub, workspaceId, email) {
  const normalized = email?.trim().toLowerCase();
  if (!userSub || !workspaceId || !normalized?.includes("@")) return;
  try {
    await client.send(
      new UpdateCommand({
        TableName: membersTable(),
        Key: { pk: `USER#${userSub}`, sk: `WORKSPACE#${workspaceId}` },
        UpdateExpression: "SET email = :email",
        ExpressionAttributeValues: { ":email": normalized },
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
  } catch {
    /* membership row may be missing */
  }
}

/**
 * @param {string} workspaceId
 * @param {string} email
 */
async function persistWorkspaceOwnerContactEmail(workspaceId, email) {
  const normalized = email?.trim().toLowerCase();
  if (!workspaceId || !normalized?.includes("@")) return;
  const now = new Date().toISOString();
  try {
    await client.send(
      new UpdateCommand({
        TableName: workspacesTable(),
        Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
        UpdateExpression: "SET ownerContactEmail = :email, updatedAt = :now",
        ExpressionAttributeValues: { ":email": normalized, ":now": now },
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
  } catch {
    /* workspace may be missing */
  }
}

/**
 * Persist signup/login email on all memberships for this user (backfill for owner dashboard).
 * @param {string} userSub
 * @param {string | undefined} email
 */
export async function syncMemberEmailsForUser(userSub, email) {
  const normalized = email?.trim().toLowerCase();
  if (!userSub || !normalized?.includes("@")) return;
  const workspaces = await listWorkspacesForUser(userSub);
  for (const ws of workspaces) {
    await persistMemberEmail(userSub, ws.id, normalized);
    await persistWorkspaceOwnerContactEmail(ws.id, normalized);
  }
}

/**
 * @param {string} userSub
 * @param {{ email?: string }} [member]
 * @param {string} [workspaceId]
 */
async function resolveMemberEmail(userSub, member, workspaceId) {
  if (member?.email) return member.email;
  const devEmail = emailFromDevSub(userSub);
  if (devEmail) return devEmail;
  const email = await adminGetUserEmail(userSub);
  if (email && workspaceId) {
    await persistMemberEmail(userSub, workspaceId, email);
    await persistWorkspaceOwnerContactEmail(workspaceId, email);
  }
  return email;
}

/**
 * @param {string} workspaceId
 */
export async function workspaceHasPlatformOwnerMember(workspaceId) {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  if (workspaceId === legacyId) return true;

  const members = await listMembersForWorkspace(workspaceId);
  const owners = members.filter((m) => m.role === "owner");
  for (const owner of owners) {
      const email = await resolveMemberEmail(owner.userSub, owner, workspaceId);
    if (isPlatformOwnerUser({ sub: owner.userSub, email })) return true;
  }
  return false;
}

/**
 * @returns {Promise<Array<import("./tenant-types.mjs").Workspace & { protectedFromDeletion: boolean; ownerEmails: string[] }>>}
 */
export async function listAllWorkspacesForPlatform() {
  const workspaces = await listAllWorkspaces();
  const enriched = [];
  for (const ws of workspaces) {
    const members = await listMembersForWorkspace(ws.id);
    /** @type {Set<string>} */
    const ownerEmails = new Set();
    if (ws.ownerContactEmail) ownerEmails.add(ws.ownerContactEmail);
    for (const member of pickOwnerMembers(members)) {
      const email = await resolveMemberEmail(member.userSub, member, ws.id);
      if (email) ownerEmails.add(email);
    }
    const protectedFromDeletion = await workspaceHasPlatformOwnerMember(ws.id);
    enriched.push({ ...ws, ownerEmails: [...ownerEmails], protectedFromDeletion });
  }
  return enriched;
}

/**
 * Delete a customer workspace and Cognito login when they have no other workspaces.
 * Platform operator workspaces are never deleted.
 * @param {string} workspaceId
 */
export async function deleteCustomerWorkspaceByPlatform(workspaceId) {
  const legacyId = process.env.ATLAS_LEGACY_WORKSPACE_ID || "legacy";
  if (workspaceId === legacyId) {
    const err = new Error("Legacy workspace cannot be deleted");
    err.statusCode = 403;
    throw err;
  }

  const existing = await getWorkspaceById(workspaceId);
  if (!existing) {
    const err = new Error("Workspace not found");
    err.statusCode = 404;
    throw err;
  }

  if (await workspaceHasPlatformOwnerMember(workspaceId)) {
    const err = new Error("Platform operator accounts cannot be deleted");
    err.statusCode = 403;
    throw err;
  }

  const members = await listMembersForWorkspace(workspaceId);
  const affectedSubs = [...new Set(members.map((m) => m.userSub).filter(Boolean))];

  await deleteWorkspaceStorage(workspaceId);

  await client.send(
    new DeleteCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
    })
  );
  await client.send(
    new DeleteCommand({
      TableName: workspacesTable(),
      Key: { pk: `SLUG#${existing.slug}`, sk: "WORKSPACE" },
    })
  );

  for (const member of members) {
    await client.send(
      new DeleteCommand({
        TableName: membersTable(),
        Key: { pk: `USER#${member.userSub}`, sk: `WORKSPACE#${workspaceId}` },
      })
    );
  }

  for (const userSub of affectedSubs) {
    const remaining = await listWorkspacesForUser(userSub);
    if (remaining.length === 0) {
      const email = await resolveMemberEmail(userSub);
      await adminDeleteCognitoUser({ sub: userSub, email });
    }
  }

  return { ok: true, workspaceId, deletedUserSubs: affectedSubs };
}
