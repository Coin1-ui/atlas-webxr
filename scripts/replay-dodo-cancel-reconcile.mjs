#!/usr/bin/env node
/**
 * Replay a signed Dodo subscription.cancelled webhook so Atlas pulls live Dodo
 * state and applies it (fixes Dynamo lag after missed webhooks / Lambda outages).
 *
 * Usage:
 *   node scripts/replay-dodo-cancel-reconcile.mjs [subscriptionId]
 *
 * Default subscription: sub_0Njk9U81rAfF9UVllm8GD (test-admin Launch cancel).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Webhook } from "../backend/lambda/atlas-api/node_modules/standardwebhooks/dist/index.js";

const subscriptionId = process.argv[2] || "sub_0Njk9U81rAfF9UVllm8GD";
const webhookUrl =
  process.env.ATLAS_DODO_WEBHOOK_URL ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/v2/billing/webhooks/dodo";

function loadCreds() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(scriptDir, "../DOdo_api.txt"),
    join(scriptDir, "../../../atlas-webxr/DOdo_api.txt"),
    "D:/AI/atlas-webxr/DOdo_api.txt",
  ];
  let secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.trim() || "";
  let businessId = process.env.DODO_PAYMENTS_BUSINESS_ID?.trim() || "";
  for (const credPath of candidates) {
    try {
      const text = readFileSync(credPath, "utf8");
      if (!secret) {
        const m = text.match(/DODO_PAYMENTS_WEBHOOK_SECRET\s*=\s*(\S+)/);
        if (m?.[1]) secret = m[1];
      }
      if (!businessId) {
        const m = text.match(/Business ID\s*=\s*(\S+)/);
        if (m?.[1]) businessId = m[1];
      }
    } catch {
      /* next */
    }
  }
  if (!secret) throw new Error("Set DODO_PAYMENTS_WEBHOOK_SECRET or add it to DOdo_api.txt");
  if (!businessId) businessId = "bus_0NiRCeAygFrKyx6k11gSw";
  return { secret, businessId };
}

const { secret, businessId } = loadCreds();
const nowIso = new Date().toISOString();
const payload = JSON.stringify({
  business_id: businessId,
  type: "subscription.cancelled",
  timestamp: nowIso,
  data: {
    payload_type: "Subscription",
    subscription_id: subscriptionId,
    status: "cancelled",
    cancel_at_next_billing_date: false,
    cancelled_at: nowIso,
    customer: {
      customer_id: "cus_0NjUvFmQSrwEVxMsaLu15",
    },
    metadata: {
      atlas_billing_operation_id: "24d340fa-0c96-494f-8e68-8b07777ee429",
    },
  },
});

const webhookId = `reconcile-cancel-${randomUUID()}`;
const timestamp = new Date();
const signer = new Webhook(secret);
const signature = signer.sign(webhookId, timestamp, payload);

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "webhook-id": webhookId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature,
  },
  body: payload,
});
const body = await response.text();
console.log(JSON.stringify({ subscriptionId, status: response.status, body }, null, 2));
if (!response.ok) process.exitCode = 1;
