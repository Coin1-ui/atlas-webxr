/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */

/**
 * True when current-month usage exceeds included plan limits (any dimension).
 * @param {BillingTierId} tier
 * @param {{ modelCount: number; sessionCount: number; storageBytes: number }} usage
 * @param {{ models: number; sessionsPerMonth: number; storageBytes: number }} limits
 */
export function workspaceIsInOverage(tier, usage, limits) {
  return estimateOverageUsd(tier, usage, limits) > 0;
}

/**
 * Overage-gated plan change: remount (cancel-at-renewal + resubscribe) only when
 * the workspace is currently in overage. Within limits → scheduled change-plan.
 * @param {BillingTierId} currentTier
 * @param {{ modelCount: number; sessionCount: number; storageBytes: number }} usage
 * @param {{ models: number; sessionsPerMonth: number; storageBytes: number }} limits
 */
export function needsOveragePlanRemount(currentTier, usage, limits) {
  return workspaceIsInOverage(currentTier, usage, limits);
}

/**
 * Rough overage estimate when usage exceeds included limits (USD).
 * Mirrors `src/shared/plan-display.ts` estimateOverageUsd.
 *
 * @param {BillingTierId} tier
 * @param {{ modelCount: number; sessionCount: number; storageBytes: number }} usage
 * @param {{ models: number; sessionsPerMonth: number; storageBytes: number }} limits
 */
export function estimateOverageUsd(tier, usage, limits) {
  let total = 0;
  const sessionOver =
    limits.sessionsPerMonth <= 0
      ? 0
      : Math.max(0, usage.sessionCount - limits.sessionsPerMonth);
  const modelOver = Math.max(0, usage.modelCount - limits.models);
  const storageOverGb = Math.max(
    0,
    (usage.storageBytes - limits.storageBytes) / (1024 * 1024 * 1024)
  );

  if (tier === "starter") {
    total += Math.ceil(sessionOver / 100) * 5;
    total += modelOver * 3;
    total += Math.ceil(storageOverGb / 5) * 8;
  } else if (tier === "launch") {
    total += Math.ceil(sessionOver / 1000) * 8;
    total += Math.ceil(modelOver / 10) * 12;
    total += Math.ceil(storageOverGb / 10) * 6;
  } else if (tier === "growth") {
    total += Math.ceil(sessionOver / 1000) * 5;
    total += Math.ceil(modelOver / 10) * 8;
    total += Math.ceil(storageOverGb / 10) * 4;
  } else {
    total += Math.ceil(sessionOver / 1000) * 5;
  }
  return Math.round(total * 100) / 100;
}

/** @param {string} month */
export function normalizeOverageMonth(month) {
  const normalized = typeof month === "string" ? month.trim() : "";
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    throw Object.assign(new Error("month must be YYYY-MM"), { statusCode: 400 });
  }
  return normalized;
}
