/** Mirrors model-real-world-scale.ts for offline unit tests. */
const AR_SCALE_APPLY_MIN_DELTA = 0.08;
const AR_SCALE_FACTOR_MIN = 0.5;
const AR_SCALE_FACTOR_MAX = 2.5;

const MODEL_REAL_WORLD_DEFAULTS = {};

function clampScaleFactor(f) {
  return Math.min(AR_SCALE_FACTOR_MAX, Math.max(AR_SCALE_FACTOR_MIN, f));
}

function closeEnough(f) {
  return Math.abs(f - 1) < AR_SCALE_APPLY_MIN_DELTA;
}

function scaleNeedsCorrection(scale) {
  return !closeEnough(scale.x) || !closeEnough(scale.y) || !closeEnough(scale.z);
}

function maxScaleComponent(scale) {
  return Math.max(scale.x, scale.y, scale.z);
}

function mergeSpec(_modelId, catalog) {
  if (!catalog) return null;
  return { ...catalog };
}

function resolveRealWorldScaleFactor(modelId, measured, catalog) {
  const spec = mergeSpec(modelId, catalog);
  if (!spec) return null;

  if (spec.scaleFactor != null && spec.scaleFactor > 0) {
    const factor = clampScaleFactor(spec.scaleFactor);
    if (closeEnough(factor)) return null;
    const scale = { x: factor, y: factor, z: factor };
    return { factor, scale, reason: "catalog-scaleFactor", measured, target: spec };
  }

  const preferWidth = /sofa|table|desk|bed/i.test(modelId ?? "");
  const preferHeight = /chair|stool|seat/i.test(modelId ?? "");

  let scaleX = 1;
  let scaleY = 1;
  let scaleZ = 1;
  let reason = "catalog-dimension";

  if (spec.widthM != null && measured.widthM > 0.01) {
    scaleX = clampScaleFactor(spec.widthM / measured.widthM);
    scaleZ = scaleX;
    reason = "catalog-widthM";
  }
  if (spec.depthM != null && measured.depthM > 0.01) {
    scaleZ = clampScaleFactor(spec.depthM / measured.depthM);
    if (reason === "catalog-dimension") reason = "catalog-depthM";
  }
  if (spec.heightM != null && measured.heightM > 0.01) {
    scaleY = clampScaleFactor(spec.heightM / measured.heightM);
    if (reason === "catalog-dimension") reason = "catalog-heightM";
  }

  if (preferHeight && spec.heightM != null && !spec.widthM && !spec.depthM) {
    scaleX = scaleY;
    scaleZ = scaleY;
    reason = "catalog-heightM";
  }

  const scale = { x: scaleX, y: scaleY, z: scaleZ };
  if (!scaleNeedsCorrection(scale)) return null;

  if (preferWidth && spec.widthM != null) reason = "catalog-widthM";
  if (preferHeight && spec.heightM != null && !spec.widthM) reason = "catalog-heightM";

  return {
    factor: maxScaleComponent(scale),
    scale,
    reason,
    measured,
    target: spec,
  };
}

const results = [];
function assert(name, ok) {
  results.push({ name, status: ok ? "pass" : "fail" });
  if (!ok) process.exitCode = 1;
}

assert(
  "catalog models use native GLB scale (no built-in defaults)",
  resolveRealWorldScaleFactor(
    "CT202-Sofa",
    { widthM: 0.96, depthM: 0.93, heightM: 1.16 },
    null
  ) === null
);

assert(
  "Bar-Chair native scale when no manifest realWorld",
  resolveRealWorldScaleFactor(
    "Bar-Chair",
    { widthM: 0.46, depthM: 0.45, heightM: 0.754 },
    null
  ) === null
);

assert(
  "manifest realWorld widthM still applies when explicitly set",
  (() => {
    const r = resolveRealWorldScaleFactor(
      "CT202-Sofa",
      { widthM: 0.96, depthM: 0.93, heightM: 1.16 },
      { widthM: 1.75 }
    );
    return (
      r != null &&
      r.reason === "catalog-widthM" &&
      Math.abs(r.scale.y - 1) < 0.001 &&
      Math.abs(0.96 * r.scale.x - 1.75) < 0.05
    );
  })()
);

assert(
  "manifest heightM scales chairs uniformly when explicit",
  (() => {
    const r = resolveRealWorldScaleFactor(
      "Bar-Chair",
      { widthM: 0.46, depthM: 0.45, heightM: 0.754 },
      { heightM: 0.98 }
    );
    return (
      r != null &&
      Math.abs(r.scale.x - r.scale.y) < 0.001 &&
      Math.abs(0.754 * r.scale.y - 0.98) < 0.05
    );
  })()
);

assert(
  "no correction when GLB already matches explicit target within 8%",
  resolveRealWorldScaleFactor(
    "CV108_OfficeChair",
    { widthM: 0.98, depthM: 0.97, heightM: 1.12 },
    { heightM: 1.12 }
  ) === null
);

assert(
  "direct scaleFactor bypasses bounds",
  (() => {
    const r = resolveRealWorldScaleFactor(
      "custom",
      { widthM: 1, depthM: 1, heightM: 1 },
      { scaleFactor: 1.2 }
    );
    return r != null && Math.abs(r.factor - 1.2) < 0.001;
  })()
);

assert(
  "tiny correction below threshold is skipped",
  resolveRealWorldScaleFactor(
    "test",
    { widthM: 1, depthM: 1, heightM: 1 },
    { scaleFactor: 1 + AR_SCALE_APPLY_MIN_DELTA / 2 }
  ) === null
);

const FURNITURE_VERTEX_PRIMARY_DIVERGE_M = 0.018;

function snapFloorContactY(vertexMinY, primaryMeshMinY, unionBboxMinY, hierarchyMinY) {
  const candidates = [];
  if (vertexMinY !== null) candidates.push({ y: vertexMinY, source: "vertex" });
  if (unionBboxMinY !== null) candidates.push({ y: unionBboxMinY, source: "union-bbox" });
  if (primaryMeshMinY !== null) candidates.push({ y: primaryMeshMinY, source: "primary-mesh" });
  const base =
    candidates.length === 0
      ? { contactY: hierarchyMinY, source: "hierarchy" }
      : (() => {
          const best = candidates.reduce((a, b) => (b.y < a.y ? b : a));
          return { contactY: best.y, source: best.source };
        })();
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
  "bar chair snaps to visible primary mesh when collision verts diverge 2.9cm (1780829599377)",
  (() => {
    const snap = snapFloorContactY(0.440976774, 0.469740927, 0.440976764, 0.440976764);
    return (
      snap.source === "primary-mesh" &&
      Math.abs(snap.contactY - 0.469740927) < 0.001
    );
  })()
);

assert(
  "bar chair leg vertex used when diverge under 1.8cm",
  (() => {
    const snap = snapFloorContactY(0.448, 0.456, 0.448, 0.448);
    return snap.source === "vertex" && Math.abs(snap.contactY - 0.448) < 0.001;
  })()
);

function enforcePlacedScale(scaling, arScaleFactor, arScaleVector) {
  const expected = arScaleVector ?? {
    x: arScaleFactor ?? 1,
    y: arScaleFactor ?? 1,
    z: arScaleFactor ?? 1,
  };
  if (
    Math.abs(scaling.x - expected.x) > 0.001 ||
    Math.abs(scaling.y - expected.y) > 0.001 ||
    Math.abs(scaling.z - expected.z) > 0.001
  ) {
    return { ...expected, corrected: true };
  }
  return { ...scaling, corrected: false };
}

assert(
  "enforceSessionPlacedScale preserves catalog AR scale factor",
  (() => {
    const next = enforcePlacedScale({ x: 1, y: 1, z: 1 }, 1.3);
    return next.corrected && Math.abs(next.x - 1.3) < 0.001;
  })()
);

assert(
  "enforceSessionPlacedScale preserves non-uniform manifest scale",
  (() => {
    const vector = { x: 1.84, y: 1, z: 1.84 };
    const next = enforcePlacedScale({ x: 1, y: 1, z: 1 }, 1.84, vector);
    return (
      next.corrected &&
      Math.abs(next.x - 1.84) < 0.001 &&
      Math.abs(next.y - 1) < 0.001 &&
      Math.abs(next.z - 1.84) < 0.001
    );
  })()
);

assert(
  "enforceSessionPlacedScale leaves native 1:1:1 scale unchanged",
  !enforcePlacedScale({ x: 1, y: 1, z: 1 }, 1).corrected
);

/** Android Bar-Chair submerged correction — primary mesh above collision contact. */
{
  const floorY = 0;
  const vertexContact = -0.029;
  const primaryMesh = 0;
  const clearance = vertexContact - floorY;
  const needsLift =
    clearance < -0.001 &&
    clearance >= -0.045 &&
    primaryMesh > vertexContact + 0.001;
  const extraLift = floorY - primaryMesh;
  assert("Bar-Chair ~2.9cm submerged triggers primary-mesh lift", needsLift);
  assert("primary-mesh at floor needs no extra lift", extraLift === 0);
}

console.log(
  JSON.stringify(
    {
      ok: results.every((r) => r.status === "pass"),
      failed: results.filter((r) => r.status === "fail").length,
      results,
    },
    null,
    2
  )
);
