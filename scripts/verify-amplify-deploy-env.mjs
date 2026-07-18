#!/usr/bin/env node
/**
 * ENG-19 — Verify a deployed Amplify build has SaaS env vars baked in.
 *
 * Env:
 *   ATLAS_DEPLOY_URL — default https://main.d7vfdpujdozkj.amplifyapp.com
 *   ATLAS_API_URL    — optional; defaults to rusf3nnyu7 prod API
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEPLOY =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d7vfdpujdozkj.amplifyapp.com";
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";

const dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(dir, "..", "test-results");
mkdirSync(outDir, { recursive: true });

const results = [];

function record(id, title, ok, detail = {}) {
  results.push({ id, title, status: ok ? "passed" : "failed", ...detail });
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  return { status: res.status, text };
}

try {
  const home = await fetchText(`${DEPLOY}/`);
  record("deploy-home", `GET ${DEPLOY}/`, home.status === 200, { status: home.status });

  const scriptSrcs = [...home.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  // Vite names the entry chunk `main-*.js` (multi-input rollup config) or `index-*.js`
  // depending on build config — match either, then fall back to any /assets/*.js module.
  const moduleSrc =
    scriptSrcs.find((s) => /\/assets\/(main|index)-[\w-]+\.js$/.test(s)) ||
    scriptSrcs.find((s) => s.includes("/assets/") && s.endsWith(".js"));
  if (!moduleSrc) {
    record("deploy-bundle", "Locate main JS bundle in index.html", false);
  } else {
    const bundleUrl = moduleSrc.startsWith("http") ? moduleSrc : `${DEPLOY}${moduleSrc.startsWith("/") ? "" : "/"}${moduleSrc}`;
    const bundle = await fetchText(bundleUrl);
    const hasApiUrl = bundle.text.includes("execute-api") || bundle.text.includes(API.replace("https://", ""));
    const hasCognito =
      /ap-[a-z0-9-]+_[A-Za-z0-9]+/.test(bundle.text) ||
      bundle.text.includes("VITE_COGNITO_USER_POOL_ID") ||
      bundle.text.includes("cognito-idp");
    record("deploy-api-url", "Bundle references API Gateway URL", hasApiUrl);
    record("deploy-cognito", "Bundle includes Cognito configuration", hasCognito, {
      hint: hasCognito ? undefined : "Redeploy after setting VITE_COGNITO_* on Amplify",
    });
  }

  const healthRes = await fetch(`${API}/health`, { signal: AbortSignal.timeout(15000) });
  const healthBody = await healthRes.json().catch(() => ({}));
  record(
    "api-health",
    "GET /health on configured API",
    healthRes.status === 200 && healthBody?.ok === true,
    { status: healthRes.status, body: healthBody }
  );
} catch (e) {
  record("verify-fatal", "Amplify env verification harness", false, {
    error: e instanceof Error ? e.message : String(e),
  });
}

const failed = results.filter((r) => r.status === "failed").length;
const report = {
  meta: { deployUrl: DEPLOY, apiUrl: API, at: new Date().toISOString() },
  summary: { passed: results.length - failed, failed },
  tests: results,
};

const outPath = join(outDir, "amplify-env-verify.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${outPath}`);
process.exit(failed ? 1 : 0);
