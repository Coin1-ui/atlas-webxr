import { isIosWebXrViewer } from "../utils/platform";

/** Android and iOS use separate session engines — only 3D catalog/GLB assets are shared. */
export function assertSeparateArModules(): {
  androidSession: string;
  iosSession: string;
  sharedOnly: string[];
} {
  return {
    androidSession: "webxr-ar-android-session.ts",
    iosSession: "webxr-ar-ios-session.ts",
    sharedOnly: ["data/model-catalog", "data/glb-cache", "xr/shared/glb-offline-cache", "xr/shared/model-real-world-scale"],
  };
}

export function routesToAndroidWhenNotIos(userAgent: string): boolean {
  return !/iPhone|iPad|iPod/i.test(userAgent) || !/WebXRViewer/i.test(userAgent);
}

export function routesToIosViewer(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) && /WebXRViewer/i.test(userAgent);
}

/** Runtime router used by webxr-ar.ts */
export function pickArModule(): "android" | "ios" {
  return isIosWebXrViewer() ? "ios" : "android";
}
