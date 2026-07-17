#!/usr/bin/env node
import { openAiCompatibleChat, runCodeAgent } from "./code-agent.mjs";
import { defaultOpenRouterModel, readOpenRouterKey } from "./openrouter-key.mjs";

const API_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";

export async function runOpenRouterAgent({
  repoRoot,
  taskPrompt,
  model = defaultOpenRouterModel(),
  maxTurns = Number(process.env.OPENROUTER_MAX_TURNS || 24),
  onEvent,
}) {
  const apiKey = readOpenRouterKey();

  return runCodeAgent({
    repoRoot,
    taskPrompt,
    model,
    maxTurns,
    onEvent,
    providerLabel: "OpenRouter",
    chat: (m, messages) =>
      openAiCompatibleChat({
        apiUrl: API_URL,
        apiKey,
        model: m,
        messages,
        providerLabel: "OpenRouter",
        extraHeaders: {
          "HTTP-Referer": "https://github.com/omnimanual/atlas-ar",
          "X-OpenRouter-Title": "Atlas AR OpenRouter Agent",
        },
      }),
  });
}
