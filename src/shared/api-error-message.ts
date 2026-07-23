/** Turn API Gateway / Atlas error bodies into short user-facing text. */
export function apiErrorMessage(body: string, status: number): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return status >= 500
      ? "Atlas service is temporarily unavailable. Please try again in a moment."
      : `Request failed (HTTP ${status}).`;
  }

  try {
    const data = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data.message === "string" && data.message.trim()) {
      const msg = data.message.trim();
      if (/^internal server error$/i.test(msg)) {
        return "Atlas service is temporarily unavailable. Please try again in a moment.";
      }
      return msg;
    }
  } catch {
    /* not JSON */
  }

  if (/^internal server error$/i.test(trimmed)) {
    return "Atlas service is temporarily unavailable. Please try again in a moment.";
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed;
}
