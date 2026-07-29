import { jsonResponse, optionsResponse } from "./lib/http.mjs";
import { isSandboxDodoIngestEnabled, isSandboxUsageSeedEnabled, isClearTestOverageEnabled } from "./lib/sandbox-seed-flag.mjs";
import { handlePublicConfig } from "./handlers/v2-public-config.mjs";
import { handleCreateWorkspace, handleListMyWorkspaces } from "./handlers/v2-workspaces.mjs";
import { handleUpdateWorkspaceSettings } from "./handlers/v2-workspace-settings.mjs";
import { handleWorkspaceLogo } from "./handlers/v2-branding-logo.mjs";
import { handleBrandingLogoUpload } from "./handlers/v2-branding-logo-upload.mjs";
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
import { handleSandboxSeedUsage } from "./handlers/v2-sandbox-usage.mjs";
import { handleBillingStatus, handleBillingUpgrade } from "./handlers/v2-billing.mjs";
import {
  handleDodoWebhook,
  handleZohoPaymentsWebhook,
} from "./handlers/v2-billing-webhooks.mjs";
import { handleBillingCheckout } from "./handlers/v2-billing-checkout.mjs";
import {
  handleBillingCancel,
  handleBillingCancelScheduledPlan,
  handleBillingChangePlan,
  handleBillingPortal,
} from "./handlers/v2-billing-manage.mjs";
import { handlePlatformBillingRefund } from "./handlers/v2-billing-refunds.mjs";
import { handleBillingOverage } from "./handlers/v2-billing-overage.mjs";
import { handleBillingAccountingWorker } from "./handlers/billing-accounting-worker.mjs";
import { handleStuckPaymentSweeper } from "./handlers/billing-stuck-payment-worker.mjs";
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
  if (event?.source === "aws.events" && event?.["detail-type"] === "Scheduled Event") {
    const stuck = await handleStuckPaymentSweeper();
    const accounting = await handleBillingAccountingWorker();
    return { ok: true, stuckPayment: stuck, accounting };
  }
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

    const sandboxUsageMatch = /^\/v2\/workspaces\/([^/]+)\/sandbox\/usage$/.exec(rawPath);
    if (sandboxUsageMatch && method === "POST") {
      return await handleSandboxSeedUsage(event, decodeURIComponent(sandboxUsageMatch[1]));
    }

    const billingUpgradeMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/upgrade$/.exec(rawPath);
    if (billingUpgradeMatch && method === "POST") {
      return await handleBillingUpgrade(event, decodeURIComponent(billingUpgradeMatch[1]));
    }

    const billingCheckoutMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/checkout$/.exec(rawPath);
    if (billingCheckoutMatch && method === "POST") {
      return await handleBillingCheckout(event, decodeURIComponent(billingCheckoutMatch[1]));
    }

    const billingStatusMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/status$/.exec(rawPath);
    if (billingStatusMatch && method === "GET") {
      return await handleBillingStatus(event, decodeURIComponent(billingStatusMatch[1]));
    }

    const billingPortalMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/portal$/.exec(rawPath);
    if (billingPortalMatch && method === "POST") {
      return await handleBillingPortal(event, decodeURIComponent(billingPortalMatch[1]));
    }

    const billingCancelMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/cancel$/.exec(rawPath);
    if (billingCancelMatch && method === "POST") {
      return await handleBillingCancel(event, decodeURIComponent(billingCancelMatch[1]));
    }

    const billingPlanMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/plan$/.exec(rawPath);
    if (billingPlanMatch && method === "POST") {
      return await handleBillingChangePlan(event, decodeURIComponent(billingPlanMatch[1]));
    }

    const billingPlanScheduledCancelMatch =
      /^\/v2\/workspaces\/([^/]+)\/billing\/plan\/scheduled\/cancel$/.exec(rawPath);
    if (billingPlanScheduledCancelMatch && method === "POST") {
      return await handleBillingCancelScheduledPlan(
        event,
        decodeURIComponent(billingPlanScheduledCancelMatch[1]),
      );
    }

    const billingOverageMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/overage$/.exec(rawPath);
    if (billingOverageMatch && (method === "GET" || method === "POST")) {
      return await handleBillingOverage(event, decodeURIComponent(billingOverageMatch[1]));
    }

    if (rawPath === "/v2/billing/webhooks/dodo" && method === "POST") {
      return await handleDodoWebhook(event);
    }

    if (rawPath === "/v2/billing/webhooks/zoho-payments" && method === "POST") {
      return await handleZohoPaymentsWebhook(event);
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

    const brandingLogoUploadMatch = /^\/v2\/workspaces\/([^/]+)\/branding\/logo$/.exec(rawPath);
    if (brandingLogoUploadMatch && method === "POST") {
      return await handleBrandingLogoUpload(event, decodeURIComponent(brandingLogoUploadMatch[1]));
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

    if (rawPath === "/v2/platform/billing/refunds" && method === "POST") {
      return await handlePlatformBillingRefund(event);
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
      const raw = process.env.ATLAS_SANDBOX_USAGE_SEED ?? null;
      return jsonResponse(200, {
        ok: true,
        service: "atlas-api",
        version: 2,
        // Verify Console env without a Cognito token (not a secret).
        sandboxUsageSeed: isSandboxUsageSeedEnabled(raw ?? undefined),
        sandboxUsageSeedRaw: raw,
        sandboxDodoIngest: isSandboxDodoIngestEnabled(),
        clearTestOverage: isClearTestOverageEnabled(),
      });
    }

    return jsonResponse(404, { error: "Not found", path: rawPath });
  } catch (e) {
    console.error("atlas-api error", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
}
