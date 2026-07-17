#!/usr/bin/env node
/**
 * Authenticated check: platform workspaces ownerEmails + Lambda email lookup meta.
 *
 * Usage:
 *   $env:ATLAS_TEST_ID_TOKEN = "<owner id token>"
 *   npm run check:owner-emails-api
 */
const API =
  process.env.ATLAS_API_URL?.replace(/\/$/, "") ||
  "https://rusf3nnyu7.execute-api.ap-south-1.amazonaws.com";
const token = process.env.ATLAS_TEST_ID_TOKEN?.trim();

if (!token) {
  console.error("Set ATLAS_TEST_ID_TOKEN (platform owner Cognito ID token).");
  console.error("Tip: npm run get:id-token -- you@company.com");
  process.exit(1);
}

const res = await fetch(`${API}/v2/platform/workspaces`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
});
const text = await res.text();
let json = {};
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

const workspaces = json.workspaces ?? [];
const withEmails = workspaces.filter((w) => (w.ownerEmails ?? []).length > 0);
const missing = workspaces.filter((w) => !(w.ownerEmails ?? []).length);

console.log(
  JSON.stringify(
    {
      httpStatus: res.status,
      meta: json.meta ?? null,
      total: workspaces.length,
      withOwnerEmails: withEmails.length,
      missingOwnerEmails: missing.length,
      samples: workspaces.slice(0, 5).map((w) => ({
        slug: w.slug,
        ownerEmails: w.ownerEmails ?? [],
      })),
      hint:
        json.meta?.ownerEmailLookup === "disabled"
          ? "Set COGNITO_USER_POOL_ID on atlas-api Lambda and redeploy atlas-api-deploy.zip"
          : missing.length
            ? "Redeploy latest atlas-api-deploy.zip; ensure IAM cognito-idp:ListUsers + AdminGetUser"
            : "OK",
    },
    null,
    2,
  ),
);

if (!res.ok || missing.length > 0) process.exit(2);
