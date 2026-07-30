import { MKT_ASSETS } from "./marketing-assets";
import { MKT } from "./marketing-copy";
import { brandWordmarkImgHtml } from "../shared/brand-assets";
import { mountHeroVideo } from "./hero-video";
import {
  bindMarketingNav,
  marketingFooterLegalHtml,
  marketingNavHtml,
  type MarketingNavHandlers,
} from "./marketing-nav";
import { pcAdminDiagramIconHtml, phoneArDiagramIconHtml } from "./device-diagram-icons";

export type MarketingLandingHandlers = MarketingNavHandlers & {
  onDemo?: () => void;
  onDashboard?: () => void;
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
  signedIn?: boolean;
  workspaceName?: string;
  mobileExperience?: boolean;
  getStartedLabel?: string;
  getStartedPath?: string;
};

export function renderMarketingLanding(root: HTMLElement, handlers: MarketingLandingHandlers): void {
  const signedIn = Boolean(handlers.signedIn);
  const mobile = Boolean(handlers.mobileExperience);

  root.innerHTML = `
    <div class="mkt-page">
      ${marketingNavHtml(handlers, {
        mobileExperience: mobile,
        navPage: "home",
        signedIn,
        workspaceName: handlers.workspaceName,
        getStartedLabel:
          handlers.getStartedLabel ??
          (signedIn ? (mobile ? "Browse collection" : "Admin dashboard") : mobile ? "Create account" : "Start free"),
        getStartedPath: handlers.getStartedPath,
      })}

      <header class="mkt-hero mkt-hero--cinema">
        <div class="mk-hero-media" data-hero-video></div>
        <div class="mkt-hero-cinema-inner">
          <div class="mkt-hero-copy">
            <p class="mkt-eyebrow">${MKT.eyebrow}</p>
            <h1>See it on their floor <em>before</em> they buy it.</h1>
            <p class="mkt-lead">${MKT.heroLead}</p>
            <div class="mkt-hero-cta">
              ${
                mobile && handlers.onDemo
                  ? `<button type="button" class="mkt-btn mkt-btn-primary mkt-btn-lg" data-action="demo">Try live demo</button>
                     <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-lg" data-action="pricing">See pricing</button>`
                  : `<button type="button" class="mkt-btn mkt-btn-primary mkt-btn-lg" data-action="get-started">${signedIn ? "Admin dashboard" : "Start free — upload your first model"}</button>
                     ${
                       handlers.onDemo
                         ? `<button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-lg" data-action="demo">Try live demo</button>`
                         : ""
                     }`
              }
            </div>
            <ul class="mkt-trust-row" aria-label="Platform support">
              <li><span class="mkt-badge">${MKT.browserArBadgeChrome}</span></li>
              <li><span class="mkt-badge">${MKT.browserArBadgeSafari}</span></li>
              <li><span class="mkt-badge">True floor scale</span></li>
              <li><span class="mkt-badge mkt-badge-warm">${MKT.noAppInstall}</span></li>
            </ul>
            <p class="mkt-visual-caption">Cyan ring = empty floor · Red = wall or obstacle</p>
          </div>
        </div>
      </header>

      <section class="mkt-outcomes" aria-label="Predicted outcomes for teams like yours">
        <ul class="mkt-outcomes-row">
          <li><strong>${MKT.outcomeLiveMinutes}</strong><span>signup → first floor placement</span></li>
          <li><strong>${MKT.outcomeNoSeatFees}</strong><span>on every plan</span></li>
          <li><strong>${MKT.outcomePriceAnchor}</strong><span>Starter · Launch · Growth</span></li>
        </ul>
        <p class="mkt-outcomes-note">${MKT.workspaceVsPlugin}</p>
      </section>

      <section class="mkt-section mkt-upload-faq-section" aria-labelledby="mkt-upload-faq-title">
        <div class="mkt-upload-faq-grid">
          <div class="mkt-upload-faq-copy">
            <h2 id="mkt-upload-faq-title" class="mkt-section-title">${MKT.uploadFaqTitle}</h2>
            <p class="mkt-lead">${MKT.uploadFaqBody}</p>
            <p class="mkt-lead mkt-lead-sub">${MKT.howItWorksLead}</p>
          </div>
          <aside class="mkt-upload-faq-aside" aria-label="${MKT.howItWorksTitle}">
            <p class="mkt-upload-faq-aside-kicker">${MKT.howItWorksTitle}</p>
            <div class="mkt-how-diagram mkt-how-diagram--aside">
              <div class="mkt-how-diagram-col">
                <span class="mkt-how-diagram-icon diagram-icon-wrap" aria-hidden="true">${pcAdminDiagramIconHtml()}</span>
                <strong>PC admin</strong>
                <span>Upload GLB · brand · copy link</span>
              </div>
              <div class="mkt-how-diagram-arrow" aria-hidden="true"></div>
              <div class="mkt-how-diagram-col">
                <span class="mkt-how-diagram-icon diagram-icon-wrap" aria-hidden="true">${phoneArDiagramIconHtml()}</span>
                <strong>${MKT.howItWorksPhoneLabel}</strong>
                <span>${MKT.howItWorksPhoneDetail}</span>
              </div>
            </div>
          </aside>
        </div>
        <p class="mkt-roi-strip">${MKT.onboardingRoiNote}</p>
      </section>

      <section class="mkt-section mkt-ar-3d-story" aria-labelledby="mkt-ar-3d-title">
        <div class="mkt-ar-3d-story-inner">
          <div>
            <h2 id="mkt-ar-3d-title" class="mkt-section-title">${MKT.productStoryAr3dTitle}</h2>
            <p class="mkt-lead">${MKT.productStoryAr3dLead}</p>
          </div>
          <ul class="mkt-checklist mkt-ar-3d-list">
            ${MKT.productStoryAr3dBullets.map((b) => `<li>${b}</li>`).join("")}
          </ul>
        </div>
      </section>

      <section id="product" class="mkt-section" aria-labelledby="mkt-usecases-title">
        <h2 id="mkt-usecases-title" class="mkt-section-title">Built for your buyers</h2>
        <div class="mkt-card-grid mkt-card-grid-2">
          <article class="mkt-card mkt-card-image mkt-card-retail">
            <div class="mkt-card-media">
              <img src="${MKT_ASSETS.usecaseRetail}" alt="" loading="lazy" decoding="async" />
              <span class="mkt-card-tag mkt-card-tag-warm">Retail</span>
            </div>
            <div class="mkt-card-content">
              <h3>Furniture &amp; home retail</h3>
              <p>Show sofas, beds, and tables at real size in the customer&rsquo;s room. Cut returns from &ldquo;wrong size&rdquo; and lift conversion on high-ticket items.</p>
              <ul class="mkt-checklist">
                <li>Showroom QR &amp; share links</li>
                <li>Associate-friendly — ${MKT.noAppInstall.toLowerCase()}</li>
                <li>Dimensions overlay in AR</li>
                <li>AR / 3D toggle on the same model</li>
              </ul>
            </div>
          </article>
          <article class="mkt-card mkt-card-image mkt-card-field">
            <div class="mkt-card-media">
              <img src="${MKT_ASSETS.usecaseFieldSales}" alt="" loading="lazy" decoding="async" />
              <span class="mkt-card-tag mkt-card-tag-cool">Field sales</span>
            </div>
            <div class="mkt-card-content">
              <h3>B2B field sales</h3>
              <p>Reps place approved models in the buyer&rsquo;s space during the visit. Branded workspace, curated catalog, session analytics for sales ops.</p>
              <ul class="mkt-checklist">
                <li>One link per product line</li>
                <li>No six-figure custom AR app</li>
                <li>Works on any modern phone browser</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section class="mkt-section mkt-section-steps" aria-labelledby="mkt-steps-title">
        <div class="mkt-steps-banner">
          <img src="${MKT_ASSETS.stepsWorkflow}" alt="" class="mkt-steps-img" loading="lazy" decoding="async" />
        </div>
        <h2 id="mkt-steps-title" class="mkt-section-title">Live in three steps</h2>
        <ol class="mkt-steps">
          <li>
            <span class="mkt-step-num">1</span>
            <strong>Upload 3D models</strong>
            <span>Admin dashboard on desktop — mobile-ready formats generated automatically.</span>
          </li>
          <li>
            <span class="mkt-step-num mkt-step-num-warm">2</span>
            <strong>Brand your workspace</strong>
            <span>Logo, accent color, and customer link <code>/w/your-brand</code>.</span>
          </li>
          <li>
            <span class="mkt-step-num mkt-step-num-cool">3</span>
            <strong>Share &amp; place</strong>
            <span>Customer opens link on phone, places on the floor in AR, taps <strong>3D</strong> to inspect — Chrome or Safari.</span>
          </li>
        </ol>
      </section>

      <section class="mkt-section" aria-labelledby="mkt-features-title">
        <h2 id="mkt-features-title" class="mkt-section-title">Why teams switch to Atlas AR</h2>
        <div class="mkt-card-grid mkt-card-grid-3">
          <article class="mkt-feature mkt-feature-cyan">
            <div class="mkt-feature-icon" aria-hidden="true">◎</div>
            <h3>Floor-accurate placement</h3>
            <p>Session-tuned floor lock — not floating models on table planes.</p>
          </article>
          <article class="mkt-feature mkt-feature-warm">
            <div class="mkt-feature-icon" aria-hidden="true">◈</div>
            <h3>Your brand, your catalog</h3>
            <p>Isolated tenant workspaces — models never leak between customers.</p>
          </article>
          <article class="mkt-feature mkt-feature-cool">
            <div class="mkt-feature-icon" aria-hidden="true">⬡</div>
            <h3>${MKT.featureAr3dTitle}</h3>
            <p>${MKT.featureAr3dBody}</p>
          </article>
        </div>
      </section>

      <section class="mkt-section" aria-labelledby="mkt-objections-title">
        <h2 id="mkt-objections-title" class="mkt-section-title">Built to pass real buying committees</h2>
        <p class="mkt-lead mkt-lead-center">Top objections from retail and field-sales pilots — answered on the page, not on a sales call.</p>
        <div class="mkt-card-grid mkt-card-grid-3">
          <article class="mkt-objection-card">
            <h3>${MKT.objectionFloatTitle}</h3>
            <p>${MKT.objectionFloatBody}</p>
          </article>
          <article class="mkt-objection-card">
            <h3>${MKT.objectionAppTitle}</h3>
            <p>${MKT.objectionAppBody}</p>
          </article>
          <article class="mkt-objection-card">
            <h3>${MKT.objectionSwitchTitle}</h3>
            <p>${MKT.objectionSwitchBody}</p>
          </article>
        </div>
      </section>

      <section class="mkt-section mkt-security-section" aria-labelledby="mkt-security-title" id="security">
        <h2 id="mkt-security-title" class="mkt-section-title">${MKT.securitySectionTitle}</h2>
        <p class="mkt-lead mkt-lead-center">${MKT.securitySectionLead}</p>
        <div class="mkt-card-grid mkt-card-grid-2">
          <article class="mkt-objection-card mkt-security-card">
            <h3>${MKT.securityTenantTitle}</h3>
            <p>${MKT.securityTenantBody}</p>
          </article>
          <article class="mkt-objection-card mkt-security-card">
            <h3>${MKT.securityShopperTitle}</h3>
            <p>${MKT.securityShopperBody}</p>
          </article>
          <article class="mkt-objection-card mkt-security-card">
            <h3>${MKT.securityTransportTitle}</h3>
            <p>${MKT.securityTransportBody}</p>
          </article>
          <article class="mkt-objection-card mkt-security-card">
            <h3>${MKT.securityAdminTitle}</h3>
            <p>${MKT.securityAdminBody}</p>
          </article>
        </div>
      </section>

      <section class="mkt-section mkt-pricing-teaser">
        <div class="mkt-pricing-teaser-inner">
          <div>
            <h2>Start free — pay when AR is live</h2>
            <p>
              <strong>Starter from $5/mo incl. tax</strong> · <strong>14-day Growth trial</strong> · no credit card · Growth <strong>$179/mo incl. tax</strong>. Unlimited field reps.
            </p>
          </div>
          <button type="button" class="mkt-btn mkt-btn-primary" data-action="pricing">See pricing</button>
        </div>
      </section>

      <section class="mkt-cta-band">
        <div class="mkt-cta-glow" aria-hidden="true"></div>
        <h2>Ready to place your catalog in the real world?</h2>
        <button type="button" class="mkt-btn mkt-btn-primary mkt-btn-lg" data-action="${mobile && handlers.onDemo ? "demo" : "get-started"}">${mobile && handlers.onDemo ? "Try live demo" : signedIn ? "Admin dashboard" : "Create free workspace"}</button>
      </section>

      <footer class="mkt-footer">
        <span class="mkt-logo mkt-logo-sm">${brandWordmarkImgHtml("mkt-logo-img mkt-logo-img-sm")}</span>
        ${marketingFooterLegalHtml()}
        <p>© ${new Date().getFullYear()} Atlas AR · Spatial commerce for retail &amp; field sales</p>
      </footer>
    </div>
  `;

  bindMarketingNav(root, handlers, {
    onLegalTerms: handlers.onLegalTerms,
    onLegalPrivacy: handlers.onLegalPrivacy,
    onLegalAup: handlers.onLegalAup,
  });

  const heroHost = root.querySelector<HTMLElement>("[data-hero-video]");
  if (heroHost) mountHeroVideo(heroHost);
}
