import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import {
  floorContactDiagnostics,
  snapPlacementBaseToFloor,
} from "../shared/glb-offline-cache";

/** Max submerged clearance to auto-correct after snap (Bar-Chair ~2.9 cm). */
const ANDROID_SUBMERGED_CORRECT_MAX_M = 0.045;

/**
 * Android-only floor snap — corrects collision-hull geometry that sits below the
 * visible mesh (e.g. Bar-Chair submerged -0.029 m). iOS WebXR uses shared snap only.
 */
export function androidSnapPlacementBaseToFloor(
  wrapper: TransformNode,
  floorY: number,
  modelMeshes?: AbstractMesh[]
): number {
  let totalLift = snapPlacementBaseToFloor(wrapper, floorY, modelMeshes);
  wrapper.computeWorldMatrix(true);
  const diag = floorContactDiagnostics(wrapper, modelMeshes);
  const clearance = diag.contactY - floorY;
  if (clearance >= -0.001) return totalLift;
  if (clearance < -ANDROID_SUBMERGED_CORRECT_MAX_M) return totalLift;

  const targetContactY =
    diag.primaryMeshMinY != null && diag.primaryMeshMinY > diag.contactY + 0.001
      ? diag.primaryMeshMinY
      : diag.contactY;
  const extraLift = floorY - targetContactY;
  if (extraLift > 0.001) {
    wrapper.position.y += extraLift;
    totalLift += extraLift;
  }
  return totalLift;
}
