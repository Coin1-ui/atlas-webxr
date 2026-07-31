export const ABOUT = {
  title: "About Atlas AR",
  eyebrow: "White-label floor AR",
  effectiveDate: "June 2026",
  summary:
    "Atlas AR lets furniture retailers and B2B field teams share a branded link. Customers and reps open it in Chrome or Safari, place 3D models on the real floor at true scale, and inspect in 3D — no app store, no custom build.",

  product: {
    headline: "What is Atlas AR?",
    body: "A self-serve workspace for your 3D catalog. You upload GLB models once from desktop admin, set your logo and colors, and share a link like /w/your-brand. Each workspace is isolated — your catalog, your branding, your usage.",
  },

  audiences: [
    {
      id: "retail",
      title: "Retail & showrooms",
      detail: "QR codes on tags, associates sharing one link, floor-locked placement so sofas and beds sit on the ground — not floating on tables.",
    },
    {
      id: "field",
      title: "Field sales",
      detail: "Reps share approved SKUs during a visit. Buyers see products in their own space. Unlimited reps on every plan — no per-seat fees.",
    },
    {
      id: "it",
      title: "IT & security",
      detail: "HTTPS-only, tenant isolation, no shopper accounts, no MDM rollout. Built for buying committees who need answers before a pilot.",
    },
  ],

  steps: [
    {
      num: 1,
      title: "Upload on desktop",
      detail: "Add GLB models and icons from the admin dashboard. iPhone-ready USDZ is generated automatically.",
    },
    {
      num: 2,
      title: "Brand your workspace",
      detail: "Set logo, accent color, and your showroom slug — /w/your-brand.",
    },
    {
      num: 3,
      title: "Share the link",
      detail: "Shoppers or reps open the link on a phone, tap View in AR, scan the floor, and place at true scale.",
    },
  ],

  highlights: [
    "Browser AR in Chrome & Safari — no app install",
    "Plans from $5/mo incl. tax · self-serve signup",
    "Unlimited viewers and field reps",
    "Not a single-store plugin — a white-label workspace",
  ],

  security: {
    headline: "Security & privacy",
    lead: "Common questions from IT and showroom buyers before they approve a pilot.",
    items: [
      { title: "Tenant isolation", detail: "Separate catalog, branding, and usage per workspace." },
      { title: "No shopper accounts", detail: "Viewers open your HTTPS link; AR does not require personal data." },
      { title: "HTTPS-only", detail: "Admin and catalog delivery over encrypted connections." },
      { title: "Admin JWT", detail: "Uploads and settings require signed-in workspace owners or admins." },
    ],
  },

  company: {
    name: "Omni Manual Private Limited",
    url: "https://www.omnimanual.com/#our_service",
    headline: "A product of Omni Manual",
    body: "Atlas AR is developed and operated by Omni Manual Private Limited — software for retail, field sales, and immersive commerce.",
  },

  contact: {
    headline: "Get started or ask a question",
    body: "Try Starter at $5/mo incl. tax, start a 14-day Growth trial from pricing, or email support@atlas-ar.com for enterprise SSO or design-partner pilots.",
    email: "support@atlas-ar.com",
  },

  disclaimer:
    "Atlas AR is a software platform. What shoppers see in AR comes from each workspace owner's catalog and branding.",
} as const;
