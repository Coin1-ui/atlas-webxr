/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */
/** @typedef {"starter" | "pro" | "enterprise"} WorkspacePlan */

import { effectiveBillingTier, isTrialSuspended, SUSPENDED_LIMITS } from "./trial.mjs";

/** @type {Record<BillingTierId, { models: number; sessionsPerMonth: number; storageBytes: number }>} */
export const BILLING_TIER_LIMITS = {
  starter: {
    models: 5,
    sessionsPerMonth: 100,
    storageBytes: 2 * 1024 * 1024 * 1024,
  },
  launch: {
    models: 30,
    sessionsPerMonth: 1000,
    storageBytes: 5 * 1024 * 1024 * 1024,
  },
  growth: {
    models: 100,
    sessionsPerMonth: 5000,
    storageBytes: 25 * 1024 * 1024 * 1024,
  },
  scale: {
    models: 10000,
    sessionsPerMonth: 1000000,
    storageBytes: 1024 * 1024 * 1024 * 1024,
  },
};

/** @type {Record<WorkspacePlan, { models: number; sessionsPerMonth: number; storageBytes: number }>} */
export const PLAN_LIMITS = {
  starter: BILLING_TIER_LIMITS.starter,
  pro: BILLING_TIER_LIMITS.growth,
  enterprise: BILLING_TIER_LIMITS.scale,
};

/**
 * @param {BillingTierId} tier
 */
export function limitsForBillingTier(tier) {
  return BILLING_TIER_LIMITS[tier] || BILLING_TIER_LIMITS.starter;
}

/**
 * @param {{ plan: WorkspacePlan; billingTier?: BillingTierId; trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 */
export function limitsForWorkspace(ws) {
  if (isTrialSuspended(ws)) return SUSPENDED_LIMITS;
  return limitsForBillingTier(effectiveBillingTier(ws));
}

/**
 * @param {WorkspacePlan} plan
 */
export function limitsForPlan(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

/**
 * @param {{ plan: WorkspacePlan; billingTier?: BillingTierId; trialEndsAt?: string | null; trialPlan?: BillingTierId | null }} ws
 * @param {{ modelCount: number; sessionCount: number; storageBytes: number }} usage
 */
export function buildUsageWarnings(ws, usage) {
  const tier = effectiveBillingTier(ws);
  const limits = limitsForBillingTier(tier);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  /** @type {{ metric: string; level: "warn" | "critical"; percent: number; message: string }[]} */
  const warnings = [];
  const checks = [
    { metric: "models", used: usage.modelCount, limit: limits.models, label: "models" },
    {
      metric: "sessions",
      used: usage.sessionCount,
      limit: limits.sessionsPerMonth,
      label: "AR sessions this month",
    },
    {
      metric: "storage",
      used: usage.storageBytes,
      limit: limits.storageBytes,
      label: "storage",
    },
  ];
  for (const check of checks) {
    if (check.limit <= 0) continue;
    const percent = Math.round((check.used / check.limit) * 100);
    if (percent >= 100) {
      warnings.push({
        metric: check.metric,
        level: "critical",
        percent,
        message: `${check.label} at ${percent}% of your ${tierLabel} plan limit.`,
      });
    } else if (percent >= 80) {
      warnings.push({
        metric: check.metric,
        level: "warn",
        percent,
        message: `${check.label} at ${percent}% of your ${tierLabel} plan limit.`,
      });
    }
  }
  return warnings;
}
