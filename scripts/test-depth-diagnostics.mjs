/**
 * Unit tests for depth session analysis helpers.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  resolveDepthBlockedReason,
  analyzeDepthDiagnostics,
} from "./lib/depth-session-analysis.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const fixtures = join(dir, "fixtures");

const results = [];
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    results.push({ name, status: "pass" });
  } else {
    failed += 1;
    results.push({ name, status: "fail", detail });
  }
}

assert(
  "blocked when not in enabledFeatures",
  resolveDepthBlockedReason({
    depthRequested: true,
    depthSensingGranted: false,
    sessionDepthUsage: "none",
    sessionDepthDataFormat: "none",
    depthFeatureEnabled: true,
    depthFeatureAttached: false,
    depthOcclusion: false,
    depthEnableError: null,
  }) === "depth-sensing-not-in-enabledFeatures"
);

assert(
  "blocked when session missing depthUsage",
  resolveDepthBlockedReason({
    depthRequested: true,
    depthSensingGranted: true,
    sessionDepthUsage: "none",
    sessionDepthDataFormat: "float32",
    depthFeatureEnabled: true,
    depthFeatureAttached: false,
    depthOcclusion: false,
    depthEnableError: null,
  }) === "session-missing-depthUsage"
);

assert(
  "no block when occlusion active",
  resolveDepthBlockedReason({
    depthRequested: true,
    depthSensingGranted: true,
    sessionDepthUsage: "gpu-optimized",
    sessionDepthDataFormat: "float32",
    depthFeatureEnabled: true,
    depthFeatureAttached: true,
    depthOcclusion: true,
    depthEnableError: null,
  }) === null
);

const activeProbe = analyzeDepthDiagnostics(
  {
    depthRequested: true,
    depthSensingGranted: true,
    sessionDepthUsage: "gpu-optimized",
    sessionDepthDataFormat: "float32",
    depthFeatureEnabled: true,
    depthFeatureAttached: true,
    depthOcclusion: true,
    depthUsage: "gpu",
    depthDataFormat: "float",
  },
  {
    depthProbeComplete: true,
    depthFramesWithTexture: 42,
    depthTextureWidth: 256,
    depthTextureHeight: 192,
    depthRawValueToMeters: 0.001,
  }
);
assert("active depth has no issues", activeProbe.depthIssues.length === 0);
assert("active depth occlusion true", activeProbe.depthOcclusion === true);

const unavailable = JSON.parse(
  readFileSync(join(fixtures, "session-depth-unavailable.json"), "utf8")
);
const arStart = unavailable.events.find((e) => e.id === "ar-start")?.details ?? {};
const analyzed = analyzeDepthDiagnostics(arStart, null);
assert("unavailable session has depth issue note", analyzed.depthIssues.length >= 1);
assert(
  "unavailable blocked reason",
  analyzed.depthBlockedReason === "depth-sensing-not-in-enabledFeatures"
);

assert(
  "chrome mismatch blocked reason",
  analyzeDepthDiagnostics(
    JSON.parse(
      readFileSync(join(fixtures, "session-depth-chrome-mismatch.json"), "utf8")
    ).events[0].details,
    null
  ).depthBlockedReason === "enabledFeatures-list-mismatch"
);

console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
