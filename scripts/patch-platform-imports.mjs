import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/xr");

function patch(file, reps) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of reps) {
    s = s.split(from).join(to);
  }
  fs.writeFileSync(file, s);
}

const sharedReps = [
  ['from "./glb-offline-cache"', 'from "../shared/glb-offline-cache"'],
  ['from "./model-real-world-scale"', 'from "../shared/model-real-world-scale"'],
  ['from "./webxr-ar-types"', 'from "../shared/webxr-ar-types"'],
  ['from "./depth-diagnostics"', 'from "../shared/depth-diagnostics"'],
  ['from "./ar-pbr-environment"', 'from "../shared/ar-pbr-environment"'],
];

patch(path.join(root, "android/session.ts"), sharedReps);
patch(path.join(root, "ios/session.ts"), sharedReps);

for (const platform of ["android", "ios"]) {
  const ringPath = path.join(root, platform, "ring-pose.ts");
  let s = fs.readFileSync(ringPath, "utf8");
  if (!s.includes("reticle-constants")) {
    s = s.replace(
      /\/\*\* Torus mesh is authored at this diameter[\s\S]*?export const RETICLE_BUILTIN_PAD_FOOTPRINT_M = [^;]+;\r?\n\r?\n/,
      `export {
  RETICLE_BASE_DIAMETER_M,
  RETICLE_DEFAULT_FOOTPRINT_M,
  RETICLE_BUILTIN_PAD_FOOTPRINT_M,
} from "../shared/reticle-constants";

`
    );
    fs.writeFileSync(ringPath, s);
  }
}

patch(path.join(root, "android/entry.ts"), [
  ['from "./webxr-ar-android-session"', 'from "./session"'],
  ['from "./webxr-ar-android-session"', 'from "./session"'],
  ['from "./webxr-ar-types"', 'from "../shared/webxr-ar-types"'],
]);

patch(path.join(root, "ios/entry.ts"), [
  ['from "./webxr-ar-ios-session"', 'from "./session"'],
  ['from "./webxr-ar-types"', 'from "../shared/webxr-ar-types"'],
]);

patch(path.join(root, "shared/model-real-world-scale.ts"), [
  ['from "./glb-offline-cache"', 'from "./glb-offline-cache"'],
]);

console.log("platform imports patched");
