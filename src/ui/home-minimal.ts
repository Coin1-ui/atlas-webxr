import {
  applyWorkspaceTheme,
  brandedHeaderHtml,
  mountWorkspaceLogo,
  workspaceLogoUrl,
} from "../branding/workspace-theme";
import type { WorkspaceBranding } from "../shared/tenant";
import { arCtaLabel } from "../shared/ar-cta";
import { MKT } from "./marketing-copy";

export { applyWorkspaceTheme, workspaceLogoUrl, mountWorkspaceLogo, brandedHeaderHtml };

export function renderHomeMinimal(
  root: HTMLElement,
  handlers: {
    cameraWarning?: string;
    title?: string;
    subtitle?: string;
    slug?: string;
    branding?: WorkspaceBranding;
    onStartAr: () => void;
    onRunDeviceCheck: () => void;
    onManageModels?: () => void;
    onQuickLookAr?: () => void;
    onAccount?: () => void;
    onAdmin?: () => void;
    onBack?: () => void;
    iosQuickLookOnly?: boolean;
    /** Show “Download session log (JSON)” on landing (iPhone Safari AR / demo). */
    sessionLogDownload?: boolean;
    onDownloadLog?: () => void;
    /** Hide Start AR when owner disabled it for this workspace. */
    startArEnabled?: boolean;
    /** Hide Run camera check when owner disabled it. */
    cameraCheckEnabled?: boolean;
    /** e.g. "Android · Chrome · browser-based AR" */
    deviceLine?: string;
    footerLine?: string;
    /** Preview / direct AR link — tighter hero layout */
    variant?: "default" | "preview" | "direct-link";
  }
): void {
  const startArOn = handlers.startArEnabled !== false;
  const cameraCheckOn = handlers.cameraCheckEnabled === true;
  const iosOnly = Boolean(handlers.iosQuickLookOnly);
  const variant = handlers.variant ?? "default";
  const title = handlers.title?.trim() || "Atlas AR";
  const subtitle =
    handlers.subtitle?.trim() ||
    (iosOnly
      ? "View models in your space with Safari AR."
      : "Place your 3D models on the floor with browser-based AR.");
  const footerLine =
    handlers.footerLine ?? (iosOnly ? MKT.homeFooterIos : MKT.homeFooterAndroid);
  const hasLogo = Boolean(handlers.slug && workspaceLogoUrl(handlers.slug, handlers.branding));
  const isDesktopPreview =
    variant === "preview" &&
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;
  const primaryLabel = iosOnly
    ? arCtaLabel("landing-ios")
    : isDesktopPreview
      ? arCtaLabel("landing-desktop")
      : arCtaLabel("landing-android");
  const primaryAction = iosOnly ? "quick-look" : "start-ar";
  const showPrimary = startArOn;
  const actionButtons: string[] = [];
  if (showPrimary) {
    actionButtons.push(
      `<button type="button" class="btn btn-primary btn-block ar-landing-cta" data-action="${primaryAction}">${primaryLabel}</button>`,
    );
  }
  if (cameraCheckOn) {
    actionButtons.push(
      `<button type="button" class="btn btn-ghost btn-block" data-action="device-check">${iosOnly ? "Run device check" : "Run camera + AR check"}</button>`,
    );
  }
  if (handlers.sessionLogDownload && handlers.onDownloadLog) {
    actionButtons.push(
      `<button type="button" class="btn btn-ghost btn-block ar-action-btn-log" data-action="session-log">Download session log (JSON)</button>`,
    );
  }
  const actionsHtml =
    actionButtons.length > 0
      ? actionButtons.join("")
      : `<div class="camera-warning ar-landing-alert" role="status">AR is disabled for this workspace. Contact your administrator.</div>`;

  root.innerHTML = `
    <div class="home home-minimal ar-landing-page ar-landing-page--${variant}">
      <div class="ar-landing-card">
        ${brandedHeaderHtml(title, subtitle)}
        ${
          handlers.deviceLine
            ? `<p class="home-sub device-line ar-landing-device" role="status">${escapeHtml(handlers.deviceLine)}</p>`
            : ""
        }
        ${
          handlers.cameraWarning
            ? `<div class="camera-warning ar-landing-alert" role="alert"><strong>Setup.</strong> ${escapeHtml(handlers.cameraWarning)}</div>`
            : ""
        }
        <div class="ar-landing-actions">
          ${actionsHtml}
          <p class="home-sub ios-session-log-status hidden" data-ios-log-status aria-live="polite"></p>
        </div>
        ${
          handlers.onAdmin || handlers.onAccount || handlers.onManageModels || handlers.onBack
            ? `<div class="ar-landing-secondary">
          ${
            handlers.onAdmin
              ? `<button type="button" class="btn btn-ghost btn-block" data-action="admin">Admin dashboard</button>`
              : ""
          }
          ${
            handlers.onAccount
              ? `<button type="button" class="btn btn-ghost btn-block" data-action="account">${handlers.onAdmin ? "Account & billing" : "Sign in / Create account"}</button>`
              : ""
          }
          ${
            handlers.onBack
              ? `<button type="button" class="btn btn-ghost btn-block" data-action="back">${variant === "direct-link" ? "Back to catalog" : "Back to home"}</button>`
              : ""
          }
        </div>`
            : ""
        }
        <footer class="home-footer ar-landing-footer">
          <ul class="ar-landing-trust" aria-label="AR experience">
            ${
              iosOnly
                ? `<li>Tap View in AR → pick a model</li>
            <li>Safari AR: move phone over the floor</li>
            <li>Tap screen to place the model</li>`
                : `<li>Cyan ring = placeable floor</li>
            <li>Red ring = blocked surface</li>
            <li>No app install required</li>`
            }
          </ul>
          <p>${escapeHtml(footerLine)}</p>
        </footer>
      </div>
    </div>
  `;

  if (handlers.slug && handlers.branding && hasLogo) {
    mountWorkspaceLogo(root, handlers.slug, handlers.branding);
  } else {
    root.querySelector("[data-workspace-logo]")?.remove();
  }

  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest("[data-action]");
    if (!el) return;
    if (el.getAttribute("data-action") === "start-ar") handlers.onStartAr();
    if (el.getAttribute("data-action") === "quick-look") handlers.onQuickLookAr?.();
    if (el.getAttribute("data-action") === "session-log") handlers.onDownloadLog?.();
    if (el.getAttribute("data-action") === "device-check") handlers.onRunDeviceCheck();
    if (el.getAttribute("data-action") === "account") handlers.onAccount?.();
    if (el.getAttribute("data-action") === "admin") handlers.onAdmin?.();
    if (el.getAttribute("data-action") === "back") handlers.onBack?.();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
