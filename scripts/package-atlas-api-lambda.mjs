#!/usr/bin/env node
/** Package atlas-api Lambda for manual Console upload — delegates to backend/lambda/atlas-api/scripts/package.mjs */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");
const lambdaDir = path.join(repoRoot, "backend", "lambda", "atlas-api");
const outZip = path.join(repoRoot, "backend", "lambda", "atlas-api-deploy.zip");

if (!fs.existsSync(lambdaDir)) {
  console.error(`Missing ${lambdaDir}`);
  process.exit(1);
}

execSync("npm run package", { cwd: lambdaDir, stdio: "inherit" });

const stat = fs.statSync(outZip);
console.log(
  JSON.stringify({
    ok: true,
    zip: outZip,
    bytes: stat.size,
    mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
    note: "Lean deploy zip (index.mjs + handlers/ + lib/ + prod node_modules only). ~4.5 MB is normal; older ~9 MB zips included duplicate .package/ staging.",
  }),
);
