import { jsonResponse, optionsResponse } from "./lib/http.mjs";
import { handlePublicConfig } from "./handlers/v2-public-config.mjs";
import { handleCreateWorkspace, handleListMyWorkspaces } from "./handlers/v2-workspaces.mjs";
import { handleUpdateWorkspaceSettings } from "./handlers/v2-workspace-settings.mjs";
import { handleWorkspaceLogo } from "./handlers/v2-branding-logo.mjs";
import { handleDeleteAccount } from "./handlers/v2-account.mjs";
import {
  handleAdminManifest,
  handleModelDelete,
  handleModelPatch,
  handleModelUpload,
  handlePublicAsset,
  handlePublicCatalog,
} from "./handlers/v2-models.mjs";
import { handleAnalyticsEvents } from "./handlers/v2-analytics.mjs";
import { handleWorkspaceUsage } from "./handlers/v2-usage.mjs";
import { handleBillingUpgrade } from "./handlers/v2-billing.mjs";
import {
  handleCreatePlatformCoupon,
  handleDeletePlatformCoupon,
  handleListPlatformCoupons,
  handleListPlatformWorkspaces,
  handlePatchPlatformWorkspace,
  handleDeletePlatformWorkspace,
  handleGetPlatformSettings,
  handlePatchPlatformSettings,
  handleGetPlatformPublicSettings,
} from "./handlers/v2-platform.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handler(event) {
  const method = event.requestContext?.http?.method ?? "GET";
  const rawPath = event.rawPath || event.requestContext?.http?.path || "/";

  if (method === "OPTIONS") return optionsResponse();

  try {
    const publicConfigMatch = /^\/v2\/workspaces\/([^/]+)\/public-config$/.exec(rawPath);
    if (publicConfigMatch) {
      return await handlePublicConfig(event, decodeURIComponent(publicConfigMatch[1]));
    }

    const publicCatalogMatch = /^\/v2\/workspaces\/([^/]+)\/catalog$/.exec(rawPath);
    if (publicCatalogMatch && method === "GET") {
      return await handlePublicCatalog(event, decodeURIComponent(publicCatalogMatch[1]));
    }

    const analyticsMatch = /^\/v2\/workspaces\/([^/]+)\/analytics\/events$/.exec(rawPath);
    if (analyticsMatch && method === "POST") {
      return await handleAnalyticsEvents(event, decodeURIComponent(analyticsMatch[1]));
    }

    const usageMatch = /^\/v2\/workspaces\/([^/]+)\/usage$/.exec(rawPath);
    if (usageMatch && method === "GET") {
      return await handleWorkspaceUsage(event, decodeURIComponent(usageMatch[1]));
    }

    const billingUpgradeMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/upgrade$/.exec(rawPath);
    if (billingUpgradeMatch && method === "POST") {
      return await handleBillingUpgrade(event, decodeURIComponent(billingUpgradeMatch[1]));
    }

    const logoMatch = /^\/v2\/workspaces\/([^/]+)\/logo$/.exec(rawPath);
    if (logoMatch && method === "GET") {
      return await handleWorkspaceLogo(event, decodeURIComponent(logoMatch[1]));
    }

    const publicAssetMatch = /^\/v2\/workspaces\/([^/]+)\/catalog\/assets\/(.+)$/.exec(rawPath);
    if (publicAssetMatch && method === "GET") {
      return await handlePublicAsset(
        event,
        decodeURIComponent(publicAssetMatch[1]),
        decodeURIComponent(publicAssetMatch[2])
      );
    }

    const adminManifestMatch = /^\/v2\/workspaces\/([^/]+)\/models\/manifest$/.exec(rawPath);
    if (adminManifestMatch && method === "GET") {
      return await handleAdminManifest(event, decodeURIComponent(adminManifestMatch[1]));
    }

    const uploadMatch = /^\/v2\/workspaces\/([^/]+)\/models\/upload$/.exec(rawPath);
    if (uploadMatch && method === "POST") {
      return await handleModelUpload(event, decodeURIComponent(uploadMatch[1]));
    }

    const settingsMatch = /^\/v2\/workspaces\/([^/]+)\/settings$/.exec(rawPath);
    if (settingsMatch && method === "PATCH") {
      return await handleUpdateWorkspaceSettings(event, decodeURIComponent(settingsMatch[1]));
    }

    const deleteMatch = /^\/v2\/workspaces\/([^/]+)\/models\/([^/]+)$/.exec(rawPath);
    if (deleteMatch && method === "DELETE") {
      return await handleModelDelete(
        event,
        decodeURIComponent(deleteMatch[1]),
        decodeURIComponent(deleteMatch[2])
      );
    }

    const patchModelMatch = /^\/v2\/workspaces\/([^/]+)\/models\/([^/]+)$/.exec(rawPath);
    if (patchModelMatch && method === "PATCH") {
      return await handleModelPatch(
        event,
        decodeURIComponent(patchModelMatch[1]),
        decodeURIComponent(patchModelMatch[2])
      );
    }

    if (rawPath === "/v2/me/workspaces" && method === "GET") {
      return await handleListMyWorkspaces(event);
    }

    if (rawPath === "/v2/me/account" && method === "DELETE") {
      return await handleDeleteAccount(event);
    }

    if (rawPath === "/v2/workspaces" && method === "POST") {
      return await handleCreateWorkspace(event);
    }

    if (rawPath === "/v2/platform/workspaces" && method === "GET") {
      return await handleListPlatformWorkspaces(event);
    }

    if (rawPath === "/v2/platform/coupons" && method === "GET") {
      return await handleListPlatformCoupons(event);
    }

    if (rawPath === "/v2/platform/coupons" && method === "POST") {
      return await handleCreatePlatformCoupon(event);
    }

    const platformCouponDelete = /^\/v2\/platform\/coupons\/([^/]+)$/.exec(rawPath);
    if (platformCouponDelete && method === "DELETE") {
      return await handleDeletePlatformCoupon(event, decodeURIComponent(platformCouponDelete[1]));
    }

    const platformPatch = /^\/v2\/platform\/workspaces\/([^/]+)$/.exec(rawPath);
    if (platformPatch && method === "PATCH") {
      return await handlePatchPlatformWorkspace(event, decodeURIComponent(platformPatch[1]));
    }

    if (platformPatch && method === "DELETE") {
      return await handleDeletePlatformWorkspace(event, decodeURIComponent(platformPatch[1]));
    }

    if (rawPath === "/v2/platform/settings" && method === "GET") {
      return await handleGetPlatformSettings(event);
    }

    if (rawPath === "/v2/platform/settings" && method === "PATCH") {
      return await handlePatchPlatformSettings(event);
    }

    if (rawPath === "/v2/platform/public-settings" && method === "GET") {
      return await handleGetPlatformPublicSettings(event);
    }

    if (rawPath === "/health" && method === "GET") {
      return jsonResponse(200, { ok: true, service: "atlas-api", version: 2 });
    }

    return jsonResponse(404, { error: "Not found", path: rawPath });
  } catch (e) {
    console.error("atlas-api error", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
}
