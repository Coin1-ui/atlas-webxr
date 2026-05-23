import type { CatalogModel } from "./model-catalog";

export async function uploadModelToServer(
  name: string,
  iconFile: File,
  glbFile: File
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("icon", iconFile);
  fd.append("glb", glbFile);
  const res = await fetch("/api/custom-models/upload", { method: "POST", body: fd });
  const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? res.statusText };
  return { ok: true, id: data.id };
}

export async function deleteModelOnServer(id: string): Promise<boolean> {
  const res = await fetch(`/api/custom-models/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function fetchAdminManifest(): Promise<CatalogModel[]> {
  const res = await fetch("/api/custom-models/manifest");
  if (!res.ok) return [];
  const data = (await res.json()) as { models: CatalogModel[] };
  return data.models ?? [];
}
