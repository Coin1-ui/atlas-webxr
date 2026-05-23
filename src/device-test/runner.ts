import { loadModule } from "../data/module-store";
import { getCameraSupport, startCameraFeed, stopCameraFeed } from "../xr/fallback-camera";
import { isWebXRARAvailable } from "../xr/mode-detector";
import type { WebXRSession } from "../xr/webxr-ar";
import type {
  DeviceTestProgress,
  DeviceTestReport,
  DeviceTestStep,
  DeviceTestStatus,
} from "./types";

type ProgressFn = (p: DeviceTestProgress) => void;

type StepResult = {
  status: DeviceTestStatus;
  details?: DeviceTestStep["details"];
  error?: string;
};

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve(true);
      return;
    }
    const t = setTimeout(() => {
      cleanup();
      resolve(video.videoWidth > 0);
    }, timeoutMs);
    const onReady = () => {
      cleanup();
      resolve(video.videoWidth > 0);
    };
    const cleanup = () => {
      clearTimeout(t);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("playing", onReady);
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("playing", onReady);
  });
}

async function runStep(
  id: string,
  name: string,
  fn: () => Promise<StepResult>,
  steps: DeviceTestStep[],
  onProgress: ProgressFn,
  total: number
): Promise<void> {
  const t0 = performance.now();
  onProgress({
    stepIndex: steps.length + 1,
    totalSteps: total,
    currentName: name,
    steps: [...steps],
  });
  try {
    const result = await fn();
    steps.push({
      id,
      name,
      status: result.status,
      durationMs: Math.round(performance.now() - t0),
      details: result.details,
      error: result.error,
    });
  } catch (e) {
    steps.push({
      id,
      name,
      status: "failed",
      durationMs: Math.round(performance.now() - t0),
      error: e instanceof Error ? e.message : String(e),
    });
  }
  onProgress({
    stepIndex: steps.length,
    totalSteps: total,
    currentName: name,
    steps: [...steps],
  });
}

export type DeviceTestContext = {
  video: HTMLVideoElement;
  xrCanvas: HTMLCanvasElement;
  setBodyState: (s: "home" | "camera" | "webxr") => void;
  showVideo: (show: boolean) => void;
  showXrCanvas: (show: boolean) => void;
  /** User taps "Start AR camera" — must call tryStartWebXR inside that handler (Android). */
  beginArSession: () => Promise<import("../xr/webxr-ar").WebXRSession | null>;
  onArHint?: (hint: string) => void;
};

const FLOOR_SCAN_TIMEOUT_MS = 22000;

export async function runDeviceHardwareCheck(
  ctx: DeviceTestContext,
  onProgress: ProgressFn
): Promise<DeviceTestReport> {
  const startedAt = new Date().toISOString();
  const tStart = performance.now();
  const steps: DeviceTestStep[] = [];
  const totalSteps = 8;
  let activeArSession: WebXRSession | null = null;

  const cleanup = () => {
    stopCameraFeed(ctx.video);
    activeArSession?.dispose();
    activeArSession = null;
    ctx.showVideo(false);
    ctx.showXrCanvas(false);
    ctx.setBodyState("home");
  };

  try {
    await runStep(
      "secure-context",
      "HTTPS secure context",
      async () => ({
        status: window.isSecureContext ? "passed" : "failed",
        details: { protocol: location.protocol, host: location.host },
        error: window.isSecureContext ? undefined : "Use https:// address, not http://",
      }),
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "camera-api",
      "Camera API available",
      async () => {
        const s = getCameraSupport();
        return {
          status: s.ok ? "passed" : "failed",
          details: { message: s.message },
          error: s.ok ? undefined : s.detail ?? s.message,
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "camera-stream",
      "Live camera stream",
      async () => {
        ctx.setBodyState("camera");
        ctx.showVideo(true);
        const cam = await startCameraFeed(ctx.video);
        if (!cam.ok) {
          return { status: "failed", error: cam.detail ?? cam.message };
        }
        const ready = await waitForVideoReady(ctx.video, 8000);
        const w = ctx.video.videoWidth;
        const h = ctx.video.videoHeight;
        const hasStream = !!(ctx.video.srcObject as MediaStream | null);
        return {
          status: ready && hasStream ? "passed" : "failed",
          details: { videoWidth: w, videoHeight: h, hasStream },
          error: ready ? undefined : "Camera stream did not become ready in time",
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "camera-visible",
      "Camera visible behind UI",
      async () => {
        const style = getComputedStyle(ctx.video);
        const visible =
          !ctx.video.classList.contains("hidden") && style.display !== "none";
        return {
          status: visible ? "passed" : "failed",
          details: { display: style.display },
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "webxr-support",
      "WebXR AR supported",
      async () => {
        const ok = await isWebXRARAvailable();
        return {
          status: ok ? "passed" : "skipped",
          details: { immersiveAr: ok },
          error: ok ? undefined : "AR floor placement not available in this browser",
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "webxr-session",
      "WebXR AR session starts",
      async () => {
        const supported = await isWebXRARAvailable();
        if (!supported) {
          return { status: "skipped", details: { reason: "immersive-ar not supported" } };
        }
        ctx.onArHint?.("Tap Start AR camera on the next screen (required on Android).");
        activeArSession = await ctx.beginArSession();
        if (!activeArSession) {
          return {
            status: "failed",
            error: "AR session did not start — tap Start AR camera and allow camera permission",
          };
        }
        const diag = activeArSession.getDiagnostics();
        const hitReady = await activeArSession.whenHitTestReady(10000);
        ctx.onArHint?.(
          hitReady
            ? "In AR view: point at the floor and move slowly until the blue ring appears."
            : "Hit-test unavailable — try brighter light and a textured floor."
        );
        const floorWait = await activeArSession.waitForFloorReticle(FLOOR_SCAN_TIMEOUT_MS);
        const reticle = activeArSession.isReticleVisible();
        return {
          status: diag.immersiveEntered ? "passed" : "failed",
          details: {
            sessionStarted: diag.immersiveEntered,
            hitTestReady: hitReady,
            hitTestEnabled: diag.hitTestEnabled,
            inFullscreen: diag.inFullscreen,
            floorReticleVisible: reticle,
            floorWaitMs: floorWait.waitedMs,
            hint: reticle
              ? "Floor detected — AR placement should work"
              : "Scan the floor in AR view until the blue ring appears",
          },
          error: diag.immersiveEntered ? undefined : "Immersive AR session did not enter",
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "webxr-place",
      "Place 3D object on floor (AR)",
      async () => {
        const session = activeArSession;
        if (!session) {
          return { status: "skipped", details: { reason: "no webxr session" } };
        }
        ctx.onArHint?.("In AR view: keep the floor in frame for placement…");
        let placed = session.placeAtReticle("Device test marker", "arrow");
        let statusText = session.getStatusText();
        if (!placed) {
          const extra = await session.waitForFloorReticle(12000);
          ctx.onArHint?.(
            extra.ok
              ? "Floor found — placing marker…"
              : "Slowly pan along the floor at waist height."
          );
          placed = session.placeAtReticle("Device test marker", "arrow");
          statusText = session.getStatusText();
        }
        return {
          status: placed ? "passed" : "failed",
          details: {
            placed,
            reticleVisible: session.isReticleVisible(),
            statusText,
            ...session.getDiagnostics(),
          },
          error: placed ? undefined : statusText,
        };
      },
      steps,
      onProgress,
      totalSteps
    );

    await runStep(
      "loto-module-camera",
      "LOTO module with camera view",
      async () => {
        const mod = await loadModule("loto-pump-7a");
        ctx.setBodyState("camera");
        ctx.showVideo(true);
        const cam = await startCameraFeed(ctx.video);
        if (!cam.ok) {
          return { status: "failed", error: cam.message };
        }
        await wait(1500);
        return {
          status: "passed",
          details: {
            moduleId: mod.moduleId,
            steps: mod.steps.length,
            mode: "camera",
          },
        };
      },
      steps,
      onProgress,
      totalSteps
    );
  } finally {
    cleanup();
  }

  const finishedAt = new Date().toISOString();
  const passed = steps.filter((s) => s.status === "passed").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const skipped = steps.filter((s) => s.status === "skipped").length;

  return {
    meta: {
      type: "atlas-device-hardware-check",
      version: "1.0.0",
      startedAt,
      finishedAt,
      durationMs: Math.round(performance.now() - tStart),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    },
    summary: {
      passed,
      failed,
      skipped,
      overall: failed > 0 ? "fail" : "pass",
    },
    environment: {
      isSecureContext: window.isSecureContext,
      protocol: location.protocol,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
    },
    steps,
  };
}
