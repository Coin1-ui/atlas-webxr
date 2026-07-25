import { formatStorageBytes, limitsForWorkspace } from "./plan-limits";
import type { TrialWorkspace } from "./trial";
import { planDisplayName } from "./plan-display";
import { effectiveBillingTier } from "./trial";

export type ModelUploadGate = {
  blocked: boolean;
  used: number;
  limit: number;
  message?: string;
  /** models | storage — which limit blocked upload */
  reason?: "models" | "storage";
};

export function modelUploadGate(
  workspace: TrialWorkspace,
  modelCount: number,
  storageBytesUsed = 0,
): ModelUploadGate {
  const limits = limitsForWorkspace(workspace);
  const used = Math.max(0, modelCount);
  const plan = planDisplayName(workspace.plan, effectiveBillingTier(workspace));

  if (used >= limits.models) {
    return {
      blocked: true,
      used,
      limit: limits.models,
      reason: "models",
      message: `Model limit reached (${used} / ${limits.models} on ${plan}). Upgrade your plan on Account to add more models.`,
    };
  }

  if (limits.storageBytes > 0 && storageBytesUsed >= limits.storageBytes) {
    return {
      blocked: true,
      used,
      limit: limits.models,
      reason: "storage",
      message: `Storage limit reached (${formatStorageBytes(storageBytesUsed)} / ${formatStorageBytes(limits.storageBytes)} on ${plan}). Free space or upgrade on Account to upload more.`,
    };
  }

  return { blocked: false, used, limit: limits.models };
}
