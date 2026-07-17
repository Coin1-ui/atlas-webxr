/**
 * Verifies custom GLB models parse sequentially in headless Chromium (WebGL).
 * Root cause fixed: parallel LoadAssetContainerAsync on one Scene deadlocks forever.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const outDir = join(root, "test-results");
const reportPath = join(outDir, "glb-parse-test-report.json");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = process.env.ATLAS_TEST_URL || "https://localhost:4173";
const START_SERVER = process.env.ATLAS_START_SERVER !== "0";

const report = {
  meta: {
    testedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    note: "Sequential GLB parse self-test via ?selftest=glb",
  },
  ok: false,
  durationMs: 0,
  models: [],
  error: null,
};

function waitForServer(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok || res.status < 500) return resolve(true);
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Server not ready: ${url}`));
      setTimeout(tick, 1500);
    };
    tick();
  });
}

let serverProc = null;

async function maybeStartServer() {
  if (!START_SERVER) return;
  await new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], { cwd: root, shell: true, stdio: "inherit" });
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
  });
  serverProc = spawn("npx", ["vite", "preview", "--host", "--port", "4173"], {
    cwd: root,
    shell: true,
    stdio: "ignore",
  });
  await waitForServer(BASE_URL);
}

try {
  await maybeStartServer();

  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  await page.goto(`${BASE_URL}/?selftest=glb&_=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  });

  await page.goto(`${BASE_URL}/?selftest=glb&_=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForFunction(
    () => typeof window.__glbTestResult !== "undefined",
    undefined,
    { timeout: 180000 }
  );

  const result = await page.evaluate(() => window.__glbTestResult);
  await browser.close();

  report.ok = Boolean(result?.ok);
  report.durationMs = result?.durationMs ?? 0;
  report.models = result?.parsed ?? [];
  report.warmed = result?.warmed ?? [];
  report.failed = result?.failed ?? [];
  report.modelCount = result?.modelCount ?? 0;

  if (!report.ok) {
    report.error =
      result?.failed?.map((f) => `${f.url}: ${f.error}`).join("; ") ||
      "One or more models did not parse";
  }

  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = e instanceof Error ? e.message : String(e);
  console.error(report.error);
} finally {
  if (serverProc) serverProc.kill();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Wrote ${reportPath}`);
  process.exit(report.ok ? 0 : 1);
}
