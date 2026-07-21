/** Shared coupon / promo display helpers (mirrors backend lib/coupon.mjs). */

export type CouponLike = {
  expiresAt?: string;
  maxUses?: number;
  usesCount?: number;
  discountPercent?: number;
  promoPriceMonthly?: number;
  durationMonths?: number;
  targetTier?: string;
  bannerText?: string;
  label?: string;
};

export type PublicPromoLike = CouponLike & {
  code: string;
  text: string;
  remainingUses?: number;
};

export function couponUsesRemaining(coupon: CouponLike): number | undefined {
  if (coupon.maxUses == null || coupon.maxUses < 1) return undefined;
  const used = coupon.usesCount ?? 0;
  return Math.max(0, coupon.maxUses - used);
}

export function couponIsActive(coupon: CouponLike, now = Date.now()): boolean {
  if (coupon.expiresAt) {
    const end = Date.parse(coupon.expiresAt);
    if (!Number.isNaN(end) && end < now) return false;
  }
  const remaining = couponUsesRemaining(coupon);
  return remaining === undefined || remaining > 0;
}

/** Short summary for owner coupon list. */
export function couponOfferSummary(coupon: CouponLike): string {
  const parts: string[] = [];
  if (coupon.promoPriceMonthly != null && coupon.promoPriceMonthly > 0) {
    const tier = coupon.targetTier ? `${coupon.targetTier} ` : "";
    parts.push(`${tier}@ $${coupon.promoPriceMonthly}/mo`);
    if (coupon.durationMonths) parts.push(`${coupon.durationMonths} mo`);
  } else if (coupon.discountPercent != null) {
    parts.push(`${coupon.discountPercent}% off`);
    if (coupon.targetTier) parts.push(coupon.targetTier);
  }
  return parts.join(" · ");
}

/** Uses line for owner list / banner suffix (plain text). */
export function couponUsesLine(coupon: CouponLike): string {
  const used = coupon.usesCount ?? 0;
  if (coupon.maxUses != null && coupon.maxUses >= 1) {
    const remaining = couponUsesRemaining(coupon);
    if (remaining === undefined) return `${used} used`;
    if (remaining <= 0) return `${used} / ${coupon.maxUses} uses · sold out`;
    return `${remaining} of ${coupon.maxUses} spots left · ${used} used`;
  }
  return `${used} used`;
}

/** HTML suffix for pricing banner (uses countdown + code). */
export function promoBannerExtrasHtml(promo: PublicPromoLike): string {
  const parts: string[] = [];
  if (promo.code) parts.push(`code <strong>${escapeHtml(promo.code)}</strong>`);
  const usesLine = couponUsesLine(promo);
  if (usesLine) parts.push(`<strong>${escapeHtml(usesLine)}</strong>`);
  if (!parts.length) return "";
  return ` · ${parts.join(" · ")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
