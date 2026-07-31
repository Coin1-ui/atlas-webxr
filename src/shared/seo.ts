/** Technical SEO for https://www.atlasar.in — SPA head + JSON-LD (Phase 1). */

export const SITE_ORIGIN = "https://www.atlasar.in";
export const SITE_NAME = "Atlas AR";
/** Brand aliases for Organization/WebSite JSON-LD (domain-style + compact queries). */
export const SITE_ALTERNATE_NAMES = ["AtlasAR", "atlasar", "Atlas AR"] as const;
/** Optimized 1200×630 JPEG for scrapers (Batch 2b). */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/marketing/og-home.jpg`;
export const OG_IMAGE_WIDTH = "1200";
export const OG_IMAGE_HEIGHT = "630";
export const ORG_LOGO = `${SITE_ORIGIN}/apple-touch-icon-180.png`;

const JSON_LD_PREFIX = "atlas-seo-ld-";

export type SeoRobots = "index" | "noindex";

export type SeoRouteMeta = {
  path: string;
  title: string;
  description: string;
  robots: SeoRobots;
  /** Absolute OG/Twitter image URL (defaults to DEFAULT_OG_IMAGE). */
  ogImage?: string;
  /** Alt text for og:image:alt */
  ogImageAlt?: string;
  /** Inject SoftwareApplication on this route */
  softwareApp?: boolean;
  /** Inject pricing FAQ + Offer graph */
  pricingOffers?: boolean;
  pricingFaq?: boolean;
  /** Inject Article schema (learn guides) */
  article?: boolean;
};

/** Indexable marketing + legal routes (sitemap allowlist). */
export const INDEXABLE_SEO_ROUTES: SeoRouteMeta[] = [
  {
    path: "/",
    title: "Atlas AR — Official white-label floor AR",
    description:
      "Atlas AR (atlasar.in) is white-label floor AR for furniture retail and B2B field sales. Share a branded link; shoppers place true-scale 3D on the real floor in Chrome or Safari—no app install.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-home.jpg`,
    ogImageAlt: "Atlas AR — phone showing white-label floor AR placement",
    softwareApp: true,
  },
  {
    path: "/pricing",
    title: "Pricing — Atlas AR plans from $5/mo Incl. Tax",
    description:
      "Atlas AR plans for white-label floor AR workspaces. Self-serve from $5/mo incl. tax, unlimited viewers and reps, browser AR + 3D inspect in Chrome and Safari—no app store.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-pricing.jpg`,
    ogImageAlt: "Atlas AR pricing — upload, brand, and share workflow",
    pricingOffers: true,
    pricingFaq: true,
  },
  {
    path: "/about",
    title: "About Atlas AR — Floor AR Workspace (atlasar.in)",
    description:
      "Atlas AR (atlasar.in) is white-label floor AR from Omni Manual for furniture retailers and field teams—not Atlas construction loaders or WordPress plugins. Upload once, brand your link, place true-scale models in browser AR.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-about.jpg`,
    ogImageAlt: "Atlas AR for B2B field sales — place products in the buyer space",
  },
  {
    path: "/legal/terms",
    title: "Terms of Service | Atlas AR",
    description:
      "Terms of service for Atlas AR, the white-label floor AR workspace for furniture retail and B2B field sales. Read usage, account, and platform terms before you sign up.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-legal.jpg`,
    ogImageAlt: "Atlas AR branded workspace admin",
  },
  {
    path: "/legal/privacy",
    title: "Privacy Policy | Atlas AR",
    description:
      "Privacy policy for Atlas AR. How Omni Manual handles workspace admin data, tenant isolation, and shopper sessions that open branded AR links without creating viewer accounts.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-legal.jpg`,
    ogImageAlt: "Atlas AR branded workspace admin",
  },
  {
    path: "/legal/acceptable-use",
    title: "Acceptable Use Policy | Atlas AR",
    description:
      "Acceptable use rules for Atlas AR workspaces—catalog content, branding, sharing links, and prohibited misuse of browser-based floor AR for retail and field sales.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-legal.jpg`,
    ogImageAlt: "Atlas AR branded workspace admin",
  },
  {
    path: "/learn",
    title: "Learn Atlas AR — Browser Floor AR Guides",
    description:
      "Learn Atlas AR: browser floor AR for furniture retail and B2B field sales, GLB to USDZ workflow, and how white-label workspaces work. No app store.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-home.jpg`,
    ogImageAlt: "Atlas AR — phone showing white-label floor AR placement",
  },
  {
    path: "/learn/browser-ar-product-demo",
    title: "Share Product AR in the Browser | Atlas AR",
    description:
      "How Atlas AR shares white-label floor AR in Chrome and Safari. Branded links, true-scale placement, and 3D inspect — no app install for furniture retail and field sales.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-home.jpg`,
    ogImageAlt: "Atlas AR — phone showing white-label floor AR placement",
    article: true,
  },
  {
    path: "/learn/glb-usdz-workflow",
    title: "GLB to USDZ Workflow | Atlas AR",
    description:
      "Atlas AR GLB to USDZ workflow: upload once on desktop, automatic USDZ for iOS Quick Look, Android browser AR, icons, and share links for your white-label workspace.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-pricing.jpg`,
    ogImageAlt: "Atlas AR pricing — upload, brand, and share workflow",
    article: true,
  },
  {
    path: "/learn/atlas-ar-for-teams",
    title: "Atlas AR for Retail and Field Teams",
    description:
      "Who Atlas AR is for: furniture retail showrooms and B2B field sales. White-label workspaces, 14-day Growth trial, plans from $5/mo incl. tax, unlimited viewers — no per-seat fees.",
    robots: "index",
    ogImage: `${SITE_ORIGIN}/marketing/og-about.jpg`,
    ogImageAlt: "Atlas AR for B2B field sales — place products in the buyer space",
    article: true,
  },
];

const INDEXABLE_BY_PATH = new Map(INDEXABLE_SEO_ROUTES.map((r) => [r.path, r]));

/** Mirrors visible Pricing FAQ in marketing-pricing.ts — keep in sync. */
export const PRICING_FAQ_FOR_SCHEMA: { q: string; a: string }[] = [
  {
    q: "Do plan prices include tax?",
    a: "Yes. Starter, Launch, and Growth list prices include applicable tax. Checkout and invoices show the tax portion broken out from the same total. Scale and custom contracts may state tax separately in the order form.",
  },
  {
    q: "What is the $5 Starter plan?",
    a: "Starter is for first tests: 5 models, 100 AR sessions per model per month (500 included), 625 MB storage, and your own /w/your-brand link. Upgrade to Launch when you need a full showroom catalog.",
  },
  {
    q: "Is there really a free trial?",
    a: "Yes — 14 days of Growth features. No credit card. Upload a model, share your link, and place it on a real floor in Chrome or Safari before you pay.",
  },
  {
    q: "Do you charge per field rep or store associate?",
    a: "No. Unlimited viewers on every plan. You pay for the workspace and included sessions — not seats.",
  },
  {
    q: "What counts as an AR session?",
    a: "One visit from Start AR (or View in AR) through exit, with at least one placement on the floor. Browsing your catalog alone does not count.",
  },
  {
    q: "How is this different from a single-store plugin?",
    a: "Store plugins embed on one website. Atlas AR is a white-label workspace — one catalog, one branded link, for showrooms, direct sales, and field teams using Chrome and Safari on phone.",
  },
  {
    q: "What happens when we exceed included AR sessions?",
    a: "Each model includes 100 AR sessions per month on Starter, Launch, and Growth (500 / 3,000 / 10,000 totals at full catalog). Scale is unlimited. Soft notice in admin first; usage beyond included meters bills automatically with your next subscription payment, or you can upgrade.",
  },
];

/** Self-serve offers aligned to marketing-pricing TIERS (Scale is contact sales — no fixed Offer). */
const PRICING_OFFERS = [
  { name: "Starter", price: "5.00", description: "Try floor AR with a tiny catalog — perfect for first tests" },
  { name: "Launch", price: "59.00", description: "Single showroom or pilot team — live this week" },
  { name: "Growth", price: "179.00", description: "Regional retail & active field sales" },
];

export function normalizeSeoPath(pathname: string): string {
  const raw = pathname.split("?")[0]?.split("#")[0] || "/";
  const trimmed = raw.replace(/\/$/, "") || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isNoindexPath(path: string): boolean {
  if (INDEXABLE_BY_PATH.has(path)) return false;
  if (
    path === "/login" ||
    path === "/signup" ||
    path === "/forgot-password" ||
    path === "/onboard" ||
    path === "/account" ||
    path === "/owner" ||
    path === "/demo" ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/ar/") ||
    path.startsWith("/w/") ||
    path.startsWith("/sales-deck") ||
    path.startsWith("/mkt-3-storyboard")
  ) {
    return true;
  }
  return true;
}

function resolveMeta(path: string): SeoRouteMeta {
  const hit = INDEXABLE_BY_PATH.get(path);
  if (hit) return hit;
  return {
    path,
    title: SITE_NAME,
    description:
      "White-label floor AR for furniture retailers and B2B field sales. Browser-based AR in Chrome and Safari — no app install.",
    robots: isNoindexPath(path) ? "noindex" : "noindex",
  };
}

function ensureMetaByName(name: string, attr: "name" | "property" = "name"): HTMLMetaElement {
  const selector =
    attr === "property" ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureCanonical(): HTMLLinkElement {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  return el;
}

function clearJsonLd(): void {
  document.head.querySelectorAll(`script[id^="${JSON_LD_PREFIX}"]`).forEach((n) => n.remove());
}

function setJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]): void {
  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.id = `${JSON_LD_PREFIX}${id}`;
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}

function organizationLd(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: `${SITE_ORIGIN}/`,
    logo: ORG_LOGO,
    parentOrganization: {
      "@type": "Organization",
      name: "Omni Manual",
    },
  };
}

function websiteLd(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: `${SITE_ORIGIN}/`,
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

function softwareApplicationLd(): Record<string, unknown> {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_ORIGIN}/#software`,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser (Chrome, Safari)",
    description:
      "White-label floor AR workspace for furniture retail and B2B field sales. Share a branded link; place true-scale 3D on the real floor—no app install.",
    url: `${SITE_ORIGIN}/`,
    offers: {
      "@type": "Offer",
      price: "5.00",
      priceCurrency: "USD",
      description: "Starter plan from $5/mo incl. tax",
      url: `${SITE_ORIGIN}/pricing`,
    },
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

function breadcrumbLd(path: string, title: string): Record<string, unknown> {
  const items: { "@type": string; position: number; name: string; item: string }[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
  ];
  if (path.startsWith("/learn/") && path !== "/learn") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: "Learn",
      item: `${SITE_ORIGIN}/learn`,
    });
    items.push({
      "@type": "ListItem",
      position: 3,
      name: title.replace(/\s*[|—].*$/, "").trim() || title,
      item: `${SITE_ORIGIN}${path}`,
    });
  } else if (path !== "/") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: title.replace(/\s*[|—].*$/, "").trim() || title,
      item: `${SITE_ORIGIN}${path}`,
    });
  }
  return {
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function articleLd(meta: SeoRouteMeta): Record<string, unknown> {
  return {
    "@type": "Article",
    "@id": `${SITE_ORIGIN}${meta.path}#article`,
    headline: meta.title,
    description: meta.description,
    url: `${SITE_ORIGIN}${meta.path}`,
    image: meta.ogImage || DEFAULT_OG_IMAGE,
    datePublished: "2026-07-31",
    dateModified: "2026-07-31",
    author: { "@id": `${SITE_ORIGIN}/#organization` },
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    mainEntityOfPage: { "@id": `${SITE_ORIGIN}${meta.path}#webpage` },
  };
}

function webpageLd(path: string, title: string, description: string): Record<string, unknown> {
  return {
    "@type": "WebPage",
    "@id": `${SITE_ORIGIN}${path === "/" ? "/" : path}#webpage`,
    url: `${SITE_ORIGIN}${path === "/" ? "/" : path}`,
    name: title,
    description,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    about: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

function faqPageLd(): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ_FOR_SCHEMA.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

function offersGraphLd(): Record<string, unknown>[] {
  return PRICING_OFFERS.map((offer) => ({
    "@type": "Offer",
    name: `Atlas AR ${offer.name}`,
    description: offer.description,
    url: `${SITE_ORIGIN}/pricing`,
    price: offer.price,
    priceCurrency: "USD",
    priceValidUntil: "2027-12-31",
    availability: "https://schema.org/InStock",
    category: "SaaSSubscription",
    seller: { "@id": `${SITE_ORIGIN}/#organization` },
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: offer.price,
      priceCurrency: "USD",
      billingDuration: "P1M",
      unitText: "MONTH",
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: 1,
        unitCode: "MON",
      },
    },
  }));
}

/** Build schema.org @graph for an indexable route (shared by SPA + prerender). */
export function buildRouteJsonLdGraph(meta: SeoRouteMeta): Record<string, unknown> | null {
  if (meta.robots !== "index") return null;

  const graph: Record<string, unknown>[] = [
    organizationLd(),
    websiteLd(),
    webpageLd(meta.path, meta.title, meta.description),
    breadcrumbLd(meta.path, meta.title),
  ];
  if (meta.softwareApp) {
    graph.push(softwareApplicationLd());
  }
  if (meta.pricingFaq) {
    graph.push(faqPageLd());
  }
  if (meta.pricingOffers) {
    graph.push(...offersGraphLd());
  }
  if (meta.article) {
    graph.push(articleLd(meta));
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function injectJsonLdForRoute(meta: SeoRouteMeta): void {
  clearJsonLd();
  const payload = buildRouteJsonLdGraph(meta);
  if (!payload) return;
  setJsonLd("graph", payload);
}

export function resolveSeoRouteMeta(pathname: string): SeoRouteMeta {
  return resolveMeta(normalizeSeoPath(pathname));
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Rewrite a built index.html shell with per-route SEO tags (Node / prerender).
 * Does not execute the SPA — crawlers that skip JS still see correct head.
 */
export function applySeoTagsToHtml(html: string, meta: SeoRouteMeta): string {
  const path = normalizeSeoPath(meta.path);
  const canonicalPath = path === "/" ? "/" : path;
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const robotsContent = meta.robots === "index" ? "index, follow" : "noindex, nofollow";
  const title = escapeHtmlAttr(meta.title);
  const description = escapeHtmlAttr(meta.description);
  const canonicalEsc = escapeHtmlAttr(canonicalUrl);
  const ogImage = escapeHtmlAttr(meta.ogImage || DEFAULT_OG_IMAGE);
  const ogAlt = escapeHtmlAttr(meta.ogImageAlt || meta.title);
  const siteName = escapeHtmlAttr(SITE_NAME);

  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${description}" />`,
  );
  out = out.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${robotsContent}" />`,
  );
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canonicalEsc}" />`,
  );

  const setProp = (prop: string, content: string): void => {
    const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="[^"]*"\\s*\\/?>`, "i");
    if (re.test(out)) {
      out = out.replace(re, `<meta property="${prop}" content="${content}" />`);
    }
  };
  setProp("og:title", title);
  setProp("og:description", description);
  setProp("og:url", canonicalEsc);
  setProp("og:type", "website");
  setProp("og:site_name", siteName);

  // Strip prior OG image dimension tags, then set image + dims + alt once
  out = out.replace(/<meta\s+property="og:image(?::(?:width|height|alt))?"\s+content="[^"]*"\s*\/?>\s*/gi, "");
  out = out.replace(
    /(<meta\s+property="og:site_name"[^>]*\/?>)/i,
    `$1
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="${ogAlt}" />`,
  );

  const setName = (name: string, content: string): void => {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*\\/?>`, "i");
    if (re.test(out)) {
      out = out.replace(re, `<meta name="${name}" content="${content}" />`);
    }
  };
  setName("twitter:card", "summary_large_image");
  setName("twitter:title", title);
  setName("twitter:description", description);
  setName("twitter:image", ogImage);

  // Strip prior prerender / SPA JSON-LD then inject route graph
  out = out.replace(/<script[^>]*id="atlas-seo-ld-[^"]*"[^>]*>[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, "");

  const ld = buildRouteJsonLdGraph(meta);
  if (ld) {
    const json = JSON.stringify(ld).replace(/</g, "\\u003c");
    const tag = `<script type="application/ld+json" id="atlas-seo-ld-graph">${json}</script>\n`;
    out = out.replace(/<\/head>/i, `${tag}</head>`);
  }

  return out;
}

/**
 * Update document head for the current SPA route.
 * Call from routeApp() on every navigation.
 */
export function applyRouteMeta(pathname: string): void {
  if (typeof document === "undefined") return;

  const path = normalizeSeoPath(pathname);
  const meta = resolveMeta(path);
  const canonicalPath = path === "/" ? "/" : path;
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const robotsContent =
    meta.robots === "index" ? "index, follow" : "noindex, nofollow";

  document.title = meta.title;

  ensureMetaByName("description").setAttribute("content", meta.description);
  ensureMetaByName("robots").setAttribute("content", robotsContent);
  ensureCanonical().setAttribute("href", canonicalUrl);

  const ogImage = meta.ogImage || DEFAULT_OG_IMAGE;
  const ogAlt = meta.ogImageAlt || meta.title;

  ensureMetaByName("og:title", "property").setAttribute("content", meta.title);
  ensureMetaByName("og:description", "property").setAttribute("content", meta.description);
  ensureMetaByName("og:url", "property").setAttribute("content", canonicalUrl);
  ensureMetaByName("og:type", "property").setAttribute("content", "website");
  ensureMetaByName("og:site_name", "property").setAttribute("content", SITE_NAME);
  ensureMetaByName("og:image", "property").setAttribute("content", ogImage);
  ensureMetaByName("og:image:width", "property").setAttribute("content", OG_IMAGE_WIDTH);
  ensureMetaByName("og:image:height", "property").setAttribute("content", OG_IMAGE_HEIGHT);
  ensureMetaByName("og:image:alt", "property").setAttribute("content", ogAlt);

  ensureMetaByName("twitter:card").setAttribute("content", "summary_large_image");
  ensureMetaByName("twitter:title").setAttribute("content", meta.title);
  ensureMetaByName("twitter:description").setAttribute("content", meta.description);
  ensureMetaByName("twitter:image").setAttribute("content", ogImage);

  injectJsonLdForRoute(meta);
}
