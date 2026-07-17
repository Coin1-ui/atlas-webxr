import { getApiBase } from "../config/api";
import { getCatalogWorkspaceSlug } from "./catalog-context";

export type AnalyticsEventType = "session_start" | "placement" | "session_end";

export type AnalyticsEvent = {
  type: AnalyticsEventType;
  at: string;
  modelId?: string;
  placementCount?: number;
  durationMs?: number;
};

const CHUNK_RELOAD_KEY = "atlas-chunk-reload";

let sessionId = "";
let placementCount = 0;
let sessionStartedAt = 0;
let pendingEvents: AnalyticsEvent[] = [];
let flushTimer: number | undefined;

function apiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path.startsWith("/") ? path : `/${path}`;
}

function workspaceSlugForAnalytics(): string | null {
  return getCatalogWorkspaceSlug();
}

export function installDeployRecovery(): void {
  window.addEventListener("vite:preloadError", () => {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    location.reload();
  });
}

export function clearDeployRecoveryFlag(): void {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}

export function resetAnalyticsSession(): void {
  sessionId = crypto.randomUUID();
  placementCount = 0;
  sessionStartedAt = Date.now();
  pendingEvents = [];
}

export function trackAnalyticsEvent(
  type: AnalyticsEventType,
  extra?: { modelId?: string; durationMs?: number }
): void {
  const slug = workspaceSlugForAnalytics();
  if (!slug) return;
  if (!sessionId) resetAnalyticsSession();

  const event: AnalyticsEvent = {
    type,
    at: new Date().toISOString(),
    ...extra,
  };
  if (type === "placement") {
    placementCount += 1;
  }
  pendingEvents.push(event);
  scheduleFlush(slug);
}

export function flushAnalyticsSessionEnd(durationMs?: number): void {
  const slug = workspaceSlugForAnalytics();
  if (!slug || !sessionId) return;

  pendingEvents.push({
    type: "session_end",
    at: new Date().toISOString(),
    placementCount,
    durationMs: durationMs ?? Math.max(0, Date.now() - sessionStartedAt),
  });
  void flushAnalytics(slug, true);
}

function scheduleFlush(slug: string): void {
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    void flushAnalytics(slug, false);
  }, 4000);
}

async function flushAnalytics(slug: string, forceAll: boolean): Promise<void> {
  if (!pendingEvents.length) return;
  const batch = [...pendingEvents];
  if (!forceAll && !batch.some((e) => e.type === "session_end")) {
    return;
  }

  pendingEvents = [];
  try {
    await fetch(apiUrl(`/v2/workspaces/${encodeURIComponent(slug)}/analytics/events`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, events: batch }),
      keepalive: true,
    });
  } catch {
    pendingEvents = batch.concat(pendingEvents);
  }
}

export function analyticsPlacementCount(): number {
  return placementCount;
}
