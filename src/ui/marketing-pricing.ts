import { escapeHtml } from "../shared/escape-html";
import type { PublicPromo } from "../data/platform-api";
import { promoBannerExtrasHtml } from "../shared/coupon";
import { CONTACT_SALES } from "../shared/contact";
import { MKT_ASSETS } from "./marketing-assets";
import { MKT } from "./marketing-copy";
import { setIntendedTrialPlan } from "../shared/intended-plan";
import {
  bindMarketingNav,
  marketingFooterLegalHtml,
  marketingNavHtml,
  type MarketingNavHandlers,
} from "./marketing-nav";

export type PricingHandlers = MarketingNavHandlers & {
  onDemo?: () => void;
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
  mobileExperience?: boolean;
  signedIn?: boolean;
  workspaceName?: string;
  getStartedLabel?: string;
  getStartedPath?: string;
  /** Active promo (from owner discount panel) that drives the banner note. */
  promo?: PublicPromo | null;
};

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$5",
    annual: "Incl. tax · monthly billing",
    period: "/mo",
    description: "Try floor AR with a tiny catalog — perfect for first tests",
    features: [
      "1 workspace · 5 GLB models",
      "100 AR sessions / model / month (500 included)",
      "625 MB storage",
      "Unlimited shoppers & field reps",
      MKT.pricingFeatureAr,
      "Branded link `/w/your-brand`",
      "Email support (72h)",
    ],
    cta: "Get started",
    featured: false,
    badge: "Lowest price",
  },
  {
    id: "launch",
    name: "Launch",
    price: "$59",
    annual: "Incl. tax · monthly billing",
    period: "/mo",
    description: "Single showroom or pilot team — live this week",
    features: [
      "1 workspace · 30 GLB models",
      "100 AR sessions / model / month (3,000 included)",
      "3.7 GB storage",
      "Unlimited field reps & shoppers",
      MKT.pricingFeatureAr,
      "Full white-label customer experience",
      "Usage dashboard (models · sessions · storage)",
    ],
    cta: "Choose Launch",
    featured: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$179",
    annual: "Incl. tax · monthly billing",
    period: "/mo",
    description: "Regional retail & active field sales",
    features: [
      "1 workspace · 100 GLB models",
      "100 AR sessions / model / month (10,000 included)",
      "12.2 GB storage",
      "Full white-label customer experience",
      "JSON session log download (on by default)",
      "Custom logo & accent color",
      "Priority email support (24h)",
    ],
    cta: "Start 14-day free trial",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "From $499",
    annual: "Custom contracts · tax as agreed",
    period: "/mo",
    description: "Multi-brand, SSO & compliance",
    features: [
      "Multiple workspaces & catalogs",
      "Unlimited AR sessions",
      "Custom session tiers & SSO",
      "Dedicated success manager",
      "SLA + security review",
      "Custom domain & integrations",
      "Volume session pricing",
    ],
    cta: "Contact sales",
    featured: false,
  },
];

const MARKET_LADDER = [
  {
    id: "atlas-starter",
    label: "Atlas AR Starter",
    price: "$5",
    unit: "/mo",
    note: "Self-serve pilot",
    ladderPos: 6,
    atlas: true,
    accent: "warm",
    badge: "Lowest entry",
  },
  {
    id: "plugins",
    label: MKT.pricingComparePlugins,
    price: "$10–65",
    unit: "/mo",
    note: "Single store embed",
    ladderPos: 22,
    atlas: false,
  },
  {
    id: "atlas-launch",
    label: "Atlas AR Launch",
    price: "$59",
    unit: "/mo",
    note: "White-label workspace",
    ladderPos: 34,
    atlas: true,
    accent: "primary",
    badge: "Most teams start here",
  },
  {
    id: "showroom",
    label: MKT.pricingCompareShowroom,
    price: "$99–450",
    unit: "/mo",
    note: "Demo-led setup",
    ladderPos: 58,
    atlas: false,
  },
  {
    id: "custom",
    label: MKT.pricingCompareCustom,
    price: "$100k+",
    unit: "",
    note: "6–12 month build",
    ladderPos: 94,
    atlas: false,
  },
] as const;

function marketLadderHtml(): string {
  return `
      <section class="mkt-market-ladder" aria-labelledby="mkt-market-ladder-title">
        <header class="mkt-market-ladder-head">
          <h2 id="mkt-market-ladder-title" class="mkt-section-title">Where Atlas AR sits in the market</h2>
          <p class="mkt-lead mkt-lead-center">
            A clear price ladder from self-serve pilot to enterprise custom build — no demo gate on Starter &amp; Launch.
          </p>
        </header>
        <div class="mkt-market-ladder-viz" role="img" aria-label="Price ladder from five dollars per month to over one hundred thousand dollars">
          <div class="mkt-market-ladder-axis-track" aria-hidden="true">
            <div class="mkt-market-ladder-rail"></div>
            <div class="mkt-market-ladder-axis">
              <span class="mkt-market-ladder-axis-end mkt-market-ladder-axis-end--low">$5</span>
              <span class="mkt-market-ladder-axis-mid">Monthly cost →</span>
              <span class="mkt-market-ladder-axis-end mkt-market-ladder-axis-end--high">$100k+</span>
            </div>
          </div>
          <ol class="mkt-market-ladder-pins">
            ${MARKET_LADDER.map(
              (row) => `
              <li
                class="mkt-market-pin mkt-market-pin--${row.id} ${row.atlas ? "mkt-market-pin-atlas" : ""} ${"accent" in row && row.accent === "warm" ? "mkt-market-pin-warm" : ""}"
                style="--pin-pct: ${row.ladderPos}%"
              >
                <span class="mkt-market-pin-dot" aria-hidden="true"></span>
                <article class="mkt-market-pin-card">
                  ${"badge" in row && row.badge ? `<span class="mkt-market-pin-badge">${escapeHtml(row.badge)}</span>` : ""}
                  <h3 class="mkt-market-pin-name">${escapeHtml(row.label)}</h3>
                  <p class="mkt-market-pin-price">${escapeHtml(row.price)}<span>${escapeHtml(row.unit)}</span></p>
                  <p class="mkt-market-pin-note">${escapeHtml(row.note)}</p>
                </article>
              </li>`,
            ).join("")}
          </ol>
        </div>
        <p class="mkt-market-ladder-foot">Atlas AR undercuts demo-gated showroom tools while giving you a full white-label workspace — not a single-store embed.</p>
      </section>`;
}

const FAQ = [
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
    a: MKT.faqStoreEmbed,
  },
  {
    q: "What happens when we exceed included AR sessions?",
    a: "Each model includes 100 AR sessions per month on Starter, Launch, and Growth (500 / 3,000 / 10,000 totals at full catalog). Scale is unlimited. Soft notice in admin first; usage beyond included meters bills automatically with your next subscription payment, or you can upgrade.",
  },
];

function tierCtaLabel(
  tier: (typeof TIERS)[number],
  signedIn: boolean,
  _mobile: boolean,
  _hasDemo: boolean,
): string {
  if (signedIn) {
    return tier.id === "scale" ? "Contact sales" : "Go to workspace";
  }
  // Always prefer free-trial CTAs on pricing (mobile previously swapped to "Try live demo").
  return tier.cta;
}

/** Scale is sales-led — mailto, not get-started / signup. */
function tierCtaHtml(
  tier: (typeof TIERS)[number],
  signedIn: boolean,
  mobile: boolean,
  hasDemo: boolean,
): string {
  const label = escapeHtml(tierCtaLabel(tier, signedIn, mobile, hasDemo));
  const btnClass = `mkt-btn ${tier.featured ? "mkt-btn-primary" : "mkt-btn-ghost"}`;
  if (tier.id === "scale") {
    const href = `mailto:${CONTACT_SALES}?subject=${encodeURIComponent("Atlas AR Scale inquiry")}`;
    return `<a class="${btnClass}" href="${escapeHtml(href)}">${label}</a>`;
  }
  const trialAttr =
    !signedIn && (tier.id === "launch" || tier.id === "growth")
      ? ` data-trial-plan="${tier.id}"`
      : "";
  const action = signedIn ? "dashboard" : "get-started";
  return `<button type="button" class="${btnClass}"${trialAttr} data-action="${action}">${label}</button>`;
}

export function renderPricingPage(root: HTMLElement, handlers: PricingHandlers): void {
  const mobile = Boolean(handlers.mobileExperience);
  const signedIn = Boolean(handlers.signedIn);

  root.innerHTML = `
    <div class="mkt-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, {
        mobileExperience: mobile,
        navPage: "pricing",
        signedIn,
        workspaceName: handlers.workspaceName,
        getStartedLabel:
          handlers.getStartedLabel ??
          (signedIn ? (mobile ? "Browse collection" : "Open dashboard") : mobile ? "Create account" : "Start free trial"),
        getStartedPath: handlers.getStartedPath,
      })}

      <div class="mkt-pricing-banner">
        <span class="mkt-pricing-banner-badge">14-day trial</span>
        <strong>Try Growth free</strong> — no credit card · upload a model · place on floor in minutes
        ${
          handlers.promo
            ? `<span class="mkt-pricing-banner-note">${escapeHtml(handlers.promo.text)}${promoBannerExtrasHtml(handlers.promo)}</span>`
            : ""
        }
      </div>

      <header class="mkt-page-header">
        <h1>Pricing built for fast onboarding</h1>
        <p class="mkt-lead mkt-lead-center">
          Start at <strong>$5/mo</strong> for pilots <span class="mkt-price-tax-note">(all plan prices include tax)</span>. Scale to full showrooms without per-seat fees for field reps.
        </p>
      </header>

      ${marketLadderHtml()}

      <section class="mkt-pricing-grid" aria-label="Pricing tiers">
        ${TIERS.map(
          (tier) => `
          <article class="mkt-price-card ${tier.featured ? "mkt-price-card-featured" : ""} ${"badge" in tier && tier.badge ? "mkt-price-card-starter" : ""}">
            ${tier.featured ? '<span class="mkt-price-badge">Most popular</span>' : "badge" in tier && tier.badge ? `<span class="mkt-price-badge mkt-price-badge-warm">${escapeHtml(tier.badge)}</span>` : ""}
            <h2>${escapeHtml(tier.name)}</h2>
            <p class="mkt-price-desc">${escapeHtml(tier.description)}</p>
            <p class="mkt-price-amount">${escapeHtml(tier.price)}<span>${escapeHtml(tier.period)}</span></p>
            <p class="mkt-price-annual">${escapeHtml(tier.annual)}</p>
            <ul class="mkt-checklist">
              ${tier.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
            </ul>
            ${tierCtaHtml(tier, signedIn, mobile, Boolean(handlers.onDemo))}
          </article>
        `,
        ).join("")}
      </section>

      <section class="mkt-section mkt-section-steps">
        <h2 class="mkt-section-title">Usage overage — only if you grow past included sessions</h2>
        <div class="mkt-pricing-overage-grid">
          <div class="mkt-pricing-overage-card">
            <h3>Starter</h3>
            <ul class="mkt-checklist">
              <li>+$5 per 100 extra sessions</li>
              <li>+$3 per extra model</li>
              <li>+$8 per 5 GB storage</li>
            </ul>
          </div>
          <div class="mkt-pricing-overage-card">
            <h3>Launch</h3>
            <ul class="mkt-checklist">
              <li>+$8 per 1,000 extra sessions</li>
              <li>+$12 per 10 extra models</li>
              <li>+$6 per 10 GB storage</li>
            </ul>
          </div>
          <div class="mkt-pricing-overage-card mkt-pricing-overage-featured">
            <h3>Growth</h3>
            <ul class="mkt-checklist">
              <li>+$5 per 1,000 extra sessions</li>
              <li>+$8 per 10 extra models</li>
              <li>+$4 per 10 GB storage</li>
            </ul>
          </div>
        </div>
        <p class="mkt-lead mkt-lead-center mkt-pricing-overage-note">
          Friendly in-app warnings before charges. Overage bills automatically with your subscription payment via usage meters. Annual prepay saves <strong>20%</strong> on Starter, Launch &amp; Growth.
        </p>
      </section>

      <section class="mkt-section" aria-labelledby="mkt-faq-title">
        <h2 id="mkt-faq-title" class="mkt-section-title">Pricing FAQ</h2>
        <dl class="mkt-faq">
          ${FAQ.map(
            (item) => `
            <div class="mkt-faq-item">
              <dt>${escapeHtml(item.q)}</dt>
              <dd>${escapeHtml(item.a)}</dd>
            </div>
          `,
          ).join("")}
        </dl>
      </section>

      <section class="mkt-cta-band">
        <div class="mkt-cta-glow" aria-hidden="true"></div>
        <h2>Place your first model on a real floor in under 10 minutes</h2>
        <button type="button" class="mkt-btn mkt-btn-primary mkt-btn-lg" data-action="${signedIn ? "dashboard" : "get-started"}">${signedIn ? "Open dashboard" : "Start 14-day Growth trial"}</button>
      </section>

      <footer class="mkt-footer">
        <button type="button" class="mkt-nav-link" data-action="home">← Back to product</button>
        ${marketingFooterLegalHtml()}
      </footer>
    </div>
  `;

  bindMarketingNav(root, handlers, {
    onLegalTerms: handlers.onLegalTerms,
    onLegalPrivacy: handlers.onLegalPrivacy,
    onLegalAup: handlers.onLegalAup,
  });

  // Remember which trial plan the visitor picked so onboarding starts the right trial.
  root.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-trial-plan]");
    const plan = el?.getAttribute("data-trial-plan");
    if (plan === "launch" || plan === "growth") setIntendedTrialPlan(plan);
  });
}
