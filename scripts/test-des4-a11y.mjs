#!/usr/bin/env node
/** Batch 36a — DES-4 accessibility foundation smoke tests. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "style.css"), "utf8");

assert.ok(!indexHtml.includes("user-scalable=no"), "viewport must allow pinch-zoom");
assert.ok(indexHtml.includes("maximum-scale=5.0"), "viewport must allow up to 5x zoom");

for (const sel of [".btn:focus-visible", ".ar-action-btn:focus-visible", ".model-tile:focus-visible", ".catalog-btn-ar:focus-visible"]) {
  assert.ok(css.includes(sel), `missing focus ring: ${sel}`);
}

assert.ok(css.includes("--focus-ring"), "missing --focus-ring token");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "missing reduced-motion block");
assert.ok(css.includes(".ar-start-progress-bar"), "AR progress bar selector expected");
assert.ok(css.includes(".is-nav-loading::after"), "nav loading spinner selector expected");

console.log("test:des4 — Batch 36a a11y foundation OK");
