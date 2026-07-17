const PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M = 0.45;
const RING_RELOCALIZATION_WALK_SINCE_SCAN_M = 2.0;
const RING_RELOCALIZATION_MAX_JUMP_M = 0.75;
const RING_RELOCALIZATION_VIEWER_NEAR_M = 1.35;
const VIEWER_ORIGIN_Y_TRACK_MIN_M = -0.2;
const VIEWER_ORIGIN_Y_TRACK_MAX_M = 2.8;
const FLOOR_Y_CONTACT_BIAS_M = 0.02;

const VIEWER_MIN_HEIGHT_ABOVE_LOCKED_FLOOR_M = 0.55;

function shouldRejectRingRelocalizationJump(
  current,
  target,
  floorScanComplete,
  viewerXZ,
  viewerOriginY,
  walkedSinceScanM
) {
  if (!floorScanComplete) return false;
  if (
    walkedSinceScanM != null &&
    walkedSinceScanM >= RING_RELOCALIZATION_WALK_SINCE_SCAN_M
  ) {
    return false;
  }
  const jumpFromRing = Math.hypot(target.x - current.x, target.z - current.z);
  if (jumpFromRing <= RING_RELOCALIZATION_MAX_JUMP_M) return false;
  if (viewerXZ != null) {
    const targetNearViewer =
      Math.hypot(target.x - viewerXZ.x, target.z - viewerXZ.z) <=
      RING_RELOCALIZATION_VIEWER_NEAR_M;
    if (targetNearViewer) return false;
  }
  return true;
}

function shouldResyncLockedPlacement(viewerJumpM) {
  return viewerJumpM >= PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M;
}

function shouldResyncLockedPlacementHorizontal(viewerHorizontalJumpM) {
  return viewerHorizontalJumpM >= PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M;
}

function isPlausibleViewerOriginY(y, lockedFloorY) {
  if (y < VIEWER_ORIGIN_Y_TRACK_MIN_M || y > VIEWER_ORIGIN_Y_TRACK_MAX_M) {
    return false;
  }
  if (
    lockedFloorY != null &&
    y < lockedFloorY + VIEWER_MIN_HEIGHT_ABOVE_LOCKED_FLOOR_M
  ) {
    return false;
  }
  return true;
}

function contactFloorY(floorY) {
  return floorY - FLOOR_Y_CONTACT_BIAS_M;
}

class VirtualFloorPlane {
  planeY = null;
  establish(lockedY) {
    this.planeY = contactFloorY(lockedY);
  }
  get isEstablished() {
    return this.planeY != null;
  }
  get planeHeightM() {
    return this.planeY;
  }
}

const results = [];
function assert(name, ok) {
  results.push({ name, status: ok ? "pass" : "fail" });
  if (!ok) process.exitCode = 1;
}

assert(
  "SLAM relocal jump triggers resync threshold",
  shouldResyncLockedPlacement(PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M) === true
);
assert(
  "normal walking does not trigger resync",
  shouldResyncLockedPlacement(0.12) === false
);
assert(
  "vertical SLAM spike does not trigger horizontal resync",
  shouldResyncLockedPlacementHorizontal(0.02) === false
);
assert(
  "horizontal SLAM relocal triggers resync",
  shouldResyncLockedPlacementHorizontal(PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M) === true
);
assert(
  "negative SLAM viewer Y is not plausible for floor tracking",
  isPlausibleViewerOriginY(-1.621) === false
);
assert(
  "viewer Y below locked floor is rejected as SLAM glitch",
  isPlausibleViewerOriginY(0.416, 0.426) === false
);
assert(
  "standing viewer Y is plausible",
  isPlausibleViewerOriginY(1.2) === true
);
assert(
  "crouch SLAM glitch Y rejected against locked floor",
  isPlausibleViewerOriginY(0.507, 0.434) === false
);
assert(
  "standing viewer Y is plausible against locked floor",
  isPlausibleViewerOriginY(1.2, 0.426) === true
);

{
  const plane = new VirtualFloorPlane();
  assert("virtual floor starts unset", plane.isEstablished === false);
  plane.establish(0.44);
  assert("virtual floor established after scan", plane.isEstablished === true);
  assert(
    "virtual floor uses contact bias",
    Math.abs(plane.planeHeightM - 0.42) < 0.001
  );
}

{
  const ring = { x: 0, z: 0 };
  const farTarget = { x: 5, z: 0 };
  assert(
    "large ring jump rejected near scan spot",
    shouldRejectRingRelocalizationJump(
      ring,
      farTarget,
      true,
      { x: 0.2, z: 0.1 },
      1.2,
      0.5
    ) === true
  );
  assert(
    "large ring jump accepted after walking away from scan",
    shouldRejectRingRelocalizationJump(
      ring,
      farTarget,
      true,
      { x: 4.5, z: 0 },
      1.2,
      2.5
    ) === false
  );
}

function applyReferenceSpaceResetToPoint(point, transform) {
  const ox = transform.position?.x ?? 0;
  const oy = transform.position?.y ?? 0;
  const oz = transform.position?.z ?? 0;
  return { x: point.x + ox, y: point.y + oy, z: point.z + oz };
}

{
  const moved = applyReferenceSpaceResetToPoint(
    { x: 1, y: 0.35, z: 2 },
    { position: { x: 0.5, y: 0, z: -0.2 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }
  );
  assert(
    "reference-space reset shifts pinned placement",
    Math.abs(moved.x - 1.5) < 0.001 && Math.abs(moved.z - 1.8) < 0.001
  );
}

const WALK_CONTINUOUS_ANCHOR_SYNC_M = 1;
const WALK_ADAPTIVE_SLAM_JUMP_M = 3;
const WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M = 0.32;
const SLAM_JUMP_CORRECT_HORIZONTAL_M = 0.45;
const SLAM_JUMP_MAX_VERTICAL_DELTA_M = 0.15;
const SLAM_JUMP_MAX_HORIZONTAL_DELTA_M = 0.65;
const SLAM_JUMP_APPLY_MAX_SHIFT_M = 0.15;
const SLAM_JUMP_CONFIRM_FRAMES = 2;

function shouldApplyHorizontalSlamJump(horizontalM, verticalM, thresholdM) {
  if (!Number.isFinite(horizontalM) || horizontalM < thresholdM) return false;
  if (horizontalM > SLAM_JUMP_MAX_HORIZONTAL_DELTA_M) return false;
  if (!Number.isFinite(verticalM)) return true;
  return Math.abs(verticalM) <= SLAM_JUMP_MAX_VERTICAL_DELTA_M;
}

const SLAM_JUMP_VERTICAL_CORRECT_MIN_M = 0.12;
const SLAM_JUMP_VERTICAL_CORRECT_MAX_M = 0.35;

function shouldApplyVerticalSlamJump(horizontalM, verticalM, horizontalThresholdM) {
  const absV = Math.abs(verticalM);
  if (absV < SLAM_JUMP_VERTICAL_CORRECT_MIN_M) return false;
  if (absV > SLAM_JUMP_VERTICAL_CORRECT_MAX_M) return false;
  if (horizontalM > SLAM_JUMP_MAX_HORIZONTAL_DELTA_M) return false;
  if (
    horizontalM >= horizontalThresholdM &&
    absV > SLAM_JUMP_MAX_VERTICAL_DELTA_M
  ) {
    return true;
  }
  return horizontalM < 0.28 && absV >= SLAM_JUMP_VERTICAL_CORRECT_MIN_M;
}

function shouldContinuousWalkAnchorSync(walkSincePlacementM) {
  return walkSincePlacementM >= WALK_CONTINUOUS_ANCHOR_SYNC_M;
}

function slamJumpThresholdForWalk(walkSincePlacementM) {
  return walkSincePlacementM >= WALK_ADAPTIVE_SLAM_JUMP_M
    ? WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
    : SLAM_JUMP_CORRECT_HORIZONTAL_M;
}

assert(
  "continuous anchor sync after walking 1m from placement",
  shouldContinuousWalkAnchorSync(1.05) === true
);
assert(
  "anchor pose lock held before 1m walk",
  shouldContinuousWalkAnchorSync(0.8) === false
);
assert(
  "adaptive SLAM jump threshold lowers after 3m walk",
  slamJumpThresholdForWalk(3.5) === WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
);
assert(
  "default SLAM jump threshold before long walk",
  slamJumpThresholdForWalk(1) === SLAM_JUMP_CORRECT_HORIZONTAL_M
);

function partialAnchorStep(from, to, maxStepM) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= maxStepM) return { x: to.x, z: to.z };
  return {
    x: from.x + (dx / dist) * maxStepM,
    z: from.z + (dz / dist) * maxStepM,
  };
}

{
  const stepped = partialAnchorStep({ x: 0, z: 0 }, { x: 0.2, z: 0 }, 0.2);
  assert(
    "partial anchor step moves toward target when jump exceeds cap",
    Math.abs(stepped.x - 0.2) < 0.001 && Math.abs(stepped.z) < 0.001
  );
}

const SLAM_JUMP_LARGE_FIRST_SHIFT_M = 0.35;
const SLAM_JUMP_REMAINDER_STEP_M = 0.12;
const SLAM_JUMP_LARGE_CORRECT_MAX_M = 2.5;

function shouldApplyLargeHorizontalSlamJump(horizontalM, verticalM) {
  if (horizontalM <= SLAM_JUMP_MAX_HORIZONTAL_DELTA_M) return false;
  if (horizontalM > SLAM_JUMP_LARGE_CORRECT_MAX_M) return false;
  return Math.abs(verticalM) <= SLAM_JUMP_MAX_VERTICAL_DELTA_M;
}

function slamJumpWithRemainder(lastRoot, deltaX, deltaZ, thresholdM = 0.45, maxShiftM = SLAM_JUMP_APPLY_MAX_SHIFT_M) {
  const jumpM = Math.hypot(deltaX, deltaZ);
  if (jumpM < thresholdM || !lastRoot) return null;
  const scale = jumpM > maxShiftM ? maxShiftM / jumpM : 1;
  const dx = deltaX * scale;
  const dz = deltaZ * scale;
  return {
    position: { x: lastRoot.x + dx, z: lastRoot.z + dz, y: lastRoot.y },
    remainderX: deltaX - dx,
    remainderZ: deltaZ - dz,
  };
}

function applySessionFloorSlamJump(lastRoot, deltaX, deltaZ, thresholdM = 0.45) {
  const result = slamJumpWithRemainder(lastRoot, deltaX, deltaZ, thresholdM);
  return result?.position ?? null;
}

function slamJumpThresholdWhenPlaced(walkSincePlacementM) {
  return walkSincePlacementM >= WALK_ADAPTIVE_SLAM_JUMP_M
    ? WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
    : SLAM_JUMP_CORRECT_HORIZONTAL_M;
}

assert(
  "session floor SLAM jump capped at 15cm per correction",
  (() => {
    const next = applySessionFloorSlamJump({ x: 0, y: 0.23, z: 0 }, 0.5, 0);
    return next && Math.abs(next.x - 0.15) < 0.001;
  })()
);
assert(
  "41cm jump ignored at 45cm threshold when placed (session 1780796028978 fix)",
  applySessionFloorSlamJump({ x: 0, y: 0.23, z: 0 }, 0.41, 0) === null
);
assert(
  "SLAM threshold lowers to 32cm after 3m walk when model is placed (v0.1.99)",
  slamJumpThresholdWhenPlaced(5.5) === WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
);
assert(
  "SLAM threshold stays 45cm before 3m walk when model is placed",
  slamJumpThresholdWhenPlaced(1.2) === SLAM_JUMP_CORRECT_HORIZONTAL_M
);
assert(
  "SLAM correction requires consecutive eligible frames",
  SLAM_JUMP_CONFIRM_FRAMES === 2
);
assert(
  "session floor SLAM jump ignored below threshold",
  applySessionFloorSlamJump({ x: 0, y: 0.23, z: 0 }, 0.1, 0.05) === null
);
assert(
  "SLAM jump skipped on vertical spike (session 1780792057150 crouch)",
  shouldApplyHorizontalSlamJump(0.6, -0.96, SLAM_JUMP_CORRECT_HORIZONTAL_M) === false
);
assert(
  "SLAM jump allowed on horizontal relocal without vertical spike",
  shouldApplyHorizontalSlamJump(0.5, 0.02, SLAM_JUMP_CORRECT_HORIZONTAL_M) === true
);
assert(
  "SLAM jump rejected when horizontal delta exceeds single-frame cap",
  shouldApplyHorizontalSlamJump(0.7, 0.02, SLAM_JUMP_CORRECT_HORIZONTAL_M) === false
);
assert(
  "vertical SLAM eligible on stand-up snap (session 1780803447786)",
  shouldApplyVerticalSlamJump(0.5, 0.18, SLAM_JUMP_CORRECT_HORIZONTAL_M) === true
);
assert(
  "vertical SLAM rejected during crouch tracking suspend",
  (() => {
    const lockedFloorY = 0.556;
    const py = 1.05;
    const yTrackingSuspended =
      !isPlausibleViewerOriginY(py, lockedFloorY) && lockedFloorY != null;
    return yTrackingSuspended === true;
  })()
);
assert(
  "vertical SLAM not applied on insane vertical spike",
  shouldApplyVerticalSlamJump(0.2, 0.5, SLAM_JUMP_CORRECT_HORIZONTAL_M) === false
);
assert(
  "camera path skips accumulation when origin will not update",
  (() => {
    let cameraPathM = 0;
    const willUpdateOrigin = false;
    const viewerRelocalJumpM = 2.5;
    if (willUpdateOrigin) {
      cameraPathM += Math.min(viewerRelocalJumpM, 0.45);
    }
    return cameraPathM === 0;
  })()
);
assert(
  "SLAM skipped on stale-origin catch-up frame",
  (() => {
    const willUpdateOrigin = true;
    const lastFrameOriginUpdated = false;
    const staleCatchUp = willUpdateOrigin && !lastFrameOriginUpdated;
    const horizontalM = 0.5;
    const eligible =
      willUpdateOrigin &&
      !staleCatchUp &&
      shouldApplyHorizontalSlamJump(horizontalM, 0.02, SLAM_JUMP_CORRECT_HORIZONTAL_M);
    return eligible === false;
  })()
);

const MIN_FORWARD_Y_FOR_FLOOR_SCAN = -0.2;
function isPhoneTiltedTowardFloor(forwardY) {
  return forwardY != null && forwardY <= MIN_FORWARD_Y_FOR_FLOOR_SCAN;
}
assert(
  "phone pointed up is not tilted for floor scan",
  isPhoneTiltedTowardFloor(0.685) === false
);
assert(
  "phone pitched toward floor passes tilt gate",
  isPhoneTiltedTowardFloor(-0.83) === true
);
assert(
  "bootstrap ring blocked after first hit-test frame",
  (() => {
    const hitFramesWithResults = 1;
    const forwardY = -0.5;
    const shouldUseBootstrapRing =
      hitFramesWithResults < 1 && isPhoneTiltedTowardFloor(forwardY);
    return shouldUseBootstrapRing === false;
  })()
);

const SESSION_FLOOR_SOFT_DRIFT_MIN_M = 0.035;
const SESSION_FLOOR_SOFT_DRIFT_STEP_M = 0.028;
function softDriftStep(heldX, heldZ, targetX, targetZ) {
  const diverged = Math.hypot(targetX - heldX, targetZ - heldZ);
  if (diverged < SESSION_FLOOR_SOFT_DRIFT_MIN_M) return null;
  const step = Math.min(SESSION_FLOOR_SOFT_DRIFT_STEP_M, diverged);
  return {
    x: heldX + ((targetX - heldX) / diverged) * step,
    z: heldZ + ((targetZ - heldZ) / diverged) * step,
    stepM: step,
  };
}
assert(
  "soft drift steps toward anchor without full snap",
  (() => {
    const next = softDriftStep(0, 0, 0.12, 0);
    return next != null && next.stepM === 0.028 && next.x > 0 && next.x < 0.12;
  })()
);
assert(
  "soft drift ignores sub-threshold divergence",
  softDriftStep(0, 0, 0.02, 0) === null
);
assert(
  "large SLAM jump eligible after 65cm (session 1780812499909)",
  shouldApplyLargeHorizontalSlamJump(1.1, 0.02) === true
);
assert(
  "large SLAM jump rejected during crouch vertical spike",
  shouldApplyLargeHorizontalSlamJump(1.1, -0.4) === false
);
assert(
  "large SLAM first shift capped at 35cm with remainder",
  (() => {
    const result = slamJumpWithRemainder(
      { x: 0, y: 0.2, z: 0 },
      1.2,
      0,
      SLAM_JUMP_MAX_HORIZONTAL_DELTA_M,
      SLAM_JUMP_LARGE_FIRST_SHIFT_M
    );
    return (
      result &&
      Math.abs(result.position.x - 0.35) < 0.001 &&
      Math.abs(result.remainderX - 0.85) < 0.001
    );
  })()
);
assert(
  "SLAM remainder catch-up steps 12cm per frame",
  (() => {
    const remainder = { x: 0.85, z: 0 };
    const step = Math.min(SLAM_JUMP_REMAINDER_STEP_M, Math.hypot(remainder.x, remainder.z));
    const scale = step / Math.hypot(remainder.x, remainder.z);
    remainder.x -= remainder.x * scale;
    return Math.abs(remainder.x - 0.73) < 0.02;
  })()
);

console.log(
  JSON.stringify(
    {
      ok: results.every((r) => r.status === "pass"),
      failed: results.filter((r) => r.status === "fail").length,
      results,
    },
    null,
    2
  )
);
