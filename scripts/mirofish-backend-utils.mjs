#!/usr/bin/env node
/** Shared helpers: kill stale MiroFish backend, verify Ollama LLM is active. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIROFISH_ROOT = path.resolve(__dirname, "../../MiroFish");
export const DEFAULT_API = process.env.MIROFISH_API_URL || "http://127.0.0.1:5001";

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Kill any process listening on MiroFish port (stale backend keeps old Gemini config in memory). */
export async function killStaleBackendPort(port = 5001) {
  if (process.platform === "win32") {
    try {
      const { execSync } = await import("node:child_process");
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/LISTENING\s+(\d+)/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`  Killed stale :${port} (pid ${pid})`);
        } catch {
          /* ignore */
        }
      }
      if (pids.size) await sleep(2500);
      return pids.size;
    } catch {
      return 0;
    }
  }

  try {
    const { execSync } = await import("node:child_process");
    execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: "ignore", shell: true });
    await sleep(1500);
    return 1;
  } catch {
    return 0;
  }
}

export async function fetchBackendHealth(api = DEFAULT_API) {
  const res = await fetch(`${api}/health`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Backend health HTTP ${res.status}`);
  return res.json();
}

export function isOllamaHealth(health) {
  const llm = health?.llm || {};
  const base = String(llm.base_url || "");
  return (
    llm.local_ollama === true ||
    base.includes("11434") ||
    base.includes("127.0.0.1") ||
    base.toLowerCase().includes("localhost")
  );
}

export async function requireOllamaBackend(api = DEFAULT_API) {
  if (process.env.MIROFISH_REQUIRE_OLLAMA === "0") {
    console.warn("MIROFISH_REQUIRE_OLLAMA=0 — skipping backend LLM check");
    return null;
  }

  let health;
  try {
    health = await fetchBackendHealth(api);
  } catch (e) {
    throw new Error(
      `MiroFish backend not reachable at ${api} (${e.message}).\n` +
        `Run the full pipeline:  npm run mirofish:ollama-report\n` +
        `Or restart backend only: npm run mirofish:ollama-backend`
    );
  }

  if (!health.llm) {
    throw new Error(
      `Backend at ${api} has no LLM info in /health — it is an old process still using cloud keys.\n` +
        `Kill port 5001 and restart:  npm run mirofish:ollama-backend`
    );
  }

  if (!isOllamaHealth(health)) {
    throw new Error(
      `Backend is still on CLOUD LLM (not Ollama):\n` +
        `  base_url: ${health.llm.base_url}\n` +
        `  model:    ${health.llm.model}\n\n` +
        `The .env file may be correct, but the running process was started with Gemini.\n` +
        `Fix:\n` +
        `  1. npm run mirofish:ollama-backend   (kills :5001, starts fresh Ollama backend)\n` +
        `  2. npm run mirofish:report`
    );
  }

  console.log(`Backend LLM OK: ${health.llm.model} @ ${health.llm.base_url}`);
  return health;
}

export function isStaleCloudLlmError(msg) {
  return /generativelanguage|gemini-|google\.dev\/gemini|dashscope|openai\.com/i.test(String(msg));
}

export function readZepFromMirofishEnv() {
  const envPath = path.join(MIROFISH_ROOT, ".env");
  if (!fs.existsSync(envPath)) return "";
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("ZEP_API_KEY="));
  return line ? line.slice("ZEP_API_KEY=".length).trim() : "";
}

let backendProc = null;

export function stopManagedBackend() {
  if (backendProc && !backendProc.killed) {
    backendProc.kill();
    backendProc = null;
  }
}

export async function waitForBackend(api = DEFAULT_API, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await fetchBackendHealth(api);
      if (h?.status === "ok") return true;
    } catch {
      /* retry */
    }
    await sleep(2000);
    process.stdout.write(".");
  }
  return false;
}

/** Start MiroFish backend with Ollama env vars (process env overrides shell Gemini vars). */
export async function startOllamaBackend({
  model = process.env.LLM_MODEL_NAME || "qwen2.5:14b",
  baseUrl = process.env.LLM_BASE_URL || "http://127.0.0.1:11434/v1",
  api = DEFAULT_API,
} = {}) {
  stopManagedBackend();
  const killed = await killStaleBackendPort(5001);
  if (killed) console.log("Cleared stale backend on :5001");

  const backendDir = path.join(MIROFISH_ROOT, "backend");
  const env = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    LLM_API_KEY: "ollama",
    LLM_BASE_URL: baseUrl,
    LLM_MODEL_NAME: model,
    LLM_FALLBACK_MODELS: "",
    ZEP_API_KEY: readZepFromMirofishEnv(),
    FLASK_DEBUG: "False",
    FLASK_HOST: "127.0.0.1",
    REPORT_AGENT_MAX_TOOL_CALLS: process.env.REPORT_AGENT_MAX_TOOL_CALLS || "2",
    REPORT_AGENT_MIN_TOOL_CALLS: process.env.REPORT_AGENT_MIN_TOOL_CALLS || "1",
    REPORT_AGENT_MAX_REFLECTION_ROUNDS: process.env.REPORT_AGENT_MAX_REFLECTION_ROUNDS || "1",
    OLLAMA_MAX_TOKENS: process.env.OLLAMA_MAX_TOKENS || "2048",
    OLLAMA_CONNECTION_RETRIES: process.env.OLLAMA_CONNECTION_RETRIES || "5",
    OLLAMA_RETRY_DELAY_SEC: process.env.OLLAMA_RETRY_DELAY_SEC || "10",
  };

  backendProc = spawn("uv run python run.py", {
    cwd: backendDir,
    stdio: "ignore",
    windowsHide: true,
    shell: true,
    env,
  });

  const ok = await waitForBackend(api);
  if (!ok) throw new Error(`MiroFish backend not ready on ${api}`);
  await requireOllamaBackend(api);
  return backendProc;
}
