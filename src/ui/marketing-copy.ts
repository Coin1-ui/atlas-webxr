/** Customer-facing marketing language — no internal API or competitor names. */

export const MKT = {
  eyebrow: "White-label floor AR · No app store required",
  heroLead:
    "Upload your 3D catalog once. Share a branded link. Shoppers place true-scale models on the real floor in browser AR — then flip to 3D inspect without leaving Chrome or Safari.",
  browserArShort: "Browser-based AR · Chrome & Safari",
  browserArBadgeChrome: "Chrome · in-browser AR + 3D",
  browserArBadgeSafari: "Safari · in-browser AR + 3D",
  noAppInstall: "No app installation needed",
  demoSubtitleAndroid: "Browser-based AR in Chrome — place models on your floor. No account required.",
  demoSubtitleIos: "Safari AR — tap a model, scan the floor, tap to place. No app install.",
  demoSubtitleDesktop: "Try the live demo on your phone — scan the QR or open this site on mobile.",
  stepUploadIos: "On PC: upload GLB (+ optional Reality Converter USDZ) for Safari AR.",
  homeFooterIos: "HTTPS required · Safari AR · optional USDZ on PC upload",
  homeFooterAndroid: "HTTPS required · Chrome · browser-based floor AR · no app install",
  catalogTrust1: "Secure HTTPS",
  catalogTrust2: "Chrome · in-browser AR + 3D",
  catalogTrust3: "Safari · in-browser AR + 3D",
  catalogTrust4: "True floor scale",
  pricingFeatureAr: "Browser-based AR + 3D inspect (Chrome & Safari)",
  pricingComparePlugins: "Single-store plugins",
  pricingCompareShowroom: "Typical showroom SaaS",
  pricingCompareCustom: "Custom AR build",
  faqStoreEmbed:
    "Store plugins embed on one website. Atlas AR is a white-label workspace — one catalog, one branded link, for showrooms, direct sales, and field teams using Chrome and Safari on phone.",
  /** MiroFish prediction — outcome stats for landing strip */
  outcomeLiveMinutes: "Live in under 10 minutes",
  outcomeNoSeatFees: "Unlimited reps & shoppers",
  outcomePriceAnchor: "From $5/mo incl. tax — no demo gate",
  /** MiroFish — workspace vs plugin objection */
  workspaceVsPlugin:
    "Not a single-store plugin — a white-label workspace with your catalog, brand, and analytics in one link.",
  authLoginSubDesktop: "Access your workspace admin on desktop.",
  authLoginSubMobile:
    "Sign in for your showroom on this device. Model uploads and the full admin dashboard are desktop-only.",
  authSignupSubMobile: "Create your workspace — then go straight to Browse the collection on your phone.",
  authVerifySpamHint: "Check your spam or junk folder if the code does not arrive within a few minutes.",
  adminDesktopOnlyTitle: "Admin dashboard — desktop only",
  adminDesktopOnlyBody:
    "Finish Get started (upload models) and use the full admin dashboard on a desktop browser with a mouse. On mobile you can edit branding, manage billing, and browse your showroom.",
  adminMobileHubLead:
    "Quick actions for your workspace on mobile. Complete setup and upload GLB models from a desktop browser — full admin is PC-only.",
  objectionFloatTitle: "Models won't float on tables",
  objectionFloatBody: "Floor-tuned placement locks to real ground planes — the #1 reason retail teams switch from generic AR viewers.",
  objectionAppTitle: "No app store approval",
  objectionAppBody: "Shoppers use Chrome or Safari only. IT gets HTTPS links, tenant isolation, and no MDM rollout.",
  objectionSwitchTitle: "Switching from viewer SaaS",
  objectionSwitchBody: "Self-serve Launch at $59/mo incl. tax with unlimited viewers — vs. demo-gated contracts at 2–3× the price.",
  /** MiroFish live sim P0 — security/privacy late-stage blocker */
  securitySectionTitle: "Security & privacy for IT reviewers",
  securitySectionLead:
    "Showroom buyers and IT teams ask about data handling before they approve a pilot. Atlas AR is built for tenant isolation — not a shared consumer app.",
  securityTenantTitle: "Tenant isolation",
  securityTenantBody:
    "Each workspace has its own catalog, branding, and usage counters. Customer data does not mix across accounts.",
  securityShopperTitle: "No shopper accounts",
  securityShopperBody:
    "End viewers open your branded link in Chrome or Safari. They never sign up, and AR sessions do not require personal data.",
  securityTransportTitle: "HTTPS-only delivery",
  securityTransportBody:
    "Admin, catalog, and AR links are served over HTTPS. Models and icons live in your workspace-scoped storage prefix.",
  securityAdminTitle: "Admin access controls",
  securityAdminBody:
    "Workspace admins authenticate via JWT. Catalog uploads and billing changes require signed-in owner or admin roles.",
  /** MF-1 — guided onboarding + landing FAQ */
  onboardingTarget: "Target: live in under 10 minutes",
  onboardingUploadFaq:
    "You (or your catalog team) upload GLB files once from the desktop admin — max 50 MB per file; workspace storage budgets ~2.5× GLB size per model (GLB + iOS USDZ). Typically 5–15 minutes for your first model, including icon and link copy.",
  onboardingRoiNote:
    "Retail pilots report fewer size-related returns when buyers place at true floor scale before purchase — without a six-figure custom AR app.",
  uploadFaqTitle: "Who uploads the 3D models?",
  uploadFaqBody:
    "Your merchandising or 3D team — once per SKU from desktop admin. Max 50 MB per GLB or USDZ. USDZ for iPhone is generated automatically when under the cap. Shoppers only open your branded link; they never upload.",
  howItWorksTitle: "Desktop admin → phone AR",
  howItWorksLead:
    "Upload and brand on PC. Associates and shoppers open your link on Chrome or Safari — no app store, no MDM rollout.",
  howItWorksPhoneLabel: "Phone AR",
  howItWorksPhoneDetail: "Chrome or Safari · no app install",
  productStoryAr3dTitle: "Browser AR with a built-in 3D viewer",
  productStoryAr3dLead:
    "Like the best browser AR demos: shoppers see the real room through the camera, place at true floor scale, then switch to 3D to study details — still in the same link, no app install.",
  productStoryAr3dBullets: [
    "AR mode — scan the floor, place at real-world size, optional dimensions overlay",
    "3D mode — drag to rotate and pinch to zoom the same model mid-session",
    "One tap between AR and 3D — associates can demo placement, then inspect finish and proportions",
  ] as readonly string[],
  featureAr3dTitle: "AR + 3D in one session",
  featureAr3dBody:
    "Floor placement for spatial confidence, 3D inspect for detail — both in the mobile browser your buyers already use.",
} as const;

/** Short device line for demo landing — no WebXR / Quick Look labels. */
export function customerDeviceLine(): string {
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : "Desktop";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  return `${platform} · ${browser} · browser-based AR`;
}
