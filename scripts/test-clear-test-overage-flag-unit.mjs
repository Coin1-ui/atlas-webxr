#!/usr/bin/env node
/**
 * clearTestOverage health flag must follow ATLAS_CLEAR_TEST_OVERAGE (default off).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isClearTestOverageEnabled } from "../backend/lambda/atlas-api/lib/sandbox-seed-flag.mjs";

delete process.env.ATLAS_CLEAR_TEST_OVERAGE;
assert.equal(isClearTestOverageEnabled(), false, "default off");
assert.equal(isClearTestOverageEnabled(undefined), false);
assert.equal(isClearTestOverageEnabled("false"), false);
assert.equal(isClearTestOverageEnabled("true"), true);
assert.equal(isClearTestOverageEnabled("1"), true);

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/index.mjs"),
  "utf8"
);
assert.match(indexSrc, /isClearTestOverageEnabled/);
assert.doesNotMatch(indexSrc, /clearTestOverage:\s*true/);

const manageSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/handlers/v2-billing-manage.mjs"),
  "utf8"
);
assert.match(manageSrc, /dodoSubscriptionIsUsageHybrid/);
assert.match(manageSrc, /usageHybrid && !sameTier/);

console.log("test-clear-test-overage-flag-unit: OK");
