import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ServerResponse, IncomingMessage } from "node:http";

export type DevManifest = {
  version: number;
  models: Array<{
    id: string;
    name: string;
    icon?: string;
    glb?: string;
    usdz?: string;
    arExitUrl?: string | null;
  }>;
};

export type DevStore = {
  workspaces: Record<string, { id: string; slug: string; name: string; plan: string; primaryColor: string; createdAt: string; updatedAt: string; logoUrl?: string }>;
  slugs: Record<string, string>;
  members: Record<string, Record<string, { role: string; createdAt: string }>>;
};

function tenantDir(root: string, workspaceId: string): string {
  return path.join(root, ".atlas-dev", "tenants", workspaceId, "models");
}

function sessionDir(root: string): string {
  return path.join(root, ".atlas-dev", "upload-sessions");
}

export function workspaceIdForSlug(store: DevStore, slug: string): string | null {
  return store.slugs[slug.toLowerCase()] ?? null;
}

export function isMember(store: DevStore, sub: string, workspaceId: string, roles?: string[]): boolean {
  const m = store.members[sub]?.[workspaceId];
  if (!m) return false;
  if (roles && !roles.includes(m.role)) return false;
  return true;
}

export function readTenantManifest(root: string, workspaceId: string): DevManifest {
  const p = path.join(tenantDir(root, workspaceId), "manifest.json");
  if (!fs.existsSync(p)) return { version: 1, models: [] };
  return JSON.parse(fs.readFileSync(p, "utf8")) as DevManifest;
}

export function writeTenantManifest(root: string, workspaceId: string, data: DevManifest): void {
  const dir = tenantDir(root, workspaceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(data, null, 2));
}

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 48) || `model-${Date.now()}`;
}

export function createUploadSession(root: string, workspaceId: string, name: string, includeUsdz: boolean) {
  const id = safeId(name);
  const iconExt = ".png";
  const iconName = `${id}${iconExt}`;
  const glbName = `${id}.glb`;
  const sessionId = randomUUID();
  const dir = path.join(sessionDir(root), sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    workspaceId,
    id,
    name: name.trim(),
    iconName,
    glbName,
    usdzName: includeUsdz ? `${id}.usdz` : null,
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  const base = `/v2/workspaces/${encodeURIComponent(workspaceId)}/models/dev-put/${sessionId}`;
  return {
    id,
    name: meta.name,
    uploads: {
      icon: { url: `${base}/icon`, filename: iconName, contentType: "image/png" },
      glb: { url: `${base}/glb`, filename: glbName, contentType: "model/gltf-binary" },
      ...(meta.usdzName
        ? {
            usdz: {
              url: `${base}/usdz`,
              filename: meta.usdzName,
              contentType: "model/vnd.usdz+zip",
            },
          }
        : {}),
    },
  };
}

export async function saveDevPut(
  root: string,
  sessionId: string,
  slot: string,
  body: Buffer
): Promise<boolean> {
  const dir = path.join(sessionDir(root), sessionId);
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return false;
  const allowed = ["icon", "glb", "usdz"];
  if (!allowed.includes(slot)) return false;
  fs.writeFileSync(path.join(dir, `${slot}.bin`), body);
  return true;
}

export function completeUploadSession(root: string, workspaceId: string, body: {
  id?: string;
  name?: string;
  icon?: string;
  glb?: string;
  usdz?: string;
}): { ok: boolean; id?: string; error?: string } {
  const sessions = fs.existsSync(sessionDir(root)) ? fs.readdirSync(sessionDir(root)) : [];
  let sessionDirPath: string | null = null;
  let meta: {
    workspaceId: string;
    id: string;
    name: string;
    iconName: string;
    glbName: string;
    usdzName: string | null;
  } | null = null;

  for (const sid of sessions) {
    const p = path.join(sessionDir(root), sid, "meta.json");
    if (!fs.existsSync(p)) continue;
    const m = JSON.parse(fs.readFileSync(p, "utf8")) as typeof meta;
    if (m && m.workspaceId === workspaceId && m.id === body.id) {
      sessionDirPath = path.join(sessionDir(root), sid);
      meta = m;
      break;
    }
  }

  if (!sessionDirPath || !meta) {
    return { ok: false, error: "Upload session not found" };
  }

  const tenant = tenantDir(root, workspaceId);
  fs.mkdirSync(tenant, { recursive: true });

  for (const slot of ["icon", "glb", "usdz"] as const) {
    const src = path.join(sessionDirPath, `${slot}.bin`);
    if (!fs.existsSync(src)) {
      if (slot === "usdz") continue;
      return { ok: false, error: `Missing ${slot} upload` };
    }
    const destName =
      slot === "icon" ? meta.iconName : slot === "glb" ? meta.glbName : meta.usdzName;
    if (!destName) continue;
    fs.copyFileSync(src, path.join(tenant, destName));
  }

  const manifest = readTenantManifest(root, workspaceId);
  const existing = manifest.models.find((m) => m.id === meta!.id);
  manifest.models = manifest.models.filter((m) => m.id !== meta!.id);
  manifest.models.push({
    id: meta.id,
    name: body.name?.trim() || meta.name,
    icon: meta.iconName,
    glb: meta.glbName,
    ...(meta.usdzName && fs.existsSync(path.join(tenant, meta.usdzName))
      ? { usdz: meta.usdzName }
      : {}),
    ...(existing?.arExitUrl ? { arExitUrl: existing.arExitUrl } : {}),
  });
  writeTenantManifest(root, workspaceId, manifest);
  fs.rmSync(sessionDirPath, { recursive: true, force: true });
  return { ok: true, id: meta.id };
}

export function deleteTenantModel(root: string, workspaceId: string, modelId: string): boolean {
  if (modelId.startsWith("builtin-")) return false;
  const manifest = readTenantManifest(root, workspaceId);
  const entry = manifest.models.find((m) => m.id === modelId);
  if (!entry) return false;
  manifest.models = manifest.models.filter((m) => m.id !== modelId);
  writeTenantManifest(root, workspaceId, manifest);
  const dir = tenantDir(root, workspaceId);
  for (const f of [entry.icon, entry.glb, entry.usdz]) {
    if (f) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        /* ignore */
      }
    }
  }
  return true;
}

export function updateTenantModelSettings(
  root: string,
  workspaceId: string,
  modelId: string,
  settings: { arExitUrl?: string | null }
): { ok: boolean; model?: DevManifest["models"][number]; error?: string } {
  if (modelId.startsWith("builtin-")) return { ok: false, error: "invalid id" };
  const manifest = readTenantManifest(root, workspaceId);
  const idx = manifest.models.findIndex((m) => m.id === modelId);
  if (idx < 0) return { ok: false, error: "Model not found" };
  const entry = { ...manifest.models[idx]! };
  if (settings.arExitUrl !== undefined) {
    const v = settings.arExitUrl?.trim();
    if (!v) delete entry.arExitUrl;
    else entry.arExitUrl = v;
  }
  manifest.models[idx] = entry;
  writeTenantManifest(root, workspaceId, manifest);
  return { ok: true, model: entry };
}

export function sendAssetFile(root: string, workspaceId: string, filename: string, res: ServerResponse): boolean {
  const safe = filename.replace(/[/\\]/g, "");
  if (!safe || safe.includes("..")) return false;
  const filePath = path.join(tenantDir(root, workspaceId), safe);
  if (!fs.existsSync(filePath)) return false;
  const ext = safe.split(".").pop()?.toLowerCase();
  const ct =
    ext === "glb"
      ? "model/gltf-binary"
      : ext === "usdz"
        ? "model/vnd.usdz+zip"
        : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", ct);
  res.setHeader("Access-Control-Allow-Origin", "*");
  fs.createReadStream(filePath).pipe(res);
  return true;
}

export async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}
