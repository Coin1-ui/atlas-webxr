import type { PlanTierId } from "./plan-display";

/** Growth+ tiers include JSON session log export (SAL-3 slide 8). */
export function sessionLogDownloadDefaultForTier(tier: PlanTierId): boolean {
  return tier === "growth" || tier === "scale";
}
