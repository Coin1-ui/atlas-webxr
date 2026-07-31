#!/usr/bin/env node
/**
 * List today's Dodo payments and flag likely overage (total above plan fixed fee).
 * Read-only. Never prints full API keys.
 *
 * Usage:
 *   node scripts/investigate-dodo-overage-today.mjs
 *   DODO_PAYMENTS_ENV=live node scripts/investigate-dodo-overage-today.mjs
 *   DAY=2026-07-31 node scripts/investigate-dodo-overage-today.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadApiKey() {
  if (process.env.DODO_PAYMENTS_API_KEY?.trim()) return process.env.DODO_PAYMENTS_API_KEY.trim();
  for (const credPath of [
    join(__dirname, "../../../atlas-webxr/DOdo_api.txt"),
    "D:/AI/atlas-webxr/DOdo_api.txt",
  ]) {
    try {
      const text = readFileSync(credPath, "utf8");
      const envWant = (process.env.DODO_PAYMENTS_ENV || "test").toLowerCase();
      if (envWant === "live") {
        const live = text.match(/Live[_\s-]*mode API Key\s*=\s*(\S+)/i);
        if (live?.[1]) return live[1];
      }
      const match = text.match(/Test_mode API Key\s*=\s*(\S+)/);
      if (match?.[1]) return match[1];
    } catch {
      // next
    }
  }
  throw new Error("Set DODO_PAYMENTS_API_KEY or DOdo_api.txt");
}

function dodoBase() {
  const env = (process.env.DODO_PAYMENTS_ENV || "test").toLowerCase();
  return env === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

/** Plan fixed fees in USD major units (hybrid list). */
const FIXED_FEE_USD = {
  starter: 5,
  launch: 59,
  growth: 179,
};

const PRODUCT_TIER = {
  pdt_0Njk5Xz9AdIoBNmgRoIEK: "starter",
  pdt_0Njk5QMJ8uCwSvseuHeo0: "launch",
  pdt_0Njk5Y261cDq9TWLto4dR: "growth",
};

const key = loadApiKey();
const base = dodoBase();
const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function req(method, path) {
  const response = await fetch(`${base}${path}`, { method, headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { status: response.status, json };
}

function dayBoundsUtc(dayYmd) {
  const start = new Date(`${dayYmd}T00:00:00.000Z`);
  const end = new Date(`${dayYmd}T23:59:59.999Z`);
  return { start, end };
}

/** IST calendar day as UTC Y-M-D for filtering (IST = UTC+5:30). */
function todayIstYmd(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function paymentCreatedAt(p) {
  return p.created_at || p.createdAt || p.payment_date || p.settled_at || null;
}

function paymentAmountMajor(p) {
  // Prefer major if present; else minor/100
  if (typeof p.total_amount === "number" && p.total_amount > 1000 && !p.currency_amount) {
    // Heuristic: Dodo often uses minor units (cents)
  }
  const minor =
    p.total_amount ??
    p.amount ??
    p.settlement_amount ??
    p.captured_amount ??
    p.payment_amount ??
    null;
  if (typeof minor !== "number") return { major: null, raw: minor, unit: "unknown" };
  // If looks like dollars already (small) and currency USD, still treat as minor when integer cents typical
  const asMajor = minor / 100;
  return { major: asMajor, raw: minor, unit: "minor_cents_assumed" };
}

function pickProductId(p, sub) {
  return (
    p.product_id ||
    p.productId ||
    sub?.product_id ||
    p.subscription?.product_id ||
    (Array.isArray(p.product_cart) && p.product_cart[0]?.product_id) ||
    null
  );
}

/** Compare payment total_amount (minor) to subscription recurring_pre_tax_amount when available. */
function overageFlagFromPayment(totalMinor, fixedMinor, productId) {
  const tier = productId ? PRODUCT_TIER[productId] : null;
  if (typeof totalMinor !== "number") {
    return { likelyOverage: null, tier, fixedMinor: null, surplusMinor: null, reason: "unknown_amount" };
  }
  const fixed =
    typeof fixedMinor === "number"
      ? fixedMinor
      : tier
        ? Math.round(FIXED_FEE_USD[tier] * 100)
        : null;
  if (fixed == null) {
    return { likelyOverage: null, tier, fixedMinor: null, surplusMinor: null, reason: "unknown_fixed" };
  }
  const surplusMinor = totalMinor - fixed;
  return {
    likelyOverage: surplusMinor > 1,
    tier,
    fixedMinor: fixed,
    surplusMinor,
    surplusUsd: Math.round(surplusMinor) / 100,
    reason: surplusMinor > 1 ? "above_subscription_fixed" : "fixed_fee_only_or_under",
  };
}

async function listAllPayments() {
  const items = [];
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ page_size: "50" });
    if (cursor) qs.set("cursor", cursor);
    const { status, json } = await req("GET", `/payments?${qs}`);
    if (status >= 400) {
      throw new Error(`list payments HTTP ${status}: ${JSON.stringify(json).slice(0, 400)}`);
    }
    const batch = json?.items || json?.data || json?.payments || (Array.isArray(json) ? json : []);
    if (Array.isArray(batch)) items.push(...batch);
    cursor = json?.iterator || json?.next_cursor || json?.cursor || null;
    if (!cursor || !batch.length) break;
  }
  return items;
}

async function getCustomer(customerId) {
  if (!customerId) return null;
  const { status, json } = await req("GET", `/customers/${encodeURIComponent(customerId)}`);
  if (status >= 400) return { error: status, json };
  return json;
}

async function getSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  const { status, json } = await req("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (status >= 400) return null;
  return json;
}

async function getPayment(paymentId) {
  if (!paymentId) return null;
  const { status, json } = await req("GET", `/payments/${encodeURIComponent(paymentId)}`);
  if (status >= 400) return null;
  return json;
}

const dayYmd = process.env.DAY || todayIstYmd();
const { start, end } = dayBoundsUtc(dayYmd);

console.log(`Dodo host: ${base}`);
console.log(`Filter day (UTC calendar matching IST date label): ${dayYmd}`);
console.log(`Window UTC: ${start.toISOString()} .. ${end.toISOString()}`);

const all = await listAllPayments();
console.log(`Fetched payments (pages): ${all.length}`);

const today = [];
for (const p of all) {
  const created = paymentCreatedAt(p);
  if (!created) continue;
  const t = new Date(created);
  if (Number.isNaN(t.getTime())) continue;
  // Include if IST calendar day matches dayYmd
  const istDay = new Date(t.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (istDay === dayYmd) today.push(p);
}

console.log(`Payments on IST day ${dayYmd}: ${today.length}`);

const rows = [];
for (const p0 of today) {
  const paymentId = p0.payment_id || p0.id || null;
  const detail = (paymentId ? await getPayment(paymentId) : null) || p0;
  const customerId =
    detail.customer_id || detail.customer?.customer_id || detail.customer?.id || null;
  const subscriptionId =
    detail.subscription_id ||
    detail.subscription?.subscription_id ||
    detail.subscription?.id ||
    null;
  const sub = await getSubscription(subscriptionId);
  const productId = pickProductId(detail, sub);
  const totalMinor =
    typeof detail.total_amount === "number" ? detail.total_amount : paymentAmountMajor(detail).raw;
  const fixedMinor =
    typeof sub?.recurring_pre_tax_amount === "number" ? sub.recurring_pre_tax_amount : null;
  const flag = overageFlagFromPayment(totalMinor, fixedMinor, productId);
  const storageMeter = (sub?.meters || []).find((m) => /storage/i.test(String(m.name || "")));
  let customer = null;
  if (customerId) {
    customer = await getCustomer(customerId);
  }
  const email =
    customer?.email ||
    customer?.customer?.email ||
    customer?.billing_email ||
    null;
  const name = customer?.name || customer?.customer?.name || null;
  const row = {
    paymentId,
    customerId,
    subscriptionId,
    productId,
    status: detail.status || null,
    currency: detail.currency || null,
    amountMinorRaw: totalMinor,
    amountMajor: typeof totalMinor === "number" ? totalMinor / 100 : null,
    createdAt: paymentCreatedAt(detail),
    metadata: detail.metadata || null,
    storageFreeThreshold: storageMeter?.free_threshold ?? null,
    ...flag,
    customerEmail: email,
    customerName: name,
  };
  rows.push(row);
  console.log(
    [
      flag.likelyOverage ? "OVERAGE?" : "ok",
      paymentId,
      `${detail.currency || "?"} ${(typeof totalMinor === "number" ? totalMinor / 100 : "?")}`,
      `tier=${flag.tier || "?"}`,
      `surplus=${flag.surplusUsd ?? flag.surplusMinor}`,
      email || customerId,
      subscriptionId,
      storageMeter?.free_threshold < 0 ? "NEG_STORAGE_THRESH" : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

const overage = rows.filter((r) => r.likelyOverage === true);
const outPath = join(__dirname, `../docs/atlas-ar/_tmp-dodo-payments-${dayYmd}.json`);
writeFileSync(
  outPath,
  JSON.stringify(
    {
      dayYmdIst: dayYmd,
      host: base,
      paymentCount: rows.length,
      overageCandidateCount: overage.length,
      payments: rows,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`Wrote ${outPath}`);
console.log(`Overage candidates: ${overage.length}`);
