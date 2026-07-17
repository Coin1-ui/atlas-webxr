import type { Workspace } from "../shared/tenant";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import { workspaceApiHint } from "../data/workspace-api";
import type { WorkspaceUsageResponse } from "../data/usage-api";
import { formatStorageBytes } from "../shared/plan-limits";
import { workspacePlanLabel, trialBannerHtml, mountTrialCountdown } from "../shared/trial";
import { MKT_ASSETS } from "./marketing-assets";
import type { OnboardingState } from "../shared/onboarding-progress";
import { onboardingBannerHtml } from "./onboarding-get-started";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function usageStatHtml(
  usage: WorkspaceUsageResponse,
  unrestricted: boolean,
): string {
  const limitSuffix = (val: number, formatter: (n: number) => string) =>
    unrestricted
      ? `<span class="admin-stat-unlimited"> · tracked · no limit</span>`
      : `<span> / ${formatter(val)}</span>`;

  return `<div class="admin-usage-grid${unrestricted ? " admin-usage-grid--operator" : ""}">
        <div class="admin-stat">
          <span class="admin-stat-label">Models</span>
          <span class="admin-stat-val">${usage.usage.modelCount}${unrestricted ? "" : `<span> / ${usage.limits.models}</span>`}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">AR sessions</span>
          <span class="admin-stat-val">${usage.usage.sessionCount}${unrestricted ? "" : `<span> / ${usage.limits.sessionsPerMonth}</span>`}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">Storage</span>
          <span class="admin-stat-val">${formatStorageBytes(usage.usage.storageBytes)}${limitSuffix(usage.limits.storageBytes, formatStorageBytes)}</span>
        </div>
      </div>
      ${
        unrestricted
          ? `<p class="auth-hint admin-usage-operator-note">Platform operator account — usage is tracked for visibility; no plan limits apply.</p>`
          : usage.warnings.length
            ? usage.warnings
                .map(
                  (w) =>
                    `<div class="${w.level === "critical" ? "camera-warning" : "camera-success"}" role="status">${escapeHtml(w.message)}</div>`,
                )
                .join("")
            : ""
      }`;
}

export function renderAdminDashboard(
  root: HTMLElement,
  workspace: Workspace,
  handlers: {
    email: string;
    usage?: WorkspaceUsageResponse | null;
    usageUnrestricted?: boolean;
    showOwnerLink?: boolean;
    canDeleteAccount?: boolean;
    onboarding?: { state: OnboardingState; modelCount: number } | null;
    onGetStarted?: () => void;
    onHelp?: () => void;
    onManageModels: () => void;
    onBranding: () => void;
    onOpenAr: () => void;
    onAccount: () => void;
    onOwner?: () => void;
    onSignOut: () => void;
    onDeleteAccount: () => void | Promise<void>;
    onBack: () => void;
  },
): void {
  const sharePath = `/w/${encodeURIComponent(workspace.slug)}`;
  const usage = handlers.usage;
  const unrestricted = Boolean(handlers.usageUnrestricted);
  const planLabel = workspacePlanLabel(workspace);
  const trialBanner = unrestricted ? "" : trialBannerHtml(workspace);
  const usageHtml =
    usage != null
      ? `<section class="admin-section"><h2 class="admin-section-title">Usage (${escapeHtml(usage.usage.month)})</h2>${usageStatHtml(usage, unrestricted)}</section>`
      : `<section class="admin-section"><p class="auth-hint">Usage data unavailable — check API connection or refresh after uploading models.</p></section>`;
  const modelCount = usage?.usage.modelCount ?? handlers.onboarding?.modelCount ?? 0;
  const onboardingBanner =
    handlers.onboarding && handlers.onGetStarted
      ? onboardingBannerHtml(handlers.onboarding.state, modelCount)
      : "";

  root.innerHTML = `
    <div class="admin-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card">
          ${brandedHeaderHtml(workspace.name, `Signed in as ${handlers.email}`)}
          <p class="auth-hint admin-api-hint">${escapeHtml(workspaceApiHint())}</p>

          ${trialBanner}

          ${onboardingBanner}

          <div class="admin-card admin-card-highlight">
            <p class="admin-label">Customer AR link</p>
            <code class="admin-code">${escapeHtml(sharePath)}</code>
            <p class="auth-hint">Plan: <strong>${escapeHtml(planLabel)}</strong> · Models isolated to this workspace</p>
          </div>

          ${usageHtml}

          <div class="admin-action-grid">
            <button type="button" class="admin-action-card admin-action-primary" data-action="models">
              <span class="admin-action-icon" aria-hidden="true">◆</span>
              <span class="admin-action-title">Manage 3D models</span>
              <span class="admin-action-meta">Upload GLB · assign to catalog</span>
            </button>
            <button type="button" class="admin-action-card" data-action="branding">
              <span class="admin-action-icon" aria-hidden="true">◇</span>
              <span class="admin-action-title">Branding &amp; colors</span>
              <span class="admin-action-meta">Logo · accent · customer UI</span>
            </button>
            <button type="button" class="admin-action-card" data-action="ar">
              <span class="admin-action-icon" aria-hidden="true">◎</span>
              <span class="admin-action-title">Preview AR</span>
              <span class="admin-action-meta">Test floor placement live</span>
            </button>
          </div>

          <div class="admin-footer-actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="account">Account &amp; billing</button>
            ${handlers.onHelp ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="help">Admin help</button>` : ""}
            ${
              handlers.showOwnerLink && handlers.onOwner
                ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="owner">Owner dashboard</button>`
                : ""
            }
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to home</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="signout">Sign out</button>
            ${
              handlers.canDeleteAccount !== false
                ? `<button type="button" class="mkt-btn auth-danger" data-action="delete">Delete account</button>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>`;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);

  root.querySelector("[data-action=get-started]")?.addEventListener("click", () => handlers.onGetStarted?.());
  root.querySelector("[data-action=help]")?.addEventListener("click", () => handlers.onHelp?.());
  root.querySelector("[data-action=account]")?.addEventListener("click", handlers.onAccount);
  root.querySelector("[data-action=owner]")?.addEventListener("click", () => handlers.onOwner?.());
  root.querySelector("[data-action=models]")?.addEventListener("click", handlers.onManageModels);
  root.querySelector("[data-action=branding]")?.addEventListener("click", handlers.onBranding);
  root.querySelector("[data-action=ar]")?.addEventListener("click", handlers.onOpenAr);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
  root.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    void handlers.onDeleteAccount();
  });
  mountTrialCountdown(root, workspace);
}
