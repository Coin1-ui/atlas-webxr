import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { requirePlatformOwner } from "../lib/platform-authz.mjs";
import { isCognitoEmailLookupConfigured } from "../lib/cognito-admin.mjs";
import {
  deletePlatformCoupon,
  deleteCustomerWorkspaceByPlatform,
  getActivePromo,
  getPlatformSettings,
  getWorkspaceBySlug,
  listAllWorkspacesForPlatform,
  listPlatformCoupons,
  resolvePlatformDemoWorkspaceSlug,
  savePlatformCoupon,
  updatePlatformSettings,
  updatePlatformWorkspace,
} from "../lib/dynamodb.mjs";
import { syncAllPlatformCouponsFromDodo } from "../lib/coupon-dodo-sync.mjs";
import { WORKSPACE_PLANS } from "../lib/tenant-types.mjs";

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleListPlatformWorkspaces(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const workspaces = await listAllWorkspacesForPlatform();
    return jsonResponse(200, {
      workspaces,
      meta: {
        ownerEmailLookup: isCognitoEmailLookupConfigured() ? "cognito" : "disabled",
      },
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handlePatchPlatformWorkspace(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const patch = {};
    if (typeof body.billingTier === "string") {
      const tier = body.billingTier.trim().toLowerCase();
      const allowed = ["starter", "launch", "growth", "scale"];
      if (!allowed.includes(tier)) {
        return jsonResponse(400, { error: "Invalid billingTier" });
      }
      patch.billingTier = tier;
    }
    if (typeof body.plan === "string" && !patch.billingTier) {
      const plan = body.plan.trim().toLowerCase();
      if (!WORKSPACE_PLANS.includes(/** @type {import("../lib/tenant-types.mjs").WorkspacePlan} */ (plan))) {
        return jsonResponse(400, { error: "Invalid plan" });
      }
      patch.plan = plan;
    }
    if (typeof body.restricted === "boolean") {
      patch.restricted = body.restricted;
      patch.restrictionReason =
        typeof body.restrictionReason === "string" ? body.restrictionReason.trim() : "";
    }
    if (body.features && typeof body.features === "object") {
      patch.features = {};
      if (typeof body.features.sessionLogDownload === "boolean") {
        patch.features.sessionLogDownload = body.features.sessionLogDownload;
      }
      if (typeof body.features.startAr === "boolean") {
        patch.features.startAr = body.features.startAr;
      }
      if (typeof body.features.cameraCheck === "boolean") {
        patch.features.cameraCheck = body.features.cameraCheck;
      }
      if (!Object.keys(patch.features).length) delete patch.features;
    }
    if (!Object.keys(patch).length) {
      return jsonResponse(400, { error: "No valid fields to update" });
    }
    const workspace = await updatePlatformWorkspace(workspaceId, patch);
    return jsonResponse(200, { workspace });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleListPlatformCoupons(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const coupons = await syncAllPlatformCouponsFromDodo();
    return jsonResponse(200, { coupons, syncedFromDodo: true });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleCreatePlatformCoupon(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const offerTypeRaw = typeof body.offerType === "string" ? body.offerType.trim().toLowerCase() : "";
    const discountPercent =
      body.discountPercent != null && body.discountPercent !== ""
        ? Number(body.discountPercent)
        : undefined;
    const promoPriceMonthly =
      body.promoPriceMonthly != null && body.promoPriceMonthly !== ""
        ? Number(body.promoPriceMonthly)
        : undefined;
    const durationMonths =
      body.durationMonths != null && body.durationMonths !== ""
        ? Number(body.durationMonths)
        : undefined;
    const maxUses =
      body.maxUses != null && body.maxUses !== "" ? Number(body.maxUses) : undefined;
    const targetTier =
      typeof body.targetTier === "string" ? body.targetTier.trim().toLowerCase() || undefined : undefined;

    if (!code || !label) {
      return jsonResponse(400, { error: "code and label are required" });
    }

    const hasPercent =
      discountPercent != null && Number.isFinite(discountPercent) && discountPercent >= 1 && discountPercent <= 100;
    const hasPromoPrice =
      promoPriceMonthly != null && Number.isFinite(promoPriceMonthly) && promoPriceMonthly > 0;

    const offerType =
      offerTypeRaw === "percent" || offerTypeRaw === "fixed"
        ? offerTypeRaw
        : hasPromoPrice
          ? "fixed"
          : hasPercent
            ? "percent"
            : null;

    if (!offerType) {
      return jsonResponse(400, { error: "offerType must be fixed or percent" });
    }

    if (offerType === "fixed") {
      if (!hasPromoPrice) {
        return jsonResponse(400, { error: "promoPriceMonthly (USD/mo) is required for fixed promo offers" });
      }
      if (!targetTier) {
        return jsonResponse(400, { error: "targetTier is required for fixed promo offers" });
      }
      if (hasPercent) {
        return jsonResponse(400, { error: "Fixed promo offers do not use discountPercent" });
      }
      if (body.expiresAt) {
        return jsonResponse(400, { error: "Fixed promo offers do not use expiresAt — use maxUses instead" });
      }
      if (
        durationMonths != null &&
        (!Number.isFinite(durationMonths) || durationMonths < 1 || !Number.isInteger(durationMonths))
      ) {
        return jsonResponse(400, { error: "durationMonths must be a positive whole number" });
      }
      if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1 || !Number.isInteger(maxUses))) {
        return jsonResponse(400, { error: "maxUses must be a positive whole number" });
      }
    } else {
      if (!hasPercent) {
        return jsonResponse(400, { error: "discountPercent (1–100) is required for percent-off offers" });
      }
      if (hasPromoPrice || durationMonths != null) {
        return jsonResponse(400, {
          error: "Percent-off offers do not use promoPriceMonthly or durationMonths",
        });
      }
      if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1 || !Number.isInteger(maxUses))) {
        return jsonResponse(400, { error: "maxUses must be a positive whole number" });
      }
    }

    const coupon = await savePlatformCoupon({
      offerType,
      code,
      label,
      discountPercent: offerType === "percent" ? discountPercent : undefined,
      targetTier,
      expiresAt:
        offerType === "percent" && typeof body.expiresAt === "string"
          ? body.expiresAt.trim() || undefined
          : undefined,
      showOnPricing: body.showOnPricing === true,
      bannerText: typeof body.bannerText === "string" ? body.bannerText.trim() || undefined : undefined,
      maxUses:
        maxUses != null && Number.isFinite(maxUses) && maxUses > 0 ? maxUses : undefined,
      promoPriceMonthly: offerType === "fixed" ? promoPriceMonthly : undefined,
      durationMonths:
        offerType === "fixed" && durationMonths != null && Number.isFinite(durationMonths)
          ? durationMonths
          : undefined,
    });
    return jsonResponse(201, { coupon });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} code
 */
export async function handleDeletePlatformCoupon(event, code) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    await deletePlatformCoupon(code);
    return jsonResponse(200, { ok: true });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleDeletePlatformWorkspace(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const result = await deleteCustomerWorkspaceByPlatform(workspaceId);
    return jsonResponse(200, result);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * Platform operator — read global settings (sales deck, etc.).
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleGetPlatformSettings(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const settings = await getPlatformSettings();
    return jsonResponse(200, settings);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * Platform operator — update global settings.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handlePatchPlatformSettings(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    await requirePlatformOwner(event);
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "JSON body required" });
    }
    const patch = {};
    if (body.salesDeckActive !== undefined) {
      if (typeof body.salesDeckActive !== "boolean") {
        return jsonResponse(400, { error: "salesDeckActive must be boolean" });
      }
      patch.salesDeckActive = body.salesDeckActive;
    }
    if (body.mkt3StoryboardActive !== undefined) {
      if (typeof body.mkt3StoryboardActive !== "boolean") {
        return jsonResponse(400, { error: "mkt3StoryboardActive must be boolean" });
      }
      patch.mkt3StoryboardActive = body.mkt3StoryboardActive;
    }
    if (body.demoWorkspaceSlug !== undefined) {
      if (body.demoWorkspaceSlug !== null && typeof body.demoWorkspaceSlug !== "string") {
        return jsonResponse(400, { error: "demoWorkspaceSlug must be a string or null" });
      }
      patch.demoWorkspaceSlug =
        typeof body.demoWorkspaceSlug === "string" && body.demoWorkspaceSlug.trim()
          ? body.demoWorkspaceSlug.trim().toLowerCase()
          : null;
    }
    if (Object.keys(patch).length === 0) {
      return jsonResponse(400, { error: "At least one setting field required" });
    }
    const settings = await updatePlatformSettings(patch);
    return jsonResponse(200, settings);
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}

/**
 * Public — no auth. Used by /sales-deck/ to gate access without redeploying config.json.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function handleGetPlatformPublicSettings(event) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  try {
    const settings = await getPlatformSettings();
    let promo = null;
    try {
      promo = await getActivePromo();
    } catch {
      promo = null;
    }
    const demoWorkspaceSlug = await resolvePlatformDemoWorkspaceSlug();
    let demoSessionLogDownload = false;
    if (demoWorkspaceSlug) {
      try {
        const ws = await getWorkspaceBySlug(demoWorkspaceSlug);
        if (ws?.features?.sessionLogDownload) {
          demoSessionLogDownload = true;
        }
      } catch {
        demoSessionLogDownload = false;
      }
    }
    return jsonResponse(200, {
      salesDeckActive: settings.salesDeckActive,
      mkt3StoryboardActive: settings.mkt3StoryboardActive,
      promo,
      ...(demoWorkspaceSlug ? { demoWorkspaceSlug } : {}),
      ...(demoSessionLogDownload ? { demoSessionLogDownload: true } : {}),
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
