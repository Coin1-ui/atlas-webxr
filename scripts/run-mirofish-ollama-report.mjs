#!/usr/bin/env node
/**
 * Offline MiroFish report: configure Ollama → start backend → resume report from checkpoint.
 *
 *   npm run mirofish:ollama-report
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { backupMirofishEnv, configureMirofishOllama, restoreMirofishEnv } from "./configure-mirofish-ollama.mjs";
import {
  DEFAULT_API,
  killStaleBackendPort,
  startOllamaBackend,
  stopManagedBackend,
} from "./mirofish-backend-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHECKPOINT = path.join(ROOT, "docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json");
const MODEL = process.env.LLM_MODEL_NAME || "qwen2.5:7b";
const OLLAMA_TAGS = process.env.OLLAMA_TAGS_URL || "http://127.0.0.1:11434/api/tags";
const OLLAMA_CHAT = process.env.LLM_BASE_URL || "http://127.0.0.1:11434/v1";

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) {
    throw new Error(`Missing checkpoint: ${CHECKPOINT}`);
  }
  const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
  if (cp.status === "report_complete" && process.env.MIROFISH_FORCE_REPORT !== "1") {
    console.log("Checkpoint already report_complete:", cp.reportRunDir || cp.reportId);
    console.log("Set MIROFISH_FORCE_REPORT=1 to regenerate.");
    process.exit(0);
  }
  if (!cp.simulationId || !cp.projectId) {
    throw new Error("Checkpoint missing simulationId or projectId");
  }
  return cp;
}

async function verifyOllama() {
  console.log("\n[1/4] Verifying Ollama…");
  let tags;
  try {
    const res = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tags = await res.json();
  } catch (e) {
    throw new Error(
      `Ollama not reachable at ${OLLAMA_TAGS}. Start the Ollama app.\n(${e.message})`
    );
  }

  const names = (tags.models || []).map((m) => m.name);
  const base = MODEL.split(":")[0];
  const hasModel = names.some((n) => n === MODEL || n.startsWith(`${base}:`));
  if (!hasModel) {
    throw new Error(`Model "${MODEL}" not pulled. Run: ollama pull ${MODEL}`);
  }

  const probe = await fetch(`${OLLAMA_CHAT}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer ollama" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 8,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!probe.ok) {
    throw new Error(`Ollama chat probe failed: ${probe.status} ${(await probe.text()).slice(0, 200)}`);
  }
  console.log(`  Ollama OK · ${MODEL}`);
}

function runReport(cp) {
  console.log("\n[4/4] Generating report (may take 15–45 min on CPU)…");
  const logPath = path.join(ROOT, "docs/atlas-ar/mirofish/runs/ollama-report.log");
  const childEnv = {
    ...process.env,
    MIROFISH_SIMULATION_ID: cp.simulationId,
    MIROFISH_PROJECT_ID: cp.projectId,
    LLM_MODEL_NAME: MODEL,
    LLM_BASE_URL: OLLAMA_CHAT,
    MIROFISH_API_URL: DEFAULT_API,
  };

  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/resume-mirofish-report.mjs"], {
      cwd: ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let out = "";
    const append = (chunk) => {
      const s = chunk.toString();
      out += s;
      process.stdout.write(s);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("close", (code) => {
      fs.appendFileSync(logPath, `\n--- ${new Date().toISOString()} ---\n${out}`);
      if (code === 0) resolve();
      else reject(new Error(`resume-mirofish-report exited ${code}. Log: ${logPath}`));
    });
  });
}

async function main() {
  const cp = loadCheckpoint();
  console.log("Checkpoint:", cp.simulationId, "·", cp.projectId);

  console.log("\n[0/4] Configuring MiroFish .env for Ollama…");
  backupMirofishEnv();
  configureMirofishOllama();

  await verifyOllama();

  console.log("\n[2/4] Killing any stale backend on :5001 (old Gemini process)…");
  await killStaleBackendPort(5001);

  console.log("\n[3/4] Starting fresh MiroFish backend with Ollama…");
  await startOllamaBackend({ model: MODEL, baseUrl: OLLAMA_CHAT });

  try {
    await runReport(cp);
    console.log("\nDone. See docs/atlas-ar/mirofish/runs/*/REPORT.md");
  } finally {
    if (process.env.MIROFISH_KEEP_BACKEND !== "1") {
      stopManagedBackend();
    }
    if (process.env.MIROFISH_RESTORE_ENV === "1") {
      restoreMirofishEnv();
    } else {
      console.log("\nCloud .env backup: MiroFish/.env.backup-before-ollama");
    }
  }
}

process.on("SIGINT", () => {
  stopManagedBackend();
  process.exit(130);
});

main().catch((e) => {
  stopManagedBackend();
  console.error("\nFailed:", e.message);
  process.exit(1);
});
