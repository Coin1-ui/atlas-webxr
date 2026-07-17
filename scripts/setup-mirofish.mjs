#!/usr/bin/env node
/**
 * One-time MiroFish setup: fill .env LLM key from env, install deps via uv.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIROFISH = path.resolve(__dirname, "../../MiroFish");
const ENV_PATH = path.join(MIROFISH, ".env");

function run(cmd, args, cwd = MIROFISH) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function ensureEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing", ENV_PATH);
    process.exit(1);
  }
  let env = fs.readFileSync(ENV_PATH, "utf8");
  const llm =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    "";
  if (!llm) {
    console.error(
      "No LLM key found. Set LLM_API_KEY or OPENAI_API_KEY in your shell, then re-run."
    );
    process.exit(1);
  }
  if (/^LLM_API_KEY=\s*$/m.test(env)) {
    env = env.replace(/^LLM_API_KEY=\s*$/m, `LLM_API_KEY=${llm}`);
  } else if (!/^LLM_API_KEY=.+$/m.test(env)) {
    env += `\nLLM_API_KEY=${llm}\n`;
  }
  fs.writeFileSync(ENV_PATH, env);
  console.log("LLM_API_KEY configured in MiroFish/.env");
}

ensureEnv();
run("npm", ["install"]);
run("npm", ["install"], path.join(MIROFISH, "frontend"));
run("uv", ["sync"], path.join(MIROFISH, "backend"));
console.log("MiroFish setup complete.");
