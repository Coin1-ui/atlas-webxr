/** Minimum world-up component for hit-test surface normal to count as floor. */
export const MIN_FLOOR_NORMAL_Y = 0.65;

export const POSE_GRACE_MS = 2000;

export type FloorPollState = {
  ready: boolean;
};

export type FloorHitInput = {
  latestPoseValid: boolean;
  liveHit: boolean;
  lastValidHitAt: number;
  now: number;
  floorNormalY: number;
  /** After floor scan, keep placement ready while holding last valid floor pose. */
  floorScanComplete?: boolean;
  poseGraceMs?: number;
  minFloorNormalY?: number;
};

export type FloorEvalResult = {
  ready: boolean;
  graceActive: boolean;
  horizontal: boolean;
  poseAgeMs: number;
};

export type FloorEvalOptions = {
  strictAfterScan?: boolean;
};

/** Pure floor-ready logic — unit tested without WebXR. */
export function evaluateFloorReady(
  input: FloorHitInput,
  options?: FloorEvalOptions
): FloorEvalResult {
  const graceMs = input.poseGraceMs ?? POSE_GRACE_MS;
  const minY = input.minFloorNormalY ?? MIN_FLOOR_NORMAL_Y;
  const strict = options?.strictAfterScan ?? true;
  const poseAgeMs = input.lastValidHitAt
    ? Math.round(input.now - input.lastValidHitAt)
    : 9999;
  const graceActive =
    !input.liveHit && poseAgeMs < graceMs && input.latestPoseValid;
  const horizontal = input.floorNormalY >= minY;
  const ready = strict
    ? input.latestPoseValid &&
      horizontal &&
      (input.liveHit || graceActive || input.floorScanComplete === true)
    : input.latestPoseValid &&
      (input.floorScanComplete === true ||
        (horizontal && (input.liveHit || graceActive)));
  return { ready, graceActive, horizontal, poseAgeMs };
}

/**
 * Wait until floor placement is ready. Uses polling + state listener — not window rAF,
 * which is unreliable during immersive WebXR on Android Chrome.
 */
export function waitUntilFloorReady(
  getState: () => FloorPollState,
  onChange: (listener: (state: FloorPollState) => void) => () => void,
  timeoutMs: number,
  pollMs = 50
): Promise<{ ok: boolean; waitedMs: number }> {
  const t0 = performance.now();

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let unsub: () => void = () => {};

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearInterval(timer);
      unsub();
      resolve({ ok, waitedMs: Math.round(performance.now() - t0) });
    };

    if (getState().ready) {
      finish(true);
      return;
    }

    unsub = onChange((state) => {
      if (state.ready) finish(true);
    });

    timer = setInterval(() => {
      if (getState().ready) {
        finish(true);
        return;
      }
      if (performance.now() - t0 >= timeoutMs) {
        finish(false);
      }
    }, pollMs);
  });
}
