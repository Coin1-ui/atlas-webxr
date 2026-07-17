import {
  AbstractMesh,
  Color3,
  Constants,
  DynamicTexture,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  collectGeometryMeshes,
  geometryWorldBounds,
  isPlacementFxMesh,
  significantGeometryWorldBounds,
  type GeometryWorldBounds,
} from "../shared/glb-offline-cache";

const BLOB_SHADOW_Y_OFFSET_M = 0.003;
const DIM_LINE_COLOR = new Color3(0.35, 0.98, 1);
const DIM_LABEL_BG = "rgba(10, 22, 40, 0.95)";
const DIM_LABEL_FG = "#ffffff";
/** Renders after placed content (group 0); depth cleared before this group in AR session. */
export const AR_DIMENSION_OVERLAY_RENDERING_GROUP = 1;
/** Floor reticle / scan ring — depth cleared before this group in AR session. */
export const AR_FLOOR_SCAN_RENDERING_GROUP = 2;

function configureDimensionOverlayMaterial(mat: StandardMaterial): void {
  mat.disableDepthWrite = true;
  mat.depthFunction = Constants.ALWAYS;
  mat.zOffset = -12;
  mat.alpha = 1;
}

type SceneWithOverlaySetup = Scene & { __atlasOverlayGroups?: boolean };

/** Clear depth before overlay groups so dimension lines / reticle draw above placed models. */
export function setupArOverlayRenderingGroups(scene: Scene): void {
  const tagged = scene as SceneWithOverlaySetup;
  if (tagged.__atlasOverlayGroups) return;
  tagged.__atlasOverlayGroups = true;
  scene.onBeforeRenderingGroupObservable.add((groupInfo) => {
    const groupId =
      typeof groupInfo === "number"
        ? groupInfo
        : (groupInfo as { renderingGroupId?: number }).renderingGroupId ?? -1;
    if (
      groupId === AR_DIMENSION_OVERLAY_RENDERING_GROUP ||
      groupId === AR_FLOOR_SCAN_RENDERING_GROUP
    ) {
      scene.getEngine().clear(null, false, true, false);
    }
  });
}

/** Visible tube radius for extension lines (meters) — mobile WebGL ignores line width. */
const DIM_LABEL_OUTSET_MIN_M = 0.085;
/** Vertical lift so billboard labels sit above extension tubes, not on them. */
const DIM_LABEL_ABOVE_LINE_M = 0.038;
/** Extra push beyond the tube on each axis (meters). */
const DIM_LABEL_AXIS_BUMP_M = 0.045;
/** Extra clearance for depth labels (user: keep D away from tubes). */
const DIM_LABEL_DEPTH_EXTRA_M = 0.1;
/** Height label offset — closer to the vertical tube than D (user: H nearer the line). */
const DIM_LABEL_HEIGHT_EXTRA_M = 0.045;

export type PlacedDimensionsM = {
  widthM: number;
  depthM: number;
  heightM: number;
};

export type ArPlacementFxDiagnostics = {
  shadowGroundPlaced: boolean;
  blobShadowVisible: boolean;
  shadowCasterCount: number;
  dimensions: PlacedDimensionsM;
  dimensionLabel: string;
  dimensionLinesBuilt: boolean;
  dimensionLinesVisible: boolean;
};

export type ArPlacementFxHandle = {
  blobShadow: AbstractMesh;
  dimensionRoot: TransformNode;
  dimensions: PlacedDimensionsM;
  dimensionLabel: string;
  syncFromBounds: () => void;
  setDimensionLinesVisible: (visible: boolean) => void;
  dispose: () => void;
  getDiagnostics: () => ArPlacementFxDiagnostics;
};

/** Format meters for in-view labels (SwiftXR-style cm for furniture). */
export function formatDimensionMeters(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m >= 1) return `${m.toFixed(2)} m`;
  return `${Math.round(m * 100)} cm`;
}

export function formatDimensionLabel(dim: PlacedDimensionsM): string {
  return `W: ${formatDimensionMeters(dim.widthM)} × D: ${formatDimensionMeters(dim.depthM)} × H: ${formatDimensionMeters(dim.heightM)}`;
}

/** Single-axis billboard text — W: / D: / H: prefix so each label is identifiable in AR. */
export function formatAxisDimensionLabel(
  axis: "W" | "D" | "H",
  dim: PlacedDimensionsM
): string {
  const value =
    axis === "W" ? dim.widthM : axis === "D" ? dim.depthM : dim.heightM;
  return `${axis}: ${formatDimensionMeters(value)}`;
}

function worldBoundsToLocal(
  wrapper: TransformNode,
  bounds: GeometryWorldBounds
): { min: Vector3; max: Vector3 } {
  wrapper.computeWorldMatrix(true);
  const inv = wrapper.getWorldMatrix().clone();
  inv.invert();
  const min = Vector3.TransformCoordinates(
    new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    inv
  );
  const max = Vector3.TransformCoordinates(
    new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    inv
  );
  return {
    min: new Vector3(
      Math.min(min.x, max.x),
      Math.min(min.y, max.y),
      Math.min(min.z, max.z)
    ),
    max: new Vector3(
      Math.max(min.x, max.x),
      Math.max(min.y, max.y),
      Math.max(min.z, max.z)
    ),
  };
}

function dimensionsFromBounds(bounds: GeometryWorldBounds): PlacedDimensionsM {
  return {
    widthM: Math.max(0.001, bounds.max.x - bounds.min.x),
    depthM: Math.max(0.001, bounds.max.z - bounds.min.z),
    heightM: Math.max(0.001, bounds.max.y - bounds.min.y),
  };
}

const MIN_MODEL_HEIGHT_M = 0.05;

function modelMeshesForBounds(
  wrapper: TransformNode,
  modelMeshes?: AbstractMesh[]
): AbstractMesh[] {
  const source =
    modelMeshes?.length ?
      modelMeshes
    : collectGeometryMeshes(wrapper);
  return source.filter((m) => !isPlacementFxMesh(m));
}

/** Union bounds of model geometry only — never includes blob shadow or dimension lines. */
export function resolveModelPlacementBounds(
  wrapper: TransformNode,
  modelMeshes?: AbstractMesh[]
): { bounds: GeometryWorldBounds; local: { min: Vector3; max: Vector3 } } | null {
  wrapper.computeWorldMatrix(true);
  const meshes = modelMeshesForBounds(wrapper, modelMeshes);

  let bounds: GeometryWorldBounds | null = null;
  if (meshes.length) {
    bounds =
      significantGeometryWorldBounds(wrapper, modelMeshes) ??
      (() => {
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
          }
        }
        if (!Number.isFinite(minY)) return null;
        return {
          min: { x: minX, y: minY, z: minZ },
          max: { x: maxX, y: maxY, z: maxZ },
        };
      })();
  }

  if (!bounds || bounds.max.y - bounds.min.y < MIN_MODEL_HEIGHT_M) {
    try {
      const local = wrapper.getHierarchyBoundingVectors(false);
      const extent = Math.max(
        local.max.x - local.min.x,
        local.max.y - local.min.y,
        local.max.z - local.min.z
      );
      if (Number.isFinite(extent) && extent >= 0.001) {
        wrapper.computeWorldMatrix(true);
        const worldMin = Vector3.TransformCoordinates(local.min, wrapper.getWorldMatrix());
        const worldMax = Vector3.TransformCoordinates(local.max, wrapper.getWorldMatrix());
        bounds = {
          min: {
            x: Math.min(worldMin.x, worldMax.x),
            y: Math.min(worldMin.y, worldMax.y),
            z: Math.min(worldMin.z, worldMax.z),
          },
          max: {
            x: Math.max(worldMin.x, worldMax.x),
            y: Math.max(worldMin.y, worldMax.y),
            z: Math.max(worldMin.z, worldMax.z),
          },
        };
        return { bounds, local: { min: local.min.clone(), max: local.max.clone() } };
      }
    } catch {
      /* fall through */
    }
    if (!bounds) return null;
  }

  return {
    bounds,
    local: worldBoundsToLocal(wrapper, bounds),
  };
}

/** @deprecated Use resolveModelPlacementBounds — excludes FX and avoids feedback loops. */
export function resolvePlacementBounds(
  wrapper: TransformNode
): GeometryWorldBounds | null {
  return resolveModelPlacementBounds(wrapper)?.bounds ?? null;
}

function createBlobShadowTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("blob-shadow-tex", size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, "rgba(0,0,0,0.52)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function createBlobShadow(
  wrapper: TransformNode,
  scene: Scene,
  widthM: number,
  depthM: number,
  renderingGroupId: number
): AbstractMesh {
  const diameter = Math.max(0.28, Math.max(widthM, depthM) * 1.08);
  const disc = MeshBuilder.CreateDisc(
    `blob-shadow-${wrapper.name}`,
    { radius: diameter / 2, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  disc.parent = wrapper;
  disc.rotation.x = Math.PI / 2;
  disc.position.y = BLOB_SHADOW_Y_OFFSET_M;
  disc.isPickable = false;
  disc.receiveShadows = false;
  disc.renderingGroupId = renderingGroupId;
  disc.alwaysSelectAsActiveMesh = false;

  const mat = new StandardMaterial(`blob-shadow-mat-${wrapper.name}`, scene);
  mat.diffuseTexture = createBlobShadowTexture(scene);
  mat.diffuseColor = new Color3(0, 0, 0);
  mat.emissiveColor = new Color3(0, 0, 0);
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  mat.alpha = 0.95;
  mat.zOffset = -2;
  disc.material = mat;
  return disc;
}

type DimensionLineSet = {
  width: Mesh;
  depth: Mesh;
  height: Mesh;
  widthLabel: Mesh;
  depthLabel: Mesh;
  heightLabel: Mesh;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createDimensionLabelPlane(
  scene: Scene,
  name: string,
  text: string,
  renderingGroupId: number
): Mesh {
  const plane = MeshBuilder.CreatePlane(
    name,
    { width: 0.52, height: 0.13, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  plane.isPickable = false;
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.renderingGroupId = renderingGroupId;
  plane.alwaysSelectAsActiveMesh = true;

  const tex = new DynamicTexture(`${name}-tex`, { width: 512, height: 128 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = DIM_LABEL_BG;
  ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
  ctx.lineWidth = 4;
  roundRect(ctx, 8, 8, 496, 112, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = DIM_LABEL_FG;
  ctx.font = "700 48px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  tex.update();

  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
  configureDimensionOverlayMaterial(mat);
  plane.material = mat;
  return plane;
}

/** Line thickness for W/D/H extension boxes (meters). */
function dimLineThicknessM(dim: PlacedDimensionsM): number {
  const maxD = Math.max(dim.widthM, dim.depthM, dim.heightM);
  return Math.max(0.012, Math.min(0.022, maxD * 0.02));
}

function createThickLineBox(
  scene: Scene,
  name: string,
  a: Vector3,
  b: Vector3,
  renderingGroupId: number,
  thicknessM: number
): Mesh {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const dz = Math.abs(b.z - a.z);
  const mid = new Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  let width = thicknessM;
  let height = thicknessM;
  let depth = thicknessM;
  if (dx >= dy && dx >= dz) {
    width = Math.max(dx, thicknessM);
  } else if (dy >= dx && dy >= dz) {
    height = Math.max(dy, thicknessM);
  } else {
    depth = Math.max(dz, thicknessM);
  }
  const box = MeshBuilder.CreateBox(
    name,
    { width, height, depth, updatable: false },
    scene
  );
  box.position.copyFrom(mid);
  box.isPickable = false;
  box.renderingGroupId = renderingGroupId;
  box.alwaysSelectAsActiveMesh = true;
  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.emissiveColor = DIM_LINE_COLOR.clone();
  mat.diffuseColor = DIM_LINE_COLOR.clone();
  mat.disableLighting = true;
  mat.alpha = 1;
  mat.backFaceCulling = false;
  configureDimensionOverlayMaterial(mat);
  box.material = mat;
  return box;
}

function buildDimensionLines(
  root: TransformNode,
  scene: Scene,
  renderingGroupId: number
): Pick<DimensionLineSet, "widthLabel" | "depthLabel" | "heightLabel"> {
  return {
    widthLabel: createDimensionLabelPlane(
      scene,
      `${root.name}-dim-w-lbl`,
      "",
      renderingGroupId
    ),
    depthLabel: createDimensionLabelPlane(
      scene,
      `${root.name}-dim-d-lbl`,
      "",
      renderingGroupId
    ),
    heightLabel: createDimensionLabelPlane(
      scene,
      `${root.name}-dim-h-lbl`,
      "",
      renderingGroupId
    ),
  };
}

/** Draw dimension overlays above placed meshes (group 0) and floor scan UI (group 2). */
function dimensionLinePadM(dim: PlacedDimensionsM): number {
  return Math.max(0.11, Math.max(dim.widthM, dim.depthM, dim.heightM) * 0.14);
}

function labelOutsetM(pad: number): number {
  return Math.max(DIM_LABEL_OUTSET_MIN_M, pad * 0.62);
}

/** Push label away from model center on the horizontal plane. */
function outwardLabelPosition(
  anchor: Vector3,
  modelCenter: Vector3,
  outsetM: number
): Vector3 {
  const dir = new Vector3(anchor.x - modelCenter.x, 0, anchor.z - modelCenter.z);
  if (dir.lengthSquared() < 1e-8) {
    dir.set(0, 0, -1);
  } else {
    dir.normalize();
  }
  return new Vector3(
    anchor.x + dir.x * outsetM,
    anchor.y + DIM_LABEL_ABOVE_LINE_M,
    anchor.z + dir.z * outsetM
  );
}

function updateLabelTexture(plane: Mesh, text: string): void {
  const mat = plane.material as StandardMaterial | null;
  const tex = mat?.diffuseTexture as DynamicTexture | null;
  if (!tex) return;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = DIM_LABEL_BG;
  ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
  ctx.lineWidth = 4;
  roundRect(ctx, 8, 8, 496, 112, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = DIM_LABEL_FG;
  ctx.font = "700 48px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  tex.update();
}

function layoutDimensionLines(
  scene: Scene,
  local: { min: Vector3; max: Vector3 },
  dim: PlacedDimensionsM,
  dimensionRoot: TransformNode,
  renderingGroupId: number
): DimensionLineSet {
  const tubeR = dimLineThicknessM(dim);
  const pad = dimensionLinePadM(dim);
  const outset = labelOutsetM(pad);
  const y = local.min.y + 0.006;
  const center = new Vector3(
    (local.min.x + local.max.x) / 2,
    (local.min.y + local.max.y) / 2,
    (local.min.z + local.max.z) / 2
  );

  // Width — front (-Z), opposite model center
  const w0 = new Vector3(local.min.x, y, local.min.z - pad);
  const w1 = new Vector3(local.max.x, y, local.min.z - pad);
  // Depth — right (+X)
  const d0 = new Vector3(local.max.x + pad, y, local.min.z);
  const d1 = new Vector3(local.max.x + pad, y, local.max.z);
  // Height — left-front corner (-X, -Z)
  const h0 = new Vector3(local.min.x - pad, local.min.y, local.min.z - pad);
  const h1 = new Vector3(local.min.x - pad, local.max.y, local.min.z - pad);

  const labelGroupId = renderingGroupId;
  const labels = buildDimensionLines(dimensionRoot, scene, labelGroupId);
  const lineThickness = tubeR;
  const width = createThickLineBox(scene, `${dimensionRoot.name}-dim-w`, w0, w1, renderingGroupId, lineThickness);
  const depth = createThickLineBox(scene, `${dimensionRoot.name}-dim-d`, d0, d1, renderingGroupId, lineThickness);
  const height = createThickLineBox(scene, `${dimensionRoot.name}-dim-h`, h0, h1, renderingGroupId, lineThickness);

  for (const node of [width, depth, height, labels.widthLabel, labels.depthLabel, labels.heightLabel]) {
    node.parent = dimensionRoot;
  }

  const wMid = w0.add(w1).scale(0.5);
  const wLabelPos = outwardLabelPosition(wMid, center, outset + DIM_LABEL_AXIS_BUMP_M);
  wLabelPos.z -= DIM_LABEL_AXIS_BUMP_M;
  labels.widthLabel.position.copyFrom(wLabelPos);
  updateLabelTexture(labels.widthLabel, formatAxisDimensionLabel("W", dim));

  const dMid = d0.add(d1).scale(0.5);
  const dLabelPos = outwardLabelPosition(dMid, center, outset + DIM_LABEL_DEPTH_EXTRA_M);
  dLabelPos.x += DIM_LABEL_DEPTH_EXTRA_M;
  labels.depthLabel.position.copyFrom(dLabelPos);
  updateLabelTexture(labels.depthLabel, formatAxisDimensionLabel("D", dim));

  const hMid = h0.add(h1).scale(0.5);
  const hLabelPos = outwardLabelPosition(hMid, center, outset + DIM_LABEL_HEIGHT_EXTRA_M);
  labels.heightLabel.position.copyFrom(hLabelPos);
  updateLabelTexture(labels.heightLabel, formatAxisDimensionLabel("H", dim));

  return { width, depth, height, ...labels };
}

/**
 * SwiftXR-style contact shadow (soft blob on floor) + W/D/H dimension lines in the scene.
 * Blob shadows match common mobile WebXR practice (see Samsung/8th Wall AR guides).
 */
export function attachArPlacementFx(
  wrapper: TransformNode,
  scene: Scene,
  renderingGroupId: number,
  modelMeshes?: AbstractMesh[],
  dimensionRenderingGroupId: number = renderingGroupId
): ArPlacementFxHandle | null {
  wrapper.computeWorldMatrix(true);
  const resolved = resolveModelPlacementBounds(wrapper, modelMeshes);
  if (!resolved) return null;

  const { bounds, local } = resolved;
  const dimensions = dimensionsFromBounds(bounds);
  const dimensionLabel = formatDimensionLabel(dimensions);

  let blobShadow: AbstractMesh;
  try {
    blobShadow = createBlobShadow(
      wrapper,
      scene,
      dimensions.widthM,
      dimensions.depthM,
      renderingGroupId
    );
  } catch {
    return null;
  }

  const dimensionRoot = new TransformNode(`dim-root-${wrapper.name}`, scene);
  dimensionRoot.parent = wrapper;
  let lines: DimensionLineSet | null = null;
  try {
    lines = layoutDimensionLines(
      scene,
      local,
      dimensions,
      dimensionRoot,
      dimensionRenderingGroupId
    );
  } catch (e) {
    console.warn("[atlas] dimension line layout failed", e);
    lines = null;
  }

  /** Dimensions are frozen at placement — per-frame bounds sync included FX and blew up shadow/lines. */
  const syncFromBounds = () => {};

  const setDimensionLinesVisible = (visible: boolean) => {
    dimensionRoot.setEnabled(visible);
    if (!lines) return;
    wrapper.computeWorldMatrix(true);
    dimensionRoot.computeWorldMatrix(true);
    for (const mesh of [lines.width, lines.depth, lines.height, lines.widthLabel, lines.depthLabel, lines.heightLabel]) {
      mesh.isVisible = visible;
      mesh.setEnabled(visible);
      mesh.renderingGroupId = dimensionRenderingGroupId;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.computeWorldMatrix(true);
    }
  };

  setDimensionLinesVisible(false);

  const dispose = () => {
    blobShadow.dispose();
    if (lines) dimensionRoot.dispose();
  };

  return {
    blobShadow,
    dimensionRoot,
    dimensions,
    dimensionLabel,
    syncFromBounds,
    setDimensionLinesVisible,
    dispose,
    getDiagnostics: () => ({
      shadowGroundPlaced: true,
      blobShadowVisible: blobShadow.isVisible && blobShadow.isEnabled(),
      shadowCasterCount: 0,
      dimensions,
      dimensionLabel,
      dimensionLinesBuilt: lines !== null,
      dimensionLinesVisible: Boolean(
        lines && lines.width.isVisible && lines.width.isEnabled()
      ),
    }),
  };
}

export type PlacedDimensionHudState = {
  label: string;
  visible: boolean;
  /** SwiftXR-style readout docked above the AR model picker — never over the model. */
  dock?: boolean;
  /** @deprecated Use dock — top-center overlapped tall furniture in AR view. */
  fixed?: boolean;
  x: number;
  y: number;
};

export function buildDockedDimensionHud(label: string): PlacedDimensionHudState {
  return { label, visible: true, dock: true, x: 0, y: 0 };
}

/** @deprecated Prefer buildDockedDimensionHud */
export function buildFixedDimensionHud(label: string): PlacedDimensionHudState {
  return buildDockedDimensionHud(label);
}

/** Project a floating dimension summary above the placed model (screen pixels). */
export function projectPlacedDimensionHud(
  wrapper: TransformNode,
  scene: Scene,
  engine: { getRenderWidth: () => number; getRenderHeight: () => number },
  label: string
): PlacedDimensionHudState | null {
  const bounds = geometryWorldBounds(wrapper);
  const camera = scene.activeCamera;
  if (!bounds || !camera) return null;

  const anchor = new Vector3(
    (bounds.min.x + bounds.max.x) / 2,
    bounds.max.y + 0.06,
    (bounds.min.z + bounds.max.z) / 2
  );
  const viewport = camera.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight()
  );
  const screen = Vector3.Project(
    anchor,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport
  );
  if (screen.z < 0 || screen.z > 1) {
    return { label, visible: false, x: 0, y: 0 };
  }
  return {
    label,
    visible: true,
    x: Math.round(screen.x),
    y: Math.round(screen.y),
  };
}
