#!/usr/bin/env node
/**
 * QA Sprint 3 — Playwright E2E (automated portion of QA-3 / QA-4).
 *
 * Covers: auth → onboard → tenant home → direct AR landing → mobile/iOS UI.
 * Physical Android WebXR placement + iOS Quick Look open remain manual (see docs/atlas-ar/QA-SPRINT3.md).
 *
 * Env:
 *   ATLAS_TEST_URL       — default https://localhost:5173 (vite dev + local API)
 *   ATLAS_USE_DEV        — default 1; set 0 to use preview (requires VITE_ATLAS_API_URL)
 *   ATLAS_START_SERVER   — default 1 (build + preview); set 0 to reuse running server
 *   ATLAS_SEED_FIXTURE   — default 1 (seed .atlas-dev/qa-sprint3)
 */
import { chromium, devices } from "playwright";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createReport } from "./lib/sprint3-report.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
/** Dev server includes atlas-saas-api middleware; preview does not. */
const USE_DEV_SERVER = process.env.ATLAS_USE_DEV !== "0";
const PORT = USE_DEV_SERVER ? 5173 : 4173;
const BASE_URL = process.env.ATLAS_TEST_URL || `https://localhost:${PORT}`;
const START_SERVER = process.env.ATLAS_START_SERVER !== "0";
const SEED_FIXTURE = process.env.ATLAS_SEED_FIXTURE !== "0";

const SLUG = "qa-sprint3";
const MODEL_ID = "qa-test-chair";
const TEST_EMAIL = "qa-tester@example.com";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let serverProc = null;
const { record, finish } = createReport("sprint3-e2e", {
  meta: { baseUrl: BASE_URL, slug: SLUG, modelId: MODEL_ID, mode: USE_DEV_SERVER ? "dev" : "preview" },
});

function waitForServer(url, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let okStreak = 0;
    const tick = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok || res.status < 500) {
          okStreak += 1;
          if (okStreak >= 2) return resolve(true);
        } else {
          okStreak = 0;
        }
      } catch {
        okStreak = 0;
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Server not ready: ${url}`));
      setTimeout(tick, 2000);
    };
    tick();
  });
}

async function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: root, shell: true, stdio: "inherit" });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed`))));
  });
}

async function maybeStartServer() {
  if (SEED_FIXTURE) {
    await runCmd("node", ["scripts/seed-sprint3-dev-fixture.mjs"]);
    record("seed-fixture", "Seed qa-sprint3 dev workspace", "passed");
  }
  if (!START_SERVER) return;
  if (!USE_DEV_SERVER) {
    await runCmd("npm", ["run", "build"]);
  }
  const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
  const viteArgs = USE_DEV_SERVER
    ? [viteBin, "--host", "--port", String(PORT)]
    : [viteBin, "preview", "--host", "--port", String(PORT)];
  serverProc = spawn(process.execPath, viteArgs, {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      /** QA fixture uses local dev-auth + atlas-saas-api — not live Cognito from .env.local */
      VITE_COGNITO_REGION: "",
      VITE_COGNITO_USER_POOL_ID: "",
      VITE_COGNITO_CLIENT_ID: "",
      VITE_ATLAS_API_URL: "",
    },
  });
  await new Promise((r) => setTimeout(r, 2500));
  await waitForServer(BASE_URL);
  record("dev-server", `${USE_DEV_SERVER ? "Vite dev" : "Preview"} reachable`, "passed", {
    url: BASE_URL,
  });
}

async function expectText(page, selector, includes, testId, title) {
  try {
    await page.waitForSelector(selector, { timeout: 15000 });
    const text = (await page.locator(selector).first().innerText()).trim();
    if (includes.some((s) => text.includes(s))) {
      record(testId, title, "passed", { text: text.slice(0, 120) });
      return true;
    }
    record(testId, title, "failed", { text });
    return false;
  } catch (e) {
    record(testId, title, "failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

async function runFlow() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors"],
  });

  const desktop = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("#app .mkt-logo img, #app h1", { timeout: 15000 });
  const logoAlt = (await page.locator("#app .mkt-logo img").first().getAttribute("alt")) ?? "";
  const h1Text = (await page.locator("#app h1").first().innerText().catch(() => "")) ?? "";
  if ([logoAlt, h1Text].some((t) => t.includes("Atlas"))) {
    record("home-title", "Global home shows Atlas AR brand", "passed", { logoAlt: logoAlt.slice(0, 80) });
  } else {
    record("home-title", "Global home shows Atlas AR brand", "failed", { logoAlt, h1Text });
  }

  const homeHtml = await page.locator("#app").innerHTML();
  if (
    homeHtml.includes("Start free") ||
    homeHtml.includes("View in AR") ||
    homeHtml.includes("Try live demo") ||
    homeHtml.includes("Start AR")
  ) {
    record("home-primary-cta", "Home has primary AR / signup CTA", "passed");
  } else {
    record("home-primary-cta", "Home has primary AR / signup CTA", "failed");
  }

  if (homeHtml.includes("white-label workspace") && homeHtml.includes("buying committees")) {
    record("mf11-workspace-copy", "Landing shows MiroFish workspace vs plugin copy", "passed");
  } else {
    record("mf11-workspace-copy", "Landing shows MiroFish workspace vs plugin copy", "failed");
  }

  if (homeHtml.includes("Who uploads the 3D models") && homeHtml.includes("PC admin")) {
    record("mf1-upload-faq", "Landing answers who uploads GLBs + PC→phone diagram", "passed");
  } else {
    record("mf1-upload-faq", "Landing answers who uploads GLBs + PC→phone diagram", "failed");
  }

  if (
    homeHtml.includes("Tenant isolation") &&
    homeHtml.includes("shopper accounts") &&
    (homeHtml.includes("Security") && homeHtml.includes("privacy"))
  ) {
    record("mf16-security-landing", "Landing shows MiroFish security/privacy section", "passed");
  } else {
    record("mf16-security-landing", "Landing shows MiroFish security/privacy section", "failed");
  }

  await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle", timeout: 60000 });
  await expectText(page, "#app h1", ["About Atlas AR"], "mf10-about-page", "About page loads from marketing route");
  const aboutHtml = await page.locator("#app").innerHTML();
  if (aboutHtml.includes("Tenant isolation") && aboutHtml.includes("shopper accounts")) {
    record("mf16-security-about", "About page shows security/privacy FAQ", "passed");
  } else {
    record("mf16-security-about", "About page shows security/privacy FAQ", "failed");
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', "QaTestPass123!");
  await page.locator('form[data-form="login"] button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const afterLogin = page.url();
  if (afterLogin.includes("/onboard") || afterLogin.includes("/admin") || afterLogin.includes("/w/")) {
    record("qa3-login", "Dev sign-in succeeds", "passed", { url: afterLogin });
  } else {
    record("qa3-login", "Dev sign-in succeeds", "failed", { url: afterLogin });
  }

  if (page.url().includes("/onboard")) {
    await page.fill('input[name="name"]', "QA Sprint 3 Workspace");
    await page.fill('input[name="slug"]', SLUG);
    await page.locator('[data-action="submit"]').click();
    await page.waitForTimeout(2000);
  }

  await page.goto(`${BASE_URL}/w/${SLUG}`, { waitUntil: "networkidle", timeout: 60000 });
  await expectText(
    page,
    "#app .catalog-page, #app .home",
    ["QA Sprint 3", "View in AR"],
    "qa3-tenant-home",
    "Tenant showroom loads for qa-sprint3"
  );

  const tenantHome = await page.locator("#app").innerHTML();
  if (tenantHome.includes("View in AR")) {
    record("qa3-tenant-start-ar", "Tenant showroom shows View in AR per product", "passed");
  } else {
    record("qa3-tenant-start-ar", "Tenant showroom shows View in AR per product", "failed");
  }

  await page.goto(`${BASE_URL}/w/${SLUG}/ar/${MODEL_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await expectText(
    page,
    "#app h1",
    ["QA Test Chair"],
    "qa3-direct-ar-landing",
    "Direct model AR landing shows model name"
  );

  const directHtml = await page.locator("#app").innerHTML();
  if (directHtml.includes("Back to catalog")) {
    record("qa3-back-to-catalog-btn", "Direct landing has Back to catalog", "passed");
  } else {
    record("qa3-back-to-catalog-btn", "Direct landing has Back to catalog", "failed");
  }
  if (directHtml.includes("Start AR")) {
    record("qa3-start-ar-cta", "Direct landing has Start AR (default on)", "passed");
  } else {
    record("qa3-start-ar-cta", "Direct landing has Start AR (default on)", "failed");
  }
  const hasDeviceCheck =
    directHtml.includes("Run camera") || directHtml.includes("device check");
  if (!hasDeviceCheck) {
    record(
      "qa3-device-check-opt-in",
      "Device check hidden by default (owner opt-in)",
      "passed",
    );
  } else {
    record(
      "qa3-device-check-opt-in",
      "Device check hidden by default (owner opt-in)",
      "failed",
      { snippet: "Unexpected device check CTA on default workspace" },
    );
  }

  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  const adminHtml = await page.locator("#app").innerHTML();
  if (adminHtml.includes("Manage 3D models") || adminHtml.includes("Admin")) {
    record("qa3-admin-dashboard", "Admin dashboard reachable when signed in", "passed");
  } else {
    record("qa3-admin-dashboard", "Admin dashboard reachable when signed in", "failed", {
      snippet: adminHtml.slice(0, 200),
    });
  }

  await page.goto(`${BASE_URL}/admin/get-started`, { waitUntil: "networkidle" });
  const onboardHtml = await page.locator("#app").innerHTML();
  if (
    onboardHtml.includes("Get started") &&
    onboardHtml.includes("Upload your first 3D model") &&
    onboardHtml.includes("under 10 minutes")
  ) {
    record("mf1-guided-onboarding", "Guided get-started wizard loads with 10-min checklist", "passed");
  } else {
    record("mf1-guided-onboarding", "Guided get-started wizard loads with 10-min checklist", "failed", {
      snippet: onboardHtml.slice(0, 280),
    });
  }

  await page.goto(`${BASE_URL}/admin/help`, { waitUntil: "networkidle" });
  const helpHtml = await page.locator("#app").innerHTML();
  if (
    helpHtml.includes("Admin help") &&
    helpHtml.includes("Upload your first 3D model") &&
    helpHtml.includes("Share your showroom link")
  ) {
    record("sup1-admin-help", "Admin help page loads upload + share guides", "passed");
  } else {
    record("sup1-admin-help", "Admin help page loads upload + share guides", "failed", {
      snippet: helpHtml.slice(0, 280),
    });
  }

  await page.goto(`${BASE_URL}/admin/models`, { waitUntil: "networkidle" });
  const modelsHtml = await page.locator("#app").innerHTML();
  if (modelsHtml.includes("QA Test Chair") || modelsHtml.includes("Upload")) {
    record("qa3-admin-models", "Admin models page loads", "passed");
  } else {
    record("qa3-admin-models", "Admin models page loads", "failed");
  }

  await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
  const accountHtml = await page.locator("#app").innerHTML();
  if (
    accountHtml.includes("Account") &&
    (accountHtml.includes("User ID") || accountHtml.includes("Workspace ID"))
  ) {
    record("mf6-account-page", "Account page shows profile for signed-in user", "passed");
  } else {
    record("mf6-account-page", "Account page shows profile for signed-in user", "failed", {
      snippet: accountHtml.slice(0, 240),
    });
  }

  const storageState = await page.context().storageState();
  const mobile = await browser.newContext({
    ...devices["Pixel 5"],
    ignoreHTTPSErrors: true,
    storageState,
  });
  const mPage = await mobile.newPage();
  await mPage.goto(`${BASE_URL}/w/${SLUG}`, { waitUntil: "networkidle", timeout: 60000 });
  const mobileHtml = await mPage.locator("#app").innerHTML();
  const hidesAdmin =
    !mobileHtml.includes('data-action="admin"') && !mobileHtml.includes("Admin dashboard");
  const showsAccount = mobileHtml.includes("Account");
  const showsSignOut = mobileHtml.includes("Sign out");
  if (hidesAdmin && showsAccount && showsSignOut) {
    record("qa3-mobile-hide-admin", "Mobile tenant shows Account + Sign out, hides Admin", "passed");
  } else {
    record("qa3-mobile-hide-admin", "Mobile tenant shows Account + Sign out, hides Admin", "failed", {
      hidesAdmin,
      showsAccount,
      showsSignOut,
    });
  }

  await mPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  const loginInputs = await mPage.locator('input[name="email"]').count();
  if (loginInputs > 0) {
    record("qa3-mobile-allow-login", "Mobile allows /login route (sign-in form loads)", "passed");
  } else {
    record("qa3-mobile-allow-login", "Mobile allows /login route (sign-in form loads)", "failed");
  }

  const ios = await browser.newContext({
    ...devices["iPhone 13"],
    ignoreHTTPSErrors: true,
  });
  const iPage = await ios.newPage();
  await iPage.goto(`${BASE_URL}/w/${SLUG}/ar/${MODEL_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  const iosHtml = await iPage.locator("#app").innerHTML();
  if (iosHtml.includes("View in AR") || iosHtml.includes("Quick Look")) {
    record("qa4-ios-quick-look-cta", "iOS direct landing shows Quick Look CTA", "passed");
  } else {
    record("qa4-ios-quick-look-cta", "iOS direct landing shows Quick Look CTA", "failed");
  }
  if (iosHtml.includes("Start AR") && !iosHtml.includes("View in AR")) {
    record("qa4-ios-no-webxr-start", "iOS landing does not push WebXR Start AR only", "failed");
  } else {
    record("qa4-ios-no-webxr-start", "iOS uses Quick Look path on direct landing", "passed");
  }

  const criticalErrors = pageErrors.filter(
    (e) => !/ServiceWorker|service worker|sw\.js|SSL certificate/i.test(e)
  );
  if (!criticalErrors.length) {
    record("page-errors", "No critical JS errors on desktop flow", "passed");
  } else {
    record("page-errors", "No critical JS errors on desktop flow", "failed", {
      errors: criticalErrors,
    });
  }

  record(
    "qa3-android-ar-manual",
    "Android WebXR floor placement on physical device",
    "skipped",
    { reason: "Requires physical Android + Chrome; see docs/atlas-ar/QA-SPRINT3.md § QA-3" }
  );
  record(
    "qa4-ios-quick-look-manual",
    "iOS Safari Quick Look opens USDZ and places model",
    "skipped",
    { reason: "Requires physical iPhone + Safari; see docs/atlas-ar/QA-SPRINT3.md § QA-4" }
  );

  await browser.close();
}

try {
  await maybeStartServer();
  await runFlow();
} catch (e) {
  record("e2e-fatal", "E2E harness", "failed", { error: e instanceof Error ? e.message : String(e) });
} finally {
  if (serverProc) serverProc.kill();
}

finish(true);
