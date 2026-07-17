import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src/xr/webxr-ar-session.ts"),
  "utf8"
);

let out = src;

// Types → import from shared types file
const typesStart = out.indexOf("export type PlacementObjectType");
const typesEnd = out.indexOf("type PlacedEntry = {");
const header = out.slice(0, typesStart);
const body = out.slice(typesEnd);

out =
  header +
  `import type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "./webxr-ar-types";
export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "./webxr-ar-types";

` +
  body;

out = out.replace(
  /import \{ createArGuiPicker[^\n]+\n/,
  ""
);
out = out.replace(
  /import type \{ ArPlatformProfile \} from "\.\/ar-platform-profile";\n/,
  ""
);
out = out.replace(
  /,\s*type PbrMaterialDiagnostics,\n/,
  "\n"
);

out = out.replace(
  /export async function startWebXRSession\([\s\S]*?\): Promise<WebXRSession \| null> \{\n  const iosViewer = profile\.id === "ios-webxr-viewer";\n/,
  `const ANDROID_STRICT_FLOOR_READY = true;
const ANDROID_REJECT_RELOCALIZATION = false;
const ANDROID_BLOCK_CAMERA_RAY_AFTER_SCAN = true;
const ANDROID_FREEZE_WORLD_ON_PLACEMENT = true;

/** Android Chrome only — do not edit for iOS; use webxr-ar-ios-session.ts */
export async function startAndroidWebXRSession(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  options?: { warmupUrls?: string[] }
): Promise<WebXRSession | null> {
`
);

out = out.replace(
  /  if \(profile\.platformBodyClass\) \{[\s\S]*?  \}\n\n  const buildSessionInit/,
  `  const buildSessionInit`
);

out = out.replace(
  /optionalFeatures: profile\.sessionOptionalFeatures\(domOverlay\),/,
  `optionalFeatures: (() => {
        const features = ["hit-test", "anchors", "plane-detection", "light-estimation"];
        if (domOverlay) features.push("dom-overlay");
        return features;
      })(),`
);

out = out.replace(
  /  let guiPicker: ArGuiPicker \| null = null;[\s\S]*?  if \(options\?\.inCanvasUi && \(iosViewer[\s\S]*?  \}\n\n  if \(profile\.enableLightEstimation\) \{/,
  `  {`
);

out = out.replace(
  /profile\.strictFloorReady/g,
  "ANDROID_STRICT_FLOOR_READY"
);
out = out.replace(
  /floorScanComplete && profile\.rejectRelocalizationJumps/g,
  "floorScanComplete && ANDROID_REJECT_RELOCALIZATION"
);
out = out.replace(
  /profile\.blockCameraRayAfterScan/g,
  "ANDROID_BLOCK_CAMERA_RAY_AFTER_SCAN"
);
out = out.replace(
  /if \(profile\.enablePlaneDetection\) \{/g,
  "{"
);
out = out.replace(
  /if \(profile\.freezeWorldOnPlacement\) \{/g,
  "if (ANDROID_FREEZE_WORLD_ON_PLACEMENT) {"
);
out = out.replace(
  /arPlatformProfile: profile\.id,/,
  `arPlatformProfile: "android-chrome",`
);
out = out.replace(
  /    updateInCanvasPicker: guiPicker[\s\S]*?      : undefined,\n/,
  ""
);
out = out.replace(
  /      if \(profile\.platformBodyClass\) \{[\s\S]*?      \}\n      if \(profile\.platformCanvasClass\) \{[\s\S]*?      \}\n/,
  ""
);
out = out.replace(/      guiPicker\?\.dispose\(\);\n/, "");

// Remove duplicate exported types still in body
out = out.replace(
  /export type FloorDetectionState = \{[\s\S]*?\};\n\nexport type HitTestStats = \{[\s\S]*?\};\n\n/,
  ""
);

// Remove duplicate startWebXRSession if patch left old function header
out = out.replace(
  /\n\/\*\*\n \* Start immersive-ar WebXR with a platform profile\.[\s\S]*?export async function startWebXRSession[\s\S]*?\): Promise<WebXRSession \| null> \{\n  const iosViewer[^\n]+\n/,
  "\n"
);

writeFileSync(join(process.cwd(), "src/xr/webxr-ar-android-session.ts"), out);
console.log("patched android session", out.length);
