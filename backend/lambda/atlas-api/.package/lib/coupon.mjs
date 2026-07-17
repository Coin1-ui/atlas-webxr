/**
 * Platform coupon helpers — expiry, use limits, promo pricing.
 */

/**
 * @param {{ expiresAt?: string; maxUses?: number; usesCount?: number }} coupon
 * @param {number} [now]
 */
export function couponNotExpired(coupon, now = Date.now()) {
  if (!coupon.expiresAt) return true;
  const end = Date.parse(coupon.expiresAt);
  return Number.isNaN(end) || end >= now;
}

/**
 * @param {{ maxUses?: number; usesCount?: number }} coupon
 */
export function couponUsesRemaining(coupon) {
  if (coupon.maxUses == null || !Number.isFinite(coupon.maxUses) || coupon.maxUses < 1) {
    return undefined;
  }
  const used = Number(coupon.usesCount) || 0;
  return Math.max(0, coupon.maxUses - used);
}

/**
 * @param {{ expiresAt?: string; maxUses?: number; usesCount?: number }} coupon
 */
export function couponHasUsesLeft(coupon) {
  const remaining = couponUsesRemaining(coupon);
  return remaining === undefined || remaining > 0;
}

/** @param {{ expiresAt?: string; maxUses?: number; usesCount?: number }} coupon */
export function couponIsActive(coupon) {
  return couponNotExpired(coupon) && couponHasUsesLeft(coupon);
}

/**
 * @param {{ targetTier?: string; promoPriceMonthly?: number; discountPercent?: number }} coupon
 * @param {string} targetTier
 */
export function couponMatchesTier(coupon, targetTier) {
  if (!coupon.targetTier) return true;
  return coupon.targetTier.trim().toLowerCase() === targetTier.trim().toLowerCase();
}

/**
 * Build public promo payload from a coupon record.
 * @param {import("./dynamodb.mjs").PlatformCouponRecord} coupon
 */
export function publicPromoFromCoupon(coupon) {
  const remaining = couponUsesRemaining(coupon);
  return {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    targetTier: coupon.targetTier,
    expiresAt: coupon.expiresAt,
    promoPriceMonthly: coupon.promoPriceMonthly,
    durationMonths: coupon.durationMonths,
    maxUses: coupon.maxUses,
    usesCount: coupon.usesCount ?? 0,
    remainingUses: remaining,
    text: (coupon.bannerText || coupon.label).trim(),
  };
}
