import type { PlanLimits } from "./plan-limits";

/** Product matrix — mirrors backend `overage-entitlements.mjs`. */
export const OVERAGE_ENTITLEMENT_MATRIX = {
  sessions: {
    metric: "sessions" as const,
    label: "AR sessions",
    overageExtendsCap: true,
    requiresSubscription: true,
    note: "Meter add-on — paying overage raises your session cap for the rest of the billing month.",
  },
  models: {
    metric: "models" as const,
    label: "Models",
    overageExtendsCap: false,
    requiresSubscription: true,
    note: "Overage settles excess model usage; adding new slots requires a plan upgrade.",
  },
  storage: {
    metric: "storage" as const,
    label: "Storage",
    overageExtendsCap: false,
    requiresSubscription: true,
    note: "Overage settles excess storage used; included storage follows your plan tier.",
  },
};

export type EffectiveLimits = PlanLimits & {
  overageExtended?: { sessions: boolean; models: boolean; storage: boolean };
};

export function effectiveUsageLimits(
  planLimits: PlanLimits,
  overageRecord: {
    status?: string;
    usageSnapshot?: { modelCount?: number; sessionCount?: number; storageBytes?: number } | null;
  } | null,
): EffectiveLimits {
  const paid = overageRecord?.status === "paid" || overageRecord?.status === "accepted";
  if (!paid || !overageRecord?.usageSnapshot) {
    return { ...planLimits, overageExtended: { sessions: false, models: false, storage: false } };
  }
  const snap = overageRecord.usageSnapshot;
  const sessionSnap = Number(snap.sessionCount ?? 0);
  const sessionExtended =
    planLimits.sessionsPerMonth > 0 && sessionSnap > planLimits.sessionsPerMonth;
  return {
    models: planLimits.models,
    sessionsPerMonth: sessionExtended
      ? Math.max(planLimits.sessionsPerMonth, sessionSnap)
      : planLimits.sessionsPerMonth,
    storageBytes: planLimits.storageBytes,
    overageExtended: { sessions: sessionExtended, models: false, storage: false },
  };
}
