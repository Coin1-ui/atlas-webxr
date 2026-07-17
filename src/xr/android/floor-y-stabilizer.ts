/** Samples needed before locking floor Y at end of scan. */
export const FLOOR_Y_LOCK_MIN_SAMPLES = 5;

/** Minimum surface samples to auto-complete scan when hits are sparse. */
export const FLOOR_Y_SCAN_MIN_SAMPLES = 3;

/** Camera-ray floor hits can lock sooner — they ignore box/table tops. */
export const FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES = 2;

/** Plausible standing viewer height — below this skip the below-viewer filter. */
export const FLOOR_Y_MIN_VIEWER_FOR_FILTER_M = 0.5;

export const FLOOR_Y_MAX_ABS_M = 2.5;

/** Reject hit-test / locked floor Y below this — negative values are SLAM tracking errors. */
export const FLOOR_Y_MIN_M = 0.05;

/** Floor hit should be at least this far below the viewer (filters tables/counters). */
export const FLOOR_Y_MIN_BELOW_VIEWER_M = 0.45;

/** When scan samples span more than this, keep the lower cluster (floor vs table/box). */
export const FLOOR_Y_BIMODAL_SPREAD_M = 0.2;

/** Drop scan samples this far above the lowest sample (box/table tops on floor). */
export const FLOOR_Y_ELEVATED_SURFACE_M = 0.12;

/** Apply low-cluster filtering once we have this many samples. */
export const FLOOR_Y_LOW_CLUSTER_MIN_SAMPLES = 3;

/** Hit-test planes often sit slightly above the visible floor — pull contact down. */
export const FLOOR_CONTACT_BIAS_M = 0.02;

/** When live hit-test Y diverges this far from session lock, trust local hit-test (meters). */
export const FLOOR_LOCK_MAX_DIVERGE_M = 0.08;

/** Reject SLAM viewer-Y spikes above this when bootstrapping floor height. */
export const FLOOR_VIEWER_Y_MAX_FOR_BOOTSTRAP_M = 2.2;

/** Max standing viewer Y tracked for floor lock — above this is SLAM vertical inflation. */
export const FLOOR_STANDING_VIEWER_Y_MAX_M = 1.55;

/** Typical eye-to-floor distance when viewer Y is in standing range (bootstrap for bad SLAM Y). */
export const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_STANDING_M = 0.82;
export const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_MID_M = 0.72;
export const FLOOR_BOOTSTRAP_EYE_TO_FLOOR_LOW_M = 0.55;

/** Bootstrap-only scan auto-complete needs standing-ish viewer Y — crouch estimates are unreliable. */
export const FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M = 1.0;

/** Wait for at least one hit-test frame before bootstrap-only scan can auto-complete (ms). */
export const FLOOR_BOOTSTRAP_SCAN_MIN_WAIT_MS = 2800;

/** Bootstrap-only locks relock to surface hits with this tighter threshold (meters). */
export const FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M = 0.02;

/** Locked floor more than this above viewer-bootstrap estimate is rejected (meters). */
export const FLOOR_LOCKED_MAX_ABOVE_BOOTSTRAP_M = 0.1;

/** Locked floor more than this below bootstrap estimate is rejected (meters). */
export const FLOOR_LOCKED_MIN_BELOW_BOOTSTRAP_M = 0.25;

/** Max shift allowed when relocking an established session floor (meters). */
export const FLOOR_RELOCK_MAX_DELTA_M = 0.12;

/** Scan lock more than this far below viewer bootstrap is a crouch/table artifact (meters). */
export const FLOOR_LOCK_MAX_BELOW_BOOTSTRAP_AT_SCAN_M = 0.15;

/** Bootstrap-only locks may jump further when surface median is trustworthy (meters). */
export const FLOOR_BOOTSTRAP_RELOCK_MAX_DELTA_M = 0.25;

/** Surface median this far above bootstrap cluster wins lock (meters). */
export const FLOOR_SURFACE_OVER_BOOTSTRAP_M = 0.1;

/** Local-override samples before promoting lock to override median. */
export const FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES = 8;

/** Ring/placement local override only when raw hit diverges at least this much (meters). */
export const FLOOR_RING_LOCAL_OVERRIDE_MIN_M = 0.1;

/** Max upward local correction above session lock (table/shelf); downward spikes are SLAM garbage. */
export const FLOOR_LOCAL_MAX_ABOVE_LOCK_M = 0.35;

/** Tight sample spread — prefer minimum Y when locking (reduces elevated-plane bias). */
export const FLOOR_Y_TIGHT_CLUSTER_SPREAD_M = 0.08;

/** Reject scan lock when locked Y diverges this far from surface median or viewer bootstrap. */
export const FLOOR_LOCK_MAX_MEDIAN_DIVERGE_M = 0.15;

/** SLAM viewer-Y spike above standing baseline — use standing Y for scan lock instead. */
export const FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M = 0.25;

/** Locked floor this far above standing bootstrap is table/counter height, not true floor. */
export const FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M = 0.08;

export function contactFloorY(floorY: number): number {
  return floorY - FLOOR_CONTACT_BIAS_M;
}

/**
 * Stable floor height for projected ring display — resists per-frame bootstrap drift when
 * viewer Y spikes or dips during SLAM (session 1781090393626).
 */
/** True when viewer origin Y is in a plausible standing band (not crouch, not SLAM spike). */
export function isPlausibleStandingViewerY(viewerOriginY: number | null | undefined): boolean {
  return (
    viewerOriginY != null &&
    Number.isFinite(viewerOriginY) &&
    viewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M &&
    viewerOriginY <= FLOOR_STANDING_VIEWER_Y_MAX_M
  );
}

/** Prefer standing viewer Y when SLAM spikes at scan-complete (session 1781090889796). */
export function resolveViewerYForScanLock(
  viewerOriginY: number | null | undefined,
  standingViewerOriginY: number | null | undefined
): number | null {
  if (viewerOriginY == null || !Number.isFinite(viewerOriginY)) {
    return standingViewerOriginY ?? null;
  }
  if (
    standingViewerOriginY != null &&
    standingViewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M &&
    viewerOriginY - standingViewerOriginY > FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M
  ) {
    return standingViewerOriginY;
  }
  if (
    standingViewerOriginY != null &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M &&
    viewerOriginY != null &&
    standingViewerOriginY - viewerOriginY > FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M
  ) {
    return standingViewerOriginY;
  }
  return viewerOriginY;
}

/** Floor-ray origin Y — reject SLAM vertical inflation (session 1781092699633). */
export function resolveViewerYForFloorRay(
  originY: number,
  standingBaselineY: number | null | undefined,
  lastPlausibleViewerY: number | null | undefined,
  scanCompleteViewerY: number | null | undefined
): number | null {
  if (isPlausibleStandingViewerY(originY)) return originY;
  if (
    standingBaselineY != null &&
    standingBaselineY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    return standingBaselineY;
  }
  if (
    lastPlausibleViewerY != null &&
    lastPlausibleViewerY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    return lastPlausibleViewerY;
  }
  if (
    scanCompleteViewerY != null &&
    scanCompleteViewerY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    return scanCompleteViewerY;
  }
  if (
    originY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M &&
    originY <= FLOOR_STANDING_VIEWER_Y_MAX_M
  ) {
    return originY;
  }
  return null;
}

/** SLAM vertical dip/spike — hide ring until tracking returns to standing band (1781093577990). */
export function isSlamViewerVerticalGlitch(
  originY: number,
  standingBaselineY: number | null | undefined
): boolean {
  if (!Number.isFinite(originY)) return true;
  if (originY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M) return true;
  if (originY > FLOOR_STANDING_VIEWER_Y_MAX_M) return true;
  if (
    standingBaselineY != null &&
    standingBaselineY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M &&
    Math.abs(originY - standingBaselineY) >
      FLOOR_VIEWER_Y_SPIKE_ABOVE_STANDING_M &&
    !isPlausibleStandingViewerY(originY)
  ) {
    return true;
  }
  return false;
}

/** Prefer pinned scan cluster over crouch-corrupted lockFromScan (session 1781092376352). */
export function preferPinnedScanLockY(
  lockedY: number | null,
  pinnedDisplayFloorY: number | null,
  viewerForLock: number | null | undefined,
  standingViewerY: number | null | undefined,
  bootstrapOnly = false
): number | null {
  if (lockedY == null || pinnedDisplayFloorY == null) return lockedY;
  const maxDiverge = bootstrapOnly
    ? FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
    : FLOOR_LOCK_MAX_DIVERGE_M;
  if (Math.abs(lockedY - pinnedDisplayFloorY) <= maxDiverge) {
    if (
      bootstrapOnly &&
      lockedY > pinnedDisplayFloorY + 0.015 &&
      isPlausibleLockedFloorY(
        pinnedDisplayFloorY,
        viewerForLock,
        standingViewerY
      )
    ) {
      return pinnedDisplayFloorY;
    }
    if (
      bootstrapOnly &&
      lockedY < pinnedDisplayFloorY - 0.015 &&
      isPlausibleLockedFloorY(
        pinnedDisplayFloorY,
        viewerForLock,
        standingViewerY
      )
    ) {
      return pinnedDisplayFloorY;
    }
    return lockedY;
  }
  if (
    isPlausibleLockedFloorY(
      pinnedDisplayFloorY,
      viewerForLock,
      standingViewerY
    )
  ) {
    return pinnedDisplayFloorY;
  }
  return lockedY;
}

/** Bootstrap lock pulled below pinned cluster by crouch SLAM samples (1781094052907). */
export function correctBootstrapCrouchLock(
  lockedY: number,
  pinnedDisplayFloorY: number | null,
  viewerForLock: number | null | undefined,
  standingViewerY: number | null | undefined
): number {
  if (pinnedDisplayFloorY == null) return lockedY;
  if (lockedY >= pinnedDisplayFloorY - FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M) {
    return lockedY;
  }
  if (
    isPlausibleLockedFloorY(
      pinnedDisplayFloorY,
      viewerForLock,
      standingViewerY
    )
  ) {
    return pinnedDisplayFloorY;
  }
  return lockedY;
}

/** Pin ring Y once bootstrap samples form a tight cluster — stops vertical drift during scan. */
export function maybePinDisplayFloorY(
  pinned: number | null,
  sampleYs: number[],
  viewerForFilter: number | null | undefined
): number | null {
  if (pinned != null) return pinned;
  const filtered = filterFloorScanSamples(sampleYs, viewerForFilter);
  if (filtered.length < FLOOR_Y_SCAN_MIN_SAMPLES) return null;
  const sorted = [...filtered].sort((a, b) => a - b);
  const spread = sorted[sorted.length - 1]! - sorted[0]!;
  if (spread > FLOOR_Y_TIGHT_CLUSTER_SPREAD_M) return null;
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Correct table-height bootstrap lock using standing viewer + lowest sample cluster. */
export function correctBootstrapTableHeightLock(
  lockedY: number,
  viewerForLock: number,
  standingViewerY: number | null | undefined,
  bootstrapSamples: number[]
): number {
  if (standingViewerY == null || standingViewerY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M) {
    return lockedY;
  }
  const standingBoot = bootstrapFloorYFromViewer(standingViewerY);
  if (standingBoot == null) return lockedY;
  if (lockedY <= standingBoot + FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M) {
    return lockedY;
  }
  const bootFiltered = filterFloorScanSamples(bootstrapSamples, standingViewerY);
  if (bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
    const sorted = [...bootFiltered].sort((a, b) => a - b);
    const candidate = sorted[0]!;
    if (
      candidate <= standingBoot + FLOOR_TABLE_HEIGHT_ABOVE_STANDING_BOOT_M &&
      isPlausibleLockedFloorY(candidate, viewerForLock, standingViewerY)
    ) {
      return candidate;
    }
  }
  if (isPlausibleLockedFloorY(standingBoot, viewerForLock, standingViewerY)) {
    return standingBoot;
  }
  return lockedY;
}

export function estimateDisplayFloorY(
  lockedFloorY: number | null,
  floorScanComplete: boolean,
  sampleYs: number[],
  lastPlausibleViewerY: number | null,
  viewerOriginY: number | null,
  pinnedDisplayFloorY: number | null = null
): number | null {
  if (floorScanComplete && lockedFloorY != null) {
    return contactFloorY(lockedFloorY);
  }
  if (pinnedDisplayFloorY != null) {
    return contactFloorY(pinnedDisplayFloorY);
  }
  const viewerForFilter = lastPlausibleViewerY ?? viewerOriginY;
  const filtered = filterFloorScanSamples(sampleYs, viewerForFilter);
  if (filtered.length >= 1) {
    const sorted = [...filtered].sort((a, b) => a - b);
    return contactFloorY(sorted[Math.floor(sorted.length / 2)]!);
  }
  const stableViewer =
    lastPlausibleViewerY ??
    (viewerOriginY != null && viewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
      ? viewerOriginY
      : null);
  const boot = bootstrapFloorYFromViewer(stableViewer);
  return boot != null ? contactFloorY(boot) : null;
}

/** Estimate floor Y from viewer height when hit-test returns garbage (negative / table-top). */
export function bootstrapFloorYFromViewer(viewerOriginY?: number | null): number | null {
  if (
    viewerOriginY == null ||
    !Number.isFinite(viewerOriginY) ||
    viewerOriginY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M ||
    viewerOriginY > FLOOR_VIEWER_Y_MAX_FOR_BOOTSTRAP_M
  ) {
    return null;
  }
  const eyeToFloor =
    viewerOriginY >= 1.25
      ? FLOOR_BOOTSTRAP_EYE_TO_FLOOR_STANDING_M
      : viewerOriginY >= 1.0
        ? FLOOR_BOOTSTRAP_EYE_TO_FLOOR_MID_M
        : FLOOR_BOOTSTRAP_EYE_TO_FLOOR_LOW_M;
  const y = viewerOriginY - eyeToFloor;
  return y >= FLOOR_Y_MIN_M ? y : null;
}

/**
 * Use hit-test Y when plausible; otherwise bootstrap from viewer height so scan samples accumulate.
 */
export function sanitizeFloorHitY(
  rawY: number,
  viewerOriginY?: number | null
): { y: number; bootstrapped: boolean } | null {
  if (rawY >= FLOOR_Y_MIN_M && rawY <= FLOOR_Y_MAX_ABS_M) {
    const filtered = filterFloorScanSamples([rawY], viewerOriginY);
    if (filtered.length) return { y: rawY, bootstrapped: false };
  }
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (boot != null) return { y: boot, bootstrapped: true };
  return null;
}

export type FloorScanSampleSource = "camera-ray" | "surface" | "bootstrap";

type ScanSample = {
  y: number;
  source: FloorScanSampleSource;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function lowerQuartile(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.25);
  return sorted[Math.min(idx, sorted.length - 1)] ?? null;
}

/** Reject SLAM garbage — floor Y should stay near the viewer-bootstrap estimate. */
export function isPlausibleLockedFloorY(
  lockedY: number,
  viewerOriginY?: number | null,
  standingViewerOriginY?: number | null
): boolean {
  if (lockedY < FLOOR_Y_MIN_M || lockedY > FLOOR_Y_MAX_ABS_M) return false;
  if (lockedY <= 0.09) return false;
  const bootViewer =
    standingViewerOriginY != null &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? standingViewerOriginY
      : viewerOriginY;
  const boot = bootstrapFloorYFromViewer(bootViewer);
  if (boot != null && lockedY < boot - 0.45) return false;
  if (
    boot != null &&
    lockedY < boot - FLOOR_LOCKED_MIN_BELOW_BOOTSTRAP_M &&
    lockedY < 0.25
  ) {
    return false;
  }
  if (boot != null && lockedY > boot + FLOOR_LOCKED_MAX_ABOVE_BOOTSTRAP_M) {
    return false;
  }
  const viewerForClearance =
    standingViewerOriginY != null &&
    viewerOriginY != null &&
    viewerOriginY < lockedY &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? standingViewerOriginY
      : viewerOriginY;
  if (
    viewerForClearance != null &&
    viewerForClearance >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
  ) {
    const clearance = viewerForClearance - lockedY;
    if (clearance < FLOOR_Y_MIN_BELOW_VIEWER_M) return false;
  }
  return true;
}

/** Camera-ray locks can sit above bootstrap when phone pitch skews viewer Y (iOS session 1780820773855). */
export function isPlausibleCameraRayLockedFloorY(
  lockedY: number,
  viewerOriginY?: number | null
): boolean {
  if (lockedY < FLOOR_Y_MIN_M || lockedY > FLOOR_Y_MAX_ABS_M) return false;
  if (
    viewerOriginY == null ||
    viewerOriginY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    return isPlausibleLockedFloorY(lockedY, viewerOriginY);
  }
  const clearance = viewerOriginY - lockedY;
  return (
    clearance >= FLOOR_Y_MIN_BELOW_VIEWER_M && clearance <= 1.35
  );
}

/** Raw hit-test Y plausibility (lighter than lock — allows table-height local overrides). */
export function isPlausibleFloorHitY(
  rawY: number,
  viewerOriginY?: number | null
): boolean {
  if (rawY < FLOOR_Y_MIN_M || rawY > FLOOR_Y_MAX_ABS_M) return false;
  if (rawY <= 0.09) return false;
  if (!filterFloorScanSamples([rawY], viewerOriginY).length) return false;
  const boot = bootstrapFloorYFromViewer(viewerOriginY);
  if (boot != null && rawY < boot - 0.45) return false;
  return true;
}

/**
 * Live hit-test Y safe to override session lock (ring/placement). Rejects SLAM floor garbage
 * far below lock (e.g. 0.08m when lock is 0.44m) while still allowing table-height corrections.
 */
export function isTrustworthyLocalFloorHit(
  rawY: number,
  lockedFloorY: number | null,
  viewerOriginY?: number | null,
  standingViewerOriginY?: number | null
): boolean {
  const viewerForFilter =
    standingViewerOriginY != null &&
    viewerOriginY != null &&
    lockedFloorY != null &&
    viewerOriginY < lockedFloorY &&
    standingViewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? standingViewerOriginY
      : viewerOriginY;
  if (rawY < FLOOR_Y_MIN_M || rawY > FLOOR_Y_MAX_ABS_M) return false;
  if (!filterFloorScanSamples([rawY], viewerForFilter).length) return false;
  if (!isPlausibleFloorHitY(rawY, viewerForFilter)) return false;
  if (lockedFloorY == null) return true;
  const delta = rawY - lockedFloorY;
  if (Math.abs(delta) <= FLOOR_LOCK_MAX_DIVERGE_M) return true;
  // Upward only — table/counter hits sit >12cm above true floor; reject those for override.
  if (
    delta >= FLOOR_LOCK_MAX_DIVERGE_M &&
    delta <= FLOOR_Y_ELEVATED_SURFACE_M
  ) {
    return true;
  }
  return false;
}

function plausibleFloorSamples(samples: number[]): number[] {
  return samples.filter((y) => y >= FLOOR_Y_MIN_M && y <= FLOOR_Y_MAX_ABS_M);
}

/** Drop samples far above the lowest hit — keeps floor when box/table tops are also seen. */
export function dropElevatedSurfaceSamples(samples: number[]): number[] {
  if (samples.length < 2) return samples;
  const minY = Math.min(...samples);
  return samples.filter((y) => y <= minY + FLOOR_Y_ELEVATED_SURFACE_M);
}

/** Prefer floor plane over table/box-height hits; drop outliers far above the lowest cluster. */
export function filterFloorScanSamples(
  samples: number[],
  viewerOriginY?: number | null
): number[] {
  let filtered = plausibleFloorSamples(samples);
  if (
    viewerOriginY != null &&
    Number.isFinite(viewerOriginY) &&
    viewerOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
  ) {
    const minBelow =
      viewerOriginY < 1.0 ? 0.35 : FLOOR_Y_MIN_BELOW_VIEWER_M;
    filtered = filtered.filter(
      (y) => y <= viewerOriginY && viewerOriginY - y >= minBelow
    );
  }
  filtered = dropElevatedSurfaceSamples(filtered);
  if (filtered.length >= FLOOR_Y_LOW_CLUSTER_MIN_SAMPLES) {
    const sorted = [...filtered].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1]! - sorted[0]!;
    if (spread > FLOOR_Y_BIMODAL_SPREAD_M) {
      const mid = sorted[Math.floor(sorted.length / 2)]!;
      filtered = filtered.filter((y) => y <= mid + 0.05);
    }
  }
  return filtered.length ? filtered : plausibleFloorSamples(samples);
}

/** True when enough trustworthy samples exist to lock floor Y. */
export function canLockFloorScan(
  surfaceSamples: number[],
  viewerOriginY?: number | null,
  cameraRaySamples: number[] = [],
  bootstrapSamples: number[] = []
): boolean {
  const bootFiltered = filterFloorScanSamples(bootstrapSamples, viewerOriginY);
  if (bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
    const bootSorted = [...bootFiltered].sort((a, b) => a - b);
    const bootSpread = bootSorted[bootSorted.length - 1]! - bootSorted[0]!;
    if (bootSpread <= FLOOR_Y_TIGHT_CLUSTER_SPREAD_M) return true;
  }

  const camFiltered = filterFloorScanSamples(cameraRaySamples, viewerOriginY);
  if (camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES) {
    const camSorted = [...camFiltered].sort((a, b) => a - b);
    const camSpread = camSorted[camSorted.length - 1]! - camSorted[0]!;
    if (camSpread <= 0.08) return true;
  }

  const surfFiltered = filterFloorScanSamples(surfaceSamples, viewerOriginY);
  const combined = filterFloorScanSamples(
    [...surfaceSamples, ...cameraRaySamples],
    viewerOriginY
  );

  if (combined.length < FLOOR_Y_SCAN_MIN_SAMPLES) return false;

  const sorted = [...combined].sort((a, b) => a - b);
  const spread = sorted[sorted.length - 1]! - sorted[0]!;
  if (spread > FLOOR_Y_ELEVATED_SURFACE_M) return true;

  if (camFiltered.length >= 1 && surfFiltered.length >= 1) {
    const camY = median(camFiltered) ?? camFiltered[0]!;
    const surfY = median(surfFiltered) ?? surfFiltered[0]!;
    if (surfY - camY > FLOOR_Y_ELEVATED_SURFACE_M) {
      return camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES;
    }
  }

  if (
    surfFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES &&
    camFiltered.length < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES
  ) {
    const surfSorted = [...surfFiltered].sort((a, b) => a - b);
    const surfSpread = surfSorted[surfSorted.length - 1]! - surfSorted[0]!;
    if (surfSpread <= 0.06 && surfSorted[0]! > FLOOR_Y_ELEVATED_SURFACE_M) {
      return surfFiltered.length >= FLOOR_Y_LOCK_MIN_SAMPLES;
    }
  }

  return true;
}

/**
 * Reject weak scan locks — sparse/noisy surface samples or lock far from median/bootstrap
 * (session 1780802201120 AR #3 locked at 0.31m with only 3 valid samples).
 */
export function isTrustworthyScanLock(
  lockedY: number,
  viewerOriginY: number | null | undefined,
  surfaceSamples: number[]
): boolean {
  if (!isPlausibleLockedFloorY(lockedY, viewerOriginY)) return false;
  const surf = filterFloorScanSamples(surfaceSamples, viewerOriginY);
  const boot = bootstrapFloorYFromViewer(viewerOriginY);

  if (surf.length >= FLOOR_Y_LOCK_MIN_SAMPLES) {
    const med = median(surf);
    if (med != null && Math.abs(lockedY - med) > FLOOR_LOCK_MAX_MEDIAN_DIVERGE_M) {
      return false;
    }
    return true;
  }

  if (surf.length > 0) {
    const sorted = [...surf].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1]! - sorted[0]!;
    if (spread > FLOOR_Y_TIGHT_CLUSTER_SPREAD_M) return false;
  }

  if (boot != null && Math.abs(lockedY - boot) > FLOOR_LOCK_MAX_MEDIAN_DIVERGE_M) {
    return false;
  }

  return true;
}

export type FloorYResolveResult = {
  y: number;
  rawY: number;
  lockedFloorY: number | null;
  /** True when placement uses locked height instead of raw hit-test Y. */
  usedLock: boolean;
  /** True when live hit-test overrode the session floor lock. */
  usedLocalOverride?: boolean;
};

export class FloorYStabilizer {
  private scanSamples: ScanSample[] = [];
  private lockedY: number | null = null;
  private localOverrideYs: number[] = [];
  usedLockCount = 0;
  localOverrideCount = 0;

  addScanSample(
    y: number,
    viewerOriginY?: number | null,
    options?: {
      source?: FloorScanSampleSource;
      /** Bypass elevated-surface rejection (skip-floor fallback). */
      force?: boolean;
    }
  ): void {
    const source = options?.source ?? "surface";
    if (!options?.force) {
      const existingY =
        source === "surface"
          ? this.scanSamples
              .filter((s) => s.source === "surface")
              .map((s) => s.y)
          : this.scanSamples.map((s) => s.y);
      if (existingY.length) {
        const minY = Math.min(...existingY);
        if (y > minY + FLOOR_Y_ELEVATED_SURFACE_M) return;
      }
    }
    const filtered = filterFloorScanSamples([y], viewerOriginY);
    if (!filtered.length && !options?.force) return;
    this.scanSamples.push({ y, source });
    if (this.scanSamples.length > 60) this.scanSamples.shift();
  }

  surfaceSampleYs(): number[] {
    return this.scanSamples
      .filter((s) => s.source === "surface")
      .map((s) => s.y);
  }

  cameraRaySampleYs(): number[] {
    return this.scanSamples
      .filter((s) => s.source === "camera-ray")
      .map((s) => s.y);
  }

  bootstrapSampleYs(): number[] {
    return this.scanSamples
      .filter((s) => s.source === "bootstrap")
      .map((s) => s.y);
  }

  validSampleCount(viewerOriginY?: number | null): number {
    return filterFloorScanSamples(this.allSampleYs(), viewerOriginY).length;
  }

  sampleCount(): number {
    return this.scanSamples.length;
  }

  canLockScan(viewerOriginY?: number | null): boolean {
    return canLockFloorScan(
      this.surfaceSampleYs(),
      viewerOriginY,
      this.cameraRaySampleYs(),
      this.bootstrapSampleYs()
    );
  }

  /**
   * Scan may auto-complete when we have real hit-test/plane samples, camera-ray
   * confirmation, or a tight bootstrap cluster (horizontal phone — no fake surface).
   */
  canCompleteScan(viewerOriginY?: number | null): boolean {
    const surf = this.surfaceSampleYs().length;
    const cam = this.cameraRaySampleYs().length;
    const boot = this.bootstrapSampleYs().length;
    const hasEvidence =
      surf >= 1 ||
      cam >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES ||
      boot >= FLOOR_Y_SCAN_MIN_SAMPLES;
    if (!hasEvidence) return false;
    const bootstrapOnly =
      surf === 0 && cam < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES && boot >= FLOOR_Y_SCAN_MIN_SAMPLES;
    if (
      bootstrapOnly &&
      (viewerOriginY == null ||
        viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M)
    ) {
      return false;
    }
    return (
      this.canLockScan(viewerOriginY) &&
      this.validSampleCount(viewerOriginY) >= FLOOR_Y_SCAN_MIN_SAMPLES
    );
  }

  lockedFromBootstrapOnly(): boolean {
    return (
      this.bootstrapSampleYs().length > 0 &&
      this.surfaceSampleYs().length === 0 &&
      this.lockedY != null
    );
  }

  /** True when scan would complete using bootstrap samples only (no surface/camera-ray yet). */
  wouldBootstrapOnlyComplete(viewerOriginY?: number | null): boolean {
    const surf = this.surfaceSampleYs().length;
    const cam = this.cameraRaySampleYs().length;
    const boot = this.bootstrapSampleYs().length;
    if (surf >= 1 || cam >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES) return false;
    if (boot < FLOOR_Y_SCAN_MIN_SAMPLES) return false;
    if (
      viewerOriginY == null ||
      viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
    ) {
      return false;
    }
    return this.canLockScan(viewerOriginY);
  }

  private allSampleYs(): number[] {
    return this.scanSamples.map((s) => s.y);
  }

  /**
   * Promote a stale bootstrap lock to the surface median when hit-test consistently
   * reports a higher trustworthy floor (session 1780742724312).
   */
  relockFromSurfaceMedian(viewerOriginY?: number | null): number | null {
    const surfFiltered = filterFloorScanSamples(
      this.surfaceSampleYs(),
      viewerOriginY
    );
    if (surfFiltered.length < 2) return null;
    const surfMed = median(surfFiltered);
    if (surfMed == null || !isPlausibleLockedFloorY(surfMed, viewerOriginY)) {
      return null;
    }
    const locked = this.lockedY;
    if (locked == null) return null;
    const bootFiltered = filterFloorScanSamples(
      this.bootstrapSampleYs(),
      viewerOriginY
    );
    const bootMed = bootFiltered.length
      ? (median(bootFiltered) ?? bootFiltered[0]!)
      : locked;
    const bootstrapStale =
      bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES &&
      surfMed - bootMed >= FLOOR_SURFACE_OVER_BOOTSTRAP_M;
    if (
      !bootstrapStale &&
      isPlausibleLockedFloorY(locked, viewerOriginY) &&
      Math.abs(surfMed - locked) < FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
    ) {
      return null;
    }
    if (
      !bootstrapStale &&
      isPlausibleLockedFloorY(locked, viewerOriginY) &&
      Math.abs(surfMed - locked) < FLOOR_RING_LOCAL_OVERRIDE_MIN_M
    ) {
      return null;
    }
    this.lockedY = surfMed;
    return surfMed;
  }

  recordLocalOverride(rawY: number): void {
    if (!Number.isFinite(rawY)) return;
    this.localOverrideYs.push(rawY);
    if (this.localOverrideYs.length > 40) {
      this.localOverrideYs.shift();
    }
  }

  /** After many local overrides, align session lock to the override cluster median. */
  maybeRelockFromOverrideMedian(viewerOriginY?: number | null): number | null {
    if (this.localOverrideYs.length < FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES) {
      return null;
    }
    const filtered = filterFloorScanSamples(this.localOverrideYs, viewerOriginY);
    if (filtered.length < FLOOR_OVERRIDE_RELOCK_MIN_SAMPLES) return null;
    const med = median(filtered);
    if (med == null || this.lockedY == null) return null;
    if (Math.abs(med - this.lockedY) < FLOOR_RING_LOCAL_OVERRIDE_MIN_M) {
      return null;
    }
    if (!isPlausibleLockedFloorY(med, viewerOriginY)) return null;
    this.lockedY = med;
    this.localOverrideYs = [];
    return med;
  }

  /** Median or lower-quartile of filtered scan samples — fixed for the whole session after scan. */
  lockFromScan(
    viewerOriginY?: number | null,
    standingViewerOriginY?: number | null
  ): number | null {
    const camFiltered = filterFloorScanSamples(
      this.cameraRaySampleYs(),
      viewerOriginY
    );
    const surfFiltered = filterFloorScanSamples(
      this.surfaceSampleYs(),
      viewerOriginY
    );
    const bootFiltered = filterFloorScanSamples(
      this.bootstrapSampleYs(),
      viewerOriginY
    );
    let filtered = filterFloorScanSamples(this.allSampleYs(), viewerOriginY);

    if (surfFiltered.length >= 2 && bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
      const surfMed = median(surfFiltered);
      const bootMed = median(bootFiltered) ?? bootFiltered[0]!;
      if (
        surfMed != null &&
        surfMed - bootMed >= FLOOR_SURFACE_OVER_BOOTSTRAP_M
      ) {
        filtered = surfFiltered;
      }
    }

    if (
      camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES &&
      surfFiltered.length >= 1
    ) {
      const camY = median(camFiltered) ?? camFiltered[0]!;
      const surfY = median(surfFiltered) ?? surfFiltered[0]!;
      if (surfY - camY > FLOOR_Y_ELEVATED_SURFACE_M) {
        filtered = camFiltered;
      }
    }

    if (!filtered.length) return null;
    const sorted = [...filtered].sort((a, b) => a - b);
    const spread = sorted[sorted.length - 1]! - sorted[0]!;
    let locked =
      spread > FLOOR_Y_ELEVATED_SURFACE_M
        ? (lowerQuartile(filtered) ?? median(filtered) ?? null)
        : spread <= FLOOR_Y_TIGHT_CLUSTER_SPREAD_M
          ? (sorted[0] ?? null)
          : (median(filtered) ?? lowerQuartile(filtered) ?? null);
    if (locked != null && locked < FLOOR_Y_MIN_M) locked = null;
    const camOnly =
      camFiltered.length >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES &&
      surfFiltered.length === 0;
    if (locked != null && camOnly) {
      if (
        !isPlausibleLockedFloorY(
          locked,
          viewerOriginY,
          standingViewerOriginY
        )
      ) {
        locked = null;
      }
    } else if (
      locked != null &&
      !isPlausibleLockedFloorY(locked, viewerOriginY, standingViewerOriginY)
    ) {
      locked = null;
    }
    if (
      locked != null &&
      !isTrustworthyScanLock(locked, viewerOriginY, surfFiltered)
    ) {
      const surfMed = median(surfFiltered);
      if (
        surfMed != null &&
        isTrustworthyScanLock(surfMed, viewerOriginY, surfFiltered)
      ) {
        locked = surfMed;
      } else {
        const boot = bootstrapFloorYFromViewer(viewerOriginY);
        if (
          boot != null &&
          isTrustworthyScanLock(boot, viewerOriginY, surfFiltered)
        ) {
          locked = boot;
        } else {
          locked = null;
        }
      }
    }
    if (locked != null && surfFiltered.length === 0 && bootFiltered.length >= FLOOR_Y_SCAN_MIN_SAMPLES) {
      locked = correctBootstrapTableHeightLock(
        locked,
        viewerOriginY ?? locked,
        standingViewerOriginY,
        this.bootstrapSampleYs()
      );
    }
    if (locked != null) {
      this.lockedY = locked;
    }
    return this.lockedY;
  }

  /** Restore session lock from virtual floor backup (after failed relock). */
  setLockedFloorY(y: number): void {
    if (y >= FLOOR_Y_MIN_M) this.lockedY = y;
  }

  lockedFloorY(): number | null {
    return this.lockedY;
  }

  /**
   * After scan: ring and models use fixed locked floor Y (XZ still from hit-test).
   * Before scan: pass through raw hit Y and collect samples.
   */
  /**
   * When the session lock was captured while crouching, standing later makes it
   * implausible — promote bootstrap (or raw hit) into the lock for placement paths.
   */
  repairLockForViewer(
    viewerOriginY?: number | null,
    standingViewerOriginY?: number | null
  ): number | null {
    const locked = this.lockedY;
    if (locked == null || locked < FLOOR_Y_MIN_M) return null;
    if (isPlausibleLockedFloorY(locked, viewerOriginY, standingViewerOriginY)) {
      return locked;
    }
    if (
      viewerOriginY == null ||
      viewerOriginY < FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
    ) {
      return locked;
    }
    const boot = bootstrapFloorYFromViewer(viewerOriginY);
    if (
      boot != null &&
      isPlausibleLockedFloorY(boot, viewerOriginY, standingViewerOriginY)
    ) {
      this.lockedY = boot;
      return boot;
    }
    return locked;
  }

  resolveY(
    rawY: number,
    floorScanComplete: boolean,
    viewerOriginY?: number | null,
    standingViewerOriginY?: number | null,
    allowLocalOverride = true,
    freezeSessionLock = false
  ): FloorYResolveResult {
    const lockedFloorY = this.lockedY;
    if (
      floorScanComplete &&
      freezeSessionLock &&
      lockedFloorY != null &&
      lockedFloorY >= FLOOR_Y_MIN_M
    ) {
      const placementY = contactFloorY(lockedFloorY);
      if (placementY >= FLOOR_Y_MIN_M) {
        const usedLock = Math.abs(placementY - rawY) > 0.001;
        if (usedLock) this.usedLockCount += 1;
        return {
          y: placementY,
          rawY,
          lockedFloorY,
          usedLock,
          usedLocalOverride: false,
        };
      }
    }
    if (floorScanComplete && lockedFloorY != null && lockedFloorY >= FLOOR_Y_MIN_M) {
      if (
        !isPlausibleLockedFloorY(
          lockedFloorY,
          viewerOriginY,
          standingViewerOriginY
        ) &&
        viewerOriginY != null &&
        viewerOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ) {
        const boot = bootstrapFloorYFromViewer(viewerOriginY);
        if (
          boot != null &&
          isPlausibleLockedFloorY(boot, viewerOriginY, standingViewerOriginY)
        ) {
          // Post-placement freeze: never mutate session lock from crouch/stand repair
          // (session 1780825483568 shifted 0.424→0.32m after first placement).
          if (!allowLocalOverride) {
            const placementY = contactFloorY(lockedFloorY);
            if (placementY >= FLOOR_Y_MIN_M) {
              this.usedLockCount += 1;
              return {
                y: placementY,
                rawY,
                lockedFloorY,
                usedLock: true,
                usedLocalOverride: false,
              };
            }
          }
          this.lockedY = boot;
          return {
            y: contactFloorY(boot),
            rawY,
            lockedFloorY: boot,
            usedLock: true,
            usedLocalOverride: false,
          };
        }
      }
      const diverged = Math.abs(rawY - lockedFloorY) > FLOOR_LOCK_MAX_DIVERGE_M;
      const overrideWorthy =
        Math.abs(rawY - lockedFloorY) >= FLOOR_RING_LOCAL_OVERRIDE_MIN_M;
      if (
        allowLocalOverride &&
        diverged &&
        overrideWorthy &&
        isTrustworthyLocalFloorHit(
          rawY,
          lockedFloorY,
          viewerOriginY,
          standingViewerOriginY
        )
      ) {
        const localY = contactFloorY(rawY);
        if (localY >= FLOOR_Y_MIN_M) {
          this.localOverrideCount += 1;
          this.recordLocalOverride(rawY);
          return {
            y: localY,
            rawY,
            lockedFloorY,
            usedLock: false,
            usedLocalOverride: true,
          };
        }
      }
      const placementY = contactFloorY(lockedFloorY);
      if (placementY >= FLOOR_Y_MIN_M) {
        // Contact bias can make lock storage differ from raw while placement Y matches raw.
        const usedLock = Math.abs(placementY - rawY) > 0.001;
        if (usedLock) this.usedLockCount += 1;
        return {
          y: placementY,
          rawY,
          lockedFloorY,
          usedLock,
          usedLocalOverride: false,
        };
      }
    }
    if (Math.abs(rawY) <= FLOOR_Y_MAX_ABS_M) {
      this.addScanSample(rawY, viewerOriginY, { source: "surface" });
    }
    return { y: rawY, rawY, lockedFloorY, usedLock: false };
  }

  reset(): void {
    this.scanSamples = [];
    this.lockedY = null;
    this.localOverrideYs = [];
    this.usedLockCount = 0;
    this.localOverrideCount = 0;
  }
}
