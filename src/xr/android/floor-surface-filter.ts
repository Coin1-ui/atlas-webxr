import { MIN_FLOOR_NORMAL_Y } from "./floor-detection";
import {
  FLOOR_LOCK_MAX_DIVERGE_M,
  FLOOR_Y_ELEVATED_SURFACE_M,
  FLOOR_Y_MIN_BELOW_VIEWER_M,
} from "./floor-y-stabilizer";
import { MIN_FORWARD_Y_FOR_FLOOR_SCAN } from "./ring-pose";

export type FloorSurfaceRejectReason =
  | "wall-or-steep"
  | "object-or-elevated"
  | "direction-not-down";

/** Table-height and above — clearly not empty floor. */
export const RING_OBJECT_REJECT_MIN_M = 0.24;

/** Low obstacle band — hit closer to viewer than lock (session 1781526803178). */
export const RING_OBJECT_CLOSENESS_MIN_M = 0.08;

/** Max delta for low obstacles (steps, footrests). Above this, treat as ARCore plane wobble. */
export const RING_LOW_OBSTACLE_MAX_M = 0.1;

/** ARCore empty-floor wobble band (sessions 1781501836514, 1781530366903). */
export const RING_ARCORE_WOBBLE_MAX_DELTA_M = 0.24;

/** Recent trusted floor sample must be within this of lock (meters). */
export const RING_TRUSTED_FLOOR_MAX_DELTA_M = 0.12;

/** Max age of last cyan-ring floor sample for elevated-plane recovery (ms). */
export const RING_TRUSTED_FLOOR_MAX_AGE_MS = 8000;

/** Successful placements confirm floor lock longer than transient cyan frames (session 1781539811727). */
export const RING_PLACEMENT_FLOOR_TRUST_MAX_AGE_MS = 90000;

/** Single-frame raw Y jump that suggests ARCore swapped to a table plane (meters). */
export const RING_ELEVATED_SPIKE_MIN_JUMP_M = 0.18;

/** Sustained elevated reject before stuck recovery (ms). */
export const RING_ELEVATED_STUCK_MIN_MS = 900;

export type ElevatedHitRecoveryInput = {
  rawHitY: number;
  lockedFloorY: number;
  previousRawHitY: number | null;
  lastTrustedPlaceableRawY: number | null;
  lastTrustedPlaceableAt: number | null;
  lastConfirmedPlacementFloorY: number | null;
  lastConfirmedPlacementAt: number | null;
  now: number;
  viewerY: number | null;
  cameraAimedAtFloor: boolean;
  elevatedRejectSince: number | null;
};

/**
 * When ARCore hit-test jumps to a table-height plane while the camera still aims at
 * the session floor, trust the locked floor Y and show cyan (session 1781538023073).
 */
export function shouldRecoverElevatedHitToLockedFloor(
  input: ElevatedHitRecoveryInput
): boolean {
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
    Math.abs(lastTrustedPlaceableRawY! - lockedFloorY) <= RING_ARCORE_WOBBLE_MAX_DELTA_M;

  const placementTrustRecent =
    lastConfirmedPlacementFloorY != null &&
    lastConfirmedPlacementAt != null &&
    now - lastConfirmedPlacementAt <= RING_PLACEMENT_FLOOR_TRUST_MAX_AGE_MS;
  const placementNearLock =
    placementTrustRecent &&
    Math.abs(lastConfirmedPlacementFloorY! - lockedFloorY) <=
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
        : lastConfirmedPlacementFloorY!;
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

/** Surface normal Y from hit-test — horizontal floor when near 1, wall when near 0. */
export function isHorizontalFloorSurface(
  normalY: number,
  minNormalY = MIN_FLOOR_NORMAL_Y
): boolean {
  return Number.isFinite(normalY) && normalY >= minNormalY;
}

/**
 * Hit-test Y clearly above session floor lock — table/chair tops, not SLAM drift.
 * Compare against raw locked Y (not contact bias); session snaps ring Y via resolveY.
 */
export function isElevatedObjectSurfaceHit(
  hitY: number,
  lockedFloorY: number | null,
  elevatedThresholdM = FLOOR_Y_ELEVATED_SURFACE_M
): boolean {
  if (lockedFloorY == null || !Number.isFinite(hitY)) return false;
  return hitY - lockedFloorY > elevatedThresholdM;
}

/**
 * Ring placement gate for horizontal hits above the session floor lock.
 * - ≤8 cm: scan wobble — placeable
 * - 8–10 cm + closer to viewer than lock: low obstacle — red
 * - 10–24 cm at standing floor height: ARCore plane wobble on empty floor — cyan
 * - >24 cm: table / tall furniture — red
 */
export function isRingElevatedObjectHit(
  hitY: number,
  lockedFloorY: number | null,
  viewerY: number | null = null
): boolean {
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

/** Phone must pitch toward the floor — ring turns red when aimed at walls. */
export function isCameraAimedAtFloor(
  forwardY: number,
  minForwardDown = MIN_FORWARD_Y_FOR_FLOOR_SCAN
): boolean {
  return Number.isFinite(forwardY) && forwardY <= minForwardDown;
}

export function classifyRingSurfaceHit(
  surfaceNormalY: number,
  hitY: number,
  lockedFloorY: number | null,
  checkElevatedObject: boolean,
  viewerY: number | null = null
): FloorSurfaceRejectReason | null {
  if (!isHorizontalFloorSurface(surfaceNormalY)) {
    return "wall-or-steep";
  }
  if (
    checkElevatedObject &&
    isRingElevatedObjectHit(hitY, lockedFloorY, viewerY)
  ) {
    return "object-or-elevated";
  }
  return null;
}
