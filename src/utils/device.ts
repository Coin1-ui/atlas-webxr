/** Desktop/laptop with mouse — used to show model admin UI only on PC. */
export function isDesktopAdmin(): boolean {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return finePointer && wide && !mobileUa;
}

/** Phone/tablet — showroom-first; admin dashboard stays desktop-only. */
export function isMobileExperience(): boolean {
  return !isDesktopAdmin();
}

/** Mobile-allowed setup & operator routes (workspace create, branding, owner console). Get started / upload wizard is desktop-only. */
export function isMobileAllowedRoute(path: string): boolean {
  return path === "/onboard" || path === "/owner" || path === "/admin/branding";
}

/** Full admin dashboard & model manager — desktop only. Auth + setup routes allowed on mobile. */
export function isDesktopOnlyRoute(path: string): boolean {
  if (isMobileAllowedRoute(path)) return false;
  return path === "/forgot-password" || path.startsWith("/admin");
}
