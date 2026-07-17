import { isIOS } from "../utils/platform";
import { tryStartWebXRAndroid } from "./webxr-ar-android";

export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "./webxr-ar-session";

export { tryStartWebXRAndroid } from "./webxr-ar-android";

/**
 * Immersive WebXR AR — Android Chrome only.
 * iOS uses Safari Quick Look (USDZ) via main.ts — not in-app WebXR.
 */
export async function tryStartWebXR(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  options?: {
    warmupUrls?: string[];
    videoElement?: HTMLVideoElement;
    inCanvasUi?: {
      onSelect: (id: string) => void;
      onDownloadLog: () => void;
      onExit: () => void;
      onToggleDimensions?: () => void;
      dimensionsVisible?: boolean;
    };
  }
): Promise<import("./webxr-ar-session").WebXRSession | null> {
  if (isIOS()) {
    onStatus("On iPhone, use View in AR — Safari AR opens your USDZ model.");
    return null;
  }
  return tryStartWebXRAndroid(canvas, domOverlayRoot, onStatus, options);
}
