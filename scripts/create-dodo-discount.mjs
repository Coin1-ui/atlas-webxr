#!/usr/bin/env node
/**
 * Create a Dodo test-mode discount code (POST /discounts).
 *
 * Atlas checkout forwards couponCode to Dodo as discount_codes[]. For end-to-end
 * use, create a matching Atlas platform coupon (owner dashboard) with the same code.
 *
 * Usage:
 *   node scripts/create-dodo-discount.mjs
 *   node scripts/create-dodo-discount.mjs ATLAS20 20 "Atlas Sandbox 20% Off"
 *   node scripts/create-dodo-discount.mjs ATLAS20 20 "Atlas Sandbox 20% Off" 100
 *
 * Env: DODO_PAYMENTS_API_KEY, or DOdo_api.txt (Test_mode API Key = …)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const code = (process.argv[2] || "ATLAS20").trim().toUpperCase();
const percentOff = Number(process.argv[3] || 20);
const name = process.argv[4] || "Atlas Sandbox 20% Off";
const usageLimit = process.argv[5] ? Number(process.argv[5]) : 100;

if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
  console.error("code must be 3–40 chars (A-Z, 0-9, _, -)");
  process.exit(1);
}
if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
  console.error("percent must be 1–100");
  process.exit(1);
}
if (usageLimit != null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
  console.error("usageLimit must be >= 1");
  process.exit(1);
}

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
  throw new Error("Set DODO_PAYMENTS_API_KEY or add DOdo_api.txt with Test_mode API Key");
}

const apiKey = loadApiKey();
const base = "https://test.dodopayments.com";
const amountBasisPoints = Math.round(percentOff * 100);

const body = {
  type: "percentage",
  amount: amountBasisPoints,
  code,
  name,
  usage_limit: usageLimit,
  metadata: {
    source: "atlas_sandbox_script",
    atlas_coupon_sync: "create_matching_platform_coupon_in_owner_dashboard",
  },
};

const response = await fetch(`${base}/discounts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await response.text();
let parsed = null;
try {
  parsed = text ? JSON.parse(text) : null;
} catch {
  // keep raw
}

if (!response.ok) {
  console.error(`Dodo POST /discounts failed (${response.status}):`, text.slice(0, 500));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  discount_id: parsed?.discount_id,
  code: parsed?.code ?? code,
  type: parsed?.type ?? "percentage",
  amount_basis_points: parsed?.amount ?? amountBasisPoints,
  percent_off: percentOff,
  usage_limit: parsed?.usage_limit ?? usageLimit,
  times_used: parsed?.times_used ?? 0,
  restricted_to: parsed?.restricted_to ?? [],
  next_steps: [
    "Create matching Atlas platform coupon in Owner dashboard → Coupons with the same code.",
    "Use coupon at Account → Plan & billing checkout (Coupon optional field).",
  ],
}, null, 2));
