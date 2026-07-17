import { startIosWebXRSession } from "./session";

export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "./session";

/** Mozilla WebXR Viewer on iPhone/iPad — isolated from Android. */
export async function tryStartWebXRIos(
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
): Promise<import("../shared/webxr-ar-types").WebXRSession | null> {
  return startIosWebXRSession(canvas, domOverlayRoot, onStatus, options);
}
