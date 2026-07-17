/** Unit tests for floor-surface-filter (ring on horizontal floor; elevated object rejection). */
const MIN_FLOOR_NORMAL_Y = 0.65;
const MIN_FORWARD_Y_FOR_FLOOR_SCAN = -0.2;
const FLOOR_Y_ELEVATED_SURFACE_M = 0.12;
const FLOOR_LOCK_MAX_DIVERGE_M = 0.08;
const FLOOR_Y_MIN_BELOW_VIEWER_M = 0.45;
const RING_OBJECT_REJECT_MIN_M = 0.24;
const RING_OBJECT_CLOSENESS_MIN_M = 0.08;
const RING_LOW_OBSTACLE_MAX_M = 0.1;
const RING_ARCORE_WOBBLE_MAX_DELTA_M = 0.24;
const RING_TRUSTED_FLOOR_MAX_AGE_MS = 8000;
const RING_PLACEMENT_FLOOR_TRUST_MAX_AGE_MS = 90000;
const RING_ELEVATED_SPIKE_MIN_JUMP_M = 0.18;
const RING_ELEVATED_STUCK_MIN_MS = 900;

function shouldRecoverElevatedHitToLockedFloor(input) {
  const {
    rawHitY,
    lockedFloorY,
    previousRawHitY,
    lastTrustedPlaceableRawY,
    lastTrustedPlaceableAt,
    lastConfirmedPlacementFloorY,
    lastConfirmedPlacementAt,
    now,
    viewerY,
    cameraAimedAtFloor,
    elevatedRejectSince,
  } = input;

  if (!cameraAimedAtFloor || !Number.isFinite(rawHitY) || !Number.isFinite(lockedFloorY)) {
    return false;
  }

  const elevatedDelta = rawHitY - lockedFloorY;
  if (elevatedDelta <= FLOOR_LOCK_MAX_DIVERGE_M) return false;

  const trustRecent =
    lastTrustedPlaceableRawY != null &&
    lastTrustedPlaceableAt != null &&
    now - lastTrustedPlaceableAt <= RING_TRUSTED_FLOOR_MAX_AGE_MS;
  const trustedNearLock =
    trustRecent &&
    Math.abs(lastTrustedPlaceableRawY - lockedFloorY) <= RING_ARCORE_WOBBLE_MAX_DELTA_M;

  const placementTrustRecent =
    lastConfirmedPlacementFloorY != null &&
    lastConfirmedPlacementAt != null &&
    now - lastConfirmedPlacementAt <= RING_PLACEMENT_FLOOR_TRUST_MAX_AGE_MS;
  const placementNearLock =
    placementTrustRecent &&
    Math.abs(lastConfirmedPlacementFloorY - lockedFloorY) <=
      RING_ARCORE_WOBBLE_MAX_DELTA_M;

  const floorTrustActive = trustedNearLock || placementNearLock;

  if (floorTrustActive) {
    if (
      elevatedDelta >= RING_OBJECT_CLOSENESS_MIN_M &&
      elevatedDelta <= RING_LOW_OBSTACLE_MAX_M
    ) {
      return true;
    }

    const trustAnchorY =
      trustedNearLock && lastTrustedPlaceableRawY != null
        ? lastTrustedPlaceableRawY
        : lastConfirmedPlacementFloorY;
    const frameJump =
      previousRawHitY != null
        ? Math.abs(rawHitY - previousRawHitY)
        : Math.abs(rawHitY - trustAnchorY);
    const prevNearFloor =
      previousRawHitY != null
        ? Math.abs(previousRawHitY - lockedFloorY) <= RING_ARCORE_WOBBLE_MAX_DELTA_M
        : true;

    if (
      elevatedDelta > RING_OBJECT_REJECT_MIN_M &&
      frameJump >= RING_ELEVATED_SPIKE_MIN_JUMP_M &&
      prevNearFloor
    ) {
      return true;
    }

    if (
      elevatedRejectSince != null &&
      now - elevatedRejectSince >= RING_ELEVATED_STUCK_MIN_MS &&
      elevatedDelta > RING_OBJECT_REJECT_MIN_M
    ) {
      return true;
    }
  }

  if (
    viewerY != null &&
    viewerY - lockedFloorY >= FLOOR_Y_MIN_BELOW_VIEWER_M &&
    elevatedRejectSince != null &&
    now - elevatedRejectSince >= RING_ELEVATED_STUCK_MIN_MS * 2 &&
    elevatedDelta > RING_OBJECT_REJECT_MIN_M &&
    (trustRecent || placementTrustRecent)
  ) {
    return true;
  }

  return false;
}

function isHorizontalFloorSurface(normalY, minNormalY = MIN_FLOOR_NORMAL_Y) {
  return Number.isFinite(normalY) && normalY >= minNormalY;
}

function isElevatedObjectSurfaceHit(
  hitY,
  lockedFloorY,
  elevatedThresholdM = FLOOR_Y_ELEVATED_SURFACE_M
) {
  if (lockedFloorY == null || !Number.isFinite(hitY)) return false;
  return hitY - lockedFloorY > elevatedThresholdM;
}

function isRingElevatedObjectHit(hitY, lockedFloorY, viewerY = null) {
  if (lockedFloorY == null || !Number.isFinite(hitY)) return false;
  const delta = hitY - lockedFloorY;
  if (delta <= FLOOR_LOCK_MAX_DIVERGE_M) return false;

  if (viewerY != null && Number.isFinite(viewerY)) {
    const hitBelow = viewerY - hitY;
    const lockBelow = viewerY - lockedFloorY;
    const closenessDelta = lockBelow - hitBelow;

    if (
      delta >= RING_OBJECT_CLOSENESS_MIN_M &&
      delta <= RING_LOW_OBSTACLE_MAX_M &&
      closenessDelta >= RING_OBJECT_CLOSENESS_MIN_M
    ) {
      return true;
    }

    if (
      delta <= RING_ARCORE_WOBBLE_MAX_DELTA_M &&
      hitBelow >= FLOOR_Y_MIN_BELOW_VIEWER_M &&
      lockBelow >= FLOOR_Y_MIN_BELOW_VIEWER_M
    ) {
      return false;
    }
  }

  if (delta <= RING_ARCORE_WOBBLE_MAX_DELTA_M) return false;
  return delta > RING_OBJECT_REJECT_MIN_M;
}

function isCameraAimedAtFloor(forwardY, minForwardDown = MIN_FORWARD_Y_FOR_FLOOR_SCAN) {
  return Number.isFinite(forwardY) && forwardY <= minForwardDown;
}

function classifyRingSurfaceHit(
  surfaceNormalY,
  hitY,
  lockedFloorY,
  checkElevatedObject,
  viewerY = null
) {
  if (!isHorizontalFloorSurface(surfaceNormalY)) return "wall-or-steep";
  if (checkElevatedObject && isRingElevatedObjectHit(hitY, lockedFloorY, viewerY)) {
    return "object-or-elevated";
  }
  return null;
}

const results = [];
function assert(name, ok) {
  results.push({ name, status: ok ? "pass" : "fail" });
  if (!ok) process.exitCode = 1;
}

assert("horizontal floor normal accepted", isHorizontalFloorSurface(0.92));
assert("wall normal rejected", !isHorizontalFloorSurface(0.12));

assert(
  "ring: session 1781526803178 low obstacle (~9cm closer to viewer)",
  isRingElevatedObjectHit(0.466, 0.376, 1.287)
);
assert(
  "ring: session 1781501836514 empty floor ARCore wobble (22cm)",
  !isRingElevatedObjectHit(0.651, 0.427, 1.142)
);
assert(
  "ring: session 1781530366903 empty floor ARCore wobble (22cm)",
  !isRingElevatedObjectHit(0.684547, 0.46, 1.346)
);
assert(
  "ring: floor hit at lock is placeable",
  !isRingElevatedObjectHit(0.356, 0.376, 1.287)
);
assert(
  "ring: table top rejected",
  isRingElevatedObjectHit(0.72, 0.416, 1.5)
);
assert(
  "ring: mid wobble band on empty floor is placeable",
  !isRingElevatedObjectHit(0.55, 0.416, 1.5)
);
assert(
  "ring: session 1781534931221 empty floor ARCore wobble (~12cm)",
  !isRingElevatedObjectHit(0.501, 0.383, 1.183)
);
assert(
  "ring: session 1781534931221 end state wobble (~11cm)",
  !isRingElevatedObjectHit(0.496, 0.383, 1.194)
);

assert("camera aimed down at floor", isCameraAimedAtFloor(-0.35));
assert("camera aimed at wall rejected", !isCameraAimedAtFloor(-0.05));

assert(
  "classify wall hit normal",
  classifyRingSurfaceHit(0.1, 0.4, 0.416, true) === "wall-or-steep"
);
assert(
  "classify low obstacle",
  classifyRingSurfaceHit(0.95, 0.466, 0.376, true, 1.287) === "object-or-elevated"
);
assert(
  "classify empty floor with ARCore plane wobble",
  classifyRingSurfaceHit(0.95, 0.651, 0.427, true, 1.142) === null
);
assert(
  "classify empty floor near lock",
  classifyRingSurfaceHit(0.95, 0.418, 0.416, true) === null
);
assert(
  "classify session 1781534931221 end wobble not elevated",
  classifyRingSurfaceHit(0.95, 0.496, 0.383, true, 1.194) === null
);

assert(
  "recover: session 1781538023073 ARCore table-plane spike",
  shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.649,
    lockedFloorY: 0.366,
    previousRawHitY: 0.346,
    lastTrustedPlaceableRawY: 0.346,
    lastTrustedPlaceableAt: 1000,
    lastConfirmedPlacementFloorY: null,
    lastConfirmedPlacementAt: null,
    now: 6000,
    viewerY: 1.256,
    cameraAimedAtFloor: true,
    elevatedRejectSince: 5500,
  })
);
assert(
  "recover: session 1781538023073 low-band false red (~8cm)",
  shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.472,
    lockedFloorY: 0.391,
    previousRawHitY: 0.378,
    lastTrustedPlaceableRawY: 0.378,
    lastTrustedPlaceableAt: 1000,
    lastConfirmedPlacementFloorY: null,
    lastConfirmedPlacementAt: null,
    now: 4000,
    viewerY: 1.15,
    cameraAimedAtFloor: true,
    elevatedRejectSince: null,
  })
);
assert(
  "recover: real table without recent floor trust stays blocked",
  !shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.72,
    lockedFloorY: 0.416,
    previousRawHitY: 0.71,
    lastTrustedPlaceableRawY: null,
    lastTrustedPlaceableAt: null,
    lastConfirmedPlacementFloorY: null,
    lastConfirmedPlacementAt: null,
    now: 5000,
    viewerY: 1.5,
    cameraAimedAtFloor: true,
    elevatedRejectSince: 3000,
  })
);
assert(
  "recover: sustained table view without trust stays blocked",
  !shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.72,
    lockedFloorY: 0.416,
    previousRawHitY: 0.705,
    lastTrustedPlaceableRawY: 0.378,
    lastTrustedPlaceableAt: 100,
    lastConfirmedPlacementFloorY: null,
    lastConfirmedPlacementAt: null,
    now: 20000,
    viewerY: 1.5,
    cameraAimedAtFloor: true,
    elevatedRejectSince: 19000,
  })
);
assert(
  "recover: session 1781539811727 end stuck red with placement trust",
  shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.649,
    lockedFloorY: 0.361,
    previousRawHitY: 0.649,
    lastTrustedPlaceableRawY: null,
    lastTrustedPlaceableAt: null,
    lastConfirmedPlacementFloorY: 0.341,
    lastConfirmedPlacementAt: 48994,
    now: 72000,
    viewerY: 1.2,
    cameraAimedAtFloor: true,
    elevatedRejectSince: 70000,
  })
);
assert(
  "recover: session 1781539811727 SLAM viewer spike uses resolved Y",
  shouldRecoverElevatedHitToLockedFloor({
    rawHitY: 0.649,
    lockedFloorY: 0.361,
    previousRawHitY: 0.35,
    lastTrustedPlaceableRawY: 0.341,
    lastTrustedPlaceableAt: 65000,
    lastConfirmedPlacementFloorY: 0.341,
    lastConfirmedPlacementAt: 48994,
    now: 71000,
    viewerY: 1.2,
    cameraAimedAtFloor: true,
    elevatedRejectSince: 68000,
  })
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
