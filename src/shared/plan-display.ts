import type { WorkspacePlan } from "./tenant";
import { effectiveBillingTier, hasPurchasedTrialFallback, isTrialActive, isTrialSuspended, trialFallbackTier, type TrialWorkspace } from "./trial";

export type PlanTierId = "starter" | "launch" | "growth" | "scale";

export type PlanTier = {
  id: PlanTierId;
  name: string;
  price: string;
  backendPlan?: WorkspacePlan;
};

/** Marketing tier labels mapped to backend plan enum. */
export const PLAN_TIERS: PlanTier[] = [
  { id: "starter", name: "Starter", price: "$5/mo", backendPlan: "starter" },
  { id: "launch", name: "Launch", price: "$59/mo", backendPlan: "starter" },
  { id: "growth", name: "Growth", price: "$179/mo", backendPlan: "pro" },
  { id: "scale", name: "Scale", price: "From $499/mo", backendPlan: "enterprise" },
];

export function planDisplayName(plan: WorkspacePlan, billingTier?: PlanTierId): string {
  if (billingTier) {
    const tier = PLAN_TIERS.find((t) => t.id === billingTier);
    if (tier) return tier.name;
  }
  if (plan === "pro") return "Growth";
  if (plan === "enterprise") return "Scale";
  return "Starter";
}

/** Map pricing-page tier to stored backend plan enum. */
export function backendPlanFromBillingTier(tier: PlanTierId): WorkspacePlan {
  const row = PLAN_TIERS.find((t) => t.id === tier);
  return row?.backendPlan ?? "starter";
}

/** Best-effort marketing tier from workspace record. */
export function billingTierFromWorkspace(ws: {
  plan: WorkspacePlan;
  billingTier?: PlanTierId;
}): PlanTierId {
  if (ws.billingTier) return ws.billingTier;
  if (ws.plan === "pro") return "growth";
  if (ws.plan === "enterprise") return "scale";
  return "starter";
}

export function tierOptionLabel(tier: PlanTier): string {
  return `${tier.name} — ${tier.price}`;
}

/** Customer-facing tiers on pricing page (excludes Scale for self-serve coupon targets). */
export const CUSTOMER_BILLING_TIERS = PLAN_TIERS.filter((t) => t.id !== "scale");

export function upgradeOptions(ws: TrialWorkspace): PlanTier[] {
  if (isTrialSuspended(ws) && ws.trialPlan) {
    // Suspended: offer every self-serve tier so the customer can resubscribe at any level.
    return CUSTOMER_BILLING_TIERS;
  }
  if (isTrialActive(ws) && ws.trialPlan && !hasPurchasedTrialFallback(ws)) {
    const required = trialFallbackTier(ws.trialPlan);
    const order: PlanTierId[] = ["starter", "launch", "growth", "scale"];
    const minIdx = order.indexOf(required);
    return PLAN_TIERS.filter((t) => order.indexOf(t.id) >= minIdx && t.id !== "scale");
  }
  const current = effectiveBillingTier(ws);
  const order: PlanTierId[] = ["starter", "launch", "growth", "scale"];
  const idx = order.indexOf(current);
  if (idx < 0) return [];
  return PLAN_TIERS.filter((t) => order.indexOf(t.id) > idx);
}

/** Rough overage estimate when usage exceeds included limits (USD). */
export function estimateOverageUsd(
  tier: PlanTierId,
  usage: { modelCount: number; sessionCount: number; storageBytes: number },
  limits: { models: number; sessionsPerMonth: number; storageBytes: number }
): number {
  let total = 0;
  const sessionOver = Math.max(0, usage.sessionCount - limits.sessionsPerMonth);
  const modelOver = Math.max(0, usage.modelCount - limits.models);
  const storageOverGb = Math.max(0, (usage.storageBytes - limits.storageBytes) / (1024 * 1024 * 1024));

  if (tier === "starter") {
    total += Math.ceil(sessionOver / 100) * 20;
    total += modelOver * 3;
    total += Math.ceil(storageOverGb / 5) * 8;
  } else if (tier === "launch") {
    total += Math.ceil(sessionOver / 1000) * 15;
    total += Math.ceil(modelOver / 10) * 12;
    total += Math.ceil(storageOverGb / 10) * 6;
  } else if (tier === "growth") {
    total += Math.ceil(sessionOver / 1000) * 10;
    total += Math.ceil(modelOver / 10) * 8;
    total += Math.ceil(storageOverGb / 10) * 4;
  } else {
    total += Math.ceil(sessionOver / 1000) * 10;
  }
  return Math.round(total * 100) / 100;
}
