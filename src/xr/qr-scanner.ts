/**
 * Lightweight QR scanner using canvas + jsQR logic inlined via dynamic import from CDN
 * fallback: manual entry of module id
 */

export type QrScanResult = { data: string } | { error: string };

let stream: MediaStream | null = null;
let rafId = 0;

import { getCameraSupport } from "./camera-support";

export async function startQrScanner(
  video: HTMLVideoElement,
  onResult: (result: QrScanResult) => void
): Promise<void> {
  stopQrScanner();
  const support = getCameraSupport();
  if (!support.ok) {
    onResult({ error: support.detail ?? support.message });
    return;
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    onResult({ error: "Canvas not supported" });
    return;
  }

  const jsQR = (await import("jsqr")).default;

  const tick = () => {
    if (!stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        onResult({ data: code.data });
        stopQrScanner();
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

export function stopQrScanner(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

export function parseModuleFromQr(data: string): string | null {
  try {
    const url = new URL(data);
    const m = url.searchParams.get("module") ?? url.searchParams.get("m");
    if (m) return m;
  } catch {
    /* not a url */
  }
  if (/^atlas:/i.test(data)) {
    return data.replace(/^atlas:/i, "").trim();
  }
  if (/^[a-z0-9-]+$/i.test(data.trim())) {
    return data.trim();
  }
  return null;
}
