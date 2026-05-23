/** Desktop/laptop with mouse — used to show model admin UI only on PC. */
export function isDesktopAdmin(): boolean {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return finePointer && wide && !mobileUa;
}
