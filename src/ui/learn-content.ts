/** SEO-2 Batch 3 — Learn hub content (truthful; no seat / Scale / custom-domain promises). */

import { CONTACT_SALES } from "../shared/contact";

export type LearnSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LearnArticle = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  sections: LearnSection[];
  ctaPrimary: "pricing" | "signup";
  ctaPrimaryLabel: string;
};

export const LEARN_HUB = {
  title: "Learn Atlas AR",
  eyebrow: "Guides",
  summary:
    "Short guides on browser floor AR, GLB/USDZ workflows, and how Atlas AR workspaces fit retail and field teams — without an app install.",
  description:
    "Learn Atlas AR: browser floor AR for furniture retail and B2B field sales, GLB to USDZ workflow, and how white-label workspaces work. No app store.",
  updated: "July 2026",
};

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    slug: "browser-ar-product-demo",
    title: "Share product AR in the browser — no app",
    eyebrow: "Browser AR",
    summary:
      "Give shoppers and buyers a branded link. They open Chrome or Safari, place true-scale 3D on the real floor, and inspect in 3D — no App Store or Play Store install.",
    description:
      "How Atlas AR shares white-label floor AR in Chrome and Safari. Branded links, true-scale placement, and 3D inspect — no app install for furniture retail and field sales.",
    ctaPrimary: "signup",
    ctaPrimaryLabel: "Start free trial",
    sections: [
      {
        heading: "Why browser AR matters",
        paragraphs: [
          "Furniture and field-sales demos stall when buyers must install an app or wait for a custom build. Atlas AR is a white-label workspace: you upload models once, brand your link, and share /w/your-brand.",
          "Viewers open the HTTPS link on a phone. They tap View in AR (or Start AR), scan the floor, and place the model at true scale. Catalog browsing alone does not require an account.",
        ],
      },
      {
        heading: "What the shopper or buyer sees",
        paragraphs: [
          "Your logo and accent color on the catalog. Floor-locked placement so sofas and beds sit on the ground — not floating on tables. A 3D inspect mode when AR is not needed.",
        ],
        bullets: [
          "Chrome on Android (Scene Viewer path) and Safari on iOS (Quick Look)",
          "Unlimited viewers on every plan — you pay for the workspace and included sessions, not seats",
          "No MDM rollout and no shopper signup for AR viewing",
        ],
      },
      {
        heading: "How teams use the link",
        paragraphs: [
          "Showrooms put a QR on a tag. Associates share one catalog link. Field reps open approved SKUs during a visit so buyers see products in their own space.",
          "Start with a 14-day Growth trial (no credit card) or Starter at $5/mo incl. tax when you only need a tiny catalog for first tests.",
        ],
      },
    ],
  },
  {
    slug: "glb-usdz-workflow",
    title: "GLB upload to iOS Quick Look and Android AR",
    eyebrow: "3D pipeline",
    summary:
      "Upload a GLB from desktop admin. Atlas generates iPhone-ready USDZ for Safari Quick Look and serves Android AR through the browser — one catalog for both platforms.",
    description:
      "Atlas AR GLB to USDZ workflow: upload once on desktop, automatic USDZ for iOS Quick Look, Android browser AR, icons, and share links for your white-label workspace.",
    ctaPrimary: "signup",
    ctaPrimaryLabel: "Upload your first model",
    sections: [
      {
        heading: "One upload, two platforms",
        paragraphs: [
          "Admin runs on desktop. You add a GLB (glTF binary) and an icon. Atlas checks the file header before conversion so broken uploads fail early.",
          "For Safari, a USDZ companion is generated so iPhone users get native Quick Look. Android users stay in Chrome for Scene Viewer–style floor AR. You do not maintain two catalogs.",
        ],
      },
      {
        heading: "After the model is live",
        paragraphs: [
          "Copy the model or workspace share link from admin. Branding (logo, accent, slug) applies across the catalog. Usage counters track uploads and AR sessions against your plan limits.",
        ],
        bullets: [
          "Hard block at model limit — upgrade or remove models to continue uploading",
          "Storage is derived from catalog size (models × ~50 MB × 2.5) — see Pricing for tier totals",
          "Help docs under Admin → Help cover permissions, HTTPS, and troubleshooting",
        ],
      },
      {
        heading: "What we do not claim",
        paragraphs: [
          "Atlas AR is not a full DCC pipeline or CAD converter. Bring production-ready GLB assets. Custom domain per workspace and SAML SSO are Scale-era items — do not promise them on Launch or Growth self-serve plans.",
        ],
      },
    ],
  },
  {
    slug: "atlas-ar-for-teams",
    title: "Atlas AR for retail and field teams",
    eyebrow: "Workspaces",
    summary:
      "Each workspace is isolated: your catalog, branding, and usage. Unlimited viewers and reps. A 14-day Growth trial lets you place a real floor demo before you pay.",
    description:
      "Who Atlas AR is for: furniture retail showrooms and B2B field sales. White-label workspaces, 14-day Growth trial, plans from $5/mo incl. tax, unlimited viewers — no per-seat fees.",
    ctaPrimary: "pricing",
    ctaPrimaryLabel: "See pricing",
    sections: [
      {
        heading: "Who it’s for",
        paragraphs: [
          "Retail and showrooms that need QR-on-tag and associate-ready links. Field sales teams that share approved SKUs in the buyer’s space. IT buyers who need HTTPS, tenant isolation, and no shopper accounts before a pilot.",
        ],
      },
      {
        heading: "Trial and plans (truthful)",
        paragraphs: [
          "New signups get a 14-day Growth trial with Growth limits — no credit card. After trial, choose Starter, Launch, or Growth from Pricing. Scale and custom contracts are sales-led.",
          "Every self-serve plan includes unlimited viewers. You are not charged per field rep or store associate. Session and model limits differ by tier; overage on hybrid plans meters with billing when enabled.",
        ],
        bullets: [
          "Starter — tiny catalog for first tests ($5/mo incl. tax)",
          "Launch — single showroom or pilot team",
          "Growth — regional retail and active field sales, JSON session log on by default",
        ],
      },
      {
        heading: "Design partners",
        paragraphs: [
          `Limited Growth design-partner slots may run at a discounted rate with owner-ops tracking. Ask ${CONTACT_SALES} — do not treat partner pricing as public list price.`,
        ],
      },
    ],
  },
];

export function getLearnArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug);
}

export function learnArticlePath(slug: string): string {
  return `/learn/${slug}`;
}
