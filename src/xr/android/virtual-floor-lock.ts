import { Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import {
  applyPlacementAnchorBinding,
  finalizePlacementAnchorBinding,
  resolveAnchorWorldPosition,
  type AnchorApplyResult,
  type PlacementAnchorBinding,
} from "./placement-anchor";
import {
  PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M,
} from "./placement-lock";

/** Walk sync disabled — continuous anchor follow caused end-of-session drift on Android. */
export const WALK_CONTINUOUS_ANCHOR_SYNC_M = Number.POSITIVE_INFINITY;

/** Soft anchor drift correction after walking this far from first placement (meters). */
export const WALK_SOFT_ANCHOR_DRIFT_MIN_M = 0.15;

/** Anchor vs held root divergence before applying soft correction (meters). */
export const SESSION_FLOOR_SOFT_DRIFT_MIN_M = 0.018;

/** Max correction step per frame toward anchor target (meters). */
export const SESSION_FLOOR_SOFT_DRIFT_STEP_M = 0.028;

/** Reject soft correction when anchor target jumps more than this in one frame (meters). */
export const SESSION_FLOOR_SOFT_DRIFT_MAX_FRAME_M = 0.14;

/** Anchor divergence above this — stale after SLAM; rebind instead of soft drift (1780825483568). */
export const SESSION_FLOOR_SOFT_DRIFT_MAX_DIVERGENCE_M = 0.35;

/** Consecutive anchor pose misses before requesting a rebind at the last known root pose. */
export const SESSION_ANCHOR_REBIND_LOSS_STREAK = 20;

/** Max single-frame step toward anchor during walk sync (meters). */
export const WALK_ANCHOR_MAX_FRAME_STEP_M = 0.2;

export type SessionFloorAnchorState = {
  binding: PlacementAnchorBinding | null;
  lastRootPosition: Vector3 | null;
  /** True after anchor bind — hold root pose until horizontal SLAM relocalization. */
  poseLocked: boolean;
  rootAnchorUpdates: number;
  rootJumpRejects: number;
};

export function createSessionFloorAnchorState(): SessionFloorAnchorState {
  return {
    binding: null,
    lastRootPosition: null,
    poseLocked: false,
    rootAnchorUpdates: 0,
    rootJumpRejects: 0,
  };
}

/**
 * Parent model under the floor root with a fixed local transform.
 * Do not freezeWorldMatrix — the root carries SLAM corrections on relocal only.
 */
export function attachPlacedToFloorRoot(
  entryRoot: TransformNode,
  floorRoot: TransformNode,
  worldPosition: Vector3,
  worldRotation: Quaternion
): void {
  entryRoot.unfreezeWorldMatrix();
  floorRoot.computeWorldMatrix(true);
  entryRoot.parent = floorRoot;
  const inv = floorRoot.getWorldMatrix().clone();
  inv.invert();
  entryRoot.position.copyFrom(Vector3.TransformCoordinates(worldPosition, inv));
  const rootRot = floorRoot.absoluteRotationQuaternion ?? Quaternion.Identity();
  entryRoot.rotationQuaternion = rootRot.invert().multiply(worldRotation);
  entryRoot.computeWorldMatrix(true);
}

export function bindSessionFloorAnchor(
  state: SessionFloorAnchorState,
  anchor: XRAnchor,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  floorRoot: TransformNode,
  planeHeightM: number,
  worldPosition: Vector3,
  worldYaw: number,
  rightHandedSystem: boolean
): boolean {
  const worldPos = worldPosition.clone();
  worldPos.y = planeHeightM;
  const binding = finalizePlacementAnchorBinding(
    anchor,
    frame,
    referenceSpace,
    worldPos,
    worldYaw,
    rightHandedSystem
  );
  if (!binding) return false;
  binding.frozenY = planeHeightM;
  state.binding = binding;
  state.lastRootPosition = worldPos.clone();
  state.poseLocked = true;
  floorRoot.unfreezeWorldMatrix();
  floorRoot.setAbsolutePosition(worldPos);
  floorRoot.rotationQuaternion = Quaternion.Identity();
  floorRoot.computeWorldMatrix(true);
  return true;
}

export function syncSessionFloorBindingY(
  state: SessionFloorAnchorState,
  planeHeightM: number
): void {
  if (state.binding) {
    state.binding.frozenY = planeHeightM;
  }
  if (state.lastRootPosition) {
    state.lastRootPosition.y = planeHeightM;
  }
}

export type SessionFloorUpdateOutcome = {
  result: AnchorApplyResult;
  resynced: boolean;
  softDrift?: boolean;
  anchorDriftM?: number;
  /** Stale XR anchor after SLAM — caller should rebind at held root pose. */
  requestRebind?: boolean;
};

/** Hold floor root fixed; SLAM XZ correction runs in refreshViewerOrigin — not per-frame anchor follow. */
export function updateSessionFloorRootFromAnchor(
  state: SessionFloorAnchorState,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  floorRoot: TransformNode,
  planeHeightM: number,
  rightHandedSystem: boolean,
  _viewerHorizontalJumpM: number,
  walkSincePlacementM = 0,
  forceResync = false
): SessionFloorUpdateOutcome {
  if (!state.binding) return { result: "unchanged", resynced: false };

  /** One-shot ring resync only — continuous viewer-jump resync drifts with ARCore rubber-sheet. */
  const resync = forceResync;
  const walkSync =
    walkSincePlacementM >= WALK_CONTINUOUS_ANCHOR_SYNC_M;

  if (state.poseLocked && !resync && !walkSync) {
    if (
      state.lastRootPosition &&
      state.binding &&
      walkSincePlacementM >= WALK_SOFT_ANCHOR_DRIFT_MIN_M
    ) {
      const computed = resolveAnchorWorldPosition(
        state.binding,
        frame,
        referenceSpace,
        rightHandedSystem
      );
      if (computed) {
        const held = state.lastRootPosition;
        const diverged = Math.hypot(
          computed.position.x - held.x,
          computed.position.z - held.z
        );
        if (diverged >= SESSION_FLOOR_SOFT_DRIFT_MIN_M) {
          // Never lerp toward a drifting anchor — rebind at held pose (1780827401581).
          return {
            result: "unchanged",
            resynced: false,
            anchorDriftM: diverged,
            requestRebind: true,
          };
        }
      }
    }
    if (state.lastRootPosition) {
      const held = state.lastRootPosition.clone();
      held.y = planeHeightM;
      floorRoot.unfreezeWorldMatrix();
      floorRoot.setAbsolutePosition(held);
      floorRoot.rotationQuaternion = Quaternion.Identity();
      floorRoot.computeWorldMatrix(true);
    }
    return { result: "unchanged", resynced: false };
  }

  const outcome = applyPlacementAnchorBinding(
    state.binding,
    frame,
    referenceSpace,
    rightHandedSystem,
    floorRoot,
    {
      minUpdateDeltaM: walkSync ? 0.001 : 0,
      maxSingleFrameJumpM: resync
        ? Number.POSITIVE_INFINITY
        : walkSync
          ? 0.45
          : PLACEMENT_LOCK_RELOCAL_VIEWER_JUMP_M,
      partialStepOnRejectM: walkSync ? WALK_ANCHOR_MAX_FRAME_STEP_M : undefined,
      lastApplied: resync ? null : state.lastRootPosition,
    }
  );

  if (outcome.result === "lost") {
    if (state.lastRootPosition) {
      const held = state.lastRootPosition.clone();
      held.y = planeHeightM;
      floorRoot.unfreezeWorldMatrix();
      floorRoot.setAbsolutePosition(held);
      floorRoot.rotationQuaternion = Quaternion.Identity();
      floorRoot.computeWorldMatrix(true);
    }
    return { result: "lost", resynced: false };
  }

  if (outcome.result === "rejected") {
    state.rootJumpRejects += 1;
    if (state.lastRootPosition) {
      const held = state.lastRootPosition.clone();
      held.y = planeHeightM;
      floorRoot.unfreezeWorldMatrix();
      floorRoot.setAbsolutePosition(held);
      floorRoot.rotationQuaternion = Quaternion.Identity();
      floorRoot.computeWorldMatrix(true);
    }
    return { result: "rejected", resynced: false };
  }

  if (outcome.result === "applied" && outcome.position) {
    outcome.position.y = planeHeightM;
    floorRoot.unfreezeWorldMatrix();
    floorRoot.setAbsolutePosition(outcome.position);
    floorRoot.rotationQuaternion = Quaternion.Identity();
    floorRoot.computeWorldMatrix(true);
    state.lastRootPosition = outcome.position.clone();
    state.poseLocked = true;
    state.rootAnchorUpdates += 1;
    return { result: "applied", resynced: resync };
  }

  if (state.lastRootPosition) {
    const held = state.lastRootPosition.clone();
    held.y = planeHeightM;
    floorRoot.unfreezeWorldMatrix();
    floorRoot.setAbsolutePosition(held);
    floorRoot.rotationQuaternion = Quaternion.Identity();
    floorRoot.computeWorldMatrix(true);
  }

  return { result: outcome.result, resynced: false };
}
