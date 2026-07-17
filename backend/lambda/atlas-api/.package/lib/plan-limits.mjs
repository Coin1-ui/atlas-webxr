/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */
/** @typedef {"starter" | "pro" | "enterprise"} WorkspacePlan */

import { effectiveBillingTier, isTrialSuspended, SUSPENDED_LIMITS } from "./trial.mjs";

/** Max GLB/USDZ per file (all tiers). Storage = models × this × 2.5. Sessions = models × 100/mo (Scale unlimited). */
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MODEL_STORAGE_MULTIPLIER = 2.5;
const SESSIONS_PER_MODEL_PER_MONTH = 100;
const UNLIMITED_SESSIONS_PER_MONTH = 0;

function storageBytesForModelCount(models) {
  return Math.round(models * MAX_ASSET_BYTES * MODEL_STORAGE_MULTIPLIER);
}

function sessionsPerMonthForModelSlots(models) {
  return models * SESSIONS_PER_MODEL_PER_MONTH;
}

/** @type {Record<BillingTierId, { models: number; sessionsPerMonth: number; storageBytes: number }>} */
export const BILLING_TIER_LIMITS = {
  starter: {
    models: 5,
    sessionsPerMonth: sessionsPerMonthForModelSlots(5),
    storageBytes: storageBytesForModelCount(5),
  },
  launch: {
    models: 30,
    sessionsPerMonth: sessionsPerMonthForModelSlots(30),
    storageBytes: storageBytesForModelCount(30),
  },
  growth: {
    models: 100,
    sessionsPerMonth: sessionsPerMonthForModelSlots(100),
    storageBytes: storageBytesForModelCount(100),
  },
  scale: {
    models: 10000,
    sessionsPerMonth: UNLIMITED_SESSIONS_PER_MONTH,
    storageBytes: storageBytesForModelCount(10000),
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
