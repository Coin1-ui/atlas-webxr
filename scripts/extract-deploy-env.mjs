#!/usr/bin/env node
/** Extract VITE_* values baked into the live Amplify bundle (read-only). */
const DEPLOY =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d7vfdpujdozkj.amplifyapp.com";

const home = await fetch(`${DEPLOY}/`).then((r) => r.text());
const scriptMatch = home.match(/src="(\/assets\/index-[^"]+\.js)"/);
if (!scriptMatch) {
  console.error("Could not find main bundle in index.html");
  process.exit(1);
}

const js = await fetch(`${DEPLOY}${scriptMatch[1]}`).then((r) => r.text());

const apiMatch = js.match(/https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com/);
const poolMatch = js.match(/ap-[a-z0-9-]+_[A-Za-z0-9]+/);
const regionMatch = poolMatch?.[0]?.match(/^(ap-[a-z0-9-]+)_/)?.[1];

// Client id often appears near UserPoolId in minified bundle
let clientId = null;
if (poolMatch) {
  const windowStart = Math.max(0, js.indexOf(poolMatch[0]) - 200);
  const windowEnd = Math.min(js.length, js.indexOf(poolMatch[0]) + 400);
  const slice = js.slice(windowStart, windowEnd);
  const clientCandidates = [...slice.matchAll(/"([a-z0-9]{26})"/g)].map((m) => m[1]);
  clientId = clientCandidates.find((id) => id !== poolMatch[0].replace(/^ap-[a-z0-9-]+_/, "")) ?? clientCandidates[0] ?? null;
}

console.log(JSON.stringify({
  deployUrl: DEPLOY,
  VITE_ATLAS_API_URL: apiMatch?.[0] ?? null,
  VITE_COGNITO_REGION: regionMatch ?? null,
  VITE_COGNITO_USER_POOL_ID: poolMatch?.[0] ?? null,
  VITE_COGNITO_CLIENT_ID: clientId,
}, null, 2));
