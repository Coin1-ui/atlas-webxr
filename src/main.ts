import "./style.css";
import { getCameraSupport, stopCameraFeed } from "./xr/fallback-camera";
import type { WebXRSession } from "./xr/webxr-ar";
import { renderHomeMinimal } from "./ui/home-minimal";
import { downloadDeviceTestReport } from "./device-test/export";
import { runDeviceHardwareCheck } from "./device-test/runner";
import {
  renderDeviceTestArStart,
  renderDeviceTestComplete,
  renderDeviceTestRunning,
} from "./ui/device-test-screen";
import {
  fetchCatalog,
  getCatalogAssets,
  resolveCatalogAssets,
  defaultIconForBuiltin,
} from "./data/model-catalog";
import { fetchAdminManifest } from "./data/model-admin-api";
import {
  renderArModelPicker,
  renderArScanning,
  type ModelPickerItem,
} from "./ui/ar-model-picker";
import { renderPcModelManager } from "./ui/model-manager-pc";
import { isDesktopAdmin } from "./utils/device";
import {
  startArSessionLog,
  logArEvent,
  downloadArSessionReport,
  finishArSessionReport,
} from "./ar-session/logger";

const app = document.getElementById("app")!;
const arOverlay = document.getElementById("ar-overlay")!;
const video = document.getElementById("camera-feed") as HTMLVideoElement;
const xrCanvas = document.getElementById("xr-canvas") as HTMLCanvasElement;

let webxr: WebXRSession | null = null;
let deviceTestCancelled = false;
let deviceTestArHint = "";
let lastDeviceTestReport: import("./device-test/types").DeviceTestReport | null = null;
let activeModelId: string | null = null;
let arFloorReady = false;
let pickerItemsCache: ModelPickerItem[] = [];

function setBodyTrainingState(state: "home" | "webxr"): void {
  document.body.classList.remove("training-camera", "xr-session-active");
  if (state === "webxr") document.body.classList.add("xr-session-active");
}

function showVideo(show: boolean): void {
  video.classList.toggle("hidden", !show);
}

function showXrCanvas(show: boolean): void {
  xrCanvas.classList.toggle("hidden", !show);
}

function setArOverlayVisible(show: boolean): void {
  arOverlay.classList.toggle("hidden", !show);
  if (!show) arOverlay.innerHTML = "";
}

function clearSession(options?: { skipSessionLog?: boolean }): void {
  if (webxr && !options?.skipSessionLog) {
    logArEvent("session-end", "AR session ended", "info");
    finishArSessionReport();
  }
  pickerItemsCache = [];
  stopCameraFeed(video);
  webxr?.dispose();
  webxr = null;
  showVideo(false);
  showXrCanvas(false);
  setArOverlayVisible(false);
  setBodyTrainingState("home");
  activeModelId = null;
  arFloorReady = false;
}

function goHome(): void {
  clearSession();
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  const camera = getCameraSupport();
  renderHomeMinimal(app, {
    cameraWarning: camera.ok ? undefined : camera.detail ?? camera.message,
    onStartAr: () => renderStartArPrompt(),
    onRunDeviceCheck: () => void runDeviceCheck(),
    onManageModels: isDesktopAdmin()
      ? () => {
          location.hash = "manage-models";
          void showPcModelAdmin();
        }
      : undefined,
  });
}

async function showPcModelAdmin(): Promise<void> {
  clearSession();
  const models = await fetchAdminManifest();
  renderPcModelManager(app, models, {
    onBack: () => goHome(),
    onChanged: () => void showPcModelAdmin(),
  });
}

function routeApp(): void {
  if (location.hash === "manage-models" && isDesktopAdmin()) {
    void showPcModelAdmin();
    return;
  }
  goHome();
}

function renderStartArPrompt(): void {
  renderDeviceTestArStart(
    app,
    () => void enterArPlacementMode(),
    () => goHome(),
    "Start AR",
    "Opens the AR camera. After the floor is detected, tap a model icon to place or swap."
  );
}

async function loadPickerItemsCache(): Promise<ModelPickerItem[]> {
  const records = await fetchCatalog();
  pickerItemsCache = records.map((r) => {
    const { iconUrl } = resolveCatalogAssets(r);
    const iconSrc =
      iconUrl ??
      (r.builtinType ? defaultIconForBuiltin(r.builtinType) : defaultIconForBuiltin("pad"));
    return { ...r, iconSrc };
  });
  return pickerItemsCache;
}

async function refreshArPicker(): Promise<void> {
  if (!webxr) return;
  if (!pickerItemsCache.length) await loadPickerItemsCache();
  renderArModelPicker(arOverlay, {
    items: pickerItemsCache,
    activeId: activeModelId,
    statusText: webxr.getStatusText(),
    floorReady: arFloorReady,
    onSelect: (id) => void placeModelById(id),
    onDownloadLog: () => downloadArSessionReport(finishArSessionReport()),
    onExit: () => goHome(),
  });
}

async function placeModelById(id: string): Promise<void> {
  if (!webxr) return;
  const assets = await getCatalogAssets(id);
  if (!assets) {
    logArEvent("model-place", `Place model: ${id}`, "fail", {
      error: "Model not found in catalog",
    });
    return;
  }
  logArEvent("model-place-attempt", `Place: ${assets.record.name}`, "info", {
    details: {
      modelId: id,
      modelUrl: assets.modelUrl ?? "builtin",
      floorReady: arFloorReady,
      reticleVisible: webxr.isReticleVisible(),
    },
  });
  const result = await webxr.placeCustomModelAtReticle({
    label: assets.record.name,
    modelUrl: assets.modelUrl,
    builtinType: assets.record.builtinType,
  });
  logArEvent(
    "model-place-result",
    result.ok ? `Placed: ${assets.record.name}` : `Place failed: ${assets.record.name}`,
    result.ok ? "ok" : "fail",
    {
      details: result.diagnostics as unknown as Record<
        string,
        string | number | boolean | null | undefined
      >,
      error: result.error,
    }
  );
  if (result.ok) activeModelId = id;
  arFloorReady = webxr.isReticleVisible();
  await refreshArPicker();
}

async function enterArPlacementMode(): Promise<void> {
  clearSession({ skipSessionLog: true });
  startArSessionLog();
  showVideo(false);
  showXrCanvas(true);
  setBodyTrainingState("webxr");
  setArOverlayVisible(true);

  renderArScanning(arOverlay, "Starting AR camera…", () => goHome());

  const { tryStartWebXR } = await import("./xr/webxr-ar");
  webxr = await tryStartWebXR(xrCanvas, arOverlay, (msg) => {
    renderArScanning(arOverlay, msg, () => goHome());
  });

  if (!webxr) {
    logArEvent("ar-start", "WebXR start", "fail", {
      error: "Session null",
    });
    alert("AR could not start. Use Chrome on Android and allow camera access.");
    goHome();
    return;
  }

  const diag = webxr.getDiagnostics();
  logArEvent("ar-start", "WebXR session active", "ok", {
    details: diag as unknown as Record<string, string | number | boolean | null | undefined>,
  });

  const hitReady = await webxr.whenHitTestReady(10000);
  logArEvent("hit-test", "Hit-test ready", hitReady ? "ok" : "fail", {
    details: { hitTestReady: hitReady },
  });

  renderArScanning(arOverlay, "Point at the floor and move slowly…", () => goHome());

  const floor = await webxr.waitForFloorReticle(45000);
  arFloorReady = floor.ok;
  logArEvent("floor-scan", "Floor reticle scan", floor.ok ? "ok" : "fail", {
    details: {
      floorWaitMs: floor.waitedMs,
      reticleVisible: webxr.isReticleVisible(),
    },
  });

  const catalog = await fetchCatalog();
  logArEvent("catalog", "Model catalog loaded", "info", {
    details: {
      modelCount: catalog.length,
      modelIds: catalog.map((m) => m.id).join(", "),
    },
  });

  await loadPickerItemsCache();
  await refreshArPicker();
}

function renderDeviceTestProgress(
  progress: import("./device-test/types").DeviceTestProgress
): void {
  renderDeviceTestRunning(
    app,
    progress,
    () => {
      deviceTestCancelled = true;
      goHome();
    },
    { arHint: deviceTestArHint || undefined }
  );
}

function beginDeviceTestArSession(): Promise<WebXRSession | null> {
  return new Promise((resolve) => {
    renderDeviceTestArStart(
      app,
      () => {
        void (async () => {
          showXrCanvas(true);
          setBodyTrainingState("webxr");
          setArOverlayVisible(true);
          const { tryStartWebXR } = await import("./xr/webxr-ar");
          const session = await tryStartWebXR(xrCanvas, arOverlay, (msg) => {
            deviceTestArHint = msg;
          });
          resolve(session);
        })();
      },
      () => resolve(null),
      "Start AR camera",
      "Required on Android — opens immersive AR with the real camera."
    );
  });
}

async function runDeviceCheck(): Promise<void> {
  clearSession();
  deviceTestCancelled = false;
  deviceTestArHint = "";
  lastDeviceTestReport = null;

  renderDeviceTestProgress({
    stepIndex: 0,
    totalSteps: 8,
    currentName: "Starting…",
    steps: [],
  });

  if (deviceTestCancelled) return;

  const report = await runDeviceHardwareCheck(
    {
      video,
      xrCanvas,
      setBodyState: (s) => {
        document.body.classList.remove("training-camera", "xr-session-active");
        if (s === "camera") document.body.classList.add("training-camera");
        if (s === "webxr") document.body.classList.add("xr-session-active");
      },
      showVideo,
      showXrCanvas,
      beginArSession: beginDeviceTestArSession,
      onArHint: (hint) => {
        deviceTestArHint = hint;
      },
    },
    (progress) => {
      if (deviceTestCancelled) return;
      renderDeviceTestProgress(progress);
    }
  );

  if (deviceTestCancelled) return;

  setArOverlayVisible(false);
  lastDeviceTestReport = report;
  renderDeviceTestComplete(
    app,
    report,
    () => {
      if (lastDeviceTestReport) downloadDeviceTestReport(lastDeviceTestReport);
    },
    goHome
  );
}

window.addEventListener("hashchange", () => routeApp());
routeApp();
