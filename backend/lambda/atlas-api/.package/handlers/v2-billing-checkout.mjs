import { requireWorkspaceAdmin } from "../lib/authz.mjs";
import { jsonResponse, parseJsonBody } from "../lib/http.mjs";
import {
  createBillingCheckoutOperation,
  getBillingSubscription,
  markBillingCheckoutProviderCallStarted,
  markBillingCheckoutReconciliationFailed,
  recordProviderCheckout,
  releaseCheckoutLease,
} from "../lib/billing-store.mjs";
import {
  createDodoCheckout,
  preflightDodoCheckout,
} from "../lib/billing-provider-dodo.mjs";
import {
  createZohoHostedCheckout,
  findZohoHostedPageByReference,
  preflightZohoCheckout,
} from "../lib/billing-provider-zoho.mjs";
import { createHash } from "node:crypto";
import { providerForBillingCountry } from "../lib/billing-policy.mjs";
import { billingEntitlementTier } from "../lib/billing-state.mjs";
import { getPlatformCouponByCode } from "../lib/dynamodb.mjs";
import { couponIsActive, couponMatchesTier } from "../lib/coupon.mjs";

function header(event, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function checkoutInput(body) {
  const tier = typeof body?.tier === "string" ? body.tier.trim().toLowerCase() : "";
  if (!["starter", "launch", "growth"].includes(tier)) {
    throw Object.assign(new Error("tier must be starter, launch, or growth"), { statusCode: 400 });
  }
  const billingCountry =
    typeof body?.billingCountry === "string" ? body.billingCountry.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(billingCountry)) {
    throw Object.assign(new Error("billingCountry must be an ISO country code"), {
      statusCode: 400,
    });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw Object.assign(new Error("A valid billing email is required"), { statusCode: 400 });
  }
  const rawAddress =
    body?.billingAddress && typeof body.billingAddress === "object" ? body.billingAddress : {};
  const billingAddress = {};
  for (const field of ["attention", "street", "city", "state", "zip", "zipcode"]) {
    if (typeof rawAddress[field] === "string" && rawAddress[field].trim()) {
      billingAddress[field] = rawAddress[field].trim().slice(0, 160);
    }
  }
  const couponCode =
    typeof body?.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
  if (couponCode && !/^[A-Z0-9_-]{1,40}$/.test(couponCode)) {
    throw Object.assign(new Error("couponCode contains unsupported characters"), {
      statusCode: 400,
    });
  }
  const gstNo = typeof body?.gstNo === "string" ? body.gstNo.trim().toUpperCase() : "";
  if (gstNo && !/^[0-9A-Z]{15}$/.test(gstNo)) {
    throw Object.assign(new Error("gstNo must be a valid 15-character GSTIN"), {
      statusCode: 400,
    });
  }
  const gstTreatment =
    typeof body?.gstTreatment === "string" ? body.gstTreatment.trim().toLowerCase() : "";
  if (
    gstTreatment &&
    !["business_gst", "business_none", "consumer", "overseas"].includes(gstTreatment)
  ) {
    throw Object.assign(new Error("gstTreatment is invalid"), { statusCode: 400 });
  }
  const placeOfSupply =
    typeof body?.placeOfSupply === "string" ? body.placeOfSupply.trim().toUpperCase() : "";
  if (placeOfSupply && !/^[A-Z0-9]{2}$/.test(placeOfSupply)) {
    throw Object.assign(new Error("placeOfSupply is invalid"), { statusCode: 400 });
  }
  return {
    tier,
    billingCountry,
    email,
    name: typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "",
    billingAddress,
    gstNo: gstNo || undefined,
    gstTreatment: gstTreatment || undefined,
    placeOfSupply: placeOfSupply || undefined,
    couponCode: couponCode || undefined,
  };
}

export async function handleBillingCheckout(event, workspaceId) {
  if (process.env.ATLAS_BILLING_ENABLED !== "true") {
    return jsonResponse(503, { error: "Billing checkout is not enabled" });
  }
  try {
    await requireWorkspaceAdmin(event, workspaceId, { allowSuspended: true });
    const input = checkoutInput(parseJsonBody(event));
    const current = await getBillingSubscription(workspaceId);
    const pendingUpdatedAt = current?.updatedAt ? Date.parse(current.updatedAt) : Number.NaN;
    const pendingIsFresh =
      current?.status === "pending" &&
      Number.isFinite(pendingUpdatedAt) &&
      Date.now() - pendingUpdatedAt < 30 * 60 * 1000;
    if (
      current &&
      (pendingIsFresh || billingEntitlementTier(current) !== null)
    ) {
      return jsonResponse(409, {
        error: "An existing subscription must be managed instead of creating another checkout",
      });
    }
    // Validate Atlas platform coupon if provided.
    if (input.couponCode) {
      const atlasCoupon = await getPlatformCouponByCode(input.couponCode);
      if (atlasCoupon) {
        if (!couponIsActive(atlasCoupon)) {
          return jsonResponse(400, { error: "Coupon has expired or is sold out" });
        }
        if (!couponMatchesTier(atlasCoupon, input.tier)) {
          return jsonResponse(400, { error: "Coupon does not apply to this plan" });
        }
      }
      // Redeem Atlas coupon use count after successful payment (webhook), not at checkout creation.
    }

    const idempotencyKey = header(event, "idempotency-key");
    if (
      typeof idempotencyKey !== "string" ||
      !/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)
    ) {
      return jsonResponse(400, { error: "A valid Idempotency-Key header is required" });
    }
    const provider = providerForBillingCountry(input.billingCountry);
    if (provider === "zoho" && process.env.ATLAS_ZOHO_CHECKOUT_ENABLED !== "true") {
      return jsonResponse(503, { error: "Zoho checkout is not enabled" });
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ provider, ...input }))
      .digest("hex");
    let operation = await createBillingCheckoutOperation({
      workspaceId,
      provider,
      tier: input.tier,
      billingCountry: input.billingCountry,
      couponCode: input.couponCode,
      idempotencyKey,
      requestHash,
    });
    if (
      operation.provider !== provider ||
      operation.tier !== input.tier ||
      operation.billingCountry !== input.billingCountry ||
      operation.requestHash !== requestHash
    ) {
      return jsonResponse(409, { error: "Idempotency key was already used for another checkout" });
    }
    // Dodo checkout_url is single-use. Lease recovery used to return a completed
    // provider_created session for the same tier/country/email → "payment link expired".
    if (
      operation.status === "provider_created" &&
      operation.checkoutUrl &&
      operation.reused &&
      operation.idempotencyKey !== idempotencyKey
    ) {
      await releaseCheckoutLease(workspaceId, operation.operationId);
      operation = await createBillingCheckoutOperation({
        workspaceId,
        provider,
        tier: input.tier,
        billingCountry: input.billingCountry,
        couponCode: input.couponCode,
        idempotencyKey,
        requestHash,
      });
    }
    if (operation.status === "provider_created" && operation.checkoutUrl) {
      return jsonResponse(200, {
        operationId: operation.operationId,
        provider,
        checkoutUrl: operation.checkoutUrl,
        reused: true,
      });
    }
    if (
      operation.reused &&
      operation.status === "provider_call_started" &&
      provider === "zoho"
    ) {
      const existing = await findZohoHostedPageByReference(operation.operationId);
      if (existing?.hostedpage_id && existing?.url) {
        const reconciled = await recordProviderCheckout({
          operationId: operation.operationId,
          provider,
          providerCheckoutId: existing.hostedpage_id,
          checkoutUrl: existing.url,
        });
        return jsonResponse(200, {
          operationId: operation.operationId,
          provider,
          checkoutUrl: reconciled.checkoutUrl,
          reused: true,
          reconciled: true,
        });
      }
      const failed = await markBillingCheckoutReconciliationFailed(operation.operationId);
      if (failed) {
        return jsonResponse(409, {
          error:
            "The prior Zoho checkout did not create a hosted page. Start a new checkout request.",
          operationId: operation.operationId,
          retryWithNewIdempotencyKey: true,
        });
      }
    }
    if (
      operation.reused &&
      operation.status !== "pending_provider" &&
      !(operation.status === "provider_call_started" && provider === "dodo")
    ) {
      return jsonResponse(409, {
        error: "Checkout creation is pending reconciliation",
        operationId: operation.operationId,
      });
    }

    if (provider === "zoho") await preflightZohoCheckout(input.tier);
    else preflightDodoCheckout(input.tier);
    if (operation.status === "pending_provider") {
      await markBillingCheckoutProviderCallStarted(operation.operationId, provider);
    }
    const providerResult =
      provider === "zoho"
        ? await createZohoHostedCheckout(operation, input)
        : await createDodoCheckout(operation, input);
    await recordProviderCheckout({
      operationId: operation.operationId,
      provider,
      providerCheckoutId: providerResult.providerCheckoutId,
      checkoutUrl: providerResult.checkoutUrl,
    });
    return jsonResponse(201, {
      operationId: operation.operationId,
      provider,
      checkoutUrl: providerResult.checkoutUrl,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Billing checkout failed", {
      workspaceId,
      status,
      message,
    });
    return jsonResponse(status, {
      error: status >= 500 ? "Unable to create checkout" : message,
    });
  }
}
