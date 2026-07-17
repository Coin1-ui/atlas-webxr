import { getApiBase } from "../config/api";
import {
  getDemoCatalogWorkspaceSlug,
  setDemoCatalogWorkspaceSlug,
} from "./catalog-context";
import { fetchTenantCatalog } from "./tenant-model-api";
import { isDemoCatalogModel } from "./model-catalog";

export type DemoCatalogConfig = {
  workspaceSlug?: string;
};

/** Legacy seed workspace — empty catalog, must not power Try live demo. */
const LEGACY_DEMO_SLUG = "legacy";

let resolvePromise: Promise<string | null> | null = null;

function normalizeDemoSlug(slug: string | undefined | null): string | null {
  const s = slug?.trim().toLowerCase();
  if (!s || s === LEGACY_DEMO_SLUG) return null;
  return s;
}

async function fetchDemoConfigFile(): Promise<string | null> {
  try {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
    const res = await fetch(`${base}demo-config.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;
    const json = (await res.json()) as DemoCatalogConfig;
    return normalizeDemoSlug(json.workspaceSlug);
  } catch {
    return null;
  }
}

async function fetchPublicDemoSlug(): Promise<string | null> {
  try {
    const base = getApiBase().replace(/\/$/, "");
    const url = base ? `${base}/v2/platform/public-settings` : "/v2/platform/public-settings";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { demoWorkspaceSlug?: string };
    return normalizeDemoSlug(json.demoWorkspaceSlug);
  } catch {
    return null;
  }
}

async function slugHasCatalogModels(slug: string): Promise<boolean> {
  const models = await fetchTenantCatalog(slug, { bustCache: true });
  return models.some((m) => !isDemoCatalogModel(m));
}

/**
 * Resolve the operator workspace slug backing Try live demo (/demo, /ar/{id}).
 * Order: in-memory/env → demo-config.json → public-settings API (skips legacy slug).
 */
export async function resolveDemoWorkspaceSlug(): Promise<string | null> {
  const existing = normalizeDemoSlug(getDemoCatalogWorkspaceSlug());
  if (existing) return existing;

  if (!resolvePromise) {
    resolvePromise = (async () => {
      const fromFile = await fetchDemoConfigFile();
      if (fromFile && (await slugHasCatalogModels(fromFile))) {
        setDemoCatalogWorkspaceSlug(fromFile);
        return fromFile;
      }
      const fromApi = await fetchPublicDemoSlug();
      if (fromApi && (await slugHasCatalogModels(fromApi))) {
        setDemoCatalogWorkspaceSlug(fromApi);
        return fromApi;
      }
      return null;
    })().finally(() => {
      resolvePromise = null;
    });
  }
  return resolvePromise;
}

export function demoCatalogMissingMessage(): string {
  return (
    "Try live demo is not linked to a model catalog yet. " +
    "Open Owner → Live demo models to confirm your operator workspace slug, " +
    "then set VITE_DEMO_WORKSPACE_SLUG in Amplify (not legacy) and redeploy."
  );
}

export function demoCatalogEmptyMessage(slug: string): string {
  return (
    `Try live demo workspace "${slug}" has no models yet. ` +
    "Upload models in Owner → Live demo models, then try again."
  );
}
