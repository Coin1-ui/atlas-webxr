/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */

/**
 * Product matrix — which meters overage extends vs subscription-only.
 *
 * | Metric        | Overage extends monthly cap? | Requires live subscription? |
 * |---------------|------------------------------|-----------------------------|
 * | AR sessions   | Yes — paid blocks add headroom for the billing month      | Yes                         |
 * | Models        | No — retrospective billing only; catalog cap = plan tier   | Yes                         |
 * | Storage       | No — retrospective billing only; cap = plan tier          | Yes                         |
 */
export const OVERAGE_ENTITLEMENT_MATRIX = {
  sessions: {
    metric: "sessions",
    label: "AR sessions",
    overageExtendsCap: true,
    requiresSubscription: true,
    note: "Meter add-on — paying overage raises your session cap for the rest of the billing month.",
  },
  models: {
    metric: "models",
    label: "Models",
    overageExtendsCap: false,
    requiresSubscription: true,
    note: "Overage settles excess model usage; adding new slots requires a plan upgrade.",
  },
  storage: {
    metric: "storage",
    label: "Storage",
    overageExtendsCap: false,
    requiresSubscription: true,
    note: "Overage settles excess storage used; included storage follows your plan tier.",
  },
};

/**
 * @param {{ models: number; sessionsPerMonth: number; storageBytes: number }} planLimits
 * @param {{ status?: string; usageSnapshot?: { modelCount?: number; sessionCount?: number; storageBytes?: number } | null } | null} overageRecord
 */
export function effectiveUsageLimits(planLimits, overageRecord) {
  const base = {
    models: planLimits.models,
    sessionsPerMonth: planLimits.sessionsPerMonth,
    storageBytes: planLimits.storageBytes,
  };
  const paid =
    overageRecord?.status === "paid" || overageRecord?.status === "accepted";
  if (!paid || !overageRecord?.usageSnapshot) {
    return { ...base, overageExtended: { sessions: false, models: false, storage: false } };
  }

  const snap = overageRecord.usageSnapshot;
  const sessionSnap = Number(snap.sessionCount ?? 0);
  const sessionExtended =
    planLimits.sessionsPerMonth > 0 && sessionSnap > planLimits.sessionsPerMonth;

  return {
    models: base.models,
    sessionsPerMonth: sessionExtended
      ? Math.max(planLimits.sessionsPerMonth, sessionSnap)
      : base.sessionsPerMonth,
    storageBytes: base.storageBytes,
    overageExtended: {
      sessions: sessionExtended,
      models: false,
      storage: false,
    },
  };
}

/**
 * Usage counts to display — live usage, or billed snapshot when overage settled.
 * Always preserves `month` and other live fields (UI calls escapeHtml on month).
 *
 * @param {{ month?: string; modelCount: number; sessionCount: number; storageBytes: number }} liveUsage
 * @param {{ status?: string; usageSnapshot?: object | null } | null} overageRecord
 */
export function displayUsageCounts(liveUsage, overageRecord) {
  const settled =
    overageRecord?.status === "paid" || overageRecord?.status === "accepted";
  if (!settled || !overageRecord?.usageSnapshot) return liveUsage;
  const snap = overageRecord.usageSnapshot;
  return {
    ...liveUsage,
    modelCount: Number(snap.modelCount ?? liveUsage.modelCount),
    sessionCount: Number(snap.sessionCount ?? liveUsage.sessionCount),
    storageBytes: Number(snap.storageBytes ?? liveUsage.storageBytes),
  };
}

/**
 * @param {string | null | undefined} sandboxSeededAt
 * @param {{ sandbox?: boolean; status?: string; providerPaymentId?: string | null; note?: string | null; amountUsd?: number | null; usageSnapshot?: { sessionCount?: number; modelCount?: number } | null } | null} overageRecord
 * @param {{ sessionsPerMonth?: number; models?: number } | null} [planLimits]
 * @param {{ sessionCount?: number; modelCount?: number } | null} [liveUsage]
 */
export function isSandboxUsageContext(sandboxSeededAt, overageRecord, planLimits = null, liveUsage = null) {
  if (sandboxSeededAt) return true;
  if (overageRecord?.sandbox === true) return true;
  const note = String(overageRecord?.note || "").toLowerCase();
  if (note.includes("sandbox") || note.includes("api-sandbox-seed")) return true;

  const settled =
    overageRecord?.status === "paid" || overageRecord?.status === "accepted";
  if (!settled) return false;

  // Settled overage with no Dodo payment id = test accept / invoicing stub.
  if (!overageRecord?.providerPaymentId) return true;

  // Orphaned test charge: usage already reset (or back within plan) but OVERAGE row remains.
  // Example: seed → pay $40 → clear sessions → still shows Paid $40 with 0 / 5000 sessions.
  const planSessions = Number(planLimits?.sessionsPerMonth || 0);
  const liveSessions = Number(liveUsage?.sessionCount ?? 0);
  const snapSessions = Number(overageRecord?.usageSnapshot?.sessionCount ?? 0);
  const withinPlan =
    planSessions <= 0 ? liveSessions === 0 : liveSessions <= planSessions;
  const snapshotWasOverage = planSessions > 0 && snapSessions > planSessions;
  const seedPattern = planSessions > 0 && snapSessions === planSessions + 150;
  if (withinPlan && (liveSessions === 0 || snapshotWasOverage || seedPattern || !overageRecord?.usageSnapshot)) {
    return true;
  }

  return false;
}
