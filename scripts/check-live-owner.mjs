#!/usr/bin/env node
/** Check live deploy for platform owner env and workspace public-config. */
const DEPLOY =
  process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") ||
  "https://main.d3t9wmef56h86w.amplifyapp.com";
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const SLUG = process.env.ATLAS_TEST_WORKSPACE_SLUG || "owner";

const home = await fetch(`${DEPLOY}/`).then((r) => r.text());
const scriptMatch = home.match(/src="(\/assets\/index-[^"]+\.js)"/);
const js = scriptMatch
  ? await fetch(`${DEPLOY}${scriptMatch[1]}`).then((r) => r.text())
  : "";

const config = await fetch(`${API}/v2/workspaces/${encodeURIComponent(SLUG)}/public-config`).then(
  (r) => r.json().catch(() => ({}))
);

console.log(JSON.stringify({
  deployUrl: DEPLOY,
  apiUrl: API,
  ownerEmailInLiveBundle: js.includes("director@omnimanual.com"),
  showroom: config?.slug ? { ...config, customerUrl: `${DEPLOY}/w/${config.slug}` } : config,
}, null, 2));
