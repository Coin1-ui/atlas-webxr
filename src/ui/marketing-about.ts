import { escapeHtml } from "../shared/escape-html";
import { ABOUT } from "./about-content";
import { MKT_ASSETS } from "./marketing-assets";
import {
  bindMarketingNav,
  marketingFooterLegalHtml,
  marketingNavHtml,
  type MarketingNavHandlers,
} from "./marketing-nav";

export type AboutPageHandlers = MarketingNavHandlers & {
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
  signedIn?: boolean;
  workspaceName?: string;
  mobileExperience?: boolean;
  getStartedLabel?: string;
  getStartedPath?: string;
};

export function renderAboutPage(root: HTMLElement, handlers: AboutPageHandlers): void {
  const mobile = Boolean(handlers.mobileExperience);

  root.innerHTML = `
    <div class="mkt-page about-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, {
        mobileExperience: mobile,
        navPage: "home",
        signedIn: handlers.signedIn,
        workspaceName: handlers.workspaceName,
        getStartedLabel:
          handlers.getStartedLabel ??
          (handlers.signedIn
            ? mobile
              ? "Browse collection"
              : "Admin dashboard"
            : mobile
              ? "Create account"
              : "Start free"),
        getStartedPath: handlers.getStartedPath,
      })}

      <main class="about-main">
        <header class="about-hero">
          <p class="mkt-eyebrow">${escapeHtml(ABOUT.eyebrow)}</p>
          <h1 class="about-hero-title">${escapeHtml(ABOUT.title)}</h1>
          <p class="about-hero-summary">${escapeHtml(ABOUT.summary)}</p>
          <nav class="about-hero-cta" aria-label="Primary actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="pricing">See pricing</button>
            ${handlers.onDemo ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="demo">Try live demo</button>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="home">Back to home</button>
          </nav>
        </header>

        <section class="about-section about-section-product" aria-labelledby="about-what">
          <h2 id="about-what" class="about-section-title">${escapeHtml(ABOUT.product.headline)}</h2>
          <p class="about-prose">${escapeHtml(ABOUT.product.body)}</p>
          <ul class="about-checklist">
            ${ABOUT.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
          </ul>
        </section>

        <section class="about-section" aria-labelledby="about-audiences">
          <h2 id="about-audiences" class="about-section-title">Who it's for</h2>
          <div class="about-audience-grid">
            ${ABOUT.audiences
              .map(
                (a) => `
              <article class="about-audience-card" id="about-${escapeHtml(a.id)}">
                <h3>${escapeHtml(a.title)}</h3>
                <p>${escapeHtml(a.detail)}</p>
              </article>`,
              )
              .join("")}
          </div>
        </section>

        <section class="about-section" aria-labelledby="about-steps">
          <h2 id="about-steps" class="about-section-title">How it works</h2>
          <ol class="about-steps">
            ${ABOUT.steps
              .map(
                (s) => `
              <li class="about-step">
                <span class="about-step-num" aria-hidden="true">${s.num}</span>
                <div class="about-step-body">
                  <h3>${escapeHtml(s.title)}</h3>
                  <p>${escapeHtml(s.detail)}</p>
                </div>
              </li>`,
              )
              .join("")}
          </ol>
        </section>

        <section class="about-section about-section-security" aria-labelledby="about-security">
          <h2 id="about-security" class="about-section-title">${escapeHtml(ABOUT.security.headline)}</h2>
          <p class="about-prose about-prose-muted">${escapeHtml(ABOUT.security.lead)}</p>
          <dl class="about-security-grid">
            ${ABOUT.security.items
              .map(
                (item) => `
              <div class="about-security-item">
                <dt>${escapeHtml(item.title)}</dt>
                <dd>${escapeHtml(item.detail)}</dd>
              </div>`,
              )
              .join("")}
          </dl>
        </section>

        <section class="about-section about-section-contact" aria-labelledby="about-contact">
          <h2 id="about-contact" class="about-section-title">${escapeHtml(ABOUT.contact.headline)}</h2>
          <p class="about-prose">${escapeHtml(ABOUT.contact.body)}</p>
          <p class="about-contact-email">
            <a href="mailto:${escapeHtml(ABOUT.contact.email)}">Support — ${escapeHtml(ABOUT.contact.email)}</a>
          </p>
          <p class="about-contact-email">
            <a href="mailto:${escapeHtml(ABOUT.contact.salesEmail)}">Sales — ${escapeHtml(ABOUT.contact.salesEmail)}</a>
          </p>
        </section>

        <footer class="about-company-footer" aria-labelledby="about-company">
          <div class="about-company-footer-inner">
            <img
              class="about-company-logo-sm"
              src="${MKT_ASSETS.omniManualLogo}"
              alt=""
              width="160"
              height="104"
              loading="lazy"
            />
            <div class="about-company-footer-text">
              <h2 id="about-company" class="about-company-footer-title">${escapeHtml(ABOUT.company.headline)}</h2>
              <p>${escapeHtml(ABOUT.company.body)}</p>
              <p class="about-company-name">${escapeHtml(ABOUT.company.name)}</p>
              <a
                class="about-company-link"
                href="${escapeHtml(ABOUT.company.url)}"
                target="_blank"
                rel="noopener noreferrer"
              >omnimanual.com — our services ↗</a>
            </div>
          </div>
          <p class="about-disclaimer">${escapeHtml(ABOUT.disclaimer)}</p>
          <p class="about-updated">Page updated ${escapeHtml(ABOUT.effectiveDate)}</p>
        </footer>
      </main>

      <footer class="mkt-footer">
        ${marketingFooterLegalHtml()}
      </footer>
    </div>
  `;

  bindMarketingNav(root, handlers, {
    onLegalTerms: handlers.onLegalTerms,
    onLegalPrivacy: handlers.onLegalPrivacy,
    onLegalAup: handlers.onLegalAup,
  });
}
