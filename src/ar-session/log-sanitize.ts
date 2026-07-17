import type { ArSessionEvent, ArSessionReport } from "./types";

const SENSITIVE_DETAIL_KEYS = new Set([
  "modelUrl",
  "href",
  "exitUrl",
  "uploadUrl",
  "presignedUrl",
  "iconUrl",
  "glbUrl",
  "usdzUrl",
  "authorization",
  "token",
  "apiKey",
]);

const AWS_HOST =
  /(?:execute-api|\.amazonaws\.com|amplifyapp\.com|cloudfront\.net|s3[.-]|amazonaws)/i;

/** Redact URLs and secrets before session logs leave the device. */
export function sanitizeStringForLog(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (/^Bearer\s+\S+/i.test(trimmed)) {
    return "Bearer [redacted]";
  }

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes("amazonaws")) {
    return value;
  }

  try {
    const url = new URL(trimmed);
    if (AWS_HOST.test(url.hostname) || url.search.includes("X-Amz-")) {
      const path = url.pathname.replace(/\/assets\/([^/]+)$/i, "/assets/[asset]");
      if (url.hostname.includes("execute-api")) {
        return `[api]${path}`;
      }
      if (url.hostname.includes("amplifyapp.com")) {
        return `[app]${path}${url.hash || ""}`;
      }
      if (url.hostname.includes("amazonaws.com")) {
        return `[aws]${path}`;
      }
      return `[url]${path}`;
    }
    if (url.search && /(?:token|key|sig|secret|auth)=/i.test(url.search)) {
      url.search = "";
      return `${url.origin}${url.pathname}`;
    }
    return `${url.origin}${url.pathname}${url.hash || ""}`;
  } catch {
    if (AWS_HOST.test(trimmed)) {
      return "[redacted-url]";
    }
    return value;
  }
}

function sanitizeDetailValue(
  key: string,
  value: string | number | boolean | null | undefined
): string | number | boolean | null | undefined {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (SENSITIVE_DETAIL_KEYS.has(key)) {
    if (key === "href" || key === "exitUrl") {
      try {
        const url = new URL(value, typeof location !== "undefined" ? location.origin : undefined);
        return `${url.pathname}${url.search}${url.hash}`;
      } catch {
        return sanitizeStringForLog(value);
      }
    }
    return sanitizeStringForLog(value);
  }
  if (typeof value === "string" && (value.includes("://") || AWS_HOST.test(value))) {
    return sanitizeStringForLog(value);
  }
  return value;
}

function sanitizeEvent(event: ArSessionEvent): ArSessionEvent {
  if (!event.details) return event;
  const details: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(event.details)) {
    details[key] = sanitizeDetailValue(key, value);
  }
  return {
    ...event,
    details,
    error: event.error ? sanitizeStringForLog(event.error) : event.error,
  };
}

export function sanitizeSessionReportForExport(report: ArSessionReport): ArSessionReport {
  return {
    ...report,
    meta: {
      ...report.meta,
      userAgent: report.meta.userAgent.replace(/\s+/g, " ").slice(0, 120),
    },
    events: report.events.map(sanitizeEvent),
    placementSummary: report.placementSummary
      ? {
          ...report.placementSummary,
          issues: report.placementSummary.issues.map((issue) =>
            sanitizeStringForLog(issue)
          ),
        }
      : report.placementSummary,
  };
}
