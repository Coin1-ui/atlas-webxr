import type { Workspace } from "../shared/tenant";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import type { WorkspaceUsageResponse } from "../data/usage-api";
import { formatStorageBytes, formatSessionsLimit, isUnlimitedSessionsLimit } from "../shared/plan-limits";
import { estimateOverageUsd, planDisplayName, upgradeOptions, type PlanTier } from "../shared/plan-display";
import { effectiveBillingTier, trialProfilePlanLine, accountTrialBannerHtml, trialSuspendedBannerHtml, mountTrialCountdown, planActionVerbForTier, hasLiveBillingSubscription, subscribedBillingTier } from "../shared/trial";
import { isOveragePaidLocally } from "../data/billing-api";
import {
  billingCountryOptions,
  formatBillingCountryLabel,
  isSupportedBillingCountry,
} from "../shared/dodo-billing-countries";
import { MKT } from "./marketing-copy";
import { MKT_ASSETS } from "./marketing-assets";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readBillingCountry(root: HTMLElement): string {
  return (
    (root.querySelector("[name=billingCountry]") as HTMLSelectElement | null)?.value
      .trim()
      .toUpperCase() ?? ""
  );
}

function isValidBillingCountry(
  country: string,
  provider: Workspace["billingProvider"],
): boolean {
  return isSupportedBillingCountry(country, provider ?? "dodo");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function renderAccountPage(
  root: HTMLElement,
  data: {
    email: string;
    userId: string;
    cognitoEnabled: boolean;
    workspace: Workspace;
    usage?: WorkspaceUsageResponse | null;
    passwordError?: string;
    passwordSuccess?: string;
    billingError?: string;
    billingSuccess?: string;
    overagePaid?: boolean;
    usageUnrestricted?: boolean;
  },
  handlers: {
    onChangePassword: (current: string, next: string) => void | Promise<void>;
    onUpgradePlan: (
      tier: PlanTier,
      checkout: { billingCountry: string; couponCode?: string },
    ) => void | Promise<void>;
    onManageBilling?: (checkout: { billingCountry: string }) => void | Promise<void>;
    onCancelBilling?: () => void | Promise<void>;
    onPayOverage: (amountUsd: number) => void | Promise<void>;
    onAdmin: () => void;
    onBranding?: () => void;
    onOwner?: () => void;
    onPricing: () => void;
    onSignOut: () => void;
    onBack: () => void;
    showAdminLink?: boolean;
    showAdminDesktopNote?: boolean;
    showOwnerLink?: boolean;
  }
): void {
  const { workspace, usage } = data;
  const unrestricted = Boolean(data.usageUnrestricted);
  const trialBanner = unrestricted ? "" : accountTrialBannerHtml(workspace);
  const suspendedBanner = unrestricted ? "" : trialSuspendedBannerHtml(workspace);
  const upgrades = unrestricted ? [] : upgradeOptions(workspace);
  const overageUsd =
    usage && usage.usage && !unrestricted
      ? estimateOverageUsd(effectiveBillingTier(workspace), usage.usage, usage.limits)
      : 0;
  const hasOverage = !unrestricted && overageUsd > 0;
  const overagePaid = data.overagePaid ?? (usage ? isOveragePaidLocally(workspace.id, usage.usage.month) : false);

  const usageHtml = usage
    ? `<div class="admin-usage-grid account-usage-grid${unrestricted ? " admin-usage-grid--operator" : ""}">
        <div class="admin-stat">
          <span class="admin-stat-label">Models</span>
          <span class="admin-stat-val">${usage.usage.modelCount}${unrestricted ? `<span class="admin-stat-unlimited"> · tracked · no limit</span>` : `<span> / ${usage.limits.models}</span>`}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">AR sessions</span>
          <span class="admin-stat-val">${usage.usage.sessionCount}${unrestricted ? `<span class="admin-stat-unlimited"> · tracked · no limit</span>` : isUnlimitedSessionsLimit(usage.limits.sessionsPerMonth) ? `<span class="admin-stat-unlimited"> · unlimited</span>` : `<span> / ${formatSessionsLimit(usage.limits.sessionsPerMonth)}</span>`}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">Storage</span>
          <span class="admin-stat-val">${formatStorageBytes(usage.usage.storageBytes)}${unrestricted ? `<span class="admin-stat-unlimited"> · tracked · no limit</span>` : `<span> / ${formatStorageBytes(usage.limits.storageBytes)}</span>`}</span>
        </div>
      </div>
      ${
        unrestricted
          ? `<p class="auth-hint admin-usage-operator-note">Platform operator account — usage tracked for visibility; no plan limits or overage.</p>`
          : usage.warnings.length
            ? usage.warnings
                .map(
                  (w) =>
                    `<div class="${w.level === "critical" ? "camera-warning" : "camera-success"}" role="status">${escapeHtml(w.message)}</div>`,
                )
                .join("")
            : ""
      }`
    : `<p class="auth-hint">Usage stats will appear when the usage API is connected.</p>`;

  const billingIsLive = hasLiveBillingSubscription(workspace);
  const cancelScheduled = billingIsLive && workspace.billingCancelAtPeriodEnd === true;
  const paidBillingTier = subscribedBillingTier(workspace);
  const billingPlanName = paidBillingTier
    ? planDisplayName(workspace.plan, paidBillingTier)
    : trialProfilePlanLine(workspace);
  const countryOptionsHtml = billingCountryOptions(workspace.billingProvider)
    .map(
      (country) =>
        `<option value="${escapeHtml(country.code)}">${escapeHtml(formatBillingCountryLabel(country))}</option>`,
    )
    .join("");

  const upgradeHtml =
    upgrades.length > 0
      ? `<div class="account-plan-grid">
          ${upgrades
            .map(
              (tier) => `
            <button type="button" class="account-plan-card" data-action="upgrade" data-tier="${escapeHtml(tier.id)}">
              <span class="account-plan-name">${escapeHtml(tier.name)}</span>
              <span class="account-plan-price">${escapeHtml(tier.price)}</span>
              <span class="account-plan-cta">${planActionVerbForTier(workspace, tier.id)}</span>
            </button>`,
            )
            .join("")}
        </div>`
      : `<p class="auth-hint">You are on our highest self-serve tier. <button type="button" class="auth-inline-link" data-action="pricing">Contact sales for Scale</button>.</p>`;

  root.innerHTML = `
    <div class="admin-shell account-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card account-card">
          ${brandedHeaderHtml("Account", workspace.name)}
          ${trialBanner}
          ${suspendedBanner}
          <p class="auth-hint account-signed-in">Signed in as <strong>${escapeHtml(data.email)}</strong></p>
          ${
            handlers.showAdminDesktopNote
              ? `<div class="camera-success account-desktop-note" role="note">
                  <strong>${escapeHtml(MKT.adminDesktopOnlyTitle)}</strong>
                  <p class="auth-hint">${escapeHtml(MKT.adminDesktopOnlyBody)}</p>
                </div>`
              : ""
          }

          <section class="account-section">
            <h2 class="admin-section-title">Profile</h2>
            <dl class="account-dl">
              <div><dt>Email</dt><dd>${escapeHtml(data.email)}</dd></div>
              <div><dt>User ID</dt><dd><code class="admin-code">${escapeHtml(data.userId)}</code></dd></div>
              <div><dt>Workspace ID</dt><dd><code class="admin-code">${escapeHtml(workspace.id)}</code></dd></div>
              <div><dt>Showroom slug</dt><dd><code class="admin-code">/w/${escapeHtml(workspace.slug)}</code></dd></div>
              <div><dt>Current plan</dt><dd><strong>${escapeHtml(trialProfilePlanLine(workspace))}</strong></dd></div>
              <div><dt>Workspace created</dt><dd>${escapeHtml(formatDate(workspace.createdAt))}</dd></div>
            </dl>
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Change password</h2>
            ${data.passwordError ? `<div class="camera-warning" role="alert">${escapeHtml(data.passwordError)}</div>` : ""}
            ${data.passwordSuccess ? `<div class="camera-success" role="status">${escapeHtml(data.passwordSuccess)}</div>` : ""}
            ${
              data.cognitoEnabled
                ? `<form class="auth-form" data-form="password">
                    <label class="auth-label">Current password<input class="auth-input" type="password" name="current" autocomplete="current-password" required /></label>
                    <label class="auth-label">New password<input class="auth-input" type="password" name="next" autocomplete="new-password" minlength="8" required /></label>
                    <label class="auth-label">Confirm new password<input class="auth-input" type="password" name="confirm" autocomplete="new-password" minlength="8" required /></label>
                    <button type="submit" class="mkt-btn mkt-btn-primary auth-submit">Update password</button>
                  </form>`
                : `<p class="auth-dev-hint">Dev mode: passwords are not stored server-side. Use Cognito in production to change your password here.</p>`
            }
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Plan &amp; billing</h2>
            ${data.billingError ? `<div class="camera-warning" role="alert">${escapeHtml(data.billingError)}</div>` : ""}
            ${data.billingSuccess ? `<div class="camera-success" role="status">${escapeHtml(data.billingSuccess)}</div>` : ""}
            ${
              workspace.billingSubscriptionId
                ? `<dl class="account-dl">
                    <div><dt>Plan</dt><dd><strong>${escapeHtml(billingPlanName)}</strong></dd></div>
                    <div><dt>Status</dt><dd><strong>${escapeHtml(workspace.billingStatus ?? "pending")}</strong></dd></div>
                    <div><dt>Provider</dt><dd>${escapeHtml(workspace.billingProvider === "zoho" ? "Zoho (India)" : "Dodo Payments")}</dd></div>
                    ${workspace.billingCurrentPeriodEnd ? `<div><dt>Current period ends</dt><dd>${escapeHtml(formatDate(workspace.billingCurrentPeriodEnd))}</dd></div>` : ""}
                  </dl>`
                : ""
            }
            <div class="account-checkout-fields">
              <label class="auth-label">Billing country (required)
                <select class="auth-input" name="billingCountry" autocomplete="country" required>
                  <option value="" selected disabled>Select country…</option>
                  ${countryOptionsHtml}
                </select>
              </label>
              ${
                workspace.billingSubscriptionId
                  ? ""
                  : `<label class="auth-label">Coupon (optional)
                      <input class="auth-input" name="couponCode" maxlength="64" autocomplete="off" />
                    </label>`
              }
            </div>
            ${upgradeHtml}
            ${handlers.onManageBilling && workspace.billingSubscriptionId && billingIsLive ? `<button type="button" class="mkt-btn mkt-btn-primary account-secondary-btn" data-action="manage-billing">Manage payment method &amp; invoices</button>` : ""}
            ${handlers.onCancelBilling && workspace.billingSubscriptionId && billingIsLive && !workspace.billingCancelAtPeriodEnd ? `<button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="cancel-billing">Cancel at renewal</button>` : ""}
            ${cancelScheduled ? `<p class="auth-hint">Cancellation is scheduled for the end of the current billing period.</p>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="pricing">Compare all plans</button>
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Usage ${usage ? `(${escapeHtml(usage.usage.month)})` : ""}</h2>
            ${usageHtml}
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Usage overage</h2>
            ${
              unrestricted
                ? `<p class="auth-hint">Not applicable — platform operator accounts have no usage caps.</p>`
                : hasOverage
                ? `<div class="account-overage-box">
                    <p class="account-overage-amount">Estimated overage: <strong>$${overageUsd.toFixed(2)}</strong></p>
                    <p class="auth-hint">Based on usage above your included plan limits. Pay to restore full service and avoid interruption.</p>
                    ${
                      overagePaid
                        ? `<p class="camera-success" role="status">Overage for ${escapeHtml(usage!.usage.month)} accepted and marked paid.</p>`
                        : `<button type="button" class="mkt-btn mkt-btn-primary auth-submit" data-action="pay-overage" data-amount="${overageUsd}">Accept &amp; pay overage</button>`
                    }
                  </div>`
                : `<p class="auth-hint">No overage charges this period — you are within included limits.</p>`
            }
          </section>

          <div class="account-footer-actions">
            ${handlers.showAdminLink !== false ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="admin">Admin dashboard</button>` : ""}
            ${handlers.onBranding ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="branding">Edit branding</button>` : ""}
            ${handlers.showOwnerLink && handlers.onOwner ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="owner">Owner dashboard</button>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to showroom</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="signout">Sign out</button>
          </div>
        </div>
      </div>
    </div>`;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);
  mountTrialCountdown(root, workspace);

  root.querySelector("[data-form=password]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const current = (form.elements.namedItem("current") as HTMLInputElement).value;
    const next = (form.elements.namedItem("next") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
    if (next !== confirm) {
      void handlers.onChangePassword(current, "__mismatch__");
      return;
    }
    void handlers.onChangePassword(current, next);
  });

  root.querySelectorAll("[data-action=upgrade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tierId = btn.getAttribute("data-tier");
      const tier = upgrades.find((t) => t.id === tierId);
      if (tier) {
        const country = readBillingCountry(root);
        if (!isValidBillingCountry(country, workspace.billingProvider)) {
          void handlers.onUpgradePlan(tier, { billingCountry: "" });
          return;
        }
        const couponCode =
          (root.querySelector("[name=couponCode]") as HTMLInputElement | null)?.value.trim() ||
          undefined;
        void handlers.onUpgradePlan(tier, { billingCountry: country, couponCode });
      }
    });
  });

  root.querySelector("[data-action=pay-overage]")?.addEventListener("click", () => {
    const amount = Number((root.querySelector("[data-action=pay-overage]") as HTMLElement).getAttribute("data-amount"));
    void handlers.onPayOverage(amount);
  });

  root.querySelector("[data-action=admin]")?.addEventListener("click", handlers.onAdmin);
  root.querySelector("[data-action=branding]")?.addEventListener("click", () => handlers.onBranding?.());
  root.querySelector("[data-action=owner]")?.addEventListener("click", () => handlers.onOwner?.());
  root.querySelector("[data-action=manage-billing]")?.addEventListener("click", () => {
    const country = readBillingCountry(root);
    if (!isValidBillingCountry(country, workspace.billingProvider)) {
      void handlers.onManageBilling?.({ billingCountry: "" });
      return;
    }
    void handlers.onManageBilling?.({ billingCountry: country });
  });
  root.querySelector("[data-action=cancel-billing]")?.addEventListener("click", () => void handlers.onCancelBilling?.());
  root.querySelector("[data-action=pricing]")?.addEventListener("click", handlers.onPricing);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
}
