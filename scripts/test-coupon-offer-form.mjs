#!/usr/bin/env node
/** Unit tests for coupon offer-type form parsing + validation (AUD-2 / Batch 32 parity). */
import assert from "node:assert/strict";

function optionalInt(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parsePayload(offerType, fd) {
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const label = String(fd.get("label") ?? "").trim();
  const showOnPricing = fd.get("showOnPricing") === "on";
  const bannerText = String(fd.get("bannerText") ?? "").trim() || undefined;
  if (offerType === "fixed") {
    return {
      offerType,
      code,
      label,
      promoPriceMonthly: optionalInt(fd.get("promoPriceMonthly")),
      durationMonths: optionalInt(fd.get("durationMonths")),
      targetTier: String(fd.get("targetTierFixed") ?? "").trim() || undefined,
      maxUses: optionalInt(fd.get("maxUsesFixed")),
      showOnPricing,
      bannerText,
    };
  }
  return {
    offerType,
    code,
    label,
    discountPercent: optionalInt(fd.get("discountPercent")),
    targetTier: String(fd.get("targetTierPercent") ?? "").trim() || undefined,
    expiresAt: String(fd.get("expiresAt") ?? "").trim() || undefined,
    maxUses: optionalInt(fd.get("maxUses")),
    showOnPricing,
    bannerText,
  };
}

function validateCouponCreateInput(input) {
  if (!input.code || !input.label) return "Coupon code and label are required.";
  if (input.offerType === "fixed") {
    if (input.promoPriceMonthly == null || input.promoPriceMonthly <= 0) {
      return "Promo price (USD/mo) is required for fixed promo offers.";
    }
    if (!input.targetTier) return "Plan tier is required for fixed promo offers.";
    return null;
  }
  const pct = input.discountPercent;
  if (pct == null || !Number.isInteger(pct) || pct < 1 || pct > 100) {
    return "Discount % (1–100) is required for percent-off offers.";
  }
  if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) {
    return "Max uses must be a positive whole number.";
  }
  return null;
}

// Percent offer — fixed-only fields ignored; maxUses allowed on percent offers.
const percentFd = new Map([
  ["code", "SAVE25"],
  ["label", "Quarterly promo"],
  ["offerType", "percent"],
  ["discountPercent", "25"],
  ["targetTierPercent", ""],
  ["promoPriceMonthly", "59"],
  ["durationMonths", "12"],
  ["targetTierFixed", "growth"],
  ["maxUsesFixed", "10"],
  ["maxUses", "50"],
]);
const percentPayload = parsePayload("percent", { get: (k) => percentFd.get(k) ?? null });
assert.equal(percentPayload.offerType, "percent");
assert.equal(percentPayload.discountPercent, 25);
assert.equal(percentPayload.promoPriceMonthly, undefined);
assert.equal(percentPayload.durationMonths, undefined);
assert.equal(percentPayload.maxUses, 50);
assert.equal(validateCouponCreateInput(percentPayload), null);

const fixedFd = new Map([
  ["code", "FOUNDING10"],
  ["label", "Founding offer"],
  ["offerType", "fixed"],
  ["promoPriceMonthly", "59"],
  ["durationMonths", "12"],
  ["targetTierFixed", "growth"],
  ["maxUsesFixed", "10"],
  ["discountPercent", "25"],
]);
const fixedPayload = parsePayload("fixed", { get: (k) => fixedFd.get(k) ?? null });
assert.equal(fixedPayload.offerType, "fixed");
assert.equal(fixedPayload.promoPriceMonthly, 59);
assert.equal(fixedPayload.maxUses, 10);
assert.equal(fixedPayload.discountPercent, undefined);
assert.equal(validateCouponCreateInput(fixedPayload), null);

assert.match(
  validateCouponCreateInput({ offerType: "percent", code: "X", label: "Y", discountPercent: undefined }),
  /Discount %/,
);

console.log("test:coupon-offer-form — all passed");
