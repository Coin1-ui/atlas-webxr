#!/usr/bin/env node
/**
 * AUD-2 remediation smoke — static checks for security fixes in repo.
 * Complements scripts/audit-aws-live.mjs (live AWS probes).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const billing = read("backend/lambda/atlas-api/handlers/v2-billing.mjs");
assert.match(billing, /ATLAS_ALLOW_STUB_BILLING/, "billing upgrade must gate on ATLAS_ALLOW_STUB_BILLING");

const auth = read("backend/lambda/atlas-api/lib/auth.mjs");
assert.match(auth, /ATLAS_ALLOW_DEV_AUTH/, "dev auth must require ATLAS_ALLOW_DEV_AUTH");

const legacy = read("backend/lambda/models-api/index.mjs");
assert.match(legacy, /410|ATLAS_LEGACY_MODELS_API/, "legacy models-api must return 410 when disabled");

const publicConfig = read("backend/lambda/atlas-api/handlers/v2-public-config.mjs");
assert.match(publicConfig, /restricted/, "public-config must block restricted workspaces");

const billingApi = read("src/data/billing-api.ts");
assert.doesNotMatch(
  billingApi,
  /res\.status === 404[\s\S]*markPurchasedTierLocally/,
  "billing-api must not fall back to localStorage on 404 when API is configured",
);

const platformApi = read("src/data/platform-api.ts");
assert.doesNotMatch(
  platformApi,
  /director@omnimanual\.com/,
  "platform-api must not hardcode owner email in errors",
);

const workspaceApi = read("src/data/workspace-api.ts");
assert.match(workspaceApi, /PublicShowroomBlockedError/, "workspace-api must expose showroom block errors");

const gitignore = read(".gitignore");
assert.match(gitignore, /\.env/, ".gitignore must ignore .env files");

const amplify = read("amplify.yml");
assert.match(amplify, /verify-production-env/, "amplify.yml must run production env gate");
assert.match(amplify, /Content-Security-Policy/, "amplify.yml must set CSP header");

console.log("test:audit-remediation — all static checks passed");
