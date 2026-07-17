import type { Workspace } from "../shared/tenant";
import { DEFAULT_TENANT_ACCENT } from "../shared/brand-defaults";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import { workspaceApiHint } from "../data/workspace-api";
import { MKT_ASSETS } from "./marketing-assets";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAdminBranding(
  root: HTMLElement,
  workspace: Workspace,
  handlers: {
    error?: string;
    saved?: boolean;
    onSubmit: (input: { name: string; logoUrl: string; primaryColor: string }) => void | Promise<void>;
    onPreview: () => void;
    onBack: () => void;
  }
): void {
  const logoUrl = workspace.branding.logoUrl ?? "";
  const primaryColor = workspace.branding.primaryColor ?? DEFAULT_TENANT_ACCENT;
  const sharePath = `/w/${encodeURIComponent(workspace.slug)}`;

  root.innerHTML = `
    <div class="admin-shell branding-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card">
          ${brandedHeaderHtml("Branding", `${workspace.name} · white-label your customer AR link`)}
          <p class="auth-hint admin-api-hint">${escapeHtml(workspaceApiHint())}</p>

          <div class="branding-preview-card" style="--tenant-accent: ${escapeHtml(primaryColor)}">
            <p class="admin-label">Live preview</p>
            <div class="branding-preview-frame">
              <div class="branding-preview-logo" data-workspace-logo></div>
              <p class="branding-preview-title">${escapeHtml(workspace.name)}</p>
              <p class="branding-preview-sub">Browse the collection · View in AR</p>
              <span class="branding-preview-chip">Customer link: ${escapeHtml(sharePath)}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-action="preview">Open showroom preview</button>
          </div>

          ${
            handlers.saved
              ? `<div class="camera-success" role="status">Branding saved. Open <code>${escapeHtml(sharePath)}</code> to preview on mobile.</div>`
              : ""
          }
          ${
            handlers.error
              ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>`
              : ""
          }

          <form class="auth-form branding-form" data-form="branding">
            <label class="auth-label">Display name
              <input class="auth-input" type="text" name="name" maxlength="80" required value="${escapeHtml(workspace.name)}" />
            </label>
            <label class="auth-label">Logo URL
              <input class="auth-input" type="url" name="logoUrl" placeholder="https://yoursite.com/logo.png" value="${escapeHtml(logoUrl)}" />
              <span class="auth-hint">HTTPS image URL · shown on admin and <code>${escapeHtml(sharePath)}</code></span>
            </label>
            <label class="auth-label">Primary color
              <input class="auth-input branding-color-input" type="color" name="primaryColor" value="${escapeHtml(primaryColor)}" />
              <span class="auth-hint">Buttons and accents on your AR landing page</span>
            </label>
            <button type="submit" class="btn btn-primary btn-block">Save branding</button>
          </form>

          <div class="admin-footer-actions">
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to admin</button>
          </div>
        </div>
      </div>
    </div>`;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);

  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=preview]")?.addEventListener("click", handlers.onPreview);
  root.querySelector("[data-form=branding]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const logoUrlInput = (form.elements.namedItem("logoUrl") as HTMLInputElement).value.trim();
    const primaryColorInput = (form.elements.namedItem("primaryColor") as HTMLInputElement).value;
    void handlers.onSubmit({ name, logoUrl: logoUrlInput, primaryColor: primaryColorInput });
  });
}
