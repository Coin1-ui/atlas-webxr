import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";

/** Ignore sub-centimeter hit-test noise after floor scan (ring still follows real movement). */
export const RING_JITTER_MIN_XZ_M = 0.012;
export const RING_JITTER_MIN_Y_M = 0.008;

import {
  RETICLE_BASE_DIAMETER_M,
  RETICLE_DEFAULT_FOOTPRINT_M,
  RETICLE_BUILTIN_PAD_FOOTPRINT_M,
} from "../shared/reticle-constants";

export {
  RETICLE_BASE_DIAMETER_M,
  RETICLE_DEFAULT_FOOTPRINT_M,
  RETICLE_BUILTIN_PAD_FOOTPRINT_M,
};

export type HitTestPoseExtract = {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  scaleAnomaly: boolean;
};

/** Strip non-uniform scale from hit-test matrices; use yaw-only floor rotation. */
export function extractHitTestPose(matrix: Matrix): HitTestPoseExtract {
  const scale = new Vector3();
  const rotation = new Quaternion();
  const position = new Vector3();
  matrix.decompose(scale, rotation, position);
  rotation.normalize();

  const scaleAnomaly =
    Math.abs(scale.x - 1) > 0.03 ||
    Math.abs(scale.y - 1) > 0.03 ||
    Math.abs(scale.z - 1) > 0.03 ||
    Math.abs(scale.x - scale.y) > 0.05 ||
    Math.abs(scale.x - scale.z) > 0.05;

  return {
    position,
    rotation: horizontalQuaternion(quaternionYaw(rotation)),
    scale,
    scaleAnomaly,
  };
}

export function reticleScaleForFootprint(footprintM: number): number {
  const clamped = Math.max(0.28, Math.min(footprintM, 1.6));
  return clamped / RETICLE_BASE_DIAMETER_M;
}

export function horizontalQuaternion(yaw: number): Quaternion {
  return Quaternion.FromEulerAngles(0, yaw, 0);
}

export function quaternionYaw(rotation: Quaternion): number {
  const forward = new Vector3(0, 0, 1);
  forward.rotateByQuaternionToRef(rotation, forward);
  return Math.atan2(forward.x, forward.z);
}

export function shouldIgnoreRingJitter(current: Vector3, target: Vector3): boolean {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  return (
    Math.hypot(dx, dz) < RING_JITTER_MIN_XZ_M && Math.abs(dy) < RING_JITTER_MIN_Y_M
  );
}

/** Plane meshes compete with viewer-centered hit-test and cause ring jumps after scan. */
export function shouldApplyPlaneRingUpdate(
  floorScanComplete: boolean,
  hitTestAttached: boolean,
  lastHitTestPoseAtMs: number,
  nowMs: number,
  hitTestStaleMs = 400
): boolean {
  if (!floorScanComplete || !hitTestAttached) return true;
  if (lastHitTestPoseAtMs <= 0) return true;
  return nowMs - lastHitTestPoseAtMs > hitTestStaleMs;
}

export const RING_JUMP_LOG_MIN_M = 0.15;

/** Camera forward.y must be at or below this to treat the phone as pointed at the floor. */
export const MIN_FORWARD_Y_FOR_FLOOR_SCAN = -0.2;

export function isPhoneTiltedTowardFloor(forwardY: number | null | undefined): boolean {
  return forwardY != null && forwardY <= MIN_FORWARD_Y_FOR_FLOOR_SCAN;
}

/** After floor scan, reject sudden hit-test jumps from SLAM relocalization. */
export const RING_RELOCALIZATION_MAX_JUMP_M = 0.75;

/** Hit-test within this XZ distance of the viewer is a local floor point (user walked). */
export const RING_RELOCALIZATION_VIEWER_NEAR_M = 1.35;

/** Wider radius when crouching / look-under — forward hit-test can sit farther on XZ. */
export const RING_RELOCALIZATION_VIEWER_NEAR_CROUCH_M = 2.5;

export const RING_RELOCALIZATION_CROUCH_VIEWER_Y = 1.0;

/** Force ring resync after this many consecutive relocal rejects (safety valve). */
export const RING_RELOCALIZATION_FORCE_RESYNC_AFTER = 12;

/** After walking this far from the scan spot, always accept hit-test ring updates. */
export const RING_RELOCALIZATION_WALK_SINCE_SCAN_M = 2.0;

export function shouldRejectRingRelocalizationJump(
  current: Vector3,
  target: Vector3,
  floorScanComplete: boolean,
  viewerXZ?: { x: number; z: number } | null,
  viewerOriginY?: number | null,
  walkedSinceScanM?: number | null
): boolean {
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
    const nearM =
      viewerOriginY != null && viewerOriginY < RING_RELOCALIZATION_CROUCH_VIEWER_Y
        ? RING_RELOCALIZATION_VIEWER_NEAR_CROUCH_M
        : RING_RELOCALIZATION_VIEWER_NEAR_M;
    const targetNearViewer =
      Math.hypot(target.x - viewerXZ.x, target.z - viewerXZ.z) <= nearM;
    if (targetNearViewer) return false;
  }
  return true;
}
