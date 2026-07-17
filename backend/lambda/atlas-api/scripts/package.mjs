import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lambdaRoot = path.join(__dirname, "..");
const outZip = path.join(lambdaRoot, "..", "atlas-api-deploy.zip");
const stageDir = path.join(lambdaRoot, ".package");

function pauseSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* wait for Windows file handles to release */
  }
}

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return;
    } catch (e) {
      const code = /** @type {NodeJS.ErrnoException} */ (e).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "ENOTEMPTY") throw e;
      if (attempt < 2) {
        pauseSync(400);
        continue;
      }
      const stale = `${dir}.stale-${Date.now()}`;
      fs.renameSync(dir, stale);
      try {
        fs.rmSync(stale, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch {
        console.warn(`Warning: could not remove stale package dir ${stale} — delete it manually if builds fail.`);
      }
      return;
    }
  }
}

rmrf(stageDir);
fs.mkdirSync(stageDir, { recursive: true });

execSync("npm ci --omit=dev", { cwd: lambdaRoot, stdio: "inherit" });

const copyPaths = [
  ["index.mjs", "index.mjs"],
  ["handlers", "handlers"],
  ["lib", "lib"],
];

for (const [src, dest] of copyPaths) {
  const from = path.join(lambdaRoot, src);
  const to = path.join(stageDir, dest);
  fs.cpSync(from, to, { recursive: true });
}

fs.cpSync(path.join(lambdaRoot, "node_modules"), path.join(stageDir, "node_modules"), {
  recursive: true,
});

if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${outZip}' -Force"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`cd "${stageDir}" && zip -r "${outZip}" .`, { stdio: "inherit" });
}

console.log(`Packaged ${outZip}`);
