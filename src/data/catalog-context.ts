/** Active workspace slug for tenant-scoped catalog (set on /w/{slug} routes). */
let catalogWorkspaceSlug: string | null = null;

/** Operator workspace slug backing Try live demo (env or loaded after owner auth). */
let demoCatalogWorkspaceSlug: string | null = null;

export function setCatalogWorkspaceSlug(slug: string | null): void {
  catalogWorkspaceSlug = slug?.trim().toLowerCase() || null;
}

export function getCatalogWorkspaceSlug(): string | null {
  return catalogWorkspaceSlug;
}

export function setDemoCatalogWorkspaceSlug(slug: string | null): void {
  demoCatalogWorkspaceSlug = slug?.trim().toLowerCase() || null;
}

/** Slug for public demo catalog — env override wins, then owner workspace loaded in-session. */
export function getDemoCatalogWorkspaceSlug(): string | null {
  const env = (import.meta.env.VITE_DEMO_WORKSPACE_SLUG as string | undefined)?.trim();
  if (env) {
    const slug = env.toLowerCase();
    return slug === "legacy" ? null : slug;
  }
  if (demoCatalogWorkspaceSlug === "legacy") return null;
  return demoCatalogWorkspaceSlug;
}

/** Workspace slug for tenant catalog asset URLs (slug context or explicit route). */
export function getEffectiveCatalogAssetSlug(explicit?: string | null): string | null {
  if (explicit !== undefined) return explicit;
  return catalogWorkspaceSlug;
}
