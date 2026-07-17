#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_KEY_DIR = process.platform === "win32" ? "d:\\AI\\atlas-webxr" : path.join(process.env.HOME || "", "atlas-webxr");
const KEY_FILE = "Gemini API Key.txt";

export function resolveGeminiKeyDir() {
  return process.env.GEMINI_KEY_DIR || process.env.MIROFISH_KEY_DIR || DEFAULT_KEY_DIR;
}

export function readGeminiKey() {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const keyPath = path.join(resolveGeminiKeyDir(), KEY_FILE);
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Gemini key not found. Set GEMINI_API_KEY or place key in:\n  ${keyPath}`,
    );
  }
  const line = fs
    .readFileSync(keyPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 8);
  if (!line) {
    throw new Error(`Gemini key file is empty: ${keyPath}`);
  }
  return line;
}

export function defaultGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export function geminiChatCompletionsUrl() {
  return (
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
  );
}
