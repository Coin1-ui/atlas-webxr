#!/usr/bin/env node
/**
 * Diagnose Owner dashboard API — platform routes must reach atlas-api Lambda.
 *
 * Browser "Failed to fetch" on /owner usually means:
 *   GET /v2/platform/workspaces returns API Gateway 404 without CORS headers.
 */
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const ORIGIN =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d7vfdpujdozkj.amplifyapp.com";

async function probe(path, method = "GET") {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Origin: ORIGIN, Authorization: "Bearer smoke-test" },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  const acao = res.headers.get("access-control-allow-origin");
  const gateway404 = res.status === 404 && body?.message === "Not Found";
  const lambda404 = res.status === 404 && body?.error === "Not found";
  return { path, method, status: res.status, acao, gateway404, lambda404, body };
}

const paths = [
  ["/health", "GET"],
  ["/v2/me/workspaces", "GET"],
  ["/v2/platform/workspaces", "GET"],
  ["/v2/platform/coupons", "GET"],
  ["/v2/platform/public-settings", "GET"],
  ["/v2/platform/settings", "GET"],
];

const results = [];
for (const [path, method] of paths) {
  results.push(await probe(path, method));
}

const platform = results.find((r) => r.path === "/v2/platform/workspaces");
const ok =
  platform &&
  !platform.gateway404 &&
  platform.acao &&
  (platform.status === 401 || platform.status === 403 || platform.status === 200);

console.log(
  JSON.stringify(
    {
      apiUrl: API,
      amplifyOrigin: ORIGIN,
      ownerDashboardReady: ok,
      hint: platform?.gateway404
        ? "API Gateway has no route to Lambda for /v2/platform/* — add routes and redeploy atlas-api Lambda."
        : !platform?.acao
          ? "CORS missing on platform response — fix API Gateway CORS (Amplify origin, no trailing slash)."
          : ok
            ? "Platform API reachable from browser (auth/403 expected without real token)."
            : "Unexpected platform response — check Lambda logs.",
      results,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
