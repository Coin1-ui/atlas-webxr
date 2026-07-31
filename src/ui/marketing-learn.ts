import { escapeHtml } from "../shared/escape-html";
import {
  LEARN_ARTICLES,
  LEARN_HUB,
  getLearnArticle,
  type LearnArticle,
} from "./learn-content";
import { MKT_ASSETS } from "./marketing-assets";
import {
  bindMarketingNav,
  marketingFooterLegalHtml,
  marketingNavHtml,
  type MarketingNavHandlers,
} from "./marketing-nav";

export type LearnPageHandlers = MarketingNavHandlers & {
  onLearn?: () => void;
  onLearnArticle?: (slug: string) => void;
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
  signedIn?: boolean;
  workspaceName?: string;
  mobileExperience?: boolean;
  getStartedLabel?: string;
  getStartedPath?: string;
};

function navOpts(handlers: LearnPageHandlers) {
  const mobile = Boolean(handlers.mobileExperience);
  return {
    mobileExperience: mobile,
    navPage: "home" as const,
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
  };
}

function articleCardHtml(article: LearnArticle): string {
  const href = `/learn/${escapeHtml(article.slug)}`;
  return `
    <article class="learn-card">
      <p class="learn-card-eyebrow">${escapeHtml(article.eyebrow)}</p>
      <h2 class="learn-card-title">
        <button type="button" class="learn-card-link" data-action="learn-article" data-slug="${escapeHtml(article.slug)}" data-nav-path="${href}">
          ${escapeHtml(article.title)}
        </button>
      </h2>
      <p class="learn-card-summary">${escapeHtml(article.summary)}</p>
      <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="learn-article" data-slug="${escapeHtml(article.slug)}" data-nav-path="${href}">
        Read guide
      </button>
    </article>`;
}

function sectionHtml(article: LearnArticle): string {
  return article.sections
    .map(
      (s, i) => `
        <section class="about-section" aria-labelledby="learn-s-${i}">
          <h2 id="learn-s-${i}" class="about-section-title">${escapeHtml(s.heading)}</h2>
          ${s.paragraphs.map((p) => `<p class="about-prose">${escapeHtml(p)}</p>`).join("")}
          ${
            s.bullets?.length
              ? `<ul class="about-checklist">${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
              : ""
          }
        </section>`,
    )
    .join("");
}

export function renderLearnHub(root: HTMLElement, handlers: LearnPageHandlers): void {
  root.innerHTML = `
    <div class="mkt-page about-page learn-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, navOpts(handlers))}

      <main class="about-main learn-main">
        <header class="about-hero">
          <p class="mkt-eyebrow">${escapeHtml(LEARN_HUB.eyebrow)}</p>
          <h1 class="about-hero-title">${escapeHtml(LEARN_HUB.title)}</h1>
          <p class="about-hero-summary">${escapeHtml(LEARN_HUB.summary)}</p>
          <nav class="about-hero-cta" aria-label="Primary actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="pricing">See pricing</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="home">Back to home</button>
          </nav>
        </header>

        <div class="learn-grid" role="list">
          ${LEARN_ARTICLES.map((a) => `<div role="listitem">${articleCardHtml(a)}</div>`).join("")}
        </div>

        <p class="about-updated">Guides updated ${escapeHtml(LEARN_HUB.updated)}</p>
      </main>

      <footer class="mkt-footer">
        ${marketingFooterLegalHtml()}
      </footer>
    </div>
  `;

  bindLearnPage(root, handlers);
}

export function renderLearnArticle(
  root: HTMLElement,
  slug: string,
  handlers: LearnPageHandlers,
): boolean {
  const article = getLearnArticle(slug);
  if (!article) return false;

  const primaryAction = article.ctaPrimary === "pricing" ? "pricing" : "get-started";

  root.innerHTML = `
    <div class="mkt-page about-page learn-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, navOpts(handlers))}

      <main class="about-main learn-main">
        <nav class="learn-breadcrumb" aria-label="Breadcrumb">
          <button type="button" class="mkt-nav-link" data-action="learn" data-nav-path="/learn">Learn</button>
          <span class="learn-breadcrumb-sep" aria-hidden="true">/</span>
          <span>${escapeHtml(article.eyebrow)}</span>
        </nav>

        <header class="about-hero">
          <p class="mkt-eyebrow">${escapeHtml(article.eyebrow)}</p>
          <h1 class="about-hero-title">${escapeHtml(article.title)}</h1>
          <p class="about-hero-summary">${escapeHtml(article.summary)}</p>
          <nav class="about-hero-cta" aria-label="Primary actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="${primaryAction}">${escapeHtml(article.ctaPrimaryLabel)}</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="learn" data-nav-path="/learn">All guides</button>
          </nav>
        </header>

        ${sectionHtml(article)}

        <section class="about-section about-section-contact" aria-labelledby="learn-cta">
          <h2 id="learn-cta" class="about-section-title">Next step</h2>
          <p class="about-prose">Ready to try floor AR on a real phone? Open pricing for plan limits, or start the free Growth trial — no credit card.</p>
          <nav class="about-hero-cta" aria-label="Closing actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="pricing">See pricing</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="get-started">Start free</button>
          </nav>
        </section>
      </main>

      <footer class="mkt-footer">
        ${marketingFooterLegalHtml()}
      </footer>
    </div>
  `;

  bindLearnPage(root, handlers);
  return true;
}

let learnBindAbort: AbortController | null = null;

function bindLearnPage(root: HTMLElement, handlers: LearnPageHandlers): void {
  bindMarketingNav(root, handlers, {
    onLegalTerms: handlers.onLegalTerms,
    onLegalPrivacy: handlers.onLegalPrivacy,
    onLegalAup: handlers.onLegalAup,
  });

  learnBindAbort?.abort();
  learnBindAbort = new AbortController();
  const { signal } = learnBindAbort;

  root.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement).closest("[data-action=learn-article]");
      if (!el) return;
      const slug = el.getAttribute("data-slug");
      if (slug) handlers.onLearnArticle?.(slug);
    },
    { signal },
  );
}
