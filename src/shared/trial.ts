import type { PlanTierId } from "./plan-display";
import { billingTierFromWorkspace, planDisplayName } from "./plan-display";
import type { WorkspacePlan } from "./tenant";

export const TRIAL_DURATION_DAYS = 14;

export const SUSPENDED_LIMITS = {
  models: 0,
  sessionsPerMonth: 0,
  storageBytes: 0,
};

export type TrialWorkspace = {
  plan: WorkspacePlan;
  billingTier?: PlanTierId;
  /** Tier the customer has paid for (set on purchase, not at signup). */
  purchasedBillingTier?: PlanTierId | null;
  /** Time-bounded tier projected from verified provider events. */
  billingEntitlementTier?: PlanTierId | null;
  /** Explicit non-financial tier assigned by the platform owner. */
  manualBillingTier?: PlanTierId | null;
  billingProvider?: "dodo" | "zoho" | null;
  billingSubscriptionId?: string | null;
  billingStatus?: "pending" | "active" | "past_due" | "canceled" | "expired" | null;
  billingCurrentPeriodEnd?: string | null;
  billingGraceUntil?: string | null;
  billingCancelAtPeriodEnd?: boolean | null;
  trialEndsAt?: string | null;
  trialPlan?: PlanTierId | null;
};

export type TrialCountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/**
 * Minimum paid tier that keeps a workspace live after its trial ends.
 * Starter is the universal floor — subscribing to any paid plan (Starter+)
 * prevents suspension, regardless of which trial the workspace started on.
 * (Signature keeps the trialPlan arg for call-site compatibility.)
 */
export function trialFallbackTier(_trialPlan: PlanTierId): PlanTierId {
  return "starter";
}

export type PlanActionVerb = "Subscribe" | "Upgrade" | "Downgrade" | "Current";

/** Billing status still entitled to self-serve management actions. */
export function isLiveBillingStatus(
  status: TrialWorkspace["billingStatus"],
): boolean {
  return status === "active" || status === "past_due" || status === "canceled";
}

/**
 * Workspace-level Subscribe vs Upgrade — used for single-CTA / suspended copy.
 * No paid plan on file → "Subscribe"; already paying → "Upgrade".
 */
export function planActionVerb(ws: TrialWorkspace): "Subscribe" | "Upgrade" {
  return subscribedBillingTier(ws) ? "Upgrade" : "Subscribe";
}

/**
 * Per-tier CTA matrix.
 *
 * When a paid entitlement exists, that paid tier is the reference (not an active
 * trial elevation) so Launch subscribers see Growth as Upgrade and Starter as Downgrade.
 * Without paid entitlement, an active trial plan remains the reference (trial matrix).
 */
export function planActionVerbForTier(ws: TrialWorkspace, targetTier: PlanTierId): PlanActionVerb {
  const paidTier = subscribedBillingTier(ws);
  if (!paidTier && isTrialActive(ws)) {
    // During trial with no paid subscription, all tiers are purchasable (including the trial tier).
    return "Subscribe";
  }
  const referenceTier: PlanTierId | null =
    paidTier ?? (isTrialActive(ws) && ws.trialPlan ? ws.trialPlan : null);
  if (!referenceTier) return "Subscribe";
  const cmp = TIER_ORDER.indexOf(targetTier) - TIER_ORDER.indexOf(referenceTier);
  if (cmp > 0) return "Upgrade";
  if (cmp < 0) return "Downgrade";
  return "Current";
}

/**
 * Paid-plan change matrix: which self-serve tiers are upgrades vs downgrades.
 * Empty when the workspace has no live paid entitlement.
 */
export function planChangeMatrix(ws: TrialWorkspace): {
  current: PlanTierId | null;
  upgrades: PlanTierId[];
  downgrades: PlanTierId[];
} {
  const current = subscribedBillingTier(ws);
  if (!current) {
    return { current: null, upgrades: [], downgrades: [] };
  }
  const idx = TIER_ORDER.indexOf(current);
  const selfServe = TIER_ORDER.filter((t) => t !== "scale");
  return {
    current,
    upgrades: selfServe.filter((t) => TIER_ORDER.indexOf(t) > idx),
    downgrades: selfServe.filter((t) => TIER_ORDER.indexOf(t) < idx),
  };
}

/** Tiers a trialing workspace can subscribe to (≤ trial) vs upgrade to (> trial). */
export function trialCtaTiers(ws: TrialWorkspace): { subscribe: PlanTierId[]; upgrade: PlanTierId[] } {
  const refIdx = TIER_ORDER.indexOf(ws.trialPlan ?? "growth");
  return {
    subscribe: TIER_ORDER.filter((t) => t !== "scale" && TIER_ORDER.indexOf(t) <= refIdx),
    upgrade: TIER_ORDER.filter((t) => TIER_ORDER.indexOf(t) > refIdx),
  };
}

function tierNameList(ws: TrialWorkspace, tiers: PlanTierId[]): string {
  const names = tiers.map((t) => planDisplayName(ws.plan, t));
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** "Subscribe to Starter, Launch or Growth, or upgrade to Scale" — trial-tier aware. */
export function trialCtaSentence(ws: TrialWorkspace): string {
  if (!ws.trialPlan) return "";
  const { subscribe, upgrade } = trialCtaTiers(ws);
  const parts: string[] = [];
  if (subscribe.length) parts.push(`Subscribe to ${tierNameList(ws, subscribe)}`);
  if (upgrade.length) parts.push(`upgrade to ${tierNameList(ws, upgrade)}`);
  return parts.join(", or ");
}

export function isTrialActive(ws: { trialEndsAt?: string | null; trialPlan?: PlanTierId | null }): boolean {
  if (!ws.trialEndsAt || !ws.trialPlan) return false;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return false;
  return Date.now() < end;
}

export function isTrialExpired(ws: { trialEndsAt?: string | null; trialPlan?: PlanTierId | null }): boolean {
  if (!ws.trialEndsAt || !ws.trialPlan) return false;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return false;
  return Date.now() >= end;
}

const TIER_ORDER: PlanTierId[] = ["starter", "launch", "growth", "scale"];

function providerBillingTier(ws: TrialWorkspace, now = Date.now()): PlanTierId | null {
  if (!ws.billingProvider || !ws.billingEntitlementTier) return null;
  const periodEnd = Date.parse(String(ws.billingCurrentPeriodEnd || ""));
  const graceUntil = Date.parse(String(ws.billingGraceUntil || ""));
  if (ws.billingStatus === "past_due") {
    return Number.isFinite(graceUntil) && now < graceUntil ? ws.billingEntitlementTier : null;
  }
  if (ws.billingStatus === "active" || ws.billingStatus === "canceled") {
    return Number.isFinite(periodEnd) && now < periodEnd ? ws.billingEntitlementTier : null;
  }
  return null;
}

/** Paid or manually granted tier — excludes active trial elevation. */
export function subscribedBillingTier(ws: TrialWorkspace): PlanTierId | null {
  const candidates = [
    ws.manualBillingTier,
    providerBillingTier(ws),
    ...(ws.billingProvider ? [] : [ws.purchasedBillingTier]),
  ].filter(
    (tier): tier is PlanTierId => Boolean(tier)
  );
  return candidates.reduce<PlanTierId | null>(
    (highest, tier) =>
      !highest || TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(highest) ? tier : highest,
    null
  );
}

/** Paid entitlement still active — use plan change / portal / cancel, not new checkout. */
export function hasLiveBillingSubscription(ws: TrialWorkspace): boolean {
  return subscribedBillingTier(ws) !== null;
}

/** Meter overage is a paid-plan add-on only (active / cancel-scheduled / past-due grace). */
export function isOverageBillable(ws: TrialWorkspace): boolean {
  return hasLiveBillingSubscription(ws) && !isServicePaused(ws);
}

/** User-facing Plan & billing status — drives labels and gated actions. */
export type BillingPlanDisplayStatus =
  | "active"
  | "cancel_scheduled"
  | "canceled"
  | "past_due"
  | "pending"
  | "none";

/**
 * Derive Plan & billing display status from entitlement + cancel flags.
 * Immediate Dodo cancel (Atlas expired) and ended entitlement → "canceled".
 * cancelAtPeriodEnd while still entitled → "cancel_scheduled".
 */
export function billingPlanDisplayStatus(ws: TrialWorkspace): BillingPlanDisplayStatus {
  const paid = subscribedBillingTier(ws);
  if (ws.billingStatus === "past_due" && paid) return "past_due";
  if (paid && ws.billingCancelAtPeriodEnd === true) return "cancel_scheduled";
  if (paid) return "active";
  if (ws.billingStatus === "pending" && !ws.billingSubscriptionId) return "pending";
  if (
    ws.billingStatus === "expired" ||
    ws.billingStatus === "canceled" ||
    (Boolean(ws.billingSubscriptionId) && !paid)
  ) {
    return "canceled";
  }
  if (ws.billingStatus === "pending") return "pending";
  return "none";
}

export function billingPlanStatusLabel(ws: TrialWorkspace): string {
  switch (billingPlanDisplayStatus(ws)) {
    case "active":
      return "Active";
    case "cancel_scheduled":
      return "Cancel scheduled";
    case "canceled":
      return "Canceled";
    case "past_due":
      return "Past due";
    case "pending":
      return "Pending";
    default:
      return "—";
  }
}

export function hasPurchasedTrialFallback(ws: TrialWorkspace): boolean {
  const paidTier = subscribedBillingTier(ws);
  if (!ws.trialPlan || !paidTier) return false;
  const fallback = trialFallbackTier(ws.trialPlan);
  const fallbackIdx = TIER_ORDER.indexOf(fallback);
  const purchasedIdx = TIER_ORDER.indexOf(paidTier);
  return fallbackIdx >= 0 && purchasedIdx >= fallbackIdx;
}

/** Why the workspace showroom/admin is paused (or none). */
export type ServicePauseReason =
  | "none"
  | "trial_ended"
  | "subscription_canceled"
  | "subscription_expired"
  | "entitlement_lapsed";

/**
 * Pause reason matrix — do not treat every unpaid provider workspace as "trial ended".
 * Cancel-scheduled with live entitlement → none (access continues).
 */
export function servicePauseReason(ws: TrialWorkspace): ServicePauseReason {
  if (isTrialActive(ws)) return "none";
  if (subscribedBillingTier(ws)) return "none";

  const hadProvider = Boolean(ws.billingProvider);
  const hadSub = Boolean(ws.billingSubscriptionId);

  if (hadProvider || hadSub) {
    if (ws.billingStatus === "expired") return "subscription_expired";
    if (ws.billingStatus === "canceled") return "subscription_canceled";
    return "entitlement_lapsed";
  }

  if (isTrialExpired(ws) && Boolean(ws.trialPlan) && !hasPurchasedTrialFallback(ws)) {
    return "trial_ended";
  }

  return "none";
}

export function isServicePaused(ws: TrialWorkspace): boolean {
  return servicePauseReason(ws) !== "none";
}

/** True only when pause reason is an expired unpaid trial (not canceled paid). */
export function isTrialSuspended(ws: TrialWorkspace): boolean {
  return servicePauseReason(ws) === "trial_ended";
}

export function servicePauseTitle(reason: ServicePauseReason): string {
  switch (reason) {
    case "trial_ended":
      return "Trial ended";
    case "subscription_canceled":
      return "Subscription ended";
    case "subscription_expired":
      return "Subscription expired";
    case "entitlement_lapsed":
      return "Service paused";
    default:
      return "Service paused";
  }
}

export function servicePauseBody(
  reason: ServicePauseReason,
  requiredPlan: string,
  actionVerb: "Subscribe" | "Upgrade" = "Subscribe",
): string {
  const restore = `${actionVerb} to ${requiredPlan} to restore your showroom, model uploads, and admin dashboard.`;
  switch (reason) {
    case "trial_ended":
      return `Your trial has ended. ${restore}`;
    case "subscription_canceled":
      return `Your paid plan ended after cancellation. ${restore}`;
    case "subscription_expired":
      return `Your paid period ended. ${restore}`;
    case "entitlement_lapsed":
      return `Access to this workspace has ended. ${restore}`;
    default:
      return restore;
  }
}

export function servicePauseShowroomSub(reason: ServicePauseReason): string {
  switch (reason) {
    case "trial_ended":
      return "This workspace's trial has ended. The owner can subscribe from Account to restore the catalog.";
    case "subscription_canceled":
      return "This workspace's subscription ended after cancellation. The owner can subscribe from Account to restore the catalog.";
    case "subscription_expired":
      return "This workspace's paid period ended. The owner can subscribe from Account to restore the catalog.";
    case "entitlement_lapsed":
      return "This workspace's paid access has ended. The owner can subscribe from Account to restore the catalog.";
    default:
      return "This workspace is paused. The owner can subscribe from Account to restore the catalog.";
  }
}

export function trialDaysRemaining(ws: { trialEndsAt?: string | null }): number {
  if (!ws.trialEndsAt) return 0;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return 0;
  const ms = end - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function trialCountdownParts(ws: { trialEndsAt?: string | null }): TrialCountdownParts | null {
  if (!ws.trialEndsAt) return null;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export function formatTrialCountdown(parts: TrialCountdownParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function effectiveBillingTier(ws: TrialWorkspace): PlanTierId {
  if (isTrialActive(ws) && ws.trialPlan) return ws.trialPlan;
  if (isServicePaused(ws)) {
    if (ws.trialPlan) return trialFallbackTier(ws.trialPlan);
    return "starter";
  }
  const paidTier = subscribedBillingTier(ws);
  if (paidTier) return paidTier;
  return billingTierFromWorkspace(ws);
}

export function trialEndsAtIso(days = TRIAL_DURATION_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function trialAfterTrialMessage(ws: TrialWorkspace): string {
  if (!ws.trialPlan) return "";
  const paidTier = subscribedBillingTier(ws);
  if (hasPurchasedTrialFallback(ws) && paidTier) {
    return `continues on ${planDisplayName(ws.plan, paidTier)} after trial`;
  }
  return `${trialCtaSentence(ws).toLowerCase()} before trial ends or service pauses`;
}

export function trialProfilePlanLine(ws: TrialWorkspace): string {
  if (isTrialActive(ws) && ws.trialEndsAt) {
    try {
      const end = new Date(ws.trialEndsAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const trialName = planDisplayName(ws.plan, ws.trialPlan ?? "growth");
      if (hasPurchasedTrialFallback(ws)) {
        return `${trialName} trial · paid through ${end}`;
      }
      return `${trialName} trial · ${planActionVerb(ws).toLowerCase()} by ${end}`;
    } catch {
      return workspacePlanLabel(ws);
    }
  }
  return workspacePlanLabel(ws);
}

/** Customer-facing plan line for account/admin (includes active trial). */
export function workspacePlanLabel(ws: TrialWorkspace): string {
  const reason = servicePauseReason(ws);
  if (reason !== "none") {
    const required = planDisplayName(ws.plan, ws.trialPlan ? trialFallbackTier(ws.trialPlan) : "starter");
    return `Service paused — ${planActionVerb(ws).toLowerCase()} to ${required}`;
  }
  if (isTrialActive(ws)) {
    const parts = trialCountdownParts(ws);
    const trialName = planDisplayName(ws.plan, ws.trialPlan ?? "growth");
    const countdown = parts ? formatTrialCountdown(parts) : `${trialDaysRemaining(ws)}d`;
    return `${trialName} trial · ${countdown} left`;
  }
  return planDisplayName(ws.plan, effectiveBillingTier(ws));
}

export function trialBannerHtml(ws: TrialWorkspace): string {
  if (!isTrialActive(ws) || !ws.trialPlan) return "";
  const parts = trialCountdownParts(ws);
  const countdown = parts ? formatTrialCountdown(parts) : `${trialDaysRemaining(ws)}d`;
  const trialName = planDisplayName(ws.plan, ws.trialPlan);
  const after = trialAfterTrialMessage(ws);
  return `<div class="admin-trial-banner account-trial-banner account-trial-banner--active" role="status" aria-live="polite" data-trial-banner>
    <strong>${escapeHtml(trialName)} trial active</strong> — <span class="account-trial-countdown" role="timer" data-trial-countdown>${escapeHtml(countdown)}</span> remaining with ${escapeHtml(trialName)} limits.
    ${hasPurchasedTrialFallback(ws) ? `Your workspace will ${escapeHtml(after)}.` : `${escapeHtml(trialCtaSentence(ws))} before trial ends or your showroom will pause.`}
  </div>`;
}

export function accountTrialBannerHtml(ws: TrialWorkspace): string {
  if (!isTrialActive(ws) || !ws.trialPlan) return "";
  const parts = trialCountdownParts(ws);
  const countdown = parts ? formatTrialCountdown(parts) : `${trialDaysRemaining(ws)}d`;
  const trialName = planDisplayName(ws.plan, ws.trialPlan);
  const purchased = hasPurchasedTrialFallback(ws);
  const paidTier = subscribedBillingTier(ws);
  const purchasedName = paidTier ? planDisplayName(ws.plan, paidTier) : trialName;
  return `<div class="account-trial-banner account-trial-banner--active" role="status" aria-live="polite" data-trial-banner>
    <p class="account-trial-eyebrow">${escapeHtml(trialName)} trial</p>
    <p class="account-trial-countdown" role="timer"><span data-trial-countdown>${escapeHtml(countdown)}</span> remaining</p>
    <p class="account-trial-note auth-hint">${
      purchased
        ? `Your workspace will continue on ${escapeHtml(purchasedName)} when the trial ends.`
        : `${escapeHtml(trialCtaSentence(ws))} before the trial ends to keep your showroom live. Otherwise service pauses until you resubscribe.`
    }</p>
  </div>`;
}

export function trialSuspendedBannerHtml(ws: TrialWorkspace): string {
  const reason = servicePauseReason(ws);
  if (reason === "none") return "";
  const required = planDisplayName(ws.plan, ws.trialPlan ? trialFallbackTier(ws.trialPlan) : "starter");
  const verb = planActionVerb(ws);
  return `<div class="account-trial-banner account-trial-banner--paused" role="alert">
    <p class="account-trial-eyebrow">Service paused</p>
    <p class="account-trial-note">${escapeHtml(servicePauseBody(reason, required, verb))}</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wire live countdown ticks on any [data-trial-countdown] nodes under root. */
export function mountTrialCountdown(root: HTMLElement, ws: TrialWorkspace): void {
  if (!isTrialActive(ws) || !ws.trialEndsAt) return;
  const endsAt = ws.trialEndsAt;
  const prior = Number(root.dataset.trialCountdownId);
  if (prior) window.clearInterval(prior);
  const nodes = root.querySelectorAll("[data-trial-countdown]");
  if (!nodes.length) return;
  const tick = () => {
    const parts = trialCountdownParts({ trialEndsAt: endsAt });
    const text = parts ? formatTrialCountdown(parts) : "Trial ended";
    nodes.forEach((el) => {
      el.textContent = text;
    });
  };
  tick();
  const id = window.setInterval(tick, 1000);
  root.dataset.trialCountdownId = String(id);
}
