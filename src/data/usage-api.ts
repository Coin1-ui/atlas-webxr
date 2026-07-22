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
  overageHasPayment?: boolean;
  modelsRetained?: boolean;
  sandboxSeedEnabled?: boolean;
  sandboxSeededAt?: string | null;
  usageIsSandboxSeeded?: boolean;
  sandboxClearAvailable?: boolean;
  liveUsage?: {
    month: string;
    modelCount: number;
    sessionCount: number;
    storageBytes: number;
  };
};

function apiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path.startsWith("/") ? path : `/${path}`;
}

/** Keep Account/Admin renderers safe when Lambda omits month after overage settle. */
export function normalizeUsageResponse(raw: Record<string, unknown>): WorkspaceUsageResponse {
  const live = (raw.liveUsage as WorkspaceUsageResponse["liveUsage"] | undefined) ?? undefined;
  const usageIn = (raw.usage as WorkspaceUsageResponse["usage"] | undefined) ?? undefined;
  const month =
    (typeof usageIn?.month === "string" && usageIn.month) ||
    (typeof live?.month === "string" && live.month) ||
    "";
  const limitsIn = raw.limits as WorkspaceUsageResponse["limits"] | undefined;
  return {
    ...(raw as unknown as WorkspaceUsageResponse),
    plan: (raw.plan as WorkspacePlan) || "starter",
    limits: {
      models: Number(limitsIn?.models ?? 0),
      sessionsPerMonth: Number(limitsIn?.sessionsPerMonth ?? 0),
      storageBytes: Number(limitsIn?.storageBytes ?? 0),
    },
    usage: {
      month,
      modelCount: Number(usageIn?.modelCount ?? live?.modelCount ?? 0),
      sessionCount: Number(usageIn?.sessionCount ?? live?.sessionCount ?? 0),
      storageBytes: Number(usageIn?.storageBytes ?? live?.storageBytes ?? 0),
    },
    liveUsage: live
      ? {
          month: live.month || month,
          modelCount: Number(live.modelCount ?? 0),
          sessionCount: Number(live.sessionCount ?? 0),
          storageBytes: Number(live.storageBytes ?? 0),
        }
      : usageIn
        ? {
            month,
            modelCount: Number(usageIn.modelCount ?? 0),
            sessionCount: Number(usageIn.sessionCount ?? 0),
            storageBytes: Number(usageIn.storageBytes ?? 0),
          }
        : undefined,
    warnings: Array.isArray(raw.warnings) ? (raw.warnings as UsageWarning[]) : [],
  };
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
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeUsageResponse(raw);
}
