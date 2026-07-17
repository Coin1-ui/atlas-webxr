#!/usr/bin/env node
/** @deprecated Use `npm run generate:brand` — favicons are generated as part of the full brand export. */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, "generate-brand-assets.mjs")], { stdio: "inherit" });
process.exit(r.status ?? 1);
