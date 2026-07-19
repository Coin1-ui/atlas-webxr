import { getApiBase } from "../config/api";
import { authBearerToken, loadSession } from "../auth/session";
import { isPlatformOwnerEmail } from "../shared/platform-owner";
import type { PlanTierId } from "../shared/plan-display";
import { backendPlanFromBillingTier } from "../shared/plan-display";
import type { Workspace } from "../shared/tenant";
import type { WorkspaceFeatures } from "../shared/workspace-features";

export type PlatformSettings = {
  salesDeckActive: boolean;
  mkt3StoryboardActive: boolean;
};

function normalizePlatformSettings(json: Partial<PlatformSettings>): PlatformSettings {
  return {
    salesDeckActive: json.salesDeckActive !== false,
    mkt3StoryboardActive: json.mkt3StoryboardActive !== false,
  };
}

export type PlatformCoupon = {
  code: string;
  label: string;
  /** fixed = promo price; percent = discount off list price. */
  offerType?: "fixed" | "percent";
  /** Percent off — only for percent offers. */
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  /** Drives the public pricing-page promo banner. */
  showOnPricing?: boolean;
  /** Marketing line shown on the pricing banner (falls back to label). */
  bannerText?: string;
  /** Expire after this many redemptions (omit = unlimited). */
  maxUses?: number;
  /** Times redeemed. */
  usesCount?: number;
  /** Fixed promo price in USD/mo for targetTier (e.g. 59 = Growth at Launch price). */
  promoPriceMonthly?: number;
  /** Promo price duration in months (e.g. 12). */
  durationMonths?: number;
  createdAt: string;
};

/** Active promo surfaced on the public pricing page (no auth). */
export type PublicPromo = {
  code: string;
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  text: string;
  promoPriceMonthly?: number;
  durationMonths?: number;
  maxUses?: number;
  usesCount?: number;
  remainingUses?: number;
};

export type PlatformWorkspaceRow = Workspace & {
  restricted?: boolean;
  restrictionReason?: string;
  ownerEmails?: string[];
  /** Platform operator workspace — never deletable from owner dashboard. */
  protectedFromDeletion?: boolean;
};

export type PlatformWorkspacesResult = {
  workspaces: PlatformWorkspaceRow[];
  meta?: { ownerEmailLookup?: "cognito" | "disabled" };
};

function saasApiUrl(path: string): string {
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

async function platformFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.includes("Failed to fetch") || msg.includes("NetworkError")
        ? "Could not reach the platform API (network/CORS). Deploy atlas-api Lambda with /v2/platform routes, add those routes in API Gateway, set ATLAS_PLATFORM_OWNER_EMAILS on Lambda, and confirm API Gateway CORS allows your Amplify URL (no trailing slash)."
        : msg,
    );
  }
}

function parsePlatformError(status: number, text: string): string {
  if (status === 404 && text.includes('"message":"Not Found"')) {
    return "Platform API route not deployed. Redeploy atlas-api Lambda and add GET /v2/platform/workspaces (and related routes) in API Gateway.";
  }
  return text || `HTTP ${status}`;
}

/** Merge local development restriction overrides only. */
export function applyPlatformOverrides(workspace: Workspace): Workspace {
  if (workspace.restricted) return workspace;
  if (getApiBase()) return workspace;
  try {
    const raw = localStorage.getItem("atlas-platform-restrictions");
    if (!raw) return workspace;
    const list = JSON.parse(raw) as Array<{ workspaceId: string; reason: string }>;
    const hit = list.find((r) => r.workspaceId === workspace.id);
    if (!hit) return workspace;
    return { ...workspace, restricted: true, restrictionReason: hit.reason };
  } catch {
    return workspace;
  }
}

export function isWorkspaceRestricted(workspace: Workspace): boolean {
  return Boolean(workspace.restricted);
}

/** Client-side fallback when API omits protectedFromDeletion (older Lambda builds). */
export function enrichPlatformWorkspaces(
  rows: PlatformWorkspaceRow[],
  operatorEmail: string,
  operatorWorkspaceIds: string[],
): PlatformWorkspaceRow[] {
  const opEmail = operatorEmail.trim().toLowerCase();
  return rows.map((ws) => {
    const ownerEmails = (ws.ownerEmails ?? []).map((e) => e.toLowerCase());
    const protectedFromDeletion =
      ws.protectedFromDeletion === true ||
      ownerEmails.some((e) => isPlatformOwnerEmail(e)) ||
      (isPlatformOwnerEmail(opEmail) && operatorWorkspaceIds.includes(ws.id));
    return { ...ws, protectedFromDeletion };
  });
}

export async function fetchPlatformWorkspacesDetail(
  operatorEmail?: string,
  operatorWorkspaceIds?: string[],
): Promise<PlatformWorkspacesResult> {
  const res = await platformFetch(saasApiUrl("/v2/platform/workspaces"), { headers: authHeaders() });
  if (res.status === 403) {
    const text = await res.text();
    throw new Error(
      text.includes("Forbidden") || text.includes("forbidden")
        ? "Forbidden — your account is not in ATLAS_PLATFORM_OWNER_EMAILS on the atlas-api Lambda."
        : text || "Forbidden",
    );
  }
  if (res.status === 404) {
    const text = await res.text();
    if (text.includes('"message":"Not Found"')) {
      throw new Error(parsePlatformError(404, text));
    }
    return { workspaces: [] };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parsePlatformError(res.status, text));
  }
  const json = (await res.json()) as {
    workspaces?: PlatformWorkspaceRow[];
    meta?: { ownerEmailLookup?: "cognito" | "disabled" };
  };
  const rows = json.workspaces ?? [];
  const workspaces = operatorEmail
    ? enrichPlatformWorkspaces(rows, operatorEmail, operatorWorkspaceIds ?? [])
    : rows;
  return { workspaces, meta: json.meta };
}

export async function fetchPlatformWorkspaces(
  operatorEmail?: string,
  operatorWorkspaceIds?: string[],
): Promise<PlatformWorkspaceRow[]> {
  const { workspaces } = await fetchPlatformWorkspacesDetail(operatorEmail, operatorWorkspaceIds);
  return workspaces;
}

export async function platformSetWorkspacePlan(workspaceId: string, billingTier: PlanTierId): Promise<void> {
  const plan = backendPlanFromBillingTier(billingTier);
  const res = await platformFetch(saasApiUrl(`/v2/platform/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ plan, billingTier }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

export async function platformSetWorkspaceRestriction(
  workspaceId: string,
  restricted: boolean,
  reason = "",
): Promise<void> {
  const res = await platformFetch(saasApiUrl(`/v2/platform/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ restricted, restrictionReason: reason }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

export async function platformSetWorkspaceFeatures(
  workspaceId: string,
  features: Partial<WorkspaceFeatures>,
): Promise<void> {
  const res = await platformFetch(saasApiUrl(`/v2/platform/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ features }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

/** Permanently delete a customer workspace + login. Blocked for platform operator accounts. */
export async function platformDeleteCustomerAccount(workspaceId: string): Promise<void> {
  const res = await platformFetch(
    saasApiUrl(`/v2/platform/workspaces/${encodeURIComponent(workspaceId)}`),
    { method: "DELETE", headers: authHeaders() },
  );
  if (res.status === 403) {
    const text = await res.text();
    throw new Error(text.includes("cannot be deleted") ? "Platform operator accounts cannot be deleted" : text || "Forbidden");
  }
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

export async function platformRefundPayment(input: {
  provider: "dodo" | "zoho";
  paymentId: string;
  amountMinor: number;
  reason: string;
}): Promise<{ providerRefundId: string }> {
  const headers = new Headers(authHeaders());
  headers.set("Idempotency-Key", crypto.randomUUID());
  const res = await platformFetch(saasApiUrl("/v2/platform/billing/refunds"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: input.provider,
      paymentId: input.paymentId,
      amountMinor: input.amountMinor,
      reason: input.reason,
    }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  return (await res.json()) as { providerRefundId: string };
}

export async function fetchPlatformCoupons(): Promise<PlatformCoupon[]> {
  const res = await platformFetch(saasApiUrl("/v2/platform/coupons"), { headers: authHeaders() });
  if (res.status === 404) {
    const text = await res.text();
    if (text.includes('"message":"Not Found"')) {
      throw new Error(parsePlatformError(404, text));
    }
    return [];
  }
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  const json = (await res.json()) as { coupons?: PlatformCoupon[] };
  return json.coupons ?? [];
}

export async function createPlatformCoupon(input: {
  offerType?: "fixed" | "percent";
  code: string;
  label: string;
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  showOnPricing?: boolean;
  bannerText?: string;
  maxUses?: number;
  promoPriceMonthly?: number;
  durationMonths?: number;
}): Promise<void> {
  const res = await platformFetch(saasApiUrl("/v2/platform/coupons"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const res = await platformFetch(saasApiUrl("/v2/platform/settings"), { headers: authHeaders() });
  if (res.status === 404) {
    const text = await res.text();
    if (text.includes('"message":"Not Found"')) {
      throw new Error(parsePlatformError(404, text));
    }
    return normalizePlatformSettings({});
  }
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  const json = (await res.json()) as Partial<PlatformSettings>;
  return normalizePlatformSettings(json);
}

export async function platformSetSalesDeckActive(active: boolean): Promise<PlatformSettings> {
  const res = await platformFetch(saasApiUrl("/v2/platform/settings"), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ salesDeckActive: active }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  const json = (await res.json()) as Partial<PlatformSettings>;
  return normalizePlatformSettings(json);
}

export async function platformSetMkt3StoryboardActive(active: boolean): Promise<PlatformSettings> {
  const res = await platformFetch(saasApiUrl("/v2/platform/settings"), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ mkt3StoryboardActive: active }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  const json = (await res.json()) as Partial<PlatformSettings>;
  return normalizePlatformSettings(json);
}

/** Link Try live demo (/demo) to the operator workspace catalog. */
export async function platformSetDemoWorkspaceSlug(slug: string): Promise<void> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === "legacy") return;
  const res = await platformFetch(saasApiUrl("/v2/platform/settings"), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ demoWorkspaceSlug: normalized }),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}

/** No auth — used by sales deck static page. */
export async function fetchPublicPlatformSettings(apiUrl?: string): Promise<PlatformSettings> {
  const base = (apiUrl || getApiBase()).replace(/\/$/, "");
  const path = "/v2/platform/public-settings";
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
  const json = (await res.json()) as Partial<PlatformSettings>;
  return normalizePlatformSettings(json);
}

/**
 * No auth — active promo for the public pricing banner. Resilient: any failure
 * (offline, route not deployed, CORS) resolves to `null` so pricing never breaks.
 */
export async function fetchPublicPromo(apiUrl?: string): Promise<PublicPromo | null> {
  try {
    const base = (apiUrl || getApiBase()).replace(/\/$/, "");
    const url = base ? `${base}/v2/platform/public-settings` : "/v2/platform/public-settings";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { promo?: PublicPromo | null };
    const promo = json.promo;
    if (!promo || typeof promo.text !== "string" || !promo.text.trim()) return null;
    return promo;
  } catch {
    return null;
  }
}

export async function deletePlatformCoupon(code: string): Promise<void> {
  const res = await platformFetch(saasApiUrl(`/v2/platform/coupons/${encodeURIComponent(code)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(parsePlatformError(res.status, await res.text()));
}
