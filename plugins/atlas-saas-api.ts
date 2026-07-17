import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { isValidSlug, slugFromName, toPublicConfig } from "../src/shared/tenant";
import { normalizeWorkspaceFeatures } from "../src/shared/workspace-features";
import { effectiveBillingTier, trialEndsAtIso, isTrialActive, isTrialSuspended, hasPurchasedTrialFallback } from "../src/shared/trial";
import { sessionLogDownloadDefaultForTier } from "../src/shared/workspace-feature-defaults";
import { limitsForWorkspace } from "../src/shared/plan-limits";
import {
  completeUploadSession,
  createUploadSession,
  deleteTenantModel,
  isMember,
  readRawBody,
  readTenantManifest,
  saveDevPut,
  sendAssetFile,
  updateTenantModelSettings,
  workspaceIdForSlug,
} from "./tenant-models-dev";

type WorkspaceRecord = {
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "pro" | "enterprise";
  billingTier?: "starter" | "launch" | "growth" | "scale";
  trialEndsAt?: string | null;
  trialPlan?: "starter" | "launch" | "growth" | "scale" | null;
  purchasedBillingTier?: "starter" | "launch" | "growth" | "scale" | null;
  logoUrl?: string;
  primaryColor: string;
  arExitUrl?: string | null;
  restricted?: boolean;
  restrictionReason?: string | null;
  restrictedAt?: string | null;
  featuresSessionLogDownload?: boolean;
  featuresSessionLogDownloadExplicit?: boolean;
  featuresStartAr?: boolean;
  featuresCameraCheck?: boolean;
  /** @deprecated legacy */
  featuresArControls?: boolean;
  createdAt: string;
  updatedAt: string;
};

type DevStore = {
  workspaces: Record<string, WorkspaceRecord>;
  slugs: Record<string, string>;
  members: Record<string, Record<string, { role: string; createdAt: string }>>;
};

function storePath(root: string): string {
  return path.join(root, ".atlas-dev", "workspaces.json");
}

function readStore(root: string): DevStore {
  const p = storePath(root);
  if (!fs.existsSync(p)) {
    return { workspaces: {}, slugs: {}, members: {} };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as DevStore;
}

function writeStore(root: string, store: DevStore): void {
  const dir = path.dirname(storePath(root));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(root), JSON.stringify(store, null, 2));
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function devSub(req: IncomingMessage): string | null {
  const auth = req.headers.authorization || "";
  const match = /^Bearer\s+dev:(.+)$/i.exec(auth);
  return match?.[1] ?? null;
}

function sessionLogDownloadForRec(rec: WorkspaceRecord): boolean {
  if (rec.featuresSessionLogDownloadExplicit) {
    return rec.featuresSessionLogDownload === true;
  }
  return sessionLogDownloadDefaultForTier(effectiveBillingTier(rec));
}

function workspaceFromRecord(rec: WorkspaceRecord) {
  return {
    id: rec.id,
    slug: rec.slug,
    name: rec.name,
    plan: rec.plan,
    billingTier: rec.billingTier,
    trialEndsAt: rec.trialEndsAt ?? null,
    trialPlan: rec.trialPlan ?? null,
    purchasedBillingTier: rec.purchasedBillingTier ?? null,
    branding: {
      logoUrl: rec.logoUrl,
      primaryColor: rec.primaryColor,
    },
    arExitUrl: rec.arExitUrl ?? null,
    restricted: Boolean(rec.restricted),
    restrictionReason: rec.restrictionReason ?? undefined,
    features: normalizeWorkspaceFeatures({
      sessionLogDownload: sessionLogDownloadForRec(rec),
      startAr: rec.featuresStartAr,
      cameraCheck: rec.featuresCameraCheck,
      arControls: rec.featuresArControls,
    }),
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

function resolveDevDemoWorkspaceSlug(store: DevStore): string | null {
  for (const rec of Object.values(store.workspaces)) {
    if (rec.id === "legacy" || rec.slug === "legacy") continue;
    if (isProtectedDevWorkspace(store, rec.id)) return rec.slug;
  }
  return null;
}

function platformOwnerEmails(): string[] {
  return (process.env.VITE_PLATFORM_OWNER_EMAILS || process.env.ATLAS_PLATFORM_OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isProtectedDevWorkspace(store: DevStore, wsId: string): boolean {
  for (const [sub, memberships] of Object.entries(store.members)) {
    if (memberships[wsId]?.role === "owner" && isDevPlatformOwner(sub)) return true;
  }
  return false;
}

function devOwnerEmailsForWorkspace(store: DevStore, wsId: string): string[] {
  const emails: string[] = [];
  for (const [sub, memberships] of Object.entries(store.members)) {
    if (memberships[wsId]?.role !== "owner") continue;
    const email = emailFromDevSubForDev(sub);
    if (email) emails.push(email);
  }
  return emails;
}

function emailFromDevSubForDev(sub: string): string | undefined {
  for (const email of platformOwnerEmails()) {
    const expected = `dev-${email.replace(/[^a-z0-9]/g, "-")}`;
    if (sub === expected) return email;
  }
  const generic = sub.replace(/^dev-/, "").replace(/-/g, ".");
  return generic.includes(".") ? generic : undefined;
}

function deleteDevWorkspace(root: string, store: DevStore, wsId: string): { ok: boolean; error?: string } {
  const rec = store.workspaces[wsId];
  if (!rec) return { ok: false, error: "Workspace not found" };
  if (isProtectedDevWorkspace(store, wsId)) {
    return { ok: false, error: "Platform operator accounts cannot be deleted" };
  }
  delete store.slugs[rec.slug];
  delete store.workspaces[wsId];
  for (const sub of Object.keys(store.members)) {
    delete store.members[sub][wsId];
  }
  const tenantDir = path.join(root, ".atlas-dev", "tenants", wsId);
  if (fs.existsSync(tenantDir)) fs.rmSync(tenantDir, { recursive: true, force: true });
  return { ok: true };
}

function isDevPlatformOwner(sub: string | null): boolean {
  if (!sub) return false;
  for (const email of platformOwnerEmails()) {
    const expectedSub = `dev-${email.replace(/[^a-z0-9]/g, "-")}`;
    if (sub === expectedSub) return true;
  }
  return false;
}

function couponsStorePath(root: string): string {
  return path.join(root, ".atlas-dev", "platform-coupons.json");
}

type DevCoupon = {
  code: string;
  label: string;
  offerType?: "fixed" | "percent";
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  showOnPricing?: boolean;
  bannerText?: string;
  maxUses?: number;
  usesCount?: number;
  promoPriceMonthly?: number;
  durationMonths?: number;
  createdAt: string;
};

function couponUsesRemainingDev(c: DevCoupon): number | undefined {
  if (c.maxUses == null || c.maxUses < 1) return undefined;
  return Math.max(0, c.maxUses - (c.usesCount ?? 0));
}

function couponIsActiveDev(c: DevCoupon, now = Date.now()): boolean {
  if (c.expiresAt) {
    const end = Date.parse(c.expiresAt);
    if (!Number.isNaN(end) && end < now) return false;
  }
  const remaining = couponUsesRemainingDev(c);
  return remaining === undefined || remaining > 0;
}

/** Active public promo = most recent active coupon flagged showOnPricing. */
function activePromoFromCoupons(coupons: DevCoupon[]): null | {
  code: string;
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  promoPriceMonthly?: number;
  durationMonths?: number;
  maxUses?: number;
  usesCount?: number;
  remainingUses?: number;
  text: string;
} {
  const promo = coupons.find((c) => c.showOnPricing && couponIsActiveDev(c));
  if (!promo) return null;
  const remaining = couponUsesRemainingDev(promo);
  return {
    code: promo.code,
    discountPercent: promo.discountPercent,
    targetTier: promo.targetTier,
    expiresAt: promo.expiresAt,
    promoPriceMonthly: promo.promoPriceMonthly,
    durationMonths: promo.durationMonths,
    maxUses: promo.maxUses,
    usesCount: promo.usesCount ?? 0,
    remainingUses: remaining,
    text: (promo.bannerText || promo.label).trim(),
  };
}

function readCouponsStore(root: string): DevCoupon[] {
  const p = couponsStorePath(root);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8")) as DevCoupon[];
}

function writeCouponsStore(root: string, coupons: DevCoupon[]): void {
  const dir = path.dirname(couponsStorePath(root));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(couponsStorePath(root), JSON.stringify(coupons, null, 2));
}

type DevPlatformSettings = { salesDeckActive: boolean; mkt3StoryboardActive: boolean };

function platformSettingsPath(root: string): string {
  return path.join(root, ".atlas-dev", "platform-settings.json");
}

function salesDeckPublicConfigPath(root: string): string {
  return path.join(root, "public", "sales-deck", "config.json");
}

function mkt3StoryboardPublicConfigPath(root: string): string {
  return path.join(root, "public", "mkt-3-storyboard", "config.json");
}

function readPlatformSettings(root: string): DevPlatformSettings {
  const p = platformSettingsPath(root);
  if (!fs.existsSync(p)) return { salesDeckActive: true, mkt3StoryboardActive: true };
  const json = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<DevPlatformSettings>;
  return {
    salesDeckActive: json.salesDeckActive !== false,
    mkt3StoryboardActive: json.mkt3StoryboardActive !== false,
  };
}

function writePublicPlatformConfigs(root: string, settings: DevPlatformSettings): void {
  const salesDeckConfig = salesDeckPublicConfigPath(root);
  fs.mkdirSync(path.dirname(salesDeckConfig), { recursive: true });
  let salesExisting: { apiUrl?: string } = {};
  if (fs.existsSync(salesDeckConfig)) {
    try {
      salesExisting = JSON.parse(fs.readFileSync(salesDeckConfig, "utf8")) as typeof salesExisting;
    } catch {
      /* ignore */
    }
  }
  fs.writeFileSync(
    salesDeckConfig,
    `${JSON.stringify({ active: settings.salesDeckActive, apiUrl: salesExisting.apiUrl || "" }, null, 2)}\n`,
  );

  const storyboardConfig = mkt3StoryboardPublicConfigPath(root);
  fs.mkdirSync(path.dirname(storyboardConfig), { recursive: true });
  let storyExisting: { apiUrl?: string } = {};
  if (fs.existsSync(storyboardConfig)) {
    try {
      storyExisting = JSON.parse(fs.readFileSync(storyboardConfig, "utf8")) as typeof storyExisting;
    } catch {
      /* ignore */
    }
  }
  fs.writeFileSync(
    storyboardConfig,
    `${JSON.stringify({ active: settings.mkt3StoryboardActive, apiUrl: storyExisting.apiUrl || "" }, null, 2)}\n`,
  );
}

function writePlatformSettings(root: string, settings: DevPlatformSettings): void {
  const p = platformSettingsPath(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2));
  writePublicPlatformConfigs(root, settings);
}

function toPublicConfigFromRecord(rec: WorkspaceRecord) {
  return toPublicConfig(workspaceFromRecord(rec));
}

type DevUsageStore = {
  months: Record<string, Record<string, { modelCount: number; sessionCount: number; storageBytes: number }>>;
  sessions: Record<string, boolean>;
};

function usageStorePath(root: string): string {
  return path.join(root, ".atlas-dev", "usage.json");
}

function readUsageStore(root: string): DevUsageStore {
  const p = usageStorePath(root);
  if (!fs.existsSync(p)) {
    return { months: {}, sessions: {} };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as DevUsageStore;
}

function writeUsageStore(root: string, data: DevUsageStore): void {
  const dir = path.dirname(usageStorePath(root));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(usageStorePath(root), JSON.stringify(data, null, 2));
}

function monthKeyUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function devStorageBytes(root: string, workspaceId: string): number {
  const dir = path.join(root, ".atlas-dev", "tenants", workspaceId);
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  };
  walk(dir);
  return total;
}

function devUsageForWorkspace(root: string, workspaceId: string, rec: WorkspaceRecord) {
  const usageStore = readUsageStore(root);
  const month = monthKeyUtc();
  const row = usageStore.months[workspaceId]?.[month] ?? {
    modelCount: 0,
    sessionCount: 0,
    storageBytes: 0,
  };
  const manifest = readTenantManifest(root, workspaceId);
  const modelCount = Array.isArray(manifest.models) ? manifest.models.length : row.modelCount;
  const storageBytes = devStorageBytes(root, workspaceId);
  const billingTier = effectiveBillingTier(rec);
  const limits = limitsForWorkspace(rec);
  const usage = { month, modelCount, sessionCount: row.sessionCount, storageBytes };
  const tierLabel = billingTier.charAt(0).toUpperCase() + billingTier.slice(1);
  const warnings: { metric: string; level: "warn" | "critical"; percent: number; message: string }[] = [];
  if (!isTrialSuspended(rec) && limits.models > 0) {
  for (const check of [
    { metric: "models", used: modelCount, limit: limits.models, label: "models" },
    { metric: "sessions", used: row.sessionCount, limit: limits.sessionsPerMonth, label: "AR sessions this month" },
    { metric: "storage", used: storageBytes, limit: limits.storageBytes, label: "storage" },
  ]) {
    const percent = Math.round((check.used / check.limit) * 100);
    if (percent >= 100) {
      warnings.push({ metric: check.metric, level: "critical", percent, message: `${check.label} at ${percent}% of your ${tierLabel} plan limit.` });
    } else if (percent >= 80) {
      warnings.push({ metric: check.metric, level: "warn", percent, message: `${check.label} at ${percent}% of your ${tierLabel} plan limit.` });
    }
  }
  }
  return {
    plan: rec.plan,
    billingTier,
    trialActive: isTrialActive(rec),
    trialSuspended: isTrialSuspended(rec),
    purchasedBillingTier: rec.purchasedBillingTier ?? null,
    trialPlan: rec.trialPlan ?? null,
    trialEndsAt: rec.trialEndsAt ?? null,
    hasPurchasedTrialFallback: hasPurchasedTrialFallback(rec),
    limits,
    usage,
    warnings,
  };
}

/** Local dev API for Atlas AR SaaS v2 when VITE_ATLAS_API_URL is not set. */
export function atlasSaasApiPlugin(): Plugin {
  return {
    name: "atlas-saas-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/v2/") && req.url !== "/health") return next();
        const root = server.config.root;
        const url = new URL(req.url, "http://localhost");
        const pathname = url.pathname;

        if (req.method === "OPTIONS") {
          sendJson(res, 204, "");
          return;
        }

        if (pathname === "/health" && req.method === "GET") {
          sendJson(res, 200, { ok: true, service: "atlas-api-dev", version: 2 });
          return;
        }

        const store = readStore(root);

        const publicMatch = /^\/v2\/workspaces\/([^/]+)\/public-config$/.exec(pathname);
        if (publicMatch && req.method === "GET") {
          const slug = decodeURIComponent(publicMatch[1]).toLowerCase();
          const id = store.slugs[slug];
          const rec = id ? store.workspaces[id] : undefined;
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          if (isTrialSuspended(rec)) {
            sendJson(res, 403, { error: "Showroom paused — subscription required", suspended: true });
            return;
          }
          sendJson(res, 200, toPublicConfigFromRecord(rec));
          return;
        }

        if (pathname === "/v2/me/workspaces" && req.method === "GET") {
          const sub = devSub(req);
          if (!sub) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          const memberMap = store.members[sub] ?? {};
          const workspaces = Object.keys(memberMap)
            .map((id) => store.workspaces[id])
            .filter(Boolean)
            .map((rec) => workspaceFromRecord(rec!));
          sendJson(res, 200, { workspaces });
          return;
        }

        if (pathname === "/v2/me/account" && req.method === "DELETE") {
          const sub = devSub(req);
          if (!sub) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          const memberMap = store.members[sub] ?? {};
          for (const wsId of Object.keys(memberMap)) {
            const rec = store.workspaces[wsId];
            if (!rec) {
              delete memberMap[wsId];
              continue;
            }
            if (rec.id === "legacy") {
              delete memberMap[wsId];
              continue;
            }
            if (memberMap[wsId]?.role === "owner") {
              delete store.slugs[rec.slug];
              delete store.workspaces[wsId];
              const tenantDir = path.join(root, ".atlas-dev", "tenants", wsId);
              if (fs.existsSync(tenantDir)) {
                fs.rmSync(tenantDir, { recursive: true, force: true });
              }
            }
            delete memberMap[wsId];
          }
          delete store.members[sub];
          writeStore(root, store);
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === "/v2/workspaces" && req.method === "POST") {
          const sub = devSub(req);
          if (!sub) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          let body: { name?: string; slug?: string; trialPlan?: string };
          try {
            body = JSON.parse(await readBody(req)) as { name?: string; slug?: string; trialPlan?: string };
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const name = (body.name ?? "").trim();
          if (!name) {
            sendJson(res, 400, { error: "Workspace name is required" });
            return;
          }
          const slug = slugFromName(name, body.slug || name);
          if (!isValidSlug(slug)) {
            sendJson(res, 400, { error: "Invalid workspace slug" });
            return;
          }
          if (store.slugs[slug]) {
            sendJson(res, 409, { error: "Workspace slug already taken" });
            return;
          }
          const id = randomUUID();
          const now = new Date().toISOString();
          const trialPlan: WorkspaceRecord["trialPlan"] = body.trialPlan === "launch" ? "launch" : "growth";
          const rec: WorkspaceRecord = {
            id,
            slug,
            name: name.slice(0, 80),
            plan: "starter",
            billingTier: trialPlan === "launch" ? "launch" : "starter",
            trialPlan,
            trialEndsAt: trialEndsAtIso(14),
            primaryColor: "#1565c0",
            featuresStartAr: true,
            featuresCameraCheck: false,
            featuresArControls: true,
            createdAt: now,
            updatedAt: now,
          };
          store.workspaces[id] = rec;
          store.slugs[slug] = id;
          store.members[sub] = store.members[sub] ?? {};
          store.members[sub][id] = { role: "owner", createdAt: now };
          writeStore(root, store);
          sendJson(res, 201, { workspace: workspaceFromRecord(rec) });
          return;
        }

        const settingsMatch = /^\/v2\/workspaces\/([^/]+)\/settings$/.exec(pathname);
        if (settingsMatch && req.method === "PATCH") {
          const wsId = decodeURIComponent(settingsMatch[1]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          const rec = store.workspaces[wsId];
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          let body: { name?: string; logoUrl?: string | null; primaryColor?: string; arExitUrl?: string | null };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          if (typeof body.name === "string" && body.name.trim()) {
            rec.name = body.name.trim().slice(0, 80);
          }
          if (body.logoUrl === null || body.logoUrl === "") {
            delete rec.logoUrl;
          } else if (typeof body.logoUrl === "string" && body.logoUrl.trim()) {
            rec.logoUrl = body.logoUrl.trim();
          }
          if (typeof body.primaryColor === "string" && body.primaryColor.trim()) {
            rec.primaryColor = body.primaryColor.trim();
          }
          if (body.arExitUrl !== undefined) {
            if (body.arExitUrl === null || body.arExitUrl === "") {
              delete rec.arExitUrl;
            } else if (typeof body.arExitUrl === "string") {
              rec.arExitUrl = body.arExitUrl.trim();
            }
          }
          rec.updatedAt = new Date().toISOString();
          store.workspaces[wsId] = rec;
          writeStore(root, store);
          sendJson(res, 200, { workspace: workspaceFromRecord(rec) });
          return;
        }

        const logoMatch = /^\/v2\/workspaces\/([^/]+)\/logo$/.exec(pathname);
        if (logoMatch && req.method === "GET") {
          const slug = decodeURIComponent(logoMatch[1]).toLowerCase();
          const wsId = workspaceIdForSlug(store, slug);
          const rec = wsId ? store.workspaces[wsId] : undefined;
          if (!rec?.logoUrl) {
            sendJson(res, 404, { error: "Logo not configured" });
            return;
          }
          try {
            const imgRes = await fetch(rec.logoUrl);
            if (!imgRes.ok) {
              sendJson(res, 404, { error: "Logo not found" });
              return;
            }
            const buf = Buffer.from(await imgRes.arrayBuffer());
            res.statusCode = 200;
            res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=3600");
            res.end(buf);
          } catch {
            sendJson(res, 404, { error: "Logo not found" });
          }
          return;
        }

        const catalogMatch = /^\/v2\/workspaces\/([^/]+)\/catalog$/.exec(pathname);
        if (catalogMatch && req.method === "GET") {
          const slug = decodeURIComponent(catalogMatch[1]).toLowerCase();
          const wsId = store.slugs[slug];
          const rec = wsId ? store.workspaces[wsId] : undefined;
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          if (isTrialSuspended(rec)) {
            sendJson(res, 403, { error: "Showroom paused — subscription required", suspended: true });
            return;
          }
          sendJson(res, 200, readTenantManifest(root, wsId));
          return;
        }

        const assetMatch = /^\/v2\/workspaces\/([^/]+)\/catalog\/assets\/(.+)$/.exec(pathname);
        if (assetMatch && req.method === "GET") {
          const slug = decodeURIComponent(assetMatch[1]).toLowerCase();
          const wsId = workspaceIdForSlug(store, slug);
          if (!wsId || !sendAssetFile(root, wsId, decodeURIComponent(assetMatch[2]), res)) {
            sendJson(res, 404, { error: "Asset not found" });
          }
          return;
        }

        const adminManifestMatch = /^\/v2\/workspaces\/([^/]+)\/models\/manifest$/.exec(pathname);
        if (adminManifestMatch && req.method === "GET") {
          const wsId = decodeURIComponent(adminManifestMatch[1]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          sendJson(res, 200, readTenantManifest(root, wsId));
          return;
        }

        const uploadMatch = /^\/v2\/workspaces\/([^/]+)\/models\/upload$/.exec(pathname);
        if (uploadMatch && req.method === "POST") {
          const wsId = decodeURIComponent(uploadMatch[1]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          let body: Record<string, unknown>;
          try {
            body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const rec = store.workspaces[wsId];
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          const manifest = readTenantManifest(root, wsId);
          const modelCount = Array.isArray(manifest.models) ? manifest.models.length : 0;
          const limits = limitsForWorkspace(rec);
          if (body.action === "presign" || body.action === "complete") {
            const modelId = String(body.id ?? body.name ?? "");
            const isNew =
              modelId &&
              !(manifest.models ?? []).some((m: { id?: string }) => m.id === modelId);
            if (body.action === "presign" && isNew && modelCount >= limits.models) {
              sendJson(res, 403, {
                error: `Model limit reached (${modelCount} / ${limits.models} on your plan). Upgrade on Account to add more models.`,
              });
              return;
            }
          }
          if (body.action === "presign") {
            sendJson(
              res,
              200,
              createUploadSession(root, wsId, String(body.name ?? "Untitled"), Boolean(body.includeUsdz))
            );
            return;
          }
          if (body.action === "complete") {
            const result = completeUploadSession(root, wsId, body as Parameters<typeof completeUploadSession>[2]);
            sendJson(res, result.ok ? 200 : 400, result);
            return;
          }
          sendJson(res, 400, { error: 'Use action "presign" or "complete"' });
          return;
        }

        const devPutMatch = /^\/v2\/workspaces\/([^/]+)\/models\/dev-put\/([^/]+)\/(icon|glb|usdz)$/.exec(
          pathname
        );
        if (devPutMatch && req.method === "PUT") {
          const sessionId = devPutMatch[2];
          const slot = devPutMatch[3];
          const buf = await readRawBody(req);
          const ok = await saveDevPut(root, sessionId, slot, buf);
          sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "Session not found" });
          return;
        }

        const deleteMatch = /^\/v2\/workspaces\/([^/]+)\/models\/([^/]+)$/.exec(pathname);
        if (deleteMatch && req.method === "DELETE") {
          const wsId = decodeURIComponent(deleteMatch[1]);
          const modelId = decodeURIComponent(deleteMatch[2]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          sendJson(res, deleteTenantModel(root, wsId, modelId) ? 200 : 404, { ok: true });
          return;
        }

        const patchModelMatch = /^\/v2\/workspaces\/([^/]+)\/models\/([^/]+)$/.exec(pathname);
        if (patchModelMatch && req.method === "PATCH") {
          const wsId = decodeURIComponent(patchModelMatch[1]);
          const modelId = decodeURIComponent(patchModelMatch[2]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          let body: { arExitUrl?: string | null };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const result = updateTenantModelSettings(root, wsId, modelId, body);
          if (!result.ok) {
            sendJson(res, 404, { error: result.error ?? "Update failed" });
            return;
          }
          sendJson(res, 200, { model: result.model });
          return;
        }

        const billingUpgradeMatch = /^\/v2\/workspaces\/([^/]+)\/billing\/upgrade$/.exec(pathname);
        if (billingUpgradeMatch && req.method === "POST") {
          if (process.env.ATLAS_ALLOW_STUB_BILLING === "false") {
            sendJson(res, 501, {
              error: "Billing upgrade stub disabled",
              hint: "Unset ATLAS_ALLOW_STUB_BILLING=false or set ATLAS_ALLOW_STUB_BILLING=true for local tier upgrades.",
            });
            return;
          }
          const wsId = decodeURIComponent(billingUpgradeMatch[1]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          const rec = store.workspaces[wsId];
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          let body: { targetTier?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const tier = (body.targetTier ?? "").trim().toLowerCase();
          const allowed = ["starter", "launch", "growth", "scale"];
          if (!allowed.includes(tier)) {
            sendJson(res, 400, { error: "Invalid targetTier" });
            return;
          }
          rec.billingTier = tier as WorkspaceRecord["billingTier"];
          rec.purchasedBillingTier = tier as WorkspaceRecord["purchasedBillingTier"];
          if (tier === "growth") rec.plan = "pro";
          else if (tier === "scale") rec.plan = "enterprise";
          else rec.plan = "starter";
          rec.updatedAt = new Date().toISOString();
          writeStore(root, store);
          sendJson(res, 200, { ok: true, workspace: workspaceFromRecord(rec) });
          return;
        }

        const usageMatch = /^\/v2\/workspaces\/([^/]+)\/usage$/.exec(pathname);
        if (usageMatch && req.method === "GET") {
          const wsId = decodeURIComponent(usageMatch[1]);
          const sub = devSub(req);
          if (!sub || !isMember(store, sub, wsId, ["owner", "admin"])) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
          }
          const rec = store.workspaces[wsId];
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          sendJson(res, 200, devUsageForWorkspace(root, wsId, rec));
          return;
        }

        const analyticsMatch = /^\/v2\/workspaces\/([^/]+)\/analytics\/events$/.exec(pathname);
        if (analyticsMatch && req.method === "POST") {
          const slug = decodeURIComponent(analyticsMatch[1]).toLowerCase();
          const wsId = workspaceIdForSlug(store, slug);
          if (!wsId) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          let body: { sessionId?: string; events?: { type?: string; placementCount?: number }[] };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const sessionId = body.sessionId?.trim() ?? "";
          const events = Array.isArray(body.events) ? body.events : [];
          let placementCount = 0;
          let sessionEnd = false;
          for (const ev of events) {
            if (ev?.type === "placement") placementCount += 1;
            if (ev?.type === "session_end") {
              sessionEnd = true;
              if (typeof ev.placementCount === "number") {
                placementCount = Math.max(placementCount, ev.placementCount);
              }
            }
          }
          let sessionCounted = false;
          if (sessionEnd && sessionId && placementCount >= 1 && !readUsageStore(root).sessions[sessionId]) {
            const usageStore = readUsageStore(root);
            const month = monthKeyUtc();
            usageStore.sessions[sessionId] = true;
            usageStore.months[wsId] = usageStore.months[wsId] ?? {};
            const row = usageStore.months[wsId][month] ?? {
              modelCount: 0,
              sessionCount: 0,
              storageBytes: 0,
            };
            row.sessionCount += 1;
            usageStore.months[wsId][month] = row;
            writeUsageStore(root, usageStore);
            sessionCounted = true;
          }
          sendJson(res, 202, { ok: true, accepted: events.length, sessionCounted });
          return;
        }

        if (pathname === "/v2/platform/workspaces" && req.method === "GET") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          const workspaces = Object.values(store.workspaces).map((rec) => ({
            ...workspaceFromRecord(rec),
            ownerEmails: devOwnerEmailsForWorkspace(store, rec.id),
            protectedFromDeletion: isProtectedDevWorkspace(store, rec.id),
          }));
          sendJson(res, 200, { workspaces });
          return;
        }

        const platformPatch = /^\/v2\/platform\/workspaces\/([^/]+)$/.exec(pathname);
        if (platformPatch && req.method === "DELETE") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          const wsId = decodeURIComponent(platformPatch[1]);
          const result = deleteDevWorkspace(root, store, wsId);
          if (!result.ok) {
            sendJson(res, result.error?.includes("cannot be deleted") ? 403 : 404, { error: result.error });
            return;
          }
          writeStore(root, store);
          sendJson(res, 200, { ok: true, workspaceId: wsId });
          return;
        }

        if (platformPatch && req.method === "PATCH") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          const wsId = decodeURIComponent(platformPatch[1]);
          const rec = store.workspaces[wsId];
          if (!rec) {
            sendJson(res, 404, { error: "Workspace not found" });
            return;
          }
          let body: {
            plan?: string;
            billingTier?: string;
            restricted?: boolean;
            restrictionReason?: string;
            features?: { sessionLogDownload?: boolean; startAr?: boolean; cameraCheck?: boolean };
          };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const now = new Date().toISOString();
          if (body.billingTier) {
            const tier = body.billingTier as WorkspaceRecord["billingTier"];
            rec.billingTier = tier;
            rec.purchasedBillingTier = tier;
            if (tier === "growth") rec.plan = "pro";
            else if (tier === "scale") rec.plan = "enterprise";
            else rec.plan = "starter";
            delete rec.trialEndsAt;
            delete rec.trialPlan;
          } else if (body.plan) {
            rec.plan = body.plan as WorkspaceRecord["plan"];
          }
          if (typeof body.restricted === "boolean") {
            rec.restricted = body.restricted;
            rec.restrictionReason = body.restricted ? body.restrictionReason?.trim() || "Policy violation" : null;
            rec.restrictedAt = body.restricted ? now : null;
          }
          if (body.features && typeof body.features === "object") {
            if (typeof body.features.sessionLogDownload === "boolean") {
              rec.featuresSessionLogDownload = body.features.sessionLogDownload;
              rec.featuresSessionLogDownloadExplicit = true;
            }
            if (typeof body.features.startAr === "boolean") {
              rec.featuresStartAr = body.features.startAr;
              if (body.features.startAr) rec.featuresArControls = true;
            }
            if (typeof body.features.cameraCheck === "boolean") {
              rec.featuresCameraCheck = body.features.cameraCheck;
              if (body.features.cameraCheck) rec.featuresArControls = true;
            }
          }
          rec.updatedAt = now;
          store.workspaces[wsId] = rec;
          writeStore(root, store);
          sendJson(res, 200, { workspace: workspaceFromRecord(rec) });
          return;
        }

        if (pathname === "/v2/platform/coupons" && req.method === "GET") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          sendJson(res, 200, { coupons: readCouponsStore(root) });
          return;
        }

        if (pathname === "/v2/platform/coupons" && req.method === "POST") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          let body: {
            offerType?: string;
            code?: string;
            label?: string;
            discountPercent?: number;
            targetTier?: string;
            expiresAt?: string;
            showOnPricing?: boolean;
            bannerText?: string;
            maxUses?: number;
            promoPriceMonthly?: number;
            durationMonths?: number;
          };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
          const label = typeof body.label === "string" ? body.label.trim() : "";
          const offerTypeRaw = typeof body.offerType === "string" ? body.offerType.trim().toLowerCase() : "";
          const discountPercent =
            body.discountPercent != null ? Number(body.discountPercent) : undefined;
          const promoPriceMonthly =
            body.promoPriceMonthly != null ? Number(body.promoPriceMonthly) : undefined;
          const durationMonths =
            body.durationMonths != null ? Number(body.durationMonths) : undefined;
          const maxUses = body.maxUses != null ? Number(body.maxUses) : undefined;
          const targetTier =
            typeof body.targetTier === "string" ? body.targetTier.trim().toLowerCase() || undefined : undefined;

          if (!code || !label) {
            sendJson(res, 400, { error: "code and label are required" });
            return;
          }
          const hasPercent =
            discountPercent != null && Number.isFinite(discountPercent) && discountPercent >= 1 && discountPercent <= 100;
          const hasPromoPrice =
            promoPriceMonthly != null && Number.isFinite(promoPriceMonthly) && promoPriceMonthly > 0;
          const offerType =
            offerTypeRaw === "percent" || offerTypeRaw === "fixed"
              ? offerTypeRaw
              : hasPromoPrice
                ? "fixed"
                : hasPercent
                  ? "percent"
                  : null;
          if (!offerType) {
            sendJson(res, 400, { error: "offerType must be fixed or percent" });
            return;
          }
          if (offerType === "fixed") {
            if (!hasPromoPrice) {
              sendJson(res, 400, { error: "promoPriceMonthly (USD/mo) is required for fixed promo offers" });
              return;
            }
            if (!targetTier) {
              sendJson(res, 400, { error: "targetTier is required for fixed promo offers" });
              return;
            }
            if (body.expiresAt) {
              sendJson(res, 400, { error: "Fixed promo offers do not use expiresAt — use maxUses instead" });
              return;
            }
          } else {
            if (!hasPercent) {
              sendJson(res, 400, { error: "discountPercent (1–100) is required for percent-off offers" });
              return;
            }
            if (hasPromoPrice || durationMonths != null) {
              sendJson(res, 400, {
                error: "Percent-off offers do not use promoPriceMonthly or durationMonths",
              });
              return;
            }
            if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1 || !Number.isInteger(maxUses))) {
              sendJson(res, 400, { error: "maxUses must be a positive whole number" });
              return;
            }
          }

          const existing = readCouponsStore(root).find((c) => c.code === code);
          const coupon: DevCoupon = {
            code,
            label,
            offerType,
            discountPercent: offerType === "percent" ? discountPercent : undefined,
            targetTier,
            expiresAt:
              offerType === "percent" && typeof body.expiresAt === "string"
                ? body.expiresAt.trim() || undefined
                : undefined,
            showOnPricing: body.showOnPricing === true,
            bannerText: typeof body.bannerText === "string" ? body.bannerText.trim() || undefined : undefined,
            maxUses:
              maxUses != null && Number.isFinite(maxUses) && maxUses > 0 ? maxUses : undefined,
            usesCount: existing?.usesCount ?? 0,
            promoPriceMonthly: offerType === "fixed" ? promoPriceMonthly : undefined,
            durationMonths:
              offerType === "fixed" &&
              durationMonths != null &&
              Number.isFinite(durationMonths) &&
              durationMonths > 0
                ? durationMonths
                : undefined,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          };
          const coupons = readCouponsStore(root).filter((c) => c.code !== code);
          coupons.unshift(coupon);
          writeCouponsStore(root, coupons);
          sendJson(res, 201, { coupon });
          return;
        }

        const couponDelete = /^\/v2\/platform\/coupons\/([^/]+)$/.exec(pathname);
        if (couponDelete && req.method === "DELETE") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          const code = decodeURIComponent(couponDelete[1]).toUpperCase();
          const coupons = readCouponsStore(root).filter((c) => c.code !== code);
          writeCouponsStore(root, coupons);
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === "/v2/platform/settings" && req.method === "GET") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          sendJson(res, 200, readPlatformSettings(root));
          return;
        }

        if (pathname === "/v2/platform/settings" && req.method === "PATCH") {
          const sub = devSub(req);
          if (!isDevPlatformOwner(sub)) {
            sendJson(res, 403, { error: "Forbidden — platform operator access required" });
            return;
          }
          let body: { salesDeckActive?: boolean; mkt3StoryboardActive?: boolean };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            sendJson(res, 400, { error: "JSON body required" });
            return;
          }
          const patch: Partial<DevPlatformSettings> = {};
          if (body.salesDeckActive !== undefined) {
            if (typeof body.salesDeckActive !== "boolean") {
              sendJson(res, 400, { error: "salesDeckActive must be boolean" });
              return;
            }
            patch.salesDeckActive = body.salesDeckActive;
          }
          if (body.mkt3StoryboardActive !== undefined) {
            if (typeof body.mkt3StoryboardActive !== "boolean") {
              sendJson(res, 400, { error: "mkt3StoryboardActive must be boolean" });
              return;
            }
            patch.mkt3StoryboardActive = body.mkt3StoryboardActive;
          }
          if (Object.keys(patch).length === 0) {
            sendJson(res, 400, { error: "At least one setting field required" });
            return;
          }
          const current = readPlatformSettings(root);
          const settings: DevPlatformSettings = {
            salesDeckActive: patch.salesDeckActive ?? current.salesDeckActive,
            mkt3StoryboardActive: patch.mkt3StoryboardActive ?? current.mkt3StoryboardActive,
          };
          writePlatformSettings(root, settings);
          sendJson(res, 200, settings);
          return;
        }

        if (pathname === "/v2/platform/public-settings" && req.method === "GET") {
          const settings = readPlatformSettings(root);
          const demoWorkspaceSlug = resolveDevDemoWorkspaceSlug(store);
          const demoWs = Object.values(store.workspaces).find((w) => w.slug === demoWorkspaceSlug);
          const demoSessionLogDownload = Boolean(demoWs?.featuresSessionLogDownload);
          sendJson(res, 200, {
            salesDeckActive: settings.salesDeckActive,
            mkt3StoryboardActive: settings.mkt3StoryboardActive,
            promo: activePromoFromCoupons(readCouponsStore(root)),
            ...(demoWorkspaceSlug ? { demoWorkspaceSlug } : {}),
            ...(demoSessionLogDownload ? { demoSessionLogDownload: true } : {}),
          });
          return;
        }

        sendJson(res, 404, { error: "Not found" });
      });
    },
  };
}
