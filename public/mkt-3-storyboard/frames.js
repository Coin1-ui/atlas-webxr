/**
 * MKT-3 demo video storyboard frames — sourced from docs/atlas-ar/MKT-3-DEMO-VIDEO-SCRIPT.md
 * thumb: ./assets/thumbs/*.png (screenshots + generated art)
 *
 * DES-2 brand PNGs for title/end cards (`npm run generate:brand`):
 *   /brand/marketing/title-card-1920x1080-dark.png — full HD intro/outro
 *   /brand/marketing/wordmark-overlay-1520w-dark.png — on-screen wordmark overlay
 *   /brand/mark-transparent/mark-transparent-512w.png — mark-only overlay
 * Master exports: docs/atlas-ar/assets/logo/
 */

/** @typedef {{
 *   id: string;
 *   time: string;
 *   visual: string;
 *   vo: string;
 *   onScreen?: string;
 *   notes?: string;
 *   thumb: string;
 *   aspect?: "16:9" | "9:16";
 *   shotType?: string;
 * }} StoryFrame */

/** @typedef {{
 *   id: string;
 *   title: string;
 *   subtitle: string;
 *   platform: string;
 *   duration: string;
 *   aspect: string;
 *   use: string;
 *   frames: StoryFrame[];
 * }} StoryCut */

/** @type {StoryCut[]} */
export const STORY_CUTS = [
  {
    id: "a1",
    title: "Cut A1 — Android hero",
    subtitle: "Chrome WebXR floor AR",
    platform: "Android · Chrome",
    duration: "~90 sec",
    aspect: "9:16 + 16:9 master",
    use: "Landing hero, LinkedIn, sales email",
    frames: [
      {
        id: "a1-01",
        time: "0:00–0:03",
        visual: "Tight shot: sofa model on hardwood floor, cyan placement ring visible",
        vo: "(music only)",
        thumb: "./assets/thumbs/a1-floor-placement.png",
        aspect: "9:16",
        shotType: "Hero hook",
      },
      {
        id: "a1-02",
        time: "0:03–0:08",
        visual: "Pull back — phone in hand, real living room context",
        vo: "See it on their floor before they buy it.",
        onScreen: "Atlas Field AR",
        notes: "Overlay: /brand/marketing/wordmark-overlay-1520w-dark.png",
        thumb: "./assets/thumbs/a1-phone-in-room.png",
        aspect: "9:16",
        shotType: "Wide context",
      },
      {
        id: "a1-03",
        time: "0:08–0:15",
        visual: "Screen: open /demo in Chrome — no login wall",
        vo: "Open a link in Chrome. No app store. No account.",
        onScreen: "No app install",
        thumb: "./assets/thumbs/capture-demo-mobile.png",
        aspect: "9:16",
        shotType: "UI capture",
      },
      {
        id: "a1-04",
        time: "0:15–0:22",
        visual: "Tap Start AR → camera permission allow",
        vo: "Tap Start AR.",
        thumb: "./assets/thumbs/capture-demo-start-ar.png",
        aspect: "9:16",
        shotType: "UI capture",
      },
      {
        id: "a1-05",
        time: "0:22–0:35",
        visual: "Floor scan — slow pan, reticle / scanning UI",
        vo: "Scan the floor — Atlas locks to ground planes, not tables.",
        onScreen: "True floor scale",
        thumb: "./assets/thumbs/a1-floor-scan.png",
        aspect: "9:16",
        shotType: "AR session",
      },
      {
        id: "a1-06",
        time: "0:35–0:48",
        visual: "Place model — tap to confirm placement",
        vo: "Place at real-world size.",
        thumb: "./assets/thumbs/a1-place-model.png",
        aspect: "9:16",
        shotType: "AR session",
      },
      {
        id: "a1-07",
        time: "0:48–0:58",
        visual: "Toggle 3D — rotate/zoom same model in viewer",
        vo: "Switch to 3D to inspect finish and proportions — same session.",
        onScreen: "AR + 3D",
        thumb: "./assets/thumbs/capture-demo-3d-dock.png",
        aspect: "9:16",
        shotType: "UI capture",
      },
      {
        id: "a1-08",
        time: "0:58–1:08",
        visual: "Optional: dimensions chip ON briefly",
        vo: "Optional dimensions for associates and buyers.",
        thumb: "./assets/thumbs/a1-dimensions.png",
        aspect: "9:16",
        shotType: "Feature",
      },
      {
        id: "a1-09",
        time: "1:08–1:18",
        visual: "Desktop admin upload GLB (3 sec) → branded catalog on phone",
        vo: "Upload once from desktop. Share one branded link.",
        onScreen: "Live in minutes",
        thumb: "./assets/thumbs/capture-admin-models.png",
        aspect: "16:9",
        shotType: "B-roll montage",
      },
      {
        id: "a1-10",
        time: "1:18–1:25",
        visual: "Logo + CTA end card",
        vo: "Atlas AR — browser floor AR from five dollars a month.",
        onScreen: "Try /demo",
        thumb: "./assets/thumbs/a1-end-card.png",
        aspect: "16:9",
        shotType: "End card",
      },
    ],
  },
  {
    id: "a2",
    title: "Cut A2 — Android extended",
    subtitle: "Product tour · ~3 min",
    platform: "Android · Chrome",
    duration: "~3 min",
    aspect: "16:9",
    use: "Landing tour, sales follow-up, help center embed",
    frames: [
      {
        id: "a2-01",
        time: "0:00",
        visual: "Hook — floor placement payoff (reuse A1 best take)",
        vo: "Photos don't show scale in their room. Returns and stalled deals follow.",
        thumb: "./assets/thumbs/a1-floor-placement.png",
        aspect: "9:16",
        shotType: "Chapter: Hook",
      },
      {
        id: "a2-02",
        time: "0:20",
        visual: "Open demo link in Chrome address bar (https visible)",
        vo: "Open your branded demo link.",
        thumb: "./assets/thumbs/capture-demo-mobile.png",
        aspect: "9:16",
        shotType: "Chapter: Open demo",
      },
      {
        id: "a2-03",
        time: "0:45",
        visual: "Start AR + floor scan sequence (extended)",
        vo: "Tap Start AR and scan until the floor locks.",
        thumb: "./assets/thumbs/a1-floor-scan.png",
        aspect: "9:16",
        shotType: "Chapter: Start AR",
      },
      {
        id: "a2-04",
        time: "1:15",
        visual: "Place & reposition — drag/rotate if supported",
        vo: "Place at scale. Reposition until it feels right in the room.",
        thumb: "./assets/thumbs/a1-place-model.png",
        aspect: "9:16",
        shotType: "Chapter: Place",
      },
      {
        id: "a2-05",
        time: "1:45",
        visual: "AR dock — Start AR, 3D, dimensions, exit",
        vo: "Same session: AR for placement, 3D for detail.",
        thumb: "./assets/thumbs/capture-demo-3d-dock.png",
        aspect: "9:16",
        shotType: "Chapter: AR / 3D",
      },
      {
        id: "a2-06",
        time: "2:10",
        visual: "Desktop upload B-roll (Manage 3D models)",
        vo: "Merchandising uploads once from admin.",
        thumb: "./assets/thumbs/capture-admin-models.png",
        aspect: "16:9",
        shotType: "Chapter: Upload",
      },
      {
        id: "a2-07",
        time: "2:35",
        visual: "Branded showroom /w/slug on phone with brand color",
        vo: "Share one link — unlimited viewers.",
        thumb: "./assets/thumbs/capture-demo-desktop.png",
        aspect: "16:9",
        shotType: "Chapter: Branded link",
      },
      {
        id: "a2-08",
        time: "2:50",
        visual: "Pricing tiers + CTA",
        vo: "Starter five dollars. Launch fifty-nine. Fourteen-day Growth trial.",
        onScreen: "Pricing",
        thumb: "./assets/thumbs/a1-end-card.png",
        aspect: "16:9",
        shotType: "Chapter: CTA",
      },
    ],
  },
  {
    id: "b1",
    title: "Cut B1 — iOS hero",
    subtitle: "Safari Quick Look",
    platform: "iPhone · Safari",
    duration: "~75 sec",
    aspect: "9:16",
    use: "Landing, retail associates, app-less AR proof",
    frames: [
      {
        id: "b1-01",
        time: "0:00–0:03",
        visual: "Quick Look: model placed in real room",
        vo: "(music only)",
        thumb: "./assets/thumbs/b1-quick-look-room.png",
        aspect: "9:16",
        shotType: "Hero hook",
      },
      {
        id: "b1-02",
        time: "0:03–0:10",
        visual: "iPhone opens /demo in Safari",
        vo: "Same catalog link — now on iPhone.",
        onScreen: "Safari · No app",
        thumb: "./assets/thumbs/capture-demo-mobile-safari.png",
        aspect: "9:16",
        shotType: "UI capture",
      },
      {
        id: "b1-03",
        time: "0:10–0:20",
        visual: "Tap View in AR → model picker if shown",
        vo: "Tap View in AR.",
        thumb: "./assets/thumbs/capture-demo-view-ar.png",
        aspect: "9:16",
        shotType: "UI capture",
      },
      {
        id: "b1-04",
        time: "0:20–0:40",
        visual: "Quick Look placement — move/scale in room",
        vo: "Place the product in their space with Apple Quick Look — USDZ generated when you upload.",
        onScreen: "True scale in Safari",
        thumb: "./assets/thumbs/b1-quick-look-room.png",
        aspect: "9:16",
        shotType: "Quick Look",
      },
      {
        id: "b1-05",
        time: "0:40–0:52",
        visual: "Close Quick Look → back to catalog",
        vo: "No App Store approval. No MDM rollout.",
        thumb: "./assets/thumbs/capture-demo-mobile.png",
        aspect: "9:16",
        shotType: "Return to catalog",
      },
      {
        id: "b1-06",
        time: "0:52–1:05",
        visual: "Split: associate QR on tag (mock) → customer phone opens link",
        vo: "QR on tags or link in SMS — associates share one branded URL.",
        onScreen: "Retail & field ready",
        thumb: "./assets/thumbs/b1-qr-retail.png",
        aspect: "16:9",
        shotType: "Split screen",
      },
      {
        id: "b1-07",
        time: "1:05–1:15",
        visual: "CTA end card",
        vo: "Atlas AR — from five dollars a month.",
        onScreen: "Try /demo",
        thumb: "./assets/thumbs/a1-end-card.png",
        aspect: "16:9",
        shotType: "End card",
      },
    ],
  },
  {
    id: "c1",
    title: "Cut C1 — Admin B-roll",
    subtitle: "Desktop insert · ~30 sec",
    platform: "Desktop · Chrome",
    duration: "~30 sec",
    aspect: "16:9",
    use: "Insert in A2 / landing (upload → link)",
    frames: [
      {
        id: "c1-01",
        time: "0:00–0:02",
        visual: "Sign in → Admin dashboard",
        vo: "(optional VO overlay)",
        thumb: "./assets/thumbs/capture-admin-dashboard.png",
        aspect: "16:9",
        shotType: "Admin",
      },
      {
        id: "c1-02",
        time: "0:02–0:10",
        visual: "Manage 3D models → upload GLB + icon",
        vo: "Merchandising uploads once.",
        thumb: "./assets/thumbs/capture-admin-models.png",
        aspect: "16:9",
        shotType: "Upload",
      },
      {
        id: "c1-03",
        time: "0:10–0:15",
        visual: "Branding screen — logo + teal accent",
        vo: "Brand it once.",
        thumb: "./assets/thumbs/capture-admin-branding.png",
        aspect: "16:9",
        shotType: "Branding",
      },
      {
        id: "c1-04",
        time: "0:15–0:18",
        visual: "Copy customer link /w/your-brand",
        vo: "Copy one link.",
        thumb: "./assets/thumbs/capture-admin-link.png",
        aspect: "16:9",
        shotType: "Share link",
      },
      {
        id: "c1-05",
        time: "0:18–0:23",
        visual: "Phone receives link → catalog loads with brand color",
        vo: "Everyone else gets a link.",
        thumb: "./assets/thumbs/capture-demo-mobile.png",
        aspect: "9:16",
        shotType: "Phone payoff",
      },
    ],
  },
  {
    id: "combined",
    title: "Combined landing cut",
    subtitle: "Optional ~2:00 embed",
    platform: "Multi",
    duration: "~2 min",
    aspect: "16:9",
    use: "Single marketing page embed",
    frames: [
      {
        id: "comb-01",
        time: "0:00",
        visual: "Hook placement (Android) — 5 sec",
        vo: "See it on their floor.",
        thumb: "./assets/thumbs/a1-floor-placement.png",
        aspect: "9:16",
        shotType: "Montage",
      },
      {
        id: "comb-02",
        time: "0:05",
        visual: "VO problem/solution — 10 sec",
        vo: "Your catalog. Their floor. No app install.",
        thumb: "./assets/thumbs/a1-phone-in-room.png",
        aspect: "16:9",
        shotType: "Montage",
      },
      {
        id: "comb-03",
        time: "0:15",
        visual: "Android Start AR flow — 35 sec",
        vo: "Chrome browser AR on Android.",
        thumb: "./assets/thumbs/a1-floor-scan.png",
        aspect: "9:16",
        shotType: "Montage",
      },
      {
        id: "comb-04",
        time: "0:50",
        visual: "iOS Quick Look — 25 sec",
        vo: "Safari Quick Look on iPhone.",
        thumb: "./assets/thumbs/b1-quick-look-room.png",
        aspect: "9:16",
        shotType: "Montage",
      },
      {
        id: "comb-05",
        time: "1:15",
        visual: "Admin upload + link — 20 sec",
        vo: "Upload once. Share everywhere.",
        thumb: "./assets/thumbs/capture-admin-models.png",
        aspect: "16:9",
        shotType: "Montage",
      },
      {
        id: "comb-06",
        time: "1:35",
        visual: "Pricing + CTA — 15 sec",
        vo: "From five dollars a month.",
        onScreen: "Try /demo",
        thumb: "./assets/thumbs/a1-end-card.png",
        aspect: "16:9",
        shotType: "End card",
      },
    ],
  },
];

export const GLOBAL_MESSAGING = {
  hook: "Show a sofa on a real floor — no setup voice yet (first 3 sec).",
  promise: "Your catalog. Their floor. No app install.",
  proof: "Branded /demo or /w/your-brand link on phone.",
  close: "Start at $5 a month — link in description.",
  avoid: "Metaverse, revolutionary AR, competitor names, WebXR in customer VO.",
};

export const PRODUCTION_CHECKLIST = [
  "/demo loads on test Android + iPhone",
  "At least 2 catalog models live (sofa + smaller SKU)",
  "Workspace branding set if showing /w/slug",
  "Phone battery >50%, Do Not Disturb on",
  "Film in showroom or with location permission",
  "Chrome address bar shows https",
  "Cyan placement ring on floor (not red/blocked)",
  "iOS: Safari only — not in-app browsers",
];
