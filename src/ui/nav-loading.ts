/** Visual spinner on navigation — held until destination route content is ready. */

const LOADING_CLASS = "is-nav-loading";
const ROUTE_LOADING_CLASS = "is-route-loading";

const NAV_ACTIONS = new Set([
  "home",
  "about",
  "learn",
  "learn-article",
  "product",
  "pricing",
  "demo",
  "signin",
  "signup",
  "get-started",
  "dashboard",
  "back",
  "help",
  "help-toc",
  "models",
  "branding",
  "account",
  "admin",
  "owner",
  "ar",
  "forgot",
  "legal-terms",
  "legal-privacy",
  "legal-aup",
]);

let activeButton: HTMLElement | null = null;
let authSubmitHeld = false;
let navTransitionActive = false;
let navTargetPath: string | null = null;
let releasePaintTimer: ReturnType<typeof setTimeout> | null = null;
let mutationDebounce: ReturnType<typeof setTimeout> | null = null;
let installed = false;
let autoReleaseInstalled = false;

export function normalizeNavPath(path: string): string {
  const trimmed = path.replace(/\/$/, "") || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolveNavTargetPath(action: string | null, el: HTMLElement): string | undefined {
  const explicit = el.getAttribute("data-nav-path");
  if (explicit) return normalizeNavPath(explicit);
  if (!action) return undefined;
  const map: Record<string, string> = {
    home: "/",
    about: "/about",
    learn: "/learn",
    product: "/",
    pricing: "/pricing",
    demo: "/demo",
    signin: "/login",
    signup: "/signup",
    dashboard: "/account",
    account: "/account",
    admin: "/admin",
    owner: "/owner",
    help: "/admin/help",
    models: "/admin/models",
    branding: "/admin/branding",
    forgot: "/forgot-password",
    "legal-terms": "/legal/terms",
    "legal-privacy": "/legal/privacy",
    "legal-aup": "/legal/acceptable-use",
    "get-started": "/signup",
    back: "/",
  };
  const mapped = map[action];
  return mapped ? normalizeNavPath(mapped) : undefined;
}

function isNavButton(el: HTMLElement): boolean {
  if (el.classList.contains("mkt-btn") || el.classList.contains("mkt-nav-link")) return true;
  if (el.classList.contains("mkt-nav-menu-item")) return true;
  if (el.classList.contains("admin-action-card")) return true;
  if (el.classList.contains("admin-help-toc-link")) return true;
  if (el.classList.contains("auth-inline-link") || el.classList.contains("auth-shell-back")) return true;
  if (el.classList.contains("auth-submit")) return true;
  const action = el.getAttribute("data-action");
  if (action && NAV_ACTIONS.has(action)) return true;
  return false;
}

function armRouteOverlay(): void {
  document.body.classList.add(ROUTE_LOADING_CLASS);
}

function disarmRouteOverlay(): void {
  document.body.classList.remove(ROUTE_LOADING_CLASS);
}

export function armNavLoading(button: HTMLElement | null): void {
  if (button && !button.classList.contains(LOADING_CLASS)) {
    activeButton = button;
    button.classList.add(LOADING_CLASS);
    button.setAttribute("aria-busy", "true");
  }
  armRouteOverlay();
}

export function releaseNavLoading(options?: { immediate?: boolean }): void {
  if (authSubmitHeld && !options?.immediate) return;
  if (releasePaintTimer) {
    clearTimeout(releasePaintTimer);
    releasePaintTimer = null;
  }
  if (mutationDebounce) {
    clearTimeout(mutationDebounce);
    mutationDebounce = null;
  }
  const buttons = activeButton
    ? [activeButton]
    : Array.from(document.querySelectorAll<HTMLElement>(`.${LOADING_CLASS}`));
  for (const el of buttons) {
    el.classList.remove(LOADING_CLASS);
    el.removeAttribute("aria-busy");
  }
  activeButton = null;
  navTransitionActive = false;
  navTargetPath = null;
  if (options?.immediate) authSubmitHeld = false;
  disarmRouteOverlay();
}

function scheduleNavReleaseAfterPaint(): void {
  if (authSubmitHeld || !navTransitionActive) return;
  if (releasePaintTimer) clearTimeout(releasePaintTimer);
  releasePaintTimer = setTimeout(() => {
    releasePaintTimer = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (authSubmitHeld || !navTransitionActive) return;
        releaseNavLoading({ immediate: true });
      });
    });
  }, 60);
}

/** Call when destination screen has rendered (sync or async). */
export function notifyRouteContentReady(currentPath: string): void {
  if (!navTransitionActive || authSubmitHeld) return;
  if (navTargetPath && normalizeNavPath(currentPath) !== navTargetPath) return;
  scheduleNavReleaseAfterPaint();
}

/** Route navigation — spinner stays until destination route calls notifyRouteContentReady. */
export function beginNavTransition(source?: HTMLElement | null, targetPath?: string): void {
  if (targetPath) navTargetPath = normalizeNavPath(targetPath);
  if (!document.body.classList.contains(ROUTE_LOADING_CLASS)) {
    if (source) armNavLoading(source);
    else armRouteOverlay();
  } else if (source) {
    armNavLoading(source);
  }
  navTransitionActive = true;
}

/** Auth form submit — spinner stays until caller releases on success or error. */
export function beginAuthSubmitLoading(button: HTMLElement | null): void {
  authSubmitHeld = true;
  navTransitionActive = true;
  if (button) armNavLoading(button);
  else armRouteOverlay();
}

export function releaseAuthSubmitLoading(currentPath: string): void {
  authSubmitHeld = false;
  notifyRouteContentReady(currentPath);
}

/** Backup: #app DOM swap while a nav transition is active. */
export function installNavLoadingAutoRelease(
  app: HTMLElement,
  getCurrentPath: () => string
): void {
  if (autoReleaseInstalled) return;
  autoReleaseInstalled = true;
  const observer = new MutationObserver(() => {
    if (!navTransitionActive || authSubmitHeld) return;
    if (!document.body.classList.contains(ROUTE_LOADING_CLASS)) return;
    if (mutationDebounce) clearTimeout(mutationDebounce);
    mutationDebounce = setTimeout(() => {
      mutationDebounce = null;
      notifyRouteContentReady(getCurrentPath());
    }, 120);
  });
  observer.observe(app, { childList: true });
}

/** Capture-phase click: spinner for any nav button before its handler runs. */
export function installGlobalNavLoading(root: HTMLElement = document.body): void {
  if (installed) return;
  installed = true;
  root.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented) return;
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "button, a[data-action], .admin-help-toc-link, .mkt-nav-menu-item"
      );
      if (!btn || !isNavButton(btn)) return;
      if (btn instanceof HTMLButtonElement && btn.type === "submit" && !btn.classList.contains("auth-submit")) {
        return;
      }
      if (btn instanceof HTMLButtonElement && btn.disabled) return;
      const action = btn.getAttribute("data-action");
      if (action === "contact-sales") return;
      beginNavTransition(btn, resolveNavTargetPath(action, btn));
    },
    { capture: true }
  );
}
