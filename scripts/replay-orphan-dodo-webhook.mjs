#!/usr/bin/env node
/**
 * Replay a stale Dodo webhook against the live Atlas endpoint.
 * After the orphan-handler Lambda fix, obsolete subscriptions return 200 ignored
 * so Dodo stops retrying failed deliveries.
 *
 * Usage:
 *   node scripts/replay-orphan-dodo-webhook.mjs sub_0NjVIND10qEjadKzn7EVR
 *
 * Env (from DOdo_api.txt / Lambda):
 *   DODO_PAYMENTS_WEBHOOK_SECRET
 *   ATLAS_DODO_WEBHOOK_URL (default: production API Gateway route)
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Webhook } from "../backend/lambda/atlas-api/node_modules/standardwebhooks/dist/index.js";

const subscriptionId = process.argv[2] || "sub_0NjVIND10qEjadKzn7EVR";
const webhookUrl =
  process.env.ATLAS_DODO_WEBHOOK_URL ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com/v2/billing/webhooks/dodo";

function loadSecret() {
  if (process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.trim()) {
    return process.env.DODO_PAYMENTS_WEBHOOK_SECRET.trim();
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(scriptDir, "../DOdo_api.txt"),
    join(scriptDir, "../../../atlas-webxr/DOdo_api.txt"),
    "D:/AI/atlas-webxr/DOdo_api.txt",
  ];
  for (const credPath of candidates) {
    try {
      const text = readFileSync(credPath, "utf8");
      const match = text.match(/DODO_PAYMENTS_WEBHOOK_SECRET\s*=\s*(\S+)/);
      if (match?.[1]) return match[1];
    } catch {
      // try next path
    }
  }
  throw new Error("Set DODO_PAYMENTS_WEBHOOK_SECRET or add it to DOdo_api.txt");
}

const payload = JSON.stringify({
  business_id: "bus_0NiRCeAygFrKyx6k11gSw",
  type: "subscription.active",
  timestamp: "2026-07-19T06:19:25.366761Z",
  data: {
    payload_type: "Subscription",
    subscription_id: subscriptionId,
    product_id: "pdt_0NjSYThH2jXDPH6VWGfSr",
    status: "active",
    next_billing_date: "2026-08-19T06:19:25.438984Z",
    cancel_at_next_billing_date: false,
    customer: {
      customer_id: "cus_0NjUvFmQSrwEVxMsaLu15",
      email: "aryan.barua57@gmail.com",
      name: "Atlas Billing Test",
    },
    metadata: {
      atlas_billing_operation_id: "6061468c-d461-40bd-a90e-f1b4312d323a",
    },
  },
});

const secret = loadSecret();
const webhookId = randomUUID();
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
console.log(JSON.stringify({ status: response.status, body: body }, null, 2));
if (!response.ok) process.exitCode = 1;
