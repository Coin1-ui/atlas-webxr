/** Android phone/tablet (Chrome WebXR). */
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** iPhone / iPad. */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Disabled — depth occlusion removed for Android stability. */
export function requestDepthInSession(): boolean {
  return false;
}

export function isWebXRViewerApp(): boolean {
  return /WebXRViewer/i.test(navigator.userAgent);
}

/** @deprecated iOS uses Safari Quick Look only — not in-app WebXR. */
export function isIosWebXrViewer(): boolean {
  return false;
}

/** iOS catalog AR is Safari Quick Look (USDZ) only — never immersive WebXR in-app. */
export async function iosImmersiveWebXrAvailable(): Promise<boolean> {
  return false;
}

/** All iOS devices use Quick Look for AR. */
export async function iosUsesQuickLookAr(): Promise<boolean> {
  return isIOS();
}

/** WebXR dom-overlay — Android Chrome only. */
export function useDomOverlayInAR(): boolean {
  return !isIOS();
}

/** HTML touch stack above canvas — Android dom-overlay only. */
export function useHtmlArTouchOverlay(): boolean {
  return false;
}

/** Bottom AR panel host (#ar-dom-panel) — Android dom-overlay only. */
export function usesArHtmlPanel(): boolean {
  return useDomOverlayInAR();
}

/** @deprecated Babylon GUI does not receive touches in iOS immersive WebXR. */
export function useInCanvasArUiFallback(): boolean {
  return false;
}

export function iosQuickLookHint(): string {
  return (
    "iOS uses Safari AR. Tap View in AR, pick a model, move your phone to find the floor, then tap to place."
  );
}

export function iosWebXrDevHint(_origin = location.origin): string {
  return iosQuickLookHint();
}

export function iosWebXrViewerHint(): string {
  return iosQuickLookHint();
}

export function isIosSafari(): boolean {
  return isIOS();
}

/** Short line for landing screens (browser + platform + AR mode). */
export function getDeviceSummary(): string {
  const ua = navigator.userAgent;
  const platform = isIOS() ? "iOS" : isAndroid() ? "Android" : "Desktop";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  const arMode = isIOS() ? "Safari AR" : "WebXR floor AR";
  return `${platform} · ${browser} · ${arMode}`;
}

export { supportsIosQuickLookAr } from "../xr/ios/quick-look-ar";

/** Pure helpers for unit tests (pass userAgent explicitly). */
export function useDomOverlayInARForUserAgent(userAgent: string): boolean {
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  return !ios;
}

export function useInCanvasArUiFallbackForUserAgent(_userAgent: string): boolean {
  return false;
}

export function useHtmlArTouchOverlayForUserAgent(_userAgent: string): boolean {
  return false;
}

export function usesArHtmlPanelForUserAgent(userAgent: string): boolean {
  return useDomOverlayInARForUserAgent(userAgent);
}

export function isIosWebXrViewerForUserAgent(_userAgent: string): boolean {
  return false;
}
