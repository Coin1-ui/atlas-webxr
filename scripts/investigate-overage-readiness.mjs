#!/usr/bin/env node
/**
 * Investigate overage readiness: Dodo on_demand + Atlas workspace mapping.
 * Does not charge. Uses DOdo_api.txt / DODO_PAYMENTS_API_KEY.
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
if (!key) {
  console.error("Missing DODO_PAYMENTS_API_KEY");
  process.exit(1);
}

const base = "https://test.dodopayments.com";
const atlas = "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";

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
  if (!res.ok) throw new Error(`Dodo ${res.status} ${path}: ${text.slice(0, 300)}`);
  return body;
}

function items(list) {
  return Array.isArray(list) ? list : list?.items || list?.data || [];
}

const health = await (await fetch(`${atlas}/health`)).json();
const list = await dodo("/subscriptions?page_size=50");
const subs = items(list);

const focus = [
  "sub_0NjiQjjpak1hPG4CzTs7h", // contact active
  "sub_0Njf5rgrGbzHmpClzzG0B", // aryan expired
];

const rows = [];
for (const id of focus) {
  const s = await dodo(`/subscriptions/${id}`);
  rows.push({
    id: s.subscription_id,
    status: s.status,
    email: s.customer?.email,
    product_id: s.product_id,
    amount: s.recurring_pre_tax_amount,
    freq: s.payment_frequency_interval,
    on_demand: s.on_demand,
    payment_method_id: s.payment_method_id || null,
    cancel_at_nbd: s.cancel_at_next_billing_date,
    nbd: s.next_billing_date,
    meta: s.metadata || {},
  });
}

const active = subs.filter((s) => s.status === "active");
const activeSummary = [];
for (const s of active.slice(0, 15)) {
  const full = s.on_demand !== undefined ? s : await dodo(`/subscriptions/${s.subscription_id}`);
  activeSummary.push({
    id: full.subscription_id,
    email: full.customer?.email,
    status: full.status,
    on_demand: full.on_demand,
    freq: full.payment_frequency_interval,
    amount: full.recurring_pre_tax_amount,
    pm: Boolean(full.payment_method_id),
    nbd: full.next_billing_date,
  });
}

// payments that look like overage (metadata or small mid-cycle)
const pays = items(await dodo("/payments?page_size=50"));
const overageish = pays
  .filter((p) => {
    const meta = p.metadata || {};
    return (
      meta.atlas_overage_month ||
      meta.atlas_billing_operation_id ||
      (p.total_amount && p.total_amount < 5000 && p.subscription_id)
    );
  })
  .slice(0, 12)
  .map((p) => ({
    id: p.payment_id,
    status: p.status,
    amt: p.total_amount,
    sub: p.subscription_id,
    at: p.created_at,
    meta: p.metadata || {},
    card: p.card_last_four,
  }));

console.log(
  JSON.stringify(
    {
      atlasHealth: health,
      focusSubs: rows,
      activeSubsOnDemand: activeSummary,
      activeCount: active.length,
      onDemandTrue: activeSummary.filter((s) => s.on_demand === true).length,
      onDemandFalse: activeSummary.filter((s) => s.on_demand === false).length,
      recentOverageishPayments: overageish,
      requirementsForCardOverage: {
        atlas: "workspace billingStatus active|past_due, isOverageBillable, usage over limits",
        dodo: "subscription on_demand capable + saved PM; POST /subscriptions/{id}/charge",
        seed: "ATLAS_SANDBOX_USAGE_SEED=true + Seed overage OR real sessions > plan",
      },
    },
    null,
    2
  )
);
