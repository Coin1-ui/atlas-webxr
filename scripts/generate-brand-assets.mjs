#!/usr/bin/env node
/**
 * DES-2 — Generate Atlas Field AR brand PNG exports from raster-safe SVG sources.
 *
 * Masters:  docs/atlas-ar/assets/logo/sources/*.svg
 * Exports:   docs/atlas-ar/assets/logo/{mark-app,mark-transparent,wordmark-*,favicon,marketing}/
 * Web copy:  public/brand/ + public/favicon*.png + public/favicon.svg
 *
 * Usage: npm run generate:brand
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const logoRoot = join(root, "docs", "atlas-ar", "assets", "logo");
const sources = join(logoRoot, "sources");
const assetsRoot = join(root, "docs", "atlas-ar", "assets");
const publicDir = join(root, "public");
const publicBrand = join(publicDir, "brand");

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function rasterize(svgPath, width) {
  const svg = readFileSync(svgPath);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "transparent",
  });
  return resvg.render().asPng();
}

function writePng(outPath, png) {
  ensureDir(dirname(outPath));
  writeFileSync(outPath, png);
  console.log(`  wrote ${outPath.replace(root + "\\", "").replace(root + "/", "")} (${png.length} bytes)`);
}

function exportWidths(srcFile, folder, widths, nameFn) {
  const src = join(sources, srcFile);
  const outDir = join(logoRoot, folder);
  ensureDir(outDir);
  for (const w of widths) {
    const png = rasterize(src, w);
    writePng(join(outDir, nameFn(w)), png);
  }
}

function copyToPublic(src, dest) {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

console.log("DES-2 brand asset generation\n");

// Mark (app icon tile with dark bg)
exportWidths("atlas-mark-transparent.svg", "mark-transparent", [128, 256, 512, 1024], (w) => `mark-transparent-${w}w.png`);

const markSrc = join(assetsRoot, "atlas-mark.svg");
const markOutDir = join(logoRoot, "mark-app");
ensureDir(markOutDir);
for (const w of [64, 128, 256, 512, 1024]) {
  const png = rasterize(markSrc, w);
  writePng(join(markOutDir, `mark-${w}.png`), png);
}

// Wordmarks
exportWidths("atlas-wordmark-raster-dark.svg", "wordmark-dark", [380, 760, 1140, 1520, 2280], (w) => `wordmark-dark-${w}w.png`);
exportWidths("atlas-wordmark-raster-light.svg", "wordmark-light", [380, 760, 1140, 1520, 2280], (w) => `wordmark-light-${w}w.png`);

// Favicons (legacy path + logo/favicon/)
const faviconDir = join(logoRoot, "favicon");
ensureDir(faviconDir);
const faviconTargets = [
  [16, "favicon-16.png"],
  [32, "favicon-32.png"],
  [180, "apple-touch-icon-180.png"],
  [512, "icon-512.png"],
];
for (const [size, name] of faviconTargets) {
  const png = rasterize(markSrc, size);
  writePng(join(faviconDir, name), png);
  writePng(join(assetsRoot, name), png);
}

// Marketing title card (1920×1080)
const titleSrc = join(sources, "atlas-title-card-1920.svg");
const marketingDir = join(logoRoot, "marketing");
ensureDir(marketingDir);
const titlePng = rasterize(titleSrc, 1920);
writePng(join(marketingDir, "title-card-1920x1080-dark.png"), titlePng);

// Transparent wordmark overlay for video (1520w dark)
const wordmark1520 = join(logoRoot, "wordmark-dark", "wordmark-dark-1520w.png");
copyToPublic(wordmark1520, join(marketingDir, "wordmark-overlay-1520w-dark.png"));

console.log("\nCopying to public/ …");

// public/brand mirror
ensureDir(publicBrand);
for (const sub of ["mark-app", "mark-transparent", "wordmark-dark", "wordmark-light", "marketing"]) {
  const srcDir = join(logoRoot, sub);
  const destDir = join(publicBrand, sub);
  ensureDir(destDir);
  for (const f of readdirSync(srcDir).filter((n) => n.endsWith(".png"))) {
    copyToPublic(join(srcDir, f), join(destDir, f));
  }
}

// Root favicons + SVG mark
for (const [, name] of faviconTargets) {
  copyToPublic(join(faviconDir, name), join(publicDir, name));
}
copyFileSync(markSrc, join(publicDir, "favicon.svg"));

console.log("Brand assets generated.\nFolders:");
console.log("  docs/atlas-ar/assets/logo/  — all size variants");
console.log("  public/brand/               — web-served copies");
console.log("  public/favicon*.png         — root favicons");
