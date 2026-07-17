import { startAndroidWebXRSession } from "./session";

export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "./session";

/** Android Chrome immersive AR — frozen path; iOS uses webxr-ar-ios.ts */
export async function tryStartWebXRAndroid(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  _options?: {
    warmupUrls?: string[];
    inCanvasUi?: unknown;
  }
): Promise<import("../shared/webxr-ar-types").WebXRSession | null> {
  return startAndroidWebXRSession(canvas, domOverlayRoot, onStatus, {
    warmupUrls: _options?.warmupUrls,
  });
}
