import { findDodoDiscountByCode } from "./billing-provider-dodo.mjs";
import {
  listPlatformCoupons,
  syncPlatformCouponUsesFromDodo,
} from "./dynamodb.mjs";

function dodoSyncEnabled() {
  return (
    process.env.ATLAS_BILLING_ENABLED === "true" &&
    Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim()) &&
    Boolean(process.env.DODO_PAYMENTS_ENV?.trim())
  );
}

/**
 * Pull times_used / usage_limit from Dodo for one Atlas platform coupon.
 * @param {import("./dynamodb.mjs").PlatformCouponRecord} coupon
 */
export async function syncOnePlatformCouponFromDodo(coupon) {
  if (!dodoSyncEnabled()) return coupon;
  const dodo = await findDodoDiscountByCode(coupon.code);
  if (!dodo) return coupon;
  const usesCount = Number(dodo.times_used);
  const usageLimit = dodo.usage_limit != null ? Number(dodo.usage_limit) : undefined;
  return syncPlatformCouponUsesFromDodo(coupon.code, {
    usesCount: Number.isFinite(usesCount) && usesCount >= 0 ? usesCount : 0,
    maxUses:
      usageLimit != null && Number.isFinite(usageLimit) && usageLimit > 0
        ? usageLimit
        : undefined,
    dodoDiscountId:
      typeof dodo.discount_id === "string" ? dodo.discount_id : undefined,
  });
}

/**
 * Owner dashboard: sync all Atlas coupons against Dodo discount usage.
 */
export async function syncAllPlatformCouponsFromDodo() {
  const coupons = await listPlatformCoupons();
  if (!dodoSyncEnabled()) return coupons;
  const synced = [];
  for (const coupon of coupons) {
    try {
      synced.push(await syncOnePlatformCouponFromDodo(coupon));
    } catch (error) {
      console.warn("Dodo coupon sync failed", {
        code: coupon.code,
        error: error instanceof Error ? error.message : String(error),
      });
      synced.push(coupon);
    }
  }
  return synced;
}
