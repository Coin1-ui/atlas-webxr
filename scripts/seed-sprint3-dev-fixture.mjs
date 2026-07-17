#!/usr/bin/env node
/**
 * Seeds local dev data for Sprint 3 E2E (no AWS).
 * Creates workspace qa-sprint3 + one catalog model stub.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const devDir = path.join(root, ".atlas-dev");
const slug = "qa-sprint3";
const workspaceId = "ws-qa-sprint3";
const ownerSub = "dev-qa-tester-example-com";
const modelId = "qa-test-chair";

const workspace = {
  id: workspaceId,
  slug,
  name: "QA Sprint 3 Workspace",
  plan: "starter",
  primaryColor: "#1565c0",
  arExitUrl: "https://example.com/catalog",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const store = {
  workspaces: { [workspaceId]: workspace },
  slugs: { [slug]: workspaceId },
  members: {
    [ownerSub]: {
      [workspaceId]: { role: "owner", createdAt: new Date().toISOString() },
    },
  },
};

const manifest = {
  version: 1,
  models: [
    {
      id: modelId,
      name: "QA Test Chair",
      glb: `${modelId}.glb`,
      arExitUrl: "https://example.com/products/qa-test-chair",
    },
  ],
};

fs.mkdirSync(devDir, { recursive: true });
fs.writeFileSync(path.join(devDir, "workspaces.json"), JSON.stringify(store, null, 2));

const tenantModelsDir = path.join(devDir, "tenants", workspaceId, "models");
fs.mkdirSync(tenantModelsDir, { recursive: true });
fs.writeFileSync(path.join(tenantModelsDir, "manifest.json"), JSON.stringify(manifest, null, 2));

// Minimal GLB header stub (not valid for rendering — UI/catalog tests only).
const glbPath = path.join(tenantModelsDir, `${modelId}.glb`);
if (!fs.existsSync(glbPath)) {
  fs.writeFileSync(glbPath, Buffer.from("glTF", "utf8"));
}

const usagePath = path.join(devDir, "usage.json");
if (!fs.existsSync(usagePath)) {
  fs.writeFileSync(
    usagePath,
    JSON.stringify({ months: {}, sessions: {} }, null, 2)
  );
}

console.log("seed:sprint3 — dev fixture ready", {
  slug,
  workspaceId,
  modelId,
  ownerSub,
  sessionToken: `dev:${ownerSub}`,
  directArUrl: `/w/${slug}/ar/${modelId}`,
});
