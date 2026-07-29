#!/usr/bin/env node
/**
 * Stuck payment cancel policy unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ATLAS_STUCK_PAYMENT_HOURS = "1";

const {
  isStuckProcessingPayment,
  stuckPaymentThresholdHours,
} = await import("../backend/lambda/atlas-api/lib/billing-stuck-payment.mjs");

assert.equal(stuckPaymentThresholdHours(), 1);

const now = Date.parse("2026-07-25T12:00:00.000Z");
assert.equal(
  isStuckProcessingPayment(
    { status: "processing", created_at: "2026-07-25T11:30:00.000Z" },
    now
  ),
  false,
  "30 minutes is not stuck"
);
assert.equal(
  isStuckProcessingPayment(
    { status: "processing", created_at: "2026-07-25T10:00:00.000Z" },
    now
  ),
  true,
  "exactly 1 hour is stuck"
);
assert.equal(
  isStuckProcessingPayment(
    { status: "processing", created_at: "2026-07-24T10:00:00.000Z" },
    now
  ),
  true
);
assert.equal(
  isStuckProcessingPayment(
    { status: "succeeded", created_at: "2026-07-24T10:00:00.000Z" },
    now
  ),
  false
);
assert.equal(
  isStuckProcessingPayment(
    { status: "failed", created_at: "2026-07-24T10:00:00.000Z" },
    now
  ),
  false
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const dodoSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/lib/billing-provider-dodo.mjs"),
  "utf8"
);
assert.match(dodoSrc, /cancelDodoSubscriptionImmediately/);
assert.match(dodoSrc, /status:\s*"cancelled"/);
assert.match(dodoSrc, /export async function listDodoPayments/);

const indexSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/index.mjs"),
  "utf8"
);
assert.match(indexSrc, /handleStuckPaymentSweeper/);

const billingSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/handlers/v2-billing.mjs"),
  "utf8"
);
assert.match(billingSrc, /enforceStuckPaymentsForSubscription/);
assert.match(billingSrc, /cancelReason/);
assert.match(billingSrc, /clearWorkspaceStuckPaymentCancel/);
assert.match(billingSrc, /usageHybrid \|\| inOverage/);

const stuckLib = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/lib/billing-stuck-payment.mjs"),
  "utf8"
);
assert.match(stuckLib, /export async function clearWorkspaceStuckPaymentCancel/);
assert.match(stuckLib, /REMOVE billingCancelReason/);

const webhookSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/handlers/v2-billing-webhooks.mjs"),
  "utf8"
);
assert.match(webhookSrc, /clearWorkspaceStuckPaymentCancel/);

console.log("test-stuck-payment-cancel-unit: OK");
