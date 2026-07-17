#!/usr/bin/env node
import { openAiCompatibleChat, runCodeAgent } from "./code-agent.mjs";
import { defaultGeminiModel, geminiChatCompletionsUrl, readGeminiKey } from "./gemini-key.mjs";

export async function runGeminiAgent({
  repoRoot,
  taskPrompt,
  model = defaultGeminiModel(),
  maxTurns = Number(process.env.GEMINI_MAX_TURNS || 24),
  onEvent,
}) {
  const apiKey = readGeminiKey();
  const apiUrl = geminiChatCompletionsUrl();

  return runCodeAgent({
    repoRoot,
    taskPrompt,
    model,
    maxTurns,
    onEvent,
    providerLabel: "Gemini",
    chat: (m, messages) =>
      openAiCompatibleChat({
        apiUrl,
        apiKey,
        model: m,
        messages,
        providerLabel: "Gemini",
      }),
  });
}
