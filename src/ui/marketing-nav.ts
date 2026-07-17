import { brandWordmarkImgHtml } from "../shared/brand-assets";
import { escapeHtml } from "../shared/escape-html";

export type MarketingNavHandlers = {
  onHome: () => void;
  onAbout: () => void;
  onProduct: () => void;
  onPricing: () => void;
  onDemo?: () => void;
  onSignIn?: () => void;
  onGetStarted?: () => void;
  onDashboard?: () => void;
};

export type MarketingNavExtraHandlers = {
  onLegalTerms?: () => void;
  onLegalPrivacy?: () => void;
  onLegalAup?: () => void;
};

export type MarketingNavOptions = {
  /** Hide sign-in, dashboard, and account CTAs (mobile marketing pages). */
  mobileExperience: boolean;
  /** Controls single Pricing ↔ Product nav toggle. */
  navPage?: "home" | "pricing";
  signedIn?: boolean;
  workspaceName?: string;
  getStartedLabel?: string;
  getStartedPath?: string;
};

let navBindAbort: AbortController | null = null;

function pricingProductToggleHtml(variant: "desktop" | "mobile", navPage?: "home" | "pricing"): string {
  const onPricing = navPage === "pricing";
  const action = onPricing ? "product" : "pricing";
  const path = onPricing ? "/" : "/pricing";
  const label = onPricing ? "Product" : "Pricing";
  if (variant === "desktop") {
    return `<button type="button" class="mkt-nav-link" data-action="${action}" data-nav-path="${path}">${label}</button>`;
  }
  return `<button type="button" class="mkt-nav-menu-item" data-action="${action}" data-nav-path="${path}" role="menuitem">${label}</button>`;
}

export function marketingNavHtml(handlers: MarketingNavHandlers, options: MarketingNavOptions): string {
  const mobile = options.mobileExperience;
  const signedIn = Boolean(options.signedIn);
  const accountNavLabel = signedIn ? "Account & billing" : "Sign in";
  const getStartedLabel =
    options.getStartedLabel ?? (signedIn ? "Admin dashboard" : mobile ? "Create account" : "Start free");
  const getStartedPath = options.getStartedPath ?? (signedIn ? "/admin" : "/signup");
  const pricingProductToggle = pricingProductToggleHtml("desktop", options.navPage);
  const pricingProductMenuItem = pricingProductToggleHtml("mobile", options.navPage);

  const desktopLinks = mobile
    ? ""
    : `
          ${pricingProductToggle}
          <button type="button" class="mkt-nav-link" data-action="about" data-nav-path="/about">About Atlas AR</button>
          ${
            signedIn && handlers.onDashboard
              ? `<button type="button" class="mkt-nav-link" data-action="dashboard" data-nav-path="/account" title="${escapeHtml(options.workspaceName ?? "")}">${accountNavLabel}</button>`
              : `<button type="button" class="mkt-nav-link" data-action="signin" data-nav-path="/login">${accountNavLabel}</button>`
          }
          <button type="button" class="mkt-btn mkt-btn-primary mkt-btn-sm" data-action="get-started" data-nav-path="${getStartedPath}">${escapeHtml(getStartedLabel)}</button>`;

  const menuItems = mobile
    ? `
            ${
              !signedIn && handlers.onSignIn
                ? `<button type="button" class="mkt-nav-menu-item" data-action="signin" data-nav-path="/login" role="menuitem">Sign in</button>`
                : ""
            }
            ${
              !signedIn && handlers.onGetStarted
                ? `<button type="button" class="mkt-nav-menu-item mkt-nav-menu-item-accent" data-action="get-started" data-nav-path="/signup" role="menuitem">Create account</button>`
                : ""
            }
            ${
              handlers.onDemo
                ? `<button type="button" class="mkt-nav-menu-item mkt-nav-menu-item-accent" data-action="demo" data-nav-path="/demo" role="menuitem">Try live demo</button>`
                : ""
            }
            ${pricingProductMenuItem}
            <button type="button" class="mkt-nav-menu-item" data-action="about" data-nav-path="/about" role="menuitem">About Atlas AR</button>
            ${
              signedIn && handlers.onDashboard
                ? `<button type="button" class="mkt-nav-menu-item" data-action="dashboard" data-nav-path="/account" role="menuitem">${accountNavLabel}</button>`
                : ""
            }
            ${
              signedIn && handlers.onGetStarted
                ? `<button type="button" class="mkt-nav-menu-item mkt-nav-menu-item-accent" data-action="get-started" data-nav-path="${getStartedPath}" role="menuitem">${escapeHtml(getStartedLabel)}</button>`
                : ""
            }`
    : `
            ${pricingProductMenuItem}
            ${
              handlers.onDemo
                ? `<button type="button" class="mkt-nav-menu-item" data-action="demo" role="menuitem">Try live demo</button>`
                : ""
            }
            ${
              !signedIn && handlers.onSignIn
                ? `<button type="button" class="mkt-nav-menu-item" data-action="signin" data-nav-path="/login" role="menuitem">Sign in</button>`
                : ""
            }
            ${
              signedIn && handlers.onDashboard
                ? `<button type="button" class="mkt-nav-menu-item" data-action="dashboard" data-nav-path="/account" role="menuitem">${accountNavLabel}</button>`
                : ""
            }
            ${
              handlers.onGetStarted
                ? `<button type="button" class="mkt-nav-menu-item mkt-nav-menu-item-accent" data-action="get-started" data-nav-path="${getStartedPath}" role="menuitem">${escapeHtml(getStartedLabel)}</button>`
                : ""
            }`;

  return `
      <nav class="mkt-nav" aria-label="Primary">
        <a class="mkt-logo" href="/" data-action="home" data-nav-path="/">${brandWordmarkImgHtml()}</a>
        ${desktopLinks ? `<div class="mkt-nav-links mkt-nav-links-desktop">${desktopLinks}</div>` : ""}
        <div class="mkt-nav-mobile">
          <button
            type="button"
            class="mkt-nav-toggle"
            data-action="nav-toggle"
            aria-expanded="false"
            aria-controls="mkt-nav-menu"
            aria-label="Open menu"
          >
            <span class="mkt-nav-toggle-bar" aria-hidden="true"></span>
            <span class="mkt-nav-toggle-bar" aria-hidden="true"></span>
            <span class="mkt-nav-toggle-bar" aria-hidden="true"></span>
          </button>
          <div id="mkt-nav-menu" class="mkt-nav-menu" role="menu" hidden>
            ${menuItems}
          </div>
        </div>
      </nav>`;
}

function dispatchNavAction(
  action: string,
  handlers: MarketingNavHandlers,
  extra: MarketingNavExtraHandlers | undefined,
  e: Event,
): void {
  if (action === "home") {
    e.preventDefault();
    handlers.onHome();
    return;
  }
  if (action === "about") {
    handlers.onAbout();
    return;
  }
  if (action === "product") {
    handlers.onProduct();
    return;
  }
  if (action === "pricing") {
    handlers.onPricing();
  }
  if (action === "demo") {
    handlers.onDemo?.();
  }
  if (action === "signin") {
    handlers.onSignIn?.();
  }
  if (action === "get-started") {
    handlers.onGetStarted?.();
  }
  if (action === "dashboard") {
    handlers.onDashboard?.();
  }
  if (action === "legal-terms") {
    extra?.onLegalTerms?.();
  }
  if (action === "legal-privacy") {
    extra?.onLegalPrivacy?.();
  }
  if (action === "legal-aup") {
    extra?.onLegalAup?.();
  }
}

export function bindMarketingNav(
  root: HTMLElement,
  handlers: MarketingNavHandlers,
  extra?: MarketingNavExtraHandlers,
): void {
  navBindAbort?.abort();
  navBindAbort = new AbortController();
  const { signal } = navBindAbort;

  const menu = root.querySelector<HTMLElement>("#mkt-nav-menu");
  const toggle = root.querySelector<HTMLElement>(".mkt-nav-toggle");
  const nav = root.querySelector<HTMLElement>(".mkt-nav");

  const closeMenu = (): void => {
    if (!menu || !toggle) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    nav?.classList.remove("mkt-nav-open");
  };

  const openMenu = (): void => {
    if (!menu || !toggle) return;
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    nav?.classList.add("mkt-nav-open");
  };

  toggle?.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeMenu();
      else openMenu();
    },
    { signal },
  );

  document.addEventListener(
    "click",
    (e) => {
      if (!nav || nav.contains(e.target as Node)) return;
      closeMenu();
    },
    { signal },
  );

  root.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement).closest("[data-action]");
      if (!el) return;
      const action = el.getAttribute("data-action");
      if (!action || action === "nav-toggle") return;

      if (menu && !menu.hidden && el.closest("#mkt-nav-menu")) {
        closeMenu();
      }

      dispatchNavAction(action, handlers, extra, e);
    },
    { signal },
  );
}

export function marketingFooterLegalHtml(): string {
  return `
        <nav class="mkt-legal-links" aria-label="Legal">
          <button type="button" class="mkt-nav-link" data-action="legal-terms">Terms of Service</button>
          <button type="button" class="mkt-nav-link" data-action="legal-privacy">Privacy Policy</button>
          <button type="button" class="mkt-nav-link" data-action="legal-aup">Acceptable Use</button>
        </nav>`;
}
