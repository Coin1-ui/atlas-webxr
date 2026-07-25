import type { CatalogModel } from "./model-catalog";
import { getApiBase, useRemoteModelApi } from "../config/api";
import { authBearerToken, loadSession } from "../auth/session";

type PresignUpload = {
  url: string;
  filename: string;
  contentType: string;
};

type PresignResponse = {
  id: string;
  name: string;
  uploads: {
    icon: PresignUpload;
    glb: PresignUpload;
    usdz?: PresignUpload;
  };
};

function apiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path.startsWith("/") ? path : `/${path}`;
}

function authHeaders(): HeadersInit {
  const token = authBearerToken(loadSession());
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function tenantCatalogUrl(slug: string, path = ""): string {
  return apiUrl(`/v2/workspaces/${encodeURIComponent(slug)}/catalog${path}`);
}

export function tenantAssetUrl(slug: string, filename: string): string {
  return tenantCatalogUrl(slug, `/assets/${encodeURIComponent(filename)}`);
}

export async function fetchTenantCatalog(slug: string, opts?: { bustCache?: boolean }): Promise<CatalogModel[]> {
  const bust = opts?.bustCache ? `?t=${Date.now()}` : "";
  const res = await fetch(tenantCatalogUrl(slug, bust), { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: CatalogModel[] };
  return data.models ?? [];
}

export async function fetchWorkspaceAdminManifest(workspaceId: string): Promise<CatalogModel[]> {
  const res = await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/models/manifest`), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { models?: CatalogModel[] };
  return data.models ?? [];
}

export function tenantAdminApiHint(slug: string): string {
  return useRemoteModelApi() ? `Remote catalog · ${slug}` : `Local catalog · /w/${slug}`;
}

async function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else resolve({ ok: false, error: `Upload failed (HTTP ${xhr.status})` });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error during upload" });
    xhr.send(file);
  });
}

export async function uploadModelToWorkspace(
  workspaceId: string,
  name: string,
  iconFile: File,
  glbFile: File,
  onProgress?: (pct: number, phase: string) => void,
  usdzFile?: File | null
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const uploadUrl = apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/models/upload`);
  onProgress?.(12, "Requesting upload URLs…");
  const presignRes = await fetch(uploadUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "presign",
      name,
      iconFilename: iconFile.name,
      includeUsdz: Boolean(usdzFile?.size),
      iconBytes: iconFile.size,
      glbBytes: glbFile.size,
      usdzBytes: usdzFile?.size ? usdzFile.size : 0,
    }),
  });
  const presignText = await presignRes.text();
  if (!presignRes.ok) {
    let message = presignText.slice(0, 200) || `HTTP ${presignRes.status}`;
    try {
      const errJson = JSON.parse(presignText) as { error?: string };
      if (errJson.error) message = errJson.error;
    } catch {
      /* use raw */
    }
    return { ok: false, error: message };
  }
  let session: PresignResponse;
  try {
    session = JSON.parse(presignText) as PresignResponse;
  } catch {
    return { ok: false, error: "Invalid presign response" };
  }

  const parts: { label: string; file: File; slot: PresignUpload }[] = [
    { label: "icon", file: iconFile, slot: session.uploads.icon },
    { label: "GLB", file: glbFile, slot: session.uploads.glb },
  ];
  if (usdzFile?.size && session.uploads.usdz) {
    parts.push({ label: "USDZ", file: usdzFile, slot: session.uploads.usdz });
  }

  let done = 0;
  for (const part of parts) {
    onProgress?.(15 + (done / parts.length) * 75, `Uploading ${part.label}…`);
    const result = await putFileWithProgress(part.slot.url, part.file, part.slot.contentType, (pct) => {
      onProgress?.(15 + ((done + pct / 100) / parts.length) * 75, `Uploading ${part.label}… ${pct}%`);
    });
    if (!result.ok) return { ok: false, error: result.error };
    done += 1;
  }

  onProgress?.(95, "Saving manifest…");
  const completeRes = await fetch(uploadUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      action: "complete",
      id: session.id,
      name,
      icon: session.uploads.icon.filename,
      glb: session.uploads.glb.filename,
      ...(session.uploads.usdz ? { usdz: session.uploads.usdz.filename } : {}),
    }),
  });
  if (!completeRes.ok) {
    return { ok: false, error: await completeRes.text() };
  }
  onProgress?.(100, "Complete");
  return { ok: true, id: session.id };
}

export async function deleteWorkspaceModel(workspaceId: string, modelId: string): Promise<boolean> {
  const res = await fetch(
    apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/models/${encodeURIComponent(modelId)}`),
    { method: "DELETE", headers: authHeaders() }
  );
  return res.ok;
}

export async function updateWorkspaceModelSettings(
  workspaceId: string,
  modelId: string,
  settings: { arExitUrl?: string | null }
): Promise<CatalogModel> {
  const res = await fetch(
    apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/models/${encodeURIComponent(modelId)}`),
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(settings),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { model?: CatalogModel };
  if (!data.model) throw new Error("Invalid response");
  return data.model;
}
