#!/usr/bin/env node
/**
 * AUD-2 — Fail Amplify/production builds when Cognito env is missing.
 * Local `npm run dev` skips this gate (no VITE_COGNITO_USER_POOL_ID required).
 *
 * Usage: node scripts/verify-production-env.mjs
 * Set SKIP_PRODUCTION_ENV_CHECK=1 to bypass (emergency only).
 */
const skip = process.env.SKIP_PRODUCTION_ENV_CHECK === "1";
const isCiBuild =
  process.env.AWS_APP_ID != null ||
  process.env.AMPLIFY_CI === "true" ||
  process.env.CI === "true" ||
  process.argv.includes("--production");

if (skip || !isCiBuild) {
  console.log(
    JSON.stringify({
      ok: true,
      skipped: true,
      reason: skip ? "SKIP_PRODUCTION_ENV_CHECK=1" : "not a production/CI build",
    }),
  );
  process.exit(0);
}

const required = [
  "VITE_ATLAS_API_URL",
  "VITE_COGNITO_USER_POOL_ID",
  "VITE_COGNITO_CLIENT_ID",
  "VITE_COGNITO_REGION",
];

const missing = required.filter((k) => !String(process.env[k] ?? "").trim());
if (missing.length) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Missing required production env vars for Amplify build",
      missing,
      hint: "Set these in Amplify Environment variables. See docs/atlas-ar/AMPLIFY-ENV-CHECKLIST.md",
    }),
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: required }));
