#!/usr/bin/env node
/**
 * Shared tool-using code agent loop (OpenAI-compatible chat completions + tools).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MAX_FILE_BYTES = 120_000;
const ALLOWED_CMD_PREFIXES = [
  "npm run ",
  "npm test",
  "npx tsc",
  "node scripts/",
  "git status",
  "git diff",
  "git log",
];

export const CODE_AGENT_SYSTEM_PROMPT = `You are a senior engineer working on Atlas AR (atlas-webxr).
Stack: TypeScript, Vite, Babylon.js WebXR, Cognito auth, AWS Lambda API.
Rules:
- Make minimal, focused diffs. Match existing code style.
- Do not break Android floor AR or the #ar-overlay DOM overlay.
- Prefer editing files under src/, scripts/, public/, backend/ when implementing features.
- After code changes, run relevant npm scripts (e.g. npm run build, npm run test:boot).
- When done, summarize files changed and verification steps.`;

export const CODE_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file relative to the repo root.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path from repo root" },
          offset: { type: "integer", description: "Optional 1-based start line" },
          limit: { type: "integer", description: "Optional max lines to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a UTF-8 text file relative to the repo root.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files in a directory relative to repo root (non-recursive).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search for a regex pattern under a directory (max 40 matches).",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string", description: "Directory or file relative to repo root" },
        },
        required: ["pattern", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a safe shell command in the repo root. Allowed: npm run/test, npx tsc, node scripts/, git status/diff/log.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
];

function safeRepoPath(repoRoot, relPath) {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.resolve(repoRoot, normalized);
  if (!full.startsWith(path.resolve(repoRoot))) {
    throw new Error(`Path escapes repo: ${relPath}`);
  }
  return full;
}

function readFileTool(repoRoot, args) {
  const full = safeRepoPath(repoRoot, args.path);
  if (!fs.existsSync(full)) return { error: `File not found: ${args.path}` };
  const stat = fs.statSync(full);
  if (!stat.isFile()) return { error: `Not a file: ${args.path}` };
  if (stat.size > MAX_FILE_BYTES) {
    return { error: `File too large (${stat.size} bytes). Use offset/limit.` };
  }
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
  const offset = Math.max(1, Number(args.offset) || 1);
  const limit = Math.min(400, Number(args.limit) || 200);
  const slice = lines.slice(offset - 1, offset - 1 + limit);
  return {
    path: args.path,
    offset,
    lines: slice.length,
    content: slice.map((l, i) => `${offset + i}|${l}`).join("\n"),
  };
}

function writeFileTool(repoRoot, args) {
  const full = safeRepoPath(repoRoot, args.path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, args.content, "utf8");
  return { ok: true, path: args.path, bytes: Buffer.byteLength(args.content, "utf8") };
}

function listDirTool(repoRoot, args) {
  const full = safeRepoPath(repoRoot, args.path || ".");
  if (!fs.existsSync(full)) return { error: `Not found: ${args.path}` };
  const entries = fs.readdirSync(full, { withFileTypes: true }).slice(0, 80);
  return {
    path: args.path || ".",
    entries: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)),
  };
}

function grepTool(repoRoot, args) {
  const full = safeRepoPath(repoRoot, args.path);
  const re = new RegExp(args.pattern, "i");
  const results = [];

  function walk(dir, depth = 0) {
    if (depth > 4 || results.length >= 40) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (results.length >= 40) break;
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, depth + 1);
      else if (entry.isFile() && entry.name.match(/\.(ts|tsx|js|mjs|css|html|md|json)$/)) {
        const rel = path.relative(repoRoot, p).replace(/\\/g, "/");
        const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
        for (let i = 0; i < lines.length && results.length < 40; i++) {
          if (re.test(lines[i])) results.push(`${rel}:${i + 1}:${lines[i].trim().slice(0, 160)}`);
        }
      }
    }
  }

  if (fs.statSync(full).isDirectory()) walk(full);
  else {
    const rel = path.relative(repoRoot, full).replace(/\\/g, "/");
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length && results.length < 40; i++) {
      if (re.test(lines[i])) results.push(`${rel}:${i + 1}:${lines[i].trim().slice(0, 160)}`);
    }
  }
  return { matches: results.length, results };
}

function runCommandTool(repoRoot, args) {
  const cmd = String(args.command || "").trim();
  const allowed = ALLOWED_CMD_PREFIXES.some((p) => cmd.startsWith(p));
  if (!allowed) {
    return { error: `Command not allowed. Must start with: ${ALLOWED_CMD_PREFIXES.join(", ")}` };
  }
  const result = spawnSync(cmd, {
    cwd: repoRoot,
    shell: true,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 512_000,
  });
  return {
    exitCode: result.status,
    stdout: (result.stdout || "").slice(-8000),
    stderr: (result.stderr || "").slice(-4000),
  };
}

function dispatchTool(repoRoot, name, args) {
  switch (name) {
    case "read_file":
      return readFileTool(repoRoot, args);
    case "write_file":
      return writeFileTool(repoRoot, args);
    case "list_dir":
      return listDirTool(repoRoot, args);
    case "grep":
      return grepTool(repoRoot, args);
    case "run_command":
      return runCommandTool(repoRoot, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runCodeAgent({
  repoRoot,
  taskPrompt,
  model,
  maxTurns = 24,
  onEvent,
  chat,
  providerLabel = "LLM",
}) {
  const messages = [
    { role: "system", content: CODE_AGENT_SYSTEM_PROMPT },
    { role: "user", content: taskPrompt },
  ];

  for (let turn = 1; turn <= maxTurns; turn++) {
    onEvent?.({ type: "turn", turn, maxTurns });
    const response = await chat(model, messages);
    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new Error(`${providerLabel}: no message in response: ${JSON.stringify(response).slice(0, 300)}`);
    }

    const msg = choice.message;
    messages.push(msg);

    if (msg.content) {
      onEvent?.({ type: "assistant", content: msg.content });
    }

    const toolCalls = msg.tool_calls || [];
    if (!toolCalls.length) {
      onEvent?.({ type: "done", usage: response.usage, model: response.model });
      return { messages, usage: response.usage, model: response.model, content: msg.content || "" };
    }

    for (const call of toolCalls) {
      const fn = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      onEvent?.({ type: "tool_call", name: fn, args });
      let result;
      try {
        result = dispatchTool(repoRoot, fn, args);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      onEvent?.({ type: "tool_result", name: fn, result });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(`Agent exceeded max turns (${maxTurns})`);
}

export async function openAiCompatibleChat({
  apiUrl,
  apiKey,
  model,
  messages,
  extraHeaders = {},
  providerLabel = "API",
}) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: CODE_AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${providerLabel} HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}
