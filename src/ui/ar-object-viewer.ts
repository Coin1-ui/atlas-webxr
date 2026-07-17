import {
  ArcRotateCamera,
  Color4,
  Engine,
  Material,
  Scene,
  TransformNode,
  Vector3,
  type AssetContainer,
} from "@babylonjs/core";
import { absoluteModelUrl } from "../data/glb-cache";
import {
  ensureGlbParsed,
  ensurePreviewContainer,
  getPreviewContainerForUrl,
  instantiatePreviewFromContainer,
  disposePreviewContainers,
} from "../xr/shared/glb-offline-cache";
import {
  applyObjectPreviewEnvironment,
  applyPreviewIblFast,
  getLastPreviewHdrError,
  getLastPreviewHdrSourceUrl,
  getPreviewEnvironmentSource,
  preloadObjectPreviewHdr,
  prefetchNeutralHdrBlob,
  prefetchPreviewNeutralHdrDecode,
  collectMaterialsFromRoots,
  scanPbrMaterials,
  schedulePreviewHdrRetries,
  tunePreviewMaterials,
  upgradePreviewNeutralHdr,
} from "../xr/shared/ar-pbr-environment";
import { arModeSegmentHtml } from "./ar-model-picker";
import { bindArPanelTouch } from "./ar-panel-touch";

const OBJECT_VIEWER_ID = "ar-object-viewer";
const PREVIEW_CANVAS_ID = "ar-object-preview-canvas";
const PREVIEW_CANVAS_CLASS = "ar-object-viewer-canvas";

export type ArObjectViewerOptions = {
  modelUrl: string;
  modelName: string;
  onBackToAr: () => void;
  sessionLogDownload?: boolean;
  onDownloadLog?: () => void;
};

export type ArObjectViewerLoadResult = {
  loadMs: number;
  loadMethod: "cache-instantiate" | "cache-parse" | "cold-parse";
  previewContainerCached: boolean;
  previewSceneHasEnvironment: boolean;
  previewEnvironmentIntensity: number | null;
  previewNeutralHdr: boolean;
  previewHdrError: string | null;
  previewHdrSourceUrl: string | null;
  previewMeshCount: number;
  previewMeshesVisible: number;
  pbrCount: number;
  withMetallicRoughnessTexture: number;
};

type PreviewRuntime = {
  engine: Engine | null;
  scene: Scene | null;
  templateContainer: AssetContainer | null;
  roots: TransformNode[];
  warmedUrl: string | null;
  resizeObserver: ResizeObserver | null;
};

let previewRuntime: PreviewRuntime = {
  engine: null,
  scene: null,
  templateContainer: null,
  roots: [],
  warmedUrl: null,
  resizeObserver: null,
};

let previewWarmupPromise: Promise<void> | null = null;
let previewContainerWarmPromise: Promise<void> | null = null;

const PREVIEW_WARMUP_MAX_MS = 4000;
const PREVIEW_CONTAINER_WARM_MAX_MS = 18000;
const PREVIEW_LOAD_TIMEOUT_MS = 25000;

function withPreviewTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out (${Math.round(ms / 1000)}s)`)), ms);
    }),
  ]);
}

async function drainPreviewWarmup(maxMs = PREVIEW_WARMUP_MAX_MS): Promise<void> {
  if (!previewWarmupPromise) return;
  await Promise.race([
    previewWarmupPromise.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

function yieldAnimationFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function countPreviewMeshes(roots: TransformNode[]): number {
  let count = 0;
  for (const root of roots) {
    count += root.getChildMeshes(false).length;
  }
  return count;
}

function countPreviewMeshesVisible(roots: TransformNode[]): number {
  let count = 0;
  for (const root of roots) {
    for (const mesh of root.getChildMeshes(false)) {
      if (mesh.isEnabled() && mesh.isVisible) count += 1;
    }
  }
  return count;
}

function forcePreviewRender(engine: Engine, scene: Scene, frames = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = frames;
    const step = () => {
      engine.resize();
      scene.render();
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

let previewHdrBootstrapPromise: Promise<boolean> | null = null;

/** Background neutral.hdr decode — must not block model instantiate. */
function startPreviewHdrUpgrade(scene: Scene): Promise<boolean> {
  if (getPreviewEnvironmentSource(scene) === "preview-neutral-hdr") {
    return Promise.resolve(true);
  }
  if (!previewHdrBootstrapPromise) {
    if (!scene.environmentTexture) {
      applyPreviewIblFast(scene);
    }
    previewHdrBootstrapPromise = upgradePreviewNeutralHdr(scene).finally(() => {
      previewHdrBootstrapPromise = null;
    });
  }
  return previewHdrBootstrapPromise;
}

function retunePreviewWhenHdrReady(scene: Scene, hdrUpgrade: Promise<boolean>): void {
  const retune = () => {
    if (previewRuntime.roots.length === 0) return;
    tunePreviewMaterials(scene, previewRuntime.roots);
  };
  void hdrUpgrade.then((ok) => {
    if (ok) retune();
  });
  schedulePreviewHdrRetries(scene, retune);
}

export function prefetchArObjectViewer(): Promise<void> {
  return (async () => {
    await prefetchNeutralHdrBlob();
    const canvas = ensurePreviewCanvasElement();
    const { scene } = ensurePreviewEngine(canvas);
    if (!scene.environmentTexture) {
      applyPreviewIblFast(scene);
    }
    // Decode HDR to GPU cache only — bind after model is visible on 3D toggle.
    await prefetchPreviewNeutralHdrDecode(scene);
  })();
}

/** After AR placement — parse GLB + HDR on a hidden canvas so 3D toggle is instant. */
export function warmObjectPreviewModel(modelUrl: string): void {
  const key = absoluteModelUrl(modelUrl);
  const existing = getPreviewContainerForUrl(modelUrl);
  if (previewRuntime.warmedUrl === key && existing) {
    return;
  }
  previewWarmupPromise = runPreviewWarmup(modelUrl).catch(() => {
    /* non-fatal — toggle will parse on demand */
  });
}

async function runPreviewWarmup(modelUrl: string): Promise<void> {
  await ensureGlbParsed(modelUrl);
  if (document.body.classList.contains("xr-session-active")) {
    void preloadObjectPreviewHdr();
    previewContainerWarmPromise = warmPreviewContainerDuringXr(modelUrl);
    return;
  }
  const canvas = ensurePreviewCanvasElement();
  const { scene } = ensurePreviewEngine(canvas);
  await applyObjectPreviewEnvironment(scene);
  const container = await ensurePreviewContainer(modelUrl, scene);
  previewRuntime.templateContainer = container;
  previewRuntime.warmedUrl = absoluteModelUrl(modelUrl);
}

/** Parse GLB on hidden preview WebGL after offline warm — spreads work before 3D toggle. */
async function warmPreviewContainerDuringXr(modelUrl: string): Promise<void> {
  const key = absoluteModelUrl(modelUrl);
  await yieldAnimationFrames(8);
  const canvas = ensurePreviewCanvasElement();
  const { scene, engine } = ensurePreviewEngine(canvas);
  const existing = getPreviewContainerForUrl(modelUrl);
  if (existing?.scene === scene) {
    previewRuntime.templateContainer = existing;
    previewRuntime.warmedUrl = key;
    if (!scene.environmentTexture) {
      applyPreviewIblFast(scene);
    }
    void prefetchPreviewNeutralHdrDecode(scene);
    return;
  }
  try {
    await withPreviewTimeout(
      (async () => {
        engine.resize();
        if (!scene.environmentTexture) {
          applyPreviewIblFast(scene);
        }
        void prefetchPreviewNeutralHdrDecode(scene);
        const container = await ensurePreviewContainer(modelUrl, scene, 20000);
        previewRuntime.templateContainer = container;
        previewRuntime.warmedUrl = key;
      })(),
      PREVIEW_CONTAINER_WARM_MAX_MS,
      "Preview container warm"
    );
  } catch {
    /* toggle will parse on demand */
  }
}

/** One canvas for the preview engine — reparented into the viewer stage when visible. */
function ensurePreviewCanvasElement(stage?: HTMLElement | null): HTMLCanvasElement {
  let canvas = document.getElementById(PREVIEW_CANVAS_ID) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = PREVIEW_CANVAS_ID;
    canvas.className = PREVIEW_CANVAS_CLASS;
    canvas.setAttribute("aria-label", "3D model preview");
  }
  if (stage) {
    const hint = stage.querySelector(".ar-object-viewer-hint");
    if (canvas.parentElement !== stage) {
      if (hint?.nextSibling) stage.insertBefore(canvas, hint.nextSibling);
      else stage.appendChild(canvas);
    }
    canvas.style.cssText = "";
  } else if (canvas.parentElement?.id !== OBJECT_VIEWER_ID) {
    canvas.style.cssText =
      "position:fixed;width:4px;height:4px;opacity:0;pointer-events:none;left:-9999px;top:0;";
    if (!canvas.parentElement) document.body.appendChild(canvas);
  }
  previewRuntime.engine?.resize();
  return canvas;
}

/** During WebXR, only #ar-overlay descendants composite — mount viewer there. */
function overlayHost(): HTMLElement {
  if (document.body.classList.contains("xr-session-active")) {
    const overlay = document.getElementById("ar-overlay");
    if (overlay) return overlay;
  }
  return document.body;
}

function getRoot(): HTMLElement {
  const host = overlayHost();
  let root = document.querySelector(`#${OBJECT_VIEWER_ID}`) as HTMLElement | null;
  if (root && root.parentElement !== host) {
    host.prepend(root);
  }
  if (root) return root;
  root = document.createElement("div");
  root.id = OBJECT_VIEWER_ID;
  root.className = "ar-object-viewer hidden";
  root.setAttribute("aria-hidden", "true");
  host.prepend(root);
  return root;
}

function clearPreviewRoots(): void {
  for (const root of previewRuntime.roots) {
    try {
      root.dispose();
    } catch {
      /* disposed with scene */
    }
  }
  previewRuntime.roots = [];
}

function disposePreviewRuntime(): void {
  previewRuntime.resizeObserver?.disconnect();
  previewRuntime.resizeObserver = null;
  clearPreviewRoots();
  previewRuntime.templateContainer = null;
  previewRuntime.warmedUrl = null;
  try {
    previewRuntime.scene?.dispose();
  } catch {
    /* engine dispose */
  }
  previewRuntime.scene = null;
  try {
    previewRuntime.engine?.dispose();
  } catch {
    /* already disposed */
  }
  previewRuntime.engine = null;
  document.getElementById(PREVIEW_CANVAS_ID)?.remove();
  disposePreviewContainers();
}

function bindChromeHandlers(root: HTMLElement, options: ArObjectViewerOptions): void {
  const chrome = root.querySelector(".ar-object-viewer-chrome") as HTMLElement | null;
  if (!chrome) return;
  bindArPanelTouch(chrome, (action) => {
    if (action === "exit-object-mode" || action === "mode-ar") {
      options.onBackToAr();
    }
    if (action === "log") {
      options.onDownloadLog?.();
    }
  });
}

function renderShell(root: HTMLElement, options: ArObjectViewerOptions): void {
  if (root.querySelector(".ar-object-viewer-header")) return;
  const showLog = options.sessionLogDownload === true && Boolean(options.onDownloadLog);
  root.innerHTML = `
    <div class="ar-object-viewer-chrome ar-panel-glass ar-panel-touch">
      <header class="ar-object-viewer-header">
        <div class="ar-object-viewer-title">
          <span class="ar-object-viewer-kicker">3D preview</span>
          <span class="ar-object-viewer-name"></span>
        </div>
        ${arModeSegmentHtml(true, true)}
      </header>
      <div class="ar-object-viewer-stage">
        <p class="ar-object-viewer-hint">Drag to rotate · Pinch to zoom</p>
        <p class="ar-object-viewer-loading" aria-live="polite">Loading 3D model…</p>
      </div>
      <div class="ar-panel-actions ar-panel-actions--modern ar-object-viewer-footer">
        ${showLog ? `<button type="button" class="ar-action-btn ar-action-btn-log" data-action="log">JSON</button>` : ""}
        <button type="button" class="ar-action-btn ar-action-btn-log" data-action="exit-object-mode">Exit 3D</button>
      </div>
    </div>
  `;
  bindChromeHandlers(root, options);
}

function framePreviewCamera(camera: ArcRotateCamera, roots: TransformNode[]): void {
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const root of roots) {
    root.computeWorldMatrix(true);
    for (const mesh of root.getChildMeshes(false)) {
      mesh.refreshBoundingInfo(true, false);
      const bi = mesh.getBoundingInfo();
      if (!bi) continue;
      min = Vector3.Minimize(min, bi.boundingBox.minimumWorld);
      max = Vector3.Maximize(max, bi.boundingBox.maximumWorld);
    }
  }
  if (!Number.isFinite(min.x)) {
    camera.setTarget(Vector3.Zero());
    camera.radius = 2;
    return;
  }
  const center = min.add(max).scale(0.5);
  const extent = max.subtract(min);
  const radius = Math.max(extent.x, extent.y, extent.z, 0.25) * 1.35;
  camera.setTarget(center);
  camera.radius = radius;
  camera.alpha = -Math.PI / 4;
  camera.beta = Math.PI / 2.6;
  camera.minZ = radius * 0.01;
  camera.maxZ = radius * 20;
}

async function loadPreviewModel(
  scene: Scene,
  modelUrl: string,
  timeoutMs = 20000
): Promise<{ roots: TransformNode[]; loadMethod: ArObjectViewerLoadResult["loadMethod"] }> {
  const key = absoluteModelUrl(modelUrl);
  await drainPreviewWarmup();
  if (previewContainerWarmPromise) {
    await Promise.race([
      previewContainerWarmPromise.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 800)),
    ]);
  }

  const hadContainer =
    Boolean(getPreviewContainerForUrl(modelUrl)) &&
    getPreviewContainerForUrl(modelUrl)?.scene === scene;
  const container = await ensurePreviewContainer(modelUrl, scene, timeoutMs);
  previewRuntime.templateContainer = container;
  previewRuntime.warmedUrl = key;
  const roots = instantiatePreviewFromContainer(container);
  tunePreviewMaterials(scene, roots);
  const loadMethod: ArObjectViewerLoadResult["loadMethod"] = hadContainer
    ? "cache-instantiate"
    : previewRuntime.warmedUrl === key && getPreviewContainerForUrl(modelUrl)?.scene === scene
      ? "cache-parse"
      : "cold-parse";
  return { roots, loadMethod };
}

function ensurePreviewEngine(canvas: HTMLCanvasElement): { engine: Engine; scene: Scene; camera: ArcRotateCamera } {
  if (previewRuntime.engine && previewRuntime.scene) {
    if (previewRuntime.engine.getRenderingCanvas() !== canvas) {
      previewRuntime.engine = null;
      previewRuntime.scene = null;
    } else {
      return {
        engine: previewRuntime.engine,
        scene: previewRuntime.scene,
        camera: previewRuntime.scene.activeCamera as ArcRotateCamera,
      };
    }
  }
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  applyPreviewIblFast(scene);
  void prefetchPreviewNeutralHdrDecode(scene);
  const camera = new ArcRotateCamera(
    "preview-camera",
    -Math.PI / 4,
    Math.PI / 2.6,
    2,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 60;
  camera.pinchPrecision = 60;
  camera.lowerRadiusLimit = 0.15;
  camera.upperRadiusLimit = 50;
  scene.activeCamera = camera;
  engine.runRenderLoop(() => {
    scene.render();
  });
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  previewRuntime.resizeObserver = new ResizeObserver(resize);
  previewRuntime.resizeObserver.observe(canvas);
  previewRuntime.engine = engine;
  previewRuntime.scene = scene;
  return { engine, scene, camera };
}

function setLoadingVisible(root: HTMLElement, visible: boolean, message?: string): void {
  const loading = root.querySelector(".ar-object-viewer-loading") as HTMLElement | null;
  if (!loading) return;
  loading.classList.toggle("hidden", !visible);
  if (message) loading.textContent = message;
}

function patchJsonFooter(root: HTMLElement, options: ArObjectViewerOptions): void {
  const foot = root.querySelector(".ar-object-viewer-footer");
  if (!foot) return;
  const show = options.sessionLogDownload === true && Boolean(options.onDownloadLog);
  let logBtn = foot.querySelector<HTMLButtonElement>("[data-action=log]");
  if (show) {
    if (!logBtn) {
      const exitBtn = foot.querySelector("[data-action=exit-object-mode]");
      const html = `<button type="button" class="ar-action-btn ar-action-btn-log" data-action="log">JSON</button>`;
      if (exitBtn) exitBtn.insertAdjacentHTML("beforebegin", html);
      else foot.insertAdjacentHTML("afterbegin", html);
    }
  } else {
    logBtn?.remove();
  }
}

export function isArObjectViewerVisible(): boolean {
  const root = overlayHost().querySelector(`#${OBJECT_VIEWER_ID}`);
  return Boolean(root && !root.classList.contains("hidden"));
}

export function showArObjectViewerLoading(options: ArObjectViewerOptions): void {
  const root = getRoot();
  renderShell(root, options);
  bindChromeHandlers(root, options);
  patchJsonFooter(root, options);

  const nameEl = root.querySelector(".ar-object-viewer-name");
  if (nameEl) nameEl.textContent = options.modelName;

  const stage = root.querySelector(".ar-object-viewer-stage") as HTMLElement | null;
  if (stage) {
    ensurePreviewCanvasElement(stage);
    previewRuntime.engine?.resize();
  }

  setLoadingVisible(root, true, "Loading 3D model…");

  root.classList.remove("hidden");
  root.setAttribute("aria-hidden", "false");
  document.body.classList.add("ar-object-mode-active");
}

function collectPreviewMaterials(roots: TransformNode[]): Material[] {
  return collectMaterialsFromRoots(roots);
}

async function finishArObjectViewerLoadInner(
  options: ArObjectViewerOptions
): Promise<ArObjectViewerLoadResult> {
  const t0 = performance.now();
  const root = getRoot();
  bindChromeHandlers(root, options);
  patchJsonFooter(root, options);

  const stage = root.querySelector(".ar-object-viewer-stage") as HTMLElement | null;
  if (!stage) throw new Error("3D preview shell missing.");
  const canvas = ensurePreviewCanvasElement(stage);
  setLoadingVisible(root, true, "Loading 3D model…");

  clearPreviewRoots();
  const { engine, scene, camera } = ensurePreviewEngine(canvas);
  await yieldAnimationFrames(1);
  engine.resize();
  // Always start with bright fallback IBL so the model is visible on frame 1.
  applyPreviewIblFast(scene);
  const { roots, loadMethod } = await loadPreviewModel(scene, options.modelUrl);
  previewRuntime.roots = roots;
  tunePreviewMaterials(scene, roots);
  framePreviewCamera(camera, roots);
  setLoadingVisible(root, false);
  await forcePreviewRender(engine, scene, 2);
  // HDR bind + chrome retune in background — never block first paint.
  const hdrUpgrade = startPreviewHdrUpgrade(scene);
  void hdrUpgrade.then((hdrBound) => {
    if (!hdrBound || !previewRuntime.roots.length) return;
    tunePreviewMaterials(scene, previewRuntime.roots);
    void forcePreviewRender(engine, scene, 1);
  });
  retunePreviewWhenHdrReady(scene, hdrUpgrade);

  const pbrDiag = roots.length
    ? scanPbrMaterials(roots[0]!, () => collectPreviewMaterials(roots))
    : null;
  const previewEnvSource = getPreviewEnvironmentSource(scene);

  return {
    loadMs: Math.round(performance.now() - t0),
    loadMethod,
    previewContainerCached: loadMethod === "cache-instantiate",
    previewSceneHasEnvironment: Boolean(scene.environmentTexture),
    previewEnvironmentIntensity:
      scene.environmentIntensity != null
        ? Math.round(scene.environmentIntensity * 100) / 100
        : null,
    previewNeutralHdr: previewEnvSource === "preview-neutral-hdr",
    previewHdrError: getLastPreviewHdrError(),
    previewHdrSourceUrl: getLastPreviewHdrSourceUrl(),
    previewMeshCount: countPreviewMeshes(roots),
    previewMeshesVisible: countPreviewMeshesVisible(roots),
    pbrCount: pbrDiag?.pbrCount ?? 0,
    withMetallicRoughnessTexture: pbrDiag?.withMetallicRoughnessTexture ?? 0,
  };
}

export async function finishArObjectViewerLoad(
  options: ArObjectViewerOptions
): Promise<ArObjectViewerLoadResult> {
  return withPreviewTimeout(
    finishArObjectViewerLoadInner(options),
    PREVIEW_LOAD_TIMEOUT_MS,
    "3D preview load"
  );
}

export async function showArObjectViewer(options: ArObjectViewerOptions): Promise<ArObjectViewerLoadResult> {
  showArObjectViewerLoading(options);
  return finishArObjectViewerLoad(options);
}

export function hideArObjectViewer(): void {
  const root = overlayHost().querySelector(`#${OBJECT_VIEWER_ID}`);
  if (!root) return;
  root.classList.add("hidden");
  root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("ar-object-mode-active");
  clearPreviewRoots();
  ensurePreviewCanvasElement();
  setLoadingVisible(root as HTMLElement, true, "Loading 3D model…");
}

export function disposeArObjectViewer(): void {
  hideArObjectViewer();
  disposePreviewRuntime();
  previewWarmupPromise = null;
  previewContainerWarmPromise = null;
  overlayHost().querySelector(`#${OBJECT_VIEWER_ID}`)?.remove();
}
