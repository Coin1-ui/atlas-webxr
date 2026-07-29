#!/usr/bin/env node
/**
 * Idempotent Dodo test catalog for Atlas plan + usage overage.
 *
 *   node scripts/setup-dodo-overage-meters.mjs
 *
 * - Pricing type: usage_based_price (fixed + meters)
 * - payment_frequency: 1 Day · subscription_period: 1 Month
 * - 3 meters per tier: sessions, models, storage_bytes
 * - Rates from backend/lambda/atlas-api/lib/overage-estimate.mjs (1A+2B)
 * - Edits existing hybrid products when found by name / known IDs
 * - Does not commit secrets; reads DODO_PAYMENTS_API_KEY or DOdo_api.txt
 *
 * See docs/atlas-ar/DODO-OVERAGE-METERS.md
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const base = "https://test.dodopayments.com";

/** 50 MB × 2.5 headroom — mirrors upload-size-limits.storageBytesForModelCount */
function storageBytesForModelCount(models) {
  return Math.round(models * 50 * 1024 * 1024 * 2.5);
}

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
      t.match(/Test_mode API Key\s*=\s*(\S+)/i) ||
      t.match(/DODO_PAYMENTS_API_KEY\s*=\s*(\S+)/) ||
      t.match(/^(sk_test_[A-Za-z0-9_-]+)$/m) ||
      t.match(/^([A-Za-z0-9_-]{40,})$/m);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

const key = loadKey();
if (!key) {
  console.error("Missing DODO_PAYMENTS_API_KEY (env or D:/AI/atlas-webxr/DOdo_api.txt)");
  process.exit(1);
}

async function dodo(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "atlas-setup-dodo-meters/1.0",
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
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
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
    name: "Atlas storage bytes",
    event_name: "atlas.storage_bytes",
    aggregation: { type: "max", key: "storage_bytes" },
    measurement_unit: "bytes",
    description: "Peak workspace storage bytes",
  },
];

/** Known hybrid product IDs from prior seed (edit in place). */
const KNOWN_HYBRID_IDS = {
  starter: "pdt_0Njk5Xz9AdIoBNmgRoIEK",
  launch: "pdt_0Njk5QMJ8uCwSvseuHeo0",
  growth: "pdt_0Njk5Y261cDq9TWLto4dR",
};

/**
 * Free thresholds = Atlas BILLING_TIER_LIMITS.
 * price_per_unit = USD **major units** (dollars) per meter unit — Dodo bills this as currency,
 * not cents. Derived from overage-estimate.mjs pack rates:
 *   sessions: pack_$ / pack_sessions  (e.g. Launch $8 / 1000 = $0.008)
 *   models:   pack_$ / pack_models    (e.g. Launch $12 / 10 = $1.20)
 *   storage:  pack_$ / (pack_gb × 2^30 bytes)
 * Bug 2026-07-29: earlier values were 100× too high (cent-like numbers treated as dollars).
 */
const HYBRIDS = [
  {
    name: "Starter (usage hybrid)",
    tier: "starter",
    fixed: 500,
    sessionsFree: 500,
    sessionsPpu: 0.05, // $5 / 100 sessions
    modelsFree: 5,
    modelsPpu: 3, // $3 each
    storageFree: storageBytesForModelCount(5),
    storagePpu: Number((8 / (5 * 1024 ** 3)).toFixed(12)), // $8 / 5 GB
  },
  {
    name: "Launch usage hybrid",
    tier: "launch",
    fixed: 5900,
    sessionsFree: 3000,
    sessionsPpu: 0.008, // $8 / 1k sessions
    modelsFree: 30,
    modelsPpu: 1.2, // $12 / 10 models
    storageFree: storageBytesForModelCount(30),
    storagePpu: Number((6 / (10 * 1024 ** 3)).toFixed(12)), // $6 / 10 GB
  },
  {
    name: "Growth (usage hybrid)",
    tier: "growth",
    fixed: 17900,
    sessionsFree: 10000,
    sessionsPpu: 0.005, // $5 / 1k sessions
    modelsFree: 100,
    modelsPpu: 0.8, // $8 / 10 models
    storageFree: storageBytesForModelCount(100),
    storagePpu: Number((4 / (10 * 1024 ** 3)).toFixed(12)), // $4 / 10 GB
  },
];

const existingMeters = items(await dodo("GET", "/meters"));
const metersByEvent = Object.fromEntries(
  existingMeters.map((m) => [m.event_name, m]),
);
for (const def of METER_DEFS) {
  if (metersByEvent[def.event_name]) {
    console.log("meter ok", metersByEvent[def.event_name].id, def.event_name);
    continue;
  }
  const created = await dodo("POST", "/meters", def);
  metersByEvent[def.event_name] = created;
  console.log("created meter", created.id, def.event_name);
}

const sessionMeterId = metersByEvent["atlas.ar_session"].id;
const modelMeterId = metersByEvent["atlas.model_count"].id;
const storageMeterId = metersByEvent["atlas.storage_bytes"].id;

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
} else {
  console.log("addon ok", sessionPack.id);
}

const products = items(await dodo("GET", "/products?page_size=100"));
const out = {
  payment_frequency: "1 Day",
  subscription_period: "1 Month",
  meters: {
    sessions: sessionMeterId,
    models: modelMeterId,
    storage: storageMeterId,
  },
  addon: sessionPack.id || sessionPack.addon_id,
  hybrids: {},
  lambda_env: {},
};

for (const h of HYBRIDS) {
  let product =
    products.find((p) => p.product_id === KNOWN_HYBRID_IDS[h.tier]) ||
    products.find((p) => p.name === h.name);

  const price = {
    type: "usage_based_price",
    currency: "USD",
    fixed_price: h.fixed,
    tax_inclusive: true,
    discount: 0,
    purchasing_power_parity: false,
    payment_frequency_count: 1,
    payment_frequency_interval: "Day",
    subscription_period_count: 1,
    subscription_period_interval: "Month",
    meters: [
      {
        meter_id: sessionMeterId,
        free_threshold: h.sessionsFree,
        price_per_unit: h.sessionsPpu,
      },
      {
        meter_id: modelMeterId,
        free_threshold: h.modelsFree,
        price_per_unit: h.modelsPpu,
      },
      {
        meter_id: storageMeterId,
        free_threshold: h.storageFree,
        price_per_unit: h.storagePpu,
      },
    ],
  };

  if (!product) {
    product = await dodo("POST", "/products", {
      name: h.name,
      tax_category: "saas",
      metadata: {
        atlas_tier: h.tier,
        atlas_usage_hybrid: "true",
        atlas_billing: "day_month",
      },
      price,
    });
    console.log("created product", product.product_id, h.name);
  } else {
    const id = product.product_id;
    await dodo("PATCH", `/products/${id}`, {
      name: h.name,
      tax_category: "saas",
      metadata: {
        atlas_tier: h.tier,
        atlas_usage_hybrid: "true",
        atlas_billing: "day_month",
      },
      price,
    });
    console.log("updated product", id, h.name, "Day/Month + 3 meters");
    product = { ...product, product_id: id };
  }

  const pid = product.product_id || product.id;
  out.hybrids[h.tier] = pid;
  out.lambda_env[`DODO_PRODUCT_${h.tier.toUpperCase()}_USAGE`] = pid;
}

out.lambda_env.ATLAS_DODO_USAGE_HYBRID = "true";
out.lambda_env.ATLAS_DODO_USAGE_INGEST = "true";

const classicLaunch = products.find(
  (p) => p.product_id === "pdt_0NjSYfJ2iwd7x9Qyfydwv" || p.name === "Launch",
);
if (classicLaunch?.product_id && (sessionPack?.id || sessionPack?.addon_id)) {
  await dodo("PATCH", `/products/${classicLaunch.product_id}`, {
    addons: [sessionPack.id || sessionPack.addon_id],
  });
  console.log("attached addon to classic Launch", classicLaunch.product_id);
}

const summaryPath = resolve(root, "docs/atlas-ar/DODO-HYBRID-SETUP-RESULT.json");
writeFileSync(summaryPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log("wrote", summaryPath);
