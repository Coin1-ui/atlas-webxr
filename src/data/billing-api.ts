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

export function isOveragePaidLocally(_workspaceId: string, _month: string): boolean {
  return false;
}

/** Record overage acceptance via API (ops fallback). Hybrid Dodo meters bill at cycle — not via /charge. */
export async function acceptOverageCharge(
  workspaceId: string,
  month: string,
  amountUsd: number
): Promise<{ ok: true; method: "api" }> {
  const base = getApiBase();
  if (!base) {
    throw new Error("Provider-backed overage billing is unavailable in local development");
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

  return { ok: true, method: "api" };
}
