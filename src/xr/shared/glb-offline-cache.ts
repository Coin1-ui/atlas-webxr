import {
  Node,
  Scene,
  TransformNode,
  AbstractMesh,
  Quaternion,
  Vector3,
  VertexBuffer,
  NullEngine,
  type AssetContainer,
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { getCachedGlb, fetchGlbBytes, absoluteModelUrl } from "../../data/glb-cache";
import { upgradeMaterialTexturesForAR } from "./ar-pbr-environment";

/** Live AR scene — placement targets this scene only. */
let boundScene: Scene | null = null;
/** When true, GLB parse runs on a 1×1 offscreen engine so WebXR rAF is not blocked. */
let isolatedParse = false;

let parseEngine: NullEngine | null = null;
let parseScene: Scene | null = null;

/** Parsed on offline or bound scene (validation / glbReady). */
const offlineContainers = new Map<string, AssetContainer>();
/** Loaded on the live AR scene for instantiateModelsToScene. */
const arContainers = new Map<string, AssetContainer>();
/** Parsed on the 3D preview scene — avoids re-decoding GLB on every toggle. */
const previewContainers = new Map<string, AssetContainer>();
/** Max X/Z footprint in meters measured at parse time (for reticle preview). */
const footprintCache = new Map<string, number>();

let lastParseResult: {
  warmed: string[];
  failed: { url: string; error: string }[];
} = { warmed: [], failed: [] };

export function bindGlbCacheScene(
  scene: Scene,
  options?: { isolatedParse?: boolean }
): void {
  boundScene = scene;
  isolatedParse = options?.isolatedParse ?? false;
}

/**
 * Parse catalog GLBs on a 1×1 NullEngine while the user is still on the home screen.
 * Safe before WebXR — does not block the live AR render loop.
 */
export async function parseGlbsOfflineAtHome(
  urls: string[],
  options?: { timeoutMs?: number; onProgress?: GlbParseProgress }
): Promise<{ warmed: string[]; failed: { url: string; error: string }[] }> {
  const parseScene = ensureParseScene();
  const prevBound = boundScene;
  const prevIsolated = isolatedParse;
  boundScene = parseScene;
  isolatedParse = true;
  try {
    return await parseGlbsSequential(urls, options);
  } finally {
    boundScene = prevBound;
    isolatedParse = prevIsolated;
  }
}

function ensureParseScene(): Scene {
  if (!parseScene) {
    parseEngine = new NullEngine();
    parseScene = new Scene(parseEngine);
  }
  return parseScene;
}

function sceneForOfflineParse(): Scene {
  if (isolatedParse) {
    return ensureParseScene();
  }
  if (!boundScene) {
    throw new Error("GLB cache scene not bound — call bindGlbCacheScene first");
  }
  return boundScene;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out (${Math.round(ms / 1000)}s)`)), ms);
    }),
  ]);
}

async function loadContainerOnScene(
  modelUrl: string,
  scene: Scene,
  timeoutMs: number
): Promise<AssetContainer> {
  const buffer = getCachedGlb(modelUrl) ?? (await fetchGlbBytes(modelUrl));
  const fileName = modelUrl.split("/").pop() ?? "model.glb";
  const container = await withTimeout(
    LoadAssetContainerAsync(new Uint8Array(buffer), scene, {
      pluginExtension: ".glb",
      name: fileName,
    }),
    timeoutMs,
    `Parse ${fileName}`
  );
  for (const mat of container.materials) {
    upgradeMaterialTexturesForAR(mat, scene);
  }
  return container;
}

async function parseOne(modelUrl: string, timeoutMs: number): Promise<void> {
  const key = absoluteModelUrl(modelUrl);
  const targetScene = sceneForOfflineParse();
  const existing = offlineContainers.get(key);
  if (existing) {
    if (existing.scene === targetScene) return;
    try {
      existing.dispose();
    } catch {
      /* stale container from offscreen home parse */
    }
    offlineContainers.delete(key);
    footprintCache.delete(key);
  }

  const container = await loadContainerOnScene(modelUrl, targetScene, timeoutMs);
  offlineContainers.set(key, container);
  cacheFootprint(modelUrl, container);
}

/** Load (or reuse) AssetContainer on the live AR scene for placement. */
export async function ensureArContainer(
  modelUrl: string,
  timeoutMs = 45000
): Promise<AssetContainer> {
  const key = absoluteModelUrl(modelUrl);
  const existing = arContainers.get(key);
  if (existing) {
    cacheFootprint(modelUrl, existing);
    return existing;
  }

  if (!boundScene) {
    throw new Error("GLB cache scene not bound — call bindGlbCacheScene first");
  }

  // Yield one frame so WebXR rAF can run before heavy GLB decode on the live AR scene.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const container = await loadContainerOnScene(modelUrl, boundScene, timeoutMs);
  arContainers.set(key, container);
  cacheFootprint(modelUrl, container);
  return container;
}

export type GlbParseProgress = (
  current: number,
  total: number,
  url: string
) => void;

/**
 * Parse GLBs one at a time. During WebXR, uses an offscreen engine when isolatedParse is set.
 * Parallel LoadAssetContainerAsync on a single Scene deadlocks — do not use Promise.all.
 */
export async function parseGlbsSequential(
  urls: string[],
  options?: { timeoutMs?: number; onProgress?: GlbParseProgress }
): Promise<{ warmed: string[]; failed: { url: string; error: string }[] }> {
  const unique = [...new Set(urls)];
  const timeoutMs = options?.timeoutMs ?? 45000;
  const warmed: string[] = [];
  const failed: { url: string; error: string }[] = [];

  for (let i = 0; i < unique.length; i++) {
    const url = unique[i]!;
    options?.onProgress?.(i + 1, unique.length, url);
    try {
      await parseOne(url, timeoutMs);
      warmed.push(url);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (e) {
      failed.push({
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  lastParseResult = { warmed, failed };
  return lastParseResult;
}

/** @deprecated Use parseGlbsSequential — parallel parse on one scene hangs indefinitely. */
export const parseGlbsParallel = parseGlbsSequential;

export function getOfflineParseResult(): {
  warmed: string[];
  failed: { url: string; error: string }[];
} {
  return lastParseResult;
}

export function isGlbParsed(modelUrl: string): boolean {
  return offlineContainers.has(absoluteModelUrl(modelUrl));
}

export async function ensureGlbParsed(modelUrl: string, timeoutMs = 45000): Promise<void> {
  if (isGlbParsed(modelUrl)) return;
  await parseOne(modelUrl, timeoutMs);
}

/** Offline validation + AR-scene container when using isolated parse during WebXR. */
export async function ensureGlbReadyForPlacement(
  modelUrl: string,
  timeoutMs = 45000
): Promise<void> {
  await ensureGlbParsed(modelUrl, timeoutMs);
  if (isolatedParse) {
    await ensureArContainer(modelUrl, timeoutMs);
  }
}

export type GlbPlaceResult = {
  meshes: AbstractMesh[];
  loadMethod: string;
  transformNodeCount: number;
  topLevelRoots: number;
  fetchBytes: number;
  /** Max X/Z footprint in meters (for shadow receiver sizing). */
  footprintM: number;
};

/** Blob shadow, dimension tubes, and billboard labels must never affect floor snap or bounds. */
export function isPlacementFxMesh(mesh: AbstractMesh): boolean {
  return (
    /blob-shadow|dim-root|dim-w|dim-d|dim-h|dim-.*-lbl/i.test(mesh.name) ||
    mesh.getClassName() === "LinesMesh"
  );
}

/** True when a mesh contributes visible geometry (glTF __root__ shells often report 0 verts). */
export function meshHasGeometry(mesh: AbstractMesh): boolean {
  if ((mesh.getTotalVertices?.() ?? 0) > 0) return true;
  if (/camera|light/i.test(mesh.name)) return false;
  mesh.computeWorldMatrix(true);
  try {
    const bounds = mesh.getHierarchyBoundingVectors(true);
    const size = bounds.max.subtract(bounds.min);
    if (Math.max(size.x, size.y, size.z) > 0.001) return true;
  } catch {
    /* hierarchy bounds unavailable */
  }
  return Boolean(mesh.material);
}

export function collectGeometryMeshes(root: TransformNode): AbstractMesh[] {
  root.computeWorldMatrix(true);
  // Descendants (not direct-only): glTF puts geometry under __root__.
  const fromWrapper = root
    .getChildMeshes(false)
    .filter((m) => !/camera|light/i.test(m.name) && !isPlacementFxMesh(m));
  if (fromWrapper.length) {
    const geo = fromWrapper.filter((mesh) => meshHasGeometry(mesh));
    return geo.length ? geo : fromWrapper;
  }
  return gatherMeshesUnder(root.getChildren()).filter((m) => !isPlacementFxMesh(m));
}

export type GeometryWorldBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

const MIN_GEOMETRY_EXTENT_M = 0.01;

function geometryExtentM(bounds: GeometryWorldBounds): number {
  return Math.max(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z
  );
}

/** Union bounds of visible geometry meshes (ignores empty glTF root shells). */
export function geometryWorldBounds(root: TransformNode): GeometryWorldBounds | null {
  const meshes = collectGeometryMeshes(root);
  if (!meshes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true, false);
    const info = mesh.getBoundingInfo();
    if (info) {
      const mn = info.boundingBox.minimumWorld;
      const mx = info.boundingBox.maximumWorld;
      minX = Math.min(minX, mn.x);
      minY = Math.min(minY, mn.y);
      minZ = Math.min(minZ, mn.z);
      maxX = Math.max(maxX, mx.x);
      maxY = Math.max(maxY, mx.y);
      maxZ = Math.max(maxZ, mx.z);
      continue;
    }
    try {
      const b = mesh.getHierarchyBoundingVectors(true);
      minX = Math.min(minX, b.min.x);
      minY = Math.min(minY, b.min.y);
      minZ = Math.min(minZ, b.min.z);
      maxX = Math.max(maxX, b.max.x);
      maxY = Math.max(maxY, b.max.y);
      maxZ = Math.max(maxZ, b.max.z);
    } catch {
      /* skip mesh */
    }
  }
  if (!Number.isFinite(minY)) return null;
  const bounds: GeometryWorldBounds = {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
  if (geometryExtentM(bounds) < MIN_GEOMETRY_EXTENT_M) return null;
  return bounds;
}

const _vertexWorldScratch = new Vector3();

/** Visible render meshes — ignores tiny glTF helper/collision shells. */
function significantGeometryMeshes(
  root: TransformNode,
  modelMeshes?: AbstractMesh[]
): AbstractMesh[] {
  const meshes = modelMeshes?.length
    ? modelMeshes.filter((m) => !isPlacementFxMesh(m))
    : collectGeometryMeshes(root).filter((m) => !isPlacementFxMesh(m));
  const footprints = meshes
    .filter((mesh) => meshHasGeometry(mesh))
    .map((mesh) => ({ mesh, footprint: meshWorldFootprintM2(mesh) }))
    .filter((entry) => entry.footprint >= 0.001);
  if (!footprints.length) return [];
  const largest = footprints.reduce((a, b) => (b.footprint > a.footprint ? b : a));
  const minFootprint = largest.footprint * 0.15;
  return footprints
    .filter((entry) => entry.footprint >= minFootprint)
    .map((entry) => entry.mesh);
}

/** Union bounds of significant visible meshes — excludes collider/helper shells. */
export function significantGeometryWorldBounds(
  root: TransformNode,
  modelMeshes?: AbstractMesh[]
): GeometryWorldBounds | null {
  const meshes = significantGeometryMeshes(root, modelMeshes);
  if (!meshes.length) return null;
  return geometryWorldBoundsFromMeshes(meshes);
}

function geometryWorldBoundsFromMeshes(meshes: AbstractMesh[]): GeometryWorldBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true, false);
    const info = mesh.getBoundingInfo();
    if (info) {
      const mn = info.boundingBox.minimumWorld;
      const mx = info.boundingBox.maximumWorld;
      minX = Math.min(minX, mn.x);
      minY = Math.min(minY, mn.y);
      minZ = Math.min(minZ, mn.z);
      maxX = Math.max(maxX, mx.x);
      maxY = Math.max(maxY, mx.y);
      maxZ = Math.max(maxZ, mx.z);
      continue;
    }
    try {
      const b = mesh.getHierarchyBoundingVectors(true);
      minX = Math.min(minX, b.min.x);
      minY = Math.min(minY, b.min.y);
      minZ = Math.min(minZ, b.min.z);
      maxX = Math.max(maxX, b.max.x);
      maxY = Math.max(maxY, b.max.y);
      maxZ = Math.max(maxZ, b.max.z);
    } catch {
      /* skip mesh */
    }
  }
  if (!Number.isFinite(minY)) return null;
  const bounds: GeometryWorldBounds = {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
  if (geometryExtentM(bounds) < MIN_GEOMETRY_EXTENT_M) return null;
  return bounds;
}

/** Lowest world Y from mesh vertices on significant footprint meshes only. */
export function geometryLowestVertexWorldY(
  root: TransformNode,
  modelMeshes?: AbstractMesh[]
): number | null {
  const meshes = modelMeshes?.length
    ? modelMeshes.filter((m) => !isPlacementFxMesh(m))
    : collectGeometryMeshes(root);
  if (!meshes.length) return null;

  const footprints = meshes
    .filter((mesh) => meshHasGeometry(mesh))
    .map((mesh) => ({ mesh, footprint: meshWorldFootprintM2(mesh) }))
    .filter((entry) => entry.footprint >= 0.001);
  if (!footprints.length) return null;
  const largest = footprints.reduce((a, b) => (b.footprint > a.footprint ? b : a));
  const minFootprint = largest.footprint * 0.15;

  let minY = Infinity;
  for (const { mesh, footprint } of footprints) {
    if (footprint < minFootprint) continue;
    mesh.computeWorldMatrix(true);
    let positions =
      mesh.getVerticesData(VertexBuffer.PositionKind) ??
      mesh.geometry?.getVerticesData(VertexBuffer.PositionKind);
    if (!positions?.length) {
      mesh.refreshBoundingInfo(false, true);
      positions =
        mesh.getVerticesData(VertexBuffer.PositionKind) ??
        mesh.geometry?.getVerticesData(VertexBuffer.PositionKind);
    }
    if (!positions?.length) continue;
    const worldMatrix = mesh.getWorldMatrix();
    for (let i = 0; i < positions.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(
        positions[i]!,
        positions[i + 1]!,
        positions[i + 2]!,
        worldMatrix,
        _vertexWorldScratch
      );
      minY = Math.min(minY, _vertexWorldScratch.y);
    }
  }
  return Number.isFinite(minY) ? minY : null;
}

function meshWorldFootprintM2(mesh: AbstractMesh): number {
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo(true, false);
  const info = mesh.getBoundingInfo();
  if (info) {
    const mn = info.boundingBox.minimumWorld;
    const mx = info.boundingBox.maximumWorld;
    const footprint = Math.max(0, mx.x - mn.x) * Math.max(0, mx.z - mn.z);
    if (footprint >= 0.001) return footprint;
  }
  try {
    const b = mesh.getHierarchyBoundingVectors(true);
    return Math.max(0, b.max.x - b.min.x) * Math.max(0, b.max.z - b.min.z);
  } catch {
    return 0;
  }
}

function meshContactMinY(mesh: AbstractMesh): number | null {
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo(true, false);
  const info = mesh.getBoundingInfo();
  if (info) {
    const mn = info.boundingBox.minimumWorld.y;
    if (Number.isFinite(mn)) return mn;
  }
  try {
    return mesh.getHierarchyBoundingVectors(true).min.y;
  } catch {
    return null;
  }
}

/** Bbox min Y of visible meshes — ignores tiny glTF helper/collision shells. */
export function primaryMeshFloorContactY(root: TransformNode): number | null {
  const meshes = collectGeometryMeshes(root);
  if (!meshes.length) return null;
  const candidates: { footprint: number; minY: number }[] = [];
  for (const mesh of meshes) {
    if (!meshHasGeometry(mesh)) continue;
    const footprint = meshWorldFootprintM2(mesh);
    const minY = meshContactMinY(mesh);
    if (minY === null || footprint < 0.001) continue;
    candidates.push({ footprint, minY });
  }
  if (!candidates.length) return null;
  const largest = candidates.reduce((a, b) => (b.footprint > a.footprint ? b : a));
  const minFootprint = largest.footprint * 0.15;
  let contactY: number | null = null;
  for (const { footprint, minY } of candidates) {
    if (footprint < minFootprint) continue;
    // Lowest minY among significant meshes = true floor contact (Math.max caused hover).
    contactY = contactY === null ? minY : Math.min(contactY, minY);
  }
  return contactY ?? largest.minY;
}

export type FloorContactDiagnostics = {
  contactY: number;
  source: "vertex" | "primary-mesh" | "union-bbox" | "hierarchy";
  vertexMinY: number | null;
  primaryMeshMinY: number | null;
  unionBboxMinY: number | null;
};

/**
 * When vertex min is this far below the visible primary mesh bbox, snap the visible base
 * to the floor — not invisible collision/collider verts (Bar-Chair ~2.9 cm, session 1780829599377).
 * glTF often ships OMI_collider-style hulls below the render mesh; AR placement must follow visuals.
 */
export const FURNITURE_VERTEX_PRIMARY_DIVERGE_M = 0.018;

/** Pick the lowest plausible floor contact among vertex / union / per-mesh probes. */
export function resolveFloorContactY(
  vertexMinY: number | null,
  primaryMeshMinY: number | null,
  unionBboxMinY: number | null,
  hierarchyMinY: number
): { contactY: number; source: FloorContactDiagnostics["source"] } {
  type Candidate = { y: number; source: FloorContactDiagnostics["source"] };
  const candidates: Candidate[] = [];
  if (vertexMinY !== null) candidates.push({ y: vertexMinY, source: "vertex" });
  if (unionBboxMinY !== null) candidates.push({ y: unionBboxMinY, source: "union-bbox" });
  if (primaryMeshMinY !== null) candidates.push({ y: primaryMeshMinY, source: "primary-mesh" });
  if (!candidates.length) {
    return { contactY: hierarchyMinY, source: "hierarchy" };
  }
  const best = candidates.reduce((a, b) => (b.y < a.y ? b : a));
  return { contactY: best.y, source: best.source };
}

/** Floor snap contact — visible primary mesh when collision verts sit below the render mesh. */
export function snapFloorContactY(
  vertexMinY: number | null,
  primaryMeshMinY: number | null,
  unionBboxMinY: number | null,
  hierarchyMinY: number
): { contactY: number; source: FloorContactDiagnostics["source"] } {
  if (
    primaryMeshMinY !== null &&
    vertexMinY !== null &&
    primaryMeshMinY - vertexMinY > FURNITURE_VERTEX_PRIMARY_DIVERGE_M
  ) {
    return { contactY: primaryMeshMinY, source: "primary-mesh" };
  }
  return resolveFloorContactY(
    vertexMinY,
    primaryMeshMinY,
    unionBboxMinY,
    hierarchyMinY
  );
}

export function floorContactDiagnostics(
  wrapper: TransformNode,
  modelMeshes?: AbstractMesh[]
): FloorContactDiagnostics {
  wrapper.computeWorldMatrix(true);
  const vertexMinY = geometryLowestVertexWorldY(wrapper, modelMeshes);
  const primaryMeshMinY = primaryMeshFloorContactY(wrapper);
  const unionBboxMinY = geometryBoundsMinY(wrapper);
  const hierarchyMinY = wrapper.getHierarchyBoundingVectors(true).min.y;
  const resolved = snapFloorContactY(
    vertexMinY,
    primaryMeshMinY,
    unionBboxMinY,
    hierarchyMinY
  );
  return {
    contactY: resolved.contactY,
    source: resolved.source,
    vertexMinY,
    primaryMeshMinY,
    unionBboxMinY,
  };
}

/** Floor contact Y for snap — vertices, else lowest union / mesh bbox, else hierarchy min Y. */
export function placementFloorContactY(
  wrapper: TransformNode,
  modelMeshes?: AbstractMesh[]
): number {
  return floorContactDiagnostics(wrapper, modelMeshes).contactY;
}

/** Lift placement so visible geometry sits on the hit-test floor (meters). */
export function snapPlacementBaseToFloor(
  wrapper: TransformNode,
  floorY: number,
  modelMeshes?: AbstractMesh[]
): number {
  wrapper.computeWorldMatrix(true);
  for (const mesh of modelMeshes?.length
    ? modelMeshes.filter((m) => !isPlacementFxMesh(m))
    : collectGeometryMeshes(wrapper)) {
    mesh.refreshBoundingInfo(false, true);
  }
  wrapper.computeWorldMatrix(true);
  let totalLift = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const boundsMinY = placementFloorContactY(wrapper, modelMeshes);
    const lift = floorY - boundsMinY;
    if (Math.abs(lift) < 1e-6) break;
    wrapper.position.y += lift;
    totalLift += lift;
    wrapper.computeWorldMatrix(true);
    for (const mesh of modelMeshes?.length
      ? modelMeshes.filter((m) => !isPlacementFxMesh(m))
      : collectGeometryMeshes(wrapper)) {
      mesh.refreshBoundingInfo(false, true);
    }
  }
  return totalLift;
}

/** Lowest world Y among visible geometry meshes (ignores empty glTF root shells). */
export function geometryBoundsMinY(root: TransformNode): number | null {
  return geometryWorldBounds(root)?.min.y ?? null;
}

function gatherMeshesUnder(nodes: readonly Node[]): AbstractMesh[] {
  const out: AbstractMesh[] = [];
  const walk = (node: Node) => {
    if (/camera|light/i.test(node.name)) return;
    if (node instanceof AbstractMesh) out.push(node);
    for (const child of node.getChildren()) walk(child);
  };
  for (const node of nodes) walk(node);
  return out;
}

const SKIP_ROOT_NAME = /camera|light/i;

/** Copy glTF materials from parsed container meshes onto instantiated clones. */
function syncMaterialsFromContainer(
  container: AssetContainer,
  instanceMeshes: AbstractMesh[]
): void {
  const sources = container.meshes.filter(
    (m) =>
      !SKIP_ROOT_NAME.test(m.name) &&
      m.name !== "__root__" &&
      m.material &&
      meshHasGeometry(m)
  );
  const sharedMat =
    sources.find((m) => m.material)?.material ?? container.materials[0] ?? null;
  if (!sharedMat && !sources.length) return;

  const multiMaterial = container.materials.length > 1;
  // Only sync onto geometry meshes — never paint empty __root__ shells.
  const targets = instanceMeshes.filter(
    (m) => m.name !== "__root__" && !m.name.endsWith("-__root__") && meshHasGeometry(m)
  );
  if (!targets.length) return;

  if (multiMaterial && sources.length === 1) {
    const srcMat = sources[0]!.material ?? sharedMat;
    for (const mesh of targets) {
      mesh.material = srcMat;
      mesh.markAsDirty();
    }
    return;
  }

  if (!multiMaterial && sources.length <= 1 && sharedMat) {
    for (const mesh of targets) {
      mesh.material = sharedMat;
      mesh.markAsDirty();
    }
    return;
  }

  for (let i = 0; i < targets.length; i++) {
    const mesh = targets[i]!;
    const baseName = mesh.name.replace(/^(?:src-\d+-|preview-|inst-)/, "");
    const source =
      sources.find((s) => s.name === baseName) ??
      sources.find((s) => baseName === s.name || baseName.startsWith(`${s.name}_`)) ??
      sources[i] ??
      sources[0];
    if (!source?.material) continue;
    mesh.material = source.material;
    mesh.markAsDirty();
  }
}

function footprintMeters(wrapper: TransformNode): number {
  wrapper.computeWorldMatrix(true);
  const bounds = wrapper.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  return Math.max(size.x, size.z, 0.35);
}

function footprintFromContainer(container: AssetContainer): number {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const root of container.rootNodes) {
    root.computeWorldMatrix(true);
    const bounds = root.getHierarchyBoundingVectors(true);
    minX = Math.min(minX, bounds.min.x);
    minY = Math.min(minY, bounds.min.y);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxY = Math.max(maxY, bounds.max.y);
    maxZ = Math.max(maxZ, bounds.max.z);
  }
  if (!Number.isFinite(minX)) return 0.52;
  const sizeX = maxX - minX;
  const sizeZ = maxZ - minZ;
  return Math.max(sizeX, sizeZ, 0.35);
}

function cacheFootprint(modelUrl: string, container: AssetContainer): void {
  const key = absoluteModelUrl(modelUrl);
  if (footprintCache.has(key)) return;
  footprintCache.set(key, footprintFromContainer(container));
}

export function getCachedFootprintM(modelUrl: string): number | null {
  const key = absoluteModelUrl(modelUrl);
  return footprintCache.get(key) ?? null;
}

function containerForPlacement(modelUrl: string): AssetContainer | undefined {
  const key = absoluteModelUrl(modelUrl);
  if (isolatedParse) {
    return arContainers.get(key);
  }
  return offlineContainers.get(key);
}

export function getContainerForUrl(modelUrl: string): AssetContainer | undefined {
  return containerForPlacement(modelUrl);
}

export function getPreviewContainerForUrl(modelUrl: string): AssetContainer | undefined {
  return previewContainers.get(absoluteModelUrl(modelUrl));
}

export function getOfflineContainerForUrl(modelUrl: string): AssetContainer | undefined {
  return offlineContainers.get(absoluteModelUrl(modelUrl));
}

/** Clone offline-parsed meshes onto the preview WebGL scene — avoids a second GLB decode during WebXR. */
export function instantiatePreviewFromOffline(
  offline: AssetContainer,
  previewScene: Scene
): TransformNode[] {
  const roots: TransformNode[] = [];
  for (const root of offline.rootNodes) {
    if (SKIP_ROOT_NAME.test(root.name)) continue;
    const clone = (root as TransformNode).clone(`preview-${root.name}`, null, true);
    if (!clone) continue;
    previewScene.addTransformNode(clone);
    roots.push(clone);
  }
  if (!roots.length) {
    throw new Error("GLB had no meshes for 3D preview.");
  }
  let meshes = gatherMeshesUnder(roots);
  if (!meshes.length) {
    meshes = roots
      .filter((n): n is AbstractMesh => n instanceof AbstractMesh)
      .filter((m) => !SKIP_ROOT_NAME.test(m.name));
  }
  syncMaterialsFromContainer(offline, meshes);
  return roots;
}

export function isPreviewContainerReady(modelUrl: string, scene?: Scene | null): boolean {
  const container = getPreviewContainerForUrl(modelUrl);
  if (!container) return false;
  if (scene && container.scene !== scene) return false;
  return true;
}

function hidePreviewContainerTemplates(container: AssetContainer): void {
  for (const mesh of container.meshes) {
    if (mesh.name.startsWith("preview-")) continue;
    // Visibility only — setEnabled(false) is copied to instantiateModelsToScene clones.
    mesh.isVisible = false;
  }
}

function enablePreviewInstances(rootNodes: TransformNode[]): void {
  for (const root of rootNodes) {
    root.setEnabled(true);
    if (root instanceof AbstractMesh) {
      root.isVisible = true;
    }
    for (const mesh of root.getChildMeshes(false)) {
      mesh.setEnabled(true);
      mesh.isVisible = true;
    }
  }
}

/** Parse once on the preview scene; subsequent 3D toggles only instantiate. */
export async function ensurePreviewContainer(
  modelUrl: string,
  previewScene: Scene,
  timeoutMs = 20000
): Promise<AssetContainer> {
  const key = absoluteModelUrl(modelUrl);
  const existing = previewContainers.get(key);
  if (existing && existing.scene === previewScene) {
    hidePreviewContainerTemplates(existing);
    return existing;
  }
  if (existing) {
    try {
      existing.dispose();
    } catch {
      /* stale preview scene */
    }
    previewContainers.delete(key);
  }
  await ensureGlbParsed(modelUrl, timeoutMs);
  const container = await loadContainerOnScene(modelUrl, previewScene, timeoutMs);
  hidePreviewContainerTemplates(container);
  previewContainers.set(key, container);
  return container;
}

export function instantiatePreviewFromContainer(
  container: AssetContainer
): TransformNode[] {
  const instance = container.instantiateModelsToScene((name) => `preview-${name}`, true);
  if (!instance.rootNodes.length) {
    throw new Error("GLB had no meshes for 3D preview.");
  }
  const roots = instance.rootNodes as TransformNode[];
  enablePreviewInstances(roots);
  let meshes = gatherMeshesUnder(roots);
  if (!meshes.length) {
    meshes = instance.rootNodes
      .filter((n): n is AbstractMesh => n instanceof AbstractMesh)
      .filter((m) => !SKIP_ROOT_NAME.test(m.name));
  }
  syncMaterialsFromContainer(container, meshes);
  const fallbackMat =
    container.materials.find((m) => m.getClassName() === "PBRMaterial") ??
    container.materials[0];
  if (fallbackMat) {
    for (const mesh of meshes) {
      if (!mesh.material) {
        mesh.material = fallbackMat;
        mesh.markAsDirty();
      }
    }
  }
  return roots;
}

export function disposePreviewContainers(): void {
  for (const c of previewContainers.values()) {
    try {
      c.dispose();
    } catch {
      /* already disposed */
    }
  }
  previewContainers.clear();
}

/** Instantiate a parsed model from the scene cache onto a placement wrapper. */
export function placeGlbFromSceneCache(
  wrapper: TransformNode,
  modelUrl: string,
  markerId: number
): GlbPlaceResult {
  const container = containerForPlacement(modelUrl);
  if (!container) {
    throw new Error("Model not parsed.");
  }

  const buffer = getCachedGlb(modelUrl);
  const instance = container.instantiateModelsToScene(
    (name) => `src-${markerId}-${name}`,
    true
  );

  for (const root of instance.rootNodes) {
    root.parent = wrapper;
  }

  let meshes = gatherMeshesUnder(instance.rootNodes);
  if (!meshes.length) {
    meshes = collectGeometryMeshes(wrapper);
  }
  if (!meshes.length) {
    throw new Error("GLB had no meshes after instantiate.");
  }

  for (const root of instance.rootNodes) {
    if (SKIP_ROOT_NAME.test(root.name)) {
      root.setEnabled(false);
      continue;
    }
    const tn = root as TransformNode;
    if (tn.rotationQuaternion) {
      tn.rotationQuaternion.copyFrom(Quaternion.Identity());
    } else if (tn.rotation) {
      tn.rotation.set(0, 0, 0);
    }
  }

  wrapper.computeWorldMatrix(true);
  syncMaterialsFromContainer(container, meshes);

  for (const mesh of meshes) {
    mesh.refreshBoundingInfo(true, false);
  }
  wrapper.computeWorldMatrix(true);

  const fallbackMat =
    container.materials.find((m) => m.getClassName() === "PBRMaterial") ??
    container.materials[0];
  if (fallbackMat) {
    for (const mesh of meshes) {
      if (!mesh.material) {
        mesh.material = fallbackMat;
        mesh.markAsDirty();
      }
    }
  }

  return {
    meshes,
    loadMethod: "scene-instantiate",
    transformNodeCount: instance.rootNodes.length,
    topLevelRoots: instance.rootNodes.length,
    fetchBytes: buffer?.byteLength ?? 0,
    footprintM: footprintMeters(wrapper),
  };
}

/** @deprecated Prefer placeGlbFromSceneCache when scene is already bound. */
export async function placeGlbFromOfflineCache(
  targetScene: Scene,
  wrapper: TransformNode,
  modelUrl: string,
  markerId: number
): Promise<GlbPlaceResult> {
  if (!boundScene) {
    bindGlbCacheScene(targetScene);
  } else if (boundScene !== targetScene) {
    throw new Error("GLB cache bound to a different scene.");
  }
  await ensureGlbReadyForPlacement(modelUrl);
  return placeGlbFromSceneCache(wrapper, modelUrl, markerId);
}

export function disposeOfflineCache(): void {
  for (const c of offlineContainers.values()) c.dispose();
  for (const c of arContainers.values()) c.dispose();
  disposePreviewContainers();
  offlineContainers.clear();
  arContainers.clear();
  footprintCache.clear();
  lastParseResult = { warmed: [], failed: [] };
  boundScene = null;
  isolatedParse = false;
  if (parseScene) {
    parseScene.dispose();
    parseScene = null;
  }
  if (parseEngine) {
    parseEngine.dispose();
    parseEngine = null;
  }
}
