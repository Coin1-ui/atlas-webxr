/**
 * Node-side depth diagnostics analysis (mirrors src/xr/depth-diagnostics.ts).
 */

export function resolveDepthBlockedReason(input) {
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
  if (!input.depthSensingGranted) return "depth-sensing-not-in-enabledFeatures";
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

export function extractDepthFromArStart(details = {}) {
  return {
    depthRequested: details.depthRequested === true ||
    (details.depthRequested === undefined && details.depthOcclusion !== undefined),
    depthSensingGranted: details.depthSensingGranted === true,
    sessionDepthUsage: details.sessionDepthUsage ?? details.depthUsage ?? "none",
    sessionDepthDataFormat: details.sessionDepthDataFormat ?? details.depthDataFormat ?? "none",
    depthFeatureEnabled: details.depthFeatureEnabled === true,
    depthFeatureAttached: details.depthFeatureAttached === true,
    depthOcclusion: details.depthOcclusion === true,
    depthUsage: details.depthUsage ?? "none",
    depthDataFormat: details.depthDataFormat ?? "none",
    depthTextureWidth: details.depthTextureWidth ?? null,
    depthTextureHeight: details.depthTextureHeight ?? null,
    depthRawValueToMeters: details.depthRawValueToMeters ?? null,
    depthEnableError: details.depthEnableError ?? null,
    depthBlockedReason: details.depthBlockedReason ?? null,
    enabledFeatures: details.enabledFeatures ?? "",
    depthToleranceMode: details.depthToleranceMode !== false,
    depthFramesWithTexture: details.depthFramesWithTexture ?? 0,
    depthProbeComplete: details.depthProbeComplete === true,
    depthSessionDataAvailable:
      details.depthSessionDataAvailable === true ||
      (details.sessionDepthUsage &&
        details.sessionDepthUsage !== "none" &&
        details.sessionDepthDataFormat &&
        details.sessionDepthDataFormat !== "none"),
    depthAttachWorkaround: details.depthAttachWorkaround === true,
  };
}

export function analyzeDepthDiagnostics(arStartDetails, depthProbeDetails) {
  const start = extractDepthFromArStart(arStartDetails ?? {});
  const probe = depthProbeDetails ? extractDepthFromArStart(depthProbeDetails) : null;
  const merged = probe
    ? {
        ...start,
        depthTextureWidth: probe.depthTextureWidth ?? start.depthTextureWidth,
        depthTextureHeight: probe.depthTextureHeight ?? start.depthTextureHeight,
        depthRawValueToMeters: probe.depthRawValueToMeters ?? start.depthRawValueToMeters,
        depthFramesWithTexture:
          probe.depthFramesWithTexture > 0
            ? probe.depthFramesWithTexture
            : start.depthFramesWithTexture,
        depthProbeComplete: probe.depthProbeComplete || start.depthProbeComplete,
        ...(typeof depthProbeDetails.depthOcclusion === "boolean"
          ? { depthOcclusion: depthProbeDetails.depthOcclusion }
          : {}),
      }
    : start;

  const blocked =
    merged.depthBlockedReason ??
    resolveDepthBlockedReason({
      depthRequested: merged.depthRequested,
      depthSensingGranted: merged.depthSensingGranted,
      sessionDepthUsage: merged.sessionDepthUsage,
      sessionDepthDataFormat: merged.sessionDepthDataFormat,
      depthFeatureEnabled: merged.depthFeatureEnabled,
      depthFeatureAttached: merged.depthFeatureAttached,
      depthOcclusion: merged.depthOcclusion,
      depthEnableError: merged.depthEnableError,
    });

  const issues = [];
  if (merged.depthRequested && !merged.depthOcclusion) {
    issues.push(`Depth occlusion inactive: ${blocked ?? "unknown"}`);
  }
  if (merged.depthOcclusion && merged.depthProbeComplete && merged.depthFramesWithTexture === 0) {
    issues.push("Depth occlusion active but no depth frames received during probe");
  }
  if (
    merged.depthOcclusion &&
    merged.depthProbeComplete &&
    merged.depthTextureWidth != null &&
    merged.depthTextureWidth < 16
  ) {
    issues.push(`Depth texture suspiciously small (${merged.depthTextureWidth}px wide)`);
  }

  return { ...merged, depthBlockedReason: blocked, depthIssues: issues };
}
