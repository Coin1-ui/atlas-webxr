#!/usr/bin/env node
/**
 * Bakes VITE_ATLAS_API_URL into public platform config files at build time.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv(process.env.NODE_ENV || "production", root, "");
const apiUrl = (env.VITE_ATLAS_API_URL || process.env.VITE_ATLAS_API_URL || "")
  .trim()
  .replace(/\/$/, "");

function syncConfig(relativePath) {
  const configPath = path.join(root, relativePath);
  let existing = { active: true, apiUrl: "" };
  if (fs.existsSync(configPath)) {
    try {
      existing = { ...existing, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
    } catch {
      /* use defaults */
    }
  }
  const next = {
    active: existing.active !== false,
    apiUrl: apiUrl || existing.apiUrl || "",
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

const salesDeck = syncConfig("public/sales-deck/config.json");
const storyboard = syncConfig("public/mkt-3-storyboard/config.json");

function syncDemoConfig(relativePath) {
  const configPath = path.join(root, relativePath);
  let existing = { workspaceSlug: "" };
  if (fs.existsSync(configPath)) {
    try {
      existing = { ...existing, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
    } catch {
      /* use defaults */
    }
  }
  const envSlug = (env.VITE_DEMO_WORKSPACE_SLUG || process.env.VITE_DEMO_WORKSPACE_SLUG || "")
    .trim()
    .toLowerCase();
  const next = {
    workspaceSlug: envSlug || existing.workspaceSlug || "",
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

const demoConfig = syncDemoConfig("public/demo-config.json");

/** Ensure Three.js vendor files exist (r183 splits three.module.js → three.core.js). */
function syncThreeVendor() {
  const vendorDir = path.join(root, "public/sales-deck/vendor");
  const buildDir = path.join(root, "node_modules/three/build");
  fs.mkdirSync(vendorDir, { recursive: true });
  for (const name of ["three.module.js", "three.core.js"]) {
    const src = path.join(buildDir, name);
    const dest = path.join(vendorDir, name);
    if (!fs.existsSync(src)) {
      console.warn(`sales-deck vendor: missing ${src}`);
      continue;
    }
    fs.copyFileSync(src, dest);
  }
}

syncThreeVendor();

console.log(
  `platform public configs synced (apiUrl: ${salesDeck.apiUrl ? salesDeck.apiUrl : "(empty — local fallback)"})`,
);
console.log(`  sales-deck active=${salesDeck.active}`);
console.log(`  mkt-3-storyboard active=${storyboard.active}`);
console.log(
  `  demo workspaceSlug=${demoConfig.workspaceSlug ? demoConfig.workspaceSlug : "(empty — set VITE_DEMO_WORKSPACE_SLUG)"}`,
);
