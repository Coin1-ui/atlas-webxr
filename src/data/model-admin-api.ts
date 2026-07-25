import type { CatalogModel } from "./model-catalog";
import { isDemoCatalogModel } from "./model-catalog";
import {
  canUploadDemoLocal,
  canUploadDemoRemote,
  demoDualUploadAvailable,
  modelApiUrl,
  uploadBlockedReason,
  useRemoteModelApi,
} from "../config/api";

export type DemoModelStorage = "local" | "remote";

export type AdminCatalogModel = CatalogModel & { demoStorage: DemoModelStorage };

export type UploadProgressHandler = (percent: number, phase: string) => void;

/** API Gateway HTTP API max request body (~10 MB). Larger uploads use presigned S3 PUT. */
export const API_GATEWAY_UPLOAD_MAX_BYTES = 9 * 1024 * 1024;

/** Where legacy single-shot uploads POST — local dev only. */
export function modelUploadUrl(target?: DemoModelStorage): string {
  if (target === "local" || (!target && !useRemoteModelApi())) {
    return "/api/custom-models/upload";
  }
  return modelApiUrl("/models/upload");
}

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

function formatUploadError(status: number, responseText: string): string {
  const trimmed = responseText.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return (
      `Upload hit the website home page (HTML), not the API (HTTP ${status}). ` +
      `In Amplify set VITE_ATLAS_API_URL to your API Gateway URL (no trailing slash), redeploy, ` +
      `then confirm Manage models shows "Connected to AWS API".`
    );
  }
  if (status === 404) {
    return `Upload API route not found (404). Redeploy Lambda v0.1.121+ with presign support on POST /models/upload.`;
  }
  if (status === 413) {
    return (
      "Upload too large for API Gateway (max ~10 MB per request). " +
      "Redeploy the latest Lambda and frontend — large files upload directly to S3."
    );
  }
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as { error?: string; message?: string };
      return j.error || j.message || trimmed.slice(0, 200);
    } catch {
      /* fall through */
    }
  }
  return trimmed.slice(0, 240) || `HTTP ${status}`;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const UPLOAD_PROGRESS = {
  PRESIGN: 12,
  FILES_START: 15,
  FILES_END: 90,
  MANIFEST: 95,
  DONE: 100,
} as const;

function clampProgress(pct: number): number {
  return Math.min(UPLOAD_PROGRESS.DONE, Math.max(0, Math.round(pct)));
}

function reportProgress(
  onProgress: UploadProgressHandler | undefined,
  pct: number,
  phase: string
): void {
  onProgress?.(clampProgress(pct), phase);
}

function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; status: number; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, status: xhr.status });
        return;
      }
      resolve({
        ok: false,
        status: xhr.status,
        error:
          xhr.status === 403
            ? "S3 rejected upload (403). Add Amplify origin to S3 bucket CORS (see backend/README-AWS.md)."
            : `S3 upload failed (HTTP ${xhr.status})`,
      });
    };
    xhr.onerror = () =>
      resolve({
        ok: false,
        status: 0,
        error:
          "S3 upload blocked (network/CORS). Add your Amplify URL to the S3 bucket CORS policy.",
      });
    xhr.send(file);
  });
}

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress?: UploadProgressHandler
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      onProgress(pct, "Uploading files…");
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        data = {
          error: formatUploadError(xhr.status, xhr.responseText || xhr.statusText),
        };
      }
      if (!xhr.responseText && xhr.status >= 400) {
        data.error = formatUploadError(xhr.status, xhr.statusText);
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: { error: "Network error" } });
    xhr.send(formData);
  });
}

async function uploadViaPresignedS3(
  name: string,
  iconFile: File,
  glbFile: File,
  usdzFile: File | null | undefined,
  onProgress?: UploadProgressHandler
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const uploadUrl = modelApiUrl("/models/upload");
  reportProgress(onProgress, UPLOAD_PROGRESS.PRESIGN, "Requesting direct S3 upload URLs…");
  let presignRes: Response;
  try {
    presignRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error:
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Could not reach upload API (network/CORS). Redeploy Lambda v0.1.121+ and check API Gateway CORS."
          : msg,
    };
  }
  const presignText = await presignRes.text();
  if (!presignRes.ok) {
    const err = formatUploadError(presignRes.status, presignText);
    if (err.includes("Legacy models API retired")) {
      return {
        ok: false,
        error:
          "The legacy /models/upload API is retired. Use Owner → Live demo models (workspace upload) or Admin → Manage models.",
      };
    }
    return { ok: false, error: err };
  }
  let session: PresignResponse;
  try {
    session = JSON.parse(presignText) as PresignResponse;
  } catch {
    return { ok: false, error: "Invalid presign response from API" };
  }

  const parts: { label: string; file: File; slot: PresignUpload; weight: number }[] = [
    { label: "icon", file: iconFile, slot: session.uploads.icon, weight: 0.08 },
    { label: "GLB", file: glbFile, slot: session.uploads.glb, weight: 0.72 },
  ];
  if (usdzFile?.size && session.uploads.usdz) {
    parts.push({
      label: "USDZ",
      file: usdzFile,
      slot: session.uploads.usdz,
      weight: 0.15,
    });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
  const fileSpan = UPLOAD_PROGRESS.FILES_END - UPLOAD_PROGRESS.FILES_START;

  let doneWeight = 0;
  for (const part of parts) {
    const weight = part.weight / totalWeight;
    reportProgress(
      onProgress,
      UPLOAD_PROGRESS.FILES_START + doneWeight * fileSpan,
      `Uploading ${part.label} (${formatBytes(part.file.size)}) to S3…`
    );
    const result = await putFileWithProgress(
      part.slot.url,
      part.file,
      part.slot.contentType,
      (pct) => {
        const fraction = doneWeight + (weight * pct) / 100;
        reportProgress(
          onProgress,
          UPLOAD_PROGRESS.FILES_START + fraction * fileSpan,
          `Uploading ${part.label}… ${pct}%`
        );
      }
    );
    if (!result.ok) {
      return { ok: false, error: result.error ?? `Failed uploading ${part.label}` };
    }
    doneWeight += weight;
  }

  reportProgress(onProgress, UPLOAD_PROGRESS.MANIFEST, "Saving manifest…");
  let completeRes: Response;
  try {
    completeRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        id: session.id,
        name,
        icon: session.uploads.icon.filename,
        glb: session.uploads.glb.filename,
        ...(session.uploads.usdz ? { usdz: session.uploads.usdz.filename } : {}),
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
  const completeText = await completeRes.text();
  if (!completeRes.ok) {
    return {
      ok: false,
      error: formatUploadError(completeRes.status, completeText),
    };
  }
  reportProgress(onProgress, UPLOAD_PROGRESS.DONE, "Complete");
  return { ok: true, id: session.id };
}

async function uploadViaMultipartProxy(
  name: string,
  iconFile: File,
  glbFile: File,
  usdzFile: File | null | undefined,
  onProgress?: UploadProgressHandler
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("icon", iconFile);
  fd.append("glb", glbFile);
  if (usdzFile?.size) fd.append("usdz", usdzFile);

  const url = modelUploadUrl();
  reportProgress(onProgress, UPLOAD_PROGRESS.FILES_START, `Uploading to ${url}…`);

  const fileSpan = UPLOAD_PROGRESS.FILES_END - UPLOAD_PROGRESS.FILES_START;
  const result = await uploadWithProgress(url, fd, (pct, phase) => {
    reportProgress(onProgress, UPLOAD_PROGRESS.FILES_START + (pct / 100) * fileSpan, phase);
  });
  if (!result.ok) {
    const err = result.data.error ?? result.status;
    return {
      ok: false,
      error: typeof err === "string" ? err : String(result.status),
    };
  }
  reportProgress(onProgress, UPLOAD_PROGRESS.DONE, "Complete");
  return { ok: true, id: result.data.id as string | undefined };
}

export async function uploadModelToServer(
  name: string,
  iconFile: File,
  glbFile: File,
  onProgress?: UploadProgressHandler,
  usdzFile?: File | null,
  opts?: { target?: DemoModelStorage }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const blocked = uploadBlockedReason();
  if (blocked) return { ok: false, error: blocked };

  const target: DemoModelStorage =
    opts?.target ?? (canUploadDemoRemote() ? "remote" : "local");

  const totalBytes = iconFile.size + glbFile.size + (usdzFile?.size ?? 0);
  onProgress?.(0, "Preparing upload…");

  if (target === "remote") {
    if (!canUploadDemoRemote()) {
      return { ok: false, error: "AWS upload requires VITE_ATLAS_API_URL." };
    }
    return uploadViaPresignedS3(name, iconFile, glbFile, usdzFile, onProgress);
  }

  if (!canUploadDemoLocal()) {
    return { ok: false, error: "Local repo upload is only available in local dev." };
  }

  if (totalBytes > API_GATEWAY_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `Total upload ${formatBytes(totalBytes)} exceeds ~9 MB local limit. Upload to AWS S3 instead.`,
    };
  }

  return uploadViaMultipartProxy(name, iconFile, glbFile, usdzFile, onProgress);
}

export async function deleteModelOnServer(id: string, storage?: DemoModelStorage): Promise<boolean> {
  const target: DemoModelStorage =
    storage ?? (useRemoteModelApi() ? "remote" : "local");
  const url =
    target === "remote"
      ? modelApiUrl(`/models/${encodeURIComponent(id)}`)
      : `/api/custom-models/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE" });
  return res.ok;
}

export async function fetchAdminManifestMerged(opts?: {
  bustCache?: boolean;
}): Promise<AdminCatalogModel[]> {
  const merged: AdminCatalogModel[] = [];
  const seen = new Set<string>();
  const bust = opts?.bustCache ? `?t=${Date.now()}` : "";

  if (canUploadDemoRemote()) {
    try {
      const res = await fetch(modelApiUrl(`/models/manifest${bust}`), { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { models: CatalogModel[] };
        for (const m of data.models ?? []) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          merged.push({ ...m, demoStorage: "remote" });
        }
      }
    } catch {
      /* remote optional when dual mode */
    }
  }

  if (canUploadDemoLocal()) {
    try {
      const res = await fetch("/api/custom-models/manifest");
      if (res.ok) {
        const data = (await res.json()) as { models: CatalogModel[] };
        for (const m of data.models ?? []) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          merged.push({ ...m, demoStorage: "local" });
        }
      }
    } catch {
      /* local optional */
    }
  }

  if (!merged.length && !canUploadDemoRemote() && !canUploadDemoLocal()) {
    throw new Error("No demo model API available.");
  }

  return merged.filter((m) => !isDemoCatalogModel(m));
}

export async function fetchAdminManifest(opts?: {
  bustCache?: boolean;
}): Promise<CatalogModel[]> {
  return fetchAdminManifestMerged(opts);
}

export function adminApiHint(): string {
  if (demoDualUploadAvailable()) {
    return "Dual upload: save to local repo (public/custom-models/) or AWS S3 — choose per upload.";
  }
  if (canUploadDemoRemote()) {
    return "Connected to remote API. Large files upload directly to object storage.";
  }
  return "Local dev API — uploads save to public/custom-models/. GLB→USDZ auto on PC upload; optional usd_from_gltf fallback via USD_FROM_GLTF_BIN.";
}
