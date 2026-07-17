/**
 * Analyze a downloaded atlas-ar-session-*.json for placement/shadow issues.
 * Archived session logs: atlas-webxr/Edit_logs/
 * Usage: node scripts/analyze-ar-session.mjs path/to/session.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { analyzeDepthDiagnostics } from "./lib/depth-session-analysis.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const sessionPath = process.argv[2];

if (!sessionPath) {
  console.error("Usage: node scripts/analyze-ar-session.mjs <session.json>");
  process.exit(1);
}

const SUBMERGED_THRESHOLD_M = 0.02;
const FLOOR_Y_DRIFT_THRESHOLD_M = 0.1;

function detailPositionY(d) {
  if (typeof d.positionY === "number") return d.positionY;
  if (d.position && typeof d.position.y === "number") return d.position.y;
  return null;
}

function detailBoundsMinY(d) {
  if (typeof d.geometryMinY === "number") return d.geometryMinY;
  if (typeof d.boundsMinY === "number") return d.boundsMinY;
  if (d.boundsMin && typeof d.boundsMin.y === "number") return d.boundsMin.y;
  return null;
}

function detailContactMinY(d) {
  if (typeof d.snapContactY === "number") return d.snapContactY;
  if (typeof d.contactVertexMinY === "number") return d.contactVertexMinY;
  if (typeof d.primaryMeshMinY === "number") return d.primaryMeshMinY;
  return detailBoundsMinY(d);
}

function detailMaxDim(d) {
  if (typeof d.maxDimensionM === "number") return d.maxDimensionM;
  return null;
}

function detailModelUrl(d) {
  return d.modelUrl ?? null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const raw = JSON.parse(readFileSync(sessionPath, "utf8"));
const arStart = raw.events.find((e) => e.id === "ar-start" && e.status === "ok");
const depthProbeEvent = raw.events.find((e) => e.id === "depth-probe");
const depthAnalysis = analyzeDepthDiagnostics(
  arStart?.details ?? {},
  depthProbeEvent?.details ?? null
);
const depthOcclusionActive = depthAnalysis.depthOcclusion === true;
const depthUsage = depthAnalysis.depthUsage ?? "unknown";

const placements = raw.events.filter(
  (e) => e.id === "model-place-result" && e.status === "ok"
);

const baselines = new Map();
const analyzed = [];
const floorYs = [];
const issues = [];
const depthWarnings = [];

for (const e of placements) {
  const d = e.details ?? {};
  const hitY = typeof d.hitTestFloorY === "number" ? d.hitTestFloorY : detailPositionY(d);
  const contactMinY = detailContactMinY(d);
  const primaryMeshMinY =
    typeof d.primaryMeshMinY === "number" ? d.primaryMeshMinY : null;
  const maxDim = detailMaxDim(d);
  const modelUrl = detailModelUrl(d);
  if (hitY !== null) floorYs.push(hitY);

  const floorClearanceM =
    hitY !== null && contactMinY !== null
      ? Math.round((contactMinY - hitY) * 1000) / 1000
      : null;
  const visibleFloorClearanceM =
    hitY !== null && primaryMeshMinY !== null
      ? Math.round((primaryMeshMinY - hitY) * 1000) / 1000
      : floorClearanceM;
  const submerged =
    d.submerged === true ||
    (floorClearanceM !== null && floorClearanceM < -SUBMERGED_THRESHOLD_M);
  const hovering =
    d.hovering === true ||
    (visibleFloorClearanceM !== null && visibleFloorClearanceM > 0.015);

  let sizeRatioVsFirst = null;
  let sizeConsistent = true;
  if (maxDim !== null && maxDim > 0.01 && modelUrl) {
    const base = baselines.get(modelUrl);
    if (base === undefined || base <= 0.01) {
      baselines.set(modelUrl, maxDim);
      sizeRatioVsFirst = 1;
    } else {
      sizeRatioVsFirst = Math.round((maxDim / base) * 1000) / 1000;
      sizeConsistent = Math.abs(sizeRatioVsFirst - 1) <= 0.05;
    }
  } else if (maxDim !== null && maxDim <= 0.01) {
    sizeConsistent = false;
    issues.push(`${e.name}: model bounds collapsed (0m) — floor snap likely wrong, base may float when viewed from below`);
  }

  const floorYDrift =
    hitY !== null &&
    floorYs.length > 1 &&
    Math.abs(hitY - median(floorYs)) > FLOOR_Y_DRIFT_THRESHOLD_M;

  const row = {
    name: e.name,
    elapsedMs: e.elapsedMs,
    modelUrl,
    hitTestFloorY: hitY,
    floorClearanceM,
    submerged,
    maxDimensionM: maxDim,
    sizeRatioVsFirst,
    sizeConsistent,
    floorYDrift,
    materialTypes: d.materialTypes ?? "",
    shadowCasterCount: d.shadowCasterCount ?? null,
    shadowGroundPlaced: d.shadowGroundPlaced ?? null,
  };
  analyzed.push(row);

  if (submerged) {
    issues.push(`${e.name}: submerged (${floorClearanceM}m below floor hit)`);
  }
  if (hovering) {
    issues.push(
      `${e.name}: hovering (${visibleFloorClearanceM}m above floor hit — snap to visible mesh base)`
    );
  }
  if (!sizeConsistent && sizeRatioVsFirst !== null && Number.isFinite(sizeRatioVsFirst)) {
    issues.push(`${e.name}: size ratio ${sizeRatioVsFirst} vs first placement`);
  }
  if (floorYDrift) {
    issues.push(`${e.name}: hit-test floor Y drift (${hitY?.toFixed(2)}m)`);
  }
  if (
    d.floorYClamped === false &&
    d.lockedFloorY != null &&
    hitY != null &&
    hitY - d.lockedFloorY > 0.1
  ) {
    issues.push(
      `${e.name}: placed ${Math.round((hitY - d.lockedFloorY) * 1000) / 1000}m above session lock — table-height local override (fixed v0.1.88+)`
    );
  }
  if (d.reticleVisibleAtPlace === false && d.loadMethod === "scene-instantiate") {
    issues.push(`${e.name}: placement ring not visible at place time`);
  }
  if (
    d.pbrCount > 0 &&
    d.sceneHasEnvironment === false &&
    d.loadMethod === "scene-instantiate"
  ) {
    issues.push(`${e.name}: PBR model without IBL environment (flat appearance)`);
  }
  if (d.unlitCount > 0 && d.loadMethod === "scene-instantiate") {
    issues.push(`${e.name}: ${d.unlitCount} unlit PBR material(s)`);
  }
  if (d.bboxPaddingBelowMeshM != null && d.bboxPaddingBelowMeshM > 0.015) {
    issues.push(
      `${e.name}: union bbox ${d.bboxPaddingBelowMeshM}m below contact (${d.floorContactSource ?? "unknown"}) — base may float`
    );
  }
  if (typeof d.floorSnapM === "number" && d.floorSnapM > 0.015) {
    const contactY = d.contactVertexMinY ?? d.geometryMinY ?? d.boundsMinY;
    const gapAboveFloor =
      hitY !== null && typeof contactY === "number" ? contactY - hitY : null;
    if (gapAboveFloor != null && gapAboveFloor > 0.015) {
      issues.push(
        `${e.name}: floor contact ${gapAboveFloor.toFixed(3)}m above floor hit — visible float likely`
      );
    } else if (d.floorContactSource !== "vertex" && d.floorContactSource !== "primary-mesh") {
      issues.push(`${e.name}: floor snap lifted model ${d.floorSnapM}m — check from below for gap`);
    }
  }
  if (typeof d.floorSnapM === "number" && d.floorSnapM < -0.03) {
    issues.push(
      `${e.name}: floor snap sank model ${Math.abs(d.floorSnapM).toFixed(3)}m — far-from-scan bias (fixed v0.1.54+)`
    );
  }
  if (
    typeof d.positionY === "number" &&
    hitY !== null &&
    d.positionY - hitY > 0.015 &&
    d.loadMethod === "scene-instantiate"
  ) {
    const contactY = d.contactVertexMinY ?? d.geometryMinY ?? d.boundsMinY;
    const contactGap =
      typeof contactY === "number" && hitY !== null ? contactY - hitY : null;
    if (contactGap == null || contactGap > 0.015) {
      issues.push(
        `${e.name}: wrapper ${(d.positionY - hitY).toFixed(3)}m above floor hit — visible float likely`
      );
    }
  }
  if (d.floorYClamped === true && d.loadMethod === "scene-instantiate") {
    const raw = d.rawHitTestFloorY;
    const hit = d.hitTestFloorY;
    if (
      typeof raw === "number" &&
      typeof hit === "number" &&
      Math.abs(hit - raw) > 0.001
    ) {
      issues.push(
        `${e.name}: floor Y clamped (raw ${raw}m → ${hit}m, locked ${d.lockedFloorY}m)`
      );
    }
  }
  if (
    sizeConsistent &&
    sizeRatioVsFirst === 1 &&
    maxDim !== null &&
    modelUrl &&
    /sofa/i.test(modelUrl) &&
    maxDim < 1.2 &&
    (d.arScaleFactor == null || d.arScaleFactor < 1.05)
  ) {
    issues.push(
      `${e.name}: GLB max dimension ${maxDim}m — sofa may look small vs real furniture (check export scale in meters)`
    );
  }
  if (d.arScaleFactor != null && d.arScaleFactor > 1.05) {
    issues.push(
      `${e.name}: AR scale correction ${d.arScaleFactor.toFixed(2)}x applied (${d.arScaleReason ?? "manifest"}) — native GLB scale preferred; set realWorld in manifest only if export cannot be fixed`
    );
  }
  if (
    modelUrl &&
    /sofa/i.test(modelUrl) &&
    typeof d.sizeXM === "number" &&
    typeof d.sizeYM === "number" &&
    d.sizeYM > d.sizeXM * 1.25 &&
    d.arScaleReason === "catalog-widthM"
  ) {
    issues.push(
      `${e.name}: sofa height ${d.sizeYM.toFixed(2)}m exceeds width ${d.sizeXM.toFixed(2)}m — uniform width scale over-stretched Y (use per-axis scale v0.1.93+)`
    );
  }
  if (
    sizeConsistent &&
    sizeRatioVsFirst === 1 &&
    maxDim !== null &&
    maxDim < 0.5 &&
    d.loadMethod === "scene-instantiate"
  ) {
    issues.push(
      `${e.name}: max dimension ${maxDim}m — model may appear miniature (verify 1 unit = 1 meter in export)`
    );
  }
  if (d.maxDimensionM !== undefined && d.maxDimensionM > 3) {
    issues.push(`${e.name}: model very large (${d.maxDimensionM}m — check export units)`);
  }
  if (d.maxDimensionM !== undefined && d.maxDimensionM < 0.05) {
    issues.push(`${e.name}: model very small (${d.maxDimensionM}m — check export scale)`);
  }
}

for (const depthIssue of depthAnalysis.depthIssues) {
  depthWarnings.push(depthIssue);
}
if (depthAnalysis.depthBlockedReason && !depthOcclusionActive) {
  depthWarnings.push(`Blocked: ${depthAnalysis.depthBlockedReason}`);
}

const hitStatsEvents = raw.events.filter((e) => e.id === "hit-test-stats");
const lastHitStats = hitStatsEvents[hitStatsEvents.length - 1]?.details ?? {};
const floorScanEvents = raw.events.filter((e) => e.id === "floor-scan");
const floorScan = floorScanEvents[floorScanEvents.length - 1] ?? null;
const floorIssues = [];

if (lastHitStats.framesWithResults === 0 && lastHitStats.cameraRayHits === 0 && lastHitStats.hitReady) {
  floorIssues.push(
    "False floor-ready: hitReady without hit-test or camera-ray samples (uninitialized camera pose)"
  );
} else if (lastHitStats.framesWithResults === 0 && lastHitStats.cameraRayHits === 0) {
  floorIssues.push(
    "No WebXR hit-test or camera-ray floor samples — reticle cannot appear until viewer pose ray works"
  );
}
if (lastHitStats.hitTestMode === "viewer-ref-space-retry") {
  floorIssues.push(
    "Hit-test ref-space retry was active (known to stall on some Android devices)"
  );
}
if (lastHitStats.xrFramesProcessed != null) {
  const lastFrameCount = lastHitStats.xrFramesProcessed;
  let stuckTail = 0;
  for (let i = hitStatsEvents.length - 1; i >= 0; i--) {
    if (hitStatsEvents[i]?.details?.xrFramesProcessed !== lastFrameCount) break;
    stuckTail += 1;
  }
  const frozen = stuckTail >= 2 && lastFrameCount > 0;
  if (frozen) {
    const arStartDetails = raw.events.find((e) => e.id === "ar-start")?.details ?? {};
    const cpuDepthSession =
      arStartDetails.depthRequested === true &&
      (arStartDetails.sessionDepthUsage === "cpu-optimized" ||
        arStartDetails.sessionDepthUsage === "cpu");
    const depthHint = cpuDepthSession
      ? " — Android CPU session depth likely froze XR (do not request depth-sensing on Android; fixed in v0.1.9+)"
      : " — GLB parse on AR scene or main-thread work may have blocked WebXR";
    floorIssues.push(
      `XR frame loop frozen at ${lastFrameCount} frames${depthHint}`
    );
  } else if (lastFrameCount < 60) {
    floorIssues.push(
      `Low XR frame count (${lastFrameCount}) — render loop may not be running in immersive mode`
    );
  }
}
if (
  lastHitStats.ringRelocalizationRejects != null &&
  lastHitStats.ringRelocalizationRejects > 20 &&
  lastHitStats.ringPoseSource === "camera-ray"
) {
  floorIssues.push(
    `${lastHitStats.ringRelocalizationRejects} ring relocalization rejects while still on camera-ray — ring stuck before first hit-test lock (fixed v0.1.56+)`
  );
}
if (
  lastHitStats.ringRelocalizationRejects != null &&
  lastHitStats.ringRelocalizationRejects > 50 &&
  lastHitStats.ringPoseSource === "hit-test" &&
  lastHitStats.cameraPathM != null &&
  lastHitStats.cameraPathAtScanComplete != null &&
  lastHitStats.cameraPathM - lastHitStats.cameraPathAtScanComplete > 2
) {
  floorIssues.push(
    `${lastHitStats.ringRelocalizationRejects} ring relocalization rejects on hit-test after walking ${Math.round((lastHitStats.cameraPathM - lastHitStats.cameraPathAtScanComplete) * 100) / 100}m — ring frozen away from viewer (fixed v0.1.57+ viewer-proximity resync)`
  );
}
if (lastHitStats.lastRayReject) {
  floorIssues.push(`Last camera-ray reject: ${lastHitStats.lastRayReject}`);
}
if (
  lastHitStats.ringPlaceable === false &&
  lastHitStats.lastRayReject === "object-or-elevated" &&
  lastHitStats.lockedFloorY != null &&
  lastHitStats.lastRawHitTestFloorY != null
) {
  const rawDelta = lastHitStats.lastRawHitTestFloorY - lastHitStats.lockedFloorY;
  if (
    rawDelta > 0.12 &&
    rawDelta <= 0.24 &&
    lastHitStats.lastOriginY != null &&
    lastHitStats.lastOriginY - lastHitStats.lastRawHitTestFloorY >= 0.45 &&
    lastHitStats.lastOriginY - lastHitStats.lastRawHitTestFloorY <= 0.52
  ) {
    floorIssues.push(
      `Ring stuck red with ${Math.round(rawDelta * 1000) / 1000}m ARCore wobble — empty-floor false positive`
    );
  }
}
if (
  lastHitStats.ringWallRejects === 0 &&
  lastHitStats.floorScanComplete &&
  (lastHitStats.reticleVisible === false || lastHitStats.lastRayReject === "direction-not-down")
) {
  floorIssues.push(
    "Wall aim hid the ring instead of showing red — upgrade shows red blocked ring on wall aim"
  );
}
if (
  lastHitStats.ringPlaceable === false &&
  lastHitStats.floorScanComplete &&
  placements.length === 0 &&
  (lastHitStats.ringObjectRejects ?? 0) > 50
) {
  if ((lastHitStats.ringElevatedRecoveries ?? 0) >= 1) {
    floorIssues.push(
      `${lastHitStats.ringObjectRejects} object rejects with ${lastHitStats.ringElevatedRecoveries} elevated recoveries — placement still blocked at end`
    );
  } else {
    floorIssues.push(
      `${lastHitStats.ringObjectRejects} ring object rejects, 0 placements — ring stuck red (check object-or-elevated threshold)`
    );
  }
}
if (
  (lastHitStats.placementAnchorBindSuccess ?? 0) > 0 ||
  lastHitStats.placedWorldX != null
) {
  const insaneViewerY =
    lastHitStats.lastOriginY != null &&
    (lastHitStats.lastOriginY < -0.2 || lastHitStats.lastOriginY > 2.8);
  if (
    insaneViewerY &&
    (lastHitStats.placementRelocalResyncs ?? 0) === 0 &&
    (lastHitStats.placementAnchorUpdates ?? 0) === 0 &&
    lastHitStats.placedMaxDriftM === 0
  ) {
    floorIssues.push(
      `SLAM viewer Y spike (${lastHitStats.lastOriginY}m) with anchored model but no relocal resync — model likely slid in world (fixed v0.1.59+ anchor lock resync)`
    );
  }
}
if (lastHitStats.lastOriginY != null && lastHitStats.lastOriginY < -0.2) {
  floorIssues.push(
    `Viewer originY=${lastHitStats.lastOriginY}m — SLAM tracking lost; walk slowly to recover`
  );
} else if (lastHitStats.lastOriginY != null) {
  floorIssues.push(
    `Last viewer originY=${lastHitStats.lastOriginY}, forwardY=${lastHitStats.lastForwardY ?? "?"}`
  );
}
for (const scan of floorScanEvents) {
  if (scan.details?.floorScanBootstrapOnly && scan.details?.framesWithResults === 0) {
    floorIssues.push(
      `Floor scan completed bootstrap-only with 0 hit-test frames — estimated floor may be 2–3cm off (fixed v0.1.58+ waits for surface hits)`
    );
    break;
  }
}
if (floorScan?.status === "fail") {
  floorIssues.push(`Floor scan timed out after ${floorScan.details?.floorWaitMs ?? "?"}ms`);
}
if (floorScan?.details?.floorSkipped) {
  floorIssues.push("User skipped floor scan — placement uses estimated pose only");
}
const placeFailures = raw.events.filter(
  (e) => e.id === "model-place-result" && e.status === "fail"
);
if (placeFailures.length > 0) {
  const withRing = placeFailures.filter(
    (e) => e.details?.reticleVisibleAtPlace === true
  );
  if (withRing.length > 0) {
    floorIssues.push(
      `${withRing.length} placement(s) failed while cyan ring was visible — often SLAM garbage Y after walking >5m from scan (v0.1.53+ uses locked floor)`
    );
  }
  const garbageY = withRing.filter((e) => {
    const y = detailPositionY(e.details ?? {});
    return y != null && y < 0.12;
  });
  if (garbageY.length > 0) {
    floorIssues.push(
      `${garbageY.length} failed placement(s) had raw floor Y below 0.12m — SLAM tracking spike`
    );
  }
}
if (
  lastHitStats.cameraPathM != null &&
  lastHitStats.cameraPathAtScanComplete != null &&
  lastHitStats.cameraPathM - lastHitStats.cameraPathAtScanComplete > 5 &&
  lastHitStats.lockedFloorY != null &&
  lastHitStats.lastRawHitTestFloorY != null &&
  lastHitStats.lastRawHitTestFloorY < lastHitStats.lockedFloorY - 0.25
) {
  floorIssues.push(
    `Far from scan (${Math.round((lastHitStats.cameraPathM - lastHitStats.cameraPathAtScanComplete) * 100) / 100}m) with garbage hit Y ${lastHitStats.lastRawHitTestFloorY}m vs lock ${lastHitStats.lockedFloorY}m`
  );
}
if (lastHitStats.ringLargeJumps != null && lastHitStats.ringLargeJumps > 3) {
  floorIssues.push(
    `Ring flicker: ${lastHitStats.ringLargeJumps} large jumps between hit-test and plane sources (fixed v0.1.87+ scan tilt gate and hit-test priority)`
  );
}
if (lastHitStats.hitTestScaleAnomalies != null && lastHitStats.hitTestScaleAnomalies > 20) {
  floorIssues.push(
    `Hit-test scale drift: ${lastHitStats.hitTestScaleAnomalies} frames with non-unit transform scale`
  );
}
if (lastHitStats.reticleFootprintM != null && lastHitStats.reticleFootprintM < 0.4) {
  floorIssues.push(
    `Reticle preview diameter ${lastHitStats.reticleFootprintM}m — ring may look smaller than furniture`
  );
}
if (
  (lastHitStats.slamJumpVerticalSkips ?? 0) >= 40 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) === 0 &&
  placements.length >= 1
) {
  floorIssues.push(
    `${lastHitStats.slamJumpVerticalSkips} vertical SLAM skips with 0 corrections — crouch/stand map snap uncorrected (fixed v0.1.98+ XZ tracking + vertical floor shift)`
  );
}
if (
  (lastHitStats.cameraPathM ?? 0) >= 0.8 &&
  placements.length >= 1 &&
  (lastHitStats.sessionFloorMaxAnchorDriftM ?? 0) >= 0.05 &&
  (lastHitStats.sessionFloorSoftDriftCorrections ?? 0) === 0 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) === 0 &&
  (lastHitStats.slamJumpLargeCorrections ?? 0) === 0 &&
  (lastHitStats.slamJumpRemainderCorrections ?? 0) === 0
) {
  floorIssues.push(
    `${lastHitStats.sessionFloorMaxAnchorDriftM}m anchor drift after ${lastHitStats.cameraPathM}m walk with 0 corrections — gradual SLAM rubber-band (fixed v0.1.99+ soft anchor drift)`
  );
}
if (
  (lastHitStats.slamJumpHorizontalSkips ?? 0) >= 1 &&
  (lastHitStats.slamJumpLargeCorrections ?? 0) === 0 &&
  (lastHitStats.slamJumpRemainderCorrections ?? 0) === 0 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) === 0 &&
  placements.length >= 1 &&
  (lastHitStats.cameraPathM ?? 0) >= 1
) {
  floorIssues.push(
    `${lastHitStats.slamJumpHorizontalSkips} large horizontal SLAM skip(s) with 0 correction after ${lastHitStats.cameraPathM}m walk — map relocal uncorrected (fixed v0.1.100+ large-jump remainder queue)`
  );
}
if (
  lastHitStats.worldRepinCorrections != null &&
  lastHitStats.worldRepinCorrections >= 10 &&
  lastHitStats.slamRelocalizationCorrections != null &&
  lastHitStats.slamRelocalizationCorrections >= 10 &&
  lastHitStats.placedMaxDriftM === 0
) {
  floorIssues.push(
    `${lastHitStats.worldRepinCorrections} SLAM floor repins with placedMaxDriftM=0 — false relocal corrections likely shifted model vs real world (fixed v0.1.84+ vertical spike gate)`
  );
}
if (
  lastHitStats.cameraVerticalRangeM != null &&
  lastHitStats.cameraVerticalRangeM > 0.7 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) >= 5
) {
  floorIssues.push(
    `Large viewer Y range (${lastHitStats.cameraVerticalRangeM}m) with ${lastHitStats.slamRelocalizationCorrections} SLAM corrections — crouch/stand may have triggered false repins`
  );
}
if (lastHitStats.floorScanComplete === false && lastHitStats.hitReady === true) {
  floorIssues.push("Floor hits detected but scan never completed — picker stayed hidden until skip");
}
if (
  lastHitStats.placementAnchorBindSuccess != null &&
  lastHitStats.placementAnchorBindSuccess > 0 &&
  lastHitStats.placementAnchorUpdates === 0 &&
  lastHitStats.placedWorldX == null
) {
  floorIssues.push(
    "XR anchor bound then sealed (single-shot) — placement should stay pinned; check placedMaxDriftM while moving"
  );
}
if (
  lastHitStats.placementAnchorUpdates != null &&
  lastHitStats.placementAnchorUpdates > 10 &&
  lastHitStats.placementAnchorBindSuccess != null &&
  lastHitStats.placementAnchorBindSuccess > 0 &&
  (lastHitStats.sessionFloorRootUpdates ?? lastHitStats.placementAnchorUpdates) > 10
) {
  floorIssues.push(
    `Session floor root updated ${lastHitStats.sessionFloorRootUpdates ?? lastHitStats.placementAnchorUpdates} times — per-frame anchor churn causes drift (fixed v0.1.61+ pose lock after placement)`
  );
}
if (
  lastHitStats.virtualFloorPlaneY != null &&
  lastHitStats.lockedFloorY != null &&
  Math.abs(lastHitStats.virtualFloorPlaneY - (lastHitStats.lockedFloorY - 0.02)) > 0.03
) {
  floorIssues.push(
    `Virtual floor plane Y (${lastHitStats.virtualFloorPlaneY}m) stale vs locked floor (${lastHitStats.lockedFloorY}m) — caused placement Y mismatch (fixed v0.1.61+ relock sync)`
  );
}
if (
  lastHitStats.placedMaxDriftM != null &&
  lastHitStats.placedMaxDriftM >= 0.2 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) >= 1
) {
  floorIssues.push(
    `${lastHitStats.placedMaxDriftM}m drift after ${lastHitStats.slamRelocalizationCorrections} SLAM correction — false relocal likely (fixed v0.1.89+ anchor resync, 45cm threshold while placed, 15cm cap)`
  );
}
if (
  (lastHitStats.placedScaleCorrections ?? 0) >= (placements.length || 1) &&
  placements.some((p) => {
    const ev = raw.events.find(
      (e) => e.id === "model-place-result" && e.name === p.name
    );
    const d = ev?.details ?? {};
    return (d.arScaleFactor ?? 1) > 1.05;
  })
) {
  floorIssues.push(
    `${lastHitStats.placedScaleCorrections} scale corrections reset catalog AR scale — models shrank live (fixed v0.1.92+ preserve arScaleFactor)`
  );
}
if (
  (lastHitStats.floorRelockPromotions ?? 0) >= 1 &&
  placements.length >= 1 &&
  (lastHitStats.slamRelocalizationCorrections ?? 0) === 0
) {
  floorIssues.push(
    `Floor relock (${lastHitStats.floorRelockPromotions}) after placement shifted session floor — caused ${lastHitStats.placedMaxDriftM ?? "?"}m drift (fixed v0.1.90+ no relock while placed)`
  );
}
const placementFloorSpreadM =
  floorYs.length >= 2 ? Math.max(...floorYs) - Math.min(...floorYs) : 0;
if (placementFloorSpreadM > 0.05 && placements.length >= 2) {
  floorIssues.push(
    `Placement floor Y spread ${placementFloorSpreadM.toFixed(3)}m across ${placements.length} models — inconsistent height (fixed v0.1.90+ no relock while placed)`
  );
}
if (
  lastHitStats.floorScanComplete === false &&
  lastHitStats.floorWaitMs != null &&
  lastHitStats.floorWaitMs >= 10000 &&
  (lastHitStats.framesWithResults ?? 0) === 0
) {
  floorIssues.push(
    "Floor scan timed out with 0 hit-test frames — phone likely pointed up; tilt down and pan slowly (fixed v0.1.85+ tilt gate)"
  );
}
if (
  lastHitStats.sessionFloorRootUpdates != null &&
  lastHitStats.sessionFloorRootUpdates >= 30 &&
  lastHitStats.placedMaxDriftM != null &&
  lastHitStats.placedMaxDriftM >= 0.25
) {
  floorIssues.push(
    `${lastHitStats.sessionFloorRootUpdates} session floor anchor updates with ${lastHitStats.placedMaxDriftM}m drift — model likely vanished from view (fixed v0.1.85+ pose lock)`
  );
}
if (
  lastHitStats.lockedFloorY != null &&
  lastHitStats.lockedFloorY < 0.05
) {
  floorIssues.push(
    `Negative or invalid locked floor Y (${lastHitStats.lockedFloorY}m) — SLAM origin error; placement blocked in v0.1.43+`
  );
}
if (
  lastHitStats.cameraVerticalRangeM != null &&
  lastHitStats.cameraVerticalRangeM > 1.2 &&
  lastHitStats.placedMaxDriftM != null &&
  lastHitStats.placedMaxDriftM > 0.04
) {
  floorIssues.push(
    `Crouch/look-under (vertical range ${lastHitStats.cameraVerticalRangeM}m) caused ${lastHitStats.placedMaxDriftM}m placement drift`
  );
}
if (
  lastHitStats.worldRepinCorrections != null &&
  lastHitStats.worldRepinCorrections > 50
) {
  floorIssues.push(
    `World repin corrected placement ${lastHitStats.worldRepinCorrections} times — anchor bind may have failed`
  );
}
if (
  lastHitStats.floorScanComplete &&
  lastHitStats.hitTestMode === "plane-detection" &&
  (lastHitStats.framesWithResults ?? 0) > 100 &&
  (lastHitStats.planeRingUpdatesSkipped ?? 0) === 0
) {
  floorIssues.push(
    "Ring still follows plane-detection while hit-test is active — upgrade fixes plane/hit-test fighting"
  );
}

const flowEvents = raw.events.filter((e) => e.id.startsWith("flow-"));
const flowTiming = {};
for (const e of flowEvents) {
  flowTiming[e.id] = e.elapsedMs;
}
const bootToArTap = flowEvents.find((e) => e.id === "flow-start-ar-tap")?.elapsedMs;
const arTapToXr = (() => {
  const tap = flowEvents.find((e) => e.id === "flow-start-ar-tap")?.elapsedMs;
  const xr = flowEvents.find((e) => e.id === "flow-xr-active")?.elapsedMs;
  return tap != null && xr != null ? xr - tap : null;
})();
if (arTapToXr != null && arTapToXr > 3000) {
  floorIssues.push(`Slow AR startup: ${arTapToXr}ms from Start AR tap to immersive session`);
}

const summary = {
  sourceFile: basename(sessionPath),
  analyzedAt: new Date().toISOString(),
  depth: depthAnalysis,
  depthWarnings,
  depthOcclusionActive,
  depthUsage,
  floorDetection: {
    hitReady: lastHitStats.hitReady ?? null,
    framesWithResults: lastHitStats.framesWithResults ?? null,
    cameraRayHits: lastHitStats.cameraRayHits ?? null,
    planeHits: lastHitStats.planeHits ?? null,
    hitTestMode: lastHitStats.hitTestMode ?? null,
    xrFramesProcessed: lastHitStats.xrFramesProcessed ?? null,
    lastRayReject: lastHitStats.lastRayReject ?? null,
    ringPlaceable: lastHitStats.ringPlaceable ?? null,
    ringObjectRejects: lastHitStats.ringObjectRejects ?? null,
    ringElevatedRecoveries: lastHitStats.ringElevatedRecoveries ?? null,
    ringWallRejects: lastHitStats.ringWallRejects ?? null,
    lockedFloorY: lastHitStats.lockedFloorY ?? null,
    lastRawHitTestFloorY: lastHitStats.lastRawHitTestFloorY ?? null,
    lastOriginY: lastHitStats.lastOriginY ?? null,
    lastForwardY: lastHitStats.lastForwardY ?? null,
    floorScanStatus: floorScan?.status ?? null,
    issues: floorIssues,
  },
  placementCount: placements.length,
  floorYMedianM: median(floorYs),
  submergedCount: analyzed.filter((r) => r.submerged).length,
  sizeInconsistentCount: analyzed.filter((r) => r.sizeConsistent === false).length,
  floorDriftCount: analyzed.filter((r) => r.floorYDrift).length,
  flowTiming,
  bootToArTapMs: bootToArTap ?? null,
  arTapToXrMs: arTapToXr,
  issues,
  placements: analyzed,
};

const outDir = join(dir, "..", "test-results");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `session-analysis-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");

console.log(JSON.stringify(summary, null, 2));
console.log(`\nWrote ${outPath}`);
process.exit(summary.issues.length > 0 ? 1 : 0);
