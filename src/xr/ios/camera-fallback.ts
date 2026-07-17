import { isIosWebXrViewer } from "../../utils/platform";
import { startCameraFeed, stopCameraFeed } from "../camera-support";

export type IosCameraFallbackResult = {
  active: boolean;
  phase: "none" | "pre-xr" | "post-xr" | "xr-restart";
  error: string | null;
  videoTrackState: string | null;
};

const BODY_CLASS = "ios-camera-fallback";

/** WebXR Viewer reports opaque blend — UA skips native camera compositing. */
export function shouldUseIosHtmlCameraFallback(): boolean {
  return isIosWebXrViewer();
}

export function isIosHtmlCameraFallbackActive(): boolean {
  return document.body.classList.contains(BODY_CLASS);
}

export function getIosCameraVideoTrackState(
  video: HTMLVideoElement
): string | null {
  const stream = (video as HTMLVideoElement & { _atlasStream?: MediaStream })
    ._atlasStream;
  const track = stream?.getVideoTracks()[0];
  if (!track) return "no-track";
  return track.readyState;
}

export function clearIosHtmlCameraFallback(video?: HTMLVideoElement): void {
  document.body.classList.remove(BODY_CLASS);
  stopCameraFeed(video);
}

function wireTrackEndedRestart(
  video: HTMLVideoElement,
  onEnded: () => void
): void {
  const stream = (video as HTMLVideoElement & { _atlasStream?: MediaStream })
    ._atlasStream;
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  track.onended = () => {
    onEnded();
  };
}

/**
 * Start rear-camera video. Prefer pre-XR (user activation); retry after immersive session
 * if WebXR Viewer revokes the first stream.
 */
export async function startIosHtmlCameraFallback(
  video: HTMLVideoElement,
  phase: "pre-xr" | "post-xr" | "xr-restart"
): Promise<IosCameraFallbackResult> {
  if (!shouldUseIosHtmlCameraFallback()) {
    return { active: false, phase: "none", error: "not-ios-viewer", videoTrackState: null };
  }

  const result = await startCameraFeed(video);
  if (!result.ok) {
    return {
      active: false,
      phase: "none",
      error: result.message,
      videoTrackState: getIosCameraVideoTrackState(video),
    };
  }

  document.body.classList.add(BODY_CLASS);
  video.classList.remove("hidden");
  wireTrackEndedRestart(video, () => {
    void startIosHtmlCameraFallback(video, "xr-restart");
  });

  return {
    active: true,
    phase,
    error: null,
    videoTrackState: getIosCameraVideoTrackState(video),
  };
}

/** Re-open camera after immersive AR starts (WebXR Viewer often kills the pre-XR stream). */
export async function refreshIosCameraAfterXrEnter(
  video: HTMLVideoElement
): Promise<IosCameraFallbackResult> {
  const trackState = getIosCameraVideoTrackState(video);
  if (trackState === "live" && !video.paused && video.readyState >= 2) {
    document.body.classList.add(BODY_CLASS);
    video.classList.remove("hidden");
    return {
      active: true,
      phase: "pre-xr",
      error: null,
      videoTrackState: trackState,
    };
  }

  stopCameraFeed(video);
  return startIosHtmlCameraFallback(video, "post-xr");
}
