import {
  Engine,
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  HemisphericLight,
  DirectionalLight,
  PBRMaterial,
  Color3,
  Color4,
  Material,
  WebXRDefaultExperience,
  WebXRHitTest,
  WebXRBackgroundRemover,
  WebXRLightEstimation,
  TransformNode,
  Quaternion,
  Matrix,
  AbstractMesh,
} from "@babylonjs/core";
import { WebXRPlaneDetector } from "@babylonjs/core/XR/features/WebXRPlaneDetector";
import {
  createEmptyDepthDiagnostics,
  depthDiagnosticsForLog,
  finalizeDepthDiagnostics,
  type DepthDiagnostics,
} from "../shared/depth-diagnostics";
import { FloorYStabilizer, FLOOR_Y_SCAN_MIN_SAMPLES, FLOOR_LOCK_MAX_DIVERGE_M, FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M, FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M, FLOOR_RELOCK_MAX_DELTA_M, FLOOR_BOOTSTRAP_RELOCK_MAX_DELTA_M, FLOOR_LOCK_MAX_BELOW_BOOTSTRAP_AT_SCAN_M, FLOOR_STANDING_VIEWER_Y_MAX_M, contactFloorY, FLOOR_Y_MIN_M, FLOOR_Y_MIN_VIEWER_FOR_FILTER_M, filterFloorScanSamples, sanitizeFloorHitY, bootstrapFloorYFromViewer, estimateDisplayFloorY, maybePinDisplayFloorY, resolveViewerYForScanLock, resolveViewerYForFloorRay, isSlamViewerVerticalGlitch, preferPinnedScanLockY, correctBootstrapCrouchLock, isPlausibleStandingViewerY, isPlausibleLockedFloorY, isTrustworthyLocalFloorHit, isTrustworthyScanLock } from "./floor-y-stabilizer";
import {
  MIN_FLOOR_NORMAL_Y,
  POSE_GRACE_MS,
  evaluateFloorReady,
  waitUntilFloorReady,
} from "./floor-detection";
import {
  classifyRingSurfaceHit,
  isCameraAimedAtFloor,
  shouldRecoverElevatedHitToLockedFloor,
} from "./floor-surface-filter";
import {
  intersectRayWithHorizontalFloor,
  projectViewerForwardToFloor,
  resolveViewerPoseFromFrame,
  viewerRayFromXrPose,
  type FloorRayRejectReason,
} from "./camera-floor-ray";
import {
  ensureArFallbackEnvironment,
  getArEnvironmentSource,
  markLightEstimationEnvironmentActive,
  collectMaterialsFromRoots,
  scanPbrMaterials,
  tunePbrMaterialForAR,
  type PbrMaterialDiagnostics,
} from "../shared/ar-pbr-environment";
import {
  horizontalQuaternion,
  quaternionYaw,
  shouldIgnoreRingJitter,
  shouldRejectRingRelocalizationJump,
  isPhoneTiltedTowardFloor,
  shouldShowProvisionalFloorRing,
  capScanRingXZStep,
  blendScanRingXZTowardHitTest,
  SCAN_PROVISIONAL_FORWARD_M,
  SCAN_HIT_TEST_BLEND_FRAMES,
  RING_JUMP_LOG_MIN_M,
  RING_RELOCALIZATION_FORCE_RESYNC_AFTER,
  RING_RELOCALIZATION_WALK_SINCE_SCAN_M,
  extractHitTestPose,
  reticleScaleForFootprint,
  RETICLE_DEFAULT_FOOTPRINT_M,
} from "./ring-pose";
import {
  applyPlacementAnchorBinding,
  createAnchorAtWorldPosition,
  finalizePlacementAnchorBinding,
  freezePlacedInWorld,
  unfreezePlacedForAnchor,
  repinWorldFrozenNode,
  resolveAnchorWorldPosition,
  syncWorldFrozenAnchorXZ,
  type PlacementAnchorBinding,
} from "./placement-anchor";
import {
  applyLockedPlacementAnchor,
  isPlausibleViewerOriginY,
} from "./placement-lock";
import { VirtualFloorPlane } from "./virtual-floor-plane";
import {
  attachPlacedToFloorRoot,
  bindSessionFloorAnchor,
  createSessionFloorAnchorState,
  syncSessionFloorBindingY,
  updateSessionFloorRootFromAnchor,
} from "./virtual-floor-lock";
import {
  attachArPlacementFx,
  AR_DIMENSION_OVERLAY_RENDERING_GROUP,
  buildDockedDimensionHud,
  resolveModelPlacementBounds,
  setupArOverlayRenderingGroups,
  type ArPlacementFxHandle,
  type PlacedDimensionHudState,
} from "./ar-placement-fx";
import { placePlacedRootAtWorldPose } from "./placed-root-pose";
import { applyReferenceSpaceResetToPose } from "./reference-space-reset";
import {
  applyHorizontalSlamJumpToWorldFrozen,
  applyHorizontalSlamJumpToSessionFloor,
  applyVerticalSlamJumpToSessionFloor,
  applySlamJumpRemainderStep,
  cappedCameraPathStep,
  shouldApplyHorizontalSlamJump,
  shouldApplyLargeHorizontalSlamJump,
  shouldApplyVerticalSlamJump,
  SLAM_JUMP_CORRECT_HORIZONTAL_M,
  SLAM_JUMP_LARGE_FIRST_SHIFT_M,
  SLAM_JUMP_MAX_HORIZONTAL_DELTA_M,
  SLAM_JUMP_MAX_VERTICAL_DELTA_M,
  SLAM_JUMP_CONFIRM_FRAMES,
} from "./slam-jump-correction";
import {
  bindGlbCacheScene,
  parseGlbsSequential,
  getOfflineParseResult,
  placeGlbFromSceneCache,
  ensureGlbReadyForPlacement,
  ensureArContainer,
  collectGeometryMeshes,
  geometryWorldBounds,
  floorContactDiagnostics,
  placementFloorContactY,
  snapPlacementBaseToFloor,
} from "../shared/glb-offline-cache";
import { resolveAndApplyRealWorldScale } from "../shared/model-real-world-scale";

import type {
  WebXRSession,
  PlaceModelOptions,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "../shared/webxr-ar-types";
export type {
  WebXRSession,
  PlaceModelOptions,
  PlaceModelResult,
  PlacementObjectType,
  PlacementDiagnostics,
  FloorDetectionState,
  HitTestStats,
} from "../shared/webxr-ar-types";

type PlacedEntry = {
  root: TransformNode;
  meshes: AbstractMesh[];
  /** Catalog scale applied at placement (preserved by enforceSessionPlacedScale). */
  arScaleFactor?: number;
  arScaleVector?: { x: number; y: number; z: number };
  /** Max W/D/H frozen at placement — live metrics must not shrink from bbox drift. */
  frozenMaxDimensionM?: number;
  /** True after first anchor sync — hold pose until SLAM relocalization. */
  placementPoseLocked?: boolean;
  anchorBinding?: PlacementAnchorBinding | null;
  /** True after world freeze — pinned world pose is enforced every XR frame. */
  worldFrozen?: boolean;
  pinnedWorldPosition?: Vector3;
  pinnedWorldRotation?: Quaternion;
  /** Last stable anchor-driven world pose (jitter filter + loss fallback). */
  lastAnchorPosition?: Vector3;
  lastAnchorRotation?: Quaternion;
  anchorMissStreak?: number;
  /** World position right after placement (for drift diagnostics). */
  placedAtWorldPosition?: Vector3;
  /** Immutable placement origin — drift metrics never reset on anchor resync. */
  placedAnchorOrigin?: Vector3;
  /** Parented under placementRoot with fixed local transform (session floor lock). */
  sessionFloorAttached?: boolean;
  /** Contact shadow + W/D/H dimension lines (SwiftXR-style). */
  placementFx?: ArPlacementFxHandle | null;
};

type PendingAnchorBind = {
  entry: PlacedEntry;
  hit?: XRHitTestResult | null;
  worldPosition: Vector3;
  worldYaw: number;
};

const FLOOR_SCAN_RENDERING_GROUP = 2;
const PLACED_CONTENT_RENDERING_GROUP = 0;
const PLANE_UPDATE_MIN_MS = 80;
const PLANE_UPDATE_MIN_MS_AFTER_SCAN = 120;
const PLANE_POSE_MIN_DELTA_M = 0.03;
const PLANE_POSE_MIN_DELTA_M_AFTER_SCAN = 0.08;
/** Allow plane ring updates during scan when hit-test has been empty this long. */
const ANDROID_STRICT_FLOOR_READY = true;
const ANDROID_REJECT_RELOCALIZATION = true;
const ANDROID_BLOCK_CAMERA_RAY_AFTER_SCAN = true;
/** Pin with XR anchor after placement — world-freeze breaks SLAM tracking when the camera moves. */
const ANDROID_FREEZE_WORLD_ON_PLACEMENT = false;
const ANDROID_USE_PLACEMENT_ANCHORS = true;
/** Keep XR anchor alive; lock pose after first sync, resync only on SLAM relocalization. */
const ANDROID_PLACEMENT_ANCHOR_LOCK = true;
/** One session floor anchor drives placementRoot; models use fixed local offsets. */
const ANDROID_VIRTUAL_FLOOR_LOCK = true;
/** After anchor bind, world-freeze model — disabled with virtual floor lock (anchor must stay alive). */
const ANDROID_PLACEMENT_WORLD_FREEZE_AFTER_BIND = false;
/** Require this many hit-test frames before scan can complete (blocks bootstrap-only ring scan). */
const ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN = 8;
/** Require camera pitched toward floor before scan counts as hit-ready (forward.y negative = down). */
const MIN_FORWARD_Y_FOR_SCAN_HIT_READY = -0.2;
/** Keep estimated ring for this many hit-test frames before switching ring pose (reduces handoff jump). */
const ANDROID_MIN_HIT_FRAMES_FOR_SCAN_RING = 3;
/** Lower SLAM jump threshold once user has walked this far from first placement (meters). */
const WALK_ADAPTIVE_SLAM_JUMP_M = 3;
const WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M = 0.32;
/** @deprecated — use ANDROID_PLACEMENT_ANCHOR_LOCK (world freeze drifts on relocalization). */
const ANDROID_ANCHOR_SINGLE_SHOT = false;
/** Ring Y ignores hit-test micro-changes smaller than this after scan (meters). */
const RING_FLOOR_Y_SMOOTH_M = 0.04;
/** Keep ring following hit-test after placement so the next model can be aimed. */
const ANDROID_FREEZE_RING_AFTER_PLACEMENT = false;
const ANCHOR_MIN_UPDATE_DELTA_M = 0.02;
/** Reject single-frame anchor pops from SLAM relocalization (meters). */
const ANCHOR_MAX_SINGLE_FRAME_JUMP_M = 0.1;
/** Consecutive anchor tracking misses before world-freezing the placement. */
const ANCHOR_TRACKING_LOSS_FREEZE_FRAMES = 12;

/** Android-only perf tuning — iOS uses webxr-ar-ios-session.ts (unchanged). */
const ANDROID_RETICLE_TORUS_TESSELATION = 24;
const ANDROID_RETICLE_DISC_TESSELATION = 32;
const ANDROID_DRIFT_METRICS_EVERY_N_FRAMES = 6;
const ANDROID_DIMENSION_HUD_MIN_INTERVAL_MS = 250;
const ANDROID_FLOOR_RELOCK_MIN_INTERVAL_MS = 500;

/** Android Chrome only — do not edit for iOS; use webxr-ar-ios-session.ts */
export async function startAndroidWebXRSession(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  _options?: { warmupUrls?: string[] }
): Promise<WebXRSession | null> {
  void _options?.warmupUrls;
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    },
    true
  );
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = new Color3(0.28, 0.28, 0.3);
  ensureArFallbackEnvironment(scene);
  setupArOverlayRenderingGroups(scene);
  bindGlbCacheScene(scene, { isolatedParse: true });

  const hemi = new HemisphericLight("ar-hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.42;
  hemi.groundColor = new Color3(0.18, 0.18, 0.2);
  hemi.diffuse = new Color3(1, 1, 1);

  const sun = new DirectionalLight("ar-sun", new Vector3(-0.35, -1, -0.25), scene);
  sun.intensity = 0.88;
  sun.position = new Vector3(2, 4, 1);
  scene.shadowsEnabled = false;

  let lightEstimationActive = false;
  const depthDiagnostics = createEmptyDepthDiagnostics({
    depthRequested: false,
    depthProbeComplete: true,
    depthBlockedReason: "disabled",
  });
  let environmentBlendMode = "unknown";

  let xrExperience: WebXRDefaultExperience | null = null;
  try {
    xrExperience = await scene.createDefaultXRExperienceAsync({
      uiOptions: {
        sessionMode: "immersive-ar",
        referenceSpaceType: "local-floor",
      },
      optionalFeatures: true,
      disableTeleportation: true,
      disablePointerSelection: true,
      disableDefaultUI: true,
    });
  } catch (e) {
    engine.dispose();
    onStatus(`WebXR unavailable: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }

  const base = xrExperience?.baseExperience;
  if (!base) {
    engine.dispose();
    return null;
  }

  onStatus("Entering AR camera…");
  let immersiveEntered = false;
  let domOverlayActive = false;

  const buildSessionInit = (domOverlay: boolean): XRSessionInit => {
    const init: XRSessionInit = {
      optionalFeatures: (() => {
        const features = ["hit-test", "anchors", "plane-detection", "light-estimation"];
        if (domOverlay) features.push("dom-overlay");
        return features;
      })(),
    };
    if (domOverlay && domOverlayRoot) {
      init.domOverlay = { root: domOverlayRoot };
      domOverlayRoot.classList.remove("hidden");
    }
    return init;
  };

  const enterImmersiveAr = async (domOverlay: boolean) => {
    await base.enterXRAsync(
      "immersive-ar",
      "local-floor",
      undefined,
      buildSessionInit(domOverlay)
    );
  };

  const buildDepthDiagnosticsSnapshot = (): DepthDiagnostics =>
    finalizeDepthDiagnostics({ ...depthDiagnostics });

  try {
    await enterImmersiveAr(!!domOverlayRoot);
    immersiveEntered = true;
    domOverlayActive = !!domOverlayRoot;
  } catch (e) {
    const err = String(e);
    if (domOverlayRoot && err.includes("dom-overlay")) {
      onStatus("Retrying AR without overlay…");
      try {
        await enterImmersiveAr(false);
        immersiveEntered = true;
        domOverlayActive = false;
      } catch (e2) {
        engine.dispose();
        onStatus(
          `Could not start AR: ${e2 instanceof Error ? e2.message : "unknown"}`
        );
        return null;
      }
    } else {
      engine.dispose();
      onStatus(
        `Could not start AR session: ${e instanceof Error ? e.message : "unknown"}. Tap again or use Chrome.`
      );
      return null;
    }
  }

  engine.resize();

  scene.autoClear = false;
  scene.autoClearDepthAndStencil = false;

  environmentBlendMode =
    base.sessionManager.session?.environmentBlendMode ?? "unknown";

  const immersiveSessionEndListeners = new Set<() => void>();
  base.sessionManager.session?.addEventListener("end", () => {
    for (const listener of immersiveSessionEndListeners) {
      listener();
    }
  });

  try {
    base.featuresManager.enableFeature(WebXRBackgroundRemover, "latest");
  } catch {
    /* passthrough may still work on some devices */
  }

  {
    try {
      const lightEst = base.featuresManager.enableFeature(
        WebXRLightEstimation,
        "latest",
        {
          createDirectionalLightSource: false,
          setSceneEnvironmentTexture: true,
          directionalLightIntensityFactor: 1.2,
        }
      ) as WebXRLightEstimation;
      lightEst.directionalLight = sun;
      lightEstimationActive = true;
    } catch {
      lightEstimationActive = false;
    }
  }

  if (lightEstimationActive && scene.environmentTexture) {
    markLightEstimationEnvironmentActive();
  }

  if (lightEstimationActive) {
    hemi.intensity = 0.38;
    sun.intensity = 0.92;
    scene.ambientColor = new Color3(0.32, 0.32, 0.34);
  }

  const placementRoot = new TransformNode("placements", scene);
  const placed: PlacedEntry[] = [];
  let markerCount = 0;
  let placeGeneration = 0;
  let floorScanComplete = false;
  let floorScanLockedFromBootstrapOnly = false;
  let scanCompleteViewerY: number | null = null;
  let lastPlausibleViewerY: number | null = null;
  let scanBaselineViewerY: number | null = null;
  let pinnedDisplayFloorY: number | null = null;
  let statusText =
    "AR camera active. Point at the floor and move slowly until the cyan marker appears.";

  const reticle = MeshBuilder.CreateTorus(
    "reticle",
    { diameter: 0.32, thickness: 0.022, tessellation: ANDROID_RETICLE_TORUS_TESSELATION },
    scene
  );
  reticle.isVisible = false;
  reticle.isPickable = false;
  reticle.renderingGroupId = FLOOR_SCAN_RENDERING_GROUP;
  const reticleMat = new StandardMaterial("reticleMat", scene);
  reticleMat.emissiveColor = new Color3(0.15, 0.95, 1);
  reticleMat.alpha = 0.9;
  reticleMat.disableLighting = true;
  reticle.material = reticleMat;

  /** Semi-transparent disc — main floor-detection visual in the camera view. */
  const floorDisc = MeshBuilder.CreateDisc(
    "floorDisc",
    { radius: 0.38, tessellation: ANDROID_RETICLE_DISC_TESSELATION, sideOrientation: 2 },
    scene
  );
  floorDisc.isVisible = false;
  floorDisc.isPickable = false;
  floorDisc.renderingGroupId = FLOOR_SCAN_RENDERING_GROUP;
  const floorDiscMat = new StandardMaterial("floorDiscMat", scene);
  floorDiscMat.emissiveColor = new Color3(0.1, 0.85, 0.95);
  floorDiscMat.diffuseColor = new Color3(0.05, 0.55, 0.65);
  floorDiscMat.alpha = 0.38;
  floorDiscMat.disableLighting = true;
  floorDiscMat.backFaceCulling = false;
  floorDisc.material = floorDiscMat;

  const floorDot = MeshBuilder.CreateSphere(
    "floorDot",
    { diameter: 0.04, segments: 12 },
    scene
  );
  floorDot.isVisible = false;
  floorDot.isPickable = false;
  floorDot.renderingGroupId = FLOOR_SCAN_RENDERING_GROUP;
  const floorDotMat = new StandardMaterial("floorDotMat", scene);
  floorDotMat.emissiveColor = new Color3(0.2, 1, 0.85);
  floorDotMat.disableLighting = true;
  floorDot.material = floorDotMat;

  const latestPose = {
    position: new Vector3(),
    rotation: new Quaternion(),
    valid: false,
  };
  let lastValidHitAt = 0;
  let liveHit = false;
  let floorNormalY = 0;
  let floorScanSkipped = false;
  let hitTestAttached = false;
  let hitTestMode = "viewer-default";
  let hitFramesWithResults = 0;
  let hitFramesEmpty = 0;
  let cameraRayHits = 0;
  let planeHits = 0;
  let xrFramesProcessed = 0;
  let lastOriginY: number | null = null;
  let lastRawOriginY: number | null = null;
  let slamGlitchHideStreak = 0;
  let lastOriginX: number | null = null;
  let lastOriginZ: number | null = null;
  let lastForwardY: number | null = null;
  let cameraOriginYMin: number | null = null;
  let cameraOriginYMax: number | null = null;
  let cameraPathM = 0;
  let cameraPathSinceLastStatsM = 0;
  let cameraPathAtScanComplete: number | null = null;
  let cameraPathAtFirstPlacement: number | null = null;
  let lastRawHitTestFloorY: number | null = null;
  let placedMaxDriftM = 0;
  let placedLiveMaxDimensionM: number | null = null;
  let placedScaleCorrections = 0;
  let lastRayReject: FloorRayRejectReason | null = null;
  let ringPoseSource = "none";
  let planeRingUpdatesSkipped = 0;
  let ringLargeJumps = 0;
  let scanHitTestBlendFramesRemaining = 0;
  let pendingSessionFloorResync = false;
  let pendingSessionFloorResyncFrames = 0;
  let ringRelocalizationRejects = 0;
  let ringWallRejects = 0;
  let ringObjectRejects = 0;
  let ringElevatedRecoveries = 0;
  let ringPlaceable = true;
  let ringSurfaceReject: FloorRayRejectReason | null = null;
  let lastTrustedPlaceableRawY: number | null = null;
  let lastTrustedPlaceableAt = 0;
  let lastConfirmedPlacementFloorY: number | null = null;
  let lastConfirmedPlacementAt = 0;
  let elevatedRejectStreakStart: number | null = null;
  const RING_COLOR_PLACEABLE = new Color3(0.15, 0.95, 1);
  const RING_COLOR_BLOCKED = new Color3(1, 0.22, 0.12);
  const RING_DISC_COLOR_PLACEABLE = new Color3(0.1, 0.85, 0.95);
  const RING_DISC_COLOR_BLOCKED = new Color3(0.95, 0.12, 0.1);
  let placementRelocalResyncs = 0;
  let viewerRelocalJumpM = 0;
  let viewerHorizontalRelocalJumpM = 0;
  let ringRelocalizationStreak = 0;
  let hitTestScaleAnomalies = 0;
  let lastHitTestScale: number | null = null;
  let lastXrHitResult: XRHitTestResult | null = null;
  let placementAnchorUpdates = 0;
  let placementAnchorBindAttempts = 0;
  let placementAnchorBindSuccess = 0;
  let placementAnchorTrackingLosses = 0;
  let placementAnchorJumpRejects = 0;
  let placementAnchorFrozenOnLoss = 0;
  let floorHitBootstrapCount = 0;
  let worldRepinCorrections = 0;
  let sessionFloorRootUpdates = 0;
  let sessionFloorRootJumpRejects = 0;
  let floorRelockPromotions = 0;
  let referenceSpaceResets = 0;
  let slamRelocalizationCorrections = 0;
  let slamJumpVerticalSkips = 0;
  let slamJumpHorizontalSkips = 0;
  let slamJumpStaleCatchupSkips = 0;
  let slamJumpVerticalCorrections = 0;
  let slamJumpEligibleStreak = 0;
  let slamJumpVerticalEligibleStreak = 0;
  let lastFrameOriginUpdated = true;
  let sessionFloorLockFrozen = false;
  let lastReferenceSpaceResetAt = 0;
  const SLAM_JUMP_DEBOUNCE_MS = 150;
  const sessionFloorAnchor = createSessionFloorAnchorState();
  const pendingAnchorBinds: PendingAnchorBind[] = [];
  const pendingAnchorFinalizes: {
    entry: PlacedEntry;
    anchor: XRAnchor;
    worldPosition: Vector3;
    worldYaw: number;
  }[] = [];
  let sessionAnchorLossStreak = 0;
  let pendingSessionFloorRebind = false;
  let sessionFloorRebindAttempts = 0;
  let sessionFloorSoftDriftCorrections = 0;
  let sessionFloorMaxAnchorDriftM = 0;
  let slamJumpLargeCorrections = 0;
  let slamJumpRemainderCorrections = 0;
  const pendingSlamFloorRemainder = { x: 0, z: 0 };
  const pendingSessionFloorFinalizes: {
    anchor: XRAnchor;
    worldPosition: Vector3;
    worldYaw: number;
  }[] = [];
  let dimensionHudState: PlacedDimensionHudState | null = null;
  let dimensionOverlayVisible = false;
  let objectViewerMode = false;
  let lastDimensionHudUpdateAt = 0;
  let driftMetricsFrameCounter = 0;
  let lastFloorRelockAt = 0;
  let pendingFloorStateEmit = false;
  let planeDetectorRef: WebXRPlaneDetector | null = null;
  let reticlePreviewFootprintM = RETICLE_DEFAULT_FOOTPRINT_M;
  const xrSessionStartAt = performance.now();
  const floorYStabilizer = new FloorYStabilizer();
  const virtualFloorPlane = new VirtualFloorPlane();
  const attachPlacementFx = (entry: PlacedEntry): ArPlacementFxHandle | null => {
    entry.placementFx?.dispose();
    const fx = attachArPlacementFx(
      entry.root,
      scene,
      PLACED_CONTENT_RENDERING_GROUP,
      entry.meshes,
      AR_DIMENSION_OVERLAY_RENDERING_GROUP,
    );
    entry.placementFx = fx;
    if (fx) {
      fx.setDimensionLinesVisible(dimensionOverlayVisible);
      const { widthM, depthM, heightM } = fx.dimensions;
      entry.frozenMaxDimensionM = Math.max(widthM, depthM, heightM);
      if (dimensionOverlayVisible) updateDimensionHud();
    }
    return fx;
  };

  const pinFrozenMaxDimension = (entry: PlacedEntry, maxDimensionM: number) => {
    if (!Number.isFinite(maxDimensionM) || maxDimensionM <= 0) return;
    entry.frozenMaxDimensionM = maxDimensionM;
  };

  const ensurePlacementFx = (entry: PlacedEntry): ArPlacementFxHandle | null => {
    entry.root.computeWorldMatrix(true);
    for (const m of entry.meshes) {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo(true, false);
    }
    const tryAttach = (): ArPlacementFxHandle | null => attachPlacementFx(entry);
    const fx = tryAttach();
    if (fx) return fx;
    let attempts = 0;
    const retry = () => {
      if (!placed.includes(entry)) return;
      attempts += 1;
      entry.root.computeWorldMatrix(true);
      for (const m of entry.meshes) {
        m.computeWorldMatrix(true);
        m.refreshBoundingInfo(true, false);
      }
      const lateFx = tryAttach();
      if (lateFx || attempts >= 5) return;
      requestAnimationFrame(retry);
    };
    requestAnimationFrame(retry);
    return null;
  };

  const updateDimensionHud = () => {
    if (placed.length === 0) {
      dimensionHudState = null;
      return;
    }
    if (!dimensionOverlayVisible) return;
    const now = performance.now();
    if (now - lastDimensionHudUpdateAt < ANDROID_DIMENSION_HUD_MIN_INTERVAL_MS) return;
    lastDimensionHudUpdateAt = now;
    const entry = placed[placed.length - 1]!;
    const label =
      entry.placementFx?.dimensionLabel ??
      (() => {
        const resolved = resolveModelPlacementBounds(entry.root, entry.meshes);
        if (!resolved) return "";
        const { bounds } = resolved;
        const w = bounds.max.x - bounds.min.x;
        const d = bounds.max.z - bounds.min.z;
        const h = bounds.max.y - bounds.min.y;
        return `W: ${w.toFixed(2)}m × D: ${d.toFixed(2)}m × H: ${h.toFixed(2)}m`;
      })();
    if (!label) {
      dimensionHudState = null;
      return;
    }
    dimensionHudState = {
      ...buildDockedDimensionHud(label),
      visible: dimensionOverlayVisible,
    };
  };

  const applyDimensionOverlayVisible = (visible: boolean) => {
    dimensionOverlayVisible = visible;
    lastDimensionHudUpdateAt = 0;
    for (const entry of placed) {
      entry.placementFx?.setDimensionLinesVisible(visible && !objectViewerMode);
    }
    updateDimensionHud();
  };

  const setPlacedContentVisible = (visible: boolean) => {
    for (const entry of placed) {
      entry.root.setEnabled(visible);
      for (const mesh of entry.meshes) {
        mesh.isVisible = visible;
      }
      entry.placementFx?.setDimensionLinesVisible(
        visible && dimensionOverlayVisible && !objectViewerMode
      );
    }
  };

  const applyObjectViewerMode = (enabled: boolean) => {
    if (objectViewerMode === enabled) return;
    objectViewerMode = enabled;
    if (enabled) {
      reticle.isVisible = false;
      floorDisc.isVisible = false;
      floorDot.isVisible = false;
      updateFloorVisuals(false);
      setPlacedContentVisible(false);
    } else {
      setPlacedContentVisible(true);
      if (floorScanComplete) {
        updateFloorVisuals(liveHit && latestPose.valid);
      }
    }
  };

  const placementFxDiagnostics = (entry: PlacedEntry) => {
    const fx = entry.placementFx?.getDiagnostics();
    return {
      shadowCasterCount: fx?.shadowCasterCount ?? 0,
      shadowGroundPlaced: fx?.shadowGroundPlaced ?? false,
      blobShadowVisible: fx?.blobShadowVisible ?? false,
      dimensionLabel: fx?.dimensionLabel ?? null,
      dimensionLinesBuilt: fx?.dimensionLinesBuilt ?? false,
      dimensionLinesVisible: fx?.dimensionLinesVisible ?? false,
    };
  };

  const floorStateListeners = new Set<(state: FloorDetectionState) => void>();
  let lastFloorStateKey = "";

  let hitTestEnabled = false;
  let hitTestReady = false;
  let hitTestReadyResolve: ((ok: boolean) => void) | null = null;
  const hitTestReadyPromise = new Promise<boolean>((resolve) => {
    hitTestReadyResolve = resolve;
  });

  const signalHitTestReady = (ok: boolean) => {
    if (hitTestReady) return;
    hitTestReady = true;
    hitTestEnabled = ok;
    hitTestReadyResolve?.(ok);
    hitTestReadyResolve = null;
  };

  const floorUp = new Vector3();

  const resolveSessionPlaneHeightM = (): number | null => {
    const locked = floorYStabilizer.lockedFloorY();
    if (locked != null) return contactFloorY(locked);
    return virtualFloorPlane.planeHeightM;
  };

  const preparePlacementRootForNewModel = () => {
    sessionFloorAnchor.binding = null;
    sessionFloorAnchor.lastRootPosition = null;
    sessionFloorAnchor.poseLocked = false;
    pendingSlamFloorRemainder.x = 0;
    pendingSlamFloorRemainder.z = 0;
    placementRoot.unfreezeWorldMatrix();
    placementRoot.parent = null;
    placementRoot.setAbsolutePosition(Vector3.Zero());
    placementRoot.rotationQuaternion = Quaternion.Identity();
    placementRoot.computeWorldMatrix(true);
  };

  const hasSurfaceScanEvidence = (): boolean =>
    hitFramesWithResults >= 1 || floorYStabilizer.surfaceSampleYs().length >= 1;

  const canCompleteFloorScanAndroid = (): boolean => {
    if (!floorYStabilizer.canCompleteScan(lastOriginY)) return false;
    if (!ANDROID_STRICT_FLOOR_READY) return true;
    if (hitFramesWithResults < ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN) {
      return false;
    }
    if (!floorYStabilizer.wouldBootstrapOnlyComplete(lastOriginY)) return true;
    return hasSurfaceScanEvidence();
  };

  const shouldUseBootstrapRingDuringScan = (): boolean =>
    shouldShowProvisionalFloorRing(
      lastForwardY,
      lastPlausibleViewerY ?? lastOriginY,
      hitFramesWithResults,
      floorScanComplete,
      floorScanSkipped,
      FLOOR_Y_MIN_VIEWER_FOR_FILTER_M,
      ANDROID_MIN_HIT_FRAMES_FOR_SCAN_RING
    );

  const scanFloorRayOptions = (): { forwardDistanceAtFloor: number } | Record<string, never> =>
    floorScanComplete ? {} : { forwardDistanceAtFloor: SCAN_PROVISIONAL_FORWARD_M };

  const appendScanSampleFromRingHit = (
    y: number,
    source: "hit-test" | "plane" | "camera-ray",
    bootstrapped = false
  ) => {
    const sanitized = sanitizeFloorHitY(y, lastOriginY);
    if (!sanitized) return;
    if (sanitized.bootstrapped) floorHitBootstrapCount += 1;
    floorYStabilizer.addScanSample(sanitized.y, resolvedViewerForSamples(), {
      source: bootstrapped
        ? "bootstrap"
        : source === "camera-ray"
          ? "camera-ray"
          : "surface",
    });
  };

  const resolveViewerYForFloorRayLocal = (originY: number): number | null =>
    resolveViewerYForFloorRay(
      originY,
      scanBaselineViewerY,
      lastPlausibleViewerY,
      scanCompleteViewerY
    );

  /** Filter SLAM viewer-Y spikes from ring classification and recovery heuristics. */
  const effectiveViewerYForRing = (): number | null => {
    const raw = lastOriginY ?? lastRawOriginY;
    if (raw == null) return lastPlausibleViewerY;
    return resolveViewerYForFloorRayLocal(raw) ?? lastPlausibleViewerY;
  };

  const resolveOriginYForFloorRay = (origin: Vector3): Vector3 => {
    const resolvedY = resolveViewerYForFloorRayLocal(origin.y);
    if (resolvedY == null || Math.abs(resolvedY - origin.y) < 0.001) {
      return origin;
    }
    return new Vector3(origin.x, resolvedY, origin.z);
  };

  const standingBaselineViewerY = (): number | null =>
    scanBaselineViewerY ?? lastPlausibleViewerY;

  const resolvedViewerForSamples = (): number | null =>
    resolveViewerYForScanLock(lastOriginY, standingBaselineViewerY()) ??
    standingBaselineViewerY() ??
    (lastOriginY != null &&
    lastOriginY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M
      ? lastOriginY
      : null);

  const isViewerSlamGlitch = (originY: number): boolean =>
    isSlamViewerVerticalGlitch(originY, standingBaselineViewerY());

  const needsProjectedRingAfterScan = (): boolean =>
    floorScanComplete &&
    !floorScanSkipped &&
    floorYStabilizer.lockedFloorY() != null &&
    (hitFramesWithResults < 1 || floorScanLockedFromBootstrapOnly);

  const stabilizerSampleYs = (): number[] => [
    ...floorYStabilizer.bootstrapSampleYs(),
    ...floorYStabilizer.cameraRaySampleYs(),
    ...floorYStabilizer.surfaceSampleYs(),
  ];

  const estimateFloorYForRingDisplay = (): number | null => {
    if (!floorScanComplete) {
      const prevPin = pinnedDisplayFloorY;
      pinnedDisplayFloorY = maybePinDisplayFloorY(
        pinnedDisplayFloorY,
        stabilizerSampleYs(),
        lastPlausibleViewerY ?? lastOriginY
      );
      if (prevPin == null && pinnedDisplayFloorY != null) {
        const baseline = lastPlausibleViewerY ?? lastOriginY;
        if (baseline != null && isPlausibleStandingViewerY(baseline)) {
          scanBaselineViewerY = baseline;
        }
      }
    }
    return estimateDisplayFloorY(
      floorYStabilizer.lockedFloorY(),
      floorScanComplete,
      stabilizerSampleYs(),
      lastPlausibleViewerY,
      lastOriginY,
      pinnedDisplayFloorY
    );
  };

  const handleReferenceSpaceReset = (event: XRReferenceSpaceEvent) => {
    const transform = event.transform;
    if (!transform) return;
    lastReferenceSpaceResetAt = performance.now();
    let corrected = false;
    for (const entry of placed) {
      if (!entry.worldFrozen || !entry.pinnedWorldPosition || !entry.pinnedWorldRotation) {
        continue;
      }
      const next = applyReferenceSpaceResetToPose(
        entry.pinnedWorldPosition,
        entry.pinnedWorldRotation,
        transform,
        scene.useRightHandedSystem
      );
      entry.pinnedWorldPosition = next.position;
      entry.pinnedWorldRotation = next.rotation;
      if (
        repinWorldFrozenNode(entry.root, next.position, next.rotation)
      ) {
        corrected = true;
        worldRepinCorrections += 1;
      }
      recordPlacementResync(entry);
    }
    if (sessionFloorAnchor.lastRootPosition) {
      const nextRoot = applyReferenceSpaceResetToPose(
        sessionFloorAnchor.lastRootPosition,
        Quaternion.Identity(),
        transform,
        scene.useRightHandedSystem
      );
      sessionFloorAnchor.lastRootPosition = nextRoot.position;
      placementRoot.unfreezeWorldMatrix();
      placementRoot.setAbsolutePosition(nextRoot.position);
      placementRoot.rotationQuaternion = Quaternion.Identity();
      placementRoot.computeWorldMatrix(true);
    }
    if (corrected) referenceSpaceResets += 1;
  };

  const attachReferenceSpaceResetHandler = () => {
    const attachToSpace = (space: XRReferenceSpace | null) => {
      if (!space) return;
      const resetHandler = (event: Event) => {
        handleReferenceSpaceReset(event as XRReferenceSpaceEvent);
      };
      if (typeof space.addEventListener === "function") {
        space.addEventListener("reset", resetHandler);
      } else {
        (space as XRReferenceSpace & { onreset?: (event: XRReferenceSpaceEvent) => void }).onreset =
          handleReferenceSpaceReset;
      }
    };
    attachToSpace(base.sessionManager.referenceSpace as XRReferenceSpace | null);
    attachToSpace(base.sessionManager.baseReferenceSpace as XRReferenceSpace | null);
  };

  const recordSlamFloorCorrection = () => {
    slamRelocalizationCorrections += 1;
    worldRepinCorrections += 1;
    pendingSessionFloorRebind = true;
    pendingSessionFloorResync = false;
    for (const entry of placed) {
      entry.root.computeWorldMatrix(true);
      const pos = entry.root.absolutePosition.clone();
      entry.placedAnchorOrigin = pos.clone();
      entry.placedAtWorldPosition = pos;
    }
  };

  const queueSlamFloorRemainder = (remainderX: number, remainderZ: number) => {
    if (Math.hypot(remainderX, remainderZ) < 0.001) return;
    pendingSlamFloorRemainder.x += remainderX;
    pendingSlamFloorRemainder.z += remainderZ;
  };

  const applyPendingSlamFloorRemainder = () => {
    const sessionFloorAttached =
      ANDROID_VIRTUAL_FLOOR_LOCK &&
      placed.length > 0 &&
      placed.every((entry) => entry.sessionFloorAttached);
    if (
      !sessionFloorAttached ||
      !sessionFloorAnchor.lastRootPosition ||
      Math.hypot(pendingSlamFloorRemainder.x, pendingSlamFloorRemainder.z) < 0.008
    ) {
      return;
    }
    if (
      applySlamJumpRemainderStep(
        sessionFloorAnchor,
        placementRoot,
        pendingSlamFloorRemainder
      )
    ) {
      slamJumpRemainderCorrections += 1;
      recordSlamFloorCorrection();
    }
  };

  const refreshViewerOrigin = (xrFrame?: XRFrame) => {
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    if (!frame) return;
    const viewerPose = resolveViewerPoseFromFrame(frame, {
      referenceSpace: base.sessionManager.referenceSpace,
      baseReferenceSpace: base.sessionManager.baseReferenceSpace,
      viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
    });
    if (viewerPose) {
      const px = viewerPose.transform.position.x;
      const py = viewerPose.transform.position.y;
      const pz = viewerPose.transform.position.z;
      const roundedY = Math.round(py * 1000) / 1000;
      lastRawOriginY = roundedY;
      const strictFloorViewerY =
        !floorScanComplete ||
        floorScanLockedFromBootstrapOnly ||
        hitFramesWithResults < 1;
      const viewerYPlausible =
        isPlausibleViewerOriginY(
          roundedY,
          floorYStabilizer.lockedFloorY(),
          strictFloorViewerY ? FLOOR_STANDING_VIEWER_Y_MAX_M : undefined
        ) &&
        (!strictFloorViewerY ||
          roundedY >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M) &&
        roundedY <= FLOOR_STANDING_VIEWER_Y_MAX_M;
      if (lastOriginX != null && lastOriginZ != null && lastOriginY != null) {
        const dx = px - lastOriginX;
        const dy = py - lastOriginY;
        const dz = pz - lastOriginZ;
        viewerHorizontalRelocalJumpM = Math.hypot(dx, dz);
        viewerRelocalJumpM = Math.hypot(dx, dy, dz);
        const yTrackingSuspended = !viewerYPlausible && lastOriginY != null;
        const effectiveDy = yTrackingSuspended ? 0 : dy;
        const willUpdateOriginY = viewerYPlausible;
        const staleCatchUp = willUpdateOriginY && !lastFrameOriginUpdated;
        const hasWorldFrozen = placed.some(
          (entry) => entry.worldFrozen && entry.pinnedWorldPosition
        );
        const walkedSincePlacement =
          cameraPathAtFirstPlacement != null
            ? cameraPathM - cameraPathAtFirstPlacement
            : 0;
        const slamJumpThreshold =
          placed.length > 0
            ? walkedSincePlacement >= WALK_ADAPTIVE_SLAM_JUMP_M
              ? WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
              : SLAM_JUMP_CORRECT_HORIZONTAL_M
            : walkedSincePlacement >= WALK_ADAPTIVE_SLAM_JUMP_M
              ? WALK_SLAM_JUMP_CORRECT_HORIZONTAL_M
              : SLAM_JUMP_CORRECT_HORIZONTAL_M;
        const sessionFloorAttached =
          ANDROID_VIRTUAL_FLOOR_LOCK &&
          placed.length > 0 &&
          placed.every((entry) => entry.sessionFloorAttached);
        const slamJumpEligible =
          !yTrackingSuspended &&
          willUpdateOriginY &&
          !staleCatchUp &&
          shouldApplyHorizontalSlamJump(
            viewerHorizontalRelocalJumpM,
            effectiveDy,
            slamJumpThreshold
          ) &&
          performance.now() - lastReferenceSpaceResetAt > SLAM_JUMP_DEBOUNCE_MS;
        const verticalSlamEligible =
          sessionFloorAttached &&
          !yTrackingSuspended &&
          willUpdateOriginY &&
          !staleCatchUp &&
          shouldApplyVerticalSlamJump(
            viewerHorizontalRelocalJumpM,
            dy,
            slamJumpThreshold
          ) &&
          performance.now() - lastReferenceSpaceResetAt > SLAM_JUMP_DEBOUNCE_MS;
        if (slamJumpEligible) {
          slamJumpEligibleStreak += 1;
        } else {
          slamJumpEligibleStreak = 0;
        }
        if (verticalSlamEligible) {
          slamJumpVerticalEligibleStreak += 1;
        } else {
          slamJumpVerticalEligibleStreak = 0;
        }
        const slamJumpConfirmed =
          slamJumpEligible && slamJumpEligibleStreak >= SLAM_JUMP_CONFIRM_FRAMES;
        const verticalSlamConfirmed =
          verticalSlamEligible &&
          slamJumpVerticalEligibleStreak >= SLAM_JUMP_CONFIRM_FRAMES;
        if (
          !slamJumpEligible &&
          !yTrackingSuspended &&
          viewerHorizontalRelocalJumpM >= slamJumpThreshold
        ) {
          if (staleCatchUp) {
            slamJumpStaleCatchupSkips += 1;
          } else if (
            !willUpdateOriginY ||
            Math.abs(dy) > SLAM_JUMP_MAX_VERTICAL_DELTA_M
          ) {
            slamJumpVerticalSkips += 1;
          } else if (
            viewerHorizontalRelocalJumpM > SLAM_JUMP_MAX_HORIZONTAL_DELTA_M
          ) {
            slamJumpHorizontalSkips += 1;
            if (
              sessionFloorAttached &&
              sessionFloorAnchor.lastRootPosition &&
              shouldApplyLargeHorizontalSlamJump(viewerHorizontalRelocalJumpM, dy) &&
              performance.now() - lastReferenceSpaceResetAt > SLAM_JUMP_DEBOUNCE_MS
            ) {
              const largeShift = applyHorizontalSlamJumpToSessionFloor(
                sessionFloorAnchor,
                placementRoot,
                dx,
                dz,
                SLAM_JUMP_MAX_HORIZONTAL_DELTA_M,
                SLAM_JUMP_LARGE_FIRST_SHIFT_M
              );
              if (largeShift.applied) {
                slamJumpLargeCorrections += 1;
                recordSlamFloorCorrection();
                queueSlamFloorRemainder(
                  largeShift.remainderX,
                  largeShift.remainderZ
                );
              } else {
                queueSlamFloorRemainder(dx, dz);
              }
            }
          }
        }
        if (
          sessionFloorAttached &&
          sessionFloorAnchor.lastRootPosition &&
          slamJumpConfirmed
        ) {
          slamJumpEligibleStreak = 0;
          if (
            sessionFloorAnchor.binding &&
            sessionFloorAnchor.poseLocked
          ) {
            const shift = applyHorizontalSlamJumpToSessionFloor(
              sessionFloorAnchor,
              placementRoot,
              dx,
              dz,
              slamJumpThreshold
            );
            if (shift.applied) {
              recordSlamFloorCorrection();
              queueSlamFloorRemainder(shift.remainderX, shift.remainderZ);
            } else {
              pendingSessionFloorRebind = true;
              pendingSessionFloorResync = false;
            }
          } else {
            const shift = applyHorizontalSlamJumpToSessionFloor(
              sessionFloorAnchor,
              placementRoot,
              dx,
              dz,
              slamJumpThreshold
            );
            if (shift.applied) {
              recordSlamFloorCorrection();
              queueSlamFloorRemainder(shift.remainderX, shift.remainderZ);
            }
          }
        } else if (
          sessionFloorAttached &&
          sessionFloorAnchor.lastRootPosition &&
          verticalSlamConfirmed
        ) {
          slamJumpVerticalEligibleStreak = 0;
          if (
            applyVerticalSlamJumpToSessionFloor(
              sessionFloorAnchor,
              placementRoot,
              dy
            )
          ) {
            slamJumpVerticalCorrections += 1;
            slamRelocalizationCorrections += 1;
            worldRepinCorrections += 1;
            for (const entry of placed) {
              recordPlacementResync(entry);
            }
          }
        } else if (hasWorldFrozen && slamJumpConfirmed) {
          slamJumpEligibleStreak = 0;
          const corrected = applyHorizontalSlamJumpToWorldFrozen(placed, dx, dz);
          if (corrected > 0) {
            slamRelocalizationCorrections += 1;
            worldRepinCorrections += corrected;
            for (const entry of placed) {
              if (entry.worldFrozen && entry.pinnedWorldPosition) {
                recordPlacementResync(entry);
              }
            }
          }
        }
        if (willUpdateOriginY) {
          const stepM = cappedCameraPathStep(viewerRelocalJumpM);
          if (stepM >= 0.002) {
            cameraPathM += stepM;
            cameraPathSinceLastStatsM += stepM;
          }
        }
      } else {
        viewerRelocalJumpM = 0;
        viewerHorizontalRelocalJumpM = 0;
      }
      lastOriginX = px;
      lastOriginZ = pz;
      if (viewerYPlausible || lastOriginY == null) {
        lastOriginY = roundedY;
        if (isPlausibleStandingViewerY(roundedY)) {
          lastPlausibleViewerY = roundedY;
        } else if (
          lastPlausibleViewerY == null &&
          roundedY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M &&
          roundedY <= FLOOR_STANDING_VIEWER_Y_MAX_M
        ) {
          lastPlausibleViewerY = roundedY;
        }
        lastFrameOriginUpdated = true;
        cameraOriginYMin =
          cameraOriginYMin == null ? roundedY : Math.min(cameraOriginYMin, roundedY);
        cameraOriginYMax =
          cameraOriginYMax == null ? roundedY : Math.max(cameraOriginYMax, roundedY);
      } else {
        lastFrameOriginUpdated = false;
      }
      const q = viewerPose.transform.orientation;
      const rot = new Quaternion(q.x, q.y, q.z, q.w);
      const forward = new Vector3(0, 0, -1);
      forward.rotateByQuaternionToRef(rot, forward);
      lastForwardY = Math.round(forward.y * 1000) / 1000;
    }
    applyPendingSlamFloorRemainder();
    if (placed.length > 0) {
      driftMetricsFrameCounter += 1;
      if (driftMetricsFrameCounter >= ANDROID_DRIFT_METRICS_EVERY_N_FRAMES) {
        driftMetricsFrameCounter = 0;
        for (const entry of placed) {
          const ref = entry.placedAnchorOrigin ?? entry.placedAtWorldPosition;
          if (!ref) continue;
          entry.root.computeWorldMatrix(true);
          const pos = entry.root.absolutePosition;
          const driftM = Math.hypot(
            pos.x - ref.x,
            pos.y - ref.y,
            pos.z - ref.z
          );
          if (driftM > placedMaxDriftM) placedMaxDriftM = driftM;
        }
      }
    }
  };

  const tryAutoCompleteFloorScan = () => {
    if (floorScanComplete || floorScanSkipped) return;
    const sessionAgeMs = performance.now() - xrSessionStartAt;
    if (sessionAgeMs < 800) return;
    if (
      floorYStabilizer.wouldBootstrapOnlyComplete(lastOriginY) &&
      !hasSurfaceScanEvidence()
    ) {
      return;
    }
    const state = emitFloorStateInternal();
    const hitsSufficient =
      hitFramesWithResults >= ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN;
    if ((state.hitReady || hitsSufficient) && canCompleteFloorScanAndroid()) {
      completeFloorScanInternal(false);
    }
  };

  const ensureSessionFloorLock = (): number | null => {
    if (!floorScanComplete) return floorYStabilizer.lockedFloorY();
    if (placed.length > 0 || sessionFloorLockFrozen) {
      return (
        floorYStabilizer.lockedFloorY() ?? virtualFloorPlane.lockedScanY
      );
    }
    if (floorScanLockedFromBootstrapOnly) {
      const frozen =
        floorYStabilizer.lockedFloorY() ?? virtualFloorPlane.lockedScanY;
      if (frozen != null) return frozen;
    }
    let current = floorYStabilizer.lockedFloorY();
    if (current == null) {
      const backup = virtualFloorPlane.lockedScanY;
      if (backup != null) {
        floorYStabilizer.setLockedFloorY(backup);
        current = backup;
      }
    }
    if (current == null) return null;
    const standingBaseline =
      scanCompleteViewerY ?? scanBaselineViewerY ?? lastPlausibleViewerY;
    const viewerForLock =
      resolveViewerYForScanLock(lastOriginY, standingBaseline) ??
      standingBaseline ??
      lastOriginY;
    const repaired = floorYStabilizer.repairLockForViewer(
      viewerForLock,
      standingBaseline ?? lastOriginY
    );
    if (repaired != null && repaired !== current) {
      applySessionFloorRelock(repaired);
      return repaired;
    }
    if (
      viewerForLock != null &&
      !isPlausibleLockedFloorY(current, viewerForLock)
    ) {
      const boot = bootstrapFloorYFromViewer(viewerForLock);
      if (
        boot != null &&
        isPlausibleLockedFloorY(boot, viewerForLock)
      ) {
        applySessionFloorRelock(boot);
        return boot;
      }
    }
    return current;
  };

  const applySessionFloorRelock = (newLocked: number) => {
    if (placed.length > 0 || sessionFloorLockFrozen) return;
    const priorY = virtualFloorPlane.lockedScanY ?? floorYStabilizer.lockedFloorY();
    floorYStabilizer.setLockedFloorY(newLocked);
    if (
      priorY == null ||
      Math.abs(newLocked - priorY) >= FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
    ) {
      floorScanLockedFromBootstrapOnly = false;
    }
    virtualFloorPlane.establish(
      newLocked,
      lastOriginX != null && lastOriginZ != null
        ? { x: lastOriginX, z: lastOriginZ }
        : null
    );
    const planeY = contactFloorY(newLocked);
    syncSessionFloorBindingY(sessionFloorAnchor, planeY);
    if (
      sessionFloorAnchor.poseLocked &&
      sessionFloorAnchor.lastRootPosition &&
      placed.length > 0
    ) {
      sessionFloorAnchor.lastRootPosition.y = planeY;
      placementRoot.unfreezeWorldMatrix();
      placementRoot.setAbsolutePosition(sessionFloorAnchor.lastRootPosition);
      placementRoot.rotationQuaternion = Quaternion.Identity();
      placementRoot.computeWorldMatrix(true);
    }
    if (latestPose.valid) {
      latestPose.position.y = contactFloorY(newLocked);
      syncFloorVisualsToPose();
    }
    floorRelockPromotions += 1;
  };

  const walkedSinceScanCompleteM = (): number =>
    cameraPathAtScanComplete != null
      ? cameraPathM - cameraPathAtScanComplete
      : 0;

  const maybePromoteBootstrapFromHitTest = (rawY: number) => {
    if (!floorScanComplete || !floorScanLockedFromBootstrapOnly) return;
    if (placed.length > 0 || sessionFloorLockFrozen) return;
    if (filterFloorScanSamples([rawY], lastOriginY).length === 0) return;
    floorYStabilizer.addScanSample(rawY, resolvedViewerForSamples(), {
      source: "surface",
    });
    if (
      hitFramesWithResults < ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN ||
      floorYStabilizer.surfaceSampleYs().length < 2
    ) {
      return;
    }
    const viewerForLockCheck =
      scanCompleteViewerY != null &&
      scanCompleteViewerY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
        ? scanCompleteViewerY
        : lastOriginY;
    const surfacePromoted =
      floorYStabilizer.relockFromSurfaceMedian(viewerForLockCheck);
    if (surfacePromoted != null) {
      applySessionFloorRelock(surfacePromoted);
    }
  };

  const maybeRelockFromHitTest = (rawY: number) => {
    if (!floorScanComplete) return;
    // Never relock session floor after first placement — shifts placementRoot and drifts all models.
    if (placed.length > 0 || sessionFloorLockFrozen) return;
    const now = performance.now();
    if (now - lastFloorRelockAt < ANDROID_FLOOR_RELOCK_MIN_INTERVAL_MS) return;
    lastFloorRelockAt = now;
    if (
      !floorScanLockedFromBootstrapOnly &&
      walkedSinceScanCompleteM() < RING_RELOCALIZATION_WALK_SINCE_SCAN_M
    ) {
      return;
    }
    ensureSessionFloorLock();
    const locked = floorYStabilizer.lockedFloorY();
    if (locked != null && !isTrustworthyLocalFloorHit(rawY, locked, lastOriginY)) {
      return;
    }
    if (filterFloorScanSamples([rawY], lastOriginY).length === 0) return;
    floorYStabilizer.addScanSample(rawY, resolvedViewerForSamples(), { source: "surface" });
    const surfYs = floorYStabilizer.surfaceSampleYs();
    const surfMedian =
      surfYs.length >= 2
        ? [...surfYs].sort((a, b) => a - b)[Math.floor(surfYs.length / 2)]!
        : surfYs[0] ?? rawY;
    const viewerForLockCheck =
      scanCompleteViewerY != null &&
      scanCompleteViewerY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
        ? scanCompleteViewerY
        : lastOriginY;
    const lockedImplausible =
      locked != null &&
      viewerForLockCheck != null &&
      viewerForLockCheck >= FLOOR_BOOTSTRAP_MIN_VIEWER_FOR_SCAN_COMPLETE_M &&
      !isPlausibleLockedFloorY(locked, viewerForLockCheck);
    const relockDivergeM = floorScanLockedFromBootstrapOnly
      ? FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
      : FLOOR_LOCK_MAX_DIVERGE_M;
    const needsRelock =
      floorScanLockedFromBootstrapOnly ||
      lockedImplausible ||
      (locked != null &&
        surfYs.length >= 2 &&
        Math.abs(surfMedian - locked) >= relockDivergeM);
    if (!needsRelock) return;
    const minSurf = floorScanLockedFromBootstrapOnly ? 2 : FLOOR_Y_SCAN_MIN_SAMPLES;
    if (surfYs.length < minSurf) return;

    const surfacePromoted = floorYStabilizer.relockFromSurfaceMedian(viewerForLockCheck);
    if (surfacePromoted != null) {
      applySessionFloorRelock(surfacePromoted);
      return;
    }

    const newLocked = floorYStabilizer.lockFromScan(
      resolveViewerYForScanLock(lastOriginY, lastPlausibleViewerY) ??
        lastPlausibleViewerY ??
        lastOriginY,
      lastPlausibleViewerY
    );
    if (newLocked == null) {
      if (locked != null) floorYStabilizer.setLockedFloorY(locked);
      return;
    }
    const priorY = virtualFloorPlane.lockedScanY ?? locked;
    const maxRelockDelta =
      floorScanLockedFromBootstrapOnly &&
      isPlausibleLockedFloorY(newLocked, viewerForLockCheck)
        ? FLOOR_BOOTSTRAP_RELOCK_MAX_DELTA_M
        : FLOOR_RELOCK_MAX_DELTA_M;
    if (
      priorY != null &&
      Math.abs(newLocked - priorY) > maxRelockDelta &&
      !isPlausibleLockedFloorY(newLocked, viewerForLockCheck)
    ) {
      floorYStabilizer.setLockedFloorY(priorY);
      return;
    }
    if (
      priorY != null &&
      Math.abs(newLocked - priorY) < FLOOR_BOOTSTRAP_RELOCK_DIVERGE_M
    ) {
      return;
    }
    applySessionFloorRelock(newLocked);
  };

  const emitFloorStateInternal = () => {
    const now = performance.now();
    const evalResult = evaluateFloorReady(
      {
        latestPoseValid: latestPose.valid,
        liveHit,
        lastValidHitAt,
        now,
        floorNormalY,
        floorScanComplete,
      },
      { strictAfterScan: ANDROID_STRICT_FLOOR_READY }
    );
    let hitReady = evalResult.ready;
    if (
      !floorScanComplete &&
      !floorScanSkipped &&
      hitFramesWithResults < ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN &&
      lastForwardY != null &&
      lastForwardY > MIN_FORWARD_Y_FOR_SCAN_HIT_READY
    ) {
      hitReady = false;
    }
    const viewerGlitch =
      lastRawOriginY != null && isViewerSlamGlitch(lastRawOriginY);
    const ready = hitReady || floorScanSkipped;
    const ringVisible =
      reticle.isVisible &&
      (latestPose.valid || ringPoseGraceActive(now)) &&
      (!viewerGlitch || floorScanComplete);
    const state: FloorDetectionState = {
      ready,
      hitReady,
      reticleVisible: ringVisible,
      ringPlaceable,
      liveHit,
      graceActive: evalResult.graceActive,
      poseAgeMs: evalResult.poseAgeMs,
      floorNormalY: Math.round(floorNormalY * 1000) / 1000,
      ringSurfaceReject,
    };
    const key = `${state.ready}|${state.hitReady}|${state.liveHit}|${state.graceActive}|${state.reticleVisible}|${state.ringPlaceable}|${ringSurfaceReject ?? ""}|${floorScanSkipped}|${floorScanComplete}`;
    if (key !== lastFloorStateKey) {
      lastFloorStateKey = key;
      for (const fn of floorStateListeners) fn(state);
    }
    if (floorScanComplete) {
      if (viewerGlitch) {
        statusText =
          "Tracking reset — hold phone at standing height and point at the floor.";
      } else if (ready) {
        statusText = ringPlaceable
          ? "Cyan ring — empty floor. Tap a model to place or swap."
          : ringSurfaceReject === "object-or-elevated"
            ? "Red ring — not empty floor (object/table). Aim at clear floor space."
            : ringSurfaceReject === "wall-or-steep"
              ? "Red ring — wall or steep surface. Aim at empty floor."
              : "Red ring — move to an empty floor spot before placing.";
      } else if (evalResult.graceActive) {
        statusText = "Floor lost — point at the floor until the ring returns.";
      } else if (liveHit && !evalResult.horizontal) {
        statusText = "Red ring — surface too steep. Point at a flat empty floor.";
      }
    } else if (ready) {
      statusText = viewerGlitch
        ? "Tracking reset — hold phone at standing height and point at the floor."
        : hitFramesWithResults >= ANDROID_MIN_HIT_FRAMES_FOR_SCAN_RING
          ? "Floor mapping — hold steady while the ring locks on…"
          : floorYStabilizer.surfaceSampleYs().length >= 1
            ? "Floor detected — keep scanning slowly…"
            : "Cyan ring is estimated — point at the floor and move slowly…";
    } else if (viewerGlitch) {
      statusText =
        "Tracking reset — hold phone at standing height and point at the floor.";
    } else if (
      !floorScanComplete &&
      lastForwardY != null &&
      lastForwardY > MIN_FORWARD_Y_FOR_SCAN_HIT_READY
    ) {
      statusText =
        "Tilt phone down — slowly pan across the floor until the cyan ring appears.";
    } else if (evalResult.graceActive) {
      statusText = "Floor lost — hold still or point at the floor again.";
    } else if (liveHit && !evalResult.horizontal) {
      statusText = "Surface too steep — point at a flat floor, not a wall.";
    }
    return state;
  };

  const emitFloorState = () => {
    const state = emitFloorStateInternal();
    tryAutoCompleteFloorScan();
    return state;
  };

  /** Coalesce hit-test burst updates to one emit per animation frame. */
  const scheduleEmitFloorState = () => {
    if (pendingFloorStateEmit) return;
    pendingFloorStateEmit = true;
    requestAnimationFrame(() => {
      pendingFloorStateEmit = false;
      emitFloorState();
    });
  };

  const disablePlaneDetectorUpdates = () => {
    if (!planeDetectorRef) return;
    planeDetectorRef.onPlaneAddedObservable.clear();
    planeDetectorRef.onPlaneUpdatedObservable.clear();
    planeDetectorRef = null;
  };

  const applyRingColor = (placeable: boolean) => {
    const ringColor = placeable ? RING_COLOR_PLACEABLE : RING_COLOR_BLOCKED;
    const discColor = placeable ? RING_DISC_COLOR_PLACEABLE : RING_DISC_COLOR_BLOCKED;
    reticleMat.emissiveColor = ringColor;
    floorDiscMat.emissiveColor = discColor;
    floorDiscMat.diffuseColor = placeable
      ? new Color3(0.05, 0.55, 0.65)
      : new Color3(0.65, 0.08, 0.05);
    floorDotMat.emissiveColor = placeable
      ? new Color3(0.2, 1, 0.85)
      : new Color3(1, 0.35, 0.2);
  };

  const setRingPlaceable = (
    placeable: boolean,
    surfaceReject: FloorRayRejectReason | null = null
  ) => {
    ringPlaceable = placeable;
    ringSurfaceReject = surfaceReject;
    applyRingColor(placeable);
  };

  const ringPoseGraceActive = (now = performance.now()): boolean =>
    lastValidHitAt > 0 && now - lastValidHitAt < POSE_GRACE_MS;

  const recordTrustedPlaceableFloor = (rawY: number, now = performance.now()) => {
    if (!Number.isFinite(rawY)) return;
    lastTrustedPlaceableRawY = rawY;
    lastTrustedPlaceableAt = now;
    elevatedRejectStreakStart = null;
  };

  const recordConfirmedPlacementFloor = (floorY: number, now = performance.now()) => {
    if (!Number.isFinite(floorY)) return;
    lastConfirmedPlacementFloorY = floorY;
    lastConfirmedPlacementAt = now;
    recordTrustedPlaceableFloor(floorY, now);
  };

  const cameraAimedAtFloorNow = (): boolean =>
    lastForwardY != null && isCameraAimedAtFloor(lastForwardY);

  /** After floor scan the ring stays visible — only color changes (cyan vs red). */
  const showRingAfterScan = (placeable = ringPlaceable) => {
    if (objectViewerMode) {
      reticle.isVisible = false;
      floorDisc.isVisible = false;
      floorDot.isVisible = false;
      return;
    }
    applyRingColor(placeable);
    if (!floorScanComplete) {
      reticle.isVisible = latestPose.valid;
      floorDisc.isVisible = latestPose.valid;
      floorDot.isVisible = latestPose.valid;
      reticleMat.alpha = 0.9;
      floorDiscMat.alpha = 0.38;
      return;
    }
    if (latestPose.valid || ringPoseGraceActive()) {
      syncFloorVisualsToPose();
      reticle.isVisible = true;
    }
    floorDisc.isVisible = false;
    floorDot.isVisible = false;
    reticleMat.alpha = 0.9;
  };

  const updateFloorVisuals = (visible: boolean, placeable = ringPlaceable) => {
    if (objectViewerMode) {
      reticle.isVisible = false;
      floorDisc.isVisible = false;
      floorDot.isVisible = false;
      return;
    }
    if (floorScanComplete) {
      if (latestPose.valid || visible) {
        applyRingColor(placeable);
        showRingAfterScan(placeable);
      }
      return;
    }
    reticle.isVisible = visible;
    floorDisc.isVisible = visible;
    floorDot.isVisible = visible;
    reticleMat.alpha = 0.9;
    floorDiscMat.alpha = 0.38;
  };

  const applyReticleFootprint = (footprintM: number) => {
    const scale = reticleScaleForFootprint(footprintM);
    reticle.scaling.set(scale, scale, scale);
  };

  applyReticleFootprint(reticlePreviewFootprintM);

  const syncFloorVisualsToPose = () => {
    reticle.position.copyFrom(latestPose.position);
    reticle.rotationQuaternion = latestPose.rotation;
    floorDisc.position.copyFrom(latestPose.position);
    floorDisc.position.y += 0.003;
    floorDisc.rotationQuaternion = latestPose.rotation;
    floorDot.position.copyFrom(latestPose.position);
    floorDot.position.y += 0.008;
  };

  const applyRingTarget = (
    targetPos: Vector3,
    targetRot: Quaternion,
    source: "hit-test" | "plane" | "camera-ray"
  ) => {
    if (ANDROID_FREEZE_RING_AFTER_PLACEMENT && placed.length > 0) {
      lastValidHitAt = performance.now();
      liveHit = true;
      return;
    }
    if (
      !floorScanComplete &&
      ringPoseSource === "hit-test" &&
      source !== "hit-test" &&
      latestPose.valid
    ) {
      return;
    }
    const projectedRingOnly = hitFramesWithResults < 1;
    if (
      floorScanComplete &&
      ANDROID_REJECT_RELOCALIZATION &&
      ringPoseSource === "hit-test" &&
      !projectedRingOnly &&
      latestPose.valid &&
      (cameraPathAtScanComplete == null ||
        cameraPathM - cameraPathAtScanComplete <
          RING_RELOCALIZATION_WALK_SINCE_SCAN_M) &&
      shouldRejectRingRelocalizationJump(
        latestPose.position,
        targetPos,
        true,
        lastOriginX != null && lastOriginZ != null
          ? { x: lastOriginX, z: lastOriginZ }
          : null,
        lastOriginY,
        cameraPathAtScanComplete != null
          ? cameraPathM - cameraPathAtScanComplete
          : null
      )
    ) {
      ringRelocalizationRejects += 1;
      ringRelocalizationStreak += 1;
      if (ringRelocalizationStreak < RING_RELOCALIZATION_FORCE_RESYNC_AFTER) {
        lastValidHitAt = performance.now();
        liveHit = true;
        updateFloorVisuals(true, false);
        syncFloorVisualsToPose();
        return;
      }
      ringRelocalizationStreak = 0;
    } else {
      ringRelocalizationStreak = 0;
    }
    if (
      floorScanComplete &&
      latestPose.valid &&
      source !== "camera-ray" &&
      shouldIgnoreRingJitter(latestPose.position, targetPos)
    ) {
      lastValidHitAt = performance.now();
      liveHit = true;
      return;
    }
    const scanHitTestHandoff =
      !floorScanComplete &&
      source === "hit-test" &&
      ringPoseSource === "camera-ray" &&
      latestPose.valid;
    if (scanHitTestHandoff) {
      scanHitTestBlendFramesRemaining = SCAN_HIT_TEST_BLEND_FRAMES;
    }
    if (latestPose.valid && ringPoseSource !== "none" && ringPoseSource !== source) {
      const jump = Math.hypot(
        targetPos.x - latestPose.position.x,
        targetPos.z - latestPose.position.z
      );
      if (jump >= RING_JUMP_LOG_MIN_M && !scanHitTestHandoff) {
        ringLargeJumps += 1;
        if (placed.length > 0) {
          pendingSessionFloorResync = true;
          pendingSessionFloorResyncFrames = 0;
        }
      }
    }
    ringPoseSource = source;
    if (floorNormalY >= MIN_FLOOR_NORMAL_Y) {
      if (!floorScanComplete) {
        const sanitized = sanitizeFloorHitY(targetPos.y, lastOriginY);
        if (sanitized) {
          if (sanitized.bootstrapped) floorHitBootstrapCount += 1;
          if (sanitized.y !== targetPos.y) targetPos.y = sanitized.y;
          if (source !== "plane") {
            floorYStabilizer.addScanSample(sanitized.y, resolvedViewerForSamples(), {
              source: sanitized.bootstrapped
                ? "bootstrap"
                : source === "camera-ray"
                  ? "camera-ray"
                  : "surface",
            });
          }
        } else {
          return;
        }
      }
      if (source === "camera-ray") {
        const stableY = estimateFloorYForRingDisplay();
        if (stableY != null) targetPos.y = stableY;
      }
      if (floorScanComplete) {
        ensureSessionFloorLock();
        const standingViewer =
          scanCompleteViewerY ?? scanBaselineViewerY ?? lastPlausibleViewerY;
        const viewerForResolve =
          resolveViewerYForScanLock(lastOriginY, standingViewer) ??
          standingViewer ??
          lastOriginY;
        const resolved = floorYStabilizer.resolveY(
          targetPos.y,
          true,
          viewerForResolve,
          standingViewer,
          false,
          floorScanLockedFromBootstrapOnly
        );
        targetPos.y = resolved.y;
        if (
          resolved.usedLocalOverride &&
          placed.length === 0 &&
          !floorScanLockedFromBootstrapOnly
        ) {
          const overridePromoted =
            floorYStabilizer.maybeRelockFromOverrideMedian(viewerForResolve);
          if (overridePromoted != null) {
            applySessionFloorRelock(overridePromoted);
          }
        }
      }
    }
    if (floorScanComplete && latestPose.valid) {
      const dy = Math.abs(targetPos.y - latestPose.position.y);
      if (dy < RING_FLOOR_Y_SMOOTH_M) {
        targetPos.y = latestPose.position.y;
      }
    }
    if (!floorScanComplete && latestPose.valid) {
      if (source === "camera-ray") {
        capScanRingXZStep(latestPose.position, targetPos);
      } else if (
        source === "hit-test" &&
        scanHitTestBlendFramesRemaining > 0
      ) {
        blendScanRingXZTowardHitTest(
          latestPose.position,
          targetPos,
          SCAN_HIT_TEST_BLEND_FRAMES - scanHitTestBlendFramesRemaining,
          SCAN_HIT_TEST_BLEND_FRAMES
        );
        scanHitTestBlendFramesRemaining -= 1;
      }
    }
    latestPose.position.copyFrom(targetPos);
    if (floorScanComplete) {
      latestPose.rotation = horizontalQuaternion(quaternionYaw(targetRot));
    } else {
      latestPose.rotation.copyFrom(targetRot);
    }
    latestPose.valid = true;
    lastRayReject = null;
    syncFloorVisualsToPose();
  };

  const completeFloorScanInternal = (
    allowBootstrapOnly = false,
    options?: { forceAtTimeout?: boolean; allowBootstrapWithoutTilt?: boolean }
  ): boolean => {
    if (floorScanComplete) return true;
    if (
      lastRawOriginY != null &&
      isViewerSlamGlitch(lastRawOriginY) &&
      !options?.forceAtTimeout
    ) {
      return false;
    }
    if (
      !options?.forceAtTimeout &&
      !allowBootstrapOnly &&
      !canCompleteFloorScanAndroid()
    ) {
      return false;
    }
    if (
      options?.forceAtTimeout &&
      !allowBootstrapOnly &&
      floorYStabilizer.validSampleCount(lastOriginY) < FLOOR_Y_SCAN_MIN_SAMPLES &&
      hitFramesWithResults < 1
    ) {
      return false;
    }
    if (
      allowBootstrapOnly &&
      hitFramesWithResults < 1 &&
      !hasSurfaceScanEvidence()
    ) {
      const enoughBootstrap =
        floorYStabilizer.bootstrapSampleYs().length >= FLOOR_Y_SCAN_MIN_SAMPLES ||
        (options?.forceAtTimeout === true &&
          floorYStabilizer.validSampleCount(lastOriginY) >= FLOOR_Y_SCAN_MIN_SAMPLES);
      // Session 1780828273381: block bootstrap-only lock while phone is level unless
      // we already collected enough bootstrap samples during scan, or this is the final
      // picker-unlock fallback after timeout.
      if (
        !options?.forceAtTimeout ||
        (!isPhoneTiltedTowardFloor(lastForwardY) &&
          !enoughBootstrap &&
          !options?.allowBootstrapWithoutTilt)
      ) {
        return false;
      }
    }
    const standingForLock = scanBaselineViewerY ?? lastPlausibleViewerY;
    const viewerForLock =
      resolveViewerYForScanLock(lastOriginY, standingForLock) ??
      standingForLock ??
      lastOriginY;
    const locked = floorYStabilizer.lockFromScan(
      viewerForLock,
      lastPlausibleViewerY
    );
    if (locked == null) {
      const bootFallback =
        viewerForLock != null ? bootstrapFloorYFromViewer(viewerForLock) : null;
      if (
        options?.forceAtTimeout &&
        bootFallback != null &&
        viewerForLock != null &&
        isPlausibleLockedFloorY(bootFallback, viewerForLock)
      ) {
        floorYStabilizer.setLockedFloorY(bootFallback);
      } else {
        return false;
      }
    }
    const resolvedScanLock = floorYStabilizer.lockedFloorY();
    const bootAtScan =
      viewerForLock != null ? bootstrapFloorYFromViewer(viewerForLock) : null;
    if (
      bootAtScan != null &&
      resolvedScanLock != null &&
      resolvedScanLock < bootAtScan - FLOOR_LOCK_MAX_BELOW_BOOTSTRAP_AT_SCAN_M
    ) {
      const surfFiltered = filterFloorScanSamples(
        floorYStabilizer.surfaceSampleYs(),
        viewerForLock
      );
      const surfMed =
        surfFiltered.length >= 2
          ? [...surfFiltered].sort((a, b) => a - b)[
              Math.floor(surfFiltered.length / 2)
            ]!
          : null;
      const corrected =
        surfMed != null &&
        surfMed >= bootAtScan - FLOOR_LOCK_MAX_BELOW_BOOTSTRAP_AT_SCAN_M &&
        isPlausibleLockedFloorY(surfMed, viewerForLock)
          ? surfMed
          : bootAtScan;
      if (
        isPlausibleLockedFloorY(corrected, viewerForLock) &&
        isTrustworthyScanLock(
          corrected,
          viewerForLock,
          floorYStabilizer.surfaceSampleYs()
        )
      ) {
        floorYStabilizer.setLockedFloorY(corrected);
      }
    }
    const currentLock = floorYStabilizer.lockedFloorY() ?? resolvedScanLock;
    if (currentLock == null) return false;
    if (
      viewerForLock != null &&
      !isPlausibleLockedFloorY(currentLock, viewerForLock)
    ) {
      const boot = bootstrapFloorYFromViewer(viewerForLock);
      if (
        boot == null ||
        !isPlausibleLockedFloorY(boot, viewerForLock) ||
        (!options?.forceAtTimeout &&
          !isTrustworthyScanLock(
            boot,
            viewerForLock,
            floorYStabilizer.surfaceSampleYs()
          ))
      ) {
        if (
          options?.forceAtTimeout &&
          boot != null &&
          isPlausibleLockedFloorY(boot, viewerForLock)
        ) {
          floorYStabilizer.setLockedFloorY(boot);
        } else {
          return false;
        }
      } else {
        floorYStabilizer.setLockedFloorY(boot);
      }
    }
    const finalLocked = floorYStabilizer.lockedFloorY();
    if (finalLocked == null) return false;
    if (
      viewerForLock != null &&
      !isTrustworthyScanLock(
        finalLocked,
        viewerForLock,
        floorYStabilizer.surfaceSampleYs()
      )
    ) {
      if (options?.forceAtTimeout) {
        const boot = bootstrapFloorYFromViewer(viewerForLock);
        if (boot == null || !isPlausibleLockedFloorY(boot, viewerForLock)) {
          return false;
        }
        floorYStabilizer.setLockedFloorY(boot);
      } else {
        return false;
      }
    }
    floorYStabilizer.relockFromSurfaceMedian(viewerForLock);
    let resolvedLocked = floorYStabilizer.lockedFloorY() ?? finalLocked;
    if (
      viewerForLock != null &&
      !isTrustworthyScanLock(
        resolvedLocked,
        viewerForLock,
        floorYStabilizer.surfaceSampleYs()
      )
    ) {
      floorYStabilizer.setLockedFloorY(finalLocked);
      resolvedLocked = finalLocked;
      if (
        !isTrustworthyScanLock(
          resolvedLocked,
          viewerForLock,
          floorYStabilizer.surfaceSampleYs()
        )
      ) {
        if (options?.forceAtTimeout) {
          const boot = bootstrapFloorYFromViewer(viewerForLock);
          if (boot == null || !isPlausibleLockedFloorY(boot, viewerForLock)) {
            return false;
          }
          floorYStabilizer.setLockedFloorY(boot);
          resolvedLocked = boot;
        } else {
          return false;
        }
      }
    }
    const standingForPin = scanBaselineViewerY ?? lastPlausibleViewerY;
    const crouchCorrected = correctBootstrapCrouchLock(
      resolvedLocked,
      pinnedDisplayFloorY,
      viewerForLock,
      standingForPin
    );
    if (crouchCorrected !== resolvedLocked) {
      floorYStabilizer.setLockedFloorY(crouchCorrected);
      resolvedLocked = crouchCorrected;
    }
    const pinnedLock = preferPinnedScanLockY(
      resolvedLocked,
      pinnedDisplayFloorY,
      viewerForLock,
      standingForPin,
      floorYStabilizer.lockedFromBootstrapOnly()
    );
    if (pinnedLock != null && pinnedLock !== resolvedLocked) {
      floorYStabilizer.setLockedFloorY(pinnedLock);
      resolvedLocked = pinnedLock;
    }
    floorScanComplete = true;
    floorScanLockedFromBootstrapOnly = floorYStabilizer.lockedFromBootstrapOnly();
    scanCompleteViewerY =
      resolveViewerYForScanLock(
        lastOriginY,
        scanBaselineViewerY ?? lastPlausibleViewerY
      ) ??
      scanBaselineViewerY ??
      (lastPlausibleViewerY != null &&
      lastPlausibleViewerY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
        ? lastPlausibleViewerY
        : lastOriginY != null &&
            lastOriginY >= FLOOR_Y_MIN_VIEWER_FOR_FILTER_M
          ? lastOriginY
          : lastPlausibleViewerY);
    cameraPathAtScanComplete = cameraPathM;
    virtualFloorPlane.establish(
      resolvedLocked,
      lastOriginX != null && lastOriginZ != null
        ? { x: lastOriginX, z: lastOriginZ }
        : null
    );
    if (latestPose.valid) {
      latestPose.position.y = contactFloorY(resolvedLocked);
      syncFloorVisualsToPose();
    } else {
      const frame = base.sessionManager.currentFrame;
      if (frame) {
        const viewerPose = resolveViewerPoseFromFrame(frame, {
          referenceSpace: base.sessionManager.referenceSpace,
          baseReferenceSpace: base.sessionManager.baseReferenceSpace,
          viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
        });
        if (viewerPose) {
          const { origin, forward } = viewerRayFromXrPose(
            viewerPose,
            scene.useRightHandedSystem
          );
          updateRingFromLockedFloor(origin, forward, "scan-complete-seed");
        }
      }
    }
    floorDisc.isVisible = false;
    floorDot.isVisible = false;
    disablePlaneDetectorUpdates();
    const showRing =
      latestPose.valid &&
      floorNormalY >= MIN_FLOOR_NORMAL_Y &&
      (liveHit || performance.now() - lastValidHitAt < POSE_GRACE_MS);
    updateFloorVisuals(showRing, false);
    recordTrustedPlaceableFloor(
      lastRawHitTestFloorY ?? contactFloorY(resolvedLocked),
      performance.now()
    );
    statusText = floorScanLockedFromBootstrapOnly
      ? "Floor height estimated — tilt phone toward the floor for better accuracy. Tap a model to place."
      : "Cyan ring on floor shows where models will appear — tap a model to place.";
    emitFloorState();
    return true;
  };

  const bootstrapFloorScanFromViewerInternal = (): boolean => {
    if (floorScanComplete || floorScanSkipped) return floorScanComplete;
    if (
      !hasSurfaceScanEvidence() &&
      hitFramesWithResults < 1 &&
      !isPhoneTiltedTowardFloor(lastForwardY)
    ) {
      return false;
    }
    if (
      ANDROID_STRICT_FLOOR_READY &&
      !hasSurfaceScanEvidence() &&
      floorYStabilizer.validSampleCount(lastOriginY) < FLOOR_Y_SCAN_MIN_SAMPLES
    ) {
      return false;
    }
    if (lastOriginY == null || lastOriginY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M) return false;
    const boot = bootstrapFloorYFromViewer(lastOriginY);
    if (boot == null) return false;
    while (floorYStabilizer.validSampleCount(lastOriginY) < FLOOR_Y_SCAN_MIN_SAMPLES) {
      floorYStabilizer.addScanSample(boot, lastOriginY, { source: "bootstrap", force: true });
    }
    return completeFloorScanInternal(true, { forceAtTimeout: true });
  };

  /** Last-resort unlock so the model picker is not stuck after scan timeout. */
  const forceUnlockFloorScanForPicker = (): boolean => {
    if (floorScanComplete || floorScanSkipped) return floorScanComplete;
    const viewerY = lastPlausibleViewerY ?? lastOriginY;
    if (viewerY == null || viewerY < FLOOR_Y_MIN_VIEWER_FOR_FILTER_M) {
      return false;
    }
    const boot = bootstrapFloorYFromViewer(viewerY);
    if (boot == null) return false;
    while (floorYStabilizer.validSampleCount(viewerY) < FLOOR_Y_SCAN_MIN_SAMPLES) {
      floorYStabilizer.addScanSample(boot, viewerY, { source: "bootstrap", force: true });
    }
    return completeFloorScanInternal(true, {
      forceAtTimeout: true,
      allowBootstrapWithoutTilt: true,
    });
  };

  /** Timeout fallback — relax hit-frame gate when surface samples are trustworthy. */
  const forceCompleteFloorScanAtTimeout = (): boolean => {
    if (floorScanComplete || floorScanSkipped) return floorScanComplete;
    const validSamples = floorYStabilizer.validSampleCount(lastOriginY);
    const bootstrapSamples = floorYStabilizer.bootstrapSampleYs().length;
    const state = emitFloorStateInternal();

    if (
      (state.hitReady || hitFramesWithResults >= 1) &&
      validSamples >= FLOOR_Y_SCAN_MIN_SAMPLES &&
      hasSurfaceScanEvidence()
    ) {
      if (completeFloorScanInternal(false, { forceAtTimeout: true })) {
        return true;
      }
    }

    if (
      (validSamples >= FLOOR_Y_SCAN_MIN_SAMPLES || state.hitReady) &&
      (hasSurfaceScanEvidence() || hitFramesWithResults >= 1)
    ) {
      if (completeFloorScanInternal(true, { forceAtTimeout: true })) {
        return true;
      }
    }

    if (
      validSamples >= FLOOR_Y_SCAN_MIN_SAMPLES &&
      bootstrapSamples >= FLOOR_Y_SCAN_MIN_SAMPLES
    ) {
      if (
        completeFloorScanInternal(true, {
          forceAtTimeout: true,
          allowBootstrapWithoutTilt: true,
        })
      ) {
        return true;
      }
    }

    if (isPhoneTiltedTowardFloor(lastForwardY)) {
      return bootstrapFloorScanFromViewerInternal();
    }

    return forceUnlockFloorScanForPicker();
  };

  const resolvePlacementFloorY = (
    rawFloorY: number,
    viewerOriginY?: number | null
  ): {
    floorY: number;
    rawY: number;
    lockedFloorY: number | null;
    usedLock: boolean;
    usedLocalOverride?: boolean;
  } => {
    ensureSessionFloorLock();
    const lockedFloorY = floorYStabilizer.lockedFloorY();
    if (!floorScanComplete || lockedFloorY == null) {
      return { floorY: rawFloorY, rawY: rawFloorY, lockedFloorY, usedLock: false };
    }
    const resolved = floorYStabilizer.resolveY(
      rawFloorY,
      true,
      viewerOriginY,
      scanCompleteViewerY,
      false
    );
    return {
      floorY: resolved.y,
      rawY: resolved.rawY,
      lockedFloorY: resolved.lockedFloorY,
      usedLock: resolved.usedLock,
      usedLocalOverride: resolved.usedLocalOverride,
    };
  };

  const getPlacementPose = (): {
    ok: boolean;
    floorY: number;
    rawFloorY: number;
    lockedFloorY: number | null;
    floorYUsedLocked?: boolean;
    poseAgeMs: number;
    normalY: number;
  } => {
    const state = emitFloorState();
    if (!state.ready) {
      return {
        ok: false,
        floorY: latestPose.position.y,
        rawFloorY: latestPose.position.y,
        lockedFloorY: floorYStabilizer.lockedFloorY(),
        poseAgeMs: state.poseAgeMs,
        normalY: floorNormalY,
      };
    }
    if (floorScanComplete && latestPose.valid && !ringPlaceable) {
      return {
        ok: false,
        floorY: latestPose.position.y,
        rawFloorY: lastRawHitTestFloorY ?? latestPose.position.y,
        lockedFloorY: floorYStabilizer.lockedFloorY(),
        poseAgeMs: state.poseAgeMs,
        normalY: floorNormalY,
      };
    }
    const rawFloorY = lastRawHitTestFloorY ?? latestPose.position.y;
    const resolved = resolvePlacementFloorY(rawFloorY, lastOriginY);
    if (floorScanComplete && resolved.lockedFloorY == null) {
      const planeY = virtualFloorPlane.planeHeightM;
      const planeRaw = virtualFloorPlane.lockedScanY;
      if (planeY != null && planeY >= FLOOR_Y_MIN_M && planeRaw != null) {
        floorYStabilizer.setLockedFloorY(planeRaw);
        return {
          ok: true,
          floorY: planeY,
          rawFloorY: resolved.rawY,
          lockedFloorY: planeRaw,
          floorYUsedLocked: true,
          poseAgeMs: state.poseAgeMs,
          normalY: floorNormalY,
        };
      }
      return {
        ok: false,
        floorY: resolved.floorY,
        rawFloorY: resolved.rawY,
        lockedFloorY: null,
        poseAgeMs: state.poseAgeMs,
        normalY: floorNormalY,
      };
    }
    if (floorScanComplete && resolved.floorY < FLOOR_Y_MIN_M) {
      const locked = resolved.lockedFloorY ?? floorYStabilizer.lockedFloorY();
      if (locked != null) {
        const fallbackY = contactFloorY(locked);
        if (fallbackY >= FLOOR_Y_MIN_M) {
          return {
            ok: true,
            floorY: fallbackY,
            rawFloorY: resolved.rawY,
            lockedFloorY: locked,
            floorYUsedLocked: true,
            poseAgeMs: state.poseAgeMs,
            normalY: floorNormalY,
          };
        }
      }
      return {
        ok: false,
        floorY: resolved.floorY,
        rawFloorY: resolved.rawY,
        lockedFloorY: resolved.lockedFloorY,
        poseAgeMs: state.poseAgeMs,
        normalY: floorNormalY,
      };
    }
    return {
      ok: true,
      floorY: resolved.floorY,
      rawFloorY: resolved.rawY,
      lockedFloorY: resolved.lockedFloorY,
      floorYUsedLocked: resolved.usedLock,
      poseAgeMs: state.poseAgeMs,
      normalY: floorNormalY,
    };
  };

  const getViewerRayFromCurrentFrame = (
    xrFrame?: XRFrame
  ): { origin: Vector3; forward: Vector3 } | null => {
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    if (!frame) return null;
    const refSpace = base.sessionManager.referenceSpace;
    const baseRef = base.sessionManager.baseReferenceSpace;
    if (!refSpace && !baseRef) return null;
    const viewerPose = resolveViewerPoseFromFrame(frame, {
      referenceSpace: refSpace,
      baseReferenceSpace: baseRef,
      viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
    });
    if (!viewerPose) return null;
    return viewerRayFromXrPose(viewerPose, scene.useRightHandedSystem);
  };

  /** Locked-floor ring projection — allowed after scan even when hit-test is active. */
  const tryLockedFloorRingFromXrFrame = (xrFrame?: XRFrame): boolean => {
    const ray = getViewerRayFromCurrentFrame(xrFrame);
    if (!ray) return false;
    return updateRingFromLockedFloor(ray.origin, ray.forward, "locked-floor-fallback");
  };

  /** Red ring on locked floor when the camera aims at a wall (not down at floor). */
  const showWallBlockedRing = (
    origin: Vector3,
    forward: Vector3,
    mode: string
  ): boolean => {
    const locked = floorYStabilizer.lockedFloorY();
    const viewerY = resolveViewerYForFloorRayLocal(origin.y);
    if (locked != null && viewerY != null) {
      const projected = projectViewerForwardToFloor(
        { x: origin.x, y: viewerY, z: origin.z },
        { x: forward.x, y: forward.y, z: forward.z },
        contactFloorY(locked),
        1.0
      );
      if (projected) {
        applyFloorHitPoint(
          projected.x,
          projected.y,
          projected.z,
          projected.yaw,
          mode
        );
      } else if (latestPose.valid) {
        syncFloorVisualsToPose();
      }
    } else if (latestPose.valid) {
      syncFloorVisualsToPose();
    } else {
      return false;
    }
    setRingPlaceable(false, "wall-or-steep");
    lastRayReject = "wall-or-steep";
    ringWallRejects += 1;
    liveHit = true;
    lastValidHitAt = performance.now();
    showRingAfterScan(false);
    return true;
  };

  const showBlockedRing = (
    reason: FloorRayRejectReason,
    origin?: Vector3,
    forward?: Vector3
  ) => {
    lastRayReject = reason;
    if (reason === "wall-or-steep") ringWallRejects += 1;
    if (reason === "object-or-elevated") ringObjectRejects += 1;
    liveHit = true;
    lastValidHitAt = performance.now();

    if (!floorScanComplete) {
      updateFloorVisuals(false, false);
      scheduleEmitFloorState();
      return;
    }

    const ray = origin != null && forward != null
      ? { origin, forward }
      : getViewerRayFromCurrentFrame();

    if (reason === "wall-or-steep" && ray) {
      showWallBlockedRing(ray.origin, ray.forward, "wall-blocked-hit");
      scheduleEmitFloorState();
      return;
    }

    if (reason === "object-or-elevated") {
      const locked = floorYStabilizer.lockedFloorY();
      if (locked != null && ray) {
        const projected = projectViewerForwardToFloor(
          {
            x: ray.origin.x,
            y: resolveViewerYForFloorRayLocal(ray.origin.y) ?? ray.origin.y,
            z: ray.origin.z,
          },
          { x: ray.forward.x, y: ray.forward.y, z: ray.forward.z },
          contactFloorY(locked),
          1.0
        );
        if (projected) {
          applyFloorHitPoint(
            projected.x,
            projected.y,
            projected.z,
            projected.yaw,
            "object-blocked-hit"
          );
        } else if (latestPose.valid) {
          syncFloorVisualsToPose();
        }
      } else if (latestPose.valid) {
        syncFloorVisualsToPose();
      }
      setRingPlaceable(false, reason);
      showRingAfterScan(false);
      scheduleEmitFloorState();
      return;
    }

    if (latestPose.valid) {
      setRingPlaceable(false, reason);
      showRingAfterScan(false);
    } else if (ray) {
      showWallBlockedRing(ray.origin, ray.forward, "blocked-fallback");
    }
    scheduleEmitFloorState();
  };

  const rejectNonFloorRing = (reason: FloorRayRejectReason): boolean => {
    showBlockedRing(reason);
    return floorScanComplete && (latestPose.valid || reticle.isVisible);
  };

  const applyFloorHitPoint = (x: number, y: number, z: number, yaw: number, mode: string) => {
    const targetPos = new Vector3(x, y, z);
    const targetRot = horizontalQuaternion(yaw);
    const source = mode.includes("camera") ? "camera-ray" : "hit-test";
    applyRingTarget(targetPos, targetRot, source);
    if (source === "camera-ray" || mode.includes("locked-floor")) {
      floorNormalY = 1;
    }
    liveHit = true;
    lastValidHitAt = performance.now();
    updateFloorVisuals(true);
    if (mode.includes("camera")) cameraRayHits += 1;
    if (hitFramesWithResults === 0 && mode.includes("camera")) {
      hitTestMode = mode;
    } else if (mode.includes("plane")) {
      hitTestMode = mode;
    }
    emitFloorState();
    return true;
  };

  const collectCameraRayFloorSample = (
    origin: Vector3,
    forward: Vector3
  ): boolean => {
    if (floorScanComplete || floorScanSkipped) return false;
    if (isViewerSlamGlitch(origin.y)) return false;

    const viewerY = resolveViewerYForFloorRayLocal(origin.y);
    if (viewerY == null) return false;

    const bootFloorY =
      estimateFloorYForRingDisplay() ?? bootstrapFloorYFromViewer(viewerY);
    if (bootFloorY == null) return false;
    const rayOrigin = { x: origin.x, y: viewerY, z: origin.z };
    const attempt = intersectRayWithHorizontalFloor(
      rayOrigin,
      { x: forward.x, y: forward.y, z: forward.z },
      {
        floorY: bootFloorY,
        minForwardDown: viewerY > 1.0 ? 0.12 : 0.05,
        ...scanFloorRayOptions(),
      }
    );
    lastRayReject = attempt.rejectReason;
    if (!attempt.hit) {
      const projected = projectViewerForwardToFloor(
        rayOrigin,
        { x: forward.x, y: forward.y, z: forward.z },
        bootFloorY,
        SCAN_PROVISIONAL_FORWARD_M
      );
      if (projected) {
        floorYStabilizer.addScanSample(projected.y, viewerY, {
          source: "bootstrap",
        });
        return true;
      }
      return false;
    }

    floorYStabilizer.addScanSample(attempt.hit.y, viewerY, {
      source: "camera-ray",
    });
    return true;
  };

  const updateRingFromLockedFloor = (
    origin: Vector3,
    forward: Vector3,
    mode = "locked-floor-proj"
  ): boolean => {
    const rayOrigin =
      isViewerSlamGlitch(origin.y) ? resolveOriginYForFloorRay(origin) : origin;
    if (isViewerSlamGlitch(rayOrigin.y)) {
      lastRayReject = "tracking-not-ready";
      if (floorScanComplete && latestPose.valid) {
        showRingAfterScan(ringPlaceable);
      } else if (!floorScanComplete) {
        updateFloorVisuals(false);
      }
      return false;
    }
    if (!isCameraAimedAtFloor(forward.y)) {
      if (floorScanComplete && !floorScanSkipped) {
        return showWallBlockedRing(origin, forward, mode);
      }
      lastRayReject = "direction-not-down";
      if (floorScanComplete && latestPose.valid) {
        showRingAfterScan(ringPlaceable);
      } else if (!floorScanComplete) {
        updateFloorVisuals(false);
        liveHit = false;
      }
      return false;
    }
    const locked = floorYStabilizer.lockedFloorY();
    if (locked == null) return false;
    const viewerY = resolveViewerYForFloorRayLocal(rayOrigin.y);
    if (viewerY == null) return false;
    const floorY = contactFloorY(locked);
    const rayOriginPt = { x: rayOrigin.x, y: viewerY, z: rayOrigin.z };
    const attempt = intersectRayWithHorizontalFloor(
      rayOriginPt,
      { x: forward.x, y: forward.y, z: forward.z },
      {
        floorY,
        minForwardDown: 0.05,
      }
    );
    lastRayReject = attempt.rejectReason;
    if (attempt.hit) {
      const placed = applyFloorHitPoint(
        attempt.hit.x,
        attempt.hit.y,
        attempt.hit.z,
        attempt.hit.yaw,
        mode
      );
      if (placed && floorScanComplete) {
        setRingPlaceable(true, null);
        lastRayReject = null;
      }
      return placed;
    }
    const projected = projectViewerForwardToFloor(
      rayOriginPt,
      { x: forward.x, y: forward.y, z: forward.z },
      floorY
    );
    if (!projected) return false;
    lastRayReject = null;
    const placed = applyFloorHitPoint(
      projected.x,
      projected.y,
      projected.z,
      projected.yaw,
      mode
    );
    if (placed && floorScanComplete) {
      setRingPlaceable(true, null);
      lastRayReject = null;
    }
    return placed;
  };

  const tryCameraFloorRayFromVectors = (
    origin: Vector3,
    forward: Vector3,
    mode = "camera-floor-ray"
  ): boolean => {
    if (
      floorScanSkipped ||
      (floorScanComplete &&
        ANDROID_BLOCK_CAMERA_RAY_AFTER_SCAN &&
        hitFramesWithResults >= 1 &&
        !floorScanLockedFromBootstrapOnly)
    ) {
      return false;
    }

    if (isViewerSlamGlitch(origin.y)) {
      slamGlitchHideStreak += 1;
      lastRayReject = "tracking-not-ready";
      if (floorScanComplete) {
        const resolved = resolveOriginYForFloorRay(origin);
        if (
          !isViewerSlamGlitch(resolved.y) &&
          updateRingFromLockedFloor(resolved, forward, mode)
        ) {
          return true;
        }
        showRingAfterScan(ringPlaceable);
      } else {
        updateFloorVisuals(false);
      }
      return false;
    }
    if (slamGlitchHideStreak > 0) {
      slamGlitchHideStreak = 0;
      ringRelocalizationStreak = 0;
    }

    const ringVisibleDuringScan =
      shouldUseBootstrapRingDuringScan() || needsProjectedRingAfterScan();

    if (floorScanComplete && needsProjectedRingAfterScan()) {
      return updateRingFromLockedFloor(origin, forward, mode);
    }

    const viewerY = resolveViewerYForFloorRayLocal(origin.y);
    if (viewerY == null) return false;
    const bootFloorY =
      estimateFloorYForRingDisplay() ?? bootstrapFloorYFromViewer(viewerY);
    if (bootFloorY == null) return false;
    const rayOrigin = { x: origin.x, y: viewerY, z: origin.z };
    const attempt = intersectRayWithHorizontalFloor(
      rayOrigin,
      { x: forward.x, y: forward.y, z: forward.z },
      {
        floorY: bootFloorY,
        minForwardDown: !floorScanComplete ? 0.12 : 0.05,
        ...scanFloorRayOptions(),
      }
    );
    lastRayReject = attempt.rejectReason;
    if (!attempt.hit) {
      const projected = projectViewerForwardToFloor(
        rayOrigin,
        { x: forward.x, y: forward.y, z: forward.z },
        bootFloorY,
        SCAN_PROVISIONAL_FORWARD_M
      );
      if (projected && ringVisibleDuringScan) {
        lastRayReject = null;
        return applyFloorHitPoint(
          projected.x,
          projected.y,
          projected.z,
          projected.yaw,
          "camera-forward-proj"
        );
      }
      return false;
    }

    if (!ringVisibleDuringScan) return false;
    return applyFloorHitPoint(attempt.hit.x, attempt.hit.y, attempt.hit.z, attempt.hit.yaw, mode);
  };

  const tryProvisionalScanRing = (origin: Vector3, forward: Vector3): boolean => {
    if (floorScanComplete || floorScanSkipped) return false;
    if (!shouldUseBootstrapRingDuringScan()) return false;
    const viewerY = resolveViewerYForFloorRayLocal(origin.y);
    if (viewerY == null) return false;
    const boot =
      estimateFloorYForRingDisplay() ?? bootstrapFloorYFromViewer(viewerY);
    if (boot == null) return false;
    const rayOrigin = { x: origin.x, y: viewerY, z: origin.z };
    const projected = projectViewerForwardToFloor(
      rayOrigin,
      { x: forward.x, y: forward.y, z: forward.z },
      boot,
      SCAN_PROVISIONAL_FORWARD_M
    );
    if (!projected) return false;
    lastRayReject = null;
    return applyFloorHitPoint(
      projected.x,
      projected.y,
      projected.z,
      projected.yaw,
      "camera-forward-proj"
    );
  };

  const tryCameraFloorRayFromXrFrame = (xrFrame?: XRFrame): boolean => {
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    if (!frame) {
      lastRayReject = "no-xr-frame";
      return false;
    }
    const refSpace = base.sessionManager.referenceSpace;
    const baseRef = base.sessionManager.baseReferenceSpace;
    if (!refSpace && !baseRef) {
      lastRayReject = "no-reference-space";
      return false;
    }
    const viewerPose = resolveViewerPoseFromFrame(frame, {
      referenceSpace: refSpace,
      baseReferenceSpace: baseRef,
      viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
    });
    if (!viewerPose) {
      lastRayReject = "no-viewer-pose";
      return false;
    }
    const { origin, forward } = viewerRayFromXrPose(
      viewerPose,
      scene.useRightHandedSystem
    );
    return tryCameraFloorRayFromVectors(origin, forward, "camera-floor-ray");
  };

  const tryCameraFloorRay = (): boolean => tryCameraFloorRayFromXrFrame();

  const queuePlacementAnchorBind = (
    entry: PlacedEntry,
    hit: XRHitTestResult | null | undefined
  ): boolean => {
    if (!ANDROID_USE_PLACEMENT_ANCHORS) return false;
    if (!entry.root.rotationQuaternion) return false;
    entry.root.computeWorldMatrix(true);
    pendingAnchorBinds.push({
      entry,
      hit: hit ?? null,
      worldPosition: entry.root.absolutePosition.clone(),
      worldYaw: quaternionYaw(entry.root.absoluteRotationQuaternion),
    });
    return true;
  };

  let lastPlaneUpdateAt = 0;

  const tryHorizontalPlane = (plane: { transformationMatrix?: Matrix }) => {
    if (floorScanComplete || !plane.transformationMatrix || floorScanSkipped) return;
    if (!floorScanComplete && !isPhoneTiltedTowardFloor(lastForwardY)) return;
    const now = performance.now();
    // Prefer hit-test over plane detection whenever hit-test has ever returned results.
    if (hitTestAttached && (floorScanComplete || hitFramesWithResults >= 1)) {
      planeRingUpdatesSkipped += 1;
      return;
    }
    const rot = new Quaternion();
    const pos = new Vector3();
    plane.transformationMatrix.decompose(undefined, rot, pos);
    floorUp.set(0, 1, 0);
    floorUp.rotateByQuaternionAroundPointToRef(rot, Vector3.Zero(), floorUp);
    if (floorUp.y < MIN_FLOOR_NORMAL_Y) return;

    const planeMinMs = floorScanComplete ? PLANE_UPDATE_MIN_MS_AFTER_SCAN : PLANE_UPDATE_MIN_MS;
    const planeMinDelta = floorScanComplete
      ? PLANE_POSE_MIN_DELTA_M_AFTER_SCAN
      : PLANE_POSE_MIN_DELTA_M;
    if (latestPose.valid) {
      if (now - lastPlaneUpdateAt < planeMinMs) {
        lastValidHitAt = now;
        liveHit = true;
        return;
      }
      const dx = pos.x - latestPose.position.x;
      const dy = pos.y - latestPose.position.y;
      const dz = pos.z - latestPose.position.z;
      if (Math.hypot(dx, dz) < planeMinDelta && Math.abs(dy) < 0.025) {
        lastValidHitAt = now;
        liveHit = true;
        return;
      }
    }
    lastPlaneUpdateAt = now;

    const targetRot = rot.clone();
    const targetPos = pos.clone();
    applyRingTarget(targetPos, targetRot, "plane");
    floorNormalY = floorUp.y;
    liveHit = true;
    lastValidHitAt = performance.now();
    updateFloorVisuals(true, false);
    hitTestMode = "plane-detection";
    planeHits += 1;
    scheduleEmitFloorState();
  };

  const bindHitTestResults = (hitTest: WebXRHitTest) => {
    hitTest.onHitTestResultObservable.clear();
    hitTest.onHitTestResultObservable.add((results) => {
      const now = performance.now();
      if (!results.length) {
        hitFramesEmpty += 1;
        if (!floorScanComplete && shouldUseBootstrapRingDuringScan()) {
          if (tryCameraFloorRayFromXrFrame()) {
            scheduleEmitFloorState();
            return;
          }
        }
        if (!floorScanComplete) {
          const frame = base.sessionManager.currentFrame;
          if (frame) {
            const viewerPose = resolveViewerPoseFromFrame(frame, {
              referenceSpace: base.sessionManager.referenceSpace,
              baseReferenceSpace: base.sessionManager.baseReferenceSpace,
              viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
            });
            if (viewerPose) {
              const { origin, forward } = viewerRayFromXrPose(
                viewerPose,
                scene.useRightHandedSystem
              );
              if (tryProvisionalScanRing(origin, forward)) {
                scheduleEmitFloorState();
                return;
              }
            }
          }
        }
        if (floorScanComplete) {
          if (tryLockedFloorRingFromXrFrame()) {
            scheduleEmitFloorState();
            return;
          }
          if (latestPose.valid || ringPoseGraceActive(now)) {
            liveHit = false;
            showRingAfterScan(ringPlaceable);
          }
          scheduleEmitFloorState();
          return;
        }
        if (
          latestPose.valid &&
          lastValidHitAt > 0 &&
          now - lastValidHitAt < POSE_GRACE_MS
        ) {
          showRingAfterScan(ringPlaceable);
          scheduleEmitFloorState();
          return;
        }
        if (!floorScanComplete) {
          liveHit = false;
          latestPose.valid = false;
          updateFloorVisuals(false);
        }
        scheduleEmitFloorState();
        return;
      }
      hitFramesWithResults += 1;
      refreshViewerOrigin();
      const viewerRay = getViewerRayFromCurrentFrame();
      if (
        floorScanComplete &&
        lastForwardY != null &&
        !isCameraAimedAtFloor(lastForwardY)
      ) {
        if (viewerRay) {
          showWallBlockedRing(viewerRay.origin, viewerRay.forward, "wall-aim-hit");
        } else {
          rejectNonFloorRing("wall-or-steep");
        }
        return;
      }
      lastXrHitResult = results[0]?.xrHitResult ?? null;
      const hitPose = extractHitTestPose(results[0].transformationMatrix);
      const targetPos = hitPose.position;
      const targetRot = hitPose.rotation;
      if (
        !floorScanComplete &&
        pinnedDisplayFloorY != null &&
        Math.abs(targetPos.y - pinnedDisplayFloorY) > FLOOR_LOCK_MAX_DIVERGE_M
      ) {
        if (tryCameraFloorRayFromXrFrame()) {
          scheduleEmitFloorState();
          return;
        }
      }
      if (hitPose.scaleAnomaly) hitTestScaleAnomalies += 1;
      lastHitTestScale = Math.round(((hitPose.scale.x + hitPose.scale.y + hitPose.scale.z) / 3) * 1000) / 1000;
      floorNormalY = hitPose.surfaceNormalY;
      const surfaceReject = classifyRingSurfaceHit(
        hitPose.surfaceNormalY,
        targetPos.y,
        floorScanComplete ? floorYStabilizer.lockedFloorY() : null,
        floorScanComplete,
        effectiveViewerYForRing()
      );
      if (surfaceReject === "wall-or-steep") {
        if (viewerRay) {
          showWallBlockedRing(viewerRay.origin, viewerRay.forward, "wall-hit-test");
        } else {
          rejectNonFloorRing(surfaceReject);
        }
        return;
      }
      if (surfaceReject === "object-or-elevated") {
        const rawHitY = targetPos.y;
        const locked = floorYStabilizer.lockedFloorY();
        const previousRaw = lastRawHitTestFloorY;
        const recover =
          locked != null &&
          shouldRecoverElevatedHitToLockedFloor({
            rawHitY,
            lockedFloorY: locked,
            previousRawHitY: previousRaw,
            lastTrustedPlaceableRawY,
            lastTrustedPlaceableAt,
            lastConfirmedPlacementFloorY,
            lastConfirmedPlacementAt,
            now,
            viewerY: effectiveViewerYForRing(),
            cameraAimedAtFloor: cameraAimedAtFloorNow(),
            elevatedRejectSince: elevatedRejectStreakStart,
          });

        if (locked != null) {
          targetPos.y = contactFloorY(locked);
        }
        liveHit = true;
        lastValidHitAt = now;
        if (floorScanComplete) {
          maybePromoteBootstrapFromHitTest(targetPos.y);
        }
        maybeRelockFromHitTest(targetPos.y);
        applyRingTarget(targetPos, targetRot, "hit-test");
        lastRawHitTestFloorY = rawHitY;

        if (recover) {
          ringElevatedRecoveries += 1;
          setRingPlaceable(true, null);
          lastRayReject = null;
          recordTrustedPlaceableFloor(contactFloorY(locked!), now);
          showRingAfterScan(true);
        } else {
          if (elevatedRejectStreakStart == null) {
            elevatedRejectStreakStart = now;
          }
          ringObjectRejects += 1;
          setRingPlaceable(false, "object-or-elevated");
          lastRayReject = "object-or-elevated";
          showRingAfterScan(false);
        }
        scheduleEmitFloorState();
        return;
      }
      liveHit = true;
      lastValidHitAt = now;
      if (floorScanComplete) {
        maybePromoteBootstrapFromHitTest(targetPos.y);
      }
      maybeRelockFromHitTest(targetPos.y);
      if (
        !floorScanComplete &&
        hitFramesWithResults < ANDROID_MIN_HIT_FRAMES_FOR_SCAN_RING
      ) {
        appendScanSampleFromRingHit(targetPos.y, "hit-test");
        if (tryCameraFloorRayFromXrFrame()) {
          scheduleEmitFloorState();
          return;
        }
      }
      applyRingTarget(targetPos, targetRot, "hit-test");
      lastRawHitTestFloorY = latestPose.valid ? latestPose.position.y : targetPos.y;
      if (floorScanComplete) {
        setRingPlaceable(true, null);
        lastRayReject = null;
        recordTrustedPlaceableFloor(
          lastRawHitTestFloorY ?? targetPos.y,
          now
        );
        showRingAfterScan(true);
      } else {
        updateFloorVisuals(true, ringPlaceable);
      }
      scheduleEmitFloorState();
    });
  };

  try {
    const hitTest = base.featuresManager.enableFeature(
      WebXRHitTest,
      "latest"
    ) as WebXRHitTest;
    hitTestAttached = hitTest.attached;
    hitTestMode = "viewer-default";
    bindHitTestResults(hitTest);

    try {
      {
        const planeDetector = base.featuresManager.enableFeature(
          WebXRPlaneDetector,
          "latest"
        ) as WebXRPlaneDetector;
        planeDetectorRef = planeDetector;
        planeDetector.onPlaneAddedObservable.add((plane) => tryHorizontalPlane(plane));
        planeDetector.onPlaneUpdatedObservable.add((plane) => tryHorizontalPlane(plane));
      }
    } catch {
      /* plane-detection optional */
    }

    base.sessionManager.onXRFrameObservable.add((xrFrame) => {
      xrFramesProcessed += 1;
      refreshViewerOrigin(xrFrame);
      const frame = xrFrame ?? base.sessionManager.currentFrame;
      if (frame) {
        const viewerPose = resolveViewerPoseFromFrame(frame, {
          referenceSpace: base.sessionManager.referenceSpace,
          baseReferenceSpace: base.sessionManager.baseReferenceSpace,
          viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
        });
        if (viewerPose) {
          const { origin, forward } = viewerRayFromXrPose(
            viewerPose,
            scene.useRightHandedSystem
          );
          if (!floorScanComplete && !floorScanSkipped) {
            collectCameraRayFloorSample(origin, forward);
            if (
              !latestPose.valid ||
              performance.now() - lastValidHitAt > 250
            ) {
              tryProvisionalScanRing(origin, forward);
            }
            tryAutoCompleteFloorScan();
          } else if (floorScanComplete && !floorScanSkipped) {
            if (!liveHit) {
              updateRingFromLockedFloor(origin, forward);
            }
          }
        }
      }
      updatePlacementAnchors(xrFrame);
      repinWorldFrozenPlacements();
      if (placed.length > 0) {
        updateDimensionHud();
      }
      if (xrFrame) {
        flushPendingAnchorBinds(xrFrame);
      }
      if (
        !liveHit &&
        !floorScanSkipped &&
        !floorScanComplete &&
        shouldUseBootstrapRingDuringScan()
      ) {
        tryCameraFloorRayFromXrFrame(xrFrame);
      }
    });

    signalHitTestReady(hitTestAttached);
    attachReferenceSpaceResetHandler();
    statusText =
      "Point phone at the floor and move slowly — cyan ring shows estimated floor height.";
    onStatus(statusText);
  } catch {
    signalHitTestReady(false);
    statusText =
      "Hit-test not available on this device. Try brighter light and a textured floor.";
    onStatus(statusText);
  }

  const createFloorObject = (
    type: PlacementObjectType,
    label: string
  ): PlacedEntry => {
    const root = new TransformNode(`placed-${markerCount}`, scene);
    placePlacedRootAtWorldPose(
      root,
      placementRoot,
      latestPose.position,
      latestPose.rotation
    );

    const meshes: AbstractMesh[] = [];
    const accent = new StandardMaterial(`accent-${markerCount}`, scene);
    accent.emissiveColor = new Color3(0.15, 0.75, 1);
    accent.alpha = 0.9;
    accent.disableLighting = true;

    const safety = new StandardMaterial(`safety-${markerCount}`, scene);
    safety.emissiveColor = new Color3(1, 0.35, 0.2);
    safety.alpha = 0.9;
    safety.disableLighting = true;

    if (type === "arrow") {
      const baseMesh = MeshBuilder.CreateCylinder(
        `base-${markerCount}`,
        { height: 0.004, diameter: 0.14 },
        scene
      );
      baseMesh.parent = root;
      baseMesh.material = accent;
      meshes.push(baseMesh);

      const shaft = MeshBuilder.CreateCylinder(
        `shaft-${markerCount}`,
        { height: 0.14, diameter: 0.035 },
        scene
      );
      shaft.parent = root;
      shaft.position.y = 0.07;
      shaft.material = accent;
      meshes.push(shaft);

      const head = MeshBuilder.CreateCylinder(
        `head-${markerCount}`,
        { height: 0.05, diameterTop: 0.01, diameterBottom: 0.07 },
        scene
      );
      head.parent = root;
      head.position.y = 0.16;
      head.material = accent;
      meshes.push(head);
    } else if (type === "zone") {
      const ring = MeshBuilder.CreateTorus(
        `zone-${markerCount}`,
        { diameter: 0.45, thickness: 0.02, tessellation: ANDROID_RETICLE_TORUS_TESSELATION },
        scene
      );
      ring.parent = root;
      ring.position.y = 0.01;
      ring.material = safety;
      meshes.push(ring);
    } else {
      const pad = MeshBuilder.CreateBox(
        `pad-${markerCount}`,
        { width: 0.35, height: 0.02, depth: 0.35 },
        scene
      );
      pad.parent = root;
      pad.position.y = 0.01;
      pad.material = accent;
      meshes.push(pad);
    }

    root.metadata = { label };
    return { root, meshes };
  };

  const sealSessionFloorPlacement = (
    entry: PlacedEntry,
    anchor: XRAnchor,
    frame: XRFrame,
    refSpace: XRReferenceSpace,
    worldPosition: Vector3,
    worldYaw: number
  ) => {
    const planeY = resolveSessionPlaneHeightM() ?? worldPosition.y;
    sessionFloorAnchor.binding = null;
    sessionFloorAnchor.lastRootPosition = null;
    sessionFloorAnchor.poseLocked = false;
    if (
      bindSessionFloorAnchor(
        sessionFloorAnchor,
        anchor,
        frame,
        refSpace,
        placementRoot,
        planeY,
        worldPosition,
        worldYaw,
        scene.useRightHandedSystem
      )
    ) {
      attachPlacedToFloorRoot(
        entry.root,
        placementRoot,
        worldPosition,
        horizontalQuaternion(worldYaw)
      );
      entry.sessionFloorAttached = true;
      entry.anchorBinding = null;
      entry.placementPoseLocked = true;
      if (ANDROID_PLACEMENT_WORLD_FREEZE_AFTER_BIND) {
        entry.root.computeWorldMatrix(true);
        const pinned = freezePlacedInWorld(entry.root);
        entry.worldFrozen = true;
        entry.pinnedWorldPosition = pinned.position;
        entry.pinnedWorldRotation = pinned.rotation;
        sessionFloorAnchor.binding = null;
        sessionFloorAnchor.poseLocked = false;
        preparePlacementRootForNewModel();
      }
      recordPlacementOrigin(entry);
      ensurePlacementFx(entry);
      return true;
    }
    attachPlacedToFloorRoot(
      entry.root,
      placementRoot,
      worldPosition,
      horizontalQuaternion(worldYaw)
    );
    entry.sessionFloorAttached = true;
    queueSessionFloorAnchorRebind(worldPosition);
    recordPlacementOrigin(entry);
    ensurePlacementFx(entry);
    return false;
  };

  const flushSessionFloorRebind = (frame: XRFrame) => {
    const refSpace = base.sessionManager.referenceSpace;
    if (!refSpace) return;

    if (pendingSessionFloorFinalizes.length) {
      const finalizeBatch = pendingSessionFloorFinalizes.splice(0);
      for (const pending of finalizeBatch) {
        const planeY = resolveSessionPlaneHeightM() ?? pending.worldPosition.y;
        if (
          bindSessionFloorAnchor(
            sessionFloorAnchor,
            pending.anchor,
            frame,
            refSpace,
            placementRoot,
            planeY,
            pending.worldPosition,
            pending.worldYaw,
            scene.useRightHandedSystem
          )
        ) {
          sessionAnchorLossStreak = 0;
          for (const entry of placed) {
            entry.root.computeWorldMatrix(true);
            const pos = entry.root.absolutePosition.clone();
            entry.placedAnchorOrigin = pos.clone();
            entry.placedAtWorldPosition = pos;
          }
        }
      }
    }

    if (!pendingSessionFloorRebind || !sessionFloorAnchor.lastRootPosition) return;
    pendingSessionFloorRebind = false;
    const worldPos = sessionFloorAnchor.lastRootPosition.clone();
    sessionFloorRebindAttempts += 1;
    createAnchorAtWorldPosition(
      frame,
      refSpace,
      worldPos,
      scene.useRightHandedSystem
    )
      .then((anchor) => {
        if (!anchor) {
          pendingSessionFloorRebind = true;
          return;
        }
        pendingSessionFloorFinalizes.push({
          anchor,
          worldPosition: worldPos,
          worldYaw: 0,
        });
      })
      .catch(() => {
        pendingSessionFloorRebind = true;
      });
  };

  const flushPendingAnchorBinds = (frame: XRFrame) => {
    flushSessionFloorRebind(frame);
    const refSpace = base.sessionManager.referenceSpace;
    if (!refSpace) return;

    if (pendingAnchorFinalizes.length) {
      const finalizeBatch = pendingAnchorFinalizes.splice(0);
      for (const pending of finalizeBatch) {
        if (ANDROID_VIRTUAL_FLOOR_LOCK) {
          if (
            sealSessionFloorPlacement(
              pending.entry,
              pending.anchor,
              frame,
              refSpace,
              pending.worldPosition,
              pending.worldYaw
            )
          ) {
            placementAnchorBindSuccess += 1;
          } else {
            freezePlacementFallback(pending.entry);
          }
          continue;
        }
        const binding = finalizePlacementAnchorBinding(
          pending.anchor,
          frame,
          refSpace,
          pending.worldPosition,
          pending.worldYaw,
          scene.useRightHandedSystem
        );
        if (binding) {
          sealPlacementAfterAnchor(pending.entry, binding, frame, refSpace);
          placementAnchorBindSuccess += 1;
        } else {
          freezePlacementFallback(pending.entry);
        }
      }
    }

    if (pendingAnchorBinds.length === 0) return;
    const batch = pendingAnchorBinds.splice(0, pendingAnchorBinds.length);
    for (const pending of batch) {
      placementAnchorBindAttempts += 1;
      const hit = pending.hit;
      const finalizeAnchor = (anchor: XRAnchor | null) => {
        if (!anchor) {
          freezePlacementFallback(pending.entry);
          return;
        }
        pendingAnchorFinalizes.push({
          entry: pending.entry,
          anchor,
          worldPosition: pending.worldPosition,
          worldYaw: pending.worldYaw,
        });
      };
      if (hit != null && typeof hit.createAnchor === "function") {
        try {
          const anchorPromise = hit.createAnchor(new XRRigidTransform());
          if (!anchorPromise) {
            createAnchorAtWorldPosition(
              frame,
              refSpace,
              pending.worldPosition,
              scene.useRightHandedSystem
            )
              .then(finalizeAnchor)
              .catch(() => freezePlacementFallback(pending.entry));
            continue;
          }
          anchorPromise
            .then(finalizeAnchor)
            .catch(() => {
              createAnchorAtWorldPosition(
                frame,
                refSpace,
                pending.worldPosition,
                scene.useRightHandedSystem
              )
                .then(finalizeAnchor)
                .catch(() => freezePlacementFallback(pending.entry));
            });
        } catch {
          createAnchorAtWorldPosition(
            frame,
            refSpace,
            pending.worldPosition,
            scene.useRightHandedSystem
          )
            .then(finalizeAnchor)
            .catch(() => freezePlacementFallback(pending.entry));
        }
        continue;
      }
      createAnchorAtWorldPosition(
        frame,
        refSpace,
        pending.worldPosition,
        scene.useRightHandedSystem
      )
        .then(finalizeAnchor)
        .catch(() => freezePlacementFallback(pending.entry));
    }
  };

  const bindPlacementAnchor = (
    entry: PlacedEntry,
    hit: XRHitTestResult | null | undefined
  ): boolean => queuePlacementAnchorBind(entry, hit);

  const repinWorldFrozenPlacements = () => {
    if (ANDROID_VIRTUAL_FLOOR_LOCK && !ANDROID_PLACEMENT_WORLD_FREEZE_AFTER_BIND) {
      return;
    }
    for (const entry of placed) {
      if (entry.anchorBinding) continue;
      if (
        !entry.worldFrozen ||
        !entry.pinnedWorldPosition ||
        !entry.pinnedWorldRotation
      ) {
        continue;
      }
      if (
        repinWorldFrozenNode(
          entry.root,
          entry.pinnedWorldPosition,
          entry.pinnedWorldRotation
        )
      ) {
        worldRepinCorrections += 1;
      }
    }
  };

  const enforceSessionPlacedScale = () => {
    const pr = placementRoot.scaling;
    if (
      Math.abs(pr.x - 1) > 0.001 ||
      Math.abs(pr.y - 1) > 0.001 ||
      Math.abs(pr.z - 1) > 0.001
    ) {
      placementRoot.scaling.setAll(1);
    }
    for (const entry of placed) {
      const expected = entry.arScaleVector ?? {
        x: entry.arScaleFactor ?? 1,
        y: entry.arScaleFactor ?? 1,
        z: entry.arScaleFactor ?? 1,
      };
      const s = entry.root.scaling;
      if (
        Math.abs(s.x - expected.x) > 0.001 ||
        Math.abs(s.y - expected.y) > 0.001 ||
        Math.abs(s.z - expected.z) > 0.001
      ) {
        entry.root.scaling.set(expected.x, expected.y, expected.z);
        placedScaleCorrections += 1;
      }
    }
  };

  const refreshPlacedLiveMetrics = () => {
    if (placed.length === 0) {
      placedLiveMaxDimensionM = null;
      return;
    }
    const entry = placed[placed.length - 1]!;
    if (entry.frozenMaxDimensionM != null) {
      placedLiveMaxDimensionM = entry.frozenMaxDimensionM;
      return;
    }
    const frozen = entry.placementFx?.dimensions;
    if (frozen) {
      placedLiveMaxDimensionM = Math.max(frozen.widthM, frozen.depthM, frozen.heightM);
      entry.frozenMaxDimensionM = placedLiveMaxDimensionM;
      return;
    }
    placedLiveMaxDimensionM = null;
  };

  const updateSessionFloorRoot = (xrFrame?: XRFrame) => {
    if (!ANDROID_VIRTUAL_FLOOR_LOCK || placed.length === 0) return;
    if (
      ANDROID_PLACEMENT_WORLD_FREEZE_AFTER_BIND &&
      placed.every((entry) => entry.worldFrozen)
    ) {
      return;
    }
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    const refSpace = base.sessionManager.referenceSpace;
    const planeY = resolveSessionPlaneHeightM();
    if (!frame || !refSpace || planeY == null || !sessionFloorAnchor.binding) return;

    const walkSincePlacement =
      cameraPathAtFirstPlacement != null
        ? cameraPathM - cameraPathAtFirstPlacement
        : 0;

    if (sessionFloorAnchor.lastRootPosition) {
      const anchorTarget = resolveAnchorWorldPosition(
        sessionFloorAnchor.binding,
        frame,
        refSpace,
        scene.useRightHandedSystem
      );
      if (anchorTarget) {
        const held = sessionFloorAnchor.lastRootPosition;
        const anchorDriftM = Math.hypot(
          anchorTarget.position.x - held.x,
          anchorTarget.position.z - held.z
        );
        if (anchorDriftM > sessionFloorMaxAnchorDriftM) {
          sessionFloorMaxAnchorDriftM = anchorDriftM;
        }
      }
    }

    const outcome = updateSessionFloorRootFromAnchor(
      sessionFloorAnchor,
      frame,
      refSpace,
      placementRoot,
      planeY,
      scene.useRightHandedSystem,
      viewerHorizontalRelocalJumpM,
      walkSincePlacement,
      pendingSessionFloorResync
    );
    if (pendingSessionFloorResync) {
      pendingSessionFloorResyncFrames += 1;
      if (outcome.resynced || outcome.result === "applied" || outcome.result === "rejected") {
        pendingSessionFloorResync = false;
      } else if (pendingSessionFloorResyncFrames > 30) {
        pendingSessionFloorResync = false;
      }
    }
    switch (outcome.result) {
      case "applied":
        sessionAnchorLossStreak = 0;
        sessionFloorRootUpdates += 1;
        placementAnchorUpdates += 1;
        if (outcome.softDrift) sessionFloorSoftDriftCorrections += 1;
        if (
          outcome.anchorDriftM != null &&
          outcome.anchorDriftM > sessionFloorMaxAnchorDriftM
        ) {
          sessionFloorMaxAnchorDriftM = outcome.anchorDriftM;
        }
        if (outcome.resynced) placementRelocalResyncs += 1;
        for (const entry of placed) {
          recordPlacementResync(entry);
        }
        break;
      case "rejected":
        sessionAnchorLossStreak = 0;
        sessionFloorRootJumpRejects += 1;
        placementAnchorJumpRejects += 1;
        break;
      case "lost":
        sessionAnchorLossStreak += 1;
        placementAnchorTrackingLosses += 1;
        break;
      default:
        sessionAnchorLossStreak = 0;
        if (outcome.requestRebind) {
          pendingSessionFloorRebind = true;
          pendingSessionFloorResync = false;
          if (
            outcome.anchorDriftM != null &&
            outcome.anchorDriftM > sessionFloorMaxAnchorDriftM
          ) {
            sessionFloorMaxAnchorDriftM = outcome.anchorDriftM;
          }
        }
        break;
    }
    refreshPlacedLiveMetrics();
  };

  const syncWorldFrozenPlacementAnchors = (xrFrame?: XRFrame) => {
    if (!ANDROID_USE_PLACEMENT_ANCHORS) return;
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    const refSpace = base.sessionManager.referenceSpace;
    if (!frame || !refSpace) return;
    for (const entry of placed) {
      if (!entry.worldFrozen || !entry.anchorBinding) continue;
      if (!entry.pinnedWorldPosition || !entry.pinnedWorldRotation) continue;
      const outcome = syncWorldFrozenAnchorXZ(
        entry.anchorBinding,
        frame,
        refSpace,
        scene.useRightHandedSystem,
        entry.pinnedWorldPosition,
        entry.pinnedWorldRotation,
        entry.root,
        ANCHOR_MAX_SINGLE_FRAME_JUMP_M
      );
      switch (outcome) {
        case "applied":
          placementAnchorUpdates += 1;
          recordPlacementResync(entry);
          break;
        case "rejected":
          placementAnchorJumpRejects += 1;
          break;
        case "lost":
          placementAnchorTrackingLosses += 1;
          break;
        default:
          break;
      }
    }
  };

  const updatePlacementAnchors = (xrFrame?: XRFrame) => {
    if (ANDROID_VIRTUAL_FLOOR_LOCK) {
      syncWorldFrozenPlacementAnchors(xrFrame);
      updateSessionFloorRoot(xrFrame);
      if (placed.length > 0) {
        enforceSessionPlacedScale();
        refreshPlacedLiveMetrics();
      }
      return;
    }
    if (!ANDROID_USE_PLACEMENT_ANCHORS) return;
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    const refSpace = base.sessionManager.referenceSpace;
    if (!frame || !refSpace) return;
    const jumpM = viewerRelocalJumpM;
    for (const entry of placed) {
      if (entry.worldFrozen) continue;
      if (!entry.anchorBinding || !entry.root.rotationQuaternion) continue;

      if (ANDROID_PLACEMENT_ANCHOR_LOCK) {
        const lockState = {
          poseLocked: entry.placementPoseLocked === true,
          lastApplied: entry.lastAnchorPosition ?? null,
        };
        const outcome = applyLockedPlacementAnchor(
          entry.anchorBinding,
          frame,
          refSpace,
          scene.useRightHandedSystem,
          entry.root,
          lockState,
          jumpM,
          { maxSingleFrameJumpM: ANCHOR_MAX_SINGLE_FRAME_JUMP_M }
        );
        switch (outcome.result) {
          case "applied":
          case "unchanged":
            entry.anchorMissStreak = 0;
            entry.placementPoseLocked = outcome.poseLocked;
            if (outcome.position) entry.lastAnchorPosition = outcome.position;
            recordAnchorPose(entry);
            if (outcome.result === "applied") placementAnchorUpdates += 1;
            if (outcome.resynced) {
              placementRelocalResyncs += 1;
              recordPlacementResync(entry);
            }
            break;
          case "rejected":
            placementAnchorJumpRejects += 1;
            entry.anchorMissStreak = 0;
            break;
          case "lost":
            placementAnchorTrackingLosses += 1;
            entry.anchorMissStreak = (entry.anchorMissStreak ?? 0) + 1;
            if (entry.anchorMissStreak >= ANCHOR_TRACKING_LOSS_FREEZE_FRAMES) {
              freezePlacementFromLastAnchor(entry);
            }
            break;
        }
        continue;
      }

      if (ANDROID_ANCHOR_SINGLE_SHOT) return;

      const outcome = applyPlacementAnchorBinding(
        entry.anchorBinding,
        frame,
        refSpace,
        scene.useRightHandedSystem,
        entry.root,
        {
          minUpdateDeltaM: ANCHOR_MIN_UPDATE_DELTA_M,
          maxSingleFrameJumpM: ANCHOR_MAX_SINGLE_FRAME_JUMP_M,
          lastApplied: entry.lastAnchorPosition ?? null,
        }
      );
      switch (outcome.result) {
        case "applied":
          entry.anchorMissStreak = 0;
          if (outcome.position) entry.lastAnchorPosition = outcome.position;
          recordAnchorPose(entry);
          placementAnchorUpdates += 1;
          if (
            entry.placedAtWorldPosition &&
            Math.hypot(
              outcome.position!.x - entry.placedAtWorldPosition.x,
              outcome.position!.z - entry.placedAtWorldPosition.z
            ) > ANCHOR_MAX_SINGLE_FRAME_JUMP_M
          ) {
            freezePlacementFromLastAnchor(entry);
          }
          break;
        case "unchanged":
          entry.anchorMissStreak = 0;
          break;
        case "rejected":
          placementAnchorJumpRejects += 1;
          entry.anchorMissStreak = 0;
          if (entry.lastAnchorPosition && entry.lastAnchorRotation) {
            entry.root.unfreezeWorldMatrix();
            entry.root.setAbsolutePosition(entry.lastAnchorPosition);
            entry.root.rotationQuaternion.copyFrom(entry.lastAnchorRotation);
          }
          break;
        case "lost":
          placementAnchorTrackingLosses += 1;
          entry.anchorMissStreak = (entry.anchorMissStreak ?? 0) + 1;
          if (entry.anchorMissStreak >= ANCHOR_TRACKING_LOSS_FREEZE_FRAMES) {
            freezePlacementFromLastAnchor(entry);
          }
          break;
      }
    }
  };

  const clearPlaced = () => {
    placeGeneration += 1;
    dimensionHudState = null;
    for (const p of placed) {
      p.placementFx?.dispose();
      p.placementFx = null;
      for (const m of p.meshes) m.dispose();
      p.root.dispose();
    }
    placed.length = 0;
  };

  const snapWrapperBaseToFloor = (
    wrapper: TransformNode,
    floorY: number,
    modelMeshes?: AbstractMesh[]
  ): number => snapPlacementBaseToFloor(wrapper, floorY, modelMeshes);

  const materialsForNode = (root: TransformNode): Material[] =>
    collectMaterialsFromRoots([root]);

  const geometryMeshesFor = (root: TransformNode): AbstractMesh[] =>
    collectGeometryMeshes(root).filter((mesh) => !mesh.name.startsWith("blob-"));

  const tuneMaterialForAR = (mat: Material, types: string[]): void => {
    types.push(mat.getClassName());
    const sceneHasEnvironment = Boolean(scene.environmentTexture);
    if (mat instanceof PBRMaterial) {
      tunePbrMaterialForAR(mat, { lightEstimationActive, sceneHasEnvironment });
    } else if (mat instanceof StandardMaterial) {
      mat.disableLighting = false;
      mat.specularColor = mat.specularColor.scale(0.35);
    } else {
      const generic = mat as Material & {
        unlit?: boolean;
        disableLighting?: boolean;
      };
      if (typeof generic.unlit === "boolean") generic.unlit = false;
      if (typeof generic.disableLighting === "boolean") generic.disableLighting = false;
      mat.markDirty();
    }
  };

  const prepareMeshesForAR = (
    wrapper: TransformNode
  ): { types: string[]; geometryCount: number } => {
    const types: string[] = [];
    const modelMeshes = geometryMeshesFor(wrapper);
    for (const mesh of modelMeshes) {
      mesh.isVisible = true;
      mesh.setEnabled(true);
      mesh.isPickable = false;
      mesh.receiveShadows = false;
      mesh.renderingGroupId = PLACED_CONTENT_RENDERING_GROUP;
      mesh.alwaysSelectAsActiveMesh = true;
    }
    wrapper.computeWorldMatrix(true);
    for (const mat of materialsForNode(wrapper)) {
      tuneMaterialForAR(mat, types);
    }
    return {
      types,
      geometryCount: modelMeshes.length,
    };
  };

  const finalizePlacement = (
    wrapper: TransformNode,
    floorY: number,
    _footprintM = 1.2,
    modelMeshes?: AbstractMesh[]
  ): {
    floorSnapM: number;
    materialTypes: string;
    pbrDiagnostics: PbrMaterialDiagnostics;
  } => {
    const floorSnapM = snapWrapperBaseToFloor(wrapper, floorY, modelMeshes);
    prepareMeshesForAR(wrapper);
    const pbrDiagnostics = scanPbrMaterials(wrapper, materialsForNode);
    return {
      floorSnapM,
      materialTypes: pbrDiagnostics.materialTypes,
      pbrDiagnostics,
    };
  };

  const freezePlacementFromLastAnchor = (entry: PlacedEntry) => {
    if (entry.worldFrozen) return;
    entry.root.unfreezeWorldMatrix();
    if (entry.lastAnchorPosition) {
      entry.root.setAbsolutePosition(entry.lastAnchorPosition);
    }
    if (entry.lastAnchorRotation && entry.root.rotationQuaternion) {
      entry.root.rotationQuaternion.copyFrom(entry.lastAnchorRotation);
    }
    entry.root.computeWorldMatrix(true);
    const pinned = freezePlacedInWorld(entry.root);
    entry.worldFrozen = true;
    entry.pinnedWorldPosition = pinned.position;
    entry.pinnedWorldRotation = pinned.rotation;
    entry.anchorBinding = null;
    entry.anchorMissStreak = 0;
    placementAnchorFrozenOnLoss += 1;
    recordPlacementOrigin(entry);
  };

  const queueSessionFloorAnchorRebind = (worldPosition: Vector3) => {
    if (!ANDROID_VIRTUAL_FLOOR_LOCK || sessionFloorAnchor.binding) return;
    const planeY = resolveSessionPlaneHeightM();
    const rootPos = worldPosition.clone();
    if (planeY != null) rootPos.y = planeY;
    sessionFloorAnchor.lastRootPosition = rootPos.clone();
    placementRoot.unfreezeWorldMatrix();
    placementRoot.setAbsolutePosition(rootPos);
    placementRoot.rotationQuaternion = Quaternion.Identity();
    placementRoot.computeWorldMatrix(true);
    pendingSessionFloorRebind = true;
  };

  const freezePlacementFallback = (entry: PlacedEntry) => {
    if (entry.worldFrozen || entry.sessionFloorAttached) return;
    if (ANDROID_VIRTUAL_FLOOR_LOCK) {
      entry.root.computeWorldMatrix(true);
      const worldPos = entry.root.absolutePosition.clone();
      const worldRot = entry.root.absoluteRotationQuaternion.clone();
      queueSessionFloorAnchorRebind(worldPos);
      attachPlacedToFloorRoot(entry.root, placementRoot, worldPos, worldRot);
      entry.sessionFloorAttached = true;
      recordPlacementOrigin(entry);
      ensurePlacementFx(entry);
      return;
    }
    const pinned = freezePlacedInWorld(entry.root);
    entry.worldFrozen = true;
    entry.pinnedWorldPosition = pinned.position;
    entry.pinnedWorldRotation = pinned.rotation;
    entry.anchorBinding = null;
    recordPlacementOrigin(entry);
  };

  const recordPlacementOrigin = (entry: PlacedEntry) => {
    entry.root.computeWorldMatrix(true);
    const pos = entry.root.absolutePosition.clone();
    if (!entry.placedAnchorOrigin) {
      entry.placedAnchorOrigin = pos.clone();
      sessionFloorLockFrozen = true;
      if (cameraPathAtFirstPlacement == null) {
        cameraPathAtFirstPlacement = cameraPathM;
      }
    }
    entry.placedAtWorldPosition = pos;
    const locked = floorYStabilizer.lockedFloorY();
    recordConfirmedPlacementFloor(
      locked != null ? contactFloorY(locked) : pos.y,
      performance.now()
    );
  };

  const recordPlacementResync = (entry: PlacedEntry) => {
    entry.root.computeWorldMatrix(true);
    entry.placedAtWorldPosition = entry.root.absolutePosition.clone();
  };

  const recordAnchorPose = (entry: PlacedEntry) => {
    entry.root.computeWorldMatrix(true);
    entry.lastAnchorPosition = entry.root.absolutePosition.clone();
    entry.lastAnchorRotation = entry.root.absoluteRotationQuaternion.clone();
  };

  const sealPlacementAfterAnchor = (
    entry: PlacedEntry,
    binding: PlacementAnchorBinding,
    frame: XRFrame,
    refSpace: XRReferenceSpace
  ) => {
    applyPlacementAnchorBinding(
      binding,
      frame,
      refSpace,
      scene.useRightHandedSystem,
      entry.root,
      { minUpdateDeltaM: 0 }
    );
    recordAnchorPose(entry);
    recordPlacementOrigin(entry);
    unfreezePlacedForAnchor(entry.root);
    entry.anchorBinding = binding;
    entry.worldFrozen = false;
    entry.pinnedWorldPosition = undefined;
    entry.pinnedWorldRotation = undefined;
    if (ANDROID_PLACEMENT_ANCHOR_LOCK || !ANDROID_ANCHOR_SINGLE_SHOT) {
      entry.placementPoseLocked = true;
      return;
    }
    const pinned = freezePlacedInWorld(entry.root);
    entry.worldFrozen = true;
    entry.pinnedWorldPosition = pinned.position;
    entry.pinnedWorldRotation = pinned.rotation;
    entry.anchorBinding = null;
  };

  const finalizePlacedEntry = (
    entry: PlacedEntry,
    floorY: number,
    footprintM = 1.2
  ) => {
    const result = finalizePlacement(entry.root, floorY, footprintM, entry.meshes);
    const resolved = resolveModelPlacementBounds(entry.root, entry.meshes);
    if (resolved) {
      const b = resolved.bounds;
      pinFrozenMaxDimension(
        entry,
        Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)
      );
    }
    if (ANDROID_FREEZE_WORLD_ON_PLACEMENT && !ANDROID_USE_PLACEMENT_ANCHORS) {
      const pinned = freezePlacedInWorld(entry.root);
      entry.worldFrozen = true;
      entry.pinnedWorldPosition = pinned.position;
      entry.pinnedWorldRotation = pinned.rotation;
    }
    return result;
  };

  engine.runRenderLoop(() => {
    scene.render();
  });

  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  document.body.classList.add("xr-session-active");

  return {
    placeAtReticle: (label: string, objectType: PlacementObjectType = "arrow") => {
      const pose = getPlacementPose();
      if (!pose.ok) {
        statusText = "No floor detected. Scan the floor slowly, then try again.";
        return false;
      }
      clearPlaced();
      preparePlacementRootForNewModel();
      markerCount += 1;
      placed.push(createFloorObject(objectType, label));
      const entry = placed[placed.length - 1]!;
      entry.root.computeWorldMatrix(true);
      const b = entry.root.getHierarchyBoundingVectors(true);
      const fp = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 0.35);
      finalizePlacedEntry(entry, pose.floorY, fp);
      const anchored = bindPlacementAnchor(entry, lastXrHitResult);
      if (!anchored) freezePlacementFallback(entry);
      statusText = `Placed: ${label}`;
      return true;
    },
    placeCustomModelAtReticle: async (options: PlaceModelOptions) => {
      const baseDiag = (): PlacementDiagnostics => ({
        loadMethod: "none",
        meshCount: 0,
        transformNodeCount: 0,
        topLevelRoots: 0,
        position: {
          x: latestPose.position.x,
          y: latestPose.position.y,
          z: latestPose.position.z,
        },
        meshesVisible: 0,
        modelUrl: options.modelUrl ?? undefined,
      });

      const pose = getPlacementPose();
      if (!pose.ok) {
        statusText = !ringPlaceable && latestPose.valid
          ? ringSurfaceReject === "object-or-elevated"
            ? "Red ring — aim at empty floor, not furniture or tables."
            : ringSurfaceReject === "wall-or-steep"
              ? "Red ring — aim at empty floor, not a wall."
              : "Red ring — move to an empty floor spot before placing."
          : floorScanComplete
            ? "No floor detected. Point at the floor to restore placement."
            : "No floor detected. Point at the floor until the cyan marker appears.";
        return {
          ok: false,
          diagnostics: {
            ...baseDiag(),
            reticleVisibleAtPlace: reticle.isVisible,
            poseAgeMs: pose.poseAgeMs,
            floorNormalY: pose.normalY,
          },
          error: statusText,
        };
      }

      clearPlaced();
      preparePlacementRootForNewModel();
      const placeGen = placeGeneration;
      markerCount += 1;
      const floorY = pose.floorY;
      const placementFloorMeta = {
        hitTestFloorY: floorY,
        rawHitTestFloorY: pose.rawFloorY,
        lockedFloorY: pose.lockedFloorY,
        floorYUsedLocked: pose.floorYUsedLocked ?? false,
        floorYClamped: pose.floorYUsedLocked ?? false,
      };
      const placementWorldPos = latestPose.position.clone();
      placementWorldPos.y = floorY;

      const buildDiag = (
        loadMethod: string,
        wrapper: TransformNode,
        meshes: AbstractMesh[],
        transformNodeCount: number,
        topLevelRoots: number,
        extra: Partial<PlacementDiagnostics> = {}
      ): PlacementDiagnostics => {
        const modelResolved = resolveModelPlacementBounds(wrapper, meshes);
        const geoBounds = modelResolved?.bounds ?? geometryWorldBounds(wrapper);
        const hierarchyBounds = wrapper.getHierarchyBoundingVectors(true);
        const sizeSource = modelResolved
          ? {
              min: new Vector3(
                modelResolved.bounds.min.x,
                modelResolved.bounds.min.y,
                modelResolved.bounds.min.z
              ),
              max: new Vector3(
                modelResolved.bounds.max.x,
                modelResolved.bounds.max.y,
                modelResolved.bounds.max.z
              ),
            }
          : geoBounds
            ? {
                min: new Vector3(geoBounds.min.x, geoBounds.min.y, geoBounds.min.z),
                max: new Vector3(geoBounds.max.x, geoBounds.max.y, geoBounds.max.z),
              }
            : hierarchyBounds;
        const size = sizeSource.max.subtract(sizeSource.min);
        const contactY =
          geoBounds?.min.y ??
          placementFloorContactY(wrapper, meshes);
        const floorContact = floorContactDiagnostics(wrapper, meshes);
        const contactVertexMinY = floorContact.vertexMinY;
        const primaryMeshMinY = floorContact.primaryMeshMinY;
        const bboxPaddingBelowMeshM =
          floorContact.unionBboxMinY !== null
            ? Math.round((floorContact.unionBboxMinY - floorContact.contactY) * 1000) / 1000
            : undefined;
        return {
          loadMethod,
          meshCount: meshes.length,
          transformNodeCount,
          topLevelRoots,
          position: {
            x: wrapper.absolutePosition.x,
            y: wrapper.absolutePosition.y,
            z: wrapper.absolutePosition.z,
          },
          localPosition: {
            x: wrapper.position.x,
            y: wrapper.position.y,
            z: wrapper.position.z,
          },
          boundsMin: {
            x: hierarchyBounds.min.x,
            y: hierarchyBounds.min.y,
            z: hierarchyBounds.min.z,
          },
          boundsMax: {
            x: hierarchyBounds.max.x,
            y: hierarchyBounds.max.y,
            z: hierarchyBounds.max.z,
          },
          geometryMin: geoBounds?.min ?? {
            x: hierarchyBounds.min.x,
            y: contactY,
            z: hierarchyBounds.min.z,
          },
          geometryMax: geoBounds?.max ?? {
            x: hierarchyBounds.max.x,
            y: hierarchyBounds.max.y,
            z: hierarchyBounds.max.z,
          },
          contactVertexMinY: contactVertexMinY ?? undefined,
          primaryMeshMinY: primaryMeshMinY ?? undefined,
          snapContactY: floorContact.contactY,
          floorContactSource: floorContact.source,
          bboxPaddingBelowMeshM,
          sizeMeters: { x: size.x, y: size.y, z: size.z },
          maxDimensionM: Math.max(size.x, size.y, size.z),
          meshesVisible: meshes.filter((m) => m.isVisible && m.isEnabled()).length,
          modelUrl: options.modelUrl ?? undefined,
          reticleVisibleAtPlace: reticle.isVisible,
          poseAgeMs: pose.poseAgeMs,
          floorNormalY: pose.normalY,
          ...extra,
        };
      };

      if (options.builtinType) {
        const entry = createFloorObject(options.builtinType, options.label);
        const { floorSnapM, materialTypes, pbrDiagnostics } = finalizePlacedEntry(
          entry,
          floorY,
          0.4
        );
        placed.push(entry);
        ensurePlacementFx(entry);
        const anchored = bindPlacementAnchor(entry, lastXrHitResult);
        if (!anchored) freezePlacementFallback(entry);
        statusText = `Placed: ${options.label}`;
        return {
          ok: true,
          diagnostics: buildDiag("builtin", entry.root, entry.meshes, 0, 1, {
            ...placementFloorMeta,
            floorSnapM,
            ...placementFxDiagnostics(entry),
            materialTypes,
            pbrDiagnostics,
            placementAnchorActive: anchored,
          }),
        };
      }

      if (!options.modelUrl) {
        statusText = "Model file missing.";
        return { ok: false, diagnostics: baseDiag(), error: statusText };
      }

      try {
        const wrapper = new TransformNode(`placed-${markerCount}`, scene);
        placePlacedRootAtWorldPose(
          wrapper,
          placementRoot,
          placementWorldPos,
          latestPose.rotation
        );
        wrapper.scaling.setAll(1);

        await ensureGlbReadyForPlacement(options.modelUrl, 45000);
        const loaded = placeGlbFromSceneCache(wrapper, options.modelUrl, markerCount);
        if (placeGen !== placeGeneration) {
          wrapper.dispose();
          return {
            ok: false,
            diagnostics: baseDiag(),
            error: "Cancelled — another model was selected",
          };
        }
        const { meshes, loadMethod, transformNodeCount, topLevelRoots, fetchBytes, footprintM } =
          loaded;

        const scaleApplied = resolveAndApplyRealWorldScale(
          wrapper,
          options.modelId,
          meshes,
          options.realWorld
        );
        const effectiveFootprintM = footprintM * (scaleApplied?.factor ?? 1);

        const entry: PlacedEntry = {
          root: wrapper,
          meshes,
          arScaleFactor: scaleApplied?.factor ?? 1,
          arScaleVector: scaleApplied?.scale,
        };
        placed.push(entry);
        const { floorSnapM, materialTypes, pbrDiagnostics } = finalizePlacedEntry(
          entry,
          floorY,
          effectiveFootprintM
        );
        ensurePlacementFx(entry);
        const anchored = bindPlacementAnchor(entry, lastXrHitResult);
        if (!anchored) freezePlacementFallback(entry);
        const diag = buildDiag(loadMethod, wrapper, meshes, transformNodeCount, topLevelRoots, {
          ...placementFloorMeta,
          materialTypes,
          pbrDiagnostics,
          fetchBytes,
          floorSnapM,
          modelId: options.modelId,
          arScaleFactor: scaleApplied?.factor,
          arScaleReason: scaleApplied?.reason,
          ...placementFxDiagnostics(entry),
          placementAnchorActive: anchored,
        });
        statusText = `Placed: ${options.label}`;
        if (diag.maxDimensionM !== undefined && diag.maxDimensionM < 0.01) {
          statusText += " (very small — check export scale in meters)";
        } else if (diag.maxDimensionM !== undefined && diag.maxDimensionM > 50) {
          statusText += " (very large — check export units)";
        }
        return { ok: true, diagnostics: diag };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        statusText = `Could not load model: ${msg}`;
        return {
          ok: false,
          diagnostics: baseDiag(),
          error: statusText,
        };
      }
    },
    clearPlacedObjects: clearPlaced,
    cancelPlacement: () => {
      placeGeneration += 1;
    },
    warmupModels: async (urls) => {
      const result = await parseGlbsSequential(urls, {
        timeoutMs: 45000,
        onProgress: (current, total, url) => {
          const name = url.split("/").pop()?.replace(/\.glb$/i, "") ?? "model";
          onStatus(`Preparing model ${current}/${total}: ${name}…`);
        },
      });
      for (const url of result.warmed) {
        try {
          await ensureArContainer(url, 45000);
        } catch {
          /* tap-to-place will retry ensureArContainer */
        }
      }
      return result;
    },
    getWarmupResult: () => getOfflineParseResult(),
    isReticleVisible: () => emitFloorState().reticleVisible,
    getFloorDetectionState: () => emitFloorState(),
    onFloorStateChange: (listener: (state: FloorDetectionState) => void) => {
      floorStateListeners.add(listener);
      listener(emitFloorState());
      return () => floorStateListeners.delete(listener);
    },
    getStatusText: () => statusText,
    whenHitTestReady: async (timeoutMs = 8000) => {
      if (hitTestReady) return hitTestEnabled;
      return Promise.race([
        hitTestReadyPromise,
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(hitTestEnabled), timeoutMs);
        }),
      ]);
    },
    waitForFloorReticle: (timeoutMs = 20000) =>
      waitUntilFloorReady(
        () => ({ ready: emitFloorState().hitReady }),
        (listener) => {
          const wrapper = (state: FloorDetectionState) =>
            listener({ ready: state.hitReady });
          floorStateListeners.add(wrapper);
          return () => floorStateListeners.delete(wrapper);
        },
        timeoutMs
      ),
    waitForFloorScanComplete: async (options = {}) => {
      const minMs = options.minMs ?? 800;
      const timeoutMs = options.timeoutMs ?? 20000;
      const t0 = performance.now();

      return new Promise((resolve) => {
        let settled = false;
        let pollTimer: ReturnType<typeof setInterval> | undefined;
        let unsub: () => void = () => {};

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          if (pollTimer !== undefined) clearInterval(pollTimer);
          unsub();
          if (ok && !floorScanComplete) {
            if (!completeFloorScanInternal(false)) {
              forceCompleteFloorScanAtTimeout();
            }
          }
          const scanOk =
            ok && floorScanComplete && floorYStabilizer.lockedFloorY() != null;
          resolve({
            ok: scanOk,
            waitedMs: Math.round(performance.now() - t0),
            lockedFloorY: floorYStabilizer.lockedFloorY(),
          });
        };

        const tick = (): boolean => {
          const elapsed = performance.now() - t0;
          const state = emitFloorStateInternal();
          const hitsSufficient =
            hitFramesWithResults >= ANDROID_MIN_HIT_TEST_FRAMES_FOR_SCAN;
          if (
            elapsed >= minMs &&
            canCompleteFloorScanAndroid() &&
            (state.hitReady || hitsSufficient)
          ) {
            finish(true);
            return true;
          }
          if (elapsed >= timeoutMs) {
            if (canCompleteFloorScanAndroid()) {
              finish(true);
              return true;
            }
            if (forceCompleteFloorScanAtTimeout()) {
              finish(true);
              return true;
            }
            finish(false);
            return true;
          }
          return false;
        };

        if (tick()) return;

        const listener = () => {
          tick();
        };
        floorStateListeners.add(listener);
        unsub = () => floorStateListeners.delete(listener);

        // setInterval — window rAF often stalls during immersive WebXR on Android Chrome.
        pollTimer = setInterval(() => {
          tick();
        }, 50);
      });
    },
    completeFloorScan: () => completeFloorScanInternal(false),
    forceCompleteFloorScanAtTimeout: () => forceCompleteFloorScanAtTimeout(),
    bootstrapFloorScanFromViewer: (): boolean => bootstrapFloorScanFromViewerInternal(),
    isFloorScanComplete: () => floorScanComplete,
    canCompleteFloorScan: () => canCompleteFloorScanAndroid(),
    getHitTestStats: (): HitTestStats => {
      const state = emitFloorStateInternal();
      const pathSinceLastStats = Math.round(cameraPathSinceLastStatsM * 1000) / 1000;
      cameraPathSinceLastStatsM = 0;
      const verticalRangeM =
        cameraOriginYMin != null && cameraOriginYMax != null
          ? Math.round((cameraOriginYMax - cameraOriginYMin) * 1000) / 1000
          : null;
      return {
        hitTestEnabled,
        hitTestAttached,
        framesWithResults: hitFramesWithResults,
        framesEmpty: hitFramesEmpty,
        cameraRayHits,
        planeHits,
        lastHitAtMs: lastValidHitAt || null,
        floorReady: state.ready,
        hitReady: state.hitReady,
        reticleVisible: state.reticleVisible,
        floorScanComplete: floorScanComplete,
        floorScanBootstrapOnly: floorScanLockedFromBootstrapOnly,
        floorSkipped: floorScanSkipped,
        hitTestMode,
        xrFramesProcessed,
        lastOriginY,
        lastForwardY,
        lastRayReject,
        ringPoseSource,
        planeRingUpdatesSkipped,
        ringLargeJumps,
        ringRelocalizationRejects,
        ringWallRejects,
        ringObjectRejects,
        ringElevatedRecoveries,
        ringPlaceable,
        placementAnchorBindAttempts,
        placementAnchorBindSuccess,
        placementAnchorTrackingLosses,
        placementAnchorJumpRejects,
        placementAnchorFrozenOnLoss,
        lockedFloorY: floorYStabilizer.lockedFloorY(),
        floorYUsedLockCount: floorYStabilizer.usedLockCount,
        floorLockLocalOverrides: floorYStabilizer.localOverrideCount,
        floorHitBootstrapCount,
        lastRawHitTestFloorY,
        floorScanSamples: floorYStabilizer.sampleCount(),
        floorScanValidSamples: floorYStabilizer.validSampleCount(lastOriginY),
        placementAnchorUpdates,
        placementRelocalResyncs,
        sessionFloorRootUpdates,
        sessionFloorRootJumpRejects,
        sessionFloorRebindAttempts,
        floorRelockPromotions,
        referenceSpaceResets,
        slamRelocalizationCorrections,
        slamJumpVerticalSkips,
        slamJumpVerticalCorrections,
        slamJumpHorizontalSkips,
        slamJumpStaleCatchupSkips,
        sessionFloorSoftDriftCorrections,
        sessionFloorMaxAnchorDriftM:
          Math.round(sessionFloorMaxAnchorDriftM * 1000) / 1000,
        slamJumpLargeCorrections,
        slamJumpRemainderCorrections,
        virtualFloorPlaneY: resolveSessionPlaneHeightM(),
        worldRepinCorrections,
        placedWorldX:
          placed[0]?.placedAnchorOrigin?.x ??
          placed[0]?.lastAnchorPosition?.x ??
          placed[0]?.pinnedWorldPosition?.x ??
          null,
        placedWorldZ:
          placed[0]?.placedAnchorOrigin?.z ??
          placed[0]?.lastAnchorPosition?.z ??
          placed[0]?.pinnedWorldPosition?.z ??
          null,
        reticleFootprintM: reticlePreviewFootprintM,
        lastHitTestScale: lastHitTestScale,
        hitTestScaleAnomalies: hitTestScaleAnomalies,
        lastOriginX,
        lastOriginZ,
        cameraPathM: Math.round(cameraPathM * 1000) / 1000,
        cameraPathSinceLastStatsM: pathSinceLastStats,
        cameraOriginYMin,
        cameraOriginYMax,
        cameraVerticalRangeM: verticalRangeM,
        placedMaxDriftM: Math.round(placedMaxDriftM * 1000) / 1000,
        placedLiveMaxDimensionM:
          placedLiveMaxDimensionM != null
            ? Math.round(placedLiveMaxDimensionM * 1000) / 1000
            : null,
        placedScaleCorrections,
        cameraPathAtScanComplete,
        pinnedDisplayFloorY,
        scanBaselineViewerY,
        latestPoseY:
          latestPose.valid && Number.isFinite(latestPose.position.y)
            ? Math.round(latestPose.position.y * 1000) / 1000
            : null,
        ringWorldDistanceFromViewer:
          latestPose.valid &&
          lastOriginX != null &&
          lastOriginZ != null
            ? Math.round(
                Math.hypot(
                  latestPose.position.x - lastOriginX,
                  latestPose.position.z - lastOriginZ
                ) * 1000
              ) / 1000
            : null,
        ringVerticalDeltaFromViewer:
          latestPose.valid && lastOriginY != null
            ? Math.round((lastOriginY - latestPose.position.y) * 1000) / 1000
            : null,
        lastPlausibleViewerY,
        lastRawOriginY,
      };
    },
    probeFloorFromViewer: () => tryCameraFloorRay(),
    getPlacedDimensionHud: () =>
      objectViewerMode ? null : dimensionHudState,
    getDimensionOverlayVisible: () => dimensionOverlayVisible,
    setDimensionOverlayVisible: applyDimensionOverlayVisible,
    getDimensionFxDiagnostics: () => {
      const entry = placed[placed.length - 1];
      const fx = entry?.placementFx?.getDiagnostics();
      if (!fx) return null;
      return {
        dimensionLabel: fx.dimensionLabel,
        dimensionLinesBuilt: fx.dimensionLinesBuilt,
        dimensionLinesVisible: fx.dimensionLinesVisible,
      };
    },
    hasPlacedContent: () => placed.length > 0,
    getObjectViewerMode: () => objectViewerMode,
    setObjectViewerMode: applyObjectViewerMode,
    onImmersiveSessionEnd: (listener: () => void) => {
      immersiveSessionEndListeners.add(listener);
      return () => immersiveSessionEndListeners.delete(listener);
    },
    setReticlePreviewFootprintM: (footprintM: number | null) => {
      reticlePreviewFootprintM = footprintM ?? RETICLE_DEFAULT_FOOTPRINT_M;
      applyReticleFootprint(reticlePreviewFootprintM);
    },
    skipFloorScan: () => {
      if (floorScanSkipped || floorScanComplete) return;
      if (!latestPose.valid) {
        tryCameraFloorRay();
      }
      if (latestPose.valid && latestPose.position.y >= FLOOR_Y_MIN_M) {
        floorYStabilizer.addScanSample(latestPose.position.y, lastOriginY, {
          source: "surface",
          force: true,
        });
      }
      if (!floorYStabilizer.canLockScan(lastOriginY)) {
        if (forceUnlockFloorScanForPicker()) {
          statusText =
            "Floor scan skipped — tap a model to place on the estimated floor height.";
          emitFloorState();
          return;
        }
        statusText =
          "Point at the floor and move slowly — floor height is not locked yet.";
        emitFloorState();
        return;
      }
      floorScanSkipped = true;
      if (!completeFloorScanInternal(true)) {
        floorScanSkipped = false;
        statusText =
          "Could not lock floor height — keep scanning the floor, then try again.";
        emitFloorState();
        return;
      }
      statusText =
        "Floor scan skipped — tap a model to place on the locked floor height.";
      emitFloorState();
    },
    getDiagnostics: () => ({
      arPlatformProfile: "android-chrome",
      immersiveEntered,
      hitTestEnabled,
      inFullscreen: document.fullscreenElement === canvas,
      domOverlayActive,
      environmentBlendMode,
      lightEstimation: lightEstimationActive,
      sceneHasEnvironment: Boolean(scene.environmentTexture),
      environmentSource: getArEnvironmentSource(),
      environmentIntensity: scene.environmentIntensity,
      depthOcclusion: false,
      depthUsage: "none",
      ...depthDiagnosticsForLog(buildDepthDiagnosticsSnapshot()),
    }),
    whenDepthProbeReady: async () => ({ ...buildDepthDiagnosticsSnapshot() }),
    dispose: () => {
      document.body.classList.remove("xr-session-active");
      domOverlayRoot?.classList.add("hidden");
      if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      }
      window.removeEventListener("resize", resize);
      reticle.dispose();
      floorDisc.dispose();
      floorDot.dispose();
      for (const p of placed) {
        for (const m of p.meshes) m.dispose();
        p.root.dispose();
      }
      xrExperience?.baseExperience.dispose();
      engine.stopRenderLoop();
      engine.dispose();
    },
  };
}
