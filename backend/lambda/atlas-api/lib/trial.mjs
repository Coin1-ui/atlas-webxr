/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */

export const TRIAL_DURATION_DAYS = 14;

export const SUSPENDED_LIMITS = {
  models: 0,
  sessionsPerMonth: 0,
  storageBytes: 0,
};

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
 * @param {{ purchasedBillingTier?: string | null }} ws
 * @returns {"Subscribe" | "Upgrade"}
 */
export function planActionVerb(ws) {
  return ws.purchasedBillingTier ? "Upgrade" : "Subscribe";
}

/**
 * Per-tier Subscribe vs Upgrade matrix (mirror of src/shared/trial.ts).
 * Reference = active trial plan, else purchased tier. target > reference → Upgrade, else Subscribe.
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null }} ws
 * @param {BillingTierId} targetTier
 * @returns {"Subscribe" | "Upgrade"}
 */
export function planActionVerbForTier(ws, targetTier) {
  const order = ["starter", "launch", "growth", "scale"];
  const reference = isTrialActive(ws) && ws.trialPlan ? ws.trialPlan : ws.purchasedBillingTier ?? null;
  if (!reference) return "Subscribe";
  return order.indexOf(targetTier) > order.indexOf(reference) ? "Upgrade" : "Subscribe";
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
 * @param {{ trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null }} ws
 */
export function hasPurchasedTrialFallback(ws) {
  if (!ws.trialPlan || !ws.purchasedBillingTier) return false;
  const order = ["starter", "launch", "growth", "scale"];
  const fallback = trialFallbackTier(ws.trialPlan);
  const fallbackIdx = order.indexOf(fallback);
  const purchasedIdx = order.indexOf(ws.purchasedBillingTier);
  return fallbackIdx >= 0 && purchasedIdx >= fallbackIdx;
}

/**
 * @param {{ trialEndsAt?: string | null; trialPlan?: BillingTierId | null; purchasedBillingTier?: BillingTierId | null }} ws
 */
export function isTrialSuspended(ws) {
  return isTrialExpired(ws) && Boolean(ws.trialPlan) && !hasPurchasedTrialFallback(ws);
}

/**
 * @param {number} [days]
 */
export function trialEndsAtIso(days = TRIAL_DURATION_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * @param {{ plan: string; billingTier?: BillingTierId; purchasedBillingTier?: BillingTierId | null; trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 * @returns {BillingTierId}
 */
export function effectiveBillingTier(ws) {
  if (isTrialActive(ws) && ws.trialPlan) return ws.trialPlan;
  if (isTrialSuspended(ws) && ws.trialPlan) return trialFallbackTier(ws.trialPlan);
  if (ws.purchasedBillingTier) return ws.purchasedBillingTier;
  if (ws.billingTier) return ws.billingTier;
  if (ws.plan === "pro") return "growth";
  if (ws.plan === "enterprise") return "scale";
  return "starter";
}
