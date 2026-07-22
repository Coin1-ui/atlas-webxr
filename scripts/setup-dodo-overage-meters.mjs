#!/usr/bin/env node
/**
 * Idempotent Dodo test catalog setup for Atlas overage (meters + session pack add-on).
 *
 *   node scripts/setup-dodo-overage-meters.mjs
 *
 * Uses DODO_PAYMENTS_API_KEY or DOdo_api.txt. Does not change Lambda DODO_PRODUCT_* env.
 * See docs/atlas-ar/DODO-OVERAGE-METERS.md
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const base = "https://test.dodopayments.com";

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
if (!key) {
  console.error("Missing DODO_PAYMENTS_API_KEY");
  process.exit(1);
}

async function dodo(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

function items(x) {
  return Array.isArray(x) ? x : x?.items || [];
}

const METER_DEFS = [
  {
    name: "Atlas AR sessions",
    event_name: "atlas.ar_session",
    aggregation: { type: "count" },
    measurement_unit: "sessions",
    description: "AR viewing sessions for plan overage",
  },
  {
    name: "Atlas models",
    event_name: "atlas.model_count",
    aggregation: { type: "max", key: "model_count" },
    measurement_unit: "models",
    description: "Catalog model count peak",
  },
  {
    name: "Atlas storage GB",
    event_name: "atlas.storage_bytes",
    aggregation: { type: "max", key: "storage_bytes" },
    measurement_unit: "bytes",
    description: "Peak storage bytes",
  },
];

const existingMeters = items(await dodo("GET", "/meters"));
const metersByEvent = Object.fromEntries(existingMeters.map((m) => [m.event_name, m]));
for (const def of METER_DEFS) {
  if (metersByEvent[def.event_name]) continue;
  const created = await dodo("POST", "/meters", def);
  metersByEvent[def.event_name] = created;
  console.log("created meter", created.id, def.event_name);
}

const sessionMeterId = metersByEvent["atlas.ar_session"].id;

let addons = items(await dodo("GET", "/addons"));
let sessionPack = addons.find((a) => a.name === "Atlas Session Pack 1k");
if (!sessionPack) {
  sessionPack = await dodo("POST", "/addons", {
    name: "Atlas Session Pack 1k",
    tax_category: "saas",
    price: 800,
    currency: "USD",
  });
  console.log("created addon", sessionPack.id);
}

const HYBRIDS = [
  { name: "Starter (usage hybrid)", tier: "starter", fixed: 500, free: 1000, ppu: 5 },
  { name: "Launch usage hybrid", tier: "launch", fixed: 5900, free: 5000, ppu: 0.8 },
  { name: "Growth (usage hybrid)", tier: "growth", fixed: 17900, free: 15000, ppu: 0.5 },
];

const products = items(await dodo("GET", "/products?page_size=100"));
const out = { meters: metersByEvent, addon: sessionPack, hybrids: {} };

for (const h of HYBRIDS) {
  let product = products.find((p) => p.name === h.name);
  const price = {
    type: "usage_based_price",
    currency: "USD",
    fixed_price: h.fixed,
    tax_inclusive: false,
    discount: 0,
    purchasing_power_parity: false,
    payment_frequency_count: 1,
    payment_frequency_interval: "Month",
    subscription_period_count: 1,
    subscription_period_interval: "Month",
    meters: [
      {
        meter_id: sessionMeterId,
        free_threshold: h.free,
        price_per_unit: h.ppu,
      },
    ],
  };
  if (!product) {
    product = await dodo("POST", "/products", {
      name: h.name,
      tax_category: "saas",
      metadata: { atlas_tier: h.tier, atlas_usage_hybrid: "true" },
      price,
    });
    console.log("created product", product.product_id, h.name);
  } else {
    await dodo("PATCH", `/products/${product.product_id}`, {
      metadata: { atlas_tier: h.tier, atlas_usage_hybrid: "true" },
      price,
    });
    console.log("updated product", product.product_id, h.name);
  }
  out.hybrids[h.tier] = product.product_id || product.id;
}

// Attach session pack to classic Launch (non-hybrid) if present
const classicLaunch = products.find((p) => p.product_id === "pdt_0NjSYfJ2iwd7x9Qyfydwv" || p.name === "Launch");
if (classicLaunch?.product_id && sessionPack?.id) {
  await dodo("PATCH", `/products/${classicLaunch.product_id}`, {
    addons: [sessionPack.id],
  });
  console.log("attached addon to", classicLaunch.product_id);
}

console.log(JSON.stringify(out, null, 2));
