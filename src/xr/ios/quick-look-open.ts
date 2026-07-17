import { getCachedGlb, fetchGlbBytes, prefetchCatalogGlbs } from "../../data/glb-cache";
import { convertGlbToUsdz } from "../../data/glb-to-usdz";
import { logArEvent } from "../../ar-session/logger";
import { openQuickLookAr } from "./quick-look-ar";

export type UsdzProbeResult = {
  reachable: boolean;
  bytes: number | null;
  contentType: string | null;
  zipMagic: boolean;
  probeMethod: "range-get" | "head" | "none";
};

/** API gateways often block HEAD — probe first bytes with Range GET. */
export async function probeUsdzAsset(usdzUrl: string): Promise<UsdzProbeResult> {
  const fail: UsdzProbeResult = {
    reachable: false,
    bytes: null,
    contentType: null,
    zipMagic: false,
    probeMethod: "none",
  };
  try {
    const res = await fetch(usdzUrl, {
      method: "GET",
      headers: { Range: "bytes=0-3" },
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) return fail;
    const buf = new Uint8Array(await res.arrayBuffer());
    const zipMagic = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    const len = res.headers.get("content-length");
    const total = res.headers.get("content-range")?.split("/")[1];
    return {
      reachable: true,
      bytes: total ? Number(total) : len ? Number(len) : null,
      contentType: res.headers.get("content-type"),
      zipMagic,
      probeMethod: "range-get",
    };
  } catch {
    try {
      const res = await fetch(usdzUrl, { method: "HEAD", cache: "no-store" });
      const len = res.headers.get("content-length");
      return {
        reachable: res.ok,
        bytes: len ? Number(len) : null,
        contentType: res.headers.get("content-type"),
        zipMagic: false,
        probeMethod: "head",
      };
    } catch {
      return fail;
    }
  }
}

export type QuickLookOpenOptions = {
  modelId: string;
  modelUrl: string | null;
  usdzUrl: string | null;
  posterUrl?: string | null;
  onPreparing?: (message: string) => void;
};

let quickLookOpenBusy = false;

/** Prefetch GLBs while the iOS picker is visible so convert does not fail with Load failed. */
export function prefetchQuickLookGlbs(modelUrls: (string | null | undefined)[]): void {
  void prefetchCatalogGlbs(modelUrls);
}

/**
 * Fresh GLB→USDZ in Safari avoids stale S3 USDZ with missing/broken textures.
 * Falls back to catalog USDZ when conversion fails.
 */
export async function openQuickLookFromGlbOrUsdz(options: QuickLookOpenOptions): Promise<void> {
  if (quickLookOpenBusy) return;
  quickLookOpenBusy = true;
  try {
    await openQuickLookFromGlbOrUsdzInner(options);
  } finally {
    quickLookOpenBusy = false;
  }
}

async function openQuickLookFromGlbOrUsdzInner(options: QuickLookOpenOptions): Promise<void> {
  const { modelId, modelUrl, usdzUrl, posterUrl, onPreparing } = options;
  const redactedUsdz = usdzUrl?.replace(/\/[^/]+$/, "/[asset]") ?? null;

  let usdzProbe: UsdzProbeResult | null = null;
  if (usdzUrl) {
    usdzProbe = await probeUsdzAsset(usdzUrl);
  }

  let openSource: "fresh-convert" | "catalog-usdz" = "catalog-usdz";
  let convertBytes: number | null = null;
  let convertError: string | null = null;
  let convertStats: {
    meshCount: number;
    materialCount: number;
    mrMapCount: number;
    splitMeshes: number;
  } | null = null;
  let blobUrl: string | null = null;

  if (modelUrl) {
    onPreparing?.("Preparing Safari AR model…");
    try {
      onPreparing?.("Downloading GLB…");
      const buffer =
        getCachedGlb(modelUrl) ??
        (await fetchGlbBytes(modelUrl, 60_000));
      onPreparing?.("Converting textures for Quick Look…");
      const result = await convertGlbToUsdz(buffer, (phase) => onPreparing?.(phase), 120_000);
      if (result.ok) {
        blobUrl = URL.createObjectURL(result.blob);
        convertBytes = result.byteLength;
        convertStats = {
          meshCount: result.meshCount,
          materialCount: result.materialCount,
          mrMapCount: result.mrMapCount,
          splitMeshes: result.splitMeshes,
        };
        openSource = "fresh-convert";
        openQuickLookAr(blobUrl, posterUrl);
        window.setTimeout(() => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }, 120_000);
      } else {
        convertError = result.error;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      convertError = msg.includes("abort") || msg.includes("Load failed") ? `GLB fetch failed: ${msg}` : msg;
    }
  }

  if (openSource !== "fresh-convert") {
    if (!usdzUrl) {
      logArEvent("ios-quick-look-open", "Safari AR model unavailable", "fail", {
        error: convertError ?? "No USDZ URL",
        details: {
          modelId,
          convertError,
          usdzReachable: usdzProbe?.reachable ?? false,
          usdzBytes: usdzProbe?.bytes ?? null,
          usdzZipMagic: usdzProbe?.zipMagic ?? false,
        },
      });
      throw new Error(convertError ?? "USDZ not available for this model.");
    }
    openQuickLookAr(usdzUrl, posterUrl);
  }

  logArEvent("ios-quick-look-open", "Safari AR model opened", "info", {
    details: {
      modelId,
      usdzUrl: redactedUsdz,
      openSource,
      convertBytes,
      convertError,
      convertMeshCount: convertStats?.meshCount ?? null,
      convertMaterialCount: convertStats?.materialCount ?? null,
      convertMrMapCount: convertStats?.mrMapCount ?? null,
      convertSplitMeshes: convertStats?.splitMeshes ?? null,
      usdzReachable: usdzProbe?.reachable ?? false,
      usdzBytes: usdzProbe?.bytes ?? null,
      usdzContentType: usdzProbe?.contentType ?? null,
      usdzZipMagic: usdzProbe?.zipMagic ?? false,
      usdzProbeMethod: usdzProbe?.probeMethod ?? "none",
    },
  });
}
