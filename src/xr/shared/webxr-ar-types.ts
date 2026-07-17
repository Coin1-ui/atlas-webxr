import type { PbrMaterialDiagnostics } from "./ar-pbr-environment";
import type { depthDiagnosticsForLog } from "./depth-diagnostics";

export type FloorRayRejectReason =
  | "direction-not-down"
  | "distance-out-of-range"
  | "origin-at-floor-use-forward"
  | "origin-below-floor"
  | "no-horizontal-hit"
  | "no-xr-frame"
  | "no-reference-space"
  | "no-viewer-pose"
  | "tracking-not-ready"
  | "missing-frame"
  | "missing-pose"
  | "wall-or-steep"
  | "object-or-elevated";

export type PlacedDimensionHudState = {
  label: string;
  visible: boolean;
  dock?: boolean;
  fixed?: boolean;
  x: number;
  y: number;
};

/** Minimal picker item shape (iOS in-canvas GUI). */
export type GuiPickerItem = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export type PlacementObjectType = "arrow" | "pad" | "zone";

export type PlaceModelRealWorldScale = {
  scaleFactor?: number;
  widthM?: number;
  depthM?: number;
  heightM?: number;
};

export type PlaceModelOptions = {
  label: string;
  modelId?: string;
  modelUrl?: string | null;
  builtinType?: PlacementObjectType;
  realWorld?: PlaceModelRealWorldScale;
};

export type PlacementDiagnostics = {
  loadMethod: string;
  meshCount: number;
  transformNodeCount: number;
  topLevelRoots: number;
  position: { x: number; y: number; z: number };
  localPosition?: { x: number; y: number; z: number };
  boundsMin?: { x: number; y: number; z: number };
  boundsMax?: { x: number; y: number; z: number };
  geometryMin?: { x: number; y: number; z: number };
  geometryMax?: { x: number; y: number; z: number };
  snapContactY?: number;
  contactVertexMinY?: number;
  primaryMeshMinY?: number;
  floorContactSource?: string;
  bboxPaddingBelowMeshM?: number;
  sizeMeters?: { x: number; y: number; z: number };
  maxDimensionM?: number;
  arScaleFactor?: number;
  arScaleReason?: string;
  meshesVisible: number;
  pbrDiagnostics?: PbrMaterialDiagnostics;
  materialTypes?: string;
  modelUrl?: string;
  modelId?: string;
  fetchBytes?: number;
  hitTestFloorY?: number;
  rawHitTestFloorY?: number;
  lockedFloorY?: number | null;
  floorYUsedLocked?: boolean;
  floorYClamped?: boolean;
  floorSnapM?: number;
  shadowCasterCount?: number;
  shadowGroundPlaced?: boolean;
  sessionMedianFloorY?: number;
  blobShadowVisible?: boolean;
  reticleVisibleAtPlace?: boolean;
  poseAgeMs?: number;
  floorNormalY?: number;
  placementAnchorActive?: boolean;
};

export type PlaceModelResult = {
  ok: boolean;
  diagnostics: PlacementDiagnostics;
  error?: string;
};

export type FloorDetectionState = {
  ready: boolean;
  hitReady: boolean;
  reticleVisible: boolean;
  /** Cyan = empty floor (tap to place); red = blocked surface. */
  ringPlaceable: boolean;
  liveHit: boolean;
  graceActive: boolean;
  poseAgeMs: number;
  floorNormalY: number;
  ringSurfaceReject?: FloorRayRejectReason | null;
};

export type HitTestStats = {
  hitTestEnabled: boolean;
  hitTestAttached: boolean;
  framesWithResults: number;
  framesEmpty: number;
  cameraRayHits: number;
  planeHits: number;
  lastHitAtMs: number | null;
  floorReady: boolean;
  hitReady: boolean;
  reticleVisible: boolean;
  floorScanComplete: boolean;
  floorScanBootstrapOnly?: boolean;
  floorSkipped: boolean;
  hitTestMode: string;
  xrFramesProcessed: number;
  lastOriginY: number | null;
  lastForwardY: number | null;
  lastRayReject: FloorRayRejectReason | null;
  ringPoseSource: string;
  planeRingUpdatesSkipped: number;
  ringLargeJumps: number;
  ringRelocalizationRejects: number;
  /** Red ring — hit-test normal too vertical (wall). */
  ringWallRejects?: number;
  /** Red ring — hit above session floor (object/table). */
  ringObjectRejects?: number;
  /** Cyan restored after ARCore elevated-plane spike (wrong table plane). */
  ringElevatedRecoveries?: number;
  /** Cyan ring on empty floor — placement allowed. */
  ringPlaceable?: boolean;
  placementAnchorBindAttempts: number;
  placementAnchorBindSuccess: number;
  placementAnchorTrackingLosses?: number;
  placementAnchorJumpRejects?: number;
  placementAnchorFrozenOnLoss?: number;
  floorLockLocalOverrides?: number;
  floorHitBootstrapCount?: number;
  lockedFloorY: number | null;
  floorScanSamples: number;
  floorScanValidSamples?: number;
  floorYUsedLockCount?: number;
  placementAnchorUpdates?: number;
  placementRelocalResyncs?: number;
  sessionFloorRootUpdates?: number;
  sessionFloorRootJumpRejects?: number;
  sessionFloorRebindAttempts?: number;
  sessionFloorSoftDriftCorrections?: number;
  sessionFloorMaxAnchorDriftM?: number;
  slamJumpLargeCorrections?: number;
  slamJumpRemainderCorrections?: number;
  floorRelockPromotions?: number;
  referenceSpaceResets?: number;
  slamRelocalizationCorrections?: number;
  slamJumpVerticalSkips?: number;
  slamJumpVerticalCorrections?: number;
  slamJumpHorizontalSkips?: number;
  slamJumpStaleCatchupSkips?: number;
  virtualFloorPlaneY?: number | null;
  worldRepinCorrections?: number;
  placedWorldX?: number | null;
  placedWorldZ?: number | null;
  reticleFootprintM?: number;
  lastHitTestScale?: number | null;
  hitTestScaleAnomalies?: number;
  lastOriginX?: number | null;
  lastOriginZ?: number | null;
  cameraPathM?: number;
  cameraPathSinceLastStatsM?: number;
  cameraOriginYMin?: number | null;
  cameraOriginYMax?: number | null;
  cameraVerticalRangeM?: number | null;
  placedMaxDriftM?: number;
  placedLiveMaxDimensionM?: number | null;
  placedScaleCorrections?: number;
  lastRawHitTestFloorY?: number | null;
  cameraPathAtScanComplete?: number | null;
  pinnedDisplayFloorY?: number | null;
  scanBaselineViewerY?: number | null;
  latestPoseY?: number | null;
  ringWorldDistanceFromViewer?: number | null;
  ringVerticalDeltaFromViewer?: number | null;
  lastPlausibleViewerY?: number | null;
  lastRawOriginY?: number | null;
};

export type WebXRSession = {
  dispose: () => void;
  placeAtReticle: (label: string, objectType?: PlacementObjectType) => boolean;
  placeCustomModelAtReticle: (options: PlaceModelOptions) => Promise<PlaceModelResult>;
  warmupModels: (urls: string[]) => Promise<{ warmed: string[]; failed: { url: string; error: string }[] }>;
  getWarmupResult: () => { warmed: string[]; failed: { url: string; error: string }[] };
  cancelPlacement: () => void;
  clearPlacedObjects: () => void;
  isReticleVisible: () => boolean;
  getFloorDetectionState: () => FloorDetectionState;
  onFloorStateChange: (listener: (state: FloorDetectionState) => void) => () => void;
  getStatusText: () => string;
  whenHitTestReady: (timeoutMs?: number) => Promise<boolean>;
  waitForFloorReticle: (timeoutMs?: number) => Promise<{ ok: boolean; waitedMs: number }>;
  waitForFloorScanComplete: (options?: {
    minMs?: number;
    minSamples?: number;
    timeoutMs?: number;
  }) => Promise<{ ok: boolean; waitedMs: number; lockedFloorY: number | null }>;
  completeFloorScan: () => void;
  isFloorScanComplete: () => boolean;
  canCompleteFloorScan: () => boolean;
  getDiagnostics: () => {
    arPlatformProfile: "android-chrome" | "ios-webxr-viewer";
    immersiveEntered: boolean;
    hitTestEnabled: boolean;
    inFullscreen: boolean;
    domOverlayActive: boolean;
    environmentBlendMode: string;
    lightEstimation: boolean;
    depthOcclusion: boolean;
    depthUsage: string;
  } & ReturnType<typeof depthDiagnosticsForLog>;
  whenDepthProbeReady: (timeoutMs?: number) => Promise<import("./depth-diagnostics").DepthDiagnostics>;
  getHitTestStats: () => HitTestStats;
  skipFloorScan: () => void;
  bootstrapFloorScanFromViewer?: () => boolean;
  forceCompleteFloorScanAtTimeout?: () => boolean;
  probeFloorFromViewer: () => boolean;
  getPlacedDimensionHud: () => PlacedDimensionHudState | null;
  getDimensionOverlayVisible: () => boolean;
  setDimensionOverlayVisible: (visible: boolean) => void;
  getDimensionFxDiagnostics: () => {
    dimensionLabel: string;
    dimensionLinesBuilt: boolean;
    dimensionLinesVisible: boolean;
  } | null;
  hasPlacedContent: () => boolean;
  getObjectViewerMode: () => boolean;
  setObjectViewerMode: (enabled: boolean) => void;
  onImmersiveSessionEnd?: (listener: () => void) => () => void;
  setReticlePreviewFootprintM: (footprintM: number | null) => void;
  updateInCanvasPicker?: (options: {
    items: GuiPickerItem[];
    activeId: string | null;
    statusText: string;
    floorReady: boolean;
    floorScanComplete?: boolean;
  }) => void;
};
