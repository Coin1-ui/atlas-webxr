import {
  Engine,
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  HemisphericLight,
  PBRMaterial,
  Color3,
  Color4,
  WebXRDefaultExperience,
  WebXRHitTest,
  TransformNode,
  Quaternion,
  AbstractMesh,
} from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export type PlacementObjectType = "arrow" | "pad" | "zone";

export type PlaceModelOptions = {
  label: string;
  modelUrl?: string | null;
  builtinType?: PlacementObjectType;
};

export type PlacementDiagnostics = {
  loadMethod: string;
  meshCount: number;
  transformNodeCount: number;
  topLevelRoots: number;
  position: { x: number; y: number; z: number };
  boundsMin?: { x: number; y: number; z: number };
  boundsMax?: { x: number; y: number; z: number };
  sizeMeters?: { x: number; y: number; z: number };
  maxDimensionM?: number;
  meshesVisible: number;
  materialTypes?: string;
  modelUrl?: string;
};

export type PlaceModelResult = {
  ok: boolean;
  diagnostics: PlacementDiagnostics;
  error?: string;
};

export type WebXRSession = {
  dispose: () => void;
  placeAtReticle: (label: string, objectType?: PlacementObjectType) => boolean;
  /** Clears current model and places GLB or built-in mesh at floor reticle (swap). */
  placeCustomModelAtReticle: (options: PlaceModelOptions) => Promise<PlaceModelResult>;
  clearPlacedObjects: () => void;
  isReticleVisible: () => boolean;
  getStatusText: () => string;
  whenHitTestReady: (timeoutMs?: number) => Promise<boolean>;
  waitForFloorReticle: (timeoutMs?: number) => Promise<{ ok: boolean; waitedMs: number }>;
  getDiagnostics: () => {
    immersiveEntered: boolean;
    hitTestEnabled: boolean;
    inFullscreen: boolean;
    domOverlayActive: boolean;
  };
};

type PlacedEntry = { root: TransformNode; meshes: AbstractMesh[] };

/**
 * Start immersive-ar WebXR. Must be called directly from a user tap/click handler
 * so enterXRAsync keeps the user-activation grant on Android Chrome.
 * @param domOverlayRoot HTML layer composited over AR (WebXR dom-overlay); required for model buttons during AR.
 */
export async function tryStartWebXR(
  canvas: HTMLCanvasElement,
  domOverlayRoot: HTMLElement | null,
  onStatus: (msg: string) => void
): Promise<WebXRSession | null> {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = new Color3(0.85, 0.85, 0.9);

  const hemi = new HemisphericLight("ar-hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 1.35;
  hemi.groundColor = new Color3(0.35, 0.35, 0.4);
  hemi.diffuse = new Color3(1, 1, 1);

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

  const sessionInit: XRSessionInit = {
    optionalFeatures: ["hit-test", "anchors", "plane-detection"],
  };
  if (domOverlayRoot) {
    sessionInit.optionalFeatures = [
      ...(sessionInit.optionalFeatures ?? []),
      "dom-overlay",
    ];
    sessionInit.domOverlay = { root: domOverlayRoot };
    domOverlayRoot.classList.remove("hidden");
  }

  try {
    await base.enterXRAsync("immersive-ar", "local-floor", undefined, sessionInit);
    immersiveEntered = true;
    domOverlayActive = !!domOverlayRoot;
  } catch (e) {
    if (domOverlayRoot && String(e).includes("dom-overlay")) {
      onStatus("Retrying AR without overlay…");
      try {
        await base.enterXRAsync("immersive-ar", "local-floor", undefined, {
          optionalFeatures: ["hit-test", "anchors", "plane-detection"],
        });
        immersiveEntered = true;
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

  const anchorRoot = new TransformNode("anchors", scene);
  const placed: PlacedEntry[] = [];
  let markerCount = 0;
  let statusText =
    "AR camera active. Point at the floor and move slowly until the blue ring appears.";

  const reticle = MeshBuilder.CreateTorus(
    "reticle",
    { diameter: 0.28, thickness: 0.018, tessellation: 32 },
    scene
  );
  reticle.isVisible = false;
  reticle.isPickable = false;
  const reticleMat = new StandardMaterial("reticleMat", scene);
  reticleMat.emissiveColor = new Color3(0.2, 0.85, 1);
  reticleMat.alpha = 0.75;
  reticleMat.disableLighting = true;
  reticle.material = reticleMat;

  const latestPose = {
    position: new Vector3(),
    rotation: new Quaternion(),
    valid: false,
  };

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

  try {
    const hitTest = base.featuresManager.enableFeature(
      WebXRHitTest,
      "latest"
    ) as WebXRHitTest;
    hitTest.onHitTestResultObservable.add((results) => {
      if (!results.length) {
        reticle.isVisible = false;
        latestPose.valid = false;
        return;
      }
      results[0].transformationMatrix.decompose(
        undefined,
        latestPose.rotation,
        latestPose.position
      );
      reticle.position.copyFrom(latestPose.position);
      reticle.rotationQuaternion = latestPose.rotation;
      reticle.isVisible = true;
      latestPose.valid = true;
    });
    signalHitTestReady(true);
    statusText =
      "Move slowly along the floor — when the blue ring appears, placement is ready.";
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
    root.parent = anchorRoot;
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
        { diameter: 0.45, thickness: 0.02, tessellation: 48 },
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

  const clearPlaced = () => {
    for (const p of placed) {
      for (const m of p.meshes) m.dispose();
      p.root.dispose();
    }
    placed.length = 0;
  };

  const prepareMeshesForAR = (meshes: AbstractMesh[]): string[] => {
    const types: string[] = [];
    for (const mesh of meshes) {
      mesh.isVisible = true;
      mesh.setEnabled(true);
      mesh.isPickable = false;
      const mat = mesh.material;
      if (!mat) continue;
      const name = mat.getClassName();
      types.push(name);
      if (mat instanceof PBRMaterial) {
        mat.unlit = false;
        mat.environmentIntensity = 1;
        mat.directIntensity = 1;
        mat.specularIntensity = 0.35;
        if (mat.albedoColor) {
          const c = mat.albedoColor;
          const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
          if (lum < 0.08) {
            mat.emissiveColor = c.scale(0.4);
          }
        }
      } else if (mat instanceof StandardMaterial) {
        mat.disableLighting = false;
      }
    }
    return types;
  };

  engine.runRenderLoop(() => {
    scene.render();
  });

  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  document.body.classList.add("xr-session-active");

  return {
    placeAtReticle: (label: string, objectType: PlacementObjectType = "arrow") => {
      if (!latestPose.valid) {
        statusText = "No floor detected. Scan the floor slowly, then try again.";
        return false;
      }
      clearPlaced();
      markerCount += 1;
      placed.push(createFloorObject(objectType, label));
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

      if (!latestPose.valid) {
        statusText = "No floor detected. Scan the floor slowly, then try again.";
        return {
          ok: false,
          diagnostics: baseDiag(),
          error: statusText,
        };
      }
      clearPlaced();
      markerCount += 1;
      if (options.builtinType) {
        const entry = createFloorObject(options.builtinType, options.label);
        placed.push(entry);
        statusText = `Placed: ${options.label}`;
        const bounds = entry.root.getHierarchyBoundingVectors(true);
        const size = bounds.max.subtract(bounds.min);
        return {
          ok: true,
          diagnostics: {
            ...baseDiag(),
            loadMethod: "builtin",
            meshCount: entry.meshes.length,
            topLevelRoots: 1,
            boundsMin: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
            boundsMax: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
            sizeMeters: { x: size.x, y: size.y, z: size.z },
            maxDimensionM: Math.max(size.x, size.y, size.z),
            meshesVisible: entry.meshes.filter((m) => m.isVisible).length,
          },
        };
      }
      if (!options.modelUrl) {
        statusText = "Model file missing.";
        return { ok: false, diagnostics: baseDiag(), error: statusText };
      }

      const buildDiag = (
        loadMethod: string,
        wrapper: TransformNode,
        meshes: AbstractMesh[],
        transformNodeCount: number,
        topLevelRoots: number
      ): PlacementDiagnostics => {
        const bounds = wrapper.getHierarchyBoundingVectors(true);
        const size = bounds.max.subtract(bounds.min);
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
          boundsMin: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
          boundsMax: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
          sizeMeters: { x: size.x, y: size.y, z: size.z },
          maxDimensionM: Math.max(size.x, size.y, size.z),
          meshesVisible: meshes.filter((m) => m.isVisible && m.isEnabled()).length,
          modelUrl: options.modelUrl ?? undefined,
        };
      };

      try {
        const wrapper = new TransformNode(`placed-${markerCount}`, scene);
        wrapper.parent = anchorRoot;
        wrapper.position.copyFrom(latestPose.position);
        wrapper.rotationQuaternion = Quaternion.Identity();
        wrapper.scaling.setAll(1);

        let loadMethod = "ImportMeshAsync";
        let meshes: AbstractMesh[] = [];
        let transformNodeCount = 0;
        let topLevelRoots = 0;

        const imported = await SceneLoader.ImportMeshAsync(
          "",
          options.modelUrl,
          "",
          scene
        );
        transformNodeCount = imported.transformNodes.length;

        const rootTransforms = imported.transformNodes.filter((t) => !t.parent);
        topLevelRoots = rootTransforms.length;

        if (rootTransforms.length > 0) {
          for (const tn of rootTransforms) tn.parent = wrapper;
        } else if (imported.transformNodes.length > 0) {
          let top: TransformNode = imported.transformNodes[0];
          while (top.parent) {
            top = top.parent as TransformNode;
          }
          top.parent = wrapper;
          topLevelRoots = 1;
        } else {
          for (const mesh of imported.meshes) {
            if (!mesh.parent) mesh.parent = wrapper;
          }
        }

        meshes = wrapper.getChildMeshes(true);
        if (!meshes.length) {
          loadMethod = "AssetContainer.instantiate";
          const container = await SceneLoader.LoadAssetContainerAsync(
            options.modelUrl,
            "",
            scene
          );
          const instance = container.instantiateModelsToScene(
            (name) => `placed-${markerCount}-${name}`,
            false
          );
          container.dispose();
          transformNodeCount = instance.rootNodes.length;
          topLevelRoots = instance.rootNodes.length;
          for (const node of instance.rootNodes) {
            node.parent = wrapper;
          }
          meshes = wrapper.getChildMeshes(true);
        }

        if (!meshes.length) {
          wrapper.dispose();
          statusText = "Model had no meshes.";
          return {
            ok: false,
            diagnostics: { ...baseDiag(), loadMethod },
            error: statusText,
          };
        }

        const materialTypes = prepareMeshesForAR(meshes);

        placed.push({ root: wrapper, meshes });
        const diag = buildDiag(loadMethod, wrapper, meshes, transformNodeCount, topLevelRoots);
        diag.materialTypes = [...new Set(materialTypes)].join(", ");
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
    isReticleVisible: () => reticle.isVisible && latestPose.valid,
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
    waitForFloorReticle: async (timeoutMs = 20000) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeoutMs) {
        if (reticle.isVisible && latestPose.valid) {
          return { ok: true, waitedMs: Math.round(performance.now() - t0) };
        }
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      }
      return { ok: false, waitedMs: Math.round(performance.now() - t0) };
    },
    getDiagnostics: () => ({
      immersiveEntered,
      hitTestEnabled,
      inFullscreen: document.fullscreenElement === canvas,
      domOverlayActive,
    }),
    dispose: () => {
      document.body.classList.remove("xr-session-active");
      domOverlayRoot?.classList.add("hidden");
      if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      }
      window.removeEventListener("resize", resize);
      reticle.dispose();
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
