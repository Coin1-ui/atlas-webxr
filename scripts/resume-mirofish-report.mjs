#!/usr/bin/env node
/** Resume MiroFish report generation for a completed simulation. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_API,
  isStaleCloudLlmError,
  requireOllamaBackend,
} from "./mirofish-backend-utils.mjs";

async function warmupOllama() {
  const base = process.env.LLM_BASE_URL || "http://127.0.0.1:11434/v1";
  const model = process.env.LLM_MODEL_NAME || "qwen2.5:7b";
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ollama" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply OK." }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) {
      console.warn("Ollama warmup failed:", res.status, (await res.text()).slice(0, 120));
    } else {
      console.log("Ollama warmup OK — model loaded:", model);
    }
  } catch (e) {
    console.warn("Ollama warmup skipped:", e.message);
  }
}

function isConnectionError(msg) {
  return /connection error|connection refused|timed out|timeout|broken pipe|reset by peer/i.test(msg);
}

const API = process.env.MIROFISH_API_URL || DEFAULT_API;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKPOINT_PATH = path.join(ROOT, "docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json");

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch {
    return {};
  }
}

const checkpoint = loadCheckpoint();
const SIMULATION_ID = process.env.MIROFISH_SIMULATION_ID || checkpoint.simulationId || "sim_e6b7b440cb5a";
const PROJECT_ID = process.env.MIROFISH_PROJECT_ID || checkpoint.projectId || "proj_e8b9dcc98715";
const POLL_MS = 5000;
const MAX_POLLS = Number(process.env.MIROFISH_REPORT_MAX_POLLS || 720); // ~60 min

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${urlPath} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

function reportMarkdown(full) {
  const d = full.data ?? {};
  if (typeof d.markdown_content === "string" && d.markdown_content.trim()) return d.markdown_content;
  if (typeof d.content === "string" && d.content.trim()) return d.content;
  if (typeof d.report === "string" && d.report.trim()) return d.report;
  const sections = d.outline?.sections;
  if (Array.isArray(sections) && sections.some((s) => s.content?.trim())) {
    const title = d.outline?.title || "MiroFish Report";
    const summary = d.outline?.summary || "";
    return [
      `# ${title}`,
      summary ? `\n${summary}\n` : "",
      ...sections.map((s) => `## ${s.title}\n\n${s.content || ""}`),
    ].join("\n");
  }
  return "";
}

function save(full, reportId) {
  const md = reportMarkdown(full);
  if (!md.trim()) {
    throw new Error(
      `Report ${reportId} has no markdown content (status=${full.data?.status ?? "unknown"}). Generation may still be running or failed.`
    );
  }

  const outDir = path.join(ROOT, "docs/atlas-ar/mirofish/runs", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(full, null, 2));
  fs.writeFileSync(path.join(outDir, "REPORT.md"), md);
  fs.writeFileSync(
    path.join(outDir, "meta.json"),
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        simulationId: SIMULATION_ID,
        reportId,
        liveRun: true,
        llm: process.env.LLM_MODEL_NAME || "ollama/qwen2.5:7b",
        status: full.data?.status ?? "completed",
      },
      null,
      2
    )
  );

  const checkpointPath = path.join(ROOT, "docs/atlas-ar/mirofish/runs/CHECKPOINT-live-run.json");
  fs.writeFileSync(
    checkpointPath,
    JSON.stringify(
      {
        status: "report_complete",
        simulationId: SIMULATION_ID,
        projectId: PROJECT_ID,
        reportId,
        reportRunDir: path.relative(ROOT, outDir).replace(/\\/g, "/"),
        rounds: checkpoint.rounds ?? 40,
        simulationProvider: checkpoint.simulationProvider,
        simulationModel: checkpoint.simulationModel ?? "gemini-2.5-flash",
        reportLlm: process.env.LLM_MODEL_NAME || "qwen2.5:14b",
        simulationRunDir: checkpoint.runDir,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
      null,
      2
    )
  );

  console.log("\nSaved:", outDir);
  console.log("REPORT.md length:", md.length, "chars");
}

async function fetchReport(reportId) {
  return api("GET", `/api/report/${reportId}`);
}

async function generateReport() {
  await requireOllamaBackend(API);
  await warmupOllama();
  console.log("Generating report for", SIMULATION_ID, "(force_regenerate=true, local Ollama)");

  const check = await api("GET", `/api/report/check/${SIMULATION_ID}`);
  if (check.data?.has_report) {
    console.log("Existing report:", check.data.report_id, "status:", check.data.report_status);
  }

  const rep = await api("POST", "/api/report/generate", {
    simulation_id: SIMULATION_ID,
    force_regenerate: true,
  });

  const reportId = rep.data?.report_id;
  const taskId = rep.data?.task_id;

  if (rep.data?.already_generated && rep.data?.report_id) {
    const full = await fetchReport(rep.data.report_id);
    if (full.data?.status === "completed" && reportMarkdown(full).trim()) {
      save(full, rep.data.report_id);
      return;
    }
  }

  if (!reportId) throw new Error("No report_id: " + JSON.stringify(rep));
  console.log("Report ID:", reportId, taskId ? `task ${taskId}` : "");

  let completed = false;
  for (let i = 0; i < MAX_POLLS; i++) {
    const st = await api("POST", "/api/report/generate/status", {
      simulation_id: SIMULATION_ID,
      ...(taskId ? { task_id: taskId } : {}),
    });
    const status = st.data?.status;
    const progress = st.data?.progress ?? 0;
    const message = st.data?.message || "";

    if (status === "completed" || st.data?.already_completed) {
      completed = true;
      break;
    }
    if (status === "failed") {
      throw new Error(st.data?.error || message || "Report task failed");
    }

    if (i > 0 && i % 6 === 0) {
      process.stdout.write(`\n  ${Math.round((i * POLL_MS) / 60000)}m · ${progress}% ${message.slice(0, 80)}`);
    }
    process.stdout.write(".");
    await sleep(POLL_MS);
  }

  if (!completed) {
    throw new Error(`Report timed out after ${Math.round((MAX_POLLS * POLL_MS) / 60000)} minutes`);
  }

  const full = await fetchReport(reportId);
  if (full.data?.status !== "completed") {
    throw new Error(`Report ended with status=${full.data?.status}: ${full.data?.error || "unknown error"}`);
  }
  save(full, reportId);
}

async function main() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await generateReport();
      return;
    } catch (e) {
      const msg = String(e.message || e);
      if (isStaleCloudLlmError(msg)) {
        throw new Error(
          `${msg.slice(0, 200)}\n\n` +
            "Diagnosis: backend is still calling Gemini/cloud APIs.\n" +
            "Fix: npm run mirofish:ollama-backend   then   npm run mirofish:report"
        );
      }
      if (isConnectionError(msg)) {
        throw new Error(
          `${msg.slice(0, 200)}\n\n` +
            "Diagnosis: Ollama dropped the connection (often RAM/CPU overload with qwen2.5:14b).\n" +
            "Fix:\n" +
            "  1. Restart Ollama app\n" +
            "  2. npm run mirofish:ollama-config   (uses qwen2.5:7b + lighter report settings)\n" +
            "  3. npm run mirofish:ollama-backend\n" +
            "  4. npm run mirofish:report"
        );
      }
      const retryable = /ECONNREFUSED|fetch failed|network/i.test(msg) && !isStaleCloudLlmError(msg);
      if (!retryable || attempt === 5) throw e;
      const waitSec = 45 * attempt;
      console.error(`\nAttempt ${attempt} failed (${msg.slice(0, 120)}…). Retrying in ${waitSec}s…`);
      await sleep(waitSec * 1000);
    }
  }
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
