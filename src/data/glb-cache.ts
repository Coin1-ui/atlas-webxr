const GLB_MAGIC = 0x46546c67;
const cache = new Map<string, ArrayBuffer>();

export function absoluteModelUrl(url: string): string {
  return new URL(url, location.href).href;
}

export function validateGlbBuffer(buffer: ArrayBuffer, label: string): void {
  if (buffer.byteLength < 12) {
    throw new Error(`${label}: file too small (${buffer.byteLength} bytes)`);
  }
  const magic = new DataView(buffer).getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    const peek = new TextDecoder().decode(buffer.slice(0, 60)).replace(/\s+/g, " ");
    throw new Error(`${label}: not a GLB binary. Starts with: "${peek}"`);
  }
}

export async function fetchGlbBytes(
  modelUrl: string,
  timeoutMs = 20000
): Promise<ArrayBuffer> {
  const key = absoluteModelUrl(modelUrl);
  const cached = cache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(key, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${key}`);
    }
    const buffer = await response.arrayBuffer();
    validateGlbBuffer(buffer, key);
    cache.set(key, buffer);
    return buffer;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Timed out loading ${key} (${timeoutMs / 1000}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function getCachedGlb(modelUrl: string): ArrayBuffer | undefined {
  return cache.get(absoluteModelUrl(modelUrl));
}

export async function prefetchCatalogGlbs(
  modelUrls: (string | null | undefined)[]
): Promise<{ cached: string[]; failed: { url: string; error: string }[] }> {
  const urls = [...new Set(modelUrls.filter((u): u is string => Boolean(u)))];
  const cached: string[] = [];
  const failed: { url: string; error: string }[] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetchGlbBytes(url);
        cached.push(url);
      } catch (e) {
        failed.push({
          url,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })
  );

  return { cached, failed };
}

export function clearGlbCache(): void {
  cache.clear();
}
