import type { SessionMode } from "../procedure/types";

/** True if this browser supports immersive-ar (may still need fullscreen to show passthrough). */
export async function isWebXRARAvailable(): Promise<boolean> {
  const xr = navigator.xr;
  if (!xr?.isSessionSupported) return false;
  try {
    return await xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

/**
 * Default training mode: camera (live video always visible).
 * AR mode only when user opts in (?ar=1 or "Start in AR mode").
 */
export function getDefaultTrainingMode(): "camera" | "webxr" {
  const params = new URLSearchParams(location.search);
  if (params.get("ar") === "1") return "webxr";
  if (localStorage.getItem("atlas-prefer-ar") === "1") return "webxr";
  return "camera";
}

export function setPreferARMode(prefer: boolean): void {
  if (prefer) localStorage.setItem("atlas-prefer-ar", "1");
  else localStorage.removeItem("atlas-prefer-ar");
}

export function modeLabel(mode: SessionMode): string {
  switch (mode) {
    case "webxr":
      return "AR mode (floor objects)";
    case "camera":
      return "Camera view";
    default:
      return "Home";
  }
}
