import { limitsForWorkspace } from "./plan-limits";
import type { TrialWorkspace } from "./trial";
import { planDisplayName } from "./plan-display";
import { trialFallbackTier } from "./trial";

export type ModelUploadGate = {
  blocked: boolean;
  used: number;
  limit: number;
  message?: string;
};

export function modelUploadGate(workspace: TrialWorkspace, modelCount: number): ModelUploadGate {
  const limits = limitsForWorkspace(workspace);
  const used = Math.max(0, modelCount);
  if (used < limits.models) {
    return { blocked: false, used, limit: limits.models };
  }
  const plan = planDisplayName(workspace.plan, trialFallbackTier(workspace.trialPlan ?? "growth"));
  return {
    blocked: true,
    used,
    limit: limits.models,
    message: `Model limit reached (${used} / ${limits.models} on ${plan}). Upgrade your plan on Account to add more models.`,
  };
}
