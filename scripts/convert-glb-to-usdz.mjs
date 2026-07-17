#!/usr/bin/env node
/**
 * CLI: convert a GLB file to USDZ using usd_from_gltf (when installed).
 * Usage: npm run convert:usdz -- path/to/model.glb [output.usdz]
 */
import fs from "node:fs";
import path from "node:path";
import { convertGlbFileToUsdz, usdFromGltfBin } from "./glb-to-usdz-cli.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run convert:usdz -- <model.glb> [output.usdz]");
  process.exit(1);
}

const glbPath = path.resolve(input);
const outPath = path.resolve(
  process.argv[3] ?? glbPath.replace(/\.glb$/i, ".usdz")
);

if (!fs.existsSync(glbPath)) {
  console.error(`Not found: ${glbPath}`);
  process.exit(1);
}

console.log(`Converting with ${usdFromGltfBin()}…`);
const result = await convertGlbFileToUsdz(glbPath, outPath);
if (!result.ok) {
  console.error(result.error);
  console.error(
    "Install usd_from_gltf or set USD_FROM_GLTF_BIN. Browser upload auto-converts via Three.js."
  );
  process.exit(1);
}
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
