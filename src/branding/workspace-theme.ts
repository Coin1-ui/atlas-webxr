import type { PublicWorkspaceConfig, Workspace, WorkspaceBranding } from "../shared/tenant";
import { getApiBase } from "../config/api";

export function applyWorkspaceTheme(workspace: Workspace | PublicWorkspaceConfig | null): void {
  const color = workspace?.branding.primaryColor || "#1565c0";
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-press", color);
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  }
}

/** Prefer same-origin API logo (reliable on mobile) over third-party image hosts. */
export function workspaceLogoUrl(
  slug: string,
  branding: WorkspaceBranding | undefined
): string | undefined {
  if (!branding?.logoUrl?.trim()) return undefined;
  const base = getApiBase();
  if (base) {
    return `${base}/v2/workspaces/${encodeURIComponent(slug)}/logo`;
  }
  return branding.logoUrl.trim();
}

export function mountWorkspaceLogo(root: ParentNode, slug: string, branding: WorkspaceBranding | undefined): void {
  const url = workspaceLogoUrl(slug, branding);
  const img = root.querySelector<HTMLImageElement>("[data-workspace-logo]");
  if (!img) return;
  if (!url) {
    img.remove();
    return;
  }
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.alt = "";
  img.hidden = true;
  img.addEventListener(
    "load",
    () => {
      img.hidden = false;
    },
    { once: true }
  );
  img.addEventListener(
    "error",
    () => {
      img.remove();
    },
    { once: true }
  );
  img.src = url;
}

export function brandedHeaderHtml(title: string, subtitle?: string): string {
  return `
    <header class="home-header branded-header">
      <img class="tenant-logo" data-workspace-logo alt="" hidden />
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="home-sub">${escapeHtml(subtitle)}</p>` : ""}
    </header>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
