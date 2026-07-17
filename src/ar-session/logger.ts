import type { ArSessionEvent, ArSessionReport } from "./types";
import { appendSessionSummary } from "./placement-checks";
import { sanitizeSessionReportForExport } from "./log-sanitize";

const HISTORY_KEY = "atlas-ar-session-history";
const LOG_VERSION = "1.2.0";

let sessionStart = 0;
let startedAt = "";
let events: ArSessionEvent[] = [];
let lastEventAt = 0;

function pushEvent(
  id: string,
  name: string,
  status: ArSessionEvent["status"],
  extra?: { details?: ArSessionEvent["details"]; error?: string }
): void {
  const now = performance.now();
  const sincePreviousMs =
    lastEventAt > 0 ? Math.round(now - lastEventAt) : undefined;
  lastEventAt = now;
  events.push({
    at: new Date().toISOString(),
    elapsedMs: Math.round(now - sessionStart),
    id,
    name,
    status,
    details: {
      ...extra?.details,
      ...(sincePreviousMs !== undefined ? { sincePreviousMs } : {}),
    },
    error: extra?.error,
  });
}

/** Start or continue the session log (does not wipe prior flow events). */
export function ensureSessionLog(): void {
  if (sessionStart) return;
  sessionStart = performance.now();
  startedAt = new Date().toISOString();
  lastEventAt = sessionStart;
  events = [];
  pushEvent("session-start", "Session log started", "info", {
    details: { logVersion: LOG_VERSION, phase: "boot" },
  });
}

/** @deprecated Prefer ensureSessionLog — only resets when force=true. */
export function startArSessionLog(options?: { force?: boolean }): void {
  if (options?.force) {
    sessionStart = 0;
  }
  ensureSessionLog();
}

export function logArEvent(
  id: string,
  name: string,
  status: ArSessionEvent["status"],
  extra?: { details?: ArSessionEvent["details"]; error?: string }
): void {
  ensureSessionLog();
  pushEvent(id, name, status, extra);
}

/** Landing-page and navigation checkpoints (same JSON download as AR session). */
export function logFlowEvent(
  id: string,
  name: string,
  status: ArSessionEvent["status"] = "info",
  details?: ArSessionEvent["details"]
): void {
  logArEvent(id, name, status, { details });
}

export function finishArSessionReport(): ArSessionReport {
  const finishedAt = new Date().toISOString();
  const report = sanitizeSessionReportForExport(
    appendSessionSummary({
      meta: {
        type: "atlas-ar-live-session",
        version: LOG_VERSION,
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
    })
  );
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

export type DownloadReportResult =
  | { ok: true; method: "download" | "share" | "clipboard"; filename: string }
  | { ok: false; error: string };

/** WebXR dom-overlay often blocks programmatic downloads — share + clipboard fallbacks. */
export async function downloadArSessionReport(
  report?: ArSessionReport
): Promise<DownloadReportResult> {
  const data = sanitizeSessionReportForExport(report ?? finishArSessionReport());
  const json = JSON.stringify(data, null, 2);
  const filename = `atlas-ar-session-${Date.now()}.json`;
  const file = new File([json], filename, { type: "application/json" });

  if (typeof navigator.share === "function") {
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return { ok: true, method: "share", filename };
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.name === "AbortError") {
        return { ok: false, error: "Share cancelled" };
      }
    }
  }

  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
    return { ok: true, method: "download", filename };
  } catch {
    /* fall through */
  }

  try {
    await navigator.clipboard.writeText(json);
    return { ok: true, method: "clipboard", filename };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not export session log",
    };
  }
}
