/**
 * Smoke test: glb-to-usdz module exports and CLI helper exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const results = [];
let failed = 0;

function assert(name, condition) {
  if (condition) results.push({ name, status: "pass" });
  else {
    failed += 1;
    results.push({ name, status: "fail" });
  }
}

const src = readFileSync(join(process.cwd(), "src/data/glb-to-usdz.ts"), "utf8");
assert("convertGlbToUsdz export exists", src.includes("export async function convertGlbToUsdz"));
assert("uses quickLookCompatible", src.includes("quickLookCompatible"));
assert("uses Three.js USDZExporter", src.includes("USDZExporter"));
assert("uses WebGLTextureUtils for compressed textures", src.includes("WebGLTextureUtils"));
assert("optional manual usdz on upload", readFileSync(join(process.cwd(), "src/ui/model-manager-pc.ts"), "utf8").includes('name="usdz"'));

const cli = readFileSync(join(process.cwd(), "scripts/glb-to-usdz-cli.mjs"), "utf8");
assert("server CLI fallback export", cli.includes("export async function convertGlbFileToUsdz"));
assert("USD_FROM_GLTF_BIN env", cli.includes("USD_FROM_GLTF_BIN"));

assert("three dependency in package.json", (() => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  return Boolean(pkg.dependencies?.three);
})());

assert(
  "model manager auto-converts on upload",
  readFileSync(join(process.cwd(), "src/ui/model-manager-pc.ts"), "utf8").includes("convertGlbToUsdz")
);

console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
