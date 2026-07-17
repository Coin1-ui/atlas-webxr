import type { TransformNode, AbstractMesh, AssetContainer } from "@babylonjs/core";
import { getContainerForUrl } from "./glb-offline-cache";

/** Minimum correction before applying (avoids micro-adjust noise). */
export const AR_SCALE_APPLY_MIN_DELTA = 0.08;

/** Safe bounds for uniform catalog scale correction. */
export const AR_SCALE_FACTOR_MIN = 0.5;
export const AR_SCALE_FACTOR_MAX = 2.5;

export type RealWorldScaleSpec = {
  /** Direct uniform multiplier when export scale is uniformly wrong. */
  scaleFactor?: number;
  /** Target outer width (X) in meters (glTF/WebXR: 1 unit = 1 meter). */
  widthM?: number;
  /** Target outer depth (Z) in meters. */
  depthM?: number;
  /** Target outer height (Y) in meters. */
  heightM?: number;
};

export type ModelBoundsM = {
  widthM: number;
  depthM: number;
  heightM: number;
};

export type ArScaleVector = {
  x: number;
  y: number;
  z: number;
};

export type ArScaleResolution = {
  /** Max axis scale — telemetry / footprint multiplier. */
  factor: number;
  scale: ArScaleVector;
  reason: string;
  measured: ModelBoundsM;
  target?: Partial<RealWorldScaleSpec>;
};

/**
 * Optional per-model runtime scale overrides (normally empty).
 * glTF 2.0: 1 unit = 1 meter — scale belongs in the asset export, not at AR runtime.
 * Set realWorld on a catalog manifest entry only when a specific asset cannot be re-exported.
 */
export const MODEL_REAL_WORLD_DEFAULTS: Record<string, RealWorldScaleSpec> = {};

function boundsFromContainer(container: AssetContainer): ModelBoundsM | null {
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
  if (!Number.isFinite(minX)) return null;
  return {
    widthM: maxX - minX,
    depthM: maxZ - minZ,
    heightM: maxY - minY,
  };
}

export function measuredBoundsFromModelUrl(modelUrl: string): ModelBoundsM | null {
  const container = getContainerForUrl(modelUrl);
  if (!container) return null;
  return boundsFromContainer(container);
}

export function mergeRealWorldScaleSpec(
  _modelId: string | undefined,
  catalog?: RealWorldScaleSpec | null
): RealWorldScaleSpec | null {
  if (!catalog) return null;
  return { ...catalog };
}

function clampScaleFactor(f: number): number {
  return Math.min(AR_SCALE_FACTOR_MAX, Math.max(AR_SCALE_FACTOR_MIN, f));
}

function closeEnough(f: number): boolean {
  return Math.abs(f - 1) < AR_SCALE_APPLY_MIN_DELTA;
}

function scaleNeedsCorrection(scale: ArScaleVector): boolean {
  return !closeEnough(scale.x) || !closeEnough(scale.y) || !closeEnough(scale.z);
}

function maxScaleComponent(scale: ArScaleVector): number {
  return Math.max(scale.x, scale.y, scale.z);
}

/**
 * Resolve per-axis AR scale from catalog metadata and measured GLB bounds.
 * Width-only targets scale X+Z (footprint) without stretching height (sofa).
 * Height-only targets scale uniformly for proportional seating (chair).
 * Returns null when no correction is needed or bounds are unavailable.
 */
export function resolveRealWorldScaleFactor(
  modelId: string | undefined,
  measured: ModelBoundsM,
  catalog?: RealWorldScaleSpec | null
): ArScaleResolution | null {
  const spec = mergeRealWorldScaleSpec(modelId, catalog);
  if (!spec) return null;

  if (
    spec.scaleFactor != null &&
    Number.isFinite(spec.scaleFactor) &&
    spec.scaleFactor > 0
  ) {
    const factor = clampScaleFactor(spec.scaleFactor);
    if (closeEnough(factor)) return null;
    const scale = { x: factor, y: factor, z: factor };
    return {
      factor,
      scale,
      reason: "catalog-scaleFactor",
      measured,
      target: spec,
    };
  }

  const preferWidth = /sofa|table|desk|bed/i.test(modelId ?? "");
  const preferHeight = /chair|stool|seat/i.test(modelId ?? "");

  let scaleX = 1;
  let scaleY = 1;
  let scaleZ = 1;
  let reason = "catalog-dimension";

  if (spec.widthM != null && measured.widthM > 0.01) {
    scaleX = clampScaleFactor(spec.widthM / measured.widthM);
    scaleZ = scaleX;
    reason = "catalog-widthM";
  }
  if (spec.depthM != null && measured.depthM > 0.01) {
    scaleZ = clampScaleFactor(spec.depthM / measured.depthM);
    if (reason === "catalog-dimension") reason = "catalog-depthM";
  }
  if (spec.heightM != null && measured.heightM > 0.01) {
    scaleY = clampScaleFactor(spec.heightM / measured.heightM);
    if (reason === "catalog-dimension") reason = "catalog-heightM";
  }

  // Seating: height correction scales the whole piece proportionally.
  if (preferHeight && spec.heightM != null && !spec.widthM && !spec.depthM) {
    scaleX = scaleY;
    scaleZ = scaleY;
    reason = "catalog-heightM";
  }

  const scale = { x: scaleX, y: scaleY, z: scaleZ };
  if (!scaleNeedsCorrection(scale)) return null;

  if (preferWidth && spec.widthM != null) reason = "catalog-widthM";
  if (preferHeight && spec.heightM != null && !spec.widthM) reason = "catalog-heightM";

  return {
    factor: maxScaleComponent(scale),
    scale,
    reason,
    measured,
    target: spec,
  };
}

export function measuredBoundsFromWrapper(
  wrapper: TransformNode,
  meshes?: AbstractMesh[]
): ModelBoundsM {
  wrapper.computeWorldMatrix(true);
  const bounds = wrapper.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  if (meshes?.length) {
    let minY = Infinity;
    for (const mesh of meshes) {
      if (!mesh.getBoundingInfo) continue;
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo(true, false);
      minY = Math.min(minY, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
    }
    if (Number.isFinite(minY)) {
      return {
        widthM: size.x,
        depthM: size.z,
        heightM: bounds.max.y - minY,
      };
    }
  }
  return { widthM: size.x, depthM: size.z, heightM: size.y };
}

/** Apply catalog scale on the placement wrapper (floor snap runs after). */
export function applyRealWorldScaleToWrapper(
  wrapper: TransformNode,
  scale: ArScaleVector | number
): void {
  const next =
    typeof scale === "number"
      ? { x: scale, y: scale, z: scale }
      : { x: scale.x, y: scale.y, z: scale.z };
  if (
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y) ||
    !Number.isFinite(next.z) ||
    !scaleNeedsCorrection(next)
  ) {
    return;
  }
  wrapper.scaling.set(next.x, next.y, next.z);
  wrapper.computeWorldMatrix(true);
}

export function scaledFootprintM(
  rawFootprintM: number,
  modelId: string | undefined,
  modelUrl: string,
  catalog?: RealWorldScaleSpec | null
): number {
  const measured =
    measuredBoundsFromModelUrl(modelUrl) ??
    ({
      widthM: rawFootprintM,
      depthM: rawFootprintM,
      heightM: rawFootprintM,
    } satisfies ModelBoundsM);
  const resolved = resolveRealWorldScaleFactor(modelId, measured, catalog);
  if (!resolved) return rawFootprintM;
  return rawFootprintM * resolved.factor;
}

export function resolveAndApplyRealWorldScale(
  wrapper: TransformNode,
  modelId: string | undefined,
  meshes: AbstractMesh[],
  catalog?: RealWorldScaleSpec | null
): ArScaleResolution | null {
  const measured = measuredBoundsFromWrapper(wrapper, meshes);
  const resolved = resolveRealWorldScaleFactor(modelId, measured, catalog);
  if (!resolved) return null;
  applyRealWorldScaleToWrapper(wrapper, resolved.scale);
  return resolved;
}
