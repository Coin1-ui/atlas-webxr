import type { PlacementObjectType } from "../xr/webxr-ar";

export type CatalogModel = {
  id: string;
  name: string;
  builtinType?: PlacementObjectType;
  icon?: string;
  glb?: string;
};

type Manifest = {
  version: number;
  models: CatalogModel[];
};

const manifestUrl = `${import.meta.env.BASE_URL}custom-models/manifest.json`;

function assetUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}custom-models/${encodeURIComponent(filename)}`;
}

export async function fetchCatalog(): Promise<CatalogModel[]> {
  const res = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as Manifest;
  return data.models ?? [];
}

export type CatalogAssets = {
  record: CatalogModel;
  iconUrl: string | null;
  modelUrl: string | null;
};

export function resolveCatalogAssets(model: CatalogModel): CatalogAssets {
  return {
    record: model,
    iconUrl: model.icon ? assetUrl(model.icon) : null,
    modelUrl: model.glb ? assetUrl(model.glb) : null,
  };
}

export async function getCatalogAssets(id: string): Promise<CatalogAssets | null> {
  const models = await fetchCatalog();
  const record = models.find((m) => m.id === id);
  if (!record) return null;
  return resolveCatalogAssets(record);
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
