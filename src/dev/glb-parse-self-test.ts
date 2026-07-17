/**
 * Browser self-test for GLB sequential parse (no WebXR required).
 * Open https://localhost:5173/?selftest=glb in dev or preview.
 */
import { Engine, Scene, TransformNode } from "@babylonjs/core";
import { fetchCatalog, resolveCatalogAssets } from "../data/model-catalog";
import { prefetchCatalogGlbs } from "../data/glb-cache";
import {
  bindGlbCacheScene,
  parseGlbsSequential,
  isGlbParsed,
  disposeOfflineCache,
  placeGlbFromSceneCache,
  collectGeometryMeshes,
  meshHasGeometry,
} from "../xr/glb-offline-cache";

export type GlbSelfTestResult = {
  ok: boolean;
  durationMs: number;
  modelCount: number;
  warmed: string[];
  failed: { url: string; error: string }[];
  parsed: {
    url: string;
    ready: boolean;
    meshCount?: number;
    geometryMeshCount?: number;
    shadowCasterCount?: number;
    maxDimensionM?: number;
    footprintM?: number;
    materialTypes?: string;
  }[];
};

export async function runGlbParseSelfTest(): Promise<GlbSelfTestResult> {
  const t0 = performance.now();
  disposeOfflineCache();

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    alpha: true,
  });
  const scene = new Scene(engine);
  bindGlbCacheScene(scene);

  try {
    const catalog = await fetchCatalog();
    const urls = catalog
      .map((r) => resolveCatalogAssets(r).modelUrl)
      .filter((u): u is string => Boolean(u));

    const prefetch = await prefetchCatalogGlbs(urls);
    if (prefetch.failed.length) {
      return {
        ok: false,
        durationMs: Math.round(performance.now() - t0),
        modelCount: urls.length,
        warmed: [],
        failed: prefetch.failed,
        parsed: urls.map((url) => ({ url, ready: false })),
      };
    }

    const result = await parseGlbsSequential(urls, {
      timeoutMs: 60000,
      onProgress: (current, total, url) => {
        console.log(`[glb-selftest] ${current}/${total} ${url}`);
      },
    });

    const parsed = urls.map((url) => {
      if (!isGlbParsed(url)) {
        return { url, ready: false };
      }
      const wrapper = new TransformNode("test-wrapper", scene);
      try {
        const placed = placeGlbFromSceneCache(wrapper, url, 0);
        const allMeshes = wrapper.getChildMeshes(true);
        const geoMeshes = collectGeometryMeshes(wrapper);
        const types = new Set<string>();
        for (const mesh of geoMeshes.length ? geoMeshes : allMeshes) {
          const mat = mesh.material;
          if (mat) types.add(mat.getClassName());
          for (const sm of mesh.subMeshes ?? []) {
            const sub = sm.getMaterial();
            if (sub) types.add(sub.getClassName());
          }
        }
        wrapper.computeWorldMatrix(true);
        const bounds = wrapper.getHierarchyBoundingVectors(true);
        const size = bounds.max.subtract(bounds.min);
        const shadowCasterCount = geoMeshes.filter((m) => meshHasGeometry(m)).length;
        return {
          url,
          ready: true,
          meshCount: allMeshes.length,
          geometryMeshCount: geoMeshes.length,
          shadowCasterCount,
          maxDimensionM: Math.round(Math.max(size.x, size.y, size.z) * 1000) / 1000,
          footprintM: placed.footprintM,
          materialTypes: [...types].join(", ") || "MeshWithoutStandardMaterial",
        };
      } catch (e) {
        return {
          url,
          ready: false,
          materialTypes: e instanceof Error ? e.message : String(e),
        };
      } finally {
        wrapper.dispose();
      }
    });
    const ok =
      result.failed.length === 0 &&
      parsed.every(
        (p) =>
          p.ready &&
          (p.shadowCasterCount ?? 0) > 0 &&
          p.materialTypes !== "MeshWithoutStandardMaterial"
      );

    return {
      ok,
      durationMs: Math.round(performance.now() - t0),
      modelCount: urls.length,
      warmed: result.warmed,
      failed: result.failed,
      parsed,
    };
  } finally {
    engine.stopRenderLoop();
    disposeOfflineCache();
    scene.dispose();
    engine.dispose();
  }
}

if (new URLSearchParams(location.search).get("selftest") === "glb") {
  void runGlbParseSelfTest().then((result) => {
    (window as unknown as { __glbTestResult?: GlbSelfTestResult }).__glbTestResult = result;
    console.log("[glb-selftest] done", result);
  });
}
