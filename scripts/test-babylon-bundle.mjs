/**
 * PWA + loader preload — warm GLBs on home screen; never block WebXR user gesture.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const viteConfig = readFileSync(
  join(process.cwd(), "vite.config.ts"),
  "utf8"
);
const preload = readFileSync(
  join(process.cwd(), "src/xr/babylon-preload.ts"),
  "utf8"
);
const main = readFileSync(join(process.cwd(), "src/main.ts"), "utf8");

const results = [];
let failed = 0;

function assert(name, condition) {
  if (condition) results.push({ name, status: "pass" });
  else {
    failed += 1;
    results.push({ name, status: "fail" });
  }
}

assert("workbox cleanupOutdatedCaches enabled", viteConfig.includes("cleanupOutdatedCaches: true"));
assert("no babylon manualChunks split", !viteConfig.includes('return "babylon"'));
assert("babylon-preload module exists", existsSync(join(process.cwd(), "src/xr/babylon-preload.ts")));
assert("preload imports glTF loader", preload.includes("@babylonjs/loaders/glTF"));
assert(
  "preload eagerly loads PBR adapters",
  preload.includes("pbrMaterialLoadingAdapter") &&
    preload.includes("openpbrMaterialLoadingAdapter")
);
assert(
  "home screen prefetches and parses catalog GLBs",
  main.includes("warmCatalogAtHome") &&
    main.includes("prefetchCatalogGlbs") &&
    main.includes("parseGlbsOfflineAtHome")
);
const enterArBlock = main.match(
  /async function enterArPlacementMode[\s\S]*?webxr = await tryStartWebXR/
);
assert(
  "AR enter does not await preload",
  Boolean(
    enterArBlock &&
      !enterArBlock[0].includes("await preloadBabylonGltfPipeline()")
  )
);

console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed === 0 ? 0 : 1);
