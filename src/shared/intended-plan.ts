import type { PlanTierId } from "./plan-display";

const KEY = "atlas.intendedTrialPlan";

/** Trial plans a visitor can self-serve start from the pricing page. */
export type IntendedTrialPlan = Extract<PlanTierId, "growth" | "launch">;

function isIntendedTrialPlan(v: unknown): v is IntendedTrialPlan {
  return v === "growth" || v === "launch";
}

/** Remember the trial plan a visitor picked (survives signup → verify → onboard). */
export function setIntendedTrialPlan(plan: IntendedTrialPlan): void {
  try {
    window.localStorage.setItem(KEY, plan);
  } catch {
    /* storage unavailable — fall back to Growth default */
  }
}

/** Trial plan the visitor picked, or `null` if none/invalid. */
export function getIntendedTrialPlan(): IntendedTrialPlan | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return isIntendedTrialPlan(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearIntendedTrialPlan(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
