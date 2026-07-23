import type { Workspace } from "../shared/tenant";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import type { WorkspaceUsageResponse } from "../data/usage-api";
import type { BillingScheduledPlanChange } from "../data/workspace-api";
import { formatStorageBytes, formatSessionsLimit, isUnlimitedSessionsLimit } from "../shared/plan-limits";
import { estimateOverageUsd, planDisplayName, upgradeOptions, type PlanTier } from "../shared/plan-display";
import { effectiveBillingTier, trialProfilePlanLine, accountTrialBannerHtml, trialSuspendedBannerHtml, mountTrialCountdown, planActionVerbForTier, hasLiveBillingSubscription, isOverageBillable, isServicePaused, subscribedBillingTier, planChangeMatrix, isTrialActive, billingPlanDisplayStatus, billingPlanStatusLabel } from "../shared/trial";
import { effectiveUsageLimits } from "../shared/overage-entitlements";
import { escapeHtml } from "../shared/escape-html";
import {
  billingCountryOptions,
  formatBillingCountryLabel,
  isSupportedBillingCountry,
} from "../shared/dodo-billing-countries";
import { MKT } from "./marketing-copy";
import { MKT_ASSETS } from "./marketing-assets";

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
    overageAccepted?: boolean;
    usageUnrestricted?: boolean;
    sandboxSeedEnabled?: boolean;
    scheduledPlanChange?: BillingScheduledPlanChange | null;
  },
  handlers: {
    onChangePassword: (current: string, next: string) => void | Promise<void>;
    onUpgradePlan: (
      tier: PlanTier,
      checkout: { billingCountry: string; couponCode?: string },
    ) => void | Promise<void>;
    onManageBilling?: (checkout: { billingCountry: string }) => void | Promise<void>;
    onCancelBilling?: () => void | Promise<void>;
    onUndoCancelBilling?: () => void | Promise<void>;
    onCancelScheduledPlanChange?: () => void | Promise<void>;
    onPayOverage: (amountUsd: number) => void | Promise<void>;
    onSeedSandboxOverage?: () => void | Promise<void>;
    onClearSandboxUsage?: () => void | Promise<void>;
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
  const usageCounts = usage?.usage;
  const planLimits = usage?.limits;
  const effectiveLimits =
    usage?.effectiveLimits ??
    (planLimits ? effectiveUsageLimits(planLimits, null) : null);
  const usageMonth = usage?.usage?.month || usage?.liveUsage?.month || "";
  const trialBanner = unrestricted ? "" : accountTrialBannerHtml(workspace);
  const suspendedBanner = unrestricted ? "" : trialSuspendedBannerHtml(workspace);
  const upgrades = unrestricted ? [] : upgradeOptions(workspace);
  const billingIsLive = hasLiveBillingSubscription(workspace);
  const overageBillable =
    !unrestricted &&
    (usage?.overageBillable ?? isOverageBillable(workspace));
  const overageUsd =
    usage && usageCounts && overageBillable
      ? typeof usage.estimatedOverageUsd === "number"
        ? usage.estimatedOverageUsd
        : estimateOverageUsd(effectiveBillingTier(workspace), usageCounts, usage.limits)
      : 0;
  const hasOverage = overageBillable && overageUsd > 0;
  const overagePaid = data.overagePaid ?? usage?.overagePaid ?? false;
  const overageAccepted = data.overageAccepted ?? usage?.overageAccepted ?? false;
  const overageAmountUsd =
    typeof usage?.overageAmountUsd === "number" ? usage.overageAmountUsd : overageUsd > 0 ? overageUsd : null;
  const sandboxModeActive = Boolean(data.sandboxSeedEnabled ?? usage?.sandboxSeedEnabled);
  const canClearSandbox =
    Boolean(handlers.onClearSandboxUsage) &&
    (overagePaid ||
      overageAccepted ||
      Boolean(usage?.sandboxClearAvailable) ||
      Boolean(usage?.usageIsSandboxSeeded) ||
      Boolean(usage?.sandboxSeededAt) ||
      Boolean(usage?.overageSandbox));
  const showSandboxClear = canClearSandbox;
  const clearOverageBtn = showSandboxClear
    ? `<button type="button" class="mkt-btn mkt-btn-ghost auth-submit" data-action="clear-sandbox-usage" style="margin-top:0.75rem">Clear test overage</button>
       <p class="auth-hint" style="margin-top:0.35rem">Removes leftover seed / invoicing-pending test rows. Real card payments are not deleted.</p>`
    : "";
  // Hide Seed while a sandbox seed is already active — Clear first.
  const showSandboxSeed =
    Boolean(handlers.onSeedSandboxOverage) &&
    sandboxModeActive &&
    !Boolean(usage?.sandboxSeededAt) &&
    !Boolean(usage?.usageIsSandboxSeeded);
  const planInactive = !unrestricted && isServicePaused(workspace);
  const modelsRetained =
    Boolean(usage?.modelsRetained) ||
    (planInactive && Boolean(usageCounts?.modelCount));

  const usageOverageStat =
    !unrestricted && (overagePaid || overageAccepted || (overageBillable && hasOverage))
      ? `<div class="admin-stat">
          <span class="admin-stat-label">Usage overage</span>
          <span class="admin-stat-val">${
            overagePaid
              ? `Recorded${overageAmountUsd != null ? ` · $${overageAmountUsd.toFixed(2)} est.` : ""}`
              : overageAccepted
                ? `Noted — meters bill at cycle${overageAmountUsd != null ? ` · $${overageAmountUsd.toFixed(2)} est.` : ""}`
                : `Estimated · $${overageUsd.toFixed(2)}`
          }</span>
        </div>`
      : "";

  const sessionLimitDisplay =
    effectiveLimits && planLimits
      ? isUnlimitedSessionsLimit(effectiveLimits.sessionsPerMonth)
        ? `<span class="admin-stat-unlimited"> \u00B7 unlimited</span>`
        : effectiveLimits.overageExtended?.sessions
          ? `<span> / ${formatSessionsLimit(effectiveLimits.sessionsPerMonth)} <span class="auth-hint">(+overage)</span></span>`
          : `<span> / ${formatSessionsLimit(planLimits.sessionsPerMonth)}</span>`
      : "";

  const usageHtml = usage && usageCounts && planLimits && effectiveLimits
    ? `<div class="admin-usage-grid account-usage-grid${unrestricted ? " admin-usage-grid--operator" : ""}">
        <div class="admin-stat">
          <span class="admin-stat-label">Models</span>
          <span class="admin-stat-val">${usageCounts.modelCount}${unrestricted ? `<span class="admin-stat-unlimited"> \u00B7 tracked \u00B7 no limit</span>` : planInactive ? `<span> \u00B7 retained</span>` : `<span> / ${planLimits.models}</span>`}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">AR sessions</span>
          <span class="admin-stat-val">${usageCounts.sessionCount}${unrestricted ? `<span class="admin-stat-unlimited"> \u00B7 tracked \u00B7 no limit</span>` : planInactive ? `<span> \u00B7 tracked</span>` : sessionLimitDisplay}</span>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-label">Storage</span>
          <span class="admin-stat-val">${formatStorageBytes(usageCounts.storageBytes)}${unrestricted ? `<span class="admin-stat-unlimited"> \u00B7 tracked \u00B7 no limit</span>` : planInactive ? `<span> \u00B7 retained</span>` : `<span> / ${formatStorageBytes(planLimits.storageBytes)}</span>`}</span>
        </div>
        ${usageOverageStat}
      </div>
      ${
        unrestricted
          ? `<p class="auth-hint admin-usage-operator-note">Platform operator account — usage tracked for visibility; no plan limits or overage.</p>`
          : (overagePaid || overageAccepted) && effectiveLimits?.overageExtended?.sessions
            ? `<p class="auth-hint">Session cap raised${usageMonth ? ` for ${escapeHtml(usageMonth)}` : ""} after overage was recorded. Models and storage stay on plan limits — upgrade to add catalog slots.</p>`
            : (overagePaid || overageAccepted)
              ? `<p class="auth-hint">Overage noted${usageMonth ? ` for ${escapeHtml(usageMonth)}` : ""}. On hybrid plans, meters bill with your subscription payment. Models and storage follow your plan tier.</p>`
              : modelsRetained
            ? `<p class="auth-hint">Plan inactive — models stay in your workspace. Public showroom and new uploads stay paused until you subscribe. Usage overage is not charged while the plan is canceled or expired.</p>`
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

  const billingDisplayStatus = billingPlanDisplayStatus(workspace);
  const billingStatusText = billingPlanStatusLabel(workspace);
  const cancelScheduled = billingDisplayStatus === "cancel_scheduled";
  const billingCanceled = billingDisplayStatus === "canceled";
  const paidBillingTier = subscribedBillingTier(workspace);
  const scheduledPlanChange = data.scheduledPlanChange ?? null;
  const scheduledPlanName = scheduledPlanChange
    ? planDisplayName(workspace.plan, scheduledPlanChange.tier)
    : "";
  const billingPlanName = paidBillingTier
    ? planDisplayName(workspace.plan, paidBillingTier)
    : trialProfilePlanLine(workspace);
  const countryOptionsHtml = billingCountryOptions(workspace.billingProvider)
    .map(
      (country) =>
        `<option value="${escapeHtml(country.code)}">${escapeHtml(formatBillingCountryLabel(country))}</option>`,
    )
    .join("");

  const upgradeHtml = cancelScheduled
    ? `<p class="auth-hint">Cancellation is scheduled. Upgrade and Downgrade are unavailable until you <strong>Undo cancel</strong> or the period ends. You can also manage the subscription in the Dodo Customer Portal via Manage payment method &amp; invoices.</p>`
    : upgrades.length > 0
      ? `<div class="account-plan-grid">
          ${upgrades
            .map((tier) => {
              const verb = planActionVerbForTier(workspace, tier.id);
              // Paid: Plan name is in Plan & billing — hide redundant Current card.
              // Trial (no paid entitlement): keep Current so the trial plan is visible in the grid.
              if (
                verb === "Current" &&
                !(isTrialActive(workspace) && !subscribedBillingTier(workspace))
              ) {
                return "";
              }
              return `
            <button type="button" class="account-plan-card${verb === "Current" ? " account-plan-card--current" : ""}" data-action="upgrade" data-tier="${escapeHtml(tier.id)}"${verb === "Current" ? " disabled aria-current=\"true\"" : ""}>
              <span class="account-plan-name">${escapeHtml(tier.name)}</span>
              <span class="account-plan-price">${escapeHtml(tier.price)}</span>
              <span class="account-plan-cta">${escapeHtml(verb)}</span>
            </button>`;
            })
            .join("")}
        </div>
        ${
          paidBillingTier
            ? (() => {
                const matrix = planChangeMatrix(workspace);
                const bits: string[] = [];
                if (matrix.upgrades.length) {
                  bits.push(
                    `Upgrade to ${matrix.upgrades.map((id) => planDisplayName(workspace.plan, id)).join(" or ")}`,
                  );
                }
                if (matrix.downgrades.length) {
                  bits.push(
                    `downgrade to ${matrix.downgrades.map((id) => planDisplayName(workspace.plan, id)).join(" or ")}`,
                  );
                }
                return bits.length
                  ? `<p class="auth-hint">Plan changes apply on your next billing date — ${escapeHtml(bits.join("; "))}. You keep your current plan until then.</p>`
                  : `<p class="auth-hint">You are on our highest self-serve tier. Plan changes apply on your next billing date.</p>`;
              })()
            : ""
        }`
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
                    <div><dt>Status</dt><dd><strong>${escapeHtml(billingStatusText)}</strong></dd></div>
                    <div><dt>Provider</dt><dd>${escapeHtml(workspace.billingProvider === "zoho" ? "Zoho (India)" : "Dodo Payments")}</dd></div>
                    ${workspace.billingCurrentPeriodEnd ? `<div><dt>Current period ends</dt><dd>${escapeHtml(formatDate(workspace.billingCurrentPeriodEnd))}</dd></div>` : ""}
                  </dl>
                  ${
                    cancelScheduled
                      ? `<p class="auth-hint">Cancellation is scheduled for the end of the current billing period. You keep access until then.</p>`
                      : ""
                  }
                  ${
                    billingCanceled
                      ? `<p class="auth-hint">Subscription canceled.${
                          isTrialActive(workspace)
                            ? " Your trial limits still apply until the trial ends — subscribe below to continue on a paid plan."
                            : " Subscribe below to restore paid access."
                        }</p>`
                      : ""
                  }
                  ${
                    scheduledPlanChange && !cancelScheduled
                      ? `<p class="auth-hint">Plan change scheduled to <strong>${escapeHtml(scheduledPlanName)}</strong>${
                          scheduledPlanChange.effectiveAt
                            ? ` on ${escapeHtml(formatDate(scheduledPlanChange.effectiveAt))}`
                            : " at the next billing date"
                        }. You keep your current plan until then.</p>`
                      : ""
                  }`
                : ""
            }
            <div class="account-checkout-fields">
              <label class="auth-label">Billing country (required)
                <select class="auth-input" name="billingCountry" autocomplete="country" required>
                  <option value="" selected disabled>Select country\u2026</option>
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
            ${handlers.onUndoCancelBilling && workspace.billingSubscriptionId && billingIsLive && cancelScheduled ? `<button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="undo-cancel-billing">Undo cancel</button>` : ""}
            ${handlers.onCancelScheduledPlanChange && scheduledPlanChange && !cancelScheduled ? `<button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="cancel-scheduled-plan">Cancel scheduled change to ${escapeHtml(scheduledPlanName)}</button>` : ""}
            ${handlers.onCancelBilling && workspace.billingSubscriptionId && billingIsLive && !cancelScheduled ? `<button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="cancel-billing">Cancel at renewal</button>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost account-secondary-btn" data-action="pricing">Compare all plans</button>
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Usage ${usageMonth ? `(${escapeHtml(usageMonth)})` : ""}</h2>
            ${usageHtml}
          </section>

          <section class="account-section">
            <h2 class="admin-section-title">Usage overage</h2>
            ${
              unrestricted
                ? `<p class="auth-hint">Not applicable — platform operator accounts have no usage caps.</p>`
                : overagePaid
                ? `<div class="account-overage-box">
                    <p class="camera-success" role="status">Usage overage${usageMonth ? ` for ${escapeHtml(usageMonth)}` : ""} recorded as paid${overageAmountUsd != null ? ` ($${overageAmountUsd.toFixed(2)} Atlas estimate)` : ""}.</p>
                    <p class="auth-hint">On Atlas hybrid plan (Plan + Usage overage), meter overage is charged with your subscription payment cycle. This amount is an Atlas pack estimate and may differ from the invoice.</p>
                    ${clearOverageBtn}
                  </div>`
                : overageAccepted
                ? `<div class="account-overage-box">
                    <p class="camera-success" role="status">Usage overage${usageMonth ? ` for ${escapeHtml(usageMonth)}` : ""} noted${overageAmountUsd != null ? ` ($${overageAmountUsd.toFixed(2)} Atlas estimate)` : ""}. Automatic card charge is unavailable for usage-based subscriptions — meters bill with your next payment cycle.</p>
                    ${clearOverageBtn}
                  </div>`
                : !overageBillable
                ? `<p class="auth-hint">Usage overage meters apply on active paid plans. They are not charged while your plan is canceled or expired. Models stay saved — subscribe to restore the showroom.</p>`
                : hasOverage
                ? `<div class="account-overage-box">
                    <p class="account-overage-amount">Atlas overage estimate: <strong>$${overageUsd.toFixed(2)}</strong></p>
                    <p class="auth-hint">Pack-rounded guide based on usage above included plan limits. On Atlas hybrid plan (Plan + Usage overage), overage is charged automatically with your next subscription payment when meters exceed free thresholds — the invoice uses per-unit meter rates and may differ slightly from this estimate.</p>
                    ${clearOverageBtn}
                    ${
                      showSandboxSeed
                        ? `<p class="auth-hint" style="margin-top:0.75rem">Sandbox: inflate sessions, models, and storage above plan limits (UI only — not billed by Dodo).</p>
                           <button type="button" class="mkt-btn mkt-btn-ghost auth-submit" data-action="seed-sandbox-overage">Seed overage (sandbox)</button>`
                        : ""
                    }
                  </div>`
                : `<p class="auth-hint">No overage this period — you are within included limits. Extra usage is billed automatically with your subscription payment when meters exceed included amounts.</p>${
                    showSandboxSeed
                      ? `<p class="auth-hint" style="margin-top:0.75rem">Sandbox: inflate sessions, models, and storage above plan limits (UI only — not billed by Dodo).</p>
                         <button type="button" class="mkt-btn mkt-btn-ghost auth-submit" data-action="seed-sandbox-overage">Seed overage (sandbox)</button>`
                      : ""
                  }${clearOverageBtn}`
            }
          </section>

          <div class="account-footer-actions">
            ${handlers.showAdminLink !== false ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="admin">Admin dashboard</button>` : ""}
            ${handlers.onBranding ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="branding">Edit branding</button>` : ""}
            ${handlers.showOwnerLink && handlers.onOwner ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="owner">Owner dashboard</button>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">\u2190 Back to showroom</button>
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
  root.querySelector("[data-action=seed-sandbox-overage]")?.addEventListener("click", () => {
    void handlers.onSeedSandboxOverage?.();
  });
  root.querySelector("[data-action=clear-sandbox-usage]")?.addEventListener("click", () => {
    void handlers.onClearSandboxUsage?.();
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
  root
    .querySelector("[data-action=undo-cancel-billing]")
    ?.addEventListener("click", () => void handlers.onUndoCancelBilling?.());
  root
    .querySelector("[data-action=cancel-scheduled-plan]")
    ?.addEventListener("click", () => void handlers.onCancelScheduledPlanChange?.());
  root.querySelector("[data-action=pricing]")?.addEventListener("click", handlers.onPricing);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=signout]")?.addEventListener("click", handlers.onSignOut);
}
