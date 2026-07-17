#!/usr/bin/env node
/**
 * Batch 35 — QA-5 prod gate (automated pre-flight + manual device runbook).
 * SAL-3 promise: sign-up → upload → floor placement ≤15 min (Android + iOS).
 *
 * Automated: prod reachability, auth routes, API, bundle markers.
 * Manual: run the printed checklist on a real phone and record times.
 *
 * Usage:
 *   npm run qa:5-prod
 *   ATLAS_DEPLOY_URL=https://main.d3t9wmef56h86w.amplifyapp.com npm run qa:5-prod
 */
const ORIGIN =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d3t9wmef56h86w.amplifyapp.com";
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";

/** @type {Array<{ id: string; title: string; status: "PASS" | "WARN" | "FAIL"; note?: string }>} */
const checks = [];

function record(id, title, status, note) {
  checks.push({ id, title, status, ...(note ? { note } : {}) });
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { Accept: "text/html" } });
  return { status: r.status, text: await r.text() };
}

// --- Automated pre-flight ---
try {
  const home = await fetchText(`${ORIGIN}/`);
  record("QA5-01", "Prod home loads", home.status === 200 ? "PASS" : "FAIL", `HTTP ${home.status}`);

  const bundleMatch =
    home.text.match(/src="(\/assets\/main-[^"]+\.js)"/) ||
    home.text.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const bundlePath = bundleMatch?.[1];
  record("QA5-02", "Prod JS bundle linked", bundlePath ? "PASS" : "FAIL");

  let js = "";
  if (bundlePath) {
    const bundle = await fetch(`${ORIGIN}${bundlePath}`);
    js = await bundle.text();
    record("QA5-03", "Prod bundle fetch", bundle.ok ? "PASS" : "FAIL");
  }

  const markers = [
    ["signup flow", js.includes("/signup") || js.includes("Create account")],
    ["onboard/workspace", js.includes("/onboard") || js.includes("workspace")],
    ["upload UI", js.includes("upload") || js.includes("Upload")],
    ["AR entry", js.includes("Start AR") || js.includes("View in AR")],
    ["get-started", js.includes("/admin/get-started") || js.includes("get-started")],
  ];
  for (const [name, ok] of markers) {
    record(`QA5-FE-${name.replace(/\s+/g, "-")}`, `Bundle: ${name}`, ok ? "PASS" : "WARN");
  }

  const health = await fetch(`${API}/health`);
  record("QA5-04", "API /health", health.status === 200 ? "PASS" : "FAIL", `HTTP ${health.status}`);

  const publicSettings = await fetch(`${API}/v2/platform/public-settings`);
  record(
    "QA5-05",
    "Public settings",
    publicSettings.status === 200 ? "PASS" : "WARN",
    `HTTP ${publicSettings.status}`,
  );

  for (const path of ["/login", "/signup", "/onboard"]) {
    const r = await fetch(`${ORIGIN}${path}`, { headers: { Accept: "text/html" } });
    const spaOk = r.status === 200 || (r.status === 404 && home.status === 200);
    record(`QA5-ROUTE-${path.slice(1)}`, `Route ${path}`, spaOk ? "PASS" : "WARN", `HTTP ${r.status}`);
  }
} catch (e) {
  record("QA5-00", "Pre-flight", "FAIL", e instanceof Error ? e.message : String(e));
}

const passed = checks.filter((c) => c.status === "PASS").length;
const warned = checks.filter((c) => c.status === "WARN").length;
const failed = checks.filter((c) => c.status === "FAIL").length;

const manualRunbook = {
  goal: "New user → first floor placement in ≤15 minutes on PROD",
  origin: ORIGIN,
  devices: ["Android Chrome (WebXR)", "iPhone Safari (Quick Look)"],
  steps: [
    { n: 1, action: "Open prod on phone (HTTPS)", url: ORIGIN },
    { n: 2, action: "Sign up with fresh email", url: `${ORIGIN}/signup`, startTimer: true },
    { n: 3, action: "Verify email if Cognito requires it" },
    { n: 4, action: "Create workspace (onboard) — pick name + slug" },
    { n: 5, action: "Upload one GLB (≤10 MB test model)" },
    { n: 6, action: "Open tenant catalog /w/{slug} on same phone" },
    {
      n: 7,
      action: "Android: Start AR → scan floor → place model. iOS: View in AR → place in Quick Look",
      stopTimer: true,
    },
    { n: 8, action: "PASS if timer ≤15:00; screenshot placement + note device model" },
  ],
  optional: [
    "Growth trial: confirm JSON session log toggle in owner dashboard + visible in AR",
    "At model cap: upload blocked with upgrade CTA",
    "Coupon FOUNDING10 → pricing banner on /pricing",
  ],
};

console.log(
  JSON.stringify(
    {
      audit: "Batch 35 — QA-5 prod gate",
      origin: ORIGIN,
      apiUrl: API,
      summary: { passed, warned, failed, total: checks.length },
      checks,
      manualRunbook,
      signOff: "Record results in backlog QA-5 row after both devices pass.",
    },
    null,
    2,
  ),
);

process.exit(failed > 0 ? 1 : 0);
