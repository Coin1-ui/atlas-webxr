#!/usr/bin/env node
/**
 * Sprint 1 auth smoke tests (no AWS required).
 */
import assert from "node:assert/strict";
import { isValidSlug, normalizeSlug, slugFromName } from "../backend/lambda/atlas-api/lib/tenant-types.mjs";

assert.equal(normalizeSlug("  Acme--Store  "), "acme-store");
assert.equal(slugFromName("Acme Furniture"), "acme-furniture");
assert.ok(isValidSlug("acme-furniture"));
assert.ok(!isValidSlug("-bad"));

console.log("test:auth — slug helpers OK");
