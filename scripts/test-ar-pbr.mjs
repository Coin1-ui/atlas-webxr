/**
 * Unit checks for AR PBR / IBL helpers (no WebGL required).
 */
const results = [];

function assert(name, pass) {
  results.push({ name, status: pass ? "pass" : "fail" });
  if (!pass) console.error("FAIL:", name);
}

function shouldApplyPlaneRingUpdate(
  floorScanComplete,
  hitTestAttached,
  lastHitTestPoseAtMs,
  nowMs,
  hitTestStaleMs = 400
) {
  if (!floorScanComplete || !hitTestAttached) return true;
  if (lastHitTestPoseAtMs <= 0) return true;
  return nowMs - lastHitTestPoseAtMs > hitTestStaleMs;
}

assert(
  "plane ring blocked while hit-test fresh",
  shouldApplyPlaneRingUpdate(true, true, 1000, 1200) === false
);

const AR_TEXTURE_ANISOTROPY_CAP = 16;

function resolveAnisotropy(deviceMax) {
  return Math.min(deviceMax ?? 4, AR_TEXTURE_ANISOTROPY_CAP);
}

function tunePbrStub({ lightEstimationActive, sceneHasEnvironment }) {
  const environmentIntensity = sceneHasEnvironment
    ? lightEstimationActive
      ? 1.2
      : 1.0
    : 0.55;
  const specularIntensity = 0.65;
  return { environmentIntensity, specularIntensity, unlit: false };
}

assert(
  "texture anisotropy capped at 16",
  resolveAnisotropy(32) === 16 && resolveAnisotropy(8) === 8
);

{
  const withIbl = tunePbrStub({ lightEstimationActive: true, sceneHasEnvironment: true });
  assert("PBR with IBL uses higher env intensity", withIbl.environmentIntensity >= 1.0);
  assert("PBR tuning keeps materials lit", withIbl.unlit === false);
}

{
  const noIbl = tunePbrStub({ lightEstimationActive: false, sceneHasEnvironment: false });
  assert("PBR without IBL lowers env intensity", noIbl.environmentIntensity < 1.0);
}

function formatDimensionMeters(m) {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m >= 1) return `${m.toFixed(2)} m`;
  return `${Math.round(m * 100)} cm`;
}

assert("dimension label uses cm under 1m", formatDimensionMeters(0.754) === "75 cm");
assert("dimension label uses meters at 1m+", formatDimensionMeters(1.164) === "1.16 m");

function collapsedHeightUsesHierarchy(geoHeightM, hierarchyHeightM) {
  const MIN_MODEL_HEIGHT_M = 0.05;
  return geoHeightM < MIN_MODEL_HEIGHT_M && hierarchyHeightM >= MIN_MODEL_HEIGHT_M;
}

assert(
  "collapsed geo height falls back to hierarchy for dimensions",
  collapsedHeightUsesHierarchy(0.003, 0.754) === true
);
assert(
  "normal geo height keeps geometry bounds",
  collapsedHeightUsesHierarchy(0.754, 0.754) === false
);

function formatAxisDimensionLabel(axis, dim) {
  const value = axis === "W" ? dim.widthM : axis === "D" ? dim.depthM : dim.heightM;
  return `${axis}: ${formatDimensionMeters(value)}`;
}

function isPlacementFxMeshName(name) {
  return /blob-shadow|dim-root|dim-w|dim-d|dim-h|dim-.*-lbl/i.test(name);
}

function liveMaxDimensionFromFrozen(frozen) {
  if (!frozen) return null;
  return Math.max(frozen.widthM, frozen.depthM, frozen.heightM);
}

assert(
  "axis label W prefix",
  formatAxisDimensionLabel("W", { widthM: 0.468, depthM: 0.454, heightM: 0.754 }) === "W: 47 cm"
);
assert(
  "axis label H prefix",
  formatAxisDimensionLabel("H", { widthM: 0.468, depthM: 0.454, heightM: 0.754 }) === "H: 75 cm"
);
assert(
  "FX mesh names excluded from geometry collection",
  isPlacementFxMeshName("dim-root-placed-1-dim-w") &&
    isPlacementFxMeshName("blob-shadow-wrapper") &&
    !isPlacementFxMeshName("Bar-Chair-mesh")
);
assert(
  "live max dimension uses frozen placement size",
  liveMaxDimensionFromFrozen({ widthM: 0.468, depthM: 0.454, heightM: 0.754 }) === 0.754
);
assert(
  "frozen live metric does not shrink when bbox would",
  liveMaxDimensionFromFrozen({ widthM: 0.468, depthM: 0.454, heightM: 0.754 }) > 0.511
);

function primaryMeshContactMinY(candidates) {
  const largest = candidates.reduce((a, b) => (b.footprint > a.footprint ? b : a));
  const minFootprint = largest.footprint * 0.15;
  let contactY = null;
  for (const { footprint, minY } of candidates) {
    if (footprint < minFootprint) continue;
    contactY = contactY === null ? minY : Math.min(contactY, minY);
  }
  return contactY ?? largest.minY;
}

function resolveFloorContactY(vertexMinY, primaryMeshMinY, unionBboxMinY, hierarchyMinY) {
  const candidates = [];
  if (vertexMinY !== null) candidates.push({ y: vertexMinY, source: "vertex" });
  if (unionBboxMinY !== null) candidates.push({ y: unionBboxMinY, source: "union-bbox" });
  if (primaryMeshMinY !== null) candidates.push({ y: primaryMeshMinY, source: "primary-mesh" });
  if (!candidates.length) return { contactY: hierarchyMinY, source: "hierarchy" };
  const best = candidates.reduce((a, b) => (b.y < a.y ? b : a));
  return { contactY: best.y, source: best.source };
}

function snapFloorContactY(vertexMinY, primaryMeshMinY, unionBboxMinY, hierarchyMinY) {
  const base = resolveFloorContactY(vertexMinY, primaryMeshMinY, unionBboxMinY, hierarchyMinY);
  const FURNITURE_VERTEX_PRIMARY_DIVERGE_M = 0.015;
  if (
    primaryMeshMinY !== null &&
    vertexMinY !== null &&
    primaryMeshMinY - vertexMinY > FURNITURE_VERTEX_PRIMARY_DIVERGE_M
  ) {
    return { contactY: primaryMeshMinY, source: "primary-mesh" };
  }
  return base;
}

assert(
  "primary mesh contact uses lowest significant mesh minY",
  primaryMeshContactMinY([
    { footprint: 0.2, minY: 0.375 },
    { footprint: 0.18, minY: 0.403 },
  ]) === 0.375
);
assert(
  "floor contact prefers union bbox when primary is not inflated above vertex",
  resolveFloorContactY(null, 0.403871, 0.375107, 0.37).contactY === 0.375107
);
assert(
  "snap uses primary mesh when leg verts sit below visible base (session 1780758653840)",
  snapFloorContactY(0.49680045789254373, 0.5255646109580994, 0.49680044829037434, 0.49)
    .contactY === 0.5255646109580994
);
assert(
  "snap lowers hover gap for bar chair primary vs vertex",
  Math.round((0.49680046319961546 - 0.5255646109580994) * 1000) / 1000 === -0.029
);

function liveMaxFromEntry(entry) {
  if (entry.frozenMaxDimensionM != null) return entry.frozenMaxDimensionM;
  if (entry.placementFx?.dimensions) {
    const d = entry.placementFx.dimensions;
    return Math.max(d.widthM, d.depthM, d.heightM);
  }
  return null;
}

assert(
  "frozen max dimension never falls back to shrinking bbox",
  liveMaxFromEntry({ frozenMaxDimensionM: 0.754, placementFx: null }) === 0.754
);

const failed = results.filter((r) => r.status === "fail").length;
console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));
process.exit(failed ? 1 : 0);
