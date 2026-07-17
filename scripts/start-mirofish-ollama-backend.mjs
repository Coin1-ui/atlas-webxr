#!/usr/bin/env node
/** Kill stale :5001, configure Ollama .env, start MiroFish backend. Does not run report. */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { configureMirofishOllama, backupMirofishEnv } from "./configure-mirofish-ollama.mjs";
import { DEFAULT_API, startOllamaBackend, stopManagedBackend } from "./mirofish-backend-utils.mjs";

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

async function main() {
  console.log("Configuring MiroFish for Ollama…");
  backupMirofishEnv();
  configureMirofishOllama();

  console.log(`Starting backend on ${DEFAULT_API}…`);
  await startOllamaBackend();
  console.log("\nBackend ready. In another terminal:");
  console.log("  cd atlas-webxr && npm run mirofish:report");
  console.log("\nLeave this process running, or run full pipeline: npm run mirofish:ollama-report");
}

if (isMain) {
  process.on("SIGINT", () => {
    stopManagedBackend();
    process.exit(130);
  });
  main().catch((e) => {
    stopManagedBackend();
    console.error("Failed:", e.message);
    process.exit(1);
  });
}
