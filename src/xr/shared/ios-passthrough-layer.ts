import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { WebXRSessionManager } from "@babylonjs/core/XR/webXRSessionManager";
import { WebXRManagedOutputCanvasOptions } from "@babylonjs/core/XR/webXRManagedOutputCanvas";
import type { WebXRRenderTarget } from "@babylonjs/core/XR/webXRTypes";

/** Result of attempting to configure an alpha-capable XRWebGLLayer for camera passthrough. */
export type IosPassthroughLayerResult = {
  applied: boolean;
  layerAlpha: boolean | null;
  environmentBlendMode: string;
  error: string | null;
};

const WEBGL_ALPHA_ATTRS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  xrCompatible: true,
  preserveDrawingBuffer: true,
};

/** Alpha-capable XRWebGLLayer init — required for WebXR Viewer camera compositing (webxr-ios#193). */
export const IOS_XR_LAYER_INIT: XRWebGLLayerInit = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  ignoreDepthValues: true,
  framebufferScaleFactor: 1,
};

/**
 * Request an alpha-capable WebGL context before Babylon creates the engine.
 * WebXR Viewer composites camera only when the base layer was created with alpha
 * (mozilla-mobile/webxr-ios#193; W3C WebXR AR compositor behaviors).
 */
export function primeIosCanvasForPassthrough(
  canvas: HTMLCanvasElement
): WebGL2RenderingContext | WebGLRenderingContext | null {
  return (
    (canvas.getContext("webgl2", WEBGL_ALPHA_ATTRS) as WebGL2RenderingContext | null) ??
    (canvas.getContext("webgl", WEBGL_ALPHA_ATTRS) as WebGLRenderingContext | null)
  );
}

/**
 * Babylon-managed XR output canvas with alpha layer options applied before session entry.
 * Must be passed to enterXRAsync so Babylon's internal layer wrapper stays in sync.
 */
export function createIosWebXRRenderTarget(
  sessionManager: WebXRSessionManager,
  canvas: HTMLCanvasElement,
  engine: AbstractEngine
): WebXRRenderTarget {
  const defaults = WebXRManagedOutputCanvasOptions.GetDefaults(engine);
  return sessionManager.getWebXRRenderTarget({
    ...defaults,
    canvasElement: canvas,
    canvasOptions: {
      ...defaults.canvasOptions,
      ...IOS_XR_LAYER_INIT,
    },
  });
}

type PassthroughSessionManager = Pick<WebXRSessionManager, "session" | "updateRenderState">;

export type IosXrLayerDiagnostics = {
  environmentBlendMode: string;
  layerAlpha: boolean | null;
  glContextAlpha: boolean | null;
  glContextPremultipliedAlpha: boolean | null;
  layerFramebufferScaleFactor: number | null;
};

export function getIosXrLayerDiagnostics(
  session: XRSession | null | undefined,
  engine: AbstractEngine | null | undefined
): IosXrLayerDiagnostics {
  const blendMode = session?.environmentBlendMode ?? "unknown";
  const layer = session?.renderState.baseLayer;
  const gl = (engine as Engine | null | undefined)?._gl ?? null;
  const attrs = gl?.getContextAttributes?.() ?? null;
  return {
    environmentBlendMode: blendMode,
    layerAlpha: layer instanceof XRWebGLLayer ? true : null,
    glContextAlpha: attrs?.alpha ?? null,
    glContextPremultipliedAlpha: attrs?.premultipliedAlpha ?? null,
    layerFramebufferScaleFactor:
      layer instanceof XRWebGLLayer ? layer.framebufferWidth / Math.max(1, layer.framebufferHeight) : null,
  };
}

/**
 * WebXR Viewer on iOS may skip camera compositing when the base layer lacks alpha, or when
 * updateRenderState bypasses Babylon's session manager (layer wrapper desync — webxr-ios#193).
 *
 * Always route layer updates through sessionManager.updateRenderState so render targets match.
 * Must use the same WebGL context as the Babylon Engine (not a second getContext call).
 */
export async function ensureIosAlphaPassthroughLayer(
  sessionManager: PassthroughSessionManager | null | undefined,
  canvas: HTMLCanvasElement,
  engine?: AbstractEngine | null
): Promise<IosPassthroughLayerResult> {
  const session = sessionManager?.session;
  const blendMode = session?.environmentBlendMode ?? "unknown";
  if (!session || !sessionManager) {
    return {
      applied: false,
      layerAlpha: null,
      environmentBlendMode: blendMode,
      error: "no-session",
    };
  }

  const gl =
    (engine as Engine | null | undefined)?._gl ??
    primeIosCanvasForPassthrough(canvas) ??
    ((canvas.getContext("webgl2", { xrCompatible: true }) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl", { xrCompatible: true }) as WebGLRenderingContext | null));

  if (!gl) {
    return {
      applied: false,
      layerAlpha: null,
      environmentBlendMode: blendMode,
      error: "no-webgl",
    };
  }

  try {
    const layer = new XRWebGLLayer(session, gl, IOS_XR_LAYER_INIT);
    sessionManager.updateRenderState({ baseLayer: layer });
    return {
      applied: true,
      layerAlpha: IOS_XR_LAYER_INIT.alpha ?? true,
      environmentBlendMode: session.environmentBlendMode ?? blendMode,
      error: null,
    };
  } catch (e) {
    return {
      applied: false,
      layerAlpha: null,
      environmentBlendMode: blendMode,
      error: e instanceof Error ? e.message : "layer-update-failed",
    };
  }
}
