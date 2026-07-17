import { Quaternion, Vector3 } from "@babylonjs/core";

/** Convert a world-space point through an XRReferenceSpace reset transform. */
export function applyReferenceSpaceResetToPoint(
  point: Vector3,
  transform: XRRigidTransform,
  rightHandedSystem: boolean
): Vector3 {
  const offset = new Vector3(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );
  const rot = new Quaternion(
    transform.orientation.x,
    transform.orientation.y,
    transform.orientation.z,
    transform.orientation.w
  );
  if (!rightHandedSystem) {
    offset.z *= -1;
    rot.z *= -1;
    rot.w *= -1;
  }
  const out = point.clone();
  out.rotateByQuaternionToRef(rot, out);
  out.addInPlace(offset);
  return out;
}

export function applyReferenceSpaceResetToRotation(
  rotation: Quaternion,
  transform: XRRigidTransform,
  rightHandedSystem: boolean
): Quaternion {
  const rot = new Quaternion(
    transform.orientation.x,
    transform.orientation.y,
    transform.orientation.z,
    transform.orientation.w
  );
  if (!rightHandedSystem) {
    rot.z *= -1;
    rot.w *= -1;
  }
  return rot.multiply(rotation);
}

export function applyReferenceSpaceResetToPose(
  position: Vector3,
  rotation: Quaternion,
  transform: XRRigidTransform,
  rightHandedSystem: boolean
): { position: Vector3; rotation: Quaternion } {
  return {
    position: applyReferenceSpaceResetToPoint(position, transform, rightHandedSystem),
    rotation: applyReferenceSpaceResetToRotation(rotation, transform, rightHandedSystem),
  };
}
