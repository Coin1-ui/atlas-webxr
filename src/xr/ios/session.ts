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
  MultiMaterial,
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
import { FloorYStabilizer, FLOOR_Y_LOCK_MIN_SAMPLES, FLOOR_Y_SCAN_MIN_SAMPLES, FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES, contactFloorY, bootstrapFloorYFromViewer, isPlausibleLockedFloorY } from "./floor-y-stabilizer";
import {
  MIN_FLOOR_NORMAL_Y,
  POSE_GRACE_MS,
  evaluateFloorReady,
  waitUntilFloorReady,
} from "./floor-detection";
import {
  intersectRayWithHorizontalFloor,
  resolveViewerPoseFromFrame,
  viewerRayFromXrPose,
  type FloorRayOptions,
  type FloorRayRejectReason,
} from "./camera-floor-ray";
import { createArGuiPicker, type ArGuiPicker } from "./ar-gui-picker";
import {
  ensureArFallbackEnvironmentIosPassthrough,
  ensureArFallbackIblOnly,
  getArEnvironmentSource,
  markLightEstimationEnvironmentActive,
  scanPbrMaterials,
  tunePbrMaterialForAR,
  type PbrMaterialDiagnostics,
} from "../shared/ar-pbr-environment";
import {
  createIosWebXRRenderTarget,
  ensureIosAlphaPassthroughLayer,
  getIosXrLayerDiagnostics,
  primeIosCanvasForPassthrough,
} from "../shared/ios-passthrough-layer";
import { stopCameraFeed } from "../camera-support";
import { attachIosXrCameraPassthrough, type IosXrCameraPassthrough } from "./xr-camera-access";
import {
  horizontalQuaternion,
  quaternionYaw,
  shouldIgnoreRingJitter,
  isPhoneTiltedTowardFloor,
  shouldRejectRingRelocalizationJump,
  RING_JUMP_LOG_MIN_M,
  extractHitTestPose,
  reticleScaleForFootprint,
  RETICLE_DEFAULT_FOOTPRINT_M,
} from "./ring-pose";
import {
  applyPlacementAnchorBinding,
  finalizePlacementAnchorBinding,
  freezePlacedInWorld,
  repinWorldFrozenNode,
  unfreezePlacedForAnchor,
  type PlacementAnchorBinding,
} from "./placement-anchor";
import {
  bindGlbCacheScene,
  parseGlbsSequential,
  getOfflineParseResult,
  placeGlbFromSceneCache,
  ensureGlbReadyForPlacement,
  collectGeometryMeshes,
  geometryWorldBounds,
  floorContactDiagnostics,
  placementFloorContactY,
  snapPlacementBaseToFloor,
} from "../shared/glb-offline-cache";
import { resolveAndApplyRealWorldScale } from "../shared/model-real-world-scale";
import {
  attachArPlacementFx,
  AR_DIMENSION_OVERLAY_RENDERING_GROUP,
  buildDockedDimensionHud,
  resolveModelPlacementBounds,
  setupArOverlayRenderingGroups,
  type ArPlacementFxHandle,
  type PlacedDimensionHudState,
} from "../android/ar-placement-fx";

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
  arScaleFactor?: number;
  arScaleVector?: { x: number; y: number; z: number };
  anchorBinding?: PlacementAnchorBinding | null;
  worldFrozen?: boolean;
  pinnedWorldPosition?: Vector3;
  pinnedWorldRotation?: Quaternion;
  placementFx?: ArPlacementFxHandle | null;
};

type PendingAnchorBind = {
  entry: PlacedEntry;
  hit: XRHitTestResult;
  worldPosition: Vector3;
  worldYaw: number;
};

const FLOOR_SCAN_RENDERING_GROUP = 2;
const PLACED_CONTENT_RENDERING_GROUP = 0;
const IOS_DIMENSION_HUD_MIN_INTERVAL_MS = 120;
const IOS_PASSTHROUGH_RETRY_FRAMES = 90;
const PLANE_UPDATE_MIN_MS = 80;
const PLANE_UPDATE_MIN_MS_AFTER_SCAN = 120;
const PLANE_POSE_MIN_DELTA_M = 0.03;
const PLANE_POSE_MIN_DELTA_M_AFTER_SCAN = 0.08;
/** Allow plane ring updates during scan when hit-test has been empty this long. */
const HIT_TEST_STALE_FOR_PLANE_MS = 400;

/**
 * Start immersive-ar WebXR with a platform profile.
 * Must be called directly from a user tap/click handler so enterXRAsync keeps
 * the user-activation grant on Android Chrome.
 */
const IOS_STRICT_FLOOR_READY = false;
const IOS_REJECT_RELOCALIZATION = false;
const IOS_BLOCK_CAMERA_RAY_AFTER_SCAN = true;
const IOS_FREEZE_WORLD_ON_PLACEMENT = true;
const IOS_USE_PLACEMENT_ANCHORS = true;
const IOS_BODY_CLASS = "ios-webxr-viewer";
const IOS_CANVAS_CLASS = "ios-xr-canvas";

/** iOS-only perf tuning — isolated from Android session. */
const IOS_RETICLE_TORUS_TESSELATION = 24;
const IOS_RETICLE_DISC_TESSELATION = 32;

/** iOS WebXR Viewer only — Android uses android/session.ts */
export async function startIosWebXRSession(
  canvas: HTMLCanvasElement,
  _domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void,
  options?: {
    warmupUrls?: string[];
    videoElement?: HTMLVideoElement;
    inCanvasUi?: {
      onSelect: (id: string) => void;
      onDownloadLog: () => void;
      onExit: () => void;
    };
  }
): Promise<WebXRSession | null> {
  void _domOverlayRoot;
  onStatus("Initializing AR engine…");
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  primeIosCanvasForPassthrough(canvas);
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    },
    true
  );
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = new Color3(0.38, 0.38, 0.42);
  ensureArFallbackEnvironmentIosPassthrough(scene);
  setupArOverlayRenderingGroups(scene);
  /** Single parse on the live AR scene — avoids double GLB decode (isolated + ensureArContainer). */
  bindGlbCacheScene(scene, { isolatedParse: false });

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
  let passthroughLayerAlpha: boolean | null = null;
  let passthroughLayerError: string | null = null;
  let xrCameraPassthrough: IosXrCameraPassthrough | null = null;
  let iosCameraAccessMode: string = "none";
  let iosVideoTrackState: string | null = null;
  let iosCameraPassthroughFrames = 0;

  let xrExperience: WebXRDefaultExperience | null = null;
  onStatus("Preparing ARKit connection…");
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

  onStatus("Allow camera access when iOS prompts…");
  let immersiveEntered = false;
  let domOverlayActive = false;

  document.body.classList.add(IOS_BODY_CLASS, "xr-session-active");
  canvas.classList.add(IOS_CANVAS_CLASS);
  canvas.style.background = "transparent";

  const buildSessionInit = (): XRSessionInit => ({
    optionalFeatures: ["hit-test", "anchors"],
  });

  const iosRenderTarget = createIosWebXRRenderTarget(base.sessionManager, canvas, engine);

  const enterImmersiveAr = async () => {
    await base.enterXRAsync(
      "immersive-ar",
      "local-floor",
      iosRenderTarget,
      buildSessionInit()
    );
  };

  const buildDepthDiagnosticsSnapshot = (): DepthDiagnostics =>
    finalizeDepthDiagnostics({ ...depthDiagnostics });

  try {
    await enterImmersiveAr();
    immersiveEntered = true;
    domOverlayActive = false;
    onStatus("Starting AR camera…");
  } catch (e) {
    engine.dispose();
    document.body.classList.remove(IOS_BODY_CLASS, "xr-session-active");
    canvas.classList.remove(IOS_CANVAS_CLASS);
    onStatus(
      `Could not start AR session: ${e instanceof Error ? e.message : "unknown"}. Tap again or trust the site cert in Safari first.`
    );
    return null;
  }

  engine.resize();

  const videoElement = options?.videoElement;
  if (videoElement) {
    stopCameraFeed(videoElement);
    iosVideoTrackState = "skipped-for-xr-exclusive";
  }

  const sessionManager = base.sessionManager;
  environmentBlendMode = sessionManager.session?.environmentBlendMode ?? "unknown";
  passthroughLayerAlpha = true;

  let iosXrLayerDiagnostics: ReturnType<typeof getIosXrLayerDiagnostics> | null = null;

  xrCameraPassthrough = attachIosXrCameraPassthrough(engine, sessionManager);
  iosCameraAccessMode = xrCameraPassthrough.getMode();
  if (iosCameraAccessMode === "unsupported") {
    passthroughLayerError = xrCameraPassthrough.getLastError();
  }

  const passthroughLayer = await ensureIosAlphaPassthroughLayer(
    sessionManager,
    canvas,
    engine
  );
  if (passthroughLayer.applied) {
    passthroughLayerAlpha = passthroughLayer.layerAlpha;
    passthroughLayerError = passthroughLayer.error;
    environmentBlendMode =
      passthroughLayer.environmentBlendMode ?? environmentBlendMode;
  } else if (passthroughLayer.error && !passthroughLayerError) {
    passthroughLayerError = passthroughLayer.error;
  }
  iosXrLayerDiagnostics = getIosXrLayerDiagnostics(sessionManager.session, engine);

  let passthroughRetryFrames = 0;
  const retryPassthroughIfNeeded = async () => {
    if (!sessionManager.session || passthroughRetryFrames >= IOS_PASSTHROUGH_RETRY_FRAMES) {
      return;
    }
    passthroughRetryFrames += 1;
    environmentBlendMode = sessionManager.session?.environmentBlendMode ?? environmentBlendMode;
    iosXrLayerDiagnostics = getIosXrLayerDiagnostics(sessionManager.session, engine);
  };

  // Babylon sets autoClear=false for immersive-ar; clearing each frame paints opaque black over passthrough.
  scene.autoClear = false;
  scene.autoClearDepthAndStencil = false;
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.onBeforeRenderObservable.add(() => {
    if (scene.autoClear) scene.autoClear = false;
    if (scene.clearColor.a > 0) scene.clearColor = new Color4(0, 0, 0, 0);
  });

  try {
    base.featuresManager.enableFeature(WebXRBackgroundRemover, "latest", {
      environmentHelperRemovalFlags: { skyBox: true, ground: true },
    });
  } catch {
    /* passthrough may still work on some devices */
  }

  ensureArFallbackIblOnly(scene);

  try {
    const lightEst = base.featuresManager.enableFeature(
      WebXRLightEstimation,
      "latest",
      {
        createDirectionalLightSource: false,
        setSceneEnvironmentTexture: true,
        directionalLightIntensityFactor: 1.1,
      }
    ) as WebXRLightEstimation;
    lightEst.directionalLight = sun;
    lightEstimationActive = true;
  } catch {
    lightEstimationActive = false;
  }

  if (lightEstimationActive) {
    hemi.intensity = 0.38;
    sun.intensity = 0.92;
    scene.ambientColor = new Color3(0.32, 0.32, 0.34);
  }

  if (environmentBlendMode === "opaque") {
    onStatus("Point at the floor — live camera shows behind AR content.");
  }

  let guiPicker: ArGuiPicker | null = null;
  if (options?.inCanvasUi) {
    guiPicker = createArGuiPicker(scene, options.inCanvasUi);
    guiPicker.update({
      items: [],
      activeId: null,
      statusText: "Entering AR camera…",
      floorReady: false,
      floorScanComplete: false,
    });
  }

  if (lightEstimationActive && scene.environmentTexture) {
    markLightEstimationEnvironmentActive();
  }

  const placed: PlacedEntry[] = [];
  let dimensionHudState: PlacedDimensionHudState | null = null;
  let dimensionOverlayVisible = false;
  let lastDimensionHudUpdateAt = 0;
  let markerCount = 0;
  let placeGeneration = 0;
  let floorScanComplete = false;
  let scanCompleteViewerY: number | null = null;
  let statusText =
    "AR camera active. Point at the floor and move slowly until the cyan marker appears.";

  const reticle = MeshBuilder.CreateTorus(
    "reticle",
    { diameter: 0.32, thickness: 0.022, tessellation: IOS_RETICLE_TORUS_TESSELATION },
    scene
  );
  reticle.isVisible = false;
  reticle.isPickable = false;
  reticle.renderingGroupId = FLOOR_SCAN_RENDERING_GROUP;
  reticle.position.z = 0.002;
  const reticleMat = new StandardMaterial("reticleMat", scene);
  reticleMat.emissiveColor = new Color3(0.35, 1, 1);
  reticleMat.alpha = 1;
  reticleMat.disableLighting = true;
  reticleMat.zOffset = -8;
  reticleMat.disableDepthWrite = false;
  reticleMat.backFaceCulling = false;
  reticle.material = reticleMat;

  /** Semi-transparent disc — main floor-detection visual in the camera view. */
  const floorDisc = MeshBuilder.CreateDisc(
    "floorDisc",
    { radius: 0.38, tessellation: IOS_RETICLE_DISC_TESSELATION, sideOrientation: 2 },
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
  let lastOriginX: number | null = null;
  let lastOriginZ: number | null = null;
  let lastForwardY: number | null = null;
  let lastRawHitTestFloorY: number | null = null;
  let lastRayReject: FloorRayRejectReason | null = null;
  let ringPoseSource = "none";
  let planeRingUpdatesSkipped = 0;
  let ringLargeJumps = 0;
  let ringRelocalizationRejects = 0;
  let hitTestScaleAnomalies = 0;
  let lastHitTestScale: number | null = null;
  let lastXrHitResult: XRHitTestResult | null = null;
  let placementAnchorUpdates = 0;
  let placementAnchorBindAttempts = 0;
  let placementAnchorBindSuccess = 0;
  let worldRepinCorrections = 0;
  const pendingAnchorBinds: PendingAnchorBind[] = [];
  const pendingAnchorFinalizes: {
    entry: PlacedEntry;
    anchor: XRAnchor;
    worldPosition: Vector3;
    worldYaw: number;
  }[] = [];
  let reticlePreviewFootprintM = RETICLE_DEFAULT_FOOTPRINT_M;
  const xrSessionStartAt = performance.now();
  const floorYStabilizer = new FloorYStabilizer();
  const floorStateListeners = new Set<(state: FloorDetectionState) => void>();
  let lastFloorStateKey = "";
  let pendingFloorStateEmit = false;

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

  const refreshViewerOrigin = (xrFrame?: XRFrame) => {
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    if (!frame) return;
    const viewerPose = resolveViewerPoseFromFrame(frame, {
      referenceSpace: base.sessionManager.referenceSpace,
      baseReferenceSpace: base.sessionManager.baseReferenceSpace,
      viewerReferenceSpace: base.sessionManager.viewerReferenceSpace,
    });
    if (viewerPose) {
      const px = Math.round(viewerPose.transform.position.x * 1000) / 1000;
      const py = Math.round(viewerPose.transform.position.y * 1000) / 1000;
      const pz = Math.round(viewerPose.transform.position.z * 1000) / 1000;
      lastOriginX = px;
      lastOriginY = py;
      lastOriginZ = pz;
    }
  };

  const tryAutoCompleteFloorScan = () => {
    if (floorScanComplete || floorScanSkipped) return;
    if (performance.now() - xrSessionStartAt < 800) return;
    if (
      !isPhoneTiltedTowardFloor(lastForwardY) &&
      cameraRayHits < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES
    ) {
      return;
    }
    const state = emitFloorStateInternal();
    if (!state.hitReady || lastOriginY == null) return;
    if (floorYStabilizer.canCompleteScan(lastOriginY)) {
      completeFloorScanInternal();
      return;
    }
    if (cameraRayHits >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES) {
      completeFloorScanInternal();
    }
  };

  /** Estimate horizontal floor Y for camera-ray — y=0 is SLAM origin, not the real floor. */
  const cameraRayFloorOptions = (originY: number): FloorRayOptions => {
    const locked = floorYStabilizer.lockedFloorY();
    const boot = locked ?? bootstrapFloorYFromViewer(originY);
    const opts: FloorRayOptions =
      originY > 1.0 ? { minForwardDown: 0.02 } : {};
    if (boot != null && isPlausibleLockedFloorY(boot, originY)) {
      opts.floorY = boot;
    }
    return opts;
  };

  const ensureSessionFloorLock = (): number | null => {
    if (!floorScanComplete) return floorYStabilizer.lockedFloorY();
    if (placed.length > 0) {
      return floorYStabilizer.lockedFloorY();
    }
    const viewerForLock = lastOriginY ?? scanCompleteViewerY;
    const repaired = floorYStabilizer.repairLockForViewer(
      viewerForLock,
      scanCompleteViewerY ?? lastOriginY
    );
    if (repaired != null) return repaired;
    const current = floorYStabilizer.lockedFloorY();
    if (
      current == null &&
      viewerForLock != null &&
      isPlausibleLockedFloorY(
        bootstrapFloorYFromViewer(viewerForLock) ?? -1,
        viewerForLock
      )
    ) {
      const boot = bootstrapFloorYFromViewer(viewerForLock);
      if (boot != null) {
        floorYStabilizer.setLockedFloorY(boot);
        return boot;
      }
    }
    if (
      current != null &&
      viewerForLock != null &&
      !isPlausibleLockedFloorY(current, viewerForLock)
    ) {
      const boot = bootstrapFloorYFromViewer(viewerForLock);
      if (boot != null && isPlausibleLockedFloorY(boot, viewerForLock)) {
        floorYStabilizer.setLockedFloorY(boot);
        return boot;
      }
    }
    return current;
  };

  const resolvePlacementFloorY = (
    rawFloorY: number
  ): {
    floorY: number;
    rawY: number;
    lockedFloorY: number | null;
    usedLock: boolean;
  } => {
    ensureSessionFloorLock();
    const lockedFloorY = floorYStabilizer.lockedFloorY();
    if (!floorScanComplete || lockedFloorY == null) {
      return { floorY: rawFloorY, rawY: rawFloorY, lockedFloorY, usedLock: false };
    }
    const resolved = floorYStabilizer.resolveY(
      rawFloorY,
      true,
      lastOriginY,
      scanCompleteViewerY,
      false
    );
    return {
      floorY: resolved.y,
      rawY: resolved.rawY,
      lockedFloorY: resolved.lockedFloorY,
      usedLock: resolved.usedLock,
    };
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
      { strictAfterScan: IOS_STRICT_FLOOR_READY }
    );
    const hitReady = evalResult.ready;
    const ready = hitReady || floorScanSkipped;
    const state: FloorDetectionState = {
      ready,
      hitReady,
      reticleVisible: reticle.isVisible && latestPose.valid,
      ringPlaceable: true,
      liveHit,
      graceActive: evalResult.graceActive,
      poseAgeMs: evalResult.poseAgeMs,
      floorNormalY: Math.round(floorNormalY * 1000) / 1000,
    };
    const key = `${state.ready}|${state.liveHit}|${state.graceActive}|${state.reticleVisible}|${floorScanSkipped}`;
    if (key !== lastFloorStateKey) {
      lastFloorStateKey = key;
      for (const fn of floorStateListeners) fn(state);
    }
    if (floorScanComplete) {
      if (ready) {
        statusText = "Cyan ring on floor — tap a model to place or swap.";
      } else if (evalResult.graceActive) {
        statusText = "Floor lost — point at the floor until the cyan ring returns.";
      } else if (liveHit && !evalResult.horizontal) {
        statusText = "Surface too steep — point at a flat floor, not a wall.";
      }
    } else if (ready) {
      statusText = "Floor detected — opening model picker…";
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

  const updateFloorVisuals = (visible: boolean, _grace = false) => {
    if (floorScanComplete) {
      const show = visible && latestPose.valid;
      reticle.isVisible = show;
      floorDisc.isVisible = false;
      floorDot.isVisible = false;
      reticleMat.alpha = 0.9;
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
    if (
      floorScanComplete &&
      latestPose.valid &&
      shouldRejectRingRelocalizationJump(
        latestPose.position,
        targetPos,
        floorScanComplete && IOS_REJECT_RELOCALIZATION,
        lastOriginX != null && lastOriginZ != null
          ? { x: lastOriginX, z: lastOriginZ }
          : null,
        lastOriginY
      )
    ) {
      ringRelocalizationRejects += 1;
      lastValidHitAt = performance.now();
      liveHit = true;
      updateFloorVisuals(true, false);
      syncFloorVisualsToPose();
      return;
    }
    if (
      floorScanComplete &&
      latestPose.valid &&
      shouldIgnoreRingJitter(latestPose.position, targetPos)
    ) {
      lastValidHitAt = performance.now();
      liveHit = true;
      return;
    }
    if (latestPose.valid && ringPoseSource !== "none" && ringPoseSource !== source) {
      const jump = Math.hypot(
        targetPos.x - latestPose.position.x,
        targetPos.z - latestPose.position.z
      );
      if (jump >= RING_JUMP_LOG_MIN_M) ringLargeJumps += 1;
    }
    ringPoseSource = source;
    if (floorNormalY >= MIN_FLOOR_NORMAL_Y) {
      lastRawHitTestFloorY = targetPos.y;
      if (!floorScanComplete) {
        floorYStabilizer.addScanSample(targetPos.y, lastOriginY, {
          source: source === "camera-ray" ? "camera-ray" : "surface",
        });
      }
      if (floorScanComplete) {
        ensureSessionFloorLock();
        const standingViewer = scanCompleteViewerY ?? lastOriginY;
        const resolved = floorYStabilizer.resolveY(
          targetPos.y,
          true,
          lastOriginY,
          standingViewer,
          placed.length === 0
        );
        targetPos.y = resolved.y;
      }
    }
    latestPose.position.copyFrom(targetPos);
    if (floorScanComplete) {
      latestPose.rotation = horizontalQuaternion(quaternionYaw(targetRot));
    } else {
      latestPose.rotation.copyFrom(targetRot);
    }
    latestPose.valid = true;
    syncFloorVisualsToPose();
  };

  const completeFloorScanInternal = () => {
    if (floorScanComplete) return;
    if (
      !isPhoneTiltedTowardFloor(lastForwardY) &&
      cameraRayHits < FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES
    ) {
      return;
    }
    let locked = floorYStabilizer.lockFromScan(lastOriginY);
    if (locked == null && lastOriginY != null) {
      const boot = bootstrapFloorYFromViewer(lastOriginY);
      if (boot != null && isPlausibleLockedFloorY(boot, lastOriginY)) {
        floorYStabilizer.setLockedFloorY(boot);
        locked = boot;
      }
    }
    if (locked == null) return;
    floorScanComplete = true;
    scanCompleteViewerY = lastOriginY;
    if (latestPose.valid) {
      latestPose.position.y = contactFloorY(locked);
      syncFloorVisualsToPose();
    }
    floorDisc.isVisible = false;
    floorDot.isVisible = false;
    const showRing =
      latestPose.valid &&
      floorNormalY >= MIN_FLOOR_NORMAL_Y &&
      (liveHit || performance.now() - lastValidHitAt < POSE_GRACE_MS);
    updateFloorVisuals(showRing, false);
    statusText = "Cyan ring on floor shows where models will appear — tap a model to place.";
    emitFloorState();
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
    const rawFloorY = lastRawHitTestFloorY ?? latestPose.position.y;
    const resolved = resolvePlacementFloorY(rawFloorY);
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

  const applyFloorHitPoint = (x: number, y: number, z: number, yaw: number, mode: string) => {
    const targetPos = new Vector3(x, y, z);
    const targetRot = horizontalQuaternion(yaw);
    const source = mode.includes("camera") ? "camera-ray" : "hit-test";
    applyRingTarget(targetPos, targetRot, source);
    floorNormalY = 1;
    liveHit = true;
    lastValidHitAt = performance.now();
    updateFloorVisuals(true, false);
    if (mode.includes("camera")) cameraRayHits += 1;
    if (mode.includes("camera")) {
      floorYStabilizer.addScanSample(y, lastOriginY, { source: "camera-ray" });
    }
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

    lastOriginY = Math.round(origin.y * 1000) / 1000;
    lastForwardY = Math.round(forward.y * 1000) / 1000;

    const attempt = intersectRayWithHorizontalFloor(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: forward.x, y: forward.y, z: forward.z },
      cameraRayFloorOptions(origin.y)
    );
    lastRayReject = attempt.rejectReason;
    if (!attempt.hit) return false;

    floorYStabilizer.addScanSample(attempt.hit.y, lastOriginY, {
      source: "camera-ray",
    });
    return true;
  };

  const tryCameraFloorRayFromVectors = (
    origin: Vector3,
    forward: Vector3,
    mode = "camera-floor-ray"
  ): boolean => {
    if (
      floorScanSkipped ||
      (floorScanComplete && IOS_BLOCK_CAMERA_RAY_AFTER_SCAN)
    ) {
      return false;
    }

    lastOriginY = Math.round(origin.y * 1000) / 1000;
    lastForwardY = Math.round(forward.y * 1000) / 1000;

    const attempt = intersectRayWithHorizontalFloor(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: forward.x, y: forward.y, z: forward.z },
      cameraRayFloorOptions(origin.y)
    );
    lastRayReject = attempt.rejectReason;
    if (!attempt.hit) return false;

    return applyFloorHitPoint(attempt.hit.x, attempt.hit.y, attempt.hit.z, attempt.hit.yaw, mode);
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

  const canBindPlacementAnchor = (): boolean =>
    Boolean(lastXrHitResult) && ringPoseSource === "hit-test";

  let lastPlaneUpdateAt = 0;

  const tryHorizontalPlane = (plane: { transformationMatrix?: Matrix }) => {
    if (!plane.transformationMatrix || floorScanSkipped) return;
    const now = performance.now();
    const hitTestFresh =
      lastValidHitAt > 0 && now - lastValidHitAt < HIT_TEST_STALE_FOR_PLANE_MS;
    if (hitTestAttached && (floorScanComplete || hitTestFresh)) {
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
        if (!floorScanComplete && tryCameraFloorRayFromXrFrame()) {
          scheduleEmitFloorState();
          return;
        }
        if (floorScanComplete) {
          if (latestPose.valid) {
            liveHit = true;
            lastValidHitAt = now;
            updateFloorVisuals(true, false);
            syncFloorVisualsToPose();
          }
          scheduleEmitFloorState();
          return;
        }
        if (
          latestPose.valid &&
          lastValidHitAt > 0 &&
          now - lastValidHitAt < POSE_GRACE_MS
        ) {
          updateFloorVisuals(true, false);
          scheduleEmitFloorState();
          return;
        }
        liveHit = false;
        latestPose.valid = false;
        updateFloorVisuals(false, false);
        scheduleEmitFloorState();
        return;
      }
      hitFramesWithResults += 1;
      refreshViewerOrigin();
      lastXrHitResult = results[0]?.xrHitResult ?? null;
      const hitPose = extractHitTestPose(results[0].transformationMatrix);
      const targetPos = hitPose.position;
      const targetRot = hitPose.rotation;
      if (hitPose.scaleAnomaly) hitTestScaleAnomalies += 1;
      lastHitTestScale = Math.round(((hitPose.scale.x + hitPose.scale.y + hitPose.scale.z) / 3) * 1000) / 1000;
      floorUp.set(0, 1, 0);
      floorUp.rotateByQuaternionAroundPointToRef(targetRot, Vector3.Zero(), floorUp);
      floorNormalY = floorUp.y;
      if (floorNormalY < MIN_FLOOR_NORMAL_Y) {
        if (floorScanComplete && latestPose.valid) {
          updateFloorVisuals(true, false);
          scheduleEmitFloorState();
          return;
        }
        liveHit = false;
        updateFloorVisuals(false, false);
        scheduleEmitFloorState();
        return;
      }
      liveHit = true;
      lastValidHitAt = now;
      applyRingTarget(targetPos, targetRot, "hit-test");
      updateFloorVisuals(true, false);
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
      if (false) {
        const planeDetector = base.featuresManager.enableFeature(
          WebXRPlaneDetector,
          "latest"
        ) as WebXRPlaneDetector;
        planeDetector.onPlaneAddedObservable.add((plane) => tryHorizontalPlane(plane));
        planeDetector.onPlaneUpdatedObservable.add((plane) => tryHorizontalPlane(plane));
      }
    } catch {
      /* plane-detection optional */
    }

    base.sessionManager.onXRFrameObservable.add((xrFrame) => {
      xrFramesProcessed += 1;
      if (
        passthroughRetryFrames < IOS_PASSTHROUGH_RETRY_FRAMES &&
        xrFramesProcessed % 15 === 1
      ) {
        void retryPassthroughIfNeeded();
      }
      refreshViewerOrigin(xrFrame);
      if (!floorScanComplete && !floorScanSkipped) {
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
            collectCameraRayFloorSample(origin, forward);
            tryAutoCompleteFloorScan();
          }
        }
      }
      updatePlacementAnchors(xrFrame);
      for (const entry of placed) {
        if (entry.anchorBinding) continue;
        if (
          entry.worldFrozen &&
          entry.pinnedWorldPosition &&
          entry.pinnedWorldRotation &&
          repinWorldFrozenNode(
            entry.root,
            entry.pinnedWorldPosition,
            entry.pinnedWorldRotation
          )
        ) {
          worldRepinCorrections += 1;
        }
      }
      if (xrFrame) {
        flushPendingAnchorBinds(xrFrame);
      }
      updateDimensionHud();
      if (!liveHit && !floorScanSkipped && !floorScanComplete) {
        tryCameraFloorRayFromXrFrame(xrFrame);
      }
    });

    signalHitTestReady(hitTestAttached);
    statusText =
      "Move slowly along the floor — watch for the cyan disc and ring in the camera view.";
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
    root.parent = null;
    root.position.copyFrom(latestPose.position);
    root.rotationQuaternion = latestPose.rotation.clone();

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
        { diameter: 0.45, thickness: 0.02, tessellation: IOS_RETICLE_TORUS_TESSELATION },
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

  const queuePlacementAnchorBind = (entry: PlacedEntry): boolean => {
    if (!IOS_USE_PLACEMENT_ANCHORS) return false;
    if (!canBindPlacementAnchor()) return false;
    const hit = lastXrHitResult;
    if (!hit || !entry.root.rotationQuaternion) return false;
    entry.root.computeWorldMatrix(true);
    pendingAnchorBinds.push({
      entry,
      hit,
      worldPosition: entry.root.absolutePosition.clone(),
      worldYaw: quaternionYaw(entry.root.absoluteRotationQuaternion),
    });
    return true;
  };

  const flushPendingAnchorBinds = (frame: XRFrame) => {
    const refSpace = base.sessionManager.referenceSpace;
    if (!refSpace) return;

    if (pendingAnchorFinalizes.length) {
      const finalizeBatch = pendingAnchorFinalizes.splice(0);
      for (const pending of finalizeBatch) {
        const binding = finalizePlacementAnchorBinding(
          pending.anchor,
          frame,
          refSpace,
          pending.worldPosition,
          pending.worldYaw,
          scene.useRightHandedSystem
        );
        if (binding) {
          pending.entry.anchorBinding = binding;
          unfreezePlacedForAnchor(pending.entry.root);
          pending.entry.worldFrozen = false;
          placementAnchorBindSuccess += 1;
        }
      }
    }

    if (pendingAnchorBinds.length === 0) return;
    const batch = pendingAnchorBinds.splice(0, pendingAnchorBinds.length);
    for (const pending of batch) {
      placementAnchorBindAttempts += 1;
      const hit = pending.hit;
      if (typeof hit.createAnchor !== "function") continue;
      try {
        const anchorPromise = hit.createAnchor(new XRRigidTransform());
        if (!anchorPromise) continue;
        anchorPromise
          .then((anchor) => {
            if (!anchor) return;
            pendingAnchorFinalizes.push({
              entry: pending.entry,
              anchor,
              worldPosition: pending.worldPosition,
              worldYaw: pending.worldYaw,
            });
          })
          .catch(() => {
            /* anchor optional */
          });
      } catch {
        /* anchor optional */
      }
    }
  };

  const bindPlacementAnchor = (entry: PlacedEntry): boolean =>
    queuePlacementAnchorBind(entry);

  const updatePlacementAnchors = (xrFrame?: XRFrame) => {
    const frame = xrFrame ?? base.sessionManager.currentFrame;
    const refSpace = base.sessionManager.referenceSpace;
    if (!frame || !refSpace) return;
    for (const entry of placed) {
      if (entry.worldFrozen) continue;
      if (!entry.anchorBinding || !entry.root.rotationQuaternion) continue;
      if (
        applyPlacementAnchorBinding(
          entry.anchorBinding,
          frame,
          refSpace,
          scene.useRightHandedSystem,
          entry.root,
          { minUpdateDeltaM: 0 }
        ).result !== "lost"
      ) {
        placementAnchorUpdates += 1;
      }
    }
  };

  const clearPlaced = () => {
    placeGeneration += 1;
    for (const p of placed) {
      p.placementFx?.dispose();
      for (const m of p.meshes) m.dispose();
      p.root.dispose();
    }
    placed.length = 0;
    dimensionHudState = null;
  };

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
    }
    return fx;
  };

  const ensurePlacementFx = (entry: PlacedEntry): ArPlacementFxHandle | null => {
    entry.root.computeWorldMatrix(true);
    for (const m of entry.meshes) {
      m.computeWorldMatrix(true);
    }
    const fx = attachPlacementFx(entry);
    if (fx) return fx;
    requestAnimationFrame(() => {
      if (!placed.includes(entry)) return;
      attachPlacementFx(entry);
      updateDimensionHud();
    });
    return null;
  };

  const updateDimensionHud = () => {
    if (placed.length === 0) {
      dimensionHudState = null;
      return;
    }
    if (!dimensionOverlayVisible) {
      dimensionHudState = null;
      return;
    }
    const now = performance.now();
    if (now - lastDimensionHudUpdateAt < IOS_DIMENSION_HUD_MIN_INTERVAL_MS) return;
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
      entry.placementFx?.setDimensionLinesVisible(visible);
    }
    updateDimensionHud();
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

  const snapWrapperBaseToFloor = (
    wrapper: TransformNode,
    floorY: number,
    modelMeshes?: AbstractMesh[]
  ): number => snapPlacementBaseToFloor(wrapper, floorY, modelMeshes);

  const materialsForMesh = (mesh: AbstractMesh): Material[] => {
    const seen = new Set<Material>();
    const mats: Material[] = [];
    const add = (m?: Material | null) => {
      if (m && !seen.has(m)) {
        seen.add(m);
        mats.push(m);
      }
    };
    add(mesh.material);
    if (mesh.material instanceof MultiMaterial) {
      for (const sub of mesh.material.subMaterials) add(sub);
    }
    for (const sm of mesh.subMeshes ?? []) {
      add(sm.getMaterial());
    }
    const active = (
      mesh as AbstractMesh & { getActiveMaterials?: () => Material[] }
    ).getActiveMaterials?.();
    if (active) {
      for (const m of active) add(m);
    }
    return mats;
  };

  const materialsForNode = (root: TransformNode): Material[] => {
    const seen = new Set<Material>();
    const mats: Material[] = [];
    for (const m of root.getChildMeshes(true).flatMap((mesh) => materialsForMesh(mesh))) {
      if (!seen.has(m)) {
        seen.add(m);
        mats.push(m);
      }
    }
    return mats;
  };

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
    }
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

  const finalizeAndFreezePlacement = (
    entry: PlacedEntry,
    floorY: number,
    footprintM = 1.2
  ) => {
    const result = finalizePlacement(entry.root, floorY, footprintM, entry.meshes);
    if (IOS_FREEZE_WORLD_ON_PLACEMENT) {
      const pinned = freezePlacedInWorld(entry.root);
      entry.pinnedWorldPosition = pinned.position;
      entry.pinnedWorldRotation = pinned.rotation;
      entry.worldFrozen = true;
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
      markerCount += 1;
      placed.push(createFloorObject(objectType, label));
      const entry = placed[placed.length - 1]!;
      entry.root.computeWorldMatrix(true);
      const b = entry.root.getHierarchyBoundingVectors(true);
      const fp = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 0.35);
      finalizeAndFreezePlacement(entry, pose.floorY, fp);
      ensurePlacementFx(entry);
      void bindPlacementAnchor(entry);
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
        statusText = floorScanComplete
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

      const buildDiag = (
        loadMethod: string,
        wrapper: TransformNode,
        meshes: AbstractMesh[],
        transformNodeCount: number,
        topLevelRoots: number,
        extra: Partial<PlacementDiagnostics> = {}
      ): PlacementDiagnostics => {
        const geoBounds = geometryWorldBounds(wrapper);
        const hierarchyBounds = wrapper.getHierarchyBoundingVectors(true);
        const sizeSource = geoBounds
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
        const { floorSnapM, materialTypes, pbrDiagnostics } = finalizeAndFreezePlacement(
          entry,
          floorY,
          0.4
        );
        placed.push(entry);
        ensurePlacementFx(entry);
        const anchored = bindPlacementAnchor(entry);
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
        wrapper.parent = null;
        wrapper.position.copyFrom(latestPose.position);
        wrapper.rotationQuaternion = latestPose.rotation.clone();
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
        const { floorSnapM, materialTypes, pbrDiagnostics } = finalizeAndFreezePlacement(
          entry,
          floorY,
          effectiveFootprintM
        );
        ensurePlacementFx(entry);
        const anchored = bindPlacementAnchor(entry);
        updateDimensionHud();
        const diag = buildDiag(loadMethod, wrapper, meshes, transformNodeCount, topLevelRoots, {
          ...placementFloorMeta,
          materialTypes,
          pbrDiagnostics,
          fetchBytes,
          floorSnapM,
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
      return parseGlbsSequential(urls, {
        timeoutMs: 45000,
        onProgress: (current, total, url) => {
          const name = url.split("/").pop()?.replace(/\.glb$/i, "") ?? "model";
          onStatus(`Preparing model ${current}/${total}: ${name}…`);
        },
      });
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
      const minSamples = options.minSamples ?? FLOOR_Y_LOCK_MIN_SAMPLES;
      const timeoutMs = options.timeoutMs ?? 20000;
      const t0 = performance.now();

      return new Promise((resolve) => {
        let settled = false;
        let timeoutRaf = 0;
        let unsub: () => void = () => {};

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          if (timeoutRaf) cancelAnimationFrame(timeoutRaf);
          unsub();
          if (!floorScanComplete && ok) completeFloorScanInternal();
          resolve({
            ok,
            waitedMs: Math.round(performance.now() - t0),
            lockedFloorY: floorYStabilizer.lockedFloorY(),
          });
        };

        const tick = () => {
          const elapsed = performance.now() - t0;
          const state = emitFloorStateInternal();
          const validSamples = floorYStabilizer.validSampleCount(lastOriginY);
          const rawSamples = floorYStabilizer.sampleCount();
          const canLock = floorYStabilizer.canLockScan(lastOriginY);
          if (
            state.hitReady &&
            elapsed >= minMs &&
            (canLock ||
              validSamples >= minSamples ||
              rawSamples >= FLOOR_Y_SCAN_MIN_SAMPLES)
          ) {
            finish(true);
            return;
          }
          if (elapsed >= timeoutMs) {
            finish(
              (state.hitReady || latestPose.valid) &&
                (canLock ||
                  validSamples >= FLOOR_Y_SCAN_MIN_SAMPLES ||
                  rawSamples >= FLOOR_Y_SCAN_MIN_SAMPLES)
            );
          }
        };

        tick();
        const listener = () => tick();
        floorStateListeners.add(listener);
        unsub = () => floorStateListeners.delete(listener);

        const pollTimeout = () => {
          if (settled) return;
          tick();
          if (!settled) {
            timeoutRaf = requestAnimationFrame(pollTimeout);
          }
        };
        timeoutRaf = requestAnimationFrame(pollTimeout);
      });
    },
    completeFloorScan: () => completeFloorScanInternal(),
    isFloorScanComplete: () => floorScanComplete,
    canCompleteFloorScan: () =>
      floorYStabilizer.canCompleteScan(lastOriginY) ||
      (cameraRayHits >= FLOOR_Y_SCAN_MIN_CAMERA_SAMPLES && lastOriginY != null),
    bootstrapFloorScanFromViewer: (): boolean => {
      if (floorScanComplete || floorScanSkipped || lastOriginY == null) return false;
      const boot = bootstrapFloorYFromViewer(lastOriginY);
      if (boot == null || !isPlausibleLockedFloorY(boot, lastOriginY)) return false;
      for (let i = 0; i < FLOOR_Y_SCAN_MIN_SAMPLES; i++) {
        floorYStabilizer.addScanSample(boot, lastOriginY, { source: "bootstrap" });
      }
      completeFloorScanInternal();
      return floorScanComplete;
    },
    getHitTestStats: (): HitTestStats => {
      const state = emitFloorStateInternal();
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
        ringPlaceable: true,
        placementAnchorBindAttempts,
        placementAnchorBindSuccess,
        lockedFloorY: floorYStabilizer.lockedFloorY(),
        floorYUsedLockCount: floorYStabilizer.usedLockCount,
        floorScanSamples: floorYStabilizer.sampleCount(),
        floorScanValidSamples: floorYStabilizer.validSampleCount(lastOriginY),
        placementAnchorUpdates,
        worldRepinCorrections,
        placedWorldX: placed[0]?.pinnedWorldPosition?.x ?? null,
        placedWorldZ: placed[0]?.pinnedWorldPosition?.z ?? null,
        reticleFootprintM: reticlePreviewFootprintM,
        lastHitTestScale: lastHitTestScale,
        hitTestScaleAnomalies: hitTestScaleAnomalies,
      };
    },
    probeFloorFromViewer: () => tryCameraFloorRay(),
    getPlacedDimensionHud: () => dimensionHudState,
    getDimensionOverlayVisible: () => dimensionOverlayVisible,
    setDimensionOverlayVisible: (visible: boolean) => applyDimensionOverlayVisible(visible),
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
    getObjectViewerMode: () => false,
    setObjectViewerMode: () => {},
    onImmersiveSessionEnd: () => () => {},
    setReticlePreviewFootprintM: (footprintM: number | null) => {
      reticlePreviewFootprintM = footprintM ?? RETICLE_DEFAULT_FOOTPRINT_M;
      applyReticleFootprint(reticlePreviewFootprintM);
    },
    skipFloorScan: () => {
      if (floorScanSkipped) return;
      floorScanSkipped = true;
      if (!latestPose.valid) {
        tryCameraFloorRay();
      }
      if (
        floorYStabilizer.sampleCount() < FLOOR_Y_SCAN_MIN_SAMPLES &&
        latestPose.valid
      ) {
        floorYStabilizer.addScanSample(latestPose.position.y, lastOriginY, {
          source: "surface",
          force: true,
        });
      }
      completeFloorScanInternal();
      statusText =
        "Floor scan skipped — point at the floor for accurate placement, or tap a model to try.";
      emitFloorState();
    },
    getDiagnostics: () => ({
      arPlatformProfile: "ios-webxr-viewer",
      immersiveEntered,
      hitTestEnabled,
      inFullscreen: document.fullscreenElement === canvas,
      domOverlayActive,
      environmentBlendMode,
      passthroughLayerAlpha,
      passthroughLayerError,
      htmlCameraFallback: document.body.classList.contains("ios-camera-fallback"),
      iosCameraAccessMode: xrCameraPassthrough?.getMode() ?? iosCameraAccessMode,
      iosCameraPassthroughFrames: xrCameraPassthrough?.framesDrawn() ?? iosCameraPassthroughFrames,
      iosCameraAccessError: xrCameraPassthrough?.getLastError() ?? null,
      iosVideoTrackState,
      iosXrGlContextAlpha: iosXrLayerDiagnostics?.glContextAlpha ?? null,
      iosXrGlPremultipliedAlpha: iosXrLayerDiagnostics?.glContextPremultipliedAlpha ?? null,
      sceneAutoClear: scene.autoClear,
      lightEstimation: lightEstimationActive,
      sceneHasEnvironment: Boolean(scene.environmentTexture),
      environmentSource: getArEnvironmentSource(),
      environmentIntensity: scene.environmentIntensity,
      depthOcclusion: false,
      depthUsage: "none",
      ...depthDiagnosticsForLog(buildDepthDiagnosticsSnapshot()),
    }),
    whenDepthProbeReady: async () => ({ ...buildDepthDiagnosticsSnapshot() }),
    updateInCanvasPicker: guiPicker
      ? (options) => guiPicker!.update(options)
      : undefined,
    dispose: () => {
      document.body.classList.remove("xr-session-active");
      document.body.classList.remove(IOS_BODY_CLASS);
      canvas.classList.remove(IOS_CANVAS_CLASS);
      guiPicker?.dispose();
      xrCameraPassthrough?.dispose();
      xrCameraPassthrough = null;
      if (videoElement) {
        stopCameraFeed(videoElement);
      }
      document.body.classList.remove("ios-camera-fallback");
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
