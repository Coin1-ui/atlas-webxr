#!/usr/bin/env node
/**
 * Advance Dodo test subscription next_billing_date for period-end sandbox testing.
 *
 * Usage:
 *   node scripts/advance-dodo-period-end.mjs [subscriptionId] [minutesAhead]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const subscriptionId = process.argv[2] || "sub_0NjVduFvyLgtljNZmXMoU";
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
  if (!response.ok) {
    throw new Error(`Dodo ${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

const before = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
const nextBillingDate = new Date(Date.now() + minutesAhead * 60_000)
  .toISOString()
  .replace(/\.\d{3}Z$/, "Z");

console.log("Before:", {
  subscriptionId: before.subscription_id,
  status: before.status,
  cancelAtPeriodEnd: before.cancel_at_next_billing_date,
  nextBillingDate: before.next_billing_date,
});

const patched = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
  method: "PATCH",
  body: JSON.stringify({ next_billing_date: nextBillingDate }),
});

const after = await dodo(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
console.log("Patched:", { requested: nextBillingDate, response: patched });
console.log("After:", {
  subscriptionId: after.subscription_id,
  status: after.status,
  cancelAtPeriodEnd: after.cancel_at_next_billing_date,
  nextBillingDate: after.next_billing_date,
});
console.log(
  `\nWait ~${minutesAhead} minutes, then check Atlas GET /v2/workspaces/1ee2cb65-6252-4679-ab53-84ea36b2518f/billing/status`
);
console.log("Expect: subscription cancelled/expired, entitlement cleared after period end webhooks.");
