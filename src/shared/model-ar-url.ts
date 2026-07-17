/** Customer share link that opens AR focused on one catalog model. */
export function modelArPath(workspaceSlug: string, modelId: string): string {
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  return `${base}/w/${encodeURIComponent(workspaceSlug)}/ar/${encodeURIComponent(modelId)}`;
}

export function modelArUrl(workspaceSlug: string, modelId: string): string {
  return `${location.origin}${modelArPath(workspaceSlug, modelId)}`;
}

/** Global demo / v1 catalog direct AR link (no workspace slug). */
export function globalModelArPath(modelId: string): string {
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/\/$/, "");
  return `${base}/ar/${encodeURIComponent(modelId)}`;
}

export function globalModelArUrl(modelId: string): string {
  return `${location.origin}${globalModelArPath(modelId)}`;
}
