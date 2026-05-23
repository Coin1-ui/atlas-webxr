import type { ArSessionEvent, ArSessionReport } from "./types";

const HISTORY_KEY = "atlas-ar-session-history";

let sessionStart = 0;
let startedAt = "";
let events: ArSessionEvent[] = [];

export function startArSessionLog(): void {
  sessionStart = performance.now();
  startedAt = new Date().toISOString();
  events = [];
  logArEvent("session-start", "AR session log started", "info");
}

export function logArEvent(
  id: string,
  name: string,
  status: ArSessionEvent["status"],
  extra?: { details?: ArSessionEvent["details"]; error?: string }
): void {
  if (!sessionStart) startArSessionLog();
  events.push({
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - sessionStart),
    id,
    name,
    status,
    details: extra?.details,
    error: extra?.error,
  });
}

export function finishArSessionReport(): ArSessionReport {
  const finishedAt = new Date().toISOString();
  const report: ArSessionReport = {
    meta: {
      type: "atlas-ar-live-session",
      version: "1.0.0",
      startedAt,
      finishedAt,
      durationMs: Math.round(performance.now() - sessionStart),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    },
    environment: {
      isSecureContext: window.isSecureContext,
      protocol: location.protocol,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
    },
    events: [...events],
  };
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: ArSessionReport[] = raw ? JSON.parse(raw) : [];
    list.unshift(report);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
  return report;
}

export function downloadArSessionReport(report?: ArSessionReport): void {
  const data = report ?? finishArSessionReport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `atlas-ar-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
