import { getApiBase } from "../config/api";
import { authBearerToken, loadSession } from "../auth/session";
import type { WorkspacePlan } from "../shared/tenant";
import type { UsageWarning } from "../shared/plan-limits";

export type WorkspaceUsageResponse = {
  plan: WorkspacePlan;
  limits: {
    models: number;
    sessionsPerMonth: number;
    storageBytes: number;
  };
  effectiveLimits?: {
    models: number;
    sessionsPerMonth: number;
    storageBytes: number;
    overageExtended?: { sessions: boolean; models: boolean; storage: boolean };
  };
  usage: {
    month: string;
    modelCount: number;
    sessionCount: number;
    storageBytes: number;
  };
  warnings: UsageWarning[];
  estimatedOverageUsd?: number;
  overagePaid?: boolean;
  overageAccepted?: boolean;
  overageAmountUsd?: number | null;
  overageStatus?: string;
  overageBillable?: boolean;
  overageSandbox?: boolean;
  modelsRetained?: boolean;
  sandboxSeedEnabled?: boolean;
  sandboxSeededAt?: string | null;
  usageIsSandboxSeeded?: boolean;
  sandboxClearAvailable?: boolean;
};

function apiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path.startsWith("/") ? path : `/${path}`;
}

export async function fetchWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsageResponse | null> {
  const token = authBearerToken(loadSession());
  if (!token) return null;

  const res = await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(workspaceId)}/usage`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as WorkspaceUsageResponse;
}
