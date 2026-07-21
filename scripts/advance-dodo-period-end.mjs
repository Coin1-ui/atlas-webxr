#!/usr/bin/env node
/**
 * Advance Dodo test subscription next_billing_date for period-end sandbox testing.
 *
 * If a scheduled plan change exists, Dodo rejects PATCH next_billing_date with
 * SCHEDULED_PLAN_CHANGE_EXISTS. This script then:
 *   1) DELETE /subscriptions/{id}/change-plan/scheduled
 *   2) PATCH next_billing_date (~minutesAhead)
 *   3) POST /change-plan again with the same target product (effective_at next_billing_date)
 *
 * Usage:
 *   node scripts/advance-dodo-period-end.mjs [subscriptionId] [minutesAhead]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const subscriptionId = process.argv[2] || "sub_0NjbH236yHM6Qeaanaz0t";
const minutesAhead = Number(process.argv[3] || 4);

function loadApiKey() {
  if (process.env.DODO_PAYMENTS_API_KEY?.trim()) return process.env.DODO_PAYMENTS_API_KEY.trim();
  for (const credPath of [
    join(dirname(fileURLToPath(import.meta.url)), "../../../atlas-webxr/DOdo_api.txt"),
    "D:/AI/atlas-webxr/DOdo_api.txt",
  ]) {
    try {
      const text = readFileSync(credPath, "utf8");
      const match = text.match(/Test_mode API Key\s*=\s*(\S+)/);
      if (match?.[1]) return match[1];
    } catch {
      // try next
    }
  }
  throw new Error("Set DODO_PAYMENTS_API_KEY or add DOdo_api.txt");
}

const apiKey = loadApiKey();
const base = "https://test.dodopayments.com";
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function dodo(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && response.status !== 204) {
    throw new Error(`Dodo ${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

function summarize(sub) {
  return {
    subscriptionId: sub.subscription_id,
    status: sub.status,
    productId: sub.product_id,
    amount: sub.recurring_pre_tax_amount,
    cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
    nextBillingDate: sub.next_billing_date,
    scheduledChange: sub.scheduled_change
      ? {
          id: sub.scheduled_change.id,
          productId: sub.scheduled_change.product_id,
          productName: sub.scheduled_change.product_name,
          effectiveAt: sub.scheduled_change.effective_at,
        }
      : null,
  };
}

const before = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
console.log("Before:", summarize(before));

const preservedChange = before.scheduled_change
  ? {
      product_id: before.scheduled_change.product_id,
      quantity: before.scheduled_change.quantity || 1,
    }
  : null;

if (preservedChange) {
  console.log("Scheduled plan change present — cancel → advance date → re-schedule.");
  await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan/scheduled`, {
    method: "DELETE",
  });
}

const nextBillingDate = new Date(Date.now() + minutesAhead * 60_000)
  .toISOString()
  .replace(/\.\d{3}Z$/, "Z");

const patched = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
  method: "PATCH",
  body: JSON.stringify({ next_billing_date: nextBillingDate }),
});
console.log("Patched:", { requested: nextBillingDate, response: patched });

if (preservedChange) {
  await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, {
    method: "POST",
    body: JSON.stringify({
      product_id: preservedChange.product_id,
      quantity: preservedChange.quantity,
      proration_billing_mode: "full_immediately",
      effective_at: "next_billing_date",
      on_payment_failure: "prevent_change",
    }),
  });
  console.log("Re-scheduled plan change to product:", preservedChange.product_id);
}

const after = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
console.log("After:", summarize(after));
console.log(
  `\nWait ~${minutesAhead} minutes, then verify Dodo product + Atlas GET /v2/workspaces/1ee2cb65-6252-4679-ab53-84ea36b2518f/billing/status`,
);
if (preservedChange) {
  console.log(
    "Expect: upgrade activates (new product), scheduled_change cleared, previous plan does not continue.",
  );
} else if (before.cancel_at_next_billing_date) {
  console.log("Expect: subscription cancelled/expired, entitlement cleared after period end webhooks.");
} else {
  console.log("Expect: renewal webhooks; entitlement remains on current product.");
}
