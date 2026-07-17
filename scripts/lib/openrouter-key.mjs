#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_KEY_DIR = process.platform === "win32" ? "d:\\AI\\atlas-webxr" : path.join(process.env.HOME || "", "atlas-webxr");
const KEY_FILE = "OpenRouter Api key.txt";

export function resolveOpenRouterKeyDir() {
  return process.env.OPENROUTER_KEY_DIR || process.env.MIROFISH_KEY_DIR || DEFAULT_KEY_DIR;
}

export function readOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  const keyPath = path.join(resolveOpenRouterKeyDir(), KEY_FILE);
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `OpenRouter key not found. Set OPENROUTER_API_KEY or place key in:\n  ${keyPath}`,
    );
  }
  const line = fs
    .readFileSync(keyPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 8);
  if (!line) {
    throw new Error(`OpenRouter key file is empty: ${keyPath}`);
  }
  return line;
}

export function defaultOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || "qwen/qwen-2.5-coder-32b-instruct";
}
