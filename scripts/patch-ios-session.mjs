import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src/xr/webxr-ar-session.ts"),
  "utf8"
);

let out = src;

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
  /import type \{ ArPlatformProfile \} from "\.\/ar-platform-profile";\n/,
  ""
);
out = out.replace(
  /,\s*type PbrMaterialDiagnostics,\n/,
  "\n"
);

out = out.replace(
  /export async function startWebXRSession\([\s\S]*?\): Promise<WebXRSession \| null> \{\n  const iosViewer = profile\.id === "ios-webxr-viewer";\n/,
  `const IOS_STRICT_FLOOR_READY = false;
const IOS_REJECT_RELOCALIZATION = false;
const IOS_BLOCK_CAMERA_RAY_AFTER_SCAN = true;
const IOS_FREEZE_WORLD_ON_PLACEMENT = true;
const IOS_BODY_CLASS = "ios-webxr-viewer";
const IOS_CANVAS_CLASS = "ios-xr-canvas";

/** iOS WebXR Viewer only — Android uses webxr-ar-android-session.ts */
export async function startIosWebXRSession(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  options?: {
    warmupUrls?: string[];
    inCanvasUi?: {
      onSelect: (id: string) => void;
      onDownloadLog: () => void;
      onExit: () => void;
    };
  }
): Promise<WebXRSession | null> {
  const iosViewer = true;
`
);

out = out.replace(
  /  if \(profile\.platformBodyClass\) \{\n    document\.body\.classList\.add\(profile\.platformBodyClass\);\n  \}\n  if \(profile\.platformCanvasClass\) \{\n    canvas\.classList\.add\(profile\.platformCanvasClass\);\n  \}\n/,
  `  document.body.classList.add(IOS_BODY_CLASS);
  canvas.classList.add(IOS_CANVAS_CLASS);
`
);

out = out.replace(
  /optionalFeatures: profile\.sessionOptionalFeatures\(domOverlay\),/,
  `optionalFeatures: (() => {
        const features = ["hit-test", "anchors"];
        if (domOverlay) features.push("dom-overlay");
        return features;
      })(),`
);

out = out.replace(
  /  if \(profile\.enableLightEstimation\) \{[\s\S]*?  \}\n\n  if \(lightEstimationActive && scene\.environmentTexture\)/,
  `  if (lightEstimationActive && scene.environmentTexture)`
);

out = out.replace(
  /  if \(lightEstimationActive\) \{[\s\S]*?  \}\n\n  const anchorRoot/,
  `  const anchorRoot`
);

out = out.replace(
  /profile\.strictFloorReady/g,
  "IOS_STRICT_FLOOR_READY"
);
out = out.replace(
  /floorScanComplete && profile\.rejectRelocalizationJumps/g,
  "floorScanComplete && IOS_REJECT_RELOCALIZATION"
);
out = out.replace(
  /profile\.blockCameraRayAfterScan/g,
  "IOS_BLOCK_CAMERA_RAY_AFTER_SCAN"
);
out = out.replace(
  /if \(profile\.enablePlaneDetection\) \{/g,
  "if (false) {"
);
out = out.replace(
  /if \(profile\.freezeWorldOnPlacement\) \{/g,
  "if (IOS_FREEZE_WORLD_ON_PLACEMENT) {"
);
out = out.replace(
  /arPlatformProfile: profile\.id,/,
  `arPlatformProfile: "ios-webxr-viewer",`
);
out = out.replace(
  /      if \(profile\.platformBodyClass\) \{\n        document\.body\.classList\.remove\(profile\.platformBodyClass\);\n      \}\n      if \(profile\.platformCanvasClass\) \{\n        canvas\.classList\.remove\(profile\.platformCanvasClass\);\n      \}\n/,
  `      document.body.classList.remove(IOS_BODY_CLASS);
      canvas.classList.remove(IOS_CANVAS_CLASS);
`
);

out = out.replace(
  /export type FloorDetectionState = \{[\s\S]*?\};\n\nexport type HitTestStats = \{[\s\S]*?\};\n\n/,
  ""
);

writeFileSync(join(process.cwd(), "src/xr/webxr-ar-ios-session.ts"), out);
console.log("patched ios session", out.length);
