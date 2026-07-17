import type { PlanTierId } from "./plan-display";
import type { WorkspaceFeatures } from "./workspace-features";
import { normalizeWorkspaceFeatures } from "./workspace-features";

export type WorkspacePlan = "starter" | "pro" | "enterprise";

export type WorkspaceBranding = {
  logoUrl?: string;
  primaryColor?: string;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  plan: WorkspacePlan;
  /** Pricing-page tier (Starter / Launch / Growth / Scale). */
  billingTier?: PlanTierId;
  /** ISO end of promotional trial; absent when none or owner-assigned plan. */
  trialEndsAt?: string | null;
  /** Limits tier while trial is active (default growth). */
  trialPlan?: PlanTierId | null;
  /** Paid tier — set when customer purchases a plan (not at signup). */
  purchasedBillingTier?: PlanTierId | null;
  branding: WorkspaceBranding;
  /** Optional URL/path opened when viewer taps Exit AR (https://… or /path). */
  arExitUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Platform owner restriction (policy violation). */
  restricted?: boolean;
  restrictionReason?: string;
  /** Owner-controlled viewer feature flags. */
  features?: WorkspaceFeatures;
};

export type PublicWorkspaceConfig = {
  id: string;
  slug: string;
  name: string;
  plan: WorkspacePlan;
  branding: WorkspaceBranding;
  arExitUrl?: string | null;
  features?: WorkspaceFeatures;
};

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(slug);
}

export function slugFromName(name: string, slug?: string): string {
  const base = normalizeSlug(slug || name);
  return base.slice(0, 32) || `ws-${Date.now().toString(36)}`;
}

export function toPublicConfig(workspace: Workspace): PublicWorkspaceConfig {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    plan: workspace.plan,
    branding: workspace.branding,
    arExitUrl: workspace.arExitUrl ?? null,
    features: normalizeWorkspaceFeatures(workspace.features),
  };
}
