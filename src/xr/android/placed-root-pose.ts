import { Quaternion, TransformNode, Vector3 } from "@babylonjs/core";

/** Apply reticle world pose as local transform under placementRoot (safe after root reset). */
export function placePlacedRootAtWorldPose(
  root: TransformNode,
  placementRoot: TransformNode,
  worldPosition: Vector3,
  worldRotation: Quaternion
): void {
  placementRoot.computeWorldMatrix(true);
  root.parent = placementRoot;
  const inv = placementRoot.getWorldMatrix().clone();
  inv.invert();
  root.position.copyFrom(Vector3.TransformCoordinates(worldPosition, inv));
  const rootRot = placementRoot.absoluteRotationQuaternion ?? Quaternion.Identity();
  root.rotationQuaternion = rootRot.invert().multiply(worldRotation);
  root.computeWorldMatrix(true);
}
