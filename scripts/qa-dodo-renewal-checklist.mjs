#!/usr/bin/env node
/**
 * Live readiness / post-renewal snapshot for Dodo + Atlas billing.
 *
 * Env:
 *   DODO_PAYMENTS_API_KEY (required for Dodo calls)
 *   DODO_SUBSCRIPTION_ID (optional; otherwise uses first active from list)
 *   ATLAS_API_BASE (default prod API)
 *   ATLAS_JWT (optional; enables Atlas billing/status check)
 *   ATLAS_WORKSPACE_ID (default BILL-1 sandbox workspace)
 *
 * Flags:
 *   --expect-renewed  Fail if no payment newer than previous snapshot hint / period not advanced
 *   --json            Machine-readable output
 *
 * See docs/atlas-ar/BILLING-RENEWAL-TEST-PLAN.md
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const expectRenewed = process.argv.includes("--expect-renewed");
const asJson = process.argv.includes("--json");

function loadKey() {
  if (process.env.DODO_PAYMENTS_API_KEY) return process.env.DODO_PAYMENTS_API_KEY.trim();
  const candidates = [
    resolve("D:/AI/atlas-webxr/DOdo_api.txt"),
    resolve(root, "../DOdo_api.txt"),
    resolve(root, "../../DOdo_api.txt"),
    resolve(root, "DOdo_api.txt"),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const text = readFileSync(f, "utf8");
    const m =
      text.match(/Test_mode API Key\s*=\s*(\S+)/) ||
      text.match(/DODO_PAYMENTS_API_KEY\s*=\s*(\S+)/);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

const apiKey = loadKey();
const base = "https://test.dodopayments.com";
const atlasBase =
  process.env.ATLAS_API_BASE || "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const workspaceId =
  process.env.ATLAS_WORKSPACE_ID || "1ee2cb65-6252-4679-ab53-84ea36b2518f";

async function dodo(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`Dodo ${res.status} ${path}: ${text.slice(0, 400)}`);
  return body;
}

async function atlasStatus(jwt) {
  const res = await fetch(`${atlasBase}/v2/workspaces/${workspaceId}/billing/status`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { statusCode: res.status, body };
}

function pickItems(list) {
  return Array.isArray(list) ? list : list?.items || list?.data || [];
}

const out = {
  trackReminder: {
    A: "npm run test:billing-state && npm run test:billing-providers",
    B: "Natural next_billing_date wait — clock advance expires without charge in this sandbox",
    C: "Immediate change-plan for same-day upgrade charge only",
    doc: "docs/atlas-ar/BILLING-RENEWAL-TEST-PLAN.md",
  },
  dodo: null,
  atlas: null,
  verdict: null,
};

if (!apiKey) {
  console.error("Missing DODO_PAYMENTS_API_KEY");
  process.exit(1);
}

let subId = process.env.DODO_SUBSCRIPTION_ID || "";
if (!subId) {
  const list = await dodo("/subscriptions?page_size=50");
  const items = pickItems(list);
  const active = items.find((s) => s.status === "active") || items[0];
  if (!active) {
    console.error("No subscriptions found");
    process.exit(1);
  }
  subId = active.subscription_id;
}

const sub = await dodo(`/subscriptions/${subId}`);
const payments = await dodo(`/payments?page_size=20`);
const payItems = pickItems(payments).filter(
  (p) =>
    p.subscription_id === subId ||
    p.subscription?.subscription_id === subId ||
    !p.subscription_id
);
const related = pickItems(payments).filter((p) => {
  const sid = p.subscription_id || p.subscription?.subscription_id;
  return sid === subId;
});

const nbd = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
const now = new Date();
const msToNbd = nbd ? nbd.getTime() - now.getTime() : null;

out.dodo = {
  subscription_id: sub.subscription_id,
  status: sub.status,
  product_id: sub.product_id,
  cancel_at_next_billing_date: sub.cancel_at_next_billing_date,
  next_billing_date: sub.next_billing_date,
  ms_until_nbd: msToNbd,
  hours_until_nbd: msToNbd != null ? Math.round(msToNbd / 36e5 * 10) / 10 : null,
  payment_count_on_sub: related.length,
  latest_payments: related.slice(0, 5).map((p) => ({
    payment_id: p.payment_id,
    status: p.status,
    total_amount: p.total_amount ?? p.amount,
    created_at: p.created_at,
  })),
  scenario1_ready:
    sub.status === "active" &&
    sub.cancel_at_next_billing_date !== true &&
    Boolean(sub.next_billing_date),
  scenario2_note:
    "Schedule plan change via Atlas POST .../billing/plan, then wait for natural NBD (do not clock-advance).",
};

if (process.env.ATLAS_JWT) {
  out.atlas = await atlasStatus(process.env.ATLAS_JWT.trim());
}

const activeOk = out.dodo.status === "active";
const periodInFuture = msToNbd != null && msToNbd > 0;
const renewedLikely =
  activeOk &&
  related.length >= 2 &&
  (!periodInFuture || (msToNbd != null && msToNbd > 20 * 60 * 1000));

if (expectRenewed) {
  if (!activeOk) {
    out.verdict = "FAIL: subscription not active after expected renewal";
  } else if (related.length < 1) {
    out.verdict = "FAIL: no payments on subscription";
  } else if (periodInFuture && msToNbd < 60_000) {
    out.verdict =
      "INCONCLUSIVE: next_billing_date still imminent — wait longer or confirm payment list in Dashboard";
  } else {
    out.verdict = renewedLikely
      ? "PASS-ish: active with payment history; confirm new payment_id vs pre-renewal snapshot manually"
      : "CHECK: still active — compare payment_ids and next_billing_date to your pre-wait notes";
  }
} else {
  out.verdict = out.dodo.scenario1_ready
    ? periodInFuture
      ? `READY for scenario 1 wait (~${out.dodo.hours_until_nbd}h until NBD). Do not clock-advance.`
      : "NBD in the past or missing — inspect Dashboard; may already have renewed or expired"
    : `NOT READY: status=${out.dodo.status} cancel_at_nbd=${out.dodo.cancel_at_next_billing_date}`;
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log("=== Dodo renewal checklist ===");
  console.log(JSON.stringify(out.dodo, null, 2));
  if (out.atlas) {
    console.log("\n=== Atlas billing/status ===");
    console.log(JSON.stringify(out.atlas, null, 2));
  }
  console.log("\n=== Tracks ===");
  console.log(JSON.stringify(out.trackReminder, null, 2));
  console.log("\nVerdict:", out.verdict);
}

if (expectRenewed && out.verdict.startsWith("FAIL")) process.exit(2);
