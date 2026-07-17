import { Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import { repinWorldFrozenNode } from "./placement-anchor";
import type { SessionFloorAnchorState } from "./virtual-floor-lock";

/** Ignore viewer steps larger than this when accumulating walk distance (meters). */
export const MAX_CAMERA_PATH_STEP_M = 0.45;

/** Compensate world-frozen placements when horizontal viewer jump exceeds this (meters). */
export const SLAM_JUMP_CORRECT_HORIZONTAL_M = 0.45;

/** Max horizontal shift applied in one SLAM correction (meters). */
export const SLAM_JUMP_APPLY_MAX_SHIFT_M = 0.15;

/** First-frame cap when a large (>65cm) SLAM relocalization is detected (meters). */
export const SLAM_JUMP_LARGE_FIRST_SHIFT_M = 0.35;

/** Per-frame catch-up step for uncorrected SLAM remainder (meters). */
export const SLAM_JUMP_REMAINDER_STEP_M = 0.12;

/** Ignore single-frame horizontal jumps above this as SLAM glitches (meters). */
export const SLAM_JUMP_LARGE_CORRECT_MAX_M = 2.5;

/** Consecutive eligible frames required before applying SLAM correction. */
export const SLAM_JUMP_CONFIRM_FRAMES = 2;

/** Ignore horizontal SLAM jump when viewer Y shifts more than this in one frame (crouch glitch). */
export const SLAM_JUMP_MAX_VERTICAL_DELTA_M = 0.15;

/** Single-frame horizontal jumps above this skip normal SLAM gate — use large-jump path. */
export const SLAM_JUMP_MAX_HORIZONTAL_DELTA_M = 0.65;

/** Vertical-primary SLAM relocal — stand-up snap after crouch (session 1780803447786). */
export const SLAM_JUMP_VERTICAL_CORRECT_MIN_M = 0.12;

export const SLAM_JUMP_VERTICAL_CORRECT_MAX_M = 0.35;

/** Max vertical shift applied to session floor root in one correction (meters). */
export const SLAM_JUMP_VERTICAL_APPLY_MAX_M = 0.12;

export type SlamFloorShiftResult = {
  applied: boolean;
  remainderX: number;
  remainderZ: number;
};

export function shouldApplyHorizontalSlamJump(
  horizontalM: number,
  verticalM: number,
  thresholdM: number
): boolean {
  if (!Number.isFinite(horizontalM) || horizontalM < thresholdM) return false;
  if (horizontalM > SLAM_JUMP_MAX_HORIZONTAL_DELTA_M) return false;
  if (!Number.isFinite(verticalM)) return true;
  return Math.abs(verticalM) <= SLAM_JUMP_MAX_VERTICAL_DELTA_M;
}

/** Large horizontal relocal after long walk — emulated anchors never diverge (session 1780812499909). */
export function shouldApplyLargeHorizontalSlamJump(
  horizontalM: number,
  verticalM: number
): boolean {
  if (!Number.isFinite(horizontalM)) return false;
  if (horizontalM <= SLAM_JUMP_MAX_HORIZONTAL_DELTA_M) return false;
  if (horizontalM > SLAM_JUMP_LARGE_CORRECT_MAX_M) return false;
  if (!Number.isFinite(verticalM)) return true;
  return Math.abs(verticalM) <= SLAM_JUMP_MAX_VERTICAL_DELTA_M;
}

/** Compensate session floor when SLAM relocalizes vertically (horizontal blocked by vertical gate). */
export function shouldApplyVerticalSlamJump(
  horizontalM: number,
  verticalM: number,
  horizontalThresholdM: number
): boolean {
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

export function cappedVerticalSlamDelta(
  deltaY: number,
  maxShiftM = SLAM_JUMP_VERTICAL_APPLY_MAX_M
): number {
  if (!Number.isFinite(deltaY)) return 0;
  const abs = Math.abs(deltaY);
  if (abs <= maxShiftM) return deltaY;
  return Math.sign(deltaY) * maxShiftM;
}

export function cappedCameraPathStep(stepM: number): number {
  if (!Number.isFinite(stepM) || stepM <= 0) return 0;
  return Math.min(stepM, MAX_CAMERA_PATH_STEP_M);
}

export type WorldFrozenPlacement = {
  root: TransformNode;
  pinnedWorldPosition?: Vector3;
  pinnedWorldRotation?: Quaternion;
};

/** Shift pinned world poses when SLAM relocalizes without an XRReferenceSpace reset event. */
export function applyHorizontalSlamJumpToWorldFrozen(
  entries: readonly WorldFrozenPlacement[],
  deltaX: number,
  deltaZ: number
): number {
  if (Math.hypot(deltaX, deltaZ) < SLAM_JUMP_CORRECT_HORIZONTAL_M) return 0;
  let corrected = 0;
  for (const entry of entries) {
    if (!entry.pinnedWorldPosition || !entry.pinnedWorldRotation) continue;
    entry.pinnedWorldPosition.x += deltaX;
    entry.pinnedWorldPosition.z += deltaZ;
    if (
      repinWorldFrozenNode(
        entry.root,
        entry.pinnedWorldPosition,
        entry.pinnedWorldRotation
      )
    ) {
      corrected += 1;
    }
  }
  return corrected;
}

export function cappedHorizontalSlamDelta(
  deltaX: number,
  deltaZ: number,
  maxShiftM = SLAM_JUMP_APPLY_MAX_SHIFT_M
): { dx: number; dz: number } {
  const dist = Math.hypot(deltaX, deltaZ);
  if (!Number.isFinite(dist) || dist <= maxShiftM) {
    return { dx: deltaX, dz: deltaZ };
  }
  const scale = maxShiftM / dist;
  return { dx: deltaX * scale, dz: deltaZ * scale };
}

function applySessionFloorSlamShift(
  state: SessionFloorAnchorState,
  floorRoot: TransformNode,
  dx: number,
  dz: number
): void {
  if (!state.lastRootPosition) return;
  state.lastRootPosition.x += dx;
  state.lastRootPosition.z += dz;
  const held = state.lastRootPosition.clone();
  floorRoot.unfreezeWorldMatrix();
  floorRoot.setAbsolutePosition(held);
  floorRoot.rotationQuaternion = Quaternion.Identity();
  floorRoot.computeWorldMatrix(true);
}

/** Shift session floor root when SLAM relocalizes without a reference-space reset event. */
export function applyHorizontalSlamJumpToSessionFloor(
  state: SessionFloorAnchorState,
  floorRoot: TransformNode,
  deltaX: number,
  deltaZ: number,
  thresholdM = SLAM_JUMP_CORRECT_HORIZONTAL_M,
  maxShiftM = SLAM_JUMP_APPLY_MAX_SHIFT_M
): SlamFloorShiftResult {
  const jumpM = Math.hypot(deltaX, deltaZ);
  if (jumpM < thresholdM || !state.lastRootPosition) {
    return { applied: false, remainderX: 0, remainderZ: 0 };
  }
  const { dx, dz } = cappedHorizontalSlamDelta(deltaX, deltaZ, maxShiftM);
  applySessionFloorSlamShift(state, floorRoot, dx, dz);
  return {
    applied: true,
    remainderX: deltaX - dx,
    remainderZ: deltaZ - dz,
  };
}

/** Apply one catch-up step toward a pending SLAM remainder vector. */
export function applySlamJumpRemainderStep(
  state: SessionFloorAnchorState,
  floorRoot: TransformNode,
  remainder: { x: number; z: number },
  stepM = SLAM_JUMP_REMAINDER_STEP_M
): boolean {
  const remM = Math.hypot(remainder.x, remainder.z);
  if (remM < 0.008 || !state.lastRootPosition) {
    remainder.x = 0;
    remainder.z = 0;
    return false;
  }
  const step = Math.min(stepM, remM);
  const scale = step / remM;
  const dx = remainder.x * scale;
  const dz = remainder.z * scale;
  applySessionFloorSlamShift(state, floorRoot, dx, dz);
  remainder.x -= dx;
  remainder.z -= dz;
  if (Math.hypot(remainder.x, remainder.z) < 0.008) {
    remainder.x = 0;
    remainder.z = 0;
  }
  return true;
}

/** Shift session floor root on vertical SLAM relocal (stand-up / map Y snap). */
export function applyVerticalSlamJumpToSessionFloor(
  state: SessionFloorAnchorState,
  floorRoot: TransformNode,
  deltaY: number
): boolean {
  if (!state.lastRootPosition) return false;
  const capped = cappedVerticalSlamDelta(deltaY);
  if (Math.abs(capped) < SLAM_JUMP_VERTICAL_CORRECT_MIN_M) return false;
  state.lastRootPosition.y += capped;
  if (state.binding) {
    state.binding.frozenY = state.lastRootPosition.y;
  }
  const held = state.lastRootPosition.clone();
  floorRoot.unfreezeWorldMatrix();
  floorRoot.setAbsolutePosition(held);
  floorRoot.rotationQuaternion = Quaternion.Identity();
  floorRoot.computeWorldMatrix(true);
  return true;
}
