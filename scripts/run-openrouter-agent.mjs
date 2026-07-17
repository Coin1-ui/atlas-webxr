#!/usr/bin/env node
/**
 * Run an Atlas AR development task via OpenRouter (bypasses Cursor subagent limits).
 *
 * Usage:
 *   npm run agent:openrouter -- --brief agent-briefs/atlas-ar/MKT-1-landing-pricing.md
 *   npm run agent:openrouter -- --task "Implement LEG-1 privacy page stub"
 *   npm run agent:openrouter -- --probe
 *
 * Key file (default): d:\AI\atlas-webxr\OpenRouter Api key.txt
 * Override: OPENROUTER_API_KEY or OPENROUTER_KEY_DIR
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runOpenRouterAgent } from "./lib/openrouter-agent.mjs";
import { readOpenRouterKey, defaultOpenRouterModel, resolveOpenRouterKeyDir } from "./lib/openrouter-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUNS_DIR = path.join(ROOT, ".atlas-dev", "openrouter-runs");

function parseArgs(argv) {
  const out = { brief: "", task: "", probe: false, model: defaultOpenRouterModel(), maxTurns: 24 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--brief" && argv[i + 1]) out.brief = argv[++i];
    else if (a === "--task" && argv[i + 1]) out.task = argv[++i];
    else if (a === "--model" && argv[i + 1]) out.model = argv[++i];
    else if (a === "--max-turns" && argv[i + 1]) out.maxTurns = Number(argv[++i]);
    else if (a === "--probe") out.probe = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Atlas AR — OpenRouter agent runner

Usage:
  npm run agent:openrouter -- --brief <path-to-brief.md>
  npm run agent:openrouter -- --task "<implementation instructions>"
  npm run agent:openrouter -- --probe

Options:
  --model <id>       OpenRouter model (default: ${defaultOpenRouterModel()})
  --max-turns <n>    Agent loop limit (default: 24)
  --probe            Test API key with a one-line completion

Key directory: ${resolveOpenRouterKeyDir()}
Env: OPENROUTER_API_KEY, OPENROUTER_KEY_DIR, OPENROUTER_MODEL
`);
}

function loadBrief(briefPath) {
  const full = path.isAbsolute(briefPath) ? briefPath : path.join(ROOT, briefPath);
  if (!fs.existsSync(full)) throw new Error(`Brief not found: ${full}`);
  const text = fs.readFileSync(full, "utf8");
  return `Execute this agent brief for Atlas AR. Read referenced docs first, then implement deliverables.

Brief file: ${path.relative(ROOT, full).replace(/\\/g, "/")}

${text}`;
}

async function probe() {
  const apiKey = readOpenRouterKey();
  const model = defaultOpenRouterModel();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: Atlas AR OpenRouter OK" }],
      max_tokens: 32,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Probe failed HTTP ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  const text = body.choices?.[0]?.message?.content || "";
  console.log(`Probe OK — model: ${body.model}`);
  console.log(`Reply: ${text.trim()}`);
  if (body.usage?.cost != null) console.log(`Cost: $${body.usage.cost}`);
}

function ensureRunsDir() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function writeRunLog(id, events) {
  ensureRunsDir();
  const logPath = path.join(RUNS_DIR, `${id}.jsonl`);
  fs.writeFileSync(logPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  return logPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.probe) {
    await probe();
    return;
  }
  if (!args.brief && !args.task) {
    printHelp();
    process.exit(1);
  }

  const taskPrompt = args.brief ? loadBrief(args.brief) : args.task;
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  const events = [];

  console.log(`OpenRouter agent — model: ${args.model}`);
  console.log(`Repo: ${ROOT}`);
  console.log(`Key dir: ${resolveOpenRouterKeyDir()}\n`);

  const result = await runOpenRouterAgent({
    repoRoot: ROOT,
    taskPrompt,
    model: args.model,
    maxTurns: args.maxTurns,
    onEvent: (event) => {
      events.push({ ts: new Date().toISOString(), ...event });
      if (event.type === "turn") {
        process.stdout.write(`\n--- turn ${event.turn}/${event.maxTurns} ---\n`);
      } else if (event.type === "assistant") {
        console.log(event.content);
      } else if (event.type === "tool_call") {
        console.log(`[tool] ${event.name} ${JSON.stringify(event.args).slice(0, 200)}`);
      } else if (event.type === "tool_result") {
        const preview = JSON.stringify(event.result).slice(0, 300);
        console.log(`[result] ${event.name}: ${preview}${preview.length >= 300 ? "…" : ""}`);
      } else if (event.type === "done") {
        console.log(`\nDone — model: ${event.model}, tokens: ${event.usage?.total_tokens ?? "?"}`);
      }
    },
  });

  const logPath = writeRunLog(runId, events);
  console.log(`\nRun log: ${logPath}`);
  console.log("\n=== Final summary ===\n");
  console.log(result.content || "(no final message)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
