export type CameraSupport = {
  ok: boolean;
  message: string;
  detail?: string;
};

export function getCameraSupport(): CameraSupport {
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: "Camera needs a secure connection (HTTPS).",
      detail:
        "On your phone you opened http://... — Android Chrome will not ask for camera permission on that. On your PC stop the server (Ctrl+C), then run: npx vite --host --https — then open https://YOUR-PC-IP:5173/ on the phone and tap Advanced → Continue if warned.",
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message: "Camera is not available in this browser.",
      detail: "Use Google Chrome on Android and update it from the Play Store.",
    };
  }

  return { ok: true, message: "Camera can be used on this connection." };
}

export async function startCameraFeed(
  video: HTMLVideoElement
): Promise<{ ok: true } | { ok: false; message: string; detail?: string }> {
  const support = getCameraSupport();
  if (!support.ok) {
    return { ok: false, message: support.message, detail: support.detail };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play();
    (video as HTMLVideoElement & { _atlasStream?: MediaStream })._atlasStream = stream;
    return { ok: true };
  } catch (e) {
    const err = e as DOMException;
    let message = "Could not open the camera.";
    let detail = err.message;

    if (err.name === "NotAllowedError") {
      message = "Camera permission was denied.";
      detail =
        "Chrome → ⋮ menu → Settings → Site settings → Camera → find this site → Allow. Then reload the page.";
    } else if (err.name === "NotFoundError") {
      message = "No camera found on this device.";
    } else if (err.name === "NotReadableError") {
      message = "Camera is in use by another app.";
      detail = "Close the Camera app and other apps using the camera, then try again.";
    }

    return { ok: false, message, detail };
  }
}

export function stopCameraFeed(video?: HTMLVideoElement): void {
  const el = video ?? (document.getElementById("camera-feed") as HTMLVideoElement | null);
  const stream = (el as HTMLVideoElement & { _atlasStream?: MediaStream })?._atlasStream;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    (el as HTMLVideoElement & { _atlasStream?: MediaStream })._atlasStream = undefined;
  }
  if (el) {
    el.srcObject = null;
  }
}
