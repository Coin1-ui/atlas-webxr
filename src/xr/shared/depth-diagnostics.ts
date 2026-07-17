/** Snapshot of WebXR depth-sensing / real-world occlusion state for session logs. */
import { WebXRAbstractFeature } from "@babylonjs/core/XR/features/WebXRAbstractFeature";
import type { WebXRDepthSensing } from "@babylonjs/core/XR/features/WebXRDepthSensing";

export type DepthDiagnostics = {
  depthRequested: boolean;
  depthSensingGranted: boolean;
  sessionDepthUsage: string;
  sessionDepthDataFormat: string;
  depthFeatureEnabled: boolean;
  depthFeatureAttached: boolean;
  depthOcclusion: boolean;
  depthUsage: string;
  depthDataFormat: string;
  depthTextureWidth: number | null;
  depthTextureHeight: number | null;
  depthRawValueToMeters: number | null;
  depthEnableError: string | null;
  depthBlockedReason: string | null;
  enabledFeatures: string;
  depthToleranceMode: boolean;
  depthFramesWithTexture: number;
  depthProbeComplete: boolean;
  /** Session exposes depthUsage/depthDataFormat even when enabledFeatures omits depth-sensing. */
  depthSessionDataAvailable: boolean;
  /** Pushed depth-sensing into enabledFeatures so Babylon attach succeeds (Chrome quirk). */
  depthAttachWorkaround: boolean;
  /** How depth attach workaround was applied: push, defineProperty, forceAttach, none, already. */
  depthAttachMethod: string;
};

export function createEmptyDepthDiagnostics(
  overrides: Partial<DepthDiagnostics> = {}
): DepthDiagnostics {
  return {
    depthRequested: false,
    depthSensingGranted: false,
    sessionDepthUsage: "none",
    sessionDepthDataFormat: "none",
    depthFeatureEnabled: false,
    depthFeatureAttached: false,
    depthOcclusion: false,
    depthUsage: "none",
    depthDataFormat: "none",
    depthTextureWidth: null,
    depthTextureHeight: null,
    depthRawValueToMeters: null,
    depthEnableError: null,
    depthBlockedReason: null,
    enabledFeatures: "",
    depthToleranceMode: true,
    depthFramesWithTexture: 0,
    depthProbeComplete: false,
    depthSessionDataAvailable: false,
    depthAttachWorkaround: false,
    depthAttachMethod: "none",
    ...overrides,
  };
}

/** Whether Babylon should call depthFeature.attach (avoids Android CPU-depth XR freeze). */
export function canAttachDepthOcclusion(input: {
  isAndroid: boolean;
  depthSensingGranted: boolean;
  sessionDepthUsage: string;
  sessionDepthDataFormat: string;
}): { attach: boolean; skipReason: string | null } {
  const usage = input.sessionDepthUsage || "none";
  const format = input.sessionDepthDataFormat || "none";
  if (usage === "none" || format === "none") {
    return { attach: false, skipReason: "no-session-depth-data" };
  }
  if (input.isAndroid) {
    if (!input.depthSensingGranted) {
      return { attach: false, skipReason: "android-enabledFeatures-mismatch" };
    }
    if (usage === "cpu-optimized") {
      return { attach: false, skipReason: "android-cpu-depth-unsupported" };
    }
  }
  return { attach: true, skipReason: null };
}

export function resolveDepthBlockedReason(input: {
  depthRequested: boolean;
  depthSensingGranted: boolean;
  sessionDepthUsage: string;
  sessionDepthDataFormat: string;
  depthFeatureEnabled: boolean;
  depthFeatureAttached: boolean;
  depthOcclusion: boolean;
  depthEnableError: string | null;
}): string | null {
  if (input.depthOcclusion) return null;
  if (!input.depthRequested) return "depth-not-requested-in-session";
  if (input.depthEnableError) return `feature-enable-error:${input.depthEnableError}`;
  const sessionHasDepth =
    input.sessionDepthUsage !== "none" &&
    !!input.sessionDepthUsage &&
    input.sessionDepthDataFormat !== "none" &&
    !!input.sessionDepthDataFormat;
  if (!input.depthSensingGranted && sessionHasDepth) {
    return "enabledFeatures-list-mismatch";
  }
  if (!input.depthSensingGranted) {
    return "depth-sensing-not-in-enabledFeatures";
  }
  if (input.sessionDepthUsage === "none" || !input.sessionDepthUsage) {
    return "session-missing-depthUsage";
  }
  if (input.sessionDepthDataFormat === "none" || !input.sessionDepthDataFormat) {
    return "session-missing-depthDataFormat";
  }
  if (!input.depthFeatureEnabled) return "depth-feature-not-enabled";
  if (!input.depthFeatureAttached) return "depth-feature-not-attached";
  return "depth-occlusion-inactive-unknown";
}

export function finalizeDepthDiagnostics(d: DepthDiagnostics): DepthDiagnostics {
  const blocked = resolveDepthBlockedReason({
    depthRequested: d.depthRequested,
    depthSensingGranted: d.depthSensingGranted,
    sessionDepthUsage: d.sessionDepthUsage,
    sessionDepthDataFormat: d.sessionDepthDataFormat,
    depthFeatureEnabled: d.depthFeatureEnabled,
    depthFeatureAttached: d.depthFeatureAttached,
    depthOcclusion: d.depthOcclusion,
    depthEnableError: d.depthEnableError,
  });
  return { ...d, depthBlockedReason: blocked };
}

/** Flatten for JSON session log (all scalar values). */
export function depthDiagnosticsForLog(d: DepthDiagnostics): Record<string, string | number | boolean | null> {
  const out = finalizeDepthDiagnostics(d);
  return {
    depthRequested: out.depthRequested,
    depthSensingGranted: out.depthSensingGranted,
    sessionDepthUsage: out.sessionDepthUsage,
    sessionDepthDataFormat: out.sessionDepthDataFormat,
    depthFeatureEnabled: out.depthFeatureEnabled,
    depthFeatureAttached: out.depthFeatureAttached,
    depthOcclusion: out.depthOcclusion,
    depthUsage: out.depthUsage,
    depthDataFormat: out.depthDataFormat,
    depthTextureWidth: out.depthTextureWidth,
    depthTextureHeight: out.depthTextureHeight,
    depthRawValueToMeters: out.depthRawValueToMeters,
    depthEnableError: out.depthEnableError,
    depthBlockedReason: out.depthBlockedReason,
    enabledFeatures: out.enabledFeatures,
    depthToleranceMode: out.depthToleranceMode,
    depthFramesWithTexture: out.depthFramesWithTexture,
    depthProbeComplete: out.depthProbeComplete,
    depthSessionDataAvailable: out.depthSessionDataAvailable,
    depthAttachWorkaround: out.depthAttachWorkaround,
    depthAttachMethod: out.depthAttachMethod,
  };
}

/** Chrome/ARCore may set session.depthUsage without listing depth-sensing in enabledFeatures. */
export function patchDepthSensingEnabledFeatures(session: XRSession | null): {
  granted: boolean;
  method: "none" | "already" | "push" | "defineProperty" | "assign";
} {
  if (!session) return { granted: false, method: "none" };
  const features = session.enabledFeatures;
  if (!features) return { granted: false, method: "none" };
  if (features.includes("depth-sensing")) {
    return { granted: true, method: "already" };
  }

  try {
    const mutable = features as string[];
    const lenBefore = mutable.length;
    mutable.push("depth-sensing");
    if (mutable.length > lenBefore && session.enabledFeatures?.includes("depth-sensing")) {
      return { granted: true, method: "push" };
    }
  } catch {
    /* frozen array */
  }

  try {
    (session as XRSession & { enabledFeatures: string[] }).enabledFeatures = [
      ...features,
      "depth-sensing",
    ];
    if (session.enabledFeatures?.includes("depth-sensing")) {
      return { granted: true, method: "assign" };
    }
  } catch {
    /* read-only property */
  }

  try {
    Object.defineProperty(session, "enabledFeatures", {
      value: [...features, "depth-sensing"],
      configurable: true,
      writable: true,
    });
    if (session.enabledFeatures?.includes("depth-sensing")) {
      return { granted: true, method: "defineProperty" };
    }
  } catch {
    /* non-configurable session */
  }

  return { granted: false, method: "none" };
}

/**
 * Temporarily bypass Babylon's enabledFeatures gate for depth-sensing when Chrome
 * exposes session.depthUsage but omits depth-sensing from enabledFeatures.
 */
export function attachDepthWithChromeBypass(feature: WebXRDepthSensing): boolean {
  const proto = WebXRAbstractFeature.prototype as {
    attach: (this: unknown, force?: boolean) => boolean;
    detach: (this: unknown) => boolean;
  };
  const originalAttach = proto.attach;

  proto.attach = function (this: unknown, force?: boolean): boolean {
    const self = this as {
      xrNativeFeatureName?: string;
      isDisposed?: boolean;
      _attached: boolean;
      _onXRFrame: (frame: XRFrame) => void;
      _xrSessionManager?: {
        session?: XRSession | null;
        onXRFrameObservable: { add: (cb: (f: XRFrame) => void) => unknown };
      };
      _addNewAttachObserver: (
        obs: { add: (cb: (f: XRFrame) => void) => unknown },
        cb: (f: XRFrame) => void
      ) => void;
      onFeatureAttachObservable?: { notifyObservers: (v: unknown) => void };
    };
    const session = self._xrSessionManager?.session;
    const needsBypass =
      self.xrNativeFeatureName === "depth-sensing" &&
      session?.depthUsage != null &&
      session?.depthDataFormat != null &&
      !session.enabledFeatures?.includes("depth-sensing");

    if (needsBypass) {
      if (self.isDisposed) return false;
      if (!force && self._attached) return false;
      if (force && self._attached) proto.detach.call(this);
      self._attached = true;
      self._addNewAttachObserver(self._xrSessionManager!.onXRFrameObservable, (frame) =>
        self._onXRFrame(frame)
      );
      self.onFeatureAttachObservable?.notifyObservers(this);
      return true;
    }
    return originalAttach.call(this, force);
  };

  try {
    return feature.attach(true);
  } finally {
    proto.attach = originalAttach;
  }
}
