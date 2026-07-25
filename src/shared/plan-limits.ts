import type { PlanTierId } from "./plan-display";
import { effectiveBillingTier, isServicePaused, SUSPENDED_LIMITS, type TrialWorkspace } from "./trial";
import type { WorkspacePlan } from "./tenant";
import { storageBytesForModelCount } from "./upload-size-limits";

export type PlanLimits = {
  models: number;
  sessionsPerMonth: number;
  storageBytes: number;
};

/** AR sessions included per catalog model per month (Starter, Launch, Growth). */
export const SESSIONS_PER_MODEL_PER_MONTH = 100;

/** Scale tier — no monthly session cap (`0` skips usage warnings). */
export const UNLIMITED_SESSIONS_PER_MONTH = 0;

export function sessionsPerMonthForModelSlots(modelSlots: number): number {
  return modelSlots * SESSIONS_PER_MODEL_PER_MONTH;
}

export function isUnlimitedSessionsLimit(sessionsPerMonth: number): boolean {
  return sessionsPerMonth <= 0;
}

/** Storage = model slots × 50 MB max GLB × 2.5. Sessions = model slots × 100/mo (Scale: unlimited). */
export const BILLING_TIER_LIMITS: Record<PlanTierId, PlanLimits> = {
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
    models: 10_000,
    sessionsPerMonth: UNLIMITED_SESSIONS_PER_MONTH,
    storageBytes: storageBytesForModelCount(10_000),
  },
};

/** Legacy backend plan enum — used when billingTier is absent. */
const LEGACY_PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  starter: BILLING_TIER_LIMITS.starter,
  pro: BILLING_TIER_LIMITS.growth,
  enterprise: BILLING_TIER_LIMITS.scale,
};

export function limitsForBillingTier(tier: PlanTierId): PlanLimits {
  return BILLING_TIER_LIMITS[tier] ?? BILLING_TIER_LIMITS.starter;
}

export function limitsForWorkspace(ws: TrialWorkspace): PlanLimits {
  if (isServicePaused(ws)) return SUSPENDED_LIMITS;
  return limitsForBillingTier(effectiveBillingTier(ws));
}

export function planLimits(plan: WorkspacePlan, billingTier?: PlanTierId): PlanLimits {
  if (billingTier) return limitsForBillingTier(billingTier);
  return LEGACY_PLAN_LIMITS[plan] ?? LEGACY_PLAN_LIMITS.starter;
}

export type UsageMetric = "models" | "sessions" | "storage";

export type UsageWarning = {
  metric: UsageMetric;
  level: "warn" | "critical";
  percent: number;
  message: string;
};

export function usageWarnings(
  ws: TrialWorkspace,
  usage: { modelCount: number; sessionCount: number; storageBytes: number },
  opts?: { unrestricted?: boolean }
): UsageWarning[] {
  if (opts?.unrestricted) return [];
  const tier = effectiveBillingTier(ws);
  const limits = limitsForBillingTier(tier);
  const tierLabel = tier === "growth" ? "Growth" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const checks: { metric: UsageMetric; used: number; limit: number; label: string }[] = [
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

  const warnings: UsageWarning[] = [];
  for (const check of checks) {
    if (check.limit <= 0) continue;
    const percent = Math.round((check.used / check.limit) * 100);
    if (percent >= 100) {
      const upgradeHint =
        check.metric === "models"
          ? " Upgrade on Account to add more models."
          : check.metric === "storage"
            ? " New uploads are blocked until you free space or upgrade. Peak storage may still bill with your subscription on hybrid plans."
            : " AR stays available; overage meters bill with your next subscription payment on hybrid plans.";
      warnings.push({
        metric: check.metric,
        level: "critical",
        percent,
        message: `${check.label} at ${percent}% of your ${tierLabel} plan limit (${check.used} / ${check.limit}).${upgradeHint}`,
      });
    } else if (percent >= 80) {
      warnings.push({
        metric: check.metric,
        level: "warn",
        percent,
        message: `${check.label} at ${percent}% of your ${tierLabel} plan limit (${check.used} / ${check.limit}).`,
      });
    }
  }
  return warnings;
}

export function formatStorageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Account/admin usage row for session cap (Scale → Unlimited). */
export function formatSessionsLimit(sessionsPerMonth: number): string {
  return isUnlimitedSessionsLimit(sessionsPerMonth) ? "Unlimited" : String(sessionsPerMonth);
}
