/**
 * Shared AR types only. Platform session engines:
 * - android/session.ts (Android Chrome)
 * - ios/session.ts (iOS WebXR Viewer)
 */
export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
  GuiPickerItem,
  PlacedDimensionHudState,
} from "./shared/webxr-ar-types";

export { startAndroidWebXRSession } from "./android/session";
export { startIosWebXRSession } from "./ios/session";
