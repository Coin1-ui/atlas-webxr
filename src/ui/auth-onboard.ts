import { normalizeSlug } from "../shared/tenant";
import { authShellHtml, authShellLegalFooterHtml } from "./auth-shell";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type AuthLegalHandlers = {
  onLegalTerms: () => void;
  onLegalPrivacy: () => void;
};

function bindAuthLegalLinks(root: HTMLElement, handlers: AuthLegalHandlers): void {
  root.querySelector("[data-action=legal-terms]")?.addEventListener("click", handlers.onLegalTerms);
  root.querySelector("[data-action=legal-privacy]")?.addEventListener("click", handlers.onLegalPrivacy);
}

export function renderAuthOnboard(
  root: HTMLElement,
  handlers: {
    email: string;
    error?: string;
    trialPlan?: "growth" | "launch";
    onSubmit: (name: string, slug: string) => void | Promise<void>;
    onSignOut: () => void;
    /**
     * Kept optional so `main.ts` still compiles. Delete moved to Account danger
     * zone — stop passing these from `showOnboardScreen` when cleaning up.
     */
    onDeleteAccount?: () => void | Promise<void>;
    canDeleteAccount?: boolean;
    onLegalTerms: () => void;
    onLegalPrivacy: () => void;
  }
): void {
  const trialName = handlers.trialPlan === "launch" ? "Launch" : "Growth";
  const trialFallback = handlers.trialPlan === "launch" ? "Launch ($59/mo incl. tax)" : "Starter ($5/mo incl. tax)";
  const body = `
    <header class="auth-card-header">
      <h1>Create workspace</h1>
      <p class="auth-card-sub">Signed in as <strong>${escapeHtml(handlers.email)}</strong> · <strong>14-day ${trialName} trial</strong> starts when you launch. Subscribe to ${escapeHtml(trialFallback)} before it ends to stay live.</p>
    </header>
    ${handlers.error ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>` : ""}
    <form class="auth-form" data-form="onboard">
      <label class="auth-label">Company / store name
        <input class="auth-input" type="text" name="name" maxlength="80" required placeholder="Acme Furniture" />
      </label>
      <label class="auth-label">URL slug
        <input class="auth-input" type="text" name="slug" maxlength="32" pattern="[a-z0-9-]+" placeholder="acme-furniture" />
        <span class="auth-hint auth-slug-preview">Customer link: <code>/w/<span data-slug-preview>your-slug</span></code></span>
      </label>
      <p class="auth-hint auth-legal-inline">By launching your workspace you agree to our Terms and Privacy Policy.</p>
      <button type="submit" class="a-btn a-btn--primary a-btn--block auth-submit">Launch workspace</button>
    </form>
    <div class="auth-card-actions">
      <button type="button" class="a-btn a-btn--ghost a-btn--block auth-secondary" data-action="signout">Sign out</button>
    </div>`;

  root.innerHTML = authShellHtml("onboard", body, { legalFooter: authShellLegalFooterHtml() });

  const nameInput = root.querySelector('input[name="name"]') as HTMLInputElement;
  const slugInput = root.querySelector('input[name="slug"]') as HTMLInputElement;
  const slugPreview = root.querySelector("[data-slug-preview]") as HTMLElement;

  const syncSlug = () => {
    const slug = normalizeSlug(slugInput.value || nameInput.value || "workspace");
    slugPreview.textContent = slug || "your-slug";
  };
  nameInput.addEventListener("input", () => {
    if (!slugInput.dataset.touched) {
      slugInput.value = normalizeSlug(nameInput.value);
    }
    syncSlug();
  });
  slugInput.addEventListener("input", () => {
    slugInput.dataset.touched = "1";
    slugInput.value = normalizeSlug(slugInput.value);
    syncSlug();
  });

  bindAuthLegalLinks(root, handlers);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
  root.querySelector("[data-form=onboard]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const slug = normalizeSlug((form.elements.namedItem("slug") as HTMLInputElement).value || name);
    void handlers.onSubmit(name, slug);
  });
}
