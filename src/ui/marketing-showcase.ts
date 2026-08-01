import { escapeHtml } from "../shared/escape-html";
import {
  SHOWCASE_PRODUCTS,
  getShowcaseProduct,
  showcaseCatalogPath,
  showcaseProductPath,
  type ShowcaseProduct,
} from "../shared/showcase-catalog";
import {
  getShowcaseLinkConfig,
  resetShowcaseLinkConfig,
  setShowcaseLinkConfig,
  type ShowcaseLinkConfig,
} from "../shared/showcase-link-overrides";
import { MKT_ASSETS } from "./marketing-assets";
import {
  bindMarketingNav,
  marketingFooterLegalHtml,
  marketingNavHtml,
  type MarketingNavHandlers,
} from "./marketing-nav";

export type ShowcasePageHandlers = MarketingNavHandlers & {
  onShowcase?: () => void;
  onShowcaseProduct?: (id: string) => void;
  onDirectAr?: (id: string) => void;
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
  signedIn?: boolean;
  workspaceName?: string;
  mobileExperience?: boolean;
  getStartedLabel?: string;
  getStartedPath?: string;
};

function navOpts(handlers: ShowcasePageHandlers) {
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

function absolutePreview(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${location.origin}${path}`;
}

function productCardHtml(product: ShowcaseProduct): string {
  const href = showcaseProductPath(product.id);
  const links = getShowcaseLinkConfig(product.id);
  return `
    <article class="showcase-card">
      <button type="button" class="showcase-card-media" data-action="showcase-product" data-id="${escapeHtml(product.id)}" data-nav-path="${escapeHtml(href)}" aria-label="Open ${escapeHtml(product.name)}">
        <span class="showcase-card-badge">${escapeHtml(product.eyebrow)}</span>
        <span class="showcase-card-sku">${escapeHtml(product.name)}</span>
      </button>
      <div class="showcase-card-body">
        <h2 class="showcase-card-title">
          <button type="button" class="showcase-card-link" data-action="showcase-product" data-id="${escapeHtml(product.id)}" data-nav-path="${escapeHtml(href)}">
            ${escapeHtml(product.name)}
          </button>
        </h2>
        <p class="showcase-card-summary">${escapeHtml(product.summary)}</p>
        <div class="showcase-card-actions">
          <button type="button" class="mkt-btn mkt-btn-primary mkt-btn-sm" data-action="showcase-product" data-id="${escapeHtml(product.id)}" data-nav-path="${escapeHtml(href)}">
            View product
          </button>
          <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="direct-ar" data-id="${escapeHtml(product.id)}" data-nav-path="${escapeHtml(links.directArUrl)}">
            Direct AR
          </button>
        </div>
      </div>
    </article>`;
}

function linkEditorHtml(productId: string, links: ShowcaseLinkConfig): string {
  return `
    <section class="showcase-link-editor" aria-labelledby="showcase-link-editor-title">
      <div class="showcase-link-editor-head">
        <h2 id="showcase-link-editor-title" class="showcase-link-editor-title">Link options (demo)</h2>
        <p class="showcase-link-editor-lead">
          Same fields as Admin → Models. Edit, save, then open AR — <strong>Back to catalog</strong> uses the exit URL.
        </p>
      </div>

      <label class="showcase-link-field">
        <span class="showcase-link-label">Direct AR link</span>
        <span class="showcase-link-hint">Share or open this URL for a one-SKU AR landing (default <code>/ar/{id}</code>).</span>
        <div class="showcase-link-row">
          <input
            type="text"
            class="showcase-link-input"
            data-showcase-direct-input
            spellcheck="false"
            autocomplete="off"
            placeholder="/ar/${escapeHtml(productId)}"
            value="${escapeHtml(links.directArUrl)}"
          />
          <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="copy-direct">Copy</button>
        </div>
      </label>

      <label class="showcase-link-field">
        <span class="showcase-link-label">Back to catalog destination</span>
        <span class="showcase-link-hint">When the viewer taps <strong>Back to catalog</strong> on Start AR, open this URL (<code>arExitUrl</code>).</span>
        <div class="showcase-link-row">
          <input
            type="text"
            class="showcase-link-input"
            data-showcase-exit-input
            spellcheck="false"
            autocomplete="off"
            placeholder="${escapeHtml(`/sales-deck/showcase/${productId}`)}"
            value="${escapeHtml(links.arExitUrl)}"
          />
          <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="copy-exit">Copy</button>
        </div>
      </label>

      <div class="showcase-link-actions">
        <button type="button" class="mkt-btn mkt-btn-primary mkt-btn-sm" data-action="save-links">Save links</button>
        <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="reset-links">Reset defaults</button>
        <button type="button" class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-action="direct-ar" data-id="${escapeHtml(productId)}">
          Open Direct AR
        </button>
      </div>
      <p class="showcase-link-status" data-showcase-link-status aria-live="polite"></p>
      <p class="showcase-link-preview">
        Preview Direct AR: <code data-showcase-direct-preview>${escapeHtml(absolutePreview(links.directArUrl))}</code><br />
        Preview exit: <code data-showcase-exit-preview>${escapeHtml(absolutePreview(links.arExitUrl))}</code>
      </p>
    </section>`;
}

export function renderShowcaseCatalog(root: HTMLElement, handlers: ShowcasePageHandlers): void {
  root.innerHTML = `
    <div class="mkt-page showcase-page">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, navOpts(handlers))}

      <main class="showcase-main">
        <header class="showcase-hero">
          <p class="mkt-eyebrow">
            <a class="showcase-deck-link" href="/sales-deck/index.html">← Sales deck</a>
            · Sales demo
          </p>
          <h1 class="showcase-hero-title">Product pages with Direct AR</h1>
          <p class="showcase-hero-summary">
            Cozey-style single product pages for Atlas sales demos. Open a SKU, edit
            <strong>Direct AR</strong> and <strong>Back to catalog</strong> links, then prove the loop on phone.
          </p>
        </header>

        <div class="showcase-grid" role="list">
          ${SHOWCASE_PRODUCTS.map((p) => `<div role="listitem">${productCardHtml(p)}</div>`).join("")}
        </div>

        <section class="showcase-howto" aria-labelledby="showcase-howto-title">
          <h2 id="showcase-howto-title" class="showcase-howto-title">How to demo</h2>
          <ol class="showcase-howto-list">
            <li>Open a product page (like a retailer PDP).</li>
            <li>Edit <strong>Direct AR link</strong> and <strong>Back to catalog</strong> — Save links.</li>
            <li>Tap <strong>View in AR</strong> / Open Direct AR.</li>
            <li>Tap <strong>Back to catalog</strong> — confirms the exit URL you set.</li>
          </ol>
        </section>
      </main>

      ${marketingFooterLegalHtml()}
    </div>`;

  bindShowcase(root, handlers);
}

export function renderShowcaseProduct(
  root: HTMLElement,
  productId: string,
  handlers: ShowcasePageHandlers,
): void {
  const product = getShowcaseProduct(productId);
  if (!product) {
    renderShowcaseCatalog(root, handlers);
    return;
  }

  const catalogHref = showcaseCatalogPath();
  const links = getShowcaseLinkConfig(product.id);
  const arHref = links.directArUrl;

  root.innerHTML = `
    <div class="mkt-page showcase-page showcase-pdp">
      <div class="mkt-bg" style="background-image: url('${MKT_ASSETS.heroBg}')"></div>
      <div class="mkt-bg-vignette" aria-hidden="true"></div>
      ${marketingNavHtml(handlers, navOpts(handlers))}

      <main class="showcase-pdp-main">
        <nav class="showcase-crumb" aria-label="Breadcrumb">
          <a class="showcase-crumb-link" href="/sales-deck/index.html">Sales deck</a>
          <span class="showcase-crumb-sep" aria-hidden="true">/</span>
          <button type="button" class="showcase-crumb-link" data-action="showcase" data-nav-path="${catalogHref}">Catalog</button>
          <span class="showcase-crumb-sep" aria-hidden="true">/</span>
          <span class="showcase-crumb-current">${escapeHtml(product.name)}</span>
        </nav>

        <div class="showcase-pdp-layout">
          <div class="showcase-pdp-stage" aria-hidden="true">
            <p class="showcase-pdp-stage-kicker">${escapeHtml(product.eyebrow)}</p>
            <p class="showcase-pdp-stage-name">${escapeHtml(product.name)}</p>
            <p class="showcase-pdp-stage-hint">True-scale floor AR · Chrome &amp; Safari</p>
          </div>

          <div class="showcase-pdp-copy">
            <p class="mkt-eyebrow">${escapeHtml(product.eyebrow)}</p>
            <h1 class="showcase-pdp-title">${escapeHtml(product.name)}</h1>
            <p class="showcase-pdp-summary">${escapeHtml(product.summary)}</p>
            <ul class="showcase-pdp-details">
              ${product.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
            </ul>

            <div class="showcase-pdp-cta">
              <button type="button" class="mkt-btn mkt-btn-primary" data-action="direct-ar" data-id="${escapeHtml(product.id)}" data-nav-path="${escapeHtml(arHref)}">
                View in AR
              </button>
              <button type="button" class="mkt-btn mkt-btn-ghost" data-action="showcase" data-nav-path="${catalogHref}">
                Back to catalog
              </button>
            </div>

            <p class="showcase-pdp-note">
              Direct AR: <code data-showcase-direct-live>${escapeHtml(arHref)}</code>
              · Exit: <code data-showcase-exit-live>${escapeHtml(links.arExitUrl)}</code>
            </p>
          </div>
        </div>

        ${linkEditorHtml(product.id, links)}
      </main>

      ${marketingFooterLegalHtml()}
    </div>`;

  bindShowcase(root, handlers, product.id);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function bindShowcase(root: HTMLElement, handlers: ShowcasePageHandlers, productId?: string): void {
  bindMarketingNav(root, handlers);

  root.querySelectorAll("[data-action=showcase]").forEach((el) => {
    el.addEventListener("click", () => handlers.onShowcase?.());
  });
  root.querySelectorAll("[data-action=showcase-product]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.id;
      if (id) handlers.onShowcaseProduct?.(id);
    });
  });
  const statusEl = root.querySelector<HTMLElement>("[data-showcase-link-status]");
  const directInput = root.querySelector<HTMLInputElement>("[data-showcase-direct-input]");
  const exitInput = root.querySelector<HTMLInputElement>("[data-showcase-exit-input]");
  const directPreview = root.querySelector<HTMLElement>("[data-showcase-direct-preview]");
  const exitPreview = root.querySelector<HTMLElement>("[data-showcase-exit-preview]");
  const directLive = root.querySelector<HTMLElement>("[data-showcase-direct-live]");
  const exitLive = root.querySelector<HTMLElement>("[data-showcase-exit-live]");

  const syncPreview = (links: ShowcaseLinkConfig) => {
    if (directPreview) directPreview.textContent = absolutePreview(links.directArUrl);
    if (exitPreview) exitPreview.textContent = absolutePreview(links.arExitUrl);
    if (directLive) directLive.textContent = links.directArUrl;
    if (exitLive) exitLive.textContent = links.arExitUrl;
    root.querySelectorAll<HTMLElement>("[data-action=direct-ar]").forEach((btn) => {
      btn.setAttribute("data-nav-path", links.directArUrl);
    });
  };

  const setStatus = (msg: string) => {
    if (statusEl) statusEl.textContent = msg;
  };

  const readInputs = (): ShowcaseLinkConfig | null => {
    if (!productId || !directInput || !exitInput) return null;
    return {
      directArUrl: directInput.value.trim() || getShowcaseLinkConfig(productId).directArUrl,
      arExitUrl: exitInput.value.trim() || getShowcaseLinkConfig(productId).arExitUrl,
    };
  };

  const persistInputs = (): ShowcaseLinkConfig | null => {
    if (!productId) return null;
    const draft = readInputs();
    if (!draft) return getShowcaseLinkConfig(productId);
    const next = setShowcaseLinkConfig(productId, draft);
    syncPreview(next);
    return next;
  };

  root.querySelectorAll("[data-action=direct-ar]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.id;
      if (!id) return;
      if (productId && id === productId) persistInputs();
      handlers.onDirectAr?.(id);
    });
  });

  if (!productId) return;

  root.querySelector("[data-action=save-links]")?.addEventListener("click", () => {
    const next = persistInputs();
    if (next && directInput && exitInput) {
      directInput.value = next.directArUrl;
      exitInput.value = next.arExitUrl;
    }
    setStatus("Saved — Open Direct AR, then tap Back to catalog to verify the exit URL.");
  });

  root.querySelector("[data-action=reset-links]")?.addEventListener("click", () => {
    const next = resetShowcaseLinkConfig(productId);
    if (directInput) directInput.value = next.directArUrl;
    if (exitInput) exitInput.value = next.arExitUrl;
    syncPreview(next);
    setStatus("Reset to defaults.");
  });

  root.querySelector("[data-action=copy-direct]")?.addEventListener("click", () => {
    const text = absolutePreview(directInput?.value ?? "");
    void copyText(text).then((ok) => setStatus(ok ? "Direct AR link copied." : "Could not copy — select the field manually."));
  });

  root.querySelector("[data-action=copy-exit]")?.addEventListener("click", () => {
    const text = absolutePreview(exitInput?.value ?? "");
    void copyText(text).then((ok) => setStatus(ok ? "Exit URL copied." : "Could not copy — select the field manually."));
  });

  const onInput = () => {
    const draft = readInputs();
    if (draft) syncPreview(draft);
  };
  directInput?.addEventListener("input", onInput);
  exitInput?.addEventListener("input", onInput);
}
