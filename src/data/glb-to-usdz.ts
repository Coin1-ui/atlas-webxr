import { USDZ_MIME } from "../xr/ios/quick-look-ar";

export type GlbToUsdzResult =
  | {
      ok: true;
      blob: Blob;
      byteLength: number;
      meshCount: number;
      materialCount: number;
      mrMapCount: number;
      splitMeshes: number;
    }
  | { ok: false; error: string };

const DEFAULT_USDZ_TIMEOUT_MS = 90_000;
/** Apple Quick Look safe max — 4096 can crash older iPhones. */
const QUICK_LOOK_MAX_TEXTURE_PX = 2048;

type UsdzExporterLike = {
  setTextureUtils: (utils: {
    decompress: (texture: unknown, maxTextureSize?: number) => unknown;
  }) => void;
  parseAsync: (
    scene: unknown,
    options?: { quickLookCompatible?: boolean; maxTextureSize?: number }
  ) => Promise<ArrayBuffer>;
};

type DecompressFn = (
  texture: unknown,
  maxTextureSize?: number,
  renderer?: unknown
) => unknown;

type Box3Like = {
  setFromObject: (obj: unknown) => Box3Like;
  getCenter: (target: Vector3Like) => Vector3Like;
};
type Vector3Like = { x: number; y: number; z: number; set: (x: number, y: number, z: number) => Vector3Like };
type SceneLike = {
  traverse: (fn: (obj: unknown) => void) => void;
  position: Vector3Like;
  updateMatrixWorld: (force?: boolean) => void;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Warm Three.js modules so the first upload does not sit at 5% silently. */
export function preloadGlbToUsdzModules(): void {
  void import("three/examples/jsm/loaders/GLTFLoader.js");
  void import("three/examples/jsm/exporters/USDZExporter.js");
  void import("three/examples/jsm/utils/WebGLTextureUtils.js");
}

type TexLike = {
  needsUpdate?: boolean;
  image?: unknown;
  isCompressedTexture?: boolean;
};
type MatLike = {
  map?: TexLike | null;
  emissiveMap?: TexLike | null;
  metalnessMap?: TexLike | null;
  roughnessMap?: TexLike | null;
  normalMap?: TexLike | null;
  aoMap?: TexLike | null;
  alphaMap?: TexLike | null;
  metalness?: number;
  roughness?: number;
  needsUpdate?: boolean;
};
type MeshLike = { isMesh?: boolean; material?: MatLike | MatLike[] | null };

function materialsFromMesh(mesh: MeshLike): MatLike[] {
  const raw = mesh.material;
  if (Array.isArray(raw)) return raw.filter((m): m is MatLike => Boolean(m));
  return raw ? [raw] : [];
}

/** Scale grayscale MR texture by glTF factor so USDZExporter can use factor=1 + map. */
function scaleTextureLinear(
  tex: TexLike,
  factor: number,
  THREE: typeof import("three")
): InstanceType<typeof THREE.Texture> {
  if (factor === 1) return tex as InstanceType<typeof THREE.Texture>;
  const img = tex.image;
  if (!img || typeof img !== "object" || !("width" in img) || !("height" in img)) {
    return tex as InstanceType<typeof THREE.Texture>;
  }
  const w = Number((img as { width: number }).width);
  const h = Number((img as { height: number }).height);
  if (!w || !h) return tex as InstanceType<typeof THREE.Texture>;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const scale = Math.min(Math.max(factor, 0), 1);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = Math.round(pixels.data[i]! * scale);
    pixels.data[i + 1] = Math.round(pixels.data[i + 1]! * scale);
    pixels.data[i + 2] = Math.round(pixels.data[i + 2]! * scale);
  }
  ctx.putImageData(pixels, 0, 0);
  const baked = new THREE.CanvasTexture(canvas);
  baked.needsUpdate = true;
  return baked;
}

type Mesh3D = MeshLike & {
  name?: string;
  parent?: { remove: (o: unknown) => void; add: (o: unknown) => void } | null;
  geometry?: {
    clone: () => {
      clearGroups: () => void;
      addGroup: (start: number, count: number, materialIndex: number) => void;
    };
    groups?: { start: number; count: number; materialIndex?: number }[];
  };
  position?: { copy: (v: unknown) => void };
  quaternion?: { copy: (q: unknown) => void };
  scale?: { copy: (v: unknown) => void };
};

/**
 * USDZExporter only supports Mesh + single MeshStandardMaterial.
 * glTF multi-primitive meshes become material[] — split into one mesh per group (Bar-Chair wire + fabric).
 */
function splitMultiMaterialMeshesForUsdExport(
  scene: SceneLike,
  THREE: typeof import("three")
): number {
  const toSplit: Mesh3D[] = [];
  scene.traverse((obj) => {
    const mesh = obj as Mesh3D;
    if (!mesh.isMesh || !Array.isArray(mesh.material) || mesh.material.length <= 1) return;
    toSplit.push(mesh);
  });

  let created = 0;
  for (const mesh of toSplit) {
    const materials = mesh.material as MatLike[];
    const geom = mesh.geometry;
    const parent = mesh.parent;
    if (!geom?.groups?.length || !parent) continue;

    parent.remove(mesh);

    for (let gi = 0; gi < geom.groups.length; gi++) {
      const group = geom.groups[gi]!;
      const matIndex = group.materialIndex ?? gi;
      const mat = materials[matIndex] ?? materials[gi];
      if (!mat) continue;

      const subGeom = geom.clone();
      subGeom.clearGroups();
      subGeom.addGroup(group.start, group.count, 0);

      const subMesh = new THREE.Mesh(
        subGeom,
        mat as InstanceType<typeof THREE.Material>
      );
      subMesh.name = `${mesh.name ?? "mesh"}_usd_${gi}`;
      if (mesh.position) subMesh.position.copy(mesh.position as never);
      if (mesh.quaternion) subMesh.quaternion.copy(mesh.quaternion as never);
      if (mesh.scale) subMesh.scale.copy(mesh.scale as never);
      parent.add(subMesh);
      created += 1;
    }
  }
  return created;
}

function countExportMaterials(scene: SceneLike): { meshCount: number; materialCount: number; mrMapCount: number } {
  const materials = new Set<MatLike>();
  let meshCount = 0;
  let mrMapCount = 0;
  scene.traverse((obj) => {
    const mesh = obj as MeshLike;
    if (!mesh.isMesh) return;
    meshCount += 1;
    for (const mat of materialsFromMesh(mesh)) {
      if (!mat) continue;
      materials.add(mat);
      if (mat.metalnessMap || mat.roughnessMap) mrMapCount += 1;
    }
  });
  return { meshCount, materialCount: materials.size, mrMapCount };
}

const TEXTURE_SLOTS: (keyof MatLike)[] = [
  "map",
  "emissiveMap",
  "metalnessMap",
  "roughnessMap",
  "normalMap",
  "aoMap",
  "alphaMap",
];

function createTextureUtils(decompress: DecompressFn, renderer: unknown) {
  return {
    decompress: (texture: unknown, maxTextureSize?: number) =>
      decompress(texture, maxTextureSize ?? QUICK_LOOK_MAX_TEXTURE_PX, renderer),
  };
}

/** Quick Look needs the model near the origin — off-center GLBs render flat/untextured. */
function centerSceneForQuickLook(
  scene: SceneLike,
  THREE: { Box3: new () => Box3Like; Vector3: new () => Vector3Like }
): void {
  const box = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  box.getCenter(center);
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
    return;
  }
  if (Math.abs(center.x) < 0.001 && Math.abs(center.y) < 0.001 && Math.abs(center.z) < 0.001) {
    return;
  }
  scene.position.set(-center.x, -center.y, -center.z);
  scene.updateMatrixWorld(true);
}

/** Assign correct color spaces before MR split and texture bake. */
function assignQuickLookColorSpaces(
  scene: SceneLike,
  THREE: typeof import("three")
): void {
  scene.traverse((obj) => {
    const mesh = obj as MeshLike;
    if (!mesh.isMesh) return;
    for (const mat of materialsFromMesh(mesh)) {
      if (!mat) continue;
      const map = mat.map as { colorSpace?: string } | null | undefined;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      for (const slot of ["metalnessMap", "roughnessMap", "normalMap", "aoMap"] as const) {
        const tex = mat[slot] as { colorSpace?: string } | null | undefined;
        if (tex) tex.colorSpace = THREE.NoColorSpace;
      }
    }
  });
}

/** glTF MR: green = roughness, blue = metallic — Quick Look often needs separate maps. */
function splitCombinedMetalRoughTexture(
  THREE: typeof import("three"),
  combined: { image?: unknown; needsUpdate?: boolean },
  maxPx: number
): { metalnessMap: InstanceType<typeof THREE.Texture>; roughnessMap: InstanceType<typeof THREE.Texture> } {
  const img = combined.image;
  if (!img || typeof img !== "object" || !("width" in img) || !("height" in img)) {
    const fallback = new THREE.Texture(combined.image as CanvasImageSource);
    fallback.needsUpdate = true;
    return { metalnessMap: fallback, roughnessMap: fallback };
  }
  const rawW = Number((img as { width: number }).width);
  const rawH = Number((img as { height: number }).height);
  if (!rawW || !rawH) {
    const fallback = new THREE.Texture(combined.image as CanvasImageSource);
    fallback.needsUpdate = true;
    return { metalnessMap: fallback, roughnessMap: fallback };
  }
  const w = Math.min(rawW, maxPx);
  const h = Math.min(rawH, maxPx);
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const srcCtx = src.getContext("2d")!;
  srcCtx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  const pixels = srcCtx.getImageData(0, 0, w, h);

  const metalCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  metalCanvas.width = roughCanvas.width = w;
  metalCanvas.height = roughCanvas.height = h;
  const metalData = new ImageData(w, h);
  const roughData = new ImageData(w, h);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const rough = pixels.data[i + 1]!;
    const metal = pixels.data[i + 2]!;
    metalData.data[i] = metal;
    metalData.data[i + 1] = metal;
    metalData.data[i + 2] = metal;
    metalData.data[i + 3] = 255;
    roughData.data[i] = rough;
    roughData.data[i + 1] = rough;
    roughData.data[i + 2] = rough;
    roughData.data[i + 3] = 255;
  }
  metalCanvas.getContext("2d")!.putImageData(metalData, 0, 0);
  roughCanvas.getContext("2d")!.putImageData(roughData, 0, 0);
  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  metalnessMap.needsUpdate = true;
  roughnessMap.needsUpdate = true;
  return { metalnessMap, roughnessMap };
}

/** Ensure combined metallicRoughness factors are set before texture bake (Bar-Chair single MR map). */
function bakeMetalRoughFactors(
  scene: SceneLike,
  THREE?: typeof import("three")
): void {
  scene.traverse((obj) => {
    const mesh = obj as MeshLike;
    if (!mesh.isMesh || !THREE) return;
    for (const mat of materialsFromMesh(mesh)) {
      if (!mat) continue;
      if (mat.metalnessMap && mat.roughnessMap && mat.metalnessMap === mat.roughnessMap) {
        const split = splitCombinedMetalRoughTexture(THREE, mat.metalnessMap, QUICK_LOOK_MAX_TEXTURE_PX);
        mat.metalnessMap = split.metalnessMap;
        mat.roughnessMap = split.roughnessMap;
      }
      const metalFactor = mat.metalness ?? 1;
      const roughFactor = mat.roughness ?? 1;
      if (mat.metalnessMap && metalFactor !== 1) {
        mat.metalnessMap = scaleTextureLinear(mat.metalnessMap, metalFactor, THREE);
      }
      if (mat.roughnessMap && roughFactor !== 1) {
        mat.roughnessMap = scaleTextureLinear(mat.roughnessMap, roughFactor, THREE);
      }
      if (mat.metalnessMap) mat.metalness = 1;
      if (mat.roughnessMap) mat.roughness = 1;
    }
  });
}

/** Force USDZExporter to emit MR textures (requires factors === 1 per Three.js #22201). */
function finalizeMaterialsForQuickLookExport(scene: SceneLike): void {
  scene.traverse((obj) => {
    const mesh = obj as MeshLike;
    if (!mesh.isMesh) return;
    for (const mat of materialsFromMesh(mesh)) {
      if (!mat) continue;
      if (mat.metalnessMap) mat.metalness = 1;
      if (mat.roughnessMap) mat.roughness = 1;
    }
  });
}

/** GLTFLoader assigns color spaces — ensure MR maps stay linked; bake textures for export. */
function prepareAndEmbedTextures(
  scene: SceneLike,
  decompress: DecompressFn,
  renderer: { render: (scene: unknown, camera: unknown) => void },
  camera: unknown
): void {
  renderer.render(scene, camera);
  scene.traverse((obj) => {
    const mesh = obj as MeshLike;
    if (!mesh.isMesh) return;
    for (const mat of materialsFromMesh(mesh)) {
      if (!mat) continue;
      if (mat.metalnessMap || mat.roughnessMap) {
        mat.metalness = mat.metalness ?? 1;
        mat.roughness = mat.roughness ?? 1;
      }
      for (const slot of TEXTURE_SLOTS) {
        const tex = mat[slot] as TexLike | null | undefined;
        if (!tex?.image) continue;
        try {
          const baked = decompress(tex, QUICK_LOOK_MAX_TEXTURE_PX, renderer) as TexLike;
          (mat as Record<string, unknown>)[slot] = baked;
          baked.needsUpdate = true;
        } catch {
          tex.needsUpdate = true;
        }
      }
      mat.needsUpdate = true;
    }
  });
  renderer.render(scene, camera);
}

/**
 * Convert GLB → USDZ in the browser (PC model manager upload).
 * Optional manual USDZ upload is preferred when supplied by the user.
 */
export async function convertGlbToUsdz(
  glb: Blob | ArrayBuffer,
  onProgress?: (phase: string) => void,
  timeoutMs = DEFAULT_USDZ_TIMEOUT_MS
): Promise<GlbToUsdzResult> {
  let renderer: {
    dispose: () => void;
    setSize: (w: number, h: number) => void;
    render: (scene: unknown, camera: unknown) => void;
  } | null = null;
  try {
    onProgress?.("Loading Three.js converter…");
    const [THREE, { GLTFLoader }, { USDZExporter }, { decompress }] = await withTimeout(
      Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/exporters/USDZExporter.js"),
        import("three/examples/jsm/utils/WebGLTextureUtils.js"),
      ]),
      timeoutMs,
      "Loading converter"
    );

    onProgress?.("Parsing GLB…");

    const buffer = glb instanceof Blob ? await glb.arrayBuffer() : glb;
    if (!buffer.byteLength) {
      return { ok: false, error: "GLB file is empty" };
    }

    const webglRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    webglRenderer.setSize(128, 128);
    renderer = webglRenderer;
    if (typeof (webglRenderer as { init?: () => Promise<void> }).init === "function") {
      await (webglRenderer as { init: () => Promise<void> }).init();
    }

    const loader = new GLTFLoader();
    const gltf = await withTimeout(loader.parseAsync(buffer, ""), timeoutMs, "GLB parse");

    if (!gltf.scene) {
      return { ok: false, error: "GLB has no scene root" };
    }

    centerSceneForQuickLook(gltf.scene as unknown as SceneLike, THREE);

    assignQuickLookColorSpaces(gltf.scene as unknown as SceneLike, THREE);

    onProgress?.("Embedding textures for Safari Quick Look…");
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(0, 1, 2);
    prepareAndEmbedTextures(
      gltf.scene as unknown as SceneLike,
      decompress as DecompressFn,
      webglRenderer,
      camera
    );

    bakeMetalRoughFactors(gltf.scene as unknown as SceneLike, THREE);
    const splitMeshes = splitMultiMaterialMeshesForUsdExport(gltf.scene as unknown as SceneLike, THREE);
    finalizeMaterialsForQuickLookExport(gltf.scene as unknown as SceneLike);
    const exportStats = countExportMaterials(gltf.scene as unknown as SceneLike);

    onProgress?.("Exporting USDZ for Safari Quick Look…");
    const exporter = new USDZExporter() as unknown as UsdzExporterLike;
    exporter.setTextureUtils(createTextureUtils(decompress as DecompressFn, webglRenderer));

    const usdzBuffer = await withTimeout(
      exporter.parseAsync(gltf.scene, {
        quickLookCompatible: true,
        maxTextureSize: QUICK_LOOK_MAX_TEXTURE_PX,
      }),
      timeoutMs,
      "USDZ export"
    );

    if (!usdzBuffer?.byteLength) {
      return { ok: false, error: "USDZ export produced empty output" };
    }

    const blob = new Blob([usdzBuffer], { type: USDZ_MIME });
    return {
      ok: true,
      blob,
      byteLength: blob.size,
      meshCount: exportStats.meshCount,
      materialCount: exportStats.materialCount,
      mrMapCount: exportStats.mrMapCount,
      splitMeshes,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    renderer?.dispose();
  }
}

/** Build a `.usdz` File sibling from a `.glb` File after conversion. */
export function usdzFileFromGlbName(glbName: string): string {
  const base = glbName.replace(/\.glb$/i, "");
  return `${base || "model"}.usdz`;
}
