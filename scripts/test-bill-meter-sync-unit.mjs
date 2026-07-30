#!/usr/bin/env node
/**
 * BILL-METER-SYNC / overage-gated remount unit tests.
 */
import assert from "node:assert/strict";
import {
  applyBillingEvent,
  billingEntitlementTier,
} from "../backend/lambda/atlas-api/lib/billing-state.mjs";
import {
  needsOveragePlanRemount,
  workspaceIsInOverage,
} from "../backend/lambda/atlas-api/lib/overage-estimate.mjs";
import { limitsForBillingTier } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";

process.env.ATLAS_DODO_USAGE_HYBRID = "true";
process.env.DODO_PAYMENTS_ENV = "test_mode";
process.env.DODO_PAYMENTS_API_KEY = "test_key";
process.env.DODO_PRODUCT_STARTER_USAGE = "pdt_starter_usage";
process.env.DODO_PRODUCT_LAUNCH_USAGE = "pdt_launch_usage";
process.env.DODO_PRODUCT_GROWTH_USAGE = "pdt_growth_usage";
process.env.ATLAS_BILLING_APP_ORIGIN = "https://app.example.com";
process.env.ATLAS_BILLING_RETURN_URL = "https://app.example.com/billing/return";
process.env.ATLAS_BILLING_CANCEL_URL = "https://app.example.com/billing/cancel";

const {
  assertHybridMetersMatchProduct,
  freeThresholdsMatch,
  meterPricePerUnitsMatch,
  isDodoUsageHybridEnabled,
  createDodoCheckout,
  dodoSubscriptionIsUsageHybrid,
  isUsageHybridProductId,
  productIdForTier,
} = await import("../backend/lambda/atlas-api/lib/billing-provider-dodo.mjs");

assert.equal(isDodoUsageHybridEnabled(), true);
assert.equal(isUsageHybridProductId("pdt_launch_usage"), true);
assert.equal(isUsageHybridProductId("pdt_classic_monthly"), false);
assert.equal(productIdForTier("launch"), "pdt_launch_usage");
assert.equal(
  dodoSubscriptionIsUsageHybrid({ product_id: "pdt_classic", meters: [] }),
  false
);
assert.equal(
  dodoSubscriptionIsUsageHybrid({
    product_id: "pdt_classic",
    meters: [{ meter_id: "m1", free_threshold: 500 }],
  }),
  true
);

const launchLimits = limitsForBillingTier("launch");
assert.equal(
  needsOveragePlanRemount(
    "launch",
    { modelCount: 10, sessionCount: 100, storageBytes: 1_000_000 },
    launchLimits
  ),
  false,
  "within limits → not overage (hybrid still remounts via usageHybrid path)"
);
assert.equal(
  workspaceIsInOverage(
    "launch",
    { modelCount: 10, sessionCount: 100, storageBytes: 1_000_000 },
    launchLimits
  ),
  false
);
assert.equal(
  needsOveragePlanRemount(
    "launch",
    {
      modelCount: launchLimits.models + 1,
      sessionCount: launchLimits.sessionsPerMonth + 1,
      storageBytes: launchLimits.storageBytes + 1,
    },
    launchLimits
  ),
  true,
  "in overage → remount (cancel + resubscribe)"
);

// Hybrid-only: no MONTHLY fallback — known hybrid id when USAGE unset
delete process.env.DODO_PRODUCT_STARTER_USAGE;
delete process.env.DODO_PRODUCT_LAUNCH_USAGE;
delete process.env.DODO_PRODUCT_GROWTH_USAGE;
process.env.DODO_PRODUCT_LAUNCH_MONTHLY = "pdt_launch_monthly";
assert.equal(productIdForTier("launch"), "pdt_0Njk5QMJ8uCwSvseuHeo0", "known hybrid id when USAGE unset");
assert.notEqual(productIdForTier("launch"), "pdt_launch_monthly", "classic MONTHLY must not be selected");
process.env.DODO_PRODUCT_STARTER_USAGE = "pdt_starter_usage";
process.env.DODO_PRODUCT_LAUNCH_USAGE = "pdt_launch_usage";
process.env.DODO_PRODUCT_GROWTH_USAGE = "pdt_growth_usage";

const baseEvent = {
  provider: "dodo",
  eventId: "evt_remount_1",
  eventType: "subscription.active",
  workspaceId: "ws_1",
  providerSubscriptionId: "sub_old",
  tier: "starter",
  status: "active",
  occurredAt: "2026-07-25T10:00:00.000Z",
  providerSequence: 100,
  currentPeriodEnd: "2026-08-25T10:00:00.000Z",
  amountMinor: 500,
  currency: "USD",
};

const active = applyBillingEvent(null, baseEvent);
assert.equal(billingEntitlementTier(active.subscription, "2026-07-26T00:00:00.000Z"), "starter");

assert.throws(
  () =>
    applyBillingEvent(active.subscription, {
      ...baseEvent,
      eventId: "evt_other",
      providerSubscriptionId: "sub_new",
      tier: "launch",
      providerSequence: 1,
      occurredAt: "2026-07-26T10:00:00.000Z",
      amountMinor: 5900,
    }),
  /only after the prior subscription has ended/
);

const remounted = applyBillingEvent(active.subscription, {
  ...baseEvent,
  eventId: "evt_remount_new",
  providerSubscriptionId: "sub_new",
  tier: "launch",
  providerSequence: 1,
  occurredAt: "2026-07-26T10:00:00.000Z",
  amountMinor: 5900,
  allowRemountFromSubscriptionId: "sub_old",
});
assert.equal(remounted.applied, true);
assert.equal(remounted.subscription.providerSubscriptionId, "sub_new");
assert.equal(remounted.subscription.tier, "launch");
assert.equal(
  billingEntitlementTier(remounted.subscription, "2026-07-27T00:00:00.000Z"),
  "launch"
);

const match = await assertHybridMetersMatchProduct(
  {
    product_id: "pdt_launch_usage",
    meters: [
      { meter_id: "mtr_s", free_threshold: 3000, price_per_unit: "0.008" },
      { meter_id: "mtr_m", free_threshold: 30, price_per_unit: "1.2" },
    ],
  },
  {
    price: {
      meters: [
        { meter_id: "mtr_s", free_threshold: 3000, price_per_unit: "0.008" },
        { meter_id: "mtr_m", free_threshold: 30, price_per_unit: "1.2" },
      ],
    },
  }
);
assert.equal(match.ok, true);

const mismatch = await assertHybridMetersMatchProduct(
  {
    product_id: "pdt_launch_usage",
    meters: [
      { meter_id: "mtr_s", free_threshold: 500, price_per_unit: "0.05" },
      { meter_id: "mtr_m", free_threshold: 5, price_per_unit: "3" },
    ],
  },
  {
    price: {
      meters: [
        { meter_id: "mtr_s", name: "sessions", free_threshold: 3000, price_per_unit: "0.008" },
        { meter_id: "mtr_m", name: "models", free_threshold: 30, price_per_unit: "1.2" },
      ],
    },
  }
);
assert.equal(mismatch.ok, false);
assert.equal(mismatch.mismatches.length, 2);
assert.equal(mismatch.mismatches[0].reason, "threshold_or_ppu_mismatch");

// Signed int32 overflow: Launch storage free bytes (3932160000) as -362807296
assert.equal(freeThresholdsMatch(-362807296, 3932160000), true);
assert.equal(freeThresholdsMatch(3932160000, 3932160000), true);
assert.equal(freeThresholdsMatch(500, 3000), false);
// Growth storage free (13107200000) wraps past 2×2^32 → uint32 low bits 222298112
assert.equal(freeThresholdsMatch(222298112, 13107200000), true);
assert.equal(13107200000 >>> 0, 222298112);
const launchStoragePpu = Number((6 / (10 * 1024 ** 3)).toFixed(12)); // ~5.59e-10 USD/byte
const overflowMatch = await assertHybridMetersMatchProduct(
  {
    product_id: "pdt_launch_usage",
    meters: [
      {
        meter_id: "mtr_storage",
        free_threshold: -362807296,
        price_per_unit: String(launchStoragePpu),
      },
    ],
  },
  {
    price: {
      meters: [
        {
          meter_id: "mtr_storage",
          name: "storage",
          free_threshold: 3932160000,
          price_per_unit: launchStoragePpu,
        },
      ],
    },
  }
);
assert.equal(overflowMatch.ok, true, "int32 overflow storage free should match catalog");

// Scientific-notation catalog PPU vs decimal-string sub PPU (corrected USD major units)
assert.equal(meterPricePerUnitsMatch(String(launchStoragePpu), launchStoragePpu), true);
assert.equal(meterPricePerUnitsMatch("0.05", "0.008"), false);
const ppuFormatMatch = await assertHybridMetersMatchProduct(
  {
    product_id: "pdt_launch_usage",
    meters: [
      {
        meter_id: "mtr_storage",
        free_threshold: -362807296,
        price_per_unit: String(launchStoragePpu),
      },
    ],
  },
  {
    price: {
      meters: [
        {
          meter_id: "mtr_storage",
          name: "storage",
          free_threshold: 3932160000,
          price_per_unit: launchStoragePpu,
        },
      ],
    },
  }
);
assert.equal(ppuFormatMatch.ok, true, "int32 free + PPU format should match");

const originalFetch = globalThis.fetch;
let capturedBody;
globalThis.fetch = async (_url, init) => {
  capturedBody = JSON.parse(init.body);
  return new Response(
    JSON.stringify({
      session_id: "cks_remount",
      checkout_url: "https://test.checkout.dodopayments.com/remount",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
await createDodoCheckout(
  {
    operationId: "op_remount_12345678",
    tier: "launch",
    billingCountry: "US",
    couponCode: null,
    purpose: "hybrid_plan_remount",
    replacesProviderSubscriptionId: "sub_old",
  },
  { email: "buyer@example.com", billingAddress: {}, customerId: "cus_1" }
);
assert.deepEqual(capturedBody.customer, { customer_id: "cus_1" });
assert.equal(capturedBody.metadata.atlas_checkout_purpose, "hybrid_plan_remount");
assert.equal(capturedBody.metadata.atlas_replaces_subscription_id, "sub_old");
assert.equal(capturedBody.product_cart[0].product_id, "pdt_launch_usage");
globalThis.fetch = originalFetch;

console.log("test-bill-meter-sync-unit: OK");
