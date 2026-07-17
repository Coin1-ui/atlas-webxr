/** SUP-2 — shared AR troubleshooting copy (admin help + support docs). */

export type ArTroubleshootingSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tip?: string;
};

export const AR_TROUBLESHOOTING_SECTIONS: ArTroubleshootingSection[] = [
  {
    id: "https",
    title: "HTTPS is required for AR",
    paragraphs: [
      "Browsers only expose the camera and WebXR on secure contexts (HTTPS or localhost). Shoppers opening http:// links will not get camera prompts on Android Chrome.",
      "Production Atlas AR URLs on Amplify are HTTPS by default. Custom domains must have a valid TLS certificate.",
    ],
    bullets: [
      "Pass only https:// showroom and direct AR links to customers — never http://",
      "Local dev on a phone: run Vite with --https and open https://YOUR-PC-IP:5173 (accept the certificate warning once)",
      "Embedded iframes on HTTP parent pages cannot use camera AR — open the Atlas link in a top-level tab",
      "Corporate proxies that strip TLS or rewrite URLs can block WebXR — test on cellular data if IT-filtered Wi‑Fi fails",
    ],
    tip: "If the landing page shows “Camera needs a secure connection (HTTPS)”, the URL bar is not https://.",
  },
  {
    id: "camera-android",
    title: "Camera permissions — Android (Chrome)",
    paragraphs: [
      "Start AR requires a user tap, then Chrome asks for camera access. Deny once and AR cannot start until the site permission is reset.",
    ],
    bullets: [
      "Tap Allow when Chrome prompts for camera access on first Start AR",
      "If denied: Chrome ⋮ → Settings → Site settings → Camera → find your Atlas domain → Allow → reload the page",
      "If no prompt appears: confirm the link is HTTPS and you are in Chrome (not an in-app browser like Instagram or Facebook)",
      "NotReadableError — close other apps using the camera, then retry",
      "NotFoundError — device has no rear camera or it is disabled in system settings",
    ],
    tip: "Use Run camera + AR check on the Start AR landing when enabled — it surfaces permission issues before placement.",
  },
  {
    id: "camera-ios",
    title: "Camera & AR — iPhone (Safari)",
    paragraphs: [
      "Catalog View in AR uses Quick Look (USDZ) — Safari may prompt for camera or motion access depending on iOS version.",
      "Direct WebXR sessions on iOS use Safari’s AR camera path; permissions work like other Safari camera sites.",
    ],
    bullets: [
      "Settings → Safari → Camera → Ask or Allow for your showroom domain",
      "If Quick Look opens but placement fails: re-upload the model so USDZ generation completes in admin",
      "Train staff to tap View in AR on iPhone, not Start AR (WebXR path is Android-first on catalog cards)",
      "Private browsing can reset permissions each session — use a normal Safari tab for store demos",
    ],
  },
  {
    id: "webxr-quicklook",
    title: "WebXR vs Quick Look",
    paragraphs: [
      "Android Chrome uses in-browser WebXR floor placement. iPhone catalog cards prefer Quick Look with auto-generated USDZ.",
    ],
    bullets: [
      "Android: Start AR → scan floor → cyan ring = placeable, red = blocked → place at true floor scale",
      "iPhone catalog: View in AR → Quick Look → place in room",
      "Dimensions toggle and AR/3D dock are WebXR features on supported Android sessions",
      "Desktop browsers cannot run shopper AR — use a phone with Chrome or Safari",
    ],
  },
  {
    id: "common-issues",
    title: "Common fixes",
    paragraphs: [
      "Most support tickets resolve with HTTPS link correction, camera permission reset, or waiting for the first model upload to finish.",
    ],
    bullets: [
      "Empty showroom — upload at least one GLB from desktop admin; refresh /w/your-slug",
      "Upload failed — file must be valid glTF 2.0 binary (.glb); corrupt exports show an error in admin",
      "Model floats or wrong scale — Atlas locks to floor planes; use floor-tuned GLBs, not table-top assets",
      "AR disabled for workspace — owner dashboard → enable Start AR for that customer",
      "Session log — shopper can Download session log (JSON) from AR UI for support diagnosis",
    ],
  },
];
