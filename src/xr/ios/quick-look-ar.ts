/**
 * Safari AR Quick Look — native ARKit placement without WebXR Viewer.
 * Requires a USDZ asset (upload via PC model manager or Reality Converter from GLB).
 */

/** True when Safari can open rel="ar" Quick Look links. */
export function supportsIosQuickLookAr(): boolean {
  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    "relList" in a &&
    a.relList.supports("ar")
  );
}

/** Open a USDZ in AR Quick Look (Safari). */
export function openQuickLookAr(usdzUrl: string, posterUrl?: string | null): void {
  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = usdzUrl;
  if (posterUrl) {
    const img = document.createElement("img");
    img.src = posterUrl;
    anchor.appendChild(img);
  }
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** USDZ MIME for download / Content-Type hints. */
export const USDZ_MIME = "model/vnd.usdz+zip";
