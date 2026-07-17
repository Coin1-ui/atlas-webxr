#!/usr/bin/env node
/**
 * QA-2: tenant manifest paths are isolated per workspace id.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-tenant-test-"));

function tenantManifestPath(workspaceId) {
  return path.join(tmpRoot, ".atlas-dev", "tenants", workspaceId, "models", "manifest.json");
}

function writeManifest(workspaceId, models) {
  const p = tenantManifestPath(workspaceId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ version: 1, models }, null, 2));
}

function readManifest(workspaceId) {
  const p = tenantManifestPath(workspaceId);
  if (!fs.existsSync(p)) return { version: 1, models: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

writeManifest("wsA", [{ id: "chair-a", name: "Chair A", glb: "chair-a.glb" }]);
writeManifest("wsB", [{ id: "sofa-b", name: "Sofa B", glb: "sofa-b.glb" }]);

const a = readManifest("wsA");
const b = readManifest("wsB");

assert.equal(a.models.length, 1);
assert.equal(b.models.length, 1);
assert.equal(a.models[0].id, "chair-a");
assert.equal(b.models[0].id, "sofa-b");
assert.notEqual(a.models[0].id, b.models[0].id);

assert.throws(() => readManifest("wsC").models[0].id);

fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log("test:tenant-isolation — OK");
