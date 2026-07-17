import { Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import { horizontalQuaternion, quaternionYaw } from "./ring-pose";

export type PlacementAnchorBinding = {
  anchor: XRAnchor;
  /** World Y frozen at placement — never updated from tracking. */
  frozenY: number;
  /** XZ offset from anchor origin in floor space. */
  xzOffset: Vector3;
  /** Yaw delta applied on top of anchor orientation. */
  yawOffset: number;
};

export type AnchorApplyResult = "applied" | "unchanged" | "lost" | "rejected";

export type ApplyPlacementAnchorOptions = {
  /** Ignore sub-threshold anchor motion (reduces post-placement jitter). */
  minUpdateDeltaM?: number;
  /** Reject single-frame SLAM pops larger than this (meters). */
  maxSingleFrameJumpM?: number;
  lastApplied?: Vector3 | null;
  /** When jump exceeds maxSingleFrameJumpM, step this far toward anchor instead of rejecting. */
  partialStepOnRejectM?: number;
};

export function xrPoseToVectors(
  pose: XRPose,
  rightHandedSystem: boolean
): { position: Vector3; rotation: Quaternion } {
  const t = pose.transform;
  const position = new Vector3(t.position.x, t.position.y, t.position.z);
  const rotation = new Quaternion(
    t.orientation.x,
    t.orientation.y,
    t.orientation.z,
    t.orientation.w
  );
  if (!rightHandedSystem) {
    position.z *= -1;
    rotation.z *= -1;
    rotation.w *= -1;
  }
  return { position, rotation };
}

/** Release world freeze so XR anchor pose can drive the node each frame. */
export function unfreezePlacedForAnchor(root: TransformNode): void {
  root.unfreezeWorldMatrix();
}

/** Pin a placed object in world space — never parented to the XR camera rig. */
export function freezePlacedInWorld(root: TransformNode): {
  position: Vector3;
  rotation: Quaternion;
} {
  root.computeWorldMatrix(true);
  const worldPos = root.absolutePosition.clone();
  const worldRot = root.absoluteRotationQuaternion.clone();
  root.parent = null;
  root.setAbsolutePosition(worldPos);
  root.rotationQuaternion = worldRot;
  root.computeWorldMatrix(true);
  root.freezeWorldMatrix();
  return { position: worldPos, rotation: worldRot };
}

/** Force a world-frozen placement back to its pinned world pose (guards XR rig drift). */
export function repinWorldFrozenNode(
  root: TransformNode,
  pinnedPosition: Vector3,
  pinnedRotation: Quaternion
): boolean {
  let corrected = false;
  if (root.parent !== null) {
    root.parent = null;
    corrected = true;
  }
  root.unfreezeWorldMatrix();
  root.computeWorldMatrix(true);
  const current = root.absolutePosition;
  if (
    Math.hypot(current.x - pinnedPosition.x, current.z - pinnedPosition.z) > 0.002 ||
    Math.abs(current.y - pinnedPosition.y) > 0.002
  ) {
    corrected = true;
  }
  root.setAbsolutePosition(pinnedPosition);
  if (root.rotationQuaternion) {
    root.rotationQuaternion.copyFrom(pinnedRotation);
  }
  root.computeWorldMatrix(true);
  root.freezeWorldMatrix();
  return corrected;
}

/** Create anchor binding from an already-created XRAnchor (must run inside an XRFrame). */
export function finalizePlacementAnchorBinding(
  anchor: XRAnchor,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  worldPosition: Vector3,
  worldYaw: number,
  rightHandedSystem: boolean
): PlacementAnchorBinding | null {
  try {
    const anchorPose = frame.getPose(anchor.anchorSpace, referenceSpace);
    if (!anchorPose) return null;
    const { position: anchorPos, rotation: anchorRot } = xrPoseToVectors(
      anchorPose,
      rightHandedSystem
    );
    const anchorYaw = quaternionYaw(anchorRot);
    return {
      anchor,
      frozenY: worldPosition.y,
      xzOffset: new Vector3(
        worldPosition.x - anchorPos.x,
        0,
        worldPosition.z - anchorPos.z
      ),
      yawOffset: worldYaw - anchorYaw,
    };
  } catch {
    return null;
  }
}

/** Re-create an XR anchor at a known world position (recovery after tracking loss). */
export async function createAnchorAtWorldPosition(
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  worldPosition: Vector3,
  rightHandedSystem: boolean
): Promise<XRAnchor | null> {
  const createAnchor = (
    frame as XRFrame & {
      createAnchor?: (
        transform: XRRigidTransform,
        space: XRSpace
      ) => Promise<XRAnchor>;
    }
  ).createAnchor;
  if (typeof createAnchor !== "function") return null;
  let z = worldPosition.z;
  if (!rightHandedSystem) z = -z;
  try {
    const transform = new XRRigidTransform(
      { x: worldPosition.x, y: worldPosition.y, z, w: 1 },
      { x: 0, y: 0, z: 0, w: 1 }
    );
    return await createAnchor.call(frame, transform, referenceSpace);
  } catch {
    return null;
  }
}

/** Create a world-locked anchor binding for a placed object. */
export async function createPlacementAnchorBinding(
  hitResult: XRHitTestResult,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  worldPosition: Vector3,
  worldYaw: number,
  rightHandedSystem: boolean
): Promise<PlacementAnchorBinding | null> {
  if (typeof hitResult.createAnchor !== "function") return null;
  try {
    const createAnchor = hitResult.createAnchor?.bind(hitResult);
    if (!createAnchor) return null;
    const anchor = await createAnchor(new XRRigidTransform());
    if (!anchor) return null;
    return finalizePlacementAnchorBinding(
      anchor,
      frame,
      referenceSpace,
      worldPosition,
      worldYaw,
      rightHandedSystem
    );
  } catch {
    return null;
  }
}

function computeAnchorWorldPosition(
  binding: PlacementAnchorBinding,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  rightHandedSystem: boolean
): { position: Vector3; rotation: Quaternion } | null {
  const anchorPose = frame.getPose(binding.anchor.anchorSpace, referenceSpace);
  if (!anchorPose) return null;
  const { position: anchorPos, rotation: anchorRot } = xrPoseToVectors(
    anchorPose,
    rightHandedSystem
  );
  const anchorYaw = quaternionYaw(anchorRot);
  return {
    position: new Vector3(
      anchorPos.x + binding.xzOffset.x,
      binding.frozenY,
      anchorPos.z + binding.xzOffset.z
    ),
    rotation: horizontalQuaternion(anchorYaw + binding.yawOffset),
  };
}

/** Sync world-frozen placement XZ from XR anchor while keeping pinned Y fixed. */
export function syncWorldFrozenAnchorXZ(
  binding: PlacementAnchorBinding,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  rightHandedSystem: boolean,
  pinnedPosition: Vector3,
  pinnedRotation: Quaternion,
  root: TransformNode,
  maxSingleFrameJumpM = 0.1
): AnchorApplyResult {
  const computed = computeAnchorWorldPosition(
    binding,
    frame,
    referenceSpace,
    rightHandedSystem
  );
  if (!computed) return "lost";
  const jumpM = Math.hypot(
    computed.position.x - pinnedPosition.x,
    computed.position.z - pinnedPosition.z
  );
  if (jumpM > maxSingleFrameJumpM) return "rejected";
  if (jumpM >= 0.002) {
    pinnedPosition.x = computed.position.x;
    pinnedPosition.z = computed.position.z;
    repinWorldFrozenNode(root, pinnedPosition, pinnedRotation);
    return "applied";
  }
  return "unchanged";
}

/** Apply anchor pose so placed content stays pinned in the real world. */
export function applyPlacementAnchorBinding(
  binding: PlacementAnchorBinding,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  rightHandedSystem: boolean,
  target: TransformNode,
  options: ApplyPlacementAnchorOptions = {}
): { result: AnchorApplyResult; position: Vector3 | null } {
  const minUpdateDeltaM = options.minUpdateDeltaM ?? 0.02;
  const maxSingleFrameJumpM = options.maxSingleFrameJumpM ?? 0.1;
  try {
    const computed = computeAnchorWorldPosition(
      binding,
      frame,
      referenceSpace,
      rightHandedSystem
    );
    if (!computed) return { result: "lost", position: options.lastApplied ?? null };

    target.unfreezeWorldMatrix();
    target.computeWorldMatrix(true);
    const current = target.absolutePosition;
    const nextPos = computed.position;

    if (options.lastApplied) {
      const jumpFromLast = Math.hypot(
        nextPos.x - options.lastApplied.x,
        nextPos.z - options.lastApplied.z
      );
      if (jumpFromLast > maxSingleFrameJumpM) {
        const partialStep = options.partialStepOnRejectM;
        if (partialStep != null && partialStep > 0) {
          const stepM = Math.min(jumpFromLast, partialStep);
          const stepped = options.lastApplied.clone();
          stepped.x += ((nextPos.x - stepped.x) / jumpFromLast) * stepM;
          stepped.z += ((nextPos.z - stepped.z) / jumpFromLast) * stepM;
          stepped.y = nextPos.y;
          target.setAbsolutePosition(stepped);
          if (target.rotationQuaternion) {
            target.rotationQuaternion.copyFrom(computed.rotation);
          }
          target.computeWorldMatrix(true);
          return { result: "applied", position: stepped };
        }
        target.setAbsolutePosition(options.lastApplied);
        if (target.rotationQuaternion) {
          target.rotationQuaternion.copyFrom(computed.rotation);
        }
        target.computeWorldMatrix(true);
        return { result: "rejected", position: options.lastApplied };
      }
    }

    const deltaFromCurrent = Math.hypot(
      nextPos.x - current.x,
      nextPos.z - current.z
    );
    if (deltaFromCurrent < minUpdateDeltaM) {
      return {
        result: "unchanged",
        position: options.lastApplied ?? current.clone(),
      };
    }

    target.setAbsolutePosition(nextPos);
    target.rotationQuaternion = computed.rotation;
    return { result: "applied", position: nextPos.clone() };
  } catch {
    return { result: "lost", position: options.lastApplied ?? null };
  }
}
