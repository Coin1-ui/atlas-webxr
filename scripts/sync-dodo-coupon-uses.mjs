#!/usr/bin/env node
/**
 * Sync Atlas platform coupon usesCount from Dodo test/live API.
 * Usage: node scripts/sync-dodo-coupon-uses.mjs [CODE]
 */
import { syncAllPlatformCouponsFromDodo, syncOnePlatformCouponFromDodo } from "../backend/lambda/atlas-api/lib/coupon-dodo-sync.mjs";
import { getPlatformCouponByCode } from "../backend/lambda/atlas-api/lib/dynamodb.mjs";

process.env.ATLAS_BILLING_ENABLED = process.env.ATLAS_BILLING_ENABLED || "true";

const code = process.argv[2]?.trim().toUpperCase();
if (code) {
  const existing = await getPlatformCouponByCode(code);
  if (!existing) {
    console.error(`Atlas coupon not found: ${code}`);
    process.exit(1);
  }
  const synced = await syncOnePlatformCouponFromDodo(existing);
  console.log(JSON.stringify({ ok: true, coupon: synced }, null, 2));
} else {
  const coupons = await syncAllPlatformCouponsFromDodo();
  console.log(JSON.stringify({ ok: true, count: coupons.length, coupons }, null, 2));
}
