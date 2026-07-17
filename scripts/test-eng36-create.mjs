#!/usr/bin/env node
/**
 * ENG-36 — fresh workspace create + Growth trial verification.
 * Sets ATLAS_BATCH28_CREATE=1 and runs the Batch 28 smoke suite.
 *
 *   $env:COGNITO_TEST_PASSWORD = "..."
 *   npm run get:id-token -- you@company.com
 *   $env:ATLAS_TEST_ID_TOKEN = "<paste eyJ... token>"
 *   npm run test:eng36
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["scripts/test-batch28-trial-smoke.mjs"], {
  cwd: root,
  env: { ...process.env, ATLAS_BATCH28_CREATE: "1" },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
