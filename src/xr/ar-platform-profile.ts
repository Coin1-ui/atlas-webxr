/** Platform-specific WebXR AR behaviour — Android and iOS stay isolated. */
export type ArPlatformProfile = {
  id: "android-chrome" | "ios-webxr-viewer";
  sessionOptionalFeatures: (domOverlay: boolean) => XRSessionInit["optionalFeatures"];
  enablePlaneDetection: boolean;
  enableLightEstimation: boolean;
  /** Hide full-screen #app during immersive AR (required for iOS passthrough). */
  hideAppDuringSession: boolean;
  rejectRelocalizationJumps: boolean;
  blockCameraRayAfterScan: boolean;
  /** Original Android floor-ready rules (horizontal + live/grace/scan). */
  strictFloorReady: boolean;
  freezeWorldOnPlacement: boolean;
  platformBodyClass: string | null;
  platformCanvasClass: string | null;
};

/** Stable Android Chrome path — reverted to pre-iOS-shared-regression behaviour. */
export const ANDROID_AR_PROFILE: ArPlatformProfile = {
  id: "android-chrome",
  sessionOptionalFeatures: (domOverlay) => {
    const features: string[] = [
      "hit-test",
      "anchors",
      "plane-detection",
      "light-estimation",
    ];
    if (domOverlay) features.push("dom-overlay");
    return features;
  },
  enablePlaneDetection: true,
  enableLightEstimation: true,
  hideAppDuringSession: false,
  rejectRelocalizationJumps: false,
  blockCameraRayAfterScan: true,
  strictFloorReady: true,
  freezeWorldOnPlacement: true,
  platformBodyClass: null,
  platformCanvasClass: null,
};

/** Mozilla WebXR Viewer on iPhone/iPad. */
export const IOS_WEBXR_VIEWER_PROFILE: ArPlatformProfile = {
  id: "ios-webxr-viewer",
  sessionOptionalFeatures: (domOverlay) => {
    const features = ["hit-test", "anchors"];
    if (domOverlay) features.push("dom-overlay");
    return features;
  },
  enablePlaneDetection: false,
  enableLightEstimation: false,
  hideAppDuringSession: true,
  rejectRelocalizationJumps: false,
  blockCameraRayAfterScan: true,
  strictFloorReady: false,
  freezeWorldOnPlacement: true,
  platformBodyClass: "ios-webxr-viewer",
  platformCanvasClass: "ios-xr-canvas",
};
