import type { PlacementObjectType } from "../xr/webxr-ar";
import {
  canUploadDemoLocal,
  isLocalDev,
  modelApiUrl,
  useRemoteModelApi,
} from "../config/api";
import { fetchAdminManifestMerged } from "./model-admin-api";
import {
  getCatalogWorkspaceSlug,
  getDemoCatalogWorkspaceSlug,
  getEffectiveCatalogAssetSlug,
  setCatalogWorkspaceSlug,
  setDemoCatalogWorkspaceSlug,
} from "./catalog-context";
import { fetchTenantCatalog, tenantAssetUrl } from "./tenant-model-api";

export { setCatalogWorkspaceSlug, getCatalogWorkspaceSlug, getEffectiveCatalogAssetSlug, setDemoCatalogWorkspaceSlug, getDemoCatalogWorkspaceSlug };

export type CatalogRealWorldScale = {
  /** Direct uniform multiplier (1 = no change). */
  scaleFactor?: number;
  /** Target width in meters (glTF 1 unit = 1 meter). */
  widthM?: number;
  depthM?: number;
  heightM?: number;
};

export type CatalogModel = {
  id: string;
  name: string;
  builtinType?: PlacementObjectType;
  icon?: string;
  glb?: string;
  /** iOS-only USDZ for Safari Quick Look / native ARKit (not used on Android). */
  usdz?: string;
  iconUrl?: string;
  glbUrl?: string;
  usdzUrl?: string;
  /** Optional real-world dimensions — only when GLB export scale cannot be fixed at source. */
  realWorld?: CatalogRealWorldScale;
  /** Per-model Exit AR destination (overrides workspace default). */
  arExitUrl?: string | null;
  /** Global demo catalog — asset location when local + S3 catalogs are merged. */
  demoStorage?: "local" | "remote";
};

type Manifest = {
  version: number;
  models: CatalogModel[];
};

const staticManifestUrl = `${import.meta.env.BASE_URL}custom-models/manifest.json`;

/** Built-in placeholder meshes (removed from shopper catalog). */
export function isDemoCatalogModel(model: Pick<CatalogModel, "id" | "builtinType">): boolean {
  return Boolean(model.builtinType) || model.id.startsWith("builtin-");
}
const CATALOG_FETCH_MS = 8000;

async function fetchManifest(url: string): Promise<CatalogModel[]> {
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), CATALOG_FETCH_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ac.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as Manifest;
    return data.models ?? [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchStaticManifest(): Promise<CatalogModel[]> {
  return fetchManifest(`${staticManifestUrl}?t=${Date.now()}`);
}

export async function fetchCatalog(opts?: { bustCache?: boolean }): Promise<CatalogModel[]> {
  const tenantSlug = getCatalogWorkspaceSlug();
  if (tenantSlug) {
    const tenantModels = await fetchTenantCatalog(tenantSlug, opts);
    return tenantModels.filter((m) => !isDemoCatalogModel(m));
  }

  const demoSlug = getDemoCatalogWorkspaceSlug();
  if (demoSlug) {
    const demoModels = await fetchTenantCatalog(demoSlug, opts);
    return demoModels.filter((m) => !isDemoCatalogModel(m));
  }

  let custom: CatalogModel[] = [];

  if (useRemoteModelApi() || canUploadDemoLocal()) {
    try {
      const demo = await fetchAdminManifestMerged(opts);
      custom = demo.map(({ demoStorage, ...m }) => ({
        ...m,
        demoStorage,
      }));
    } catch {
      custom = [];
    }
  }

  if (!custom.length) {
    const bust = opts?.bustCache ? `?t=${Date.now()}` : "";
    if (useRemoteModelApi()) {
      const remote = await fetchManifest(`${modelApiUrl("/models/manifest")}${bust}`);
      if (isLocalDev()) {
        const local = await fetchStaticManifest();
        const remoteTagged = remote.map((m) => ({ ...m, demoStorage: "remote" as const }));
        const localTagged = local
          .filter((m) => !remote.some((r) => r.id === m.id))
          .map((m) => ({ ...m, demoStorage: "local" as const }));
        custom = [...remoteTagged, ...localTagged];
      } else {
        custom = remote;
      }
    }
    if (!custom.length) {
      custom = await fetchStaticManifest();
    }
  }

  return custom.filter((m) => !isDemoCatalogModel(m));
}

export function findCatalogModelById(models: CatalogModel[], modelId: string): CatalogModel | undefined {
  const id = decodeURIComponent(modelId);
  return models.find((m) => m.id === id) ?? models.find((m) => m.id.toLowerCase() === id.toLowerCase());
}

function assetUrl(
  filename: string,
  demoStorage?: "local" | "remote",
  tenantSlug?: string | null,
): string {
  const slug = tenantSlug !== undefined ? tenantSlug : getCatalogWorkspaceSlug();
  if (slug) {
    return tenantAssetUrl(slug, filename);
  }
  if (demoStorage === "local") {
    return `${import.meta.env.BASE_URL}custom-models/${encodeURIComponent(filename)}`;
  }
  if (useRemoteModelApi()) {
    return modelApiUrl(`/models/assets/${encodeURIComponent(filename)}`);
  }
  return `${import.meta.env.BASE_URL}custom-models/${encodeURIComponent(filename)}`;
}

export type CatalogAssets = {
  record: CatalogModel;
  iconUrl: string | null;
  modelUrl: string | null;
  /** iOS Quick Look / native ARKit only. */
  usdzUrl: string | null;
};

export function resolveCatalogAssets(model: CatalogModel, tenantSlug?: string | null): CatalogAssets {
  const slug = getEffectiveCatalogAssetSlug(tenantSlug);
  // Prefer manifest filename fields — pre-set *Url values are often stale or wrong host.
  if (model.icon || model.glb || model.usdz) {
    return {
      record: model,
      iconUrl: model.icon ? assetUrl(model.icon, model.demoStorage, slug) : null,
      modelUrl: model.glb ? assetUrl(model.glb, model.demoStorage, slug) : null,
      usdzUrl: model.usdz ? assetUrl(model.usdz, model.demoStorage, slug) : null,
    };
  }
  if (model.iconUrl || model.glbUrl || model.usdzUrl) {
    return {
      record: model,
      iconUrl: model.iconUrl ?? null,
      modelUrl: model.glbUrl ?? null,
      usdzUrl: model.usdzUrl ?? null,
    };
  }
  return {
    record: model,
    iconUrl: null,
    modelUrl: null,
    usdzUrl: null,
  };
}

export async function getCatalogAssets(
  id: string,
  tenantSlug?: string | null,
  opts?: { bustCache?: boolean },
): Promise<CatalogAssets | null> {
  const models = await fetchCatalog(opts);
  const record = models.find((m) => m.id === id);
  if (!record) return null;
  return resolveCatalogAssets(record, tenantSlug);
}

export function defaultIconForBuiltin(type: PlacementObjectType): string {
  if (type === "arrow") {
    return (
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1565c0"/><path fill="#42a5f5" d="M32 12 L44 40 L36 40 L36 52 L28 52 L28 40 L20 40 Z"/></svg>`
      )
    );
  }
  if (type === "zone") {
    return (
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="#ef5350" stroke-width="6"/></svg>`
      )
    );
  }
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="28" width="48" height="20" rx="4" fill="#42a5f5"/></svg>`
    )
  );
}

export function catalogSourceLabel(): string {
  const slug = getCatalogWorkspaceSlug();
  if (slug) return `tenant:${slug}`;
  const demoSlug = getDemoCatalogWorkspaceSlug();
  if (demoSlug) return `demo:${demoSlug}`;
  if (useRemoteModelApi() && isLocalDev()) return "remote + local demo catalogs";
  return useRemoteModelApi() ? "remote catalog" : "static manifest";
}
