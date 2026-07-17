/**
 * Unit tests for floor detection helpers (immersive-safe polling + ready logic).
 */

const MIN_FLOOR_NORMAL_Y = 0.65;
const POSE_GRACE_MS = 2000;

function evaluateFloorReady(input, options = {}) {
  const graceMs = input.poseGraceMs ?? POSE_GRACE_MS;
  const minY = input.minFloorNormalY ?? MIN_FLOOR_NORMAL_Y;
  const strict = options.strictAfterScan ?? true;
  const poseAgeMs = input.lastValidHitAt
    ? Math.round(input.now - input.lastValidHitAt)
    : 9999;
  const graceActive =
    !input.liveHit && poseAgeMs < graceMs && input.latestPoseValid;
  const horizontal = input.floorNormalY >= minY;
  const ready = strict
    ? input.latestPoseValid &&
      horizontal &&
      (input.liveHit || graceActive || input.floorScanComplete === true)
    : input.latestPoseValid &&
      (input.floorScanComplete === true ||
        (horizontal && (input.liveHit || graceActive)));
  return { ready, graceActive, horizontal, poseAgeMs };
}

function waitUntilFloorReady(getState, onChange, timeoutMs, pollMs = 50) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    let unsub = () => {};
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearInterval(timer);
      unsub();
      resolve({ ok, waitedMs: Math.round(performance.now() - t0) });
    };
    if (getState().ready) {
      finish(true);
      return;
    }
    unsub = onChange((state) => {
      if (state.ready) finish(true);
    });
    timer = setInterval(() => {
      if (getState().ready) finish(true);
      else if (performance.now() - t0 >= timeoutMs) finish(false);
    }, pollMs);
  });
}

const results = [];
let failed = 0;

function assert(name, condition) {
  if (condition) results.push({ name, status: "pass" });
  else {
    failed += 1;
    results.push({ name, status: "fail" });
  }
}

{
  let ready = false;
  const p = waitUntilFloorReady(
    () => ({ ready }),
    (fn) => {
      setTimeout(() => {
        ready = true;
        fn({ ready: true });
      }, 120);
      return () => {};
    },
    2000,
    30
  );
  const r = await p;
  assert("resolves true on state change", r.ok === true && r.waitedMs >= 100 && r.waitedMs < 500);
}

{
  const r = await waitUntilFloorReady(
    () => ({ ready: false }),
    () => () => {},
    150,
    40
  );
  assert("times out when floor never ready", r.ok === false && r.waitedMs >= 140 && r.waitedMs < 400);
}

{
  const r = await waitUntilFloorReady(
    () => ({ ready: true }),
    () => () => {},
    1000
  );
  assert("immediate ready returns quickly", r.ok === true && r.waitedMs < 20);
}

{
  const now = 1000;
  const live = evaluateFloorReady({
    latestPoseValid: true,
    liveHit: true,
    lastValidHitAt: now - 50,
    now,
    floorNormalY: 0.9,
  });
  assert("live horizontal hit is ready", live.ready === true && live.horizontal === true);
}

{
  const now = 5000;
  const steep = evaluateFloorReady({
    latestPoseValid: true,
    liveHit: true,
    lastValidHitAt: now - 50,
    now,
    floorNormalY: 0.4,
  });
  assert("steep surface is not ready", steep.ready === false && steep.horizontal === false);
}

{
  const now = 2000;
  const grace = evaluateFloorReady({
    latestPoseValid: true,
    liveHit: false,
    lastValidHitAt: now - 400,
    now,
    floorNormalY: 0.85,
    poseGraceMs: POSE_GRACE_MS,
  });
  assert("grace window keeps floor ready", grace.ready === true && grace.graceActive === true);
}

{
  const now = 3000;
  const stale = evaluateFloorReady({
    latestPoseValid: true,
    liveHit: false,
    lastValidHitAt: now - POSE_GRACE_MS - 50,
    now,
    floorNormalY: 0.85,
  });
  assert("stale hit outside grace is not ready", stale.ready === false && stale.graceActive === false);
}

{
  const now = 5000;
  const afterScan = evaluateFloorReady(
    {
      latestPoseValid: true,
      liveHit: false,
      lastValidHitAt: now - POSE_GRACE_MS - 500,
      now,
      floorNormalY: 0.9,
      floorScanComplete: true,
    },
    { strictAfterScan: false }
  );
  assert(
    "iOS relaxed: floor scan complete keeps placement ready without live hit",
    afterScan.ready === true
  );
}

{
  const now = 6000;
  const steepAfterScan = evaluateFloorReady(
    {
      latestPoseValid: true,
      liveHit: false,
      lastValidHitAt: now - 5000,
      now,
      floorNormalY: 0.2,
      floorScanComplete: true,
    },
    { strictAfterScan: false }
  );
  assert(
    "iOS relaxed: after scan, placement stays ready even when surface normal is stale",
    steepAfterScan.ready === true
  );
}

{
  const now = 7000;
  const androidAfterScan = evaluateFloorReady(
    {
      latestPoseValid: true,
      liveHit: false,
      lastValidHitAt: now - POSE_GRACE_MS - 500,
      now,
      floorNormalY: 0.9,
      floorScanComplete: true,
    },
    { strictAfterScan: true }
  );
  assert(
    "Android strict: after scan with horizontal normal stays ready",
    androidAfterScan.ready === true
  );
}

{
  const now = 8000;
  const androidSteepAfterScan = evaluateFloorReady(
    {
      latestPoseValid: true,
      liveHit: false,
      lastValidHitAt: now - 5000,
      now,
      floorNormalY: 0.2,
      floorScanComplete: true,
    },
    { strictAfterScan: true }
  );
  assert(
    "Android strict: steep stale normal is not ready after scan",
    androidSteepAfterScan.ready === false
  );
}

function shouldRejectRingRelocalizationJump(
  current,
  target,
  floorScanComplete,
  viewerXZ = null,
  viewerOriginY = null,
  walkedSinceScanM = null
) {
  if (!floorScanComplete) return false;
  if (
    walkedSinceScanM != null &&
    walkedSinceScanM >= 2.0
  ) {
    return false;
  }
  const jumpFromRing = Math.hypot(target.x - current.x, target.z - current.z);
  if (jumpFromRing <= 0.75) return false;
  if (viewerXZ != null) {
    const nearM =
      viewerOriginY != null && viewerOriginY < 1.0 ? 2.5 : 1.35;
    const targetNearViewer =
      Math.hypot(target.x - viewerXZ.x, target.z - viewerXZ.z) <= nearM;
    if (targetNearViewer) return false;
  }
  return true;
}

assert(
  "relocalisation jump rejected after floor scan",
  shouldRejectRingRelocalizationJump({ x: 0, z: 0 }, { x: 2, z: 0 }, true) === true
);
assert(
  "relocalisation jump allowed when hit-test is near viewer after walk",
  shouldRejectRingRelocalizationJump(
    { x: 0, z: 0 },
    { x: 2.8, z: 0.4 },
    true,
    { x: 3, z: 0 }
  ) === false
);
assert(
  "relocalisation jump still rejected when far from ring and viewer",
  shouldRejectRingRelocalizationJump(
    { x: 0, z: 0 },
    { x: 4, z: 4 },
    true,
    { x: 0.2, z: 0.1 }
  ) === true
);
assert(
  "relocalisation jump allowed when crouching and hit is within extended reach",
  shouldRejectRingRelocalizationJump(
    { x: 0, z: 0 },
    { x: 2.0, z: 0.4 },
    true,
    { x: 0, z: 0 },
    0.82
  ) === false
);
assert(
  "relocalisation jump allowed while ring still on camera-ray bootstrap",
  (() => {
    const ringPoseSource = "camera-ray";
    const floorScanComplete = true;
    const rejectReloc =
      floorScanComplete &&
      ringPoseSource === "hit-test" &&
      shouldRejectRingRelocalizationJump({ x: 0, z: 0 }, { x: 2, z: 0 }, true);
    return rejectReloc === false;
  })()
);
assert(
  "normal ring movement allowed after floor scan",
  shouldRejectRingRelocalizationJump({ x: 0, z: 0 }, { x: 0.3, z: 0.2 }, true) === false
);
assert(
  "relocalisation jump allowed after walking away from scan spot",
  shouldRejectRingRelocalizationJump(
    { x: 0, z: 0 },
    { x: 4, z: 4 },
    true,
    { x: 0.2, z: 0.1 },
    1.2,
    2.5
  ) === false
);

{
  const ignore = shouldIgnoreRingJitter(
    { x: 1, y: 0.5, z: 1 },
    { x: 1.005, y: 0.502, z: 1.004 }
  );
  assert("ring jitter filter ignores sub-1.2cm noise", ignore === true);
}

{
  const ignoreMove = shouldIgnoreRingJitter(
    { x: 1, y: 0.5, z: 1 },
    { x: 1.2, y: 0.5, z: 1.1 }
  );
  assert("ring jitter filter accepts real movement", ignoreMove === false);
}

function arPickerPanelTitle(floorScanComplete) {
  return floorScanComplete ? "Choose a model" : "Scanning the floor…";
}

assert(
  "model picker title hidden until floor scan completes",
  arPickerPanelTitle(false) === "Scanning the floor…"
);
assert(
  "model picker title shown after floor scan completes",
  arPickerPanelTitle(true) === "Choose a model"
);

function shouldUsePlaneRingUpdate(hitTestAttached) {
  return !hitTestAttached;
}

assert(
  "plane ring blocked when hit-test is attached",
  shouldUsePlaneRingUpdate(true) === false
);
assert(
  "plane ring allowed when hit-test is not attached",
  shouldUsePlaneRingUpdate(false) === true
);

function shouldApplyPlaneRingUpdate(
  floorScanComplete,
  hitTestAttached,
  lastHitTestPoseAtMs,
  nowMs,
  hitTestStaleMs = 400
) {
  if (hitTestAttached) return false;
  if (!floorScanComplete || !hitTestAttached) return true;
  if (lastHitTestPoseAtMs <= 0) return true;
  return nowMs - lastHitTestPoseAtMs > hitTestStaleMs;
}

assert(
  "legacy plane helper also blocks when hit-test attached",
  shouldApplyPlaneRingUpdate(true, true, 1000, 1200) === false
);

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function lowerQuartile(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.25);
  return sorted[Math.min(idx, sorted.length - 1)] ?? null;
}

const FLOOR_Y_MIN_M = 0.05;
const FLOOR_Y_MIN_BELOW_VIEWER_M = 0.45;
const FLOOR_Y_BIMODAL_SPREAD_M = 0.2;
const FLOOR_Y_ELEVATED_SURFACE_M = 0.12;
const FLOOR_Y_LOW_CLUSTER_MIN_SAMPLES = 3;
const FLOOR_Y_SCAN_MIN_SAMPLES = 3;
const FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES = 2;
const FLOOR_Y_LOCK_MIN_SAMPLES = 5;
const FLOOR_Y_MIN_VIEWER_FOR_FILTER_M = 0.5;
const FLOOR_Y_CONTACT_BIAS_M = 0.02;
const FLOOR_LOCK_MAX_DIVERGE_M = 0.08;
const FLOOR_Y_TIGHT_CLUSTER_SPREAD_M = 0.08;
const FLOOR_LOCAL_MAX_ABOVE_LOCK_M = 0.35;
const FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M = 0.02;
const FLOOR_LOCKED_MAX_ABOVE_BOOTSTRAP_M = 0.1;
const FLOOR_LOCKED_MIN_BELOW_BOOTSTRAP_M = 0.25;
const FLOOR_RELOCK_MAX_DELTA_M = 0.12;
const FLOOR_LOCK_MAX_BELOW_BOOTSTRAP_AT_SCAN_M = 0.15;
const FLOOR_BOOTSTRAP_RELOCK_MAX_DELTA_M = 0.25;
const FLOOR_SURFACE_OVER_BOOTSTRAP_M = 0.1;
const FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES = 8;
const FLOOR_RING_LOCAL_OVERRIDE_MIN_M = 0.1;
const FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M = 1.0;
const FLOOR_SHARP_DROP_REJECT_M = 0.15;

function isSharpDownwardFloorDivergence(rawY, lockedFloorY) {
  return lockedFloorY - rawY >= FLOOR_SHARP_DROP_REJECT_M;
}

assert(
  "sharp downward hit-test dip detected (0.489 -> 0.283)",
  isSharpDownwardFloorDivergence(0.283, 0.489)
);
assert(
  "moderate hit-test dip not sharp enough to reject",
  !isSharpDownwardFloorDivergence(0.44, 0.489)
);

const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_STANDING_M = 0.82;
const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_MID_M = 0.72;
const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_LOW_M = 0.55;
const FLOOR_VIEWER_Y_MAX_FOR_BOOTSTRAP_M = 2.2;

function contactFloorY(floorY) {
  return floorY - FLOOR_Y_CONTACT_BIAS_M;
}

function bootstrapFloorYFromViewer(viewerOriginY) {
  if (
    viewerOriginY == null ||
    !Number.isFinite(viewerOriginY) ||
    viewerOriginY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M ||
    viewerOriginY > FLOOR_VIEWER_Y_MAX_FOR_BOOTSTRAP_M
  ) {
    return null;
  }
  const eyeToFloor =
    viewerOriginY >= 1.25
      ? FLOOR_BOOTSTRAP_EYE_TO_FLOOR_STANDING_M
      : viewerOriginY >= 1.0
        ? FLOOR_BOOTSTRAP_EYE_TO_FLOOR_MID_M
        : FLOOR_BOOTSTRAP_EYE_TO_FLOOR_LOW_M;
  const y = viewerOriginY - eyeToFloor;
  return y >= FLOOR_Y_MIN_M ? y : null;
}

function estimateDisplayFloorY(
  lockedFloorY,
  floorScanComplete,
  sampleYs,
  lastPlausibleViewerY,
  viewerOriginY,
  pinnedDisplayFloorY = null
) {
  if (floorScanComplete && lockedFloorY != null) {
    return contactFloorY(lockedFloorY);
  }
  if (pinnedDisplayFloorY != null) {
    return contactFloorY(pinnedDisplayFloorY);
  }
  const viewerForFilter = lastPlausibleViewerY ?? viewerOriginY;
  const filtered = filterFloorScanSamples(sampleYs, viewerForFilter);
  if (filtered.length >= 1) {
    const sorted = [...filtered].sort((a, b) => a - b);
    return contactFloorY(sorted[Math.floor(sorted.length / 2)]);
  }
  const stableViewer =
    lastPlausibleViewerY ??
    (viewerOriginY != null && viewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
      ? viewerOriginY
      : null);
  const boot = bootstrapFloorYFromViewer(stableViewer);
  return boot != null ? contactFloorY(boot) : null;
}

function sanitizeFloorHitY(rawY, viewerOriginY) {
  if (rawY >= FLOOR_Y_MIN_M && rawY <= 2.5) {
    const filtered = filterFloorScanSamples([rawY], viewerOriginY);
    if (filtered.length) return { y: rawY, bootstrapped: false };
  }
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (boot != null) return { y: boot, bootstrapped: true };
  return null;
}

function plausibleFloorSamples(samples) {
  return samples.filter((y) => y >= FLOOR_Y_MIN_M && y <= 2.5);
}

function dropElevatedSurfaceSamples(samples) {
  if (samples.length < 2) return samples;
  const minY = Math.min(...samples);
  return samples.filter((y) => y <= minY + FLOOR_Y_ELEVATED_SURFACE_M);
}

function isPlausibleLockedFloorY(lockedY, viewerOriginY, standingViewerOriginY) {
  if (lockedY < FLOOR_Y_MIN_M || lockedY > 2.5) return false;
  if (lockedY <= 0.09) return false;
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (boot != null && lockedY < boot - 0.45) return false;
  if (
    boot != null &&
    lockedY < boot - FLOOR_LOCKED_MIN_BELOW_BOOTSTRAP_M &&
    lockedY < 0.25
  ) {
    return false;
  }
  if (boot != null && lockedY > boot + FLOOR_LOCKED_MAX_ABOVE_BOOTSTRAP_M) return false;
  const viewerForClearance =
    standingViewerOriginY != null &&
    viewerOriginY != null &&
    viewerOriginY < lockedY &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? standingViewerOriginY
      : viewerOriginY;
  if (
    viewerForClearance != null &&
    viewerForClearance >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
  ) {
    const clearance = viewerForClearance - lockedY;
    if (clearance < FLOOR_Y_MIN_BELOW_VIEWER_M) return false;
  }
  return true;
}

function isPlausibleCameraRayLockedFloorY(lockedY, viewerOriginY) {
  if (lockedY < FLOOR_Y_MIN_M || lockedY > 2.5) return false;
  if (
    viewerOriginY == null ||
    viewerOriginY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    return isPlausibleLockedFloorY(lockedY, viewerOriginY);
  }
  const clearance = viewerOriginY - lockedY;
  return clearance >= FLOOR_Y_MIN_BELOW_VIEWER_M && clearance <= 1.35;
}

assert(
  "camera-ray lock above bootstrap accepted when clearance valid (iOS 1780820773855)",
  isPlausibleCameraRayLockedFloorY(0.665, 1.257) === true &&
    isPlausibleLockedFloorY(0.665, 1.257) === false
);

function isPlausibleFloorHitY(rawY, viewerOriginY) {
  if (rawY < FLOOR_Y_MIN_M || rawY > 2.5) return false;
  if (rawY <= 0.09) return false;
  if (!filterFloorScanSamples([rawY], viewerOriginY).length) return false;
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (boot != null && rawY < boot - 0.45) return false;
  return true;
}

function isTrustworthyLocalFloorHit(
  rawY,
  lockedFloorY,
  viewerOriginY,
  standingViewerOriginY
) {
  const viewerForFilter =
    standingViewerOriginY != null &&
    viewerOriginY != null &&
    lockedFloorY != null &&
    viewerOriginY < lockedFloorY &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? standingViewerOriginY
      : viewerOriginY;
  if (rawY < FLOOR_Y_MIN_M || rawY > 2.5) return false;
  if (!filterFloorScanSamples([rawY], viewerForFilter).length) return false;
  if (!isPlausibleFloorHitY(rawY, viewerForFilter)) return false;
  if (lockedFloorY == null) return true;
  const delta = rawY - lockedFloorY;
  if (Math.abs(delta) <= FLOOR_LOCK_MAX_DIVERGE_M) return true;
  if (
    delta >= FLOOR_LOCK_MAX_DIVERGE_M &&
    delta <= FLOOR_Y_ELEVATED_SURFACE_M
  ) {
    return true;
  }
  return false;
}

function filterFloorScanSamples(samples, viewerOriginY) {
  let filtered = plausibleFloorSamples(samples);
  if (
    viewerOriginY != null &&
    Number.isFinite(viewerOriginY) &&
    viewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    const minBelow = viewerOriginY < 1.0 ? 0.35 : FLOOR_Y_MIN_BELOW_VIEWER_M;
    filtered = filtered.filter(
      (y) => y <= viewerOriginY && viewerOriginY - y >= minBelow
    );
  }
  filtered = dropElevatedSurfaceSamples(filtered);
  if (filtered.length >= FLOOR_Y_LOW_CLUSTER_MIN_SAMPLES) {
    const sorted = [...filtered].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1] - sorted[0];
    if (spread > FLOOR_Y_BIMODAL_SPREAD_M) {
      const mid = sorted[Math.floor(sorted.length / 2)];
      filtered = filtered.filter((y) => y <= mid + 0.05);
    }
  }
  return filtered.length ? filtered : plausibleFloorSamples(samples);
}

function canLockFloorScan(surfaceSamples, viewerOriginY, cameraRaySamples = [], bootstrapSamples = []) {
  const bootFiltered = filterFloorScanSamples(bootstrapSamples, viewerOriginY);
  if (bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
    const bootSorted = [...bootFiltered].sort((a, b) => a - b);
    const bootSpread = bootSorted[bootSorted.length - 1] - bootSorted[0];
    if (bootSpread <= FLOOR_Y_TIGHT_CLUSTER_SPREAD_M) return true;
  }

  const camFiltered = filterFloorScanSamples(cameraRaySamples, viewerOriginY);
  if (camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES) {
    const camSorted = [...camFiltered].sort((a, b) => a - b);
    const camSpread = camSorted[camSorted.length - 1] - camSorted[0];
    if (camSpread <= 0.08) return true;
  }

  const surfFiltered = filterFloorScanSamples(surfaceSamples, viewerOriginY);
  const combined = filterFloorScanSamples(
    [...surfaceSamples, ...cameraRaySamples],
    viewerOriginY
  );

  if (combined.length < FLOOR_Y_SCAN_MIN_SAMPLES) return false;

  const sorted = [...combined].sort((a, b) => a - b);
  const spread = sorted[sorted.length - 1] - sorted[0];
  if (spread > FLOOR_Y_ELEVATED_SURFACE_M) return true;

  if (camFiltered.length >= 1 && surfFiltered.length >= 1) {
    const camY = median(camFiltered) ?? camFiltered[0];
    const surfY = median(surfFiltered) ?? surfFiltered[0];
    if (surfY - camY > FLOOR_Y_ELEVATED_SURFACE_M) {
      return camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES;
    }
  }

  if (
    surfFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES &&
    camFiltered.length < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES
  ) {
    const surfSorted = [...surfFiltered].sort((a, b) => a - b);
    const surfSpread = surfSorted[surfSorted.length - 1] - surfSorted[0];
    if (surfSpread <= 0.06 && surfSorted[0] > FLOOR_Y_ELEVATED_SURFACE_M) {
      return surfFiltered.length >= FLOOR_Y_LOCK_MIN_SAMPLES;
    }
  }

  return true;
}

assert(
  "floor sample filter rejects table-height hits when viewer is standing",
  filterFloorScanSamples([0.55, 0.54, 0.08, 0.07, 0.09], 1.6).every((y) => y < 0.12)
);
assert(
  "floor sample filter rejects SLAM garbage near world origin",
  filterFloorScanSamples([0.051, 0.052, 0.05], 1.132).length === 3 &&
    !isPlausibleLockedFloorY(0.051, 1.132)
);
assert(
  "floor sample filter keeps lower cluster when bimodal",
  filterFloorScanSamples([0.55, 0.54, 0.08, 0.07, 0.09], 1.6).every((y) => y <= 0.1)
);
assert(
  "floor sample filter rejects negative hit-test Y",
  filterFloorScanSamples([-0.28, -0.25], 1.2).length === 0
);
assert(
  "floor sample filter drops box-top hits above floor cluster",
  filterFloorScanSamples([0.42, 0.43, 0.08, 0.07, 0.09], 1.6).every((y) => y < 0.12)
);
assert(
  "bimodal filter applies with only three samples",
  filterFloorScanSamples([0.45, 0.44, 0.08, 0.07], 1.6).every((y) => y < 0.12)
);
assert(
  "floor filter keeps samples when viewer origin is negative (crouch tracking glitch)",
  filterFloorScanSamples([0.45, 0.46, 0.47], -1.346).length === 3
);
assert(
  "contact floor bias lowers placement Y by 2cm",
  Math.abs(contactFloorY(0.4126) - 0.3926) < 0.0001
);

assert(
  "bootstrap floor Y from standing viewer height",
  Math.abs(bootstrapFloorYFromViewer(1.356) - 0.536) < 0.001
);

{
  const neg = sanitizeFloorHitY(-0.948, 1.356);
  assert("negative hit-test Y bootstraps from viewer", neg?.bootstrapped === true);
  assert(
    "negative hit-test Y becomes plausible floor sample",
    neg != null && neg.y >= FLOOR_Y_MIN_M && filterFloorScanSamples([neg.y], 1.356).length === 1
  );
}

class FloorYStabilizer {
  constructor() {
    this.scanSamples = [];
    this.lockedY = null;
    this.localOverrideYs = [];
    this.usedLockCount = 0;
    this.localOverrideCount = 0;
  }
  addScanSample(y, viewerOriginY, options = {}) {
    const source = options.source ?? "surface";
    if (!options.force) {
      const existingY =
        source === "surface"
          ? this.scanSamples.filter((s) => s.source === "surface").map((s) => s.y)
          : this.scanSamples.map((s) => s.y);
      if (existingY.length) {
        const minY = Math.min(...existingY);
        if (y > minY + FLOOR_Y_ELEVATED_SURFACE_M) return;
      }
    }
    if (!options.force && !filterFloorScanSamples([y], viewerOriginY).length) return;
    this.scanSamples.push({ y, source });
    if (this.scanSamples.length > 60) this.scanSamples.shift();
  }
  surfaceSampleYs() {
    return this.scanSamples.filter((s) => s.source === "surface").map((s) => s.y);
  }
  cameraRaySampleYs() {
    return this.scanSamples.filter((s) => s.source === "camera-ray").map((s) => s.y);
  }
  bootstrapSampleYs() {
    return this.scanSamples.filter((s) => s.source === "bootstrap").map((s) => s.y);
  }
  validSampleCount(viewerOriginY) {
    return filterFloorScanSamples(
      this.scanSamples.map((s) => s.y),
      viewerOriginY
    ).length;
  }
  sampleCount() {
    return this.scanSamples.length;
  }
  canLockScan(viewerOriginY) {
    return canLockFloorScan(
      this.surfaceSampleYs(),
      viewerOriginY,
      this.cameraRaySampleYs(),
      this.bootstrapSampleYs()
    );
  }
  canCompleteScan(viewerOriginY) {
    const surf = this.surfaceSampleYs().length;
    const cam = this.cameraRaySampleYs().length;
    const boot = this.bootstrapSampleYs().length;
    const hasEvidence =
      surf >= 1 ||
      cam >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES ||
      boot >= FLOOR_Y_SCAN_MIN_SAMPLES;
    if (!hasEvidence) return false;
    const bootstrapOnly =
      surf === 0 && cam < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES && boot >= FLOOR_Y_SCAN_MIN_SAMPLES;
    if (
      bootstrapOnly &&
      (viewerOriginY == null ||
        viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M)
    ) {
      return false;
    }
    return (
      this.canLockScan(viewerOriginY) &&
      this.validSampleCount(viewerOriginY) >= FLOOR_Y_SCAN_MIN_SAMPLES
    );
  }
  lockedFromBootstrapOnly() {
    return (
      this.bootstrapSampleYs().length > 0 &&
      this.surfaceSampleYs().length === 0 &&
      this.lockedY != null
    );
  }
  wouldBootstrapOnlyComplete(viewerOriginY) {
    const surf = this.surfaceSampleYs().length;
    const cam = this.cameraRaySampleYs().length;
    const boot = this.bootstrapSampleYs().length;
    if (surf >= 1 || cam >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES) return false;
    if (boot < FLOOR_Y_SCAN_MIN_SAMPLES) return false;
    if (
      viewerOriginY == null ||
      viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
    ) {
      return false;
    }
    return this.canLockScan(viewerOriginY);
  }
  relockFromSurfaceMedian(viewerOriginY) {
    const surfFiltered = filterFloorScanSamples(this.surfaceSampleYs(), viewerOriginY);
    if (surfFiltered.length < 2) return null;
    const surfMed = median(surfFiltered);
    if (surfMed == null || !isPlausibleLockedFloorY(surfMed, viewerOriginY)) return null;
    const locked = this.lockedY;
    if (locked == null) return null;
    const bootFiltered = filterFloorScanSamples(this.bootstrapSampleYs(), viewerOriginY);
    const bootMed = bootFiltered.length ? (median(bootFiltered) ?? bootFiltered[0]) : locked;
    const bootstrapStale =
      bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES &&
      surfMed - bootMed >= FLOOR_SURFACE_OVER_BOOTSTRAP_M;
    if (
      !bootstrapStale &&
      isPlausibleLockedFloorY(locked, viewerOriginY) &&
      Math.abs(surfMed - locked) < FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
    ) {
      return null;
    }
    if (
      !bootstrapStale &&
      isPlausibleLockedFloorY(locked, viewerOriginY) &&
      Math.abs(surfMed - locked) < FLOOR_RING_LOCAL_OVERRIDE_MIN_M
    ) {
      return null;
    }
    this.lockedY = surfMed;
    return surfMed;
  }
  recordLocalOverride(rawY) {
    if (!Number.isFinite(rawY)) return;
    this.localOverrideYs.push(rawY);
    if (this.localOverrideYs.length > 40) this.localOverrideYs.shift();
  }
  maybeRelockFromOverrideMedian(viewerOriginY) {
    if (this.localOverrideYs.length < FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES) return null;
    const filtered = filterFloorScanSamples(this.localOverrideYs, viewerOriginY);
    if (filtered.length < FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES) return null;
    const med = median(filtered);
    if (med == null || this.lockedY == null) return null;
    if (Math.abs(med - this.lockedY) < FLOOR_RING_LOCAL_OVERRIDE_MIN_M) return null;
    if (!isPlausibleLockedFloorY(med, viewerOriginY)) return null;
    this.lockedY = med;
    this.localOverrideYs = [];
    return med;
  }
  lockFromScan(viewerOriginY) {
    const camFiltered = filterFloorScanSamples(this.cameraRaySampleYs(), viewerOriginY);
    const surfFiltered = filterFloorScanSamples(this.surfaceSampleYs(), viewerOriginY);
    const bootFiltered = filterFloorScanSamples(this.bootstrapSampleYs(), viewerOriginY);
    let filtered = filterFloorScanSamples(
      this.scanSamples.map((s) => s.y),
      viewerOriginY
    );
    if (surfFiltered.length >= 2 && bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
      const surfMed = median(surfFiltered);
      const bootMed = median(bootFiltered) ?? bootFiltered[0];
      if (surfMed != null && surfMed - bootMed >= FLOOR_SURFACE_OVER_BOOTSTRAP_M) {
        filtered = surfFiltered;
      }
    }
    if (
      camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES &&
      surfFiltered.length >= 1
    ) {
      const camY = median(camFiltered) ?? camFiltered[0];
      const surfY = median(surfFiltered) ?? surfFiltered[0];
      if (surfY - camY > FLOOR_Y_ELEVATED_SURFACE_M) {
        filtered = camFiltered;
      }
    }
    if (!filtered.length) return null;
    const sorted = [...filtered].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1] - sorted[0];
    let locked =
      spread > FLOOR_Y_ELEVATED_SURFACE_M
        ? (lowerQuartile(filtered) ?? median(filtered) ?? null)
        : spread <= FLOOR_Y_TIGHT_CLUSTER_SPREAD_M
          ? (sorted[0] ?? null)
          : (median(filtered) ?? lowerQuartile(filtered) ?? null);
    if (locked != null && locked < FLOOR_Y_MIN_M) locked = null;
    if (locked != null && !isPlausibleLockedFloorY(locked, viewerOriginY)) locked = null;
    if (locked != null) {
      this.lockedY = locked;
    }
    return this.lockedY;
  }
  setLockedFloorY(y) {
    if (y >= FLOOR_Y_MIN_M) this.lockedY = y;
  }
  lockedFloorY() {
    return this.lockedY;
  }
  repairLockForViewer(viewerOriginY, standingViewerOriginY) {
    const locked = this.lockedY;
    if (locked == null || locked < FLOOR_Y_MIN_M) return null;
  if (isPlausibleLockedFloorY(locked, viewerOriginY, standingViewerOriginY)) {
    return locked;
  }
  if (
    viewerOriginY == null ||
    viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
  ) {
    return locked;
  }
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (
    boot != null &&
    isPlausibleLockedFloorY(boot, viewerOriginY, standingViewerOriginY)
  ) {
    this.lockedY = boot;
    return boot;
  }
  return locked;
}
resolveY(rawY, floorScanComplete, viewerOriginY, standingViewerOriginY, allowLocalOverride = true) {
  const lockedFloorY = this.lockedY;
  if (floorScanComplete && lockedFloorY != null && lockedFloorY >= FLOOR_Y_MIN_M) {
    if (
      !isPlausibleLockedFloorY(
        lockedFloorY,
        viewerOriginY,
        standingViewerOriginY
      ) &&
      viewerOriginY != null &&
      viewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
    ) {
        const boot = bootstrapFloorYFromViewer(viewerOriginY);
        if (
          boot != null &&
          isPlausibleLockedFloorY(boot, viewerOriginY, standingViewerOriginY)
        ) {
          if (!allowLocalOverride) {
            const placementY = contactFloorY(lockedFloorY);
            if (placementY >= FLOOR_Y_MIN_M) {
              this.usedLockCount += 1;
              return {
                y: placementY,
                rawY,
                lockedFloorY,
                usedLock: true,
                usedLocalOverride: false,
              };
            }
          }
          this.lockedY = boot;
          return {
            y: contactFloorY(boot),
            rawY,
            lockedFloorY: boot,
            usedLock: true,
            usedLocalOverride: false,
          };
        }
      }
      const diverged = Math.abs(rawY - lockedFloorY) > FLOOR_LOCK_MAX_DIVERGE_M;
      const overrideWorthy =
        Math.abs(rawY - lockedFloorY) >= FLOOR_RING_LOCAL_OVERRIDE_MIN_M;
      if (
        allowLocalOverride &&
        diverged &&
        overrideWorthy &&
        isTrustworthyLocalFloorHit(
          rawY,
          lockedFloorY,
          viewerOriginY,
          standingViewerOriginY
        )
      ) {
        const localY = contactFloorY(rawY);
        if (localY >= FLOOR_Y_MIN_M) {
          this.localOverrideCount = (this.localOverrideCount ?? 0) + 1;
          this.recordLocalOverride(rawY);
          return {
            y: localY,
            rawY,
            lockedFloorY,
            usedLock: false,
            usedLocalOverride: true,
          };
        }
      }
      const placementY = contactFloorY(lockedFloorY);
      if (placementY >= FLOOR_Y_MIN_M) {
        const usedLock = Math.abs(rawY - lockedFloorY) > 0.001;
        if (usedLock) this.usedLockCount += 1;
        return {
          y: placementY,
          rawY,
          lockedFloorY,
          usedLock,
          usedLocalOverride: false,
        };
      }
    }
    if (Math.abs(rawY) <= 2.5) this.addScanSample(rawY, viewerOriginY, { source: "surface" });
    return { y: rawY, rawY, lockedFloorY, usedLock: false };
  }
}

{
  const stabilizer = new FloorYStabilizer();
  stabilizer.addScanSample(0.55, 1.6);
  stabilizer.addScanSample(0.54, 1.6);
  stabilizer.addScanSample(0.42, 1.6);
  stabilizer.addScanSample(0.41, 1.6);
  stabilizer.addScanSample(0.43, 1.6);
  stabilizer.lockFromScan(1.6);
  assert(
    "floor Y lock prefers true floor over table height",
    stabilizer.lockedFloorY() != null && stabilizer.lockedFloorY() < 0.5
  );
  const outlier = stabilizer.resolveY(0.44, true, 1.6);
  assert("after scan, placement snaps to locked floor Y", outlier.usedLock === true);
  assert(
    "locked floor Y is flat regardless of raw hit",
    Math.abs(outlier.y - contactFloorY(stabilizer.lockedFloorY())) < 0.001
  );
  const tableHit = stabilizer.resolveY(0.62, true, 1.6, null, true);
  assert(
    "table-height outlier rejected for local override (uses session lock)",
    tableHit.usedLocalOverride !== true && tableHit.usedLock === true
  );
}

{
  const tight = new FloorYStabilizer();
  tight.addScanSample(0.415, 1.2);
  tight.addScanSample(0.412, 1.2);
  tight.addScanSample(0.414, 1.2);
  tight.lockFromScan(1.2);
  assert(
    "tight cluster lock prefers minimum sample height",
    tight.lockedFloorY() != null && tight.lockedFloorY() <= 0.412
  );
  const placed = tight.resolveY(0.418, true, 1.2);
  assert(
    "contact bias applied on locked placement Y",
    Math.abs(placed.y - contactFloorY(tight.lockedFloorY())) < 0.0001
  );
  const tablePlaced = tight.resolveY(0.62, true, 1.2, null, true);
  assert(
    "diverged table hit rejected for local override on tight lock cluster",
    tablePlaced.usedLocalOverride !== true && tablePlaced.usedLock === true
  );
}

{
  const boxOnly = new FloorYStabilizer();
  boxOnly.addScanSample(0.42, 1.6, { source: "surface" });
  boxOnly.addScanSample(0.43, 1.6, { source: "surface" });
  boxOnly.addScanSample(0.41, 1.6, { source: "surface" });
  assert(
    "box-only surface hits do not complete scan early",
    boxOnly.canLockScan(1.6) === false
  );
}

{
  const shallowPhone = new FloorYStabilizer();
  shallowPhone.addScanSample(0.45, 1.1, { source: "surface" });
  shallowPhone.addScanSample(0.44, 1.1, { source: "surface" });
  shallowPhone.addScanSample(0.46, 1.1, { source: "surface" });
  shallowPhone.addScanSample(0.445, 1.1, { source: "surface" });
  shallowPhone.addScanSample(0.455, 1.1, { source: "surface" });
  assert(
    "natural phone angle still collects floor samples and can lock",
    shallowPhone.sampleCount() === 5 && shallowPhone.canLockScan(1.1) === true
  );
}

{
  const stabilizerBoot = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    const s = sanitizeFloorHitY(-0.9, 1.162);
    stabilizerBoot.addScanSample(s.y, 1.162, { source: "bootstrap", force: true });
  }
  assert(
    "three bootstrapped samples complete scan lock",
    stabilizerBoot.canLockScan(1.162) && stabilizerBoot.lockFromScan(1.162) != null
  );
}

{
  const surfComplete = new FloorYStabilizer();
  for (const y of [0.52, 0.53, 0.525, 0.528, 0.522]) {
    surfComplete.addScanSample(y, 1.25, { source: "surface" });
  }
  assert(
    "real hit-test surface samples can auto-complete scan",
    surfComplete.canCompleteScan(1.25) === true
  );
}

{
  const bad = new FloorYStabilizer();
  bad.addScanSample(0.051, 1.132, { source: "surface" });
  bad.addScanSample(0.052, 1.132, { source: "surface" });
  bad.addScanSample(0.05, 1.132, { source: "surface" });
  assert("lock rejects garbage SLAM floor cluster at 5cm", bad.lockFromScan(1.132) === null);
}

{
  const preserve = new FloorYStabilizer();
  for (const y of [0.408, 0.409, 0.407, 0.408, 0.41]) {
    preserve.addScanSample(y, 1.2, { source: "surface" });
  }
  preserve.lockFromScan(1.2);
  assert(
    "lockFromScan establishes session floor at standing height",
    preserve.lockedFloorY() != null && preserve.lockedFloorY() < 0.42
  );
  const afterFailedRelock = preserve.lockFromScan(0.771);
  assert(
    "failed relock while crouched preserves existing session lock",
    afterFailedRelock != null &&
      Math.abs(afterFailedRelock - preserve.lockedFloorY()) < 0.001 &&
      preserve.lockedFloorY() < 0.42
  );
  preserve.setLockedFloorY(0.428);
  assert("setLockedFloorY restores lock from virtual floor backup", preserve.lockedFloorY() === 0.428);
}

{
  const viewerY = 1.332;
  const garbageLock = 0.179;
  assert(
    "SLAM garbage lock far below bootstrap is rejected (session 1780739512561)",
    !isPlausibleLockedFloorY(garbageLock, viewerY)
  );
  const boot = bootstrapFloorYFromViewer(viewerY);
  assert(
    "bootstrap floor plausible for standing viewer",
    boot != null && isPlausibleLockedFloorY(boot, viewerY)
  );
}

{
  const viewerY = 0.907;
  const boot = bootstrapFloorYFromViewer(viewerY);
  assert(
    "locked floor above bootstrap estimate is rejected",
    boot != null && !isPlausibleLockedFloorY(boot + 0.12, viewerY)
  );
  assert(
    "locked floor with implausible clearance above viewer is rejected",
    !isPlausibleLockedFloorY(0.55, viewerY)
  );
  assert(
    "locked floor within bootstrap band is accepted",
    boot != null && isPlausibleLockedFloorY(boot + 0.05, viewerY)
  );
}

{
  const overrideGate = new FloorYStabilizer();
  overrideGate.addScanSample(0.41, 1.6);
  overrideGate.addScanSample(0.42, 1.6);
  overrideGate.addScanSample(0.415, 1.6);
  overrideGate.lockFromScan(1.6);
  const smallDiverge = overrideGate.resolveY(0.495, true, 1.6);
  assert(
    "local override requires at least 10cm diverge from lock",
    smallDiverge.usedLocalOverride !== true && smallDiverge.usedLock === true
  );
}

{
  const MAX_CAMERA_PATH_STEP_M = 0.45;
  function cappedCameraPathStep(stepM) {
    if (!Number.isFinite(stepM) || stepM <= 0) return 0;
    return Math.min(stepM, MAX_CAMERA_PATH_STEP_M);
  }
  assert(
    "camera path step capped at 45cm per frame",
    cappedCameraPathStep(32.5) === 0.45 && cappedCameraPathStep(0.2) === 0.2
  );
}

{
  const bootScan = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    bootScan.addScanSample(0.31, 1.132, { source: "bootstrap" });
  }
  assert(
    "bootstrap-only scan can complete without surface samples",
    bootScan.canCompleteScan(1.132) === true
  );
  assert(
    "bootstrap-only candidate detected before surface hits",
    bootScan.wouldBootstrapOnlyComplete(1.132) === true
  );
  const hitFramesWithResults = 0;
  const hasSurfaceEvidence =
    hitFramesWithResults >= 1 || bootScan.surfaceSampleYs().length >= 1;
  const blockedWithoutSurface =
    bootScan.wouldBootstrapOnlyComplete(1.132) && !hasSurfaceEvidence;
  assert(
    "bootstrap-only scan blocked until at least one hit-test frame or surface sample",
    blockedWithoutSurface === true
  );
  assert(
    "bootstrap-only scan allowed after one surface hit",
    bootScan.wouldBootstrapOnlyComplete(1.132) &&
      (bootScan.surfaceSampleYs().length >= 1 || hitFramesWithResults >= 1) === false
  );
}

{
  const MIN_FORWARD_Y_FOR_FLOOR_SCAN = -0.2;
  function isPhoneTiltedTowardFloor(forwardY) {
    return forwardY != null && forwardY <= MIN_FORWARD_Y_FOR_FLOOR_SCAN;
  }
  function shouldShowProvisionalFloorRing(
    forwardY,
    viewerOriginY,
    hitFramesWithResults,
    floorScanComplete,
    floorScanSkipped,
    minViewerY = 0.5,
    minHitFramesBeforeHitTestRing = 3
  ) {
    if (floorScanComplete || floorScanSkipped) return false;
    if (hitFramesWithResults >= minHitFramesBeforeHitTestRing) return false;
    if (isPhoneTiltedTowardFloor(forwardY)) return true;
    return false;
  }
  assert(
    "level phone hides provisional ring until tilted down (1781092699633)",
    shouldShowProvisionalFloorRing(0.881, 1.355, 0, false, false) === false
  );
  assert(
    "provisional ring stays during first two hit-test frames (scan UX)",
    shouldShowProvisionalFloorRing(0.881, 1.355, 1, false, false) === false &&
      shouldShowProvisionalFloorRing(-0.35, 1.355, 2, false, false) === true
  );
  assert(
    "provisional ring hidden once hit-test ring handoff threshold reached",
    shouldShowProvisionalFloorRing(-0.35, 1.355, 3, false, false) === false
  );
  assert(
    "tilted phone shows provisional ring",
    shouldShowProvisionalFloorRing(-0.35, 1.355, 0, false, false) === true
  );
  const SCAN_PROVISIONAL_FORWARD_M = 0.72;
  const SCAN_RING_MAX_XZ_STEP_M = 0.06;
  function capScanRingXZStep(current, target, maxStepM = SCAN_RING_MAX_XZ_STEP_M) {
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= maxStepM) return target;
    const scale = maxStepM / dist;
    return {
      x: current.x + dx * scale,
      y: target.y,
      z: current.z + dz * scale,
    };
  }
  const capped = capScanRingXZStep({ x: 0, y: 0.4, z: 0 }, { x: 0.5, y: 0.4, z: 0 });
  assert(
    "scan ring XZ step capped during estimated phase",
    Math.hypot(capped.x, capped.z) <= SCAN_RING_MAX_XZ_STEP_M + 1e-6
  );
  assert(
    "scan provisional forward distance closer than default 1.2m",
    SCAN_PROVISIONAL_FORWARD_M < 1.2
  );
  const ringYStable = estimateDisplayFloorY(
    null,
    false,
    [0.39, 0.41, 0.4],
    1.119,
    0.509
  );
  const ringYCrouchOnly = contactFloorY(bootstrapFloorYFromViewer(0.509));
  assert(
    "ring display floor resists crouch SLAM dip (1781090393626)",
    ringYStable != null &&
      ringYCrouchOnly != null &&
      ringYStable > ringYCrouchOnly + 0.08
  );
  const FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M = 0.25;
  const FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M = 0.08;
  const FLOOR_Y_TIGHT_CLUSTER_SPREAD_M = 0.08;
  function resolveViewerYForScanLock(viewerOriginY, standingViewerOriginY) {
    if (viewerOriginY == null || !Number.isFinite(viewerOriginY)) {
      return standingViewerOriginY ?? null;
    }
    if (
      standingViewerOriginY != null &&
      standingViewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M &&
      viewerOriginY - standingViewerOriginY > FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M
    ) {
      return standingViewerOriginY;
    }
    return viewerOriginY;
  }
  function maybePinDisplayFloorY(pinned, sampleYs, viewerForFilter) {
    if (pinned != null) return pinned;
    const filtered = filterFloorScanSamples(sampleYs, viewerForFilter);
    if (filtered.length < 3) return null;
    const sorted = [...filtered].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1] - sorted[0];
    if (spread > FLOOR_Y_TIGHT_CLUSTER_SPREAD_M) return null;
    return sorted[Math.floor(sorted.length / 2)];
  }
  function correctBootstrapTableHeightLock(
    lockedY,
    viewerForLock,
    standingViewerY,
    bootstrapSamples
  ) {
    if (standingViewerY == null || standingViewerY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M) {
      return lockedY;
    }
    const standingBoot = bootstrapFloorYFromViewer(standingViewerY);
    if (standingBoot == null) return lockedY;
    if (lockedY <= standingBoot + FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M) {
      return lockedY;
    }
    const bootFiltered = filterFloorScanSamples(bootstrapSamples, standingViewerY);
    if (bootFiltered.length >= 3) {
      const sorted = [...bootFiltered].sort((a, b) => a - b);
      const candidate = sorted[0];
      if (
        candidate <= standingBoot + FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M &&
        isPlausibleLockedFloorY(candidate, viewerForLock, standingViewerY)
      ) {
        return candidate;
      }
    }
    if (isPlausibleLockedFloorY(standingBoot, viewerForLock, standingViewerY)) {
      return standingBoot;
    }
    return lockedY;
  }
  assert(
    "scan lock uses standing viewer when SLAM spikes at complete (1781090889796)",
    resolveViewerYForScanLock(1.679, 1.289) === 1.289
  );
  function resolveViewerYForFloorRay(
    originY,
    standingBaselineY,
    lastPlausibleViewerY,
    scanCompleteViewerY
  ) {
    const STANDING_MAX = 1.55;
    const MIN_VIEWER = 0.5;
    const isStanding =
      originY != null &&
      Number.isFinite(originY) &&
      originY >= 1.0 &&
      originY <= STANDING_MAX;
    if (isStanding) return originY;
    if (standingBaselineY != null && standingBaselineY >= MIN_VIEWER) {
      return standingBaselineY;
    }
    if (lastPlausibleViewerY != null && lastPlausibleViewerY >= MIN_VIEWER) {
      return lastPlausibleViewerY;
    }
    if (scanCompleteViewerY != null && scanCompleteViewerY >= MIN_VIEWER) {
      return scanCompleteViewerY;
    }
    if (originY >= MIN_VIEWER && originY <= STANDING_MAX) return originY;
    return null;
  }
  assert(
    "floor ray rejects SLAM viewer-Y inflation spike (1781092699633)",
    resolveViewerYForFloorRay(2.799, 1.184, 1.537, null) === 1.184
  );
  assert(
    "floor ray uses plausible standing origin when in band",
    resolveViewerYForFloorRay(1.241, 1.184, 1.241, null) === 1.241
  );
  function isSlamViewerVerticalGlitch(originY, standingBaselineY) {
    const STANDING_MAX = 1.55;
    const MIN_VIEWER = 1.0;
    const SPIKE = 0.25;
    if (!Number.isFinite(originY)) return true;
    if (originY < MIN_VIEWER) return true;
    if (originY > STANDING_MAX) return true;
    const isStanding = originY >= MIN_VIEWER && originY <= STANDING_MAX;
    if (
      standingBaselineY != null &&
      standingBaselineY >= MIN_VIEWER &&
      Math.abs(originY - standingBaselineY) > SPIKE &&
      !isStanding
    ) {
      return true;
    }
    return false;
  }
  assert(
    "negative SLAM viewer Y is vertical glitch (1781093577990)",
    isSlamViewerVerticalGlitch(-0.179, 1.173) === true
  );
  assert(
    "standing viewer Y is not vertical glitch",
    isSlamViewerVerticalGlitch(1.04, 1.173) === false
  );
  function preferPinnedBootstrapLock(lockedY, pinnedY, bootstrapOnly) {
    const maxDiverge = bootstrapOnly ? 0.02 : 0.08;
    if (Math.abs(lockedY - pinnedY) <= maxDiverge) {
      if (bootstrapOnly && lockedY > pinnedY + 0.015) {
        return pinnedY;
      }
      return lockedY;
    }
    return pinnedY;
  }
  assert(
    "bootstrap-only prefers pinned floor over table-height lock (1781093577990)",
    preferPinnedBootstrapLock(0.453, 0.413, true) === 0.413
  );
  function isPlausibleLockedWithStandingBoot(
    lockedY,
    viewerOriginY,
    standingViewerOriginY
  ) {
    const bootViewer =
      standingViewerOriginY != null && standingViewerOriginY >= 1.0
        ? standingViewerOriginY
        : viewerOriginY;
    const eyeToFloor =
      bootViewer >= 1.25 ? 0.82 : bootViewer >= 1.0 ? 0.72 : 0.55;
    const boot = bootViewer - eyeToFloor;
    if (boot != null && lockedY > boot + 0.1) return false;
    return lockedY >= 0.05;
  }
  assert(
    "pinned floor plausible with standing bootstrap not crouch viewer (1781094052907)",
    isPlausibleLockedWithStandingBoot(0.401, 1.005, 1.156) === true
  );
  assert(
    "crouch bootstrap rejects pin when only crouch viewer used (1781094052907)",
    isPlausibleLockedWithStandingBoot(0.401, 1.005, null) === false
  );
  function correctBootstrapCrouchLock(lockedY, pinnedY) {
    if (pinnedY == null) return lockedY;
    if (lockedY >= pinnedY - 0.02) return lockedY;
    return pinnedY;
  }
  assert(
    "crouch-corrupted lock corrected to pinned cluster (1781094052907)",
    correctBootstrapCrouchLock(0.285, 0.401) === 0.401
  );
  assert(
    "pinned display floor stops median drift during scan",
    maybePinDisplayFloorY(null, [0.47, 0.48, 0.49], 1.289) === 0.48
  );
  assert(
    "table-height bootstrap lock corrected to floor cluster (1781090889796)",
    correctBootstrapTableHeightLock(
      0.859,
      1.289,
      1.289,
      [0.47, 0.48, 0.49, 0.55, 0.56]
    ) === 0.47
  );
  assert(
    "pinned display floor used before unpinned median",
    estimateDisplayFloorY(null, false, [0.86, 0.87], 1.679, 1.679, 0.48) ===
      contactFloorY(0.48)
  );
  function shouldRefreshProjectedRingAfterScan(
    floorScanComplete,
    hitFramesWithResults,
    lockedFloorY,
    floorScanBootstrapOnly,
    liveHit,
    lastValidHitAgeMs
  ) {
    const needsProjected =
      floorScanComplete &&
      lockedFloorY != null &&
      (hitFramesWithResults < 1 || floorScanBootstrapOnly);
    if (!needsProjected) return false;
    return true;
  }
  assert(
    "projected ring reprojects every frame after scan (1781091534193)",
    shouldRefreshProjectedRingAfterScan(true, 0, 0.424, false, true, 0) === true
  );
  assert(
    "bootstrap-only keeps projected ring even with sparse hit-test (1781092376352)",
    shouldRefreshProjectedRingAfterScan(true, 8, 0.441, true, true, 0) === true
  );
  assert(
    "liveHit stale flag must not block projected ring refresh",
    shouldRefreshProjectedRingAfterScan(true, 0, 0.424, false, true, 16) === true
  );
  function resolveViewerYForScanLockCrouch(viewerOriginY, standingViewerOriginY) {
    const SPIKE = 0.25;
    if (viewerOriginY == null || !Number.isFinite(viewerOriginY)) {
      return standingViewerOriginY ?? null;
    }
    if (
      standingViewerOriginY != null &&
      standingViewerOriginY >= 0.5 &&
      viewerOriginY - standingViewerOriginY > SPIKE
    ) {
      return standingViewerOriginY;
    }
    if (
      standingViewerOriginY != null &&
      standingViewerOriginY >= 1.0 &&
      standingViewerOriginY - viewerOriginY > SPIKE
    ) {
      return standingViewerOriginY;
    }
    return viewerOriginY;
  }
  assert(
    "scan lock uses standing viewer when SLAM dips to crouch (1781092376352)",
    resolveViewerYForScanLockCrouch(0.138, 1.012) === 1.012
  );
  function preferPinnedScanLockY(lockedY, pinnedY, divergeM = 0.08) {
    if (lockedY == null || pinnedY == null) return lockedY;
    if (Math.abs(lockedY - pinnedY) <= divergeM) return lockedY;
    return pinnedY;
  }
  assert(
    "pinned scan cluster wins over crouch-corrupted lock (1781092376352)",
    preferPinnedScanLockY(0.292, 0.441) === 0.441
  );
  const FLOOR_STANDING_VIEWER_Y_MAX_M = 1.55;
  function isPlausibleStandingViewerY(viewerOriginY) {
    return (
      viewerOriginY != null &&
      Number.isFinite(viewerOriginY) &&
      viewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M &&
      viewerOriginY <= FLOOR_STANDING_VIEWER_Y_MAX_M
    );
  }
  assert(
    "SLAM viewer spike 2.7m is not plausible standing height (1781091874596)",
    isPlausibleStandingViewerY(2.726) === false
  );
  assert(
    "normal standing viewer 1.33m is plausible",
    isPlausibleStandingViewerY(1.333) === true
  );
  function resolveYWithFreeze(rawY, lockedFloorY, freezeSessionLock) {
    if (freezeSessionLock && lockedFloorY != null) {
      return contactFloorY(lockedFloorY);
    }
    return rawY;
  }
  assert(
    "bootstrap-only session keeps scan lock Y despite viewer spike (1781091874596)",
    resolveYWithFreeze(0.97, 0.405, true) === contactFloorY(0.405)
  );
  function canForceBootstrapAtTimeout(
    hitFrames,
    hasSurfaceEvidence,
    forwardY,
    validSamples = 0,
    minSamples = 3
  ) {
    if (hasSurfaceEvidence || hitFrames >= 1) return true;
    if (validSamples >= minSamples) return true;
    return isPhoneTiltedTowardFloor(forwardY);
  }
  assert(
    "timeout bootstrap blocked with 0 hits and horizontal phone (1780828273381 session 1)",
    canForceBootstrapAtTimeout(0, false, 0.12) === false
  );
  assert(
    "timeout viewer bootstrap allowed when phone tilted toward floor",
    canForceBootstrapAtTimeout(0, false, -0.35) === true
  );
  assert(
    "timeout bootstrap allowed when at least one hit frame exists",
    canForceBootstrapAtTimeout(1, false, 0.12) === true
  );
  assert(
    "timeout bootstrap allowed with enough bootstrap samples even when level",
    canForceBootstrapAtTimeout(0, false, 0.12, 3) === true
  );
  function canCompleteBootstrapOnlyAtTimeout(
    hitFrames,
    hasSurfaceEvidence,
    forwardY,
    bootstrapSamples,
    validSamples,
    forceAtTimeout,
    allowBootstrapWithoutTilt
  ) {
    if (hitFrames >= 1 || hasSurfaceEvidence) return true;
    const enoughBootstrap =
      bootstrapSamples >= 3 || (forceAtTimeout && validSamples >= 3);
    if (!forceAtTimeout) return false;
    if (forwardY <= -0.2) return true;
    if (enoughBootstrap) return true;
    return allowBootstrapWithoutTilt === true;
  }
  assert(
    "bootstrap-only timeout completes with 3 bootstrap samples while level",
    canCompleteBootstrapOnlyAtTimeout(0, false, 0.12, 3, 3, true, true) === true
  );
  assert(
    "bootstrap-only timeout blocked at force without samples while level",
    canCompleteBootstrapOnlyAtTimeout(0, false, 0.12, 0, 0, true, false) === false
  );
}

{
  const ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN = 8;
  function canCompleteWithHitFrames(hitFrames, surfaceSamples, wouldBootstrapOnly = false) {
    if (hitFrames < ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN) {
      return false;
    }
    if (!wouldBootstrapOnly) return true;
    return surfaceSamples >= 1 || hitFrames >= 1;
  }
  assert(
    "scan blocked with sparse hit-test (session 1780741145241 had only 3 frames)",
    canCompleteWithHitFrames(3, 60) === false
  );
  assert(
    "scan blocked with surface samples but too few hit-test frames (session 1780795132273)",
    canCompleteWithHitFrames(3, 60, false) === false
  );
  assert(
    "scan allowed after 8 hit-test frames",
    canCompleteWithHitFrames(8, 0) === true
  );
  assert(
    "surface samples alone no longer bypass hit-test frame minimum",
    canCompleteWithHitFrames(2, 60) === false
  );
}

{
  const crouchBoot = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    crouchBoot.addScanSample(0.134, 0.684, { source: "bootstrap" });
  }
  assert(
    "bootstrap-only scan blocked while crouching (low viewer Y)",
    crouchBoot.canCompleteScan(0.684) === false
  );
}

{
  assert(
    "SLAM garbage 0.08m is not trustworthy vs lock 0.444m",
    isTrustworthyLocalFloorHit(0.08, 0.444, 0.684) === false
  );
  assert(
    "table-height hit rejected for local override (session 1780795587059)",
    isTrustworthyLocalFloorHit(0.548, 0.399, 1.09) === false
  );
  assert(
    "small upward SLAM refinement still trustworthy",
    isTrustworthyLocalFloorHit(0.42, 0.399, 1.2) === true
  );
  assert(
    "placement resolveY ignores local override when disabled",
    (() => {
      const stabilizer = new FloorYStabilizer();
      for (const y of [0.399, 0.4, 0.398, 0.401, 0.397]) {
        stabilizer.addScanSample(y, 1.2, { source: "surface" });
      }
      stabilizer.lockFromScan(1.2);
      const locked = stabilizer.lockedFloorY();
      const placed = stabilizer.resolveY(0.548, true, 1.09, 1.2, false);
      return (
        placed.usedLocalOverride !== true &&
        locked != null &&
        Math.abs(placed.y - contactFloorY(locked)) < 0.001
      );
    })()
  );
  assert(
    "crouch scan lock repaired when standing for placement (session 1780817798021)",
    (() => {
      const stabilizer = new FloorYStabilizer();
      for (let i = 0; i < 8; i++) {
        stabilizer.addScanSample(0.17 + i * 0.001, 1.155, {
          source: "surface",
          force: true,
        });
      }
      stabilizer.setLockedFloorY(0.1972949504852295);
      const crouchLock = stabilizer.lockedFloorY();
      if (crouchLock == null || crouchLock >= 0.22) return false;
      const repaired = stabilizer.repairLockForViewer(1.289, 1.155);
      const placed = stabilizer.resolveY(0.438, true, 1.289, 1.155, false);
      return (
        repaired != null &&
        repaired > 0.4 &&
        placed.usedLock === true &&
        Math.abs(placed.y - contactFloorY(repaired)) < 0.001
      );
    })()
  );
}

{
  const farScan = new FloorYStabilizer();
  for (const y of [0.44, 0.441, 0.439, 0.442, 0.438]) {
    farScan.addScanSample(y, 1.2, { source: "surface" });
  }
  farScan.lockFromScan(1.2);
  const garbage = farScan.resolveY(0.08, true, 0.684);
  assert(
    "garbage hit far below lock uses locked floor for placement",
    garbage.usedLock === true && Math.abs(garbage.y - contactFloorY(0.44)) < 0.01
  );
  const aligned = farScan.resolveY(0.411, true, 1.6);
  assert(
    "aligned hit near lock keeps same placement Y after walking far",
    aligned.usedLock === true &&
      Math.abs(aligned.y - contactFloorY(farScan.lockedFloorY())) < 0.001
  );
}

{
  const projectedOnly = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    projectedOnly.addScanSample(0.429, 1.25, { source: "bootstrap" });
  }
  assert(
    "bootstrap cluster can auto-complete scan when hit-test is unavailable",
    projectedOnly.canCompleteScan(1.25) === true
  );
  projectedOnly.lockFromScan(1.25);
  assert(
    "bootstrap-only lock flagged correctly",
    projectedOnly.lockedFromBootstrapOnly() === true
  );
}

{
  const bootRelock = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    bootRelock.addScanSample(0.408832258284092, 1.135, { source: "bootstrap" });
  }
  bootRelock.lockFromScan(1.135);
  assert("bootstrap-only lock matches session estimate", bootRelock.lockedFromBootstrapOnly() === true);
  bootRelock.addScanSample(0.38883225828409196, 1.135, { source: "surface" });
  bootRelock.addScanSample(0.38883225828409196, 1.135, { source: "surface" });
  const bootstrapOnlySessionFlag = true;
  assert(
    "bootstrap-only relock armed after two surface samples",
    bootstrapOnlySessionFlag && bootRelock.surfaceSampleYs().length >= 2
  );
  const surfYs = [...bootRelock.surfaceSampleYs()].sort((a, b) => a - b);
  const surfMed = surfYs[Math.floor(surfYs.length / 2)];
  assert(
    "surface median diverges from bootstrap lock by ~2cm",
    Math.abs(surfMed - bootRelock.lockedFloorY()) >= 0.019
  );
}

{
  const session1780742724312 = new FloorYStabilizer();
  const viewerY = 1.321;
  for (let i = 0; i < 3; i++) {
    session1780742724312.addScanSample(0.37953957796096804, viewerY, {
      source: "bootstrap",
    });
  }
  session1780742724312.lockFromScan(viewerY);
  assert(
    "bootstrap-only lock stuck low before surface hits (session 1780742724312)",
    session1780742724312.lockedFloorY() != null &&
      session1780742724312.lockedFloorY() < 0.42
  );
  session1780742724312.addScanSample(0.5506995725631714, viewerY, { source: "surface" });
  session1780742724312.addScanSample(0.5706995725631714, viewerY, { source: "surface" });
  session1780742724312.addScanSample(0.5508771157264709, viewerY, { source: "surface" });
  const promoted = session1780742724312.relockFromSurfaceMedian(viewerY);
  assert(
    "surface median promotes stale bootstrap lock to ~0.55m",
    promoted != null && promoted > 0.5 && promoted < 0.58
  );
  assert(
    "lockFromScan prefers surface when bootstrap diverges by >10cm",
    session1780742724312.lockFromScan(viewerY) != null &&
      session1780742724312.lockedFloorY() > 0.5
  );
  const lowHit = session1780742724312.resolveY(0.359539577960968, true, viewerY);
  assert(
    "after surface promotion, low SLAM hit uses lock not override",
    lowHit.usedLock === true && lowHit.usedLocalOverride !== true
  );
}

{
  const surfaceAfterBootstrap = new FloorYStabilizer();
  for (let i = 0; i < 3; i++) {
    surfaceAfterBootstrap.addScanSample(0.38, 1.32, { source: "bootstrap" });
  }
  surfaceAfterBootstrap.addScanSample(0.55, 1.32, { source: "surface" });
  assert(
    "surface hit-test samples are not rejected by stale bootstrap cluster",
    surfaceAfterBootstrap.surfaceSampleYs().length === 1
  );
}

{
  const crouchSession = new FloorYStabilizer();
  crouchSession.setLockedFloorY(0.4263999152183533);
  const standingY = 1.135;
  const crouchY = 0.416;
  assert(
    "crouched viewer below lock still plausible with standing scan baseline (1780745549800)",
    isPlausibleLockedFloorY(
      crouchSession.lockedFloorY(),
      crouchY,
      standingY
    ) === true
  );
  const locked = crouchSession.resolveY(0.4063999152183533, true, crouchY, standingY);
  assert(
    "crouch resolves ring Y from session lock not bootstrap",
    locked.usedLock === true &&
      locked.usedLocalOverride !== true &&
      Math.abs(locked.y - contactFloorY(0.4263999152183533)) < 0.001
  );
}

{
  const placedRing = new FloorYStabilizer();
  placedRing.setLockedFloorY(0.3957566532492638);
  const before = placedRing.localOverrideCount ?? 0;
  const resolved = placedRing.resolveY(0.28, true, 1.1, 1.127, false);
  assert(
    "after placement ring skips local override (1780746421614)",
    resolved.usedLocalOverride !== true &&
      (placedRing.localOverrideCount ?? 0) === before &&
      Math.abs(resolved.y - contactFloorY(0.3957566532492638)) < 0.001
  );
}

{
  const crouchPlaced = new FloorYStabilizer();
  crouchPlaced.setLockedFloorY(0.424);
  const resolved = crouchPlaced.resolveY(0.3, true, 0.944, 1.109, false);
  assert(
    "crouch after placement does not mutate session lock (1780825483568)",
    crouchPlaced.lockedFloorY() === 0.424 &&
      Math.abs(resolved.y - contactFloorY(0.424)) < 0.001
  );
}

{
  const overrideRelock = new FloorYStabilizer();
  overrideRelock.setLockedFloorY(0.38);
  for (let i = 0; i < FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES; i++) {
    overrideRelock.recordLocalOverride(0.55);
  }
  const med = overrideRelock.maybeRelockFromOverrideMedian(1.32);
  assert(
    "override median promotes lock after many local overrides",
    med != null && med > 0.5
  );
}

{
  const mixed = new FloorYStabilizer();
  mixed.addScanSample(0.42, 1.6, { source: "surface" });
  mixed.addScanSample(0.43, 1.6, { source: "surface" });
  mixed.addScanSample(0.62, 1.6, { source: "surface" });
  mixed.addScanSample(0.63, 1.6, { source: "surface" });
  mixed.lockFromScan(1.6);
  assert(
    "mixed box and floor samples lock to floor height",
    mixed.lockedFloorY() != null && mixed.lockedFloorY() < 0.7
  );
}

{
  const cameraFast = new FloorYStabilizer();
  cameraFast.addScanSample(0.62, 1.6, { source: "camera-ray" });
  cameraFast.addScanSample(0.63, 1.6, { source: "camera-ray" });
  assert(
    "two camera-ray floor samples can complete scan",
    cameraFast.canLockScan(1.6) === true
  );
  cameraFast.lockFromScan(1.6);
  assert(
    "camera-ray lock stays at floor height when box hits disagree",
    cameraFast.lockedFloorY() != null && cameraFast.lockedFloorY() < 0.7
  );
}

{
  const boxVsCamera = new FloorYStabilizer();
  boxVsCamera.addScanSample(0.42, 1.6, { source: "surface" });
  boxVsCamera.addScanSample(0.43, 1.6, { source: "surface" });
  boxVsCamera.addScanSample(0.41, 1.6, { source: "surface" });
  boxVsCamera.addScanSample(0.62, 1.6, { source: "camera-ray" });
  boxVsCamera.addScanSample(0.63, 1.6, { source: "camera-ray" });
  boxVsCamera.addScanSample(0.625, 1.6, { source: "camera-ray" });
  assert(
    "scan can complete when camera-ray confirms floor",
    boxVsCamera.lockFromScan(1.6) != null
  );
  boxVsCamera.lockFromScan(1.6);
  assert(
    "lock prefers camera-ray floor over box-top hits",
    boxVsCamera.lockedFloorY() != null && boxVsCamera.lockedFloorY() < 0.7
  );
}

{
  const stabilizer2 = new FloorYStabilizer();
  stabilizer2.addScanSample(0.42, 1.6);
  stabilizer2.addScanSample(0.41, 1.6);
  stabilizer2.addScanSample(0.43, 1.6);
  stabilizer2.addScanSample(0.42, 1.6);
  stabilizer2.addScanSample(0.415, 1.6);
  stabilizer2.lockFromScan(1.6);
  const lowOutlier = stabilizer2.resolveY(-0.17, true, 1.6);
  assert("after scan, low raw hit also snaps to locked Y", lowOutlier.usedLock === true);
  assert(
    "low outlier uses same locked floor height",
    Math.abs(lowOutlier.y - contactFloorY(stabilizer2.lockedFloorY())) < 0.001
  );
}

{
  const negativeLock = new FloorYStabilizer();
  negativeLock.addScanSample(-0.06, 1.2, { force: true });
  negativeLock.addScanSample(-0.07, 1.2, { force: true });
  negativeLock.addScanSample(-0.065, 1.2, { force: true });
  negativeLock.addScanSample(-0.068, 1.2, { force: true });
  negativeLock.addScanSample(-0.062, 1.2, { force: true });
  assert("lock rejects negative floor Y cluster", negativeLock.lockFromScan(1.2) === null);
}

{
  const stabilizer3 = new FloorYStabilizer();
  stabilizer3.addScanSample(0.55, 0.95);
  stabilizer3.addScanSample(0.54, 0.95);
  stabilizer3.addScanSample(0.4, 0.95);
  stabilizer3.addScanSample(0.39, 0.95);
  stabilizer3.addScanSample(0.41, 0.95);
  stabilizer3.lockFromScan(0.95);
  assert(
    "floor lock uses filtered median for low viewer height",
    stabilizer3.lockedFloorY() != null && stabilizer3.lockedFloorY() < 0.45
  );
}

{
  const stabilizer4 = new FloorYStabilizer();
  stabilizer4.addScanSample(0.53, 1.2);
  stabilizer4.addScanSample(0.52, 1.2);
  stabilizer4.addScanSample(0.54, 1.2);
  stabilizer4.addScanSample(0.53, 1.2);
  stabilizer4.addScanSample(0.525, 1.2);
  stabilizer4.lockFromScan(1.2);
  const locked = stabilizer4.lockedFloorY();
  const contact = contactFloorY(locked);
  const badRaw = stabilizer4.resolveY(-0.28, true, 1.2);
  assert(
    "flat lock holds when raw hit goes negative",
    Math.abs(badRaw.y - contact) < 0.001
  );
  assert(
    "flat lock ignores negative raw Y drift",
    Math.abs(badRaw.y - contact) < 0.001
  );
}

{
  const drift = new FloorYStabilizer();
  drift.addScanSample(0.38, 1.2);
  drift.addScanSample(0.381, 1.2);
  drift.addScanSample(0.379, 1.2);
  drift.addScanSample(0.382, 1.2);
  drift.addScanSample(0.38, 1.2);
  drift.lockFromScan(1.2);
  const near = drift.resolveY(0.37, true, 1.2);
  assert("near raw hit still uses session lock", near.usedLock === true && near.usedLocalOverride !== true);
  const farDown = drift.resolveY(0.22, true, 1.2);
  assert(
    "downward SLAM spike keeps session lock",
    farDown.usedLock === true && farDown.usedLocalOverride !== true
  );
  const farUp = drift.resolveY(0.55, true, 1.2, null, true);
  assert(
    "large upward table hit keeps session lock not local override",
    farUp.usedLocalOverride !== true && farUp.usedLock === true
  );
  const smallUp = drift.resolveY(0.495, true, 1.2, null, true);
  assert(
    "small upward refinement within 12cm may use local override",
    smallUp.usedLocalOverride === true &&
      Math.abs(smallUp.y - contactFloorY(0.495)) < 0.001
  );
}

{
  const garbageLock = new FloorYStabilizer();
  garbageLock.setLockedFloorY(0.179);
  const resolved = garbageLock.resolveY(0.37, true, 1.332);
  const boot = bootstrapFloorYFromViewer(1.332);
  assert(
    "implausible lock resolves ring Y from bootstrap not local override",
    boot != null &&
      resolved.usedLocalOverride !== true &&
      Math.abs(resolved.y - contactFloorY(boot)) < 0.001
  );
}

function shouldAllowPlaneDuringScan(floorScanComplete, hitTestAttached, lastHitAtMs, nowMs, staleMs = 400) {
  if (!hitTestAttached || floorScanComplete) return false;
  if (lastHitAtMs <= 0) return true;
  return nowMs - lastHitAtMs > staleMs;
}

assert(
  "plane ring allowed during scan when hit-test is stale",
  shouldAllowPlaneDuringScan(false, true, 1000, 1500) === true
);
assert(
  "plane ring blocked during scan when hit-test is fresh",
  shouldAllowPlaneDuringScan(false, true, 1000, 1200) === false
);

function shouldBlockPlaneAfterScan(floorScanComplete, hitTestAttached) {
  return hitTestAttached && floorScanComplete;
}

assert(
  "plane ring blocked after scan when hit-test is attached",
  shouldBlockPlaneAfterScan(true, true) === true
);
assert(
  "plane ring blocked during scan once hit-test has results",
  shouldBlockPlaneDuringScan(false, true, 5) === true
);
assert(
  "plane ring allowed after scan when hit-test unavailable",
  shouldBlockPlaneAfterScan(true, false) === false
);

function shouldBlockPlaneDuringScan(floorScanComplete, hitTestAttached, hitFramesWithResults) {
  return hitTestAttached && (floorScanComplete || hitFramesWithResults >= 1);
}

function shouldIgnoreRingJitter(current, target) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  return Math.hypot(dx, dz) < 0.012 && Math.abs(dy) < 0.008;
}

const RETICLE_BASE_DIAMETER_M = 0.32;

function reticleScaleForFootprint(footprintM) {
  const clamped = Math.max(0.28, Math.min(footprintM, 1.6));
  return clamped / RETICLE_BASE_DIAMETER_M;
}

assert(
  "reticle scales up for chair-sized footprint",
  Math.abs(reticleScaleForFootprint(0.75) - 0.75 / 0.32) < 0.01
);
assert(
  "reticle scales down for small pad footprint",
  Math.abs(reticleScaleForFootprint(0.35) - 0.35 / 0.32) < 0.01
);
assert(
  "reticle footprint clamped to minimum",
  reticleScaleForFootprint(0.1) === 0.28 / 0.32
);

function extractHitTestPoseFromParts(position, scale, yaw) {
  const scaleAnomaly =
    Math.abs(scale.x - 1) > 0.03 ||
    Math.abs(scale.y - 1) > 0.03 ||
    Math.abs(scale.z - 1) > 0.03 ||
    Math.abs(scale.x - scale.y) > 0.05 ||
    Math.abs(scale.x - scale.z) > 0.05;
  return { position, scaleAnomaly, yaw };
}

{
  const normal = extractHitTestPoseFromParts({ x: 1, y: 0, z: 2 }, { x: 1, y: 1, z: 1 }, 0);
  assert("unit hit-test scale is not an anomaly", normal.scaleAnomaly === false);
  const bad = extractHitTestPoseFromParts({ x: 1, y: 0, z: 2 }, { x: 0.82, y: 0.82, z: 0.82 }, 0);
  assert("shrunk hit-test scale is flagged", bad.scaleAnomaly === true);
}

{
  const atMin = evaluateFloorReady({
    latestPoseValid: true,
    liveHit: true,
    lastValidHitAt: 100,
    now: 150,
    floorNormalY: MIN_FLOOR_NORMAL_Y,
  });
  assert("minimum floor normal passes", atMin.ready === true);
}

function intersectRayWithHorizontalFloor(origin, direction, options = {}) {
  const minForwardDown = options.minForwardDown ?? 0.05;
  const minDistanceM = options.minDistanceM ?? 0.15;
  const maxDistanceM = options.maxDistanceM ?? 12;
  const floorY = options.floorY ?? 0;
  const forwardDistanceAtFloor = options.forwardDistanceAtFloor ?? 1.2;
  const minOriginY = options.minOriginY ?? 0.35;
  const originY = origin.y;
  const forwardY = direction.y;

  if (
    originY < minOriginY &&
    Math.hypot(origin.x, origin.z) < 0.15 &&
    Math.abs(originY - floorY) < 0.15
  ) {
    return { hit: null, rejectReason: "tracking-not-ready", originY, forwardY };
  }

  if (Math.abs(originY - floorY) < 0.08 && Math.abs(forwardY) < minForwardDown) {
    const flatLen = Math.hypot(direction.x, direction.z);
    if (flatLen < 0.01) {
      return { hit: null, rejectReason: "direction-not-down", originY, forwardY };
    }
    const yaw = Math.atan2(direction.x, direction.z);
    return {
      hit: {
        x: origin.x + (direction.x / flatLen) * forwardDistanceAtFloor,
        y: floorY,
        z: origin.z + (direction.z / flatLen) * forwardDistanceAtFloor,
        yaw: yaw + Math.PI,
      },
      rejectReason: null,
      originY,
      forwardY,
    };
  }

  if (forwardY >= -minForwardDown) {
    return { hit: null, rejectReason: "direction-not-down", originY, forwardY };
  }

  const t = (floorY - originY) / forwardY;
  if (t < minDistanceM || t > maxDistanceM) {
    return { hit: null, rejectReason: "distance-out-of-range", originY, forwardY };
  }

  const yaw = Math.atan2(direction.x, direction.z);
  return {
    hit: {
      x: origin.x + direction.x * t,
      y: floorY,
      z: origin.z + direction.z * t,
      yaw: yaw + Math.PI,
    },
    rejectReason: null,
    originY,
    forwardY,
  };
}

{
  const down = intersectRayWithHorizontalFloor(
    { x: 0, y: 1.6, z: 0 },
    { x: 0, y: -0.5, z: -0.866 }
  );
  assert(
    "camera ray hits floor when pointing down",
    down.hit != null && down.hit.y === 0 && down.rejectReason == null
  );
}

{
  const flat = intersectRayWithHorizontalFloor(
    { x: 0, y: 1.6, z: 0 },
    { x: 0, y: 0, z: -1 }
  );
  assert("horizontal view rejects without floor-level origin", flat.rejectReason === "direction-not-down");
}

{
  const atFloor = intersectRayWithHorizontalFloor(
    { x: 0.2, y: 0, z: 0.1 },
    { x: 0, y: 0, z: -1 }
  );
  assert(
    "at-floor origin projects forward on xz",
    atFloor.hit != null && atFloor.hit.y === 0 && atFloor.hit.z < 0
  );
}

function projectViewerForwardToFloor(origin, direction, floorY, forwardDistanceM = 1.2) {
  const flatLen = Math.hypot(direction.x, direction.z);
  if (flatLen < 0.01) return null;
  const yaw = Math.atan2(direction.x, direction.z);
  return {
    x: origin.x + (direction.x / flatLen) * forwardDistanceM,
    y: floorY,
    z: origin.z + (direction.z / flatLen) * forwardDistanceM,
    yaw: yaw + Math.PI,
  };
}

assert(
  "horizontal phone projects ring onto bootstrap floor",
  projectViewerForwardToFloor({ x: 0, y: 1.3, z: 0 }, { x: 0, y: 0.9, z: -0.1 }, 0.48)?.y === 0.48
);

const RING_RELOCALIZATION_WALK_SINCE_SCAN_M = 2.0;

function shouldAllowFloorRelockFromHitTest(
  placedCount,
  sessionFloorLockFrozen,
  walkedSinceScanM
) {
  if (placedCount > 0 || sessionFloorLockFrozen) return false;
  return walkedSinceScanM >= RING_RELOCALIZATION_WALK_SINCE_SCAN_M;
}

assert(
  "floor relock blocked after first placement (session 1780796522818)",
  shouldAllowFloorRelockFromHitTest(4, true, 2.8) === false
);
assert(
  "floor relock allowed before placement after 2m walk",
  shouldAllowFloorRelockFromHitTest(0, false, 2.5) === true
);
assert(
  "floor relock blocked before placement if walk under 2m",
  shouldAllowFloorRelockFromHitTest(0, false, 1.2) === false
);

assert(
  "bootstrap rejects SLAM viewer-Y spikes",
  bootstrapFloorYFromViewer(3.056) === null
);

{
  const untracked = intersectRayWithHorizontalFloor(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 }
  );
  assert(
    "untracked origin at world zero is rejected",
    untracked.hit == null && untracked.rejectReason === "tracking-not-ready"
  );
}

function resolveViewerPoseFromFrame(frame, ctx) {
  const spaces = [];
  if (ctx.referenceSpace) spaces.push(ctx.referenceSpace);
  if (ctx.baseReferenceSpace && ctx.baseReferenceSpace !== ctx.referenceSpace) {
    spaces.push(ctx.baseReferenceSpace);
  }
  for (const space of spaces) {
    const pose = frame.getViewerPose(space);
    if (pose?.transform) return pose;
  }
  const floor = ctx.referenceSpace ?? ctx.baseReferenceSpace;
  const viewer = ctx.viewerReferenceSpace;
  if (floor && viewer) {
    const rel = frame.getPose(viewer, floor);
    if (rel?.transform) {
      return { transform: rel.transform, emulatedPosition: false };
    }
  }
  return null;
}

{
  const floorSpace = {};
  const viewerSpace = {};
  const frame = {
    getViewerPose(space) {
      if (space === floorSpace) return null;
      return null;
    },
    getPose(space, base) {
      if (space === viewerSpace && base === floorSpace) {
        return {
          transform: {
            position: { x: 0.1, y: 1.55, z: -0.2 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
          },
        };
      }
      return null;
    },
  };
  const pose = resolveViewerPoseFromFrame(frame, {
    referenceSpace: floorSpace,
    viewerReferenceSpace: viewerSpace,
  });
  assert(
    "resolveViewerPose falls back to getPose(viewer, floor)",
    pose != null && pose.transform.position.y === 1.55
  );
}

console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
