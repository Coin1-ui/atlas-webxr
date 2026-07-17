#!/usr/bin/env node
/**
 * Unit tests — coupon use limits + promo pricing helpers.
 */
import assert from "node:assert/strict";
import {
  couponIsActive,
  couponUsesRemaining,
  couponHasUsesLeft,
  couponMatchesTier,
  publicPromoFromCoupon,
} from "../backend/lambda/atlas-api/lib/coupon.mjs";

assert.equal(couponUsesRemaining({ maxUses: 10, usesCount: 3 }), 7);
assert.equal(couponUsesRemaining({ maxUses: 10, usesCount: 10 }), 0);
assert.equal(couponUsesRemaining({}), undefined);

assert.equal(couponHasUsesLeft({ maxUses: 2, usesCount: 2 }), false);
assert.equal(couponHasUsesLeft({ maxUses: 2, usesCount: 1 }), true);
assert.equal(couponIsActive({ maxUses: 2, usesCount: 1 }), true);
assert.equal(couponIsActive({ maxUses: 2, usesCount: 2 }), false);

assert.equal(couponMatchesTier({ targetTier: "growth" }, "growth"), true);
assert.equal(couponMatchesTier({ targetTier: "growth" }, "launch"), false);
assert.equal(couponMatchesTier({}, "growth"), true);

const promo = publicPromoFromCoupon({
  code: "FOUNDING10",
  label: "Founding",
  bannerText: "Growth at Launch price",
  targetTier: "growth",
  promoPriceMonthly: 59,
  durationMonths: 12,
  maxUses: 10,
  usesCount: 3,
  showOnPricing: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});
assert.equal(promo.remainingUses, 7);
assert.equal(promo.promoPriceMonthly, 59);
assert.equal(promo.text, "Growth at Launch price");

console.log("test:coupon-unit — OK");
