#!/usr/bin/env node
/**
 * Investigate Dodo tax on products + recent payments for a customer.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadKey() {
  if (process.env.DODO_PAYMENTS_API_KEY?.trim()) return process.env.DODO_PAYMENTS_API_KEY.trim();
  for (const f of [
    resolve("D:/AI/atlas-webxr/DOdo_api.txt"),
    resolve(root, "../DOdo_api.txt"),
    resolve(root, "DOdo_api.txt"),
  ]) {
    if (!existsSync(f)) continue;
    const t = readFileSync(f, "utf8");
    const m =
      t.match(/Test_mode API Key\s*=\s*(\S+)/) ||
      t.match(/DODO_PAYMENTS_API_KEY\s*=\s*(\S+)/);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

const key = loadKey();
const base = "https://test.dodopayments.com";
async function dodo(path) {
  const res = await fetch(base + path, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`Dodo ${res.status} ${path}: ${String(text).slice(0, 400)}`);
  return body;
}

function items(x) {
  return Array.isArray(x) ? x : x?.items || x?.data || [];
}

const customerId = "cus_0NjUvFmQSrwEVxMsaLu15";
const productIds = [
  "pdt_0NjSYThH2jXDPH6VWGfSr", // starter?
  "pdt_0NjSYfJ2iwd7x9Qyfydwv", // launch?
  "pdt_0NjSZ4vMKc6bGxwEJYGvo", // growth
];

const products = [];
for (const id of productIds) {
  try {
    const p = await dodo(`/products/${id}`);
    products.push({
      product_id: p.product_id,
      name: p.name,
      tax_category: p.tax_category,
      price: p.price,
    });
  } catch (e) {
    products.push({ product_id: id, error: String(e.message || e) });
  }
}

const pays = items(await dodo("/payments?page_size=30")).filter(
  (p) => p.customer?.customer_id === customerId || p.customer_id === customerId
);

const paymentTax = pays.slice(0, 15).map((p) => ({
  payment_id: p.payment_id,
  status: p.status,
  total_amount: p.total_amount,
  tax: p.tax,
  settlement_amount: p.settlement_amount,
  settlement_tax: p.settlement_tax,
  currency: p.currency,
  billing: p.billing,
  card_last_four: p.card_last_four,
  created_at: p.created_at,
  subscription_id: p.subscription_id,
  meta: p.metadata,
}));

// Try tax preview / calculate endpoints if any
const probePaths = [
  "/tax",
  "/taxes",
  "/calculate-tax",
  "/tax/calculate",
];
const probes = [];
for (const path of probePaths) {
  const res = await fetch(base + path, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
  });
  probes.push({ path, method: "GET", status: res.status });
}

// Sample checkout create dry-run shape isn't charged — skip creating real checkout.
// Inspect latest sub billing country via payment billing block.

console.log(
  JSON.stringify(
    {
      products,
      paymentsForAryan: paymentTax,
      taxZeroCount: paymentTax.filter((p) => Number(p.tax) === 0 || p.tax == null).length,
      taxNonZeroCount: paymentTax.filter((p) => Number(p.tax) > 0).length,
      countriesSeen: [...new Set(paymentTax.map((p) => p.billing?.country).filter(Boolean))],
      endpointProbes: probes,
    },
    null,
    2
  )
);
