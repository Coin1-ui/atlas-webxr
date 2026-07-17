/** AR entry CTA labels — consistent taxonomy (DES-6). */
export type ArCtaContext = "catalog" | "landing-android" | "landing-ios" | "landing-desktop";

export function arCtaLabel(context: ArCtaContext): string {
  switch (context) {
    case "catalog":
    case "landing-ios":
      return "View in AR";
    case "landing-android":
      return "Start AR";
    case "landing-desktop":
      return "Preview in 3D";
  }
}
