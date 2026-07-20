#!/usr/bin/env node
/**
 * BILL-1 sandbox verification checklist (no secrets).
 * Anonymous API probes + Amplify bundle marker checks + local policy unit gate.
 *
 * Optional auth (for status/plan/cancel with JWT):
 *   $env:ATLAS_TEST_ID_TOKEN = "eyJ..."
 *   $env:ATLAS_TEST_WORKSPACE_ID = "1ee2cb65-..."
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = process.env.ATLAS_API_BASE || "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const AMP = process.env.ATLAS_DEPLOY_URL || "https://main.d7vfdpujdozkj.amplifyapp.com";
const WS =
  process.env.ATLAS_TEST_WORKSPACE_ID || "1ee2cb65-6252-4679-ab53-84ea36b2518f";
const TOKEN = process.env.ATLAS_TEST_ID_TOKEN || "";
const EXPECTED_COMMIT = process.env.ATLAS_EXPECTED_COMMIT || "d109b05";

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`PASS  ${id} — ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`FAIL  ${id} — ${detail}`);
}
function skip(id, detail) {
  results.push({ id, ok: null, detail });
  console.log(`SKIP  ${id} — ${detail}`);
}

async function http(url, { method = "GET", body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { status: res.status, text, json };
}

async function checkAmplifyBundle() {
  const home = await http(`${AMP}/`);
  if (home.status !== 200) {
    fail("amplify.home", `HTTP ${home.status}`);
    return;
  }
  pass("amplify.home", `HTTP 200`);

  const m = home.text.match(/\/assets\/main-[A-Za-z0-9_-]+\.js/);
  if (!m) {
    fail("amplify.bundle", "main-*.js not found in index.html");
    return;
  }
  const bundlePath = m[0];
  const js = await http(`${AMP}${bundlePath}`);
  if (js.status !== 200) {
    fail("amplify.bundle", `HTTP ${js.status} for ${bundlePath}`);
    return;
  }
  pass("amplify.bundle", bundlePath);

  const markers = [
    ["ui.countryRequiredLabel", "Billing country (required)"],
    ["ui.countrySelect", "Select country"],
    ["ui.nextBillingCopy", "scheduled for your next billing date"],
    ["ui.cancelScheduledHint", "Cancellation is scheduled"],
    ["ui.issueRefund", "Issue refund"],
    ["ui.countryGateError", "Select a billing country from the list before continuing"],
  ];
  for (const [id, needle] of markers) {
    if (js.text.includes(needle)) pass(id, needle);
    else fail(id, `missing marker: ${needle}`);
  }

  if (/<select[^>]*name=["']billingCountry["']/.test(js.text)) {
    pass("ui.countryDropdown", "billingCountry is a select element");
  } else {
    fail("ui.countryDropdown", "billingCountry select not found in bundle");
  }

  // Old default must not pre-fill country for subscribers
  const hasOldDefault =
    /name=["']billingCountry["'][^>]*value=["']US["']/.test(js.text) ||
    /value=["']US["'][^>]*name=["']billingCountry["']/.test(js.text);
  if (hasOldDefault) fail("ui.noUsDefault", "billingCountry still defaults to US");
  else pass("ui.noUsDefault", "no billingCountry value=US default found");

  // Commit fingerprint is not embedded; note expected Amplify commit for operator
  skip(
    "amplify.commit",
    `Confirm Amplify build for ${EXPECTED_COMMIT} is SUCCEED (not embedded in SPA)`,
  );
}

async function checkAnonymousApi() {
  const cases = [
    ["api.status.401", "GET", `/v2/workspaces/${WS}/billing/status`, undefined, 401],
    ["api.portal.401", "POST", `/v2/workspaces/${WS}/billing/portal`, { billingCountry: "US" }, 401],
    ["api.plan.401", "POST", `/v2/workspaces/${WS}/billing/plan`, { tier: "growth", billingCountry: "US" }, 401],
    ["api.cancel.401", "POST", `/v2/workspaces/${WS}/billing/cancel`, {}, 401],
    ["api.checkout.401", "POST", `/v2/workspaces/${WS}/billing/checkout`, { tier: "starter", billingCountry: "US", email: "qa@example.com" }, 401],
    ["api.dodoWebhook.unsigned", "POST", `/v2/billing/webhooks/dodo`, { type: "ping" }, 400],
  ];

  for (const [id, method, path, body, expect] of cases) {
    const res = await http(`${API}${path}`, { method, body });
    if (res.status === expect) pass(id, `HTTP ${res.status}`);
    else fail(id, `expected ${expect}, got ${res.status}: ${res.text.slice(0, 160)}`);
  }

  // Zoho webhook: 503 disabled, 400 bad signature, or 404 route not mounted yet — all fail-closed (no accept)
  const zoho = await http(`${API}/v2/billing/webhooks/zoho`, {
    method: "POST",
    body: { type: "ping" },
  });
  if (zoho.status === 503 || zoho.status === 400 || zoho.status === 404) {
    pass(
      "api.zohoWebhook.failClosed",
      `HTTP ${zoho.status}${zoho.status === 404 ? " (route not mounted — Zoho India still pending)" : ""}`,
    );
  } else if (zoho.status >= 200 && zoho.status < 300) {
    fail("api.zohoWebhook.failClosed", `unexpected accept HTTP ${zoho.status}`);
  } else {
    fail("api.zohoWebhook.failClosed", `unexpected HTTP ${zoho.status}`);
  }

  const health = await http(`${API}/health`);
  if (health.status === 200) pass("api.health", "HTTP 200");
  else fail("api.health", `HTTP ${health.status}`);
}

async function checkAuthenticatedApi() {
  if (!TOKEN) {
    skip("auth.status", "Set ATLAS_TEST_ID_TOKEN to run authenticated checks");
    skip("auth.plan.noCountry", "needs token");
    skip("auth.portal.noCountry", "needs token");
    skip("auth.cancel.projection", "needs token + user confirmation (mutates subscription)");
    return;
  }
  const auth = { Authorization: `Bearer ${TOKEN}` };

  const status = await http(`${API}/v2/workspaces/${WS}/billing/status`, {
    headers: auth,
  });
  if (status.status === 200 && status.json) {
    const sub = status.json.subscription;
    pass(
      "auth.status",
      `entitlement=${status.json.entitlementTier} status=${sub?.status} cancelAtPeriodEnd=${sub?.cancelAtPeriodEnd} tier=${sub?.tier}`,
    );
  } else {
    fail("auth.status", `HTTP ${status.status}: ${status.text.slice(0, 200)}`);
  }

  // Country gate on plan (must 400 without country) — proves new Lambda if deployed
  const planNoCountry = await http(`${API}/v2/workspaces/${WS}/billing/plan`, {
    method: "POST",
    headers: auth,
    body: { tier: "growth" },
  });
  if (planNoCountry.status === 400 && /billingCountry/i.test(planNoCountry.text)) {
    pass("auth.plan.noCountry", `HTTP 400 country required (${planNoCountry.text.slice(0, 120)})`);
  } else if (planNoCountry.status === 401) {
    fail("auth.plan.noCountry", "token rejected (401)");
  } else {
    fail(
      "auth.plan.noCountry",
      `expected 400 billingCountry, got ${planNoCountry.status}: ${planNoCountry.text.slice(0, 200)} — Lambda ZIP may not be uploaded yet`,
    );
  }

  const portalNoCountry = await http(`${API}/v2/workspaces/${WS}/billing/portal`, {
    method: "POST",
    headers: auth,
    body: {},
  });
  if (portalNoCountry.status === 400 && /billingCountry/i.test(portalNoCountry.text)) {
    pass("auth.portal.noCountry", "HTTP 400 country required");
  } else {
    fail(
      "auth.portal.noCountry",
      `expected 400 billingCountry, got ${portalNoCountry.status}: ${portalNoCountry.text.slice(0, 200)}`,
    );
  }

  skip(
    "auth.cancel.projection",
    "Mutating cancel skipped in automated checklist — run manually after Lambda deploy",
  );
  skip(
    "auth.plan.renewalOnly",
    "Mutating plan change skipped — confirm Dodo shows next_billing_date / no immediate charge",
  );
}

function checkLocalPolicy() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  for (const name of ["test-billing-policy-unit.mjs", "test-upgrade-options-growth-trial.mjs"]) {
    const script = path.join(root, name);
    const r = spawnSync(process.execPath, [script], { encoding: "utf8" });
    const id = name.includes("upgrade") ? "unit.upgradeOptionsGrowthTrial" : "unit.billingPolicy";
    if (r.status === 0) pass(id, (r.stdout || "").trim().split("\n").pop());
    else fail(id, (r.stderr || r.stdout || "failed").slice(0, 300));
  }
}

const summary = {
  startedAt: new Date().toISOString(),
  api: API,
  amplify: AMP,
  workspaceId: WS,
  authenticated: Boolean(TOKEN),
};

console.log("=== BILL-1 sandbox verification checklist ===");
console.log(JSON.stringify(summary, null, 2));
console.log("");

checkLocalPolicy();
await checkAmplifyBundle();
await checkAnonymousApi();
await checkAuthenticatedApi();

const failed = results.filter((r) => r.ok === false);
const passed = results.filter((r) => r.ok === true);
const skipped = results.filter((r) => r.ok === null);

console.log("\n=== Summary ===");
console.log(`PASS ${passed.length}  FAIL ${failed.length}  SKIP ${skipped.length}`);
if (failed.length) {
  console.log("\nFailed:");
  for (const f of failed) console.log(` - ${f.id}: ${f.detail}`);
}
console.log(
  "\nManual remaining: Amplify commit green · Lambda ZIP upload · Growth trial upgrade card · cancel UI refresh · no immediate upgrade charge",
);
process.exit(failed.length ? 1 : 0);
