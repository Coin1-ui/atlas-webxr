import type { Workspace } from "../shared/tenant";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import { MKT } from "./marketing-copy";
import { MKT_ASSETS } from "./marketing-assets";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MobileAdminHubHandlers = {
  workspace: Workspace;
  email: string;
  modelCount?: number;
  showOwnerLink?: boolean;
  onShowroom: () => void;
  onBranding: () => void;
  onAccount: () => void;
  onOwner?: () => void;
  onSignOut: () => void;
  onBack: () => void;
};

/** Mobile-friendly operator hub — replaces abrupt desktop-only gate (DES-7). */
export function renderMobileAdminHub(root: HTMLElement, handlers: MobileAdminHubHandlers): void {
  const { workspace } = handlers;
  const sharePath = `/w/${encodeURIComponent(workspace.slug)}`;
  const modelLine =
    handlers.modelCount != null
      ? `${handlers.modelCount} model${handlers.modelCount === 1 ? "" : "s"} in catalog`
      : "Upload models from a desktop browser";

  root.innerHTML = `
    <div class="admin-shell mobile-admin-hub">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card mobile-admin-hub-card">
          ${brandedHeaderHtml(workspace.name, `Signed in as ${escapeHtml(handlers.email)}`)}
          <p class="auth-hint mobile-admin-hub-lead">${escapeHtml(MKT.adminMobileHubLead)}</p>

          <div class="admin-card admin-card-highlight mobile-admin-hub-link-card">
            <p class="admin-label">Customer showroom</p>
            <code class="admin-code">${escapeHtml(sharePath)}</code>
            <p class="auth-hint">${escapeHtml(modelLine)}</p>
            <button type="button" class="btn btn-primary btn-block" data-action="showroom">Browse collection</button>
          </div>

          <div class="mobile-admin-hub-grid" role="list">
            <button type="button" class="mobile-admin-hub-tile" data-action="branding" role="listitem">
              <span class="mobile-admin-hub-tile-icon" aria-hidden="true">◇</span>
              <span class="mobile-admin-hub-tile-title">Branding</span>
              <span class="mobile-admin-hub-tile-meta">Logo &amp; accent color</span>
            </button>
            <button type="button" class="mobile-admin-hub-tile" data-action="account" role="listitem">
              <span class="mobile-admin-hub-tile-icon" aria-hidden="true">◎</span>
              <span class="mobile-admin-hub-tile-title">Account</span>
              <span class="mobile-admin-hub-tile-meta">Plan &amp; billing</span>
            </button>
            ${
              handlers.showOwnerLink && handlers.onOwner
                ? `<button type="button" class="mobile-admin-hub-tile" data-action="owner" role="listitem">
              <span class="mobile-admin-hub-tile-icon" aria-hidden="true">⚙</span>
              <span class="mobile-admin-hub-tile-title">Owner console</span>
              <span class="mobile-admin-hub-tile-meta">Platform settings</span>
            </button>`
                : ""
            }
          </div>

          <div class="mobile-admin-hub-desktop-note" role="note">
            <p class="admin-label">${escapeHtml(MKT.adminDesktopOnlyTitle)}</p>
            <p class="auth-hint">${escapeHtml(MKT.adminDesktopOnlyBody)}</p>
          </div>

          <div class="admin-footer-actions">
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">\u2190 Back to home</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="signout">Sign out</button>
          </div>
        </div>
      </div>
    </div>`;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);

  root.querySelector("[data-action=showroom]")?.addEventListener("click", handlers.onShowroom);
  root.querySelector("[data-action=branding]")?.addEventListener("click", handlers.onBranding);
  root.querySelector("[data-action=account]")?.addEventListener("click", handlers.onAccount);
  root.querySelector("[data-action=owner]")?.addEventListener("click", () => handlers.onOwner?.());
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
}
