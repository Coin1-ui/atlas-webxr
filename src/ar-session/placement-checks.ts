import type { PlacementDiagnostics } from "../xr/webxr-ar";
import { pbrDiagnosticsForLog } from "../xr/ar-pbr-environment";
import type { ArSessionEvent, ArSessionReport, SessionPlacementSummary } from "./types";

const SUBMERGED_THRESHOLD_M = 0.02;
/** Visible mesh base more than this above hit-test floor reads as hover (session 1780829599377). */
const HOVER_THRESHOLD_M = 0.015;
const FLOOR_Y_DRIFT_THRESHOLD_M = 0.15;
const SIZE_RATIO_TOLERANCE = 0.05;
const MIN_SIZE_BASELINE_M = 0.01;
const BBOX_PADDING_WARN_M = 0.015;

export type PlacementCheckFlags = {
  floorClearanceM: number;
  visibleFloorClearanceM: number;
  floorSnapM: number;
  hitTestFloorY: number;
  submerged: boolean;
  hovering: boolean;
  floorYDrift: boolean;
  sizeRatioVsFirst: number | null;
  sizeConsistent: boolean;
  shadowCasterCount: number;
  shadowGroundPlaced: boolean;
  materialsMissing: boolean;
  checkStatus: "ok" | "warn" | "fail";
  checkNotes: string;
};

const modelBaselines = new Map<string, number>();

export function resetPlacementBaselines(): void {
  modelBaselines.clear();
}

export function enrichPlacementChecks(
  diag: PlacementDiagnostics
): PlacementCheckFlags {
  const hitTestFloorY = diag.hitTestFloorY ?? diag.position.y;
  const contactMinY =
    diag.snapContactY ??
    diag.contactVertexMinY ??
    diag.primaryMeshMinY ??
    diag.geometryMin?.y ??
    diag.boundsMin?.y ??
    hitTestFloorY;
  const floorClearanceM = Math.round((contactMinY - hitTestFloorY) * 1000) / 1000;
  const visibleContactY =
    diag.primaryMeshMinY ?? diag.snapContactY ?? contactMinY;
  const visibleFloorClearanceM =
    Math.round((visibleContactY - hitTestFloorY) * 1000) / 1000;
  const floorSnapM = diag.floorSnapM ?? 0;
  const submerged = floorClearanceM < -SUBMERGED_THRESHOLD_M;
  const hovering = visibleFloorClearanceM > HOVER_THRESHOLD_M;

  const modelKey = diag.modelUrl ?? diag.loadMethod;
  let sizeRatioVsFirst: number | null = null;
  let sizeConsistent = true;
  let boundsCollapsed = false;
  if (diag.maxDimensionM !== undefined && diag.maxDimensionM > MIN_SIZE_BASELINE_M && modelKey) {
    const baseline = modelBaselines.get(modelKey);
    if (baseline === undefined || baseline <= MIN_SIZE_BASELINE_M) {
      modelBaselines.set(modelKey, diag.maxDimensionM);
      sizeRatioVsFirst = 1;
    } else {
      sizeRatioVsFirst =
        Math.round((diag.maxDimensionM / baseline) * 1000) / 1000;
      sizeConsistent = Math.abs(sizeRatioVsFirst - 1) <= SIZE_RATIO_TOLERANCE;
    }
  } else if (diag.maxDimensionM !== undefined && diag.maxDimensionM <= MIN_SIZE_BASELINE_M) {
    sizeConsistent = false;
    boundsCollapsed = true;
  }

  const shadowCasterCount = diag.shadowCasterCount ?? 0;
  const shadowGroundPlaced = diag.shadowGroundPlaced ?? false;
  const materialsMissing =
    diag.loadMethod !== "builtin" &&
    (!diag.materialTypes ||
      diag.materialTypes === "MeshWithoutStandardMaterial" ||
      diag.materialTypes.length === 0);

  const pbr = diag.pbrDiagnostics;
  const pbrFlat =
    pbr != null &&
    pbr.pbrCount > 0 &&
    (!pbr.sceneHasEnvironment || pbr.unlitCount > 0);

  const medianFloorY = diag.sessionMedianFloorY;
  const floorYDrift =
    medianFloorY !== undefined &&
    Math.abs(hitTestFloorY - medianFloorY) > FLOOR_Y_DRIFT_THRESHOLD_M;

  const notes: string[] = [];
  if (boundsCollapsed) {
    notes.push("Model bounds collapsed to zero — floor snap may be wrong");
  }
  if (pbrFlat && pbr) {
    if (!pbr.sceneHasEnvironment) {
      notes.push("PBR models missing scene IBL environment — textures may look flat");
    }
    if (pbr.unlitCount > 0) {
      notes.push(`${pbr.unlitCount} unlit PBR material(s) — lighting disabled on mesh`);
    }
    if (pbr.withAlbedoTexture === 0 && pbr.pbrCount > 0) {
      notes.push("PBR materials have no albedo texture — check glTF export");
    }
  }
  if (submerged) {
    notes.push(`Model base ${Math.abs(floorClearanceM).toFixed(2)}m below floor hit`);
  }
  if (hovering) {
    notes.push(
      `Visible mesh base ${visibleFloorClearanceM.toFixed(3)}m above floor hit — collision verts may sit below render mesh`
    );
  }
  const bboxPadding = diag.bboxPaddingBelowMeshM;
  if (bboxPadding !== undefined && bboxPadding > BBOX_PADDING_WARN_M) {
    notes.push(
      `BBox extends ${(bboxPadding * 100).toFixed(1)}cm below visible mesh — may float when viewed from below`
    );
  }
  if (!sizeConsistent && sizeRatioVsFirst !== null && Number.isFinite(sizeRatioVsFirst)) {
    notes.push(`Size ratio vs first placement: ${sizeRatioVsFirst} (expected ~1.0)`);
  }
  if (floorYDrift && medianFloorY !== undefined) {
    notes.push(
      `Hit-test floor Y ${hitTestFloorY.toFixed(2)}m drifts from session median ${medianFloorY.toFixed(2)}m`
    );
  }
  if (materialsMissing) notes.push("GLB uses non-standard materials");

  let checkStatus: PlacementCheckFlags["checkStatus"] = "ok";
  if (submerged) {
    checkStatus = "fail";
  } else if (hovering || floorYDrift || materialsMissing || pbrFlat) {
    checkStatus = "warn";
  }

  return {
    floorClearanceM,
    visibleFloorClearanceM,
    floorSnapM,
    hitTestFloorY,
    submerged,
    hovering,
    floorYDrift,
    sizeRatioVsFirst,
    sizeConsistent,
    shadowCasterCount,
    shadowGroundPlaced,
    materialsMissing,
    checkStatus,
    checkNotes: notes.join("; ") || "Placement checks passed",
  };
}

function pbrFieldsForLog(diag: PlacementDiagnostics) {
  return diag.pbrDiagnostics ? pbrDiagnosticsForLog(diag.pbrDiagnostics) : {};
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function detailPositionY(d: Record<string, unknown>): number | null {
  if (typeof d.positionY === "number") return d.positionY;
  const pos = d.position as { y?: number } | undefined;
  return typeof pos?.y === "number" ? pos.y : null;
}

function detailBoundsMinY(d: Record<string, unknown>): number | null {
  if (typeof d.geometryMinY === "number") return d.geometryMinY;
  if (typeof d.boundsMinY === "number") return d.boundsMinY;
  const bounds = d.boundsMin as { y?: number } | undefined;
  return typeof bounds?.y === "number" ? bounds.y : null;
}

function detailContactMinY(d: Record<string, unknown>): number | null {
  if (typeof d.snapContactY === "number") return d.snapContactY;
  if (typeof d.primaryMeshMinY === "number") return d.primaryMeshMinY;
  if (typeof d.contactVertexMinY === "number") return d.contactVertexMinY;
  return detailBoundsMinY(d);
}

function modelIdForLog(diag: PlacementDiagnostics): string | null {
  if (diag.modelId) return diag.modelId;
  if (!diag.modelUrl) return null;
  try {
    const path = new URL(diag.modelUrl, "https://local.invalid").pathname;
    const file = path.split("/").pop() ?? "";
    return file.replace(/\.glb$/i, "") || null;
  } catch {
    return null;
  }
}

export function summarizeSessionPlacements(events: ArSessionEvent[]): SessionPlacementSummary {
  const placements = events.filter((e) => e.id === "model-place-result" && e.status === "ok");
  const floorYs: number[] = [];
  const issues: string[] = [];
  let warnCount = 0;
  let failCount = 0;
  let submergedCount = 0;
  let shadowIssues = 0;

  for (const e of placements) {
    const d = (e.details ?? {}) as Record<string, unknown>;
    const hitY =
      typeof d.hitTestFloorY === "number"
        ? d.hitTestFloorY
        : detailPositionY(d);
    if (hitY !== null) floorYs.push(hitY);

    const contactMinY = detailContactMinY(d);
    const primaryMeshMinY =
      typeof d.primaryMeshMinY === "number" ? d.primaryMeshMinY : null;
    const submerged =
      d.submerged === true ||
      (hitY !== null &&
        contactMinY !== null &&
        contactMinY - hitY < -SUBMERGED_THRESHOLD_M);
    const hovering =
      d.hovering === true ||
      (hitY !== null &&
        primaryMeshMinY !== null &&
        primaryMeshMinY - hitY > 0.015);

    if (submerged) {
      submergedCount++;
      const clearance =
        hitY !== null && contactMinY !== null
          ? Math.round((contactMinY - hitY) * 1000) / 1000
          : "?";
      issues.push(`${e.name}: model submerged (floor clearance ${clearance}m)`);
    }
    if (hovering) {
      const clearance =
        hitY !== null && primaryMeshMinY !== null
          ? Math.round((primaryMeshMinY - hitY) * 1000) / 1000
          : "?";
      issues.push(`${e.name}: model hovering ${clearance}m above floor hit`);
      warnCount++;
    }
    if (d.checkStatus === "fail") {
      failCount++;
      if (typeof d.checkNotes === "string") issues.push(`${e.name}: ${d.checkNotes}`);
    } else if (d.checkStatus === "warn") {
      warnCount++;
    } else if (submerged) {
      failCount++;
    }
    if (d.materialsMissing === true) {
      issues.push(`${e.name}: materials missing on meshes`);
      warnCount++;
    }
  }

  return {
    placementCount: placements.length,
    warnCount,
    failCount,
    submergedCount,
    shadowIssues,
    floorYMedianM: median(floorYs) ?? null,
    issues: issues.slice(0, 20),
  };
}

export function appendSessionSummary(report: ArSessionReport): ArSessionReport {
  const summary = summarizeSessionPlacements(report.events);
  return {
    ...report,
    meta: {
      ...report.meta,
      version: "1.1.0",
    },
    placementSummary: summary,
  };
}

/** Analyze an existing session JSON (e.g. downloaded log) offline. */
export function analyzeSessionReport(report: ArSessionReport): SessionPlacementSummary {
  return summarizeSessionPlacements(report.events);
}

export function placementDetailsForLog(
  diag: PlacementDiagnostics,
  checks: PlacementCheckFlags
): Record<string, string | number | boolean | null | undefined> {
  return {
    loadMethod: diag.loadMethod,
    meshCount: diag.meshCount,
    transformNodeCount: diag.transformNodeCount,
    topLevelRoots: diag.topLevelRoots,
    positionX: diag.position.x,
    positionY: diag.position.y,
    positionZ: diag.position.z,
    boundsMinY: diag.boundsMin?.y ?? null,
    boundsMaxY: diag.boundsMax?.y ?? null,
    geometryMinY: diag.geometryMin?.y ?? null,
    geometryMaxY: diag.geometryMax?.y ?? null,
    contactVertexMinY: diag.contactVertexMinY ?? null,
    primaryMeshMinY: diag.primaryMeshMinY ?? null,
    snapContactY: diag.snapContactY ?? null,
    floorContactSource: diag.floorContactSource ?? null,
    bboxPaddingBelowMeshM: diag.bboxPaddingBelowMeshM ?? null,
    sizeXM:
      diag.sizeMeters != null
        ? Math.max(diag.sizeMeters.x, diag.sizeMeters.z)
        : null,
    sizeYM: diag.sizeMeters?.y ?? null,
    sizeZM: diag.sizeMeters?.z ?? null,
    maxDimensionM: diag.maxDimensionM ?? null,
    arScaleFactor: diag.arScaleFactor ?? null,
    arScaleReason: diag.arScaleReason ?? null,
    meshesVisible: diag.meshesVisible,
    modelId: modelIdForLog(diag),
    materialTypes: diag.materialTypes ?? "",
    fetchBytes: diag.fetchBytes ?? null,
    hitTestFloorY: checks.hitTestFloorY,
    rawHitTestFloorY: diag.rawHitTestFloorY ?? null,
    lockedFloorY: diag.lockedFloorY ?? null,
    floorYClamped: diag.floorYClamped ?? null,
    floorClearanceM: checks.floorClearanceM,
    visibleFloorClearanceM: checks.visibleFloorClearanceM,
    floorSnapM: checks.floorSnapM,
    submerged: checks.submerged,
    hovering: checks.hovering,
    floorYDrift: checks.floorYDrift,
    sizeRatioVsFirst: checks.sizeRatioVsFirst,
    sizeConsistent: checks.sizeConsistent,
    shadowCasterCount: checks.shadowCasterCount,
    shadowGroundPlaced: checks.shadowGroundPlaced,
    materialsMissing: checks.materialsMissing,
    blobShadowVisible: diag.blobShadowVisible ?? null,
    reticleVisibleAtPlace: diag.reticleVisibleAtPlace ?? null,
    poseAgeMs: diag.poseAgeMs ?? null,
    floorNormalY: diag.floorNormalY ?? null,
    checkStatus: checks.checkStatus,
    checkNotes: checks.checkNotes,
    ...pbrFieldsForLog(diag),
  };
}
