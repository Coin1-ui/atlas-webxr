/**
 * Batch-analyze atlas-ar-session JSON files in a directory.
 * Usage: node scripts/analyze-ar-session-batch.mjs [dir]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "Edit_logs");
const analyzeScript = join(dirname(fileURLToPath(import.meta.url)), "analyze-ar-session.mjs");
const files = readdirSync(dir)
  .filter((f) => f.startsWith("atlas-ar-session-") && f.endsWith(".json"))
  .sort();

const rows = [];
for (const file of files) {
  const path = join(dir, file);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const lastHit = [...raw.events].reverse().find((e) => e.id === "hit-test-stats");
  const d = lastHit?.details ?? {};
  const placements = raw.events.filter((e) => e.id === "model-place-result" && e.status === "ok");
  const bar = placements.find((e) => String(e.details?.modelUrl ?? "").includes("Bar-Chair"));
  rows.push({
    session: file.replace("atlas-ar-session-", "").replace(".json", ""),
    placements: placements.length,
    barMaxD: bar?.details?.maxDimensionM ?? null,
    hitMed: median(placements.map((p) => p.details?.hitTestFloorY).filter((y) => typeof y === "number")),
    floorSnap: bar?.details?.floorSnapM ?? null,
    contact: bar?.details?.floorContactSource ?? null,
    bindOk: d.placementAnchorBindSuccess ?? null,
    anchUpd: d.placementAnchorUpdates ?? null,
    repin: d.worldRepinCorrections ?? null,
    pWX: d.placedWorldX ?? null,
    lockY: d.lockedFloorY ?? null,
    camRange: d.cameraVerticalRangeM ?? null,
    placedDrift: d.placedMaxDriftM ?? null,
    shadow: bar?.details?.shadowCasterCount ?? null,
  });
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "test-results");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "session-batch-summary.json");
writeFileSync(outPath, JSON.stringify({ analyzedAt: new Date().toISOString(), dir, count: rows.length, rows }, null, 2));

console.log(JSON.stringify({ ok: true, count: rows.length, outPath, sample: rows.slice(-5) }, null, 2));
