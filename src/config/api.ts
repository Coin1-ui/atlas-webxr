/** AWS API Gateway / hosted API base URL (no trailing slash). */
export function getApiBase(): string {
  const url = import.meta.env.VITE_ATLAS_API_URL as string | undefined;
  return url?.replace(/\/$/, "") ?? "";
}

export function useRemoteModelApi(): boolean {
  return getApiBase().length > 0;
}

export function isLocalDev(): boolean {
  return (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname)
  );
}

export function modelApiUrl(path: string): string {
  const base = getApiBase();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return path;
}

/** Block uploads on hosted builds when the API URL was not baked in at build time. */
export function canUploadDemoLocal(): boolean {
  return isLocalDev();
}

export function canUploadDemoRemote(): boolean {
  return useRemoteModelApi();
}

export function demoDualUploadAvailable(): boolean {
  return canUploadDemoLocal() && canUploadDemoRemote();
}

export function uploadBlockedReason(): string | null {
  if (canUploadDemoRemote() || canUploadDemoLocal()) return null;
  return (
    "Upload API not configured for this deployment. Set VITE_ATLAS_API_URL in your " +
    "hosting environment variables, then redeploy the app."
  );
}
