/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */

export const TRIAL_DURATION_DAYS = 14;

export const SUSPENDED_LIMITS = {
  models: 0,
  sessionsPerMonth: 0,
  storageBytes: 0,
};

const TIER_ORDER = ["starter", "launch", "growth", "scale"];

function providerBillingTier(ws, now = Date.now()) {
  if (!ws.billingProvider || !ws.billingEntitlementTier) return null;
  const periodEnd = Date.parse(String(ws.billingCurrentPeriodEnd || ""));
  const graceUntil = Date.parse(String(ws.billingGraceUntil || ""));
  if (ws.billingStatus === "past_due") {
    return Number.isFinite(graceUntil) && now < graceUntil ? ws.billingEntitlementTier : null;
  }
  if (["active", "canceled"].includes(String(ws.billingStatus))) {
    return Number.isFinite(periodEnd) && now < periodEnd ? ws.billingEntitlementTier : null;
  }
  return null;
}

function paidBillingTier(ws) {
  const candidates = [
    ws.manualBillingTier,
    providerBillingTier(ws),
    ...(ws.billingProvider ? [] : [ws.purchasedBillingTier]),
  ].filter(Boolean);
  return candidates.reduce(
    (highest, tier) =>
      TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(highest) ? tier : highest,
    null
  );
}

/**
 * Universal paid floor after any trial — Starter. Subscribing to any paid plan
 * (Starter+) keeps a workspace live regardless of trial type.
 * @param {BillingTierId} [_trialPlan]
 * @returns {BillingTierId}
 */
export function trialFallbackTier(_trialPlan) {
  return "starter";
}

/**
 * Workspace-level Subscribe vs Upgrade (mirror of src/shared/trial.ts).
 * No paid plan on file → "Subscribe"; already paying → "Upgrade".
 * @param {{ purchasedBillingTier?: string | null; billingEntitlementTier?: string | null }} ws
 * @returns {"Subscribe" | "Upgrade"}
 */
export function planActionVerb(ws) {
  return paidBillingTier(ws) ? "Upgrade" : "Subscribe";
}

/**
 * Per-tier CTA matrix (mirror of src/shared/trial.ts).
 * Paid entitlement is the reference when present; otherwise active trial plan.
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; billingProvider?: string | null; billingStatus?: string | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null }} ws
 * @param {BillingTierId} targetTier
 * @returns {"Subscribe" | "Upgrade" | "Downgrade" | "Current"}
 */
export function planActionVerbForTier(ws, targetTier) {
  const paidTier = paidBillingTier(ws);
  if (!paidTier && isTrialActive(ws)) {
    return "Subscribe";
  }
  const reference = paidTier ?? (isTrialActive(ws) && ws.trialPlan ? ws.trialPlan : null);
  if (!reference) return "Subscribe";
  const cmp = TIER_ORDER.indexOf(targetTier) - TIER_ORDER.indexOf(reference);
  if (cmp > 0) return "Upgrade";
  if (cmp < 0) return "Downgrade";
  return "Current";
}

/**
 * Paid-plan change matrix (mirror of src/shared/trial.ts).
 * @param {{ purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; billingProvider?: string | null; billingStatus?: string | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null }} ws
 */
export function planChangeMatrix(ws) {
  const current = paidBillingTier(ws);
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

/**
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 */
export function isTrialActive(ws) {
  if (!ws.trialEndsAt || !ws.trialPlan) return false;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return false;
  return Date.now() < end;
}

/**
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 */
export function isTrialExpired(ws) {
  if (!ws.trialEndsAt || !ws.trialPlan) return false;
  const end = Date.parse(ws.trialEndsAt);
  if (Number.isNaN(end)) return false;
  return Date.now() >= end;
}

/**
 * User-facing Plan & billing status (mirror of src/shared/trial.ts).
 * @param {{ billingStatus?: string | null; billingSubscriptionId?: string | null; billingCancelAtPeriodEnd?: boolean | null; billingProvider?: string | null; billingEntitlementTier?: BillingTierId | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null }} ws
 * @returns {"active" | "cancel_scheduled" | "canceled" | "past_due" | "pending" | "none"}
 */
export function billingPlanDisplayStatus(ws) {
  const paid = paidBillingTier(ws);
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

/**
 * @param {{ billingStatus?: string | null; billingSubscriptionId?: string | null; billingCancelAtPeriodEnd?: boolean | null; billingProvider?: string | null; billingEntitlementTier?: BillingTierId | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null }} ws
 */
export function billingPlanStatusLabel(ws) {
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

/**
 * @param {{ trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null }} ws
 */
export function hasPurchasedTrialFallback(ws) {
  const paidTier = paidBillingTier(ws);
  if (!ws.trialPlan || !paidTier) return false;
  const fallback = trialFallbackTier(ws.trialPlan);
  const fallbackIdx = TIER_ORDER.indexOf(fallback);
  const purchasedIdx = TIER_ORDER.indexOf(paidTier);
  return fallbackIdx >= 0 && purchasedIdx >= fallbackIdx;
}

/** Paid entitlement still active — required for meter overage charges. */
export function hasLiveBillingSubscription(ws) {
  return paidBillingTier(ws) !== null;
}

/**
 * Meter overage is a paid-plan add-on only (active / cancel-scheduled / past-due grace).
 * @param {Parameters<typeof isServicePaused>[0]} ws
 */
export function isOverageBillable(ws) {
  return hasLiveBillingSubscription(ws) && !isServicePaused(ws);
}

/** @typedef {"none" | "trial_ended" | "subscription_canceled" | "subscription_expired" | "entitlement_lapsed"} ServicePauseReason */

/**
 * Pause reason matrix — cancel-scheduled with live entitlement is not paused.
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; billingProvider?: string | null; billingStatus?: string | null; billingSubscriptionId?: string | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null }} ws
 * @returns {ServicePauseReason}
 */
export function servicePauseReason(ws) {
  if (isTrialActive(ws)) return "none";
  if (paidBillingTier(ws)) return "none";

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

/** @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; billingProvider?: string | null; billingStatus?: string | null; billingSubscriptionId?: string | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null }} ws */
export function isServicePaused(ws) {
  return servicePauseReason(ws) !== "none";
}

/**
 * True only when pause reason is an expired unpaid trial (not canceled paid).
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; billingProvider?: string | null; billingStatus?: string | null; billingSubscriptionId?: string | null; billingCurrentPeriodEnd?: string | null; billingGraceUntil?: string | null; manualBillingTier?: BillingTierId | null }} ws
 */
export function isTrialSuspended(ws) {
  return servicePauseReason(ws) === "trial_ended";
}

/**
 * @param {ServicePauseReason} reason
 */
export function servicePauseShowroomSub(reason) {
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

/**
 * @param {ServicePauseReason} reason
 */
export function servicePauseTitle(reason) {
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

/**
 * @param {number} [days]
 */
export function trialEndsAtIso(days = TRIAL_DURATION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * @param {{ plan: string; billingTier?: BillingTierId; purchasedBillingTier?: BillingTierId | null; billingEntitlementTier?: BillingTierId | null; trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 * @returns {BillingTierId}
 */
export function effectiveBillingTier(ws) {
  if (isTrialActive(ws) && ws.trialPlan) return ws.trialPlan;
  if (isServicePaused(ws)) {
    if (ws.trialPlan) return trialFallbackTier(ws.trialPlan);
    return "starter";
  }
  const paidTier = paidBillingTier(ws);
  if (paidTier) return paidTier;
  if (ws.billingTier) return ws.billingTier;
  if (ws.plan === "pro") return "growth";
  if (ws.plan === "enterprise") return "scale";
  return "starter";
}
