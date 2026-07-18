#!/usr/bin/env node
/**
 * Batch AUD-2 — Live AWS / deploy verification (read-only).
 * Checks: platform routes, CORS, legacy /models/*, owner bundle, public-settings.
 *
 * Usage: node scripts/audit-aws-live.mjs
 * Env: ATLAS_API_URL, ATLAS_DEPLOY_URL
 */
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const ORIGIN =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d7vfdpujdozkj.amplifyapp.com";

const checks = [];

function record(id, title, status, detail = {}) {
  checks.push({ id, title, status, ...detail });
}

async function probe(path, method = "GET", opts = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(opts.headers ?? {}),
    },
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
    acam: res.headers.get("access-control-allow-methods"),
    body,
    text: text.slice(0, 200),
  };
}

// 1. Platform routes + CORS
const platform = await probe("/v2/platform/workspaces", "GET", {
  headers: { Authorization: "Bearer smoke-test" },
});
const gateway404 = platform.status === 404 && platform.body?.message === "Not Found";
const corsOk = Boolean(platform.acao) && platform.acao !== "";
const corsWildcard = platform.acao === "*";
record("AWS-01", "Platform API route reachable", gateway404 ? "FAIL" : "PASS", {
  httpStatus: platform.status,
  acao: platform.acao,
});
record("AWS-02", "CORS header present on platform route", corsOk ? "PASS" : "FAIL", {
  acao: platform.acao,
});
record("AWS-03", "CORS not wildcard (*)", corsWildcard ? "WARN" : "PASS", {
  acao: platform.acao,
  hint: corsWildcard ? "Set ATLAS_CORS_ORIGIN on Lambda to exact Amplify URL" : undefined,
});

// 2. Legacy models-api exposure
const legacyUpload = await probe("/models/upload", "POST", {
  headers: { "Content-Type": "application/json" },
});
const legacyGet = await probe("/models/manifest", "GET");
const legacyExposed =
  !legacyUpload.body?.message?.includes("Not Found") &&
  legacyUpload.status !== 404 &&
  legacyUpload.status !== 410 &&
  legacyUpload.status !== 501;
record("AWS-04", "Legacy /models/* not publicly writable", legacyExposed ? "FAIL" : "PASS", {
  uploadStatus: legacyUpload.status,
  manifestStatus: legacyGet.status,
  uploadBody: legacyUpload.body,
});

// 3. Health + public-settings
const health = await probe("/health");
record("AWS-05", "Lambda /health", health.status === 200 ? "PASS" : "WARN", {
  httpStatus: health.status,
});

const pub = await probe("/v2/platform/public-settings");
record("AWS-06", "Public settings route", pub.status === 200 ? "PASS" : "WARN", {
  httpStatus: pub.status,
});

// 4. Owner email in live FE bundle (VITE_PLATFORM_OWNER_EMAILS baked in)
let ownerEmailInBundle = false;
let bundleFile = null;
try {
  const home = await fetch(`${ORIGIN}/`).then((r) => r.text());
  const m = home.match(/src="(\/assets\/main-[^"]+\.js)"/) || home.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (m) {
    bundleFile = m[1];
    const js = await fetch(`${ORIGIN}${m[1]}`).then((r) => r.text());
    ownerEmailInBundle = js.includes("director@omnimanual.com") || js.includes("omnimanual.com");
  }
  record("AWS-07", "Live FE bundle fetch", bundleFile ? "PASS" : "WARN", { bundleFile });
  record("AWS-08", "Owner email visible in client bundle", ownerEmailInBundle ? "WARN" : "PASS", {
    note: "Expected for /owner UI gate — API must enforce ATLAS_PLATFORM_OWNER_EMAILS server-side",
  });
} catch (e) {
  record("AWS-07", "Live FE bundle fetch", "FAIL", { error: String(e) });
}

// 5. ATLAS_DEV_MODE — cannot read Lambda env remotely; infer from dev token acceptance
const devTokenProbe = await probe("/v2/me/workspaces", "GET", {
  headers: { Authorization: "Bearer dev:audit-probe-sub" },
});
const devAuthAccepted = devTokenProbe.status === 200;
record("AWS-09", "Dev Bearer token rejected on live API", devAuthAccepted ? "FAIL" : "PASS", {
  httpStatus: devTokenProbe.status,
  hint: devAuthAccepted
    ? "ATLAS_DEV_MODE likely true on production Lambda — disable immediately"
    : "Dev tokens rejected (good)",
});

// 6. Billing upgrade stub exposed
const billingProbe = await probe("/v2/workspaces/ws_fake/billing/upgrade", "POST", {
  headers: { Authorization: "Bearer dev:fake", "Content-Type": "application/json" },
  body: JSON.stringify({ targetTier: "growth" }),
});
const billingStubOpen =
  billingProbe.status === 200 &&
  (billingProbe.body?.ok === true || billingProbe.body?.workspace != null);
record("AWS-10", "Billing upgrade stub not openly granting tiers", billingStubOpen ? "FAIL" : "PASS", {
  httpStatus: billingProbe.status,
  body: billingProbe.body,
  note: "After AUD-2 deploy, expect 401/403/501 — not 200 with tier upgrade",
});

const failed = checks.filter((c) => c.status === "FAIL").length;
const warned = checks.filter((c) => c.status === "WARN").length;
const passed = checks.filter((c) => c.status === "PASS").length;

console.log(
  JSON.stringify(
    {
      audit: "AUD-2 AWS live checks",
      apiUrl: API,
      amplifyOrigin: ORIGIN,
      summary: { passed, warned, failed, total: checks.length },
      checks,
      manualRequired: [
        "Confirm ATLAS_DEV_MODE unset in Lambda console (AWS-09 infers only)",
        "Confirm ATLAS_PLATFORM_OWNER_EMAILS matches VITE_PLATFORM_OWNER_EMAILS in Amplify",
        "Confirm ATLAS_CORS_ORIGIN equals Amplify URL exactly",
      ],
    },
    null,
    2,
  ),
);

process.exit(failed > 0 ? 1 : 0);
