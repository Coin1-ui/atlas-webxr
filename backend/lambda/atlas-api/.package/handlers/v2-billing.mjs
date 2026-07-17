import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import {
  getPlatformCouponByCode,
  incrementPlatformCouponUse,
  recordWorkspacePurchase,
} from "../lib/dynamodb.mjs";
import { couponIsActive, couponMatchesTier } from "../lib/coupon.mjs";

/**
 * POST /v2/workspaces/{id}/billing/upgrade — record paid tier (Stripe hook / self-serve stub).
 * Optional body.couponCode redeems a platform coupon (increments usesCount).
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} workspaceId
 */
export async function handleBillingUpgrade(event, workspaceId) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  if (event.requestContext?.http?.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (process.env.ATLAS_ALLOW_STUB_BILLING !== "true") {
    return jsonResponse(501, {
      error: "Payment required",
      paymentRequired: true,
      hint: "Direct tier upgrades are disabled until payment integration is enabled. Set ATLAS_ALLOW_STUB_BILLING=true only on staging.",
    });
  }

  try {
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    const body = parseJsonBody(event);
    const targetTier =
      typeof body?.targetTier === "string" ? body.targetTier.trim().toLowerCase() : "";
    const allowed = ["starter", "launch", "growth", "scale"];
    if (!allowed.includes(targetTier)) {
      return jsonResponse(400, { error: "targetTier must be starter, launch, growth, or scale" });
    }

    const couponCode =
      typeof body?.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
    if (couponCode) {
      const coupon = await getPlatformCouponByCode(couponCode);
      if (!coupon) {
        return jsonResponse(404, { error: "Coupon not found" });
      }
      if (!couponIsActive(coupon)) {
        return jsonResponse(409, { error: "Coupon expired or sold out" });
      }
      if (!couponMatchesTier(coupon, targetTier)) {
        return jsonResponse(400, { error: "Coupon does not apply to this plan" });
      }
    }

    const workspace = await recordWorkspacePurchase(
      workspaceId,
      /** @type {import("../lib/plan-limits.mjs").BillingTierId} */ (targetTier)
    );

    let redeemedCoupon = null;
    if (couponCode) {
      redeemedCoupon = await incrementPlatformCouponUse(couponCode);
    }

    return jsonResponse(200, {
      ok: true,
      workspace,
      coupon: redeemedCoupon
        ? {
            code: redeemedCoupon.code,
            usesCount: redeemedCoupon.usesCount,
            maxUses: redeemedCoupon.maxUses,
          }
        : undefined,
    });
  } catch (e) {
    const status = /** @type {{ statusCode?: number }} */ (e).statusCode || 500;
    return jsonResponse(status, { error: e instanceof Error ? e.message : "Error" });
  }
}
