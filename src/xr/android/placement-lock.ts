import { TransformNode, Vector3 } from "@babylonjs/core";
import {
  applyPlacementAnchorBinding,
  type AnchorApplyResult,
  type PlacementAnchorBinding,
} from "./placement-anchor";

/** Viewer moved this far in one XR frame — SLAM relocalization; resync anchored models. */
export const PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M = 0.45;

/** Ignore viewer-Y spikes outside this range for floor/scan heuristics. */
export const VIEWER_ORIGIN_Y_TRACK_MIN_M = -0.2;
export const VIEWER_ORIGIN_Y_TRACK_MAX_M = 2.8;
/** Eye height must be at least this far above locked floor (rejects crouch/SLAM Y glitches). */
export const VIEWER_MIN_HEIGHT_ABOVE_LOCKED_FLOOR_M = 0.55;

/** Standing scan baseline — crouch SLAM dips below this must not replace bootstrap viewer Y. */
export const STANDING_VIEWER_Y_MIN_M = 0.95;

export type PlacementLockState = {
  poseLocked: boolean;
  lastApplied: Vector3 | null;
};

export function isPlausibleViewerOriginY(
  y: number,
  lockedFloorY?: number | null,
  trackMaxM = VIEWER_ORIGIN_Y_TRACK_MAX_M
): boolean {
  if (y < VIEWER_ORIGIN_Y_TRACK_MIN_M || y > trackMaxM) {
    return false;
  }
  if (lockedFloorY != null && y < lockedFloorY + VIEWER_MIN_HEIGHT_ABOVE_LOCKED_FLOOR_M) {
    return false;
  }
  return true;
}

export function shouldResyncLockedPlacement(viewerJumpM: number): boolean {
  return viewerJumpM >= PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M;
}

/** SLAM relocalization is horizontal; ignore vertical viewer-Y tracking spikes. */
export function shouldResyncLockedPlacementHorizontal(
  viewerHorizontalJumpM: number
): boolean {
  return viewerHorizontalJumpM >= PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M;
}

/**
 * Anchor-driven placement that stays fixed after the first sync, except when SLAM
 * relocalizes (large viewer jump). Prevents crouch jitter and post-relocal drift.
 */
export function applyLockedPlacementAnchor(
  binding: PlacementAnchorBinding,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  rightHandedSystem: boolean,
  target: TransformNode,
  lockState: PlacementLockState,
  viewerJumpM: number,
  options: { maxSingleFrameJumpM?: number } = {}
): {
  result: AnchorApplyResult;
  position: Vector3 | null;
  poseLocked: boolean;
  resynced: boolean;
} {
  const maxSingleFrameJumpM = options.maxSingleFrameJumpM ?? 0.1;
  const resync =
    lockState.poseLocked && shouldResyncLockedPlacement(viewerJumpM);

  if (lockState.poseLocked && !resync) {
    if (lockState.lastApplied) {
      target.unfreezeWorldMatrix();
      target.setAbsolutePosition(lockState.lastApplied);
      target.computeWorldMatrix(true);
    }
    return {
      result: "unchanged",
      position: lockState.lastApplied,
      poseLocked: true,
      resynced: false,
    };
  }

  const outcome = applyPlacementAnchorBinding(
    binding,
    frame,
    referenceSpace,
    rightHandedSystem,
    target,
    {
      minUpdateDeltaM: 0,
      maxSingleFrameJumpM: resync ? Number.POSITIVE_INFINITY : maxSingleFrameJumpM,
      lastApplied: resync ? null : lockState.lastApplied,
    }
  );

  if (outcome.result === "lost") {
    return {
      result: "lost",
      position: lockState.lastApplied,
      poseLocked: lockState.poseLocked,
      resynced: false,
    };
  }

  if (outcome.result === "rejected" && lockState.lastApplied) {
    target.unfreezeWorldMatrix();
    target.setAbsolutePosition(lockState.lastApplied);
    target.computeWorldMatrix(true);
    return {
      result: "unchanged",
      position: lockState.lastApplied,
      poseLocked: true,
      resynced: false,
    };
  }

  const position =
    outcome.position ??
    lockState.lastApplied ??
    target.absolutePosition.clone();

  return {
    result: outcome.result,
    position,
    poseLocked: true,
    resynced: resync,
  };
}
