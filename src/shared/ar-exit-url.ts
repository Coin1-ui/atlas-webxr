/** Normalize exit URL for storage (path or absolute https). */
export function normalizeArExitUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    throw new Error("Exit URL must start with / or be a valid http(s) URL");
  }
}

export function navigateToArExitUrl(exitUrl: string): void {
  if (/^https?:\/\//i.test(exitUrl)) {
    location.assign(exitUrl);
    return;
  }
  const path = exitUrl.startsWith("/") ? exitUrl : `/${exitUrl}`;
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  location.assign(`${base}${path}` || path);
}
