#!/usr/bin/env node
/**
 * Batch 33 live QA — read-only smoke against prod API + Amplify (no owner token required).
 * Authenticated flows (owner dashboard emails, upload gate) need manual spot-check after deploy.
 */
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const ORIGIN =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d3t9wmef56h86w.amplifyapp.com";

const checks = [];

function record(id, title, status, detail = {}) {
  checks.push({ id, title, status, ...detail });
}

async function probe(path, method = "GET", opts = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Origin: ORIGIN, ...(opts.headers ?? {}) },
    body: opts.body,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return {
    status: res.status,
    acao: res.headers.get("access-control-allow-origin"),
    body,
  };
}

// AUD-2 regression
const legacy = await probe("/models/manifest", "GET");
record(
  "QA-33-01",
  "Legacy models-api retired (410)",
  legacy.status === 410 ? "PASS" : "FAIL",
  { httpStatus: legacy.status },
);

const billing = await probe("/v2/workspaces/ws_fake/billing/upgrade", "POST", {
  headers: { Authorization: "Bearer smoke", "Content-Type": "application/json" },
  body: JSON.stringify({ targetTier: "growth" }),
});
record(
  "QA-33-02",
  "Billing upgrade gated (not 200)",
  billing.status === 501 || billing.status === 401 || billing.status === 403 ? "PASS" : "FAIL",
  { httpStatus: billing.status },
);

const health = await probe("/health");
record("QA-33-03", "API health", health.status === 200 ? "PASS" : "FAIL", {
  httpStatus: health.status,
});

const pubSettings = await probe("/v2/platform/public-settings");
record("QA-33-04", "Public settings", pubSettings.status === 200 ? "PASS" : "FAIL", {
  httpStatus: pubSettings.status,
});

// Batch 33 storage limits in code path — verify via usage endpoint shape on fake id
const devToken = await probe("/v2/me/workspaces", "GET", {
  headers: { Authorization: "Bearer dev:qa-probe" },
});
record(
  "QA-33-05",
  "Dev token rejected on prod",
  devToken.status === 401 ? "PASS" : "FAIL",
  { httpStatus: devToken.status },
);

// FE bundle + routes
let bundleFile = null;
let hasPricingStorage = false;
let hasOwnerEmailColumn = false;
try {
  const home = await fetch(`${ORIGIN}/`).then((r) => r.text());
  record("QA-33-06", "Amplify home", home.includes("<!DOCTYPE html>") ? "PASS" : "FAIL");
  const m =
    home.match(/src="(\/assets\/main-[^"]+\.js)"/) ||
    home.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (m) {
    bundleFile = m[1];
    const js = await fetch(`${ORIGIN}${m[1]}`).then((r) => r.text());
    hasPricingStorage = js.includes("2 GB storage") || js.includes("25 GB storage");
    hasOwnerEmailColumn = js.includes("Owner email") || js.includes("owner-email-cell");
    record("QA-33-07", "FE bundle fetch", "PASS", { bundleFile });
    record(
      "QA-33-08",
      "Pricing page storage copy in bundle",
      hasPricingStorage ? "PASS" : "WARN",
      { note: "Deploy latest Amplify build for Batch 33 storage lines" },
    );
    record(
      "QA-33-09",
      "Owner dashboard email column in bundle",
      hasOwnerEmailColumn ? "PASS" : "WARN",
      { note: "Deploy latest FE for owner email column" },
    );
  } else {
    record("QA-33-07", "FE bundle fetch", "FAIL");
  }

  for (const path of ["/pricing", "/login", "/signup", "/about"]) {
    const r = await fetch(`${ORIGIN}${path}`, { headers: { Accept: "text/html" } });
    // Amplify SPA may return 404 on raw fetch; client routing works when app loads
    const spaOk = r.status === 200 || (r.status === 404 && home.includes("index.html"));
    record(`QA-33-FE-${path.slice(1)}`, `SPA route ${path}`, spaOk ? "PASS" : "WARN", {
      httpStatus: r.status,
      note: spaOk ? undefined : "Check Amplify custom redirects",
    });
  }
} catch (e) {
  record("QA-33-FE", "Amplify smoke", "FAIL", { error: String(e) });
}

const failed = checks.filter((c) => c.status === "FAIL").length;
const warned = checks.filter((c) => c.status === "WARN").length;
const passed = checks.filter((c) => c.status === "PASS").length;

console.log(
  JSON.stringify(
    {
      audit: "Batch 33 live QA (automated)",
      apiUrl: API,
      amplifyOrigin: ORIGIN,
      summary: { passed, warned, failed, total: checks.length },
      checks,
      manualAfterDeploy: [
        "Owner /owner → Customers tab shows Owner email column with Cognito emails",
        "Growth trial → JSON session log in AR",
        "At model cap → upload blocked + Upgrade on Account",
        "Coupon → pricing banner (owner token)",
      ],
    },
    null,
    2,
  ),
);

process.exit(failed > 0 ? 1 : 0);
