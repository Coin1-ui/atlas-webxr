import { jsonResponse, optionsResponse, parseJsonBody } from "../lib/http.mjs";
import { resolveWorkspaceBySlug } from "../lib/authz.mjs";
import { recordQualifiedSession } from "../lib/usage.mjs";
import { isTrialSuspended } from "../lib/trial.mjs";

const ALLOWED_TYPES = new Set(["session_start", "placement", "session_end"]);
const MAX_EVENTS = 32;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Public analytics ingest for AR viewer sessions.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @param {string} slug
 */
export async function handleAnalyticsEvents(event, slug) {
  if (event.requestContext?.http?.method === "OPTIONS") return optionsResponse();
  if (event.requestContext?.http?.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const workspace = await resolveWorkspaceBySlug(slug);
  if (workspace.restricted) {
    return jsonResponse(403, { error: "Analytics disabled for restricted workspace" });
  }
  if (isTrialSuspended(workspace)) {
    return jsonResponse(403, { error: "Analytics disabled — showroom paused", suspended: true });
  }
  const body = parseJsonBody(event);
  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "JSON body required" });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return jsonResponse(400, { error: "sessionId must be 8–64 alphanumeric characters" });
  }
  if (!events.length) {
    return jsonResponse(400, { error: "events array is required" });
  }

  let placementCount = 0;
  let sessionEnd = false;
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const type = typeof raw.type === "string" ? raw.type : "";
    if (!ALLOWED_TYPES.has(type)) continue;
    if (type === "placement") placementCount += 1;
    if (type === "session_end") {
      sessionEnd = true;
      if (typeof raw.placementCount === "number" && raw.placementCount >= 0) {
        placementCount = Math.max(placementCount, raw.placementCount);
      }
    }
  }

  let sessionCounted = false;
  if (sessionEnd && placementCount >= 1) {
    const result = await recordQualifiedSession(workspace.id, sessionId, placementCount);
    sessionCounted = Boolean(result.counted);
  }

  return jsonResponse(202, {
    ok: true,
    accepted: events.length,
    sessionCounted,
  });
}
