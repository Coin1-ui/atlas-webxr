#!/usr/bin/env node
/**
 * Ops: create a hosted Launch remount checkout so Dodo snapshots fresh meters.
 * Dodo change-plan / PATCH meters do not refresh free thresholds.
 *
 * Usage:
 *   $env:DODO_PAYMENTS_API_KEY = "<from DOdo_api.txt>"
 *   node scripts/ops-remount-hybrid-meters.mjs
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
      // next
    }
  }
  throw new Error("Set DODO_PAYMENTS_API_KEY or DOdo_api.txt");
}

const key = loadApiKey();
const base = "https://test.dodopayments.com";
const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "User-Agent": "atlas-ops/1.0",
  Accept: "application/json",
};

async function req(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  if (!response.ok) {
    throw Object.assign(new Error(json?.message || text.slice(0, 300)), {
      status: response.status,
      body: json,
    });
  }
  return json;
}

const OLD_SUB = process.env.ATLAS_REMOUNT_OLD_SUB?.trim() || "sub_0NjnjsB8DN4nw0FhngBky";
const CUSTOMER = process.env.ATLAS_REMOUNT_CUSTOMER?.trim() || "cus_0Nji48EKb26WfJztNrPj3";
const LAUNCH = process.env.DODO_PRODUCT_LAUNCH_USAGE?.trim() || "pdt_0Njk5QMJ8uCwSvseuHeo0";
const opId = randomUUID();

const old = await req("GET", `/subscriptions/${encodeURIComponent(OLD_SUB)}`);
const billing = old.billing || { country: "AT" };

const checkout = await req(
  "POST",
  "/checkouts",
  {
    product_cart: [{ product_id: LAUNCH, quantity: 1 }],
    customer: { customer_id: CUSTOMER },
    billing_address: {
      country: String(billing.country || "AT").toUpperCase(),
      ...(billing.state ? { state: billing.state } : {}),
      ...(billing.city ? { city: billing.city } : {}),
      ...(billing.street ? { street: billing.street } : {}),
      ...(billing.zipcode ? { zipcode: billing.zipcode } : {}),
    },
    return_url: "https://main.d7vfdpujdozkj.amplifyapp.com/account",
    cancel_url: "https://main.d7vfdpujdozkj.amplifyapp.com/account",
    metadata: {
      atlas_billing_operation_id: opId,
      atlas_checkout_purpose: "hybrid_plan_remount",
      atlas_replaces_subscription_id: OLD_SUB,
      atlas_ops: "bill_meter_sync_fix",
    },
  },
  { "Idempotency-Key": `ops-remount-${opId}` }
);

console.log(
  JSON.stringify(
    {
      ok: true,
      replaces: OLD_SUB,
      product: LAUNCH,
      operationId: opId,
      sessionId: checkout.session_id,
      checkoutUrl: checkout.checkout_url,
      next: [
        "1. Upload Lambda zip with customer-resolve + metadata remount webhook fixes",
        "2. Open checkoutUrl and pay (EUR Launch) — meters snapshot from Launch catalog",
        "3. Confirm GET /subscriptions/{new} meters free 3000/30/3.66GB",
        "4. Atlas entitlement switches via webhook; old sub schedule-cancels",
      ],
    },
    null,
    2
  )
);
