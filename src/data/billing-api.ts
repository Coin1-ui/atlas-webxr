import { getApiBase } from "../config/api";
import { authBearerToken, loadSession } from "../auth/session";

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

const OVERAGE_PAID_KEY = "atlas-overage-paid";

export function overagePaidKey(workspaceId: string, month: string): string {
  return `${OVERAGE_PAID_KEY}:${workspaceId}:${month}`;
}

export function isOveragePaidLocally(workspaceId: string, month: string): boolean {
  return localStorage.getItem(overagePaidKey(workspaceId, month)) === "1";
}

export function markOveragePaidLocally(workspaceId: string, month: string): void {
  localStorage.setItem(overagePaidKey(workspaceId, month), "1");
}

/** Accept & pay usage overage — API when deployed, local ack in dev. */
export async function acceptOverageCharge(
  workspaceId: string,
  month: string,
  amountUsd: number
): Promise<{ ok: true; method: "api" | "local"; paymentPending?: boolean }> {
  const base = getApiBase();
  if (!base) {
    markOveragePaidLocally(workspaceId, month);
    return { ok: true, method: "local" };
  }

  const res = await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/billing/overage`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ month, amountUsd, accept: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const payload = (await res.json()) as {
    overagePaid?: boolean;
    paymentPending?: boolean;
    method?: string;
  };
  if (payload.overagePaid) {
    markOveragePaidLocally(workspaceId, month);
  }
  return {
    ok: true,
    method: "api",
    paymentPending: payload.paymentPending === true,
  };
}

/** Sandbox-only: seed session overage via Cognito (no local AWS keys). */
export async function seedSandboxUsage(
  workspaceId: string,
  body: { preset?: "overage"; sessions?: number; reset?: boolean; resetOverage?: boolean }
): Promise<{ ok: true; estimatedOverageUsd?: number; usage?: { sessionCount: number; month: string } }> {
  const base = getApiBase();
  if (!base) throw new Error("API base is not configured");
  const res = await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/sandbox/usage`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as {
    ok: true;
    estimatedOverageUsd?: number;
    usage?: { sessionCount: number; month: string };
  };
}

/** Request plan upgrade — records purchase when billing API is deployed. */
export async function requestPlanUpgrade(
  workspaceId: string,
  targetTier: string,
  couponCode?: string,
): Promise<{ method: "api" | "local" }> {
  const base = getApiBase();
  const body: { targetTier: string; couponCode?: string } = { targetTier };
  if (couponCode?.trim()) body.couponCode = couponCode.trim().toUpperCase();
  if (!base) {
    markPurchasedTierLocally(workspaceId, targetTier);
    return { method: "local" };
  }
  const res = await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/billing/upgrade`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return { method: "api" };
}

const PURCHASED_TIER_KEY = "atlas-purchased-tier";

export function purchasedTierKey(workspaceId: string): string {
  return `${PURCHASED_TIER_KEY}:${workspaceId}`;
}

export function markPurchasedTierLocally(workspaceId: string, tier: string): void {
  localStorage.setItem(purchasedTierKey(workspaceId), tier);
}

export function getPurchasedTierLocally(workspaceId: string): string | null {
  return localStorage.getItem(purchasedTierKey(workspaceId));
}
