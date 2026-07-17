#!/usr/bin/env node
/**
 * Orchestrate MiroFish prediction for Atlas AR (headless API pipeline).
 * Requires: MiroFish cloned at ../../MiroFish with .env configured.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED = path.join(ROOT, "docs/atlas-ar/mirofish/SEED-ATLAS-AR.md");
const MIROFISH = path.resolve(ROOT, "..", "MiroFish");
const API = process.env.MIROFISH_API_URL || "http://127.0.0.1:5001";
const POLL_MS = 5000;
const MAX_ROUNDS = Number(process.env.MIROFISH_MAX_ROUNDS || "40");

const REQUIREMENT =
  "Simulate 12 months of Atlas AR go-to-market with Starter ($5), Launch ($59), and Growth ($179) tiers. " +
  "Predict paying customer range, dominant ICP, top objections, UX conversion killers, and probability of $500k ARR in 18 months. " +
  "Personas: retail e-comm head, field sales VP, IT security, incumbent showroom buyer, Shopify merchant, end shopper, CFO, competitor PM.";

let backendProc = null;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readEnvKey(name) {
  const envPath = path.join(MIROFISH, ".env");
  if (!fs.existsSync(envPath)) return "";
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

function ensureLlmKey() {
  const llm =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    readEnvKey("LLM_API_KEY");
  if (!llm) {
    throw new Error(
      "LLM_API_KEY missing. Add OPENAI_API_KEY to your shell or set LLM_API_KEY in MiroFish/.env"
    );
  }
  if (!readEnvKey("ZEP_API_KEY")) {
    throw new Error("ZEP_API_KEY missing in MiroFish/.env");
  }
}

async function apiHealthy() {
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await apiHealthy()) return true;
    await sleep(2000);
    process.stdout.write(".");
  }
  return false;
}

async function startBackend() {
  const backendDir = path.join(MIROFISH, "backend");
  backendProc = spawn("uv run python run.py", {
    cwd: backendDir,
    stdio: "ignore",
    windowsHide: true,
    shell: true,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  console.log("Starting MiroFish backend…");
  const ok = await waitForBackend();
  if (!ok) throw new Error("MiroFish backend did not become ready on " + API);
  console.log(" backend ready");
}

async function ensureBackend() {
  if (await apiHealthy()) {
    console.log("MiroFish backend already running:", API);
    return;
  }
  await startBackend();
}

async function api(method, urlPath, body, isForm = false) {
  const opts = { method, headers: {} };
  if (isForm) {
    opts.body = body;
  } else if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${urlPath}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${urlPath} → ${res.status}: ${text.slice(0, 500)}`);
  return json;
}

async function poll(label, fn, maxAttempts, timeoutLabel) {
  for (let i = 0; i < maxAttempts; i++) {
    const st = await fn();
    if (st) return st;
    if (i > 0 && i % 6 === 0) process.stdout.write(`\n  ${label} still running (${Math.round((i * POLL_MS) / 60000)}m)…`);
    process.stdout.write(".");
    await sleep(POLL_MS);
  }
  throw new Error(`${timeoutLabel} timeout`);
}

async function pollGraph(taskId) {
  return poll(
    "Graph build",
    async () => {
      const st = await api("GET", `/api/graph/task/${taskId}`);
      if (st.data?.status === "completed") return st.data;
      if (st.data?.status === "failed") throw new Error(st.data?.error || "Graph build failed");
      return null;
    },
    180,
    "Graph build"
  );
}

async function pollPrepare(taskId, simulationId) {
  return poll(
    "Agent prepare",
    async () => {
      const st = await api("POST", "/api/simulation/prepare/status", { task_id: taskId, simulation_id: simulationId });
      if (st.data?.status === "ready" || st.data?.already_prepared) return st.data;
      if (st.data?.status === "failed") throw new Error(st.data?.error || "Prepare failed");
      return null;
    },
    180,
    "Prepare"
  );
}

async function pollRun(simulationId) {
  return poll(
    "Simulation",
    async () => {
      const st = await api("GET", `/api/simulation/${simulationId}/run-status`);
      if (st.data?.status === "completed" || st.data?.runner_status === "completed") return st.data;
      if (st.data?.status === "failed") throw new Error(st.data?.error || "Simulation failed");
      return null;
    },
    720,
    "Simulation"
  );
}

async function pollReport(reportId, simulationId, taskId) {
  return poll(
    "Report",
    async () => {
      const st = await api("POST", "/api/report/generate/status", {
        simulation_id: simulationId,
        ...(taskId ? { task_id: taskId } : {}),
      });
      if (st.data?.status === "completed") return st.data;
      if (st.data?.status === "failed") throw new Error(st.data?.error || st.data?.message || "Report failed");
      return null;
    },
    240,
    "Report"
  );
}

async function main() {
  if (!fs.existsSync(SEED)) {
    console.error("Missing seed:", SEED);
    process.exit(1);
  }
  if (!fs.existsSync(MIROFISH)) {
    console.error("Clone MiroFish to", MIROFISH);
    process.exit(1);
  }

  ensureLlmKey();
  await ensureBackend();

  console.log("Atlas AR → MiroFish prediction");
  console.log("API:", API);
  console.log("Seed:", SEED);
  console.log("Max rounds:", MAX_ROUNDS);

  const form = new FormData();
  const blob = new Blob([fs.readFileSync(SEED, "utf8")], { type: "text/markdown" });
  form.append("files", blob, "SEED-ATLAS-AR.md");
  form.append("simulation_requirement", REQUIREMENT);
  form.append("project_name", "Atlas AR GTM 12mo");

  console.log("\n1/6 Ontology + upload…");
  const ont = await api("POST", "/api/graph/ontology/generate", form, true);
  const projectId = ont.data?.project_id;
  if (!projectId) throw new Error("No project_id: " + JSON.stringify(ont));
  console.log(" project:", projectId);

  console.log("2/6 Build graph…");
  const build = await api("POST", "/api/graph/build", { project_id: projectId });
  await pollGraph(build.data?.task_id);
  console.log("\n done");

  console.log("3/6 Create simulation…");
  const simCreate = await api("POST", "/api/simulation/create", { project_id: projectId });
  const simulationId = simCreate.data?.simulation_id;
  if (!simulationId) throw new Error("No simulation_id");
  console.log(" simulation:", simulationId);

  console.log("4/6 Prepare agents…");
  const prep = await api("POST", "/api/simulation/prepare", {
    simulation_id: simulationId,
    parallel_profile_count: 5,
  });
  await pollPrepare(prep.data?.task_id, simulationId);
  console.log("\n done");

  console.log(`5/6 Run simulation (${MAX_ROUNDS} rounds)…`);
  await api("POST", "/api/simulation/start", {
    simulation_id: simulationId,
    platform: "parallel",
    max_rounds: MAX_ROUNDS,
  });
  await pollRun(simulationId);
  console.log("\n done");

  console.log("6/6 Generate report…");
  const rep = await api("POST", "/api/report/generate", { simulation_id: simulationId });
  const reportId = rep.data?.report_id;
  const taskId = rep.data?.task_id;
  await pollReport(reportId, simulationId, taskId);
  const full = await api("GET", `/api/report/${reportId}`);
  console.log("\n done");

  const outDir = path.join(ROOT, "docs/atlas-ar/mirofish/runs", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(full, null, 2));
  const md = full.data?.content || full.data?.report || JSON.stringify(full, null, 2);
  fs.writeFileSync(path.join(outDir, "REPORT.md"), typeof md === "string" ? md : JSON.stringify(md, null, 2));
  fs.writeFileSync(
    path.join(outDir, "meta.json"),
    JSON.stringify({ projectId, simulationId, reportId, maxRounds: MAX_ROUNDS }, null, 2)
  );

  console.log("\nSaved:", outDir);
}

function cleanup() {
  if (backendProc && !backendProc.killed) backendProc.kill();
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("exit", cleanup);

main().catch((e) => {
  console.error("\nFailed:", e.message);
  console.error("\nSetup help:");
  console.error("  node scripts/setup-mirofish.mjs");
  console.error("  npm run mirofish:predict");
  process.exit(1);
});
