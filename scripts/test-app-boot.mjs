#!/usr/bin/env node
/**
 * Verifies the SPA boot renders home UI (catches amazon-cognito-identity-js global errors, etc.).
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const BASE_URL = process.env.ATLAS_TEST_URL || "https://localhost:4173";
const START_SERVER = process.env.ATLAS_START_SERVER !== "0";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let serverProc = null;

function waitForServer(url, timeoutMs = 60000) {
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

async function run() {
  await maybeStartServer();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const resp = await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("#app h1", { timeout: 10000 });

  const h1 = await page.locator("#app h1").textContent();
  const appHtml = await page.locator("#app").innerHTML();
  const hasPrimaryAction =
    appHtml.includes("Start AR") ||
    appHtml.includes("View in AR") ||
    appHtml.includes("Sign in");

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector('#app input[name="email"]', { timeout: 10000 });
  const loginH1 = await page.locator("#app h1").textContent();

  await browser.close();
  if (serverProc) serverProc.kill();

  const failures = [];
  if (resp?.status() !== 200) failures.push(`HTTP ${resp?.status()}`);
  if (!h1?.includes("Atlas AR")) failures.push(`unexpected h1: ${h1}`);
  if (!loginH1?.includes("Atlas AR")) failures.push(`login page missing: ${loginH1}`);
  if (!hasPrimaryAction) failures.push("missing primary home action button");
  const criticalErrors = pageErrors.filter(
    (e) =>
      !/ServiceWorker|service worker|sw\.js|SSL certificate/i.test(e)
  );
  if (criticalErrors.length) failures.push(`page errors: ${criticalErrors.join("; ")}`);

  if (failures.length) {
    console.error("test:boot FAILED", failures);
    process.exit(1);
  }
  console.log("test:boot — home UI OK", { h1: h1?.trim(), url: BASE_URL });
}

run().catch((e) => {
  if (serverProc) serverProc.kill();
  console.error("test:boot error", e);
  process.exit(1);
});
