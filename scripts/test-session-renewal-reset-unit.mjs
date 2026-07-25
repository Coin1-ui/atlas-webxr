#!/usr/bin/env node
/**
 * Session-only renewal reset — UpdateExpression must not touch models/storage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ATLAS_USAGE_TABLE = "atlas-usage-test";

const { buildMonthlySessionResetUpdate } = await import(
  "../backend/lambda/atlas-api/lib/usage.mjs"
);

const update = buildMonthlySessionResetUpdate("ws_1", "2026-07", "2026-07-25T12:00:00.000Z");
assert.equal(update.Key.pk, "WORKSPACE#ws_1");
assert.equal(update.Key.sk, "MONTH#2026-07");
assert.match(update.UpdateExpression, /sessionCount = :zero/);
assert.doesNotMatch(update.UpdateExpression, /modelCount/);
assert.doesNotMatch(update.UpdateExpression, /storageBytes/);
assert.equal(update.ExpressionAttributeValues[":zero"], 0);
assert.equal(update.ExpressionAttributeValues[":monthVal"], "2026-07");

const __dirname = dirname(fileURLToPath(import.meta.url));
const webhookSrc = readFileSync(
  resolve(__dirname, "../backend/lambda/atlas-api/handlers/v2-billing-webhooks.mjs"),
  "utf8"
);
assert.match(webhookSrc, /resetMonthlySessionCount/);
assert.match(webhookSrc, /subscription\.renewed/);
assert.match(webhookSrc, /Dodo remount: Atlas AR sessions reset/);
assert.match(webhookSrc, /Dodo renew: Atlas AR sessions reset/);

console.log("test-session-renewal-reset-unit: OK");
