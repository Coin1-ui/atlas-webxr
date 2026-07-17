import { Quaternion, Vector3 } from "@babylonjs/core";

export type FloorRayHit = {
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export type FloorRayRejectReason =
  | "direction-not-down"
  | "distance-out-of-range"
  | "origin-at-floor-use-forward"
  | "no-xr-frame"
  | "no-reference-space"
  | "no-viewer-pose"
  | "tracking-not-ready";

export type XrFramePoseContext = {
  referenceSpace?: XRReferenceSpace | null;
  baseReferenceSpace?: XRReferenceSpace | null;
  viewerReferenceSpace?: XRReferenceSpace | null;
};

export type FloorRayAttempt = {
  hit: FloorRayHit | null;
  rejectReason: FloorRayRejectReason | null;
  originY: number;
  forwardY: number;
};

export type FloorRayOptions = {
  minForwardDown?: number;
  minDistanceM?: number;
  maxDistanceM?: number;
  floorY?: number;
  forwardDistanceAtFloor?: number;
  /** Minimum viewer height (m) — rejects uninitialized (0,0,0) poses before tracking. */
  minOriginY?: number;
};

const DEFAULTS: Required<FloorRayOptions> = {
  minForwardDown: 0.05,
  minDistanceM: 0.15,
  maxDistanceM: 12,
  floorY: 0,
  forwardDistanceAtFloor: 1.2,
  minOriginY: 0.35,
};

function isUntrackedPose(
  origin: { x: number; y: number; z: number },
  floorY: number,
  minOriginY: number
): boolean {
  if (origin.y >= minOriginY) return false;
  return Math.hypot(origin.x, origin.z) < 0.15 && Math.abs(origin.y - floorY) < 0.15;
}

/** Project viewer forward (XZ) onto a horizontal floor — works when the phone is held level. */
export function projectViewerForwardToFloor(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  floorY: number,
  forwardDistanceM = 1.2
): FloorRayHit | null {
  const flatLen = Math.hypot(direction.x, direction.z);
  if (flatLen < 0.01) return null;
  const yaw = Math.atan2(direction.x, direction.z);
  return {
    x: origin.x + (direction.x / flatLen) * forwardDistanceM,
    y: floorY,
    z: origin.z + (direction.z / flatLen) * forwardDistanceM,
    yaw: yaw + Math.PI,
  };
}

/** Intersect a world-space ray with a horizontal floor plane (default y=0). */
export function intersectRayWithHorizontalFloor(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  options: FloorRayOptions = {}
): FloorRayAttempt {
  const opts = { ...DEFAULTS, ...options };
  const originY = origin.y;
  const forwardY = direction.y;

  if (isUntrackedPose(origin, opts.floorY, opts.minOriginY)) {
    return { hit: null, rejectReason: "tracking-not-ready", originY, forwardY };
  }

  if (Math.abs(originY - opts.floorY) < 0.08 && Math.abs(forwardY) < opts.minForwardDown) {
    const flatLen = Math.hypot(direction.x, direction.z);
    if (flatLen < 0.01) {
      return {
        hit: null,
        rejectReason: "direction-not-down",
        originY,
        forwardY,
      };
    }
    const yaw = Math.atan2(direction.x, direction.z);
    return {
      hit: {
        x: origin.x + (direction.x / flatLen) * opts.forwardDistanceAtFloor,
        y: opts.floorY,
        z: origin.z + (direction.z / flatLen) * opts.forwardDistanceAtFloor,
        yaw: yaw + Math.PI,
      },
      rejectReason: null,
      originY,
      forwardY,
    };
  }

  if (forwardY >= -opts.minForwardDown) {
    return { hit: null, rejectReason: "direction-not-down", originY, forwardY };
  }

  const t = (opts.floorY - originY) / forwardY;
  if (t < opts.minDistanceM || t > opts.maxDistanceM) {
    return { hit: null, rejectReason: "distance-out-of-range", originY, forwardY };
  }

  const yaw = Math.atan2(direction.x, direction.z);
  return {
    hit: {
      x: origin.x + direction.x * t,
      y: opts.floorY,
      z: origin.z + direction.z * t,
      yaw: yaw + Math.PI,
    },
    rejectReason: null,
    originY,
    forwardY,
  };
}

/**
 * Resolve viewer pose in floor space — tries getViewerPose on each reference space,
 * then getPose(viewer, floor) for devices where getViewerPose(local-floor) is null.
 */
export function resolveViewerPoseFromFrame(
  frame: XRFrame,
  ctx: XrFramePoseContext
): XRPose | null {
  const spaces: XRReferenceSpace[] = [];
  if (ctx.referenceSpace) spaces.push(ctx.referenceSpace);
  if (
    ctx.baseReferenceSpace &&
    ctx.baseReferenceSpace !== ctx.referenceSpace
  ) {
    spaces.push(ctx.baseReferenceSpace);
  }
  for (const space of spaces) {
    const pose = frame.getViewerPose(space);
    if (pose?.transform) return pose;
  }

  const floor = ctx.referenceSpace ?? ctx.baseReferenceSpace;
  const viewer = ctx.viewerReferenceSpace;
  if (floor && viewer) {
    const rel = frame.getPose(viewer, floor);
    if (rel?.transform) {
      return { transform: rel.transform, emulatedPosition: false };
    }
  }
  return null;
}

/** Build viewer origin + forward from a WebXR viewer pose (local-floor space). */
export function viewerRayFromXrPose(
  pose: XRPose,
  rightHandedSystem: boolean
): { origin: Vector3; forward: Vector3 } {
  const t = pose.transform;
  const origin = new Vector3(t.position.x, t.position.y, t.position.z);
  const quat = new Quaternion(
    t.orientation.x,
    t.orientation.y,
    t.orientation.z,
    t.orientation.w
  );
  const forward = new Vector3(0, 0, rightHandedSystem ? -1 : 1);
  forward.rotateByQuaternionToRef(quat, forward);
  forward.normalize();
  return { origin, forward };
}
