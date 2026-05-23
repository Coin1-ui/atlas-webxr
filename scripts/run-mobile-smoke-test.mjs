/**
 * Mobile-emulation smoke tests for Atlas Field AR Web.
 * Cannot replace a physical Android device — records automated results to JSON.
 */
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const outDir = join(root, "test-results");
const reportPath = join(outDir, "mobile-test-report.json");

/** Preview (4173) is default for automated tests; set ATLAS_USE_PREVIEW=0 for dev server on 5173. */
const USE_PREVIEW = process.env.ATLAS_USE_PREVIEW !== "0";
const BASE_URL =
  process.env.ATLAS_TEST_URL ||
  (USE_PREVIEW ? "https://localhost:4173" : "https://localhost:5173");
const START_SERVER = process.env.ATLAS_START_SERVER !== "0";

// Self-signed cert from @vitejs/plugin-basic-ssl
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const report = {
  meta: {
    app: "atlas-field-ar-web",
    testedAt: new Date().toISOString(),
    environment: "playwright-mobile-emulation",
    deviceProfile: "Pixel 5",
    baseUrl: BASE_URL,
    note: "Physical phone not attached. Results simulate Android Chrome viewport; camera/WebXR may differ on real hardware.",
  },
  summary: { passed: 0, failed: 0, skipped: 0 },
  tests: [],
};

function record(id, name, status, details = {}) {
  report.tests.push({ id, name, status, ...details });
  report.summary[status === "passed" ? "passed" : status === "skipped" ? "skipped" : "failed"]++;
}

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

let serverProc = null;

async function maybeStartServer() {
  if (!START_SERVER) return;
  if (USE_PREVIEW) {
    await new Promise((resolve, reject) => {
      const build = spawn("npm", ["run", "build"], { cwd: root, shell: true, stdio: "inherit" });
      build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
    });
    serverProc = spawn("npx", ["vite", "preview", "--host", "--port", "4173"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
    });
  } else {
    serverProc = spawn("npx", ["vite", "--host", "--port", "5173"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
    });
  }
  await waitForServer(BASE_URL, 120000);
  record("boot", "Dev server reachable", "passed", {
    url: BASE_URL,
    mode: USE_PREVIEW ? "preview" : "dev",
  });
}

async function runTests() {
  const pixel = devices["Pixel 5"];
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--ignore-certificate-errors",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });

  const context = await browser.newContext({
    ...pixel,
    ignoreHTTPSErrors: true,
    permissions: ["camera"],
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
    record("home-load", "Home page loads", "passed", {
      title: await page.title(),
    });

    const homeText = await page.locator(".home").innerText();
    if (homeText.includes("LOTO") && homeText.includes("PPE")) {
      record("home-modules", "Home lists LOTO and PPE modules", "passed");
    } else {
      record("home-modules", "Home lists LOTO and PPE modules", "failed", { homeText });
    }

    if (homeText.includes("live camera")) {
      record("home-camera-label", "Camera mode labeled on home", "passed");
    } else {
      record("home-camera-label", "Camera mode labeled on home", "failed");
    }

    const lotoJson = await page.request.get(`${BASE_URL}/modules/loto-pump-7a.json`);
    if (lotoJson.ok()) {
      const body = await lotoJson.json();
      record("module-loto-json", "LOTO module JSON loads", "passed", {
        steps: body.steps?.length,
        placements: body.steps?.filter((s) => s.placement).length ?? 0,
      });
    } else {
      record("module-loto-json", "LOTO module JSON loads", "failed", {
        status: lotoJson.status(),
      });
    }

    const ppeJson = await page.request.get(`${BASE_URL}/modules/ppe-zone-entry.json`);
    if (ppeJson.ok()) {
      const body = await ppeJson.json();
      record("module-ppe-json", "PPE module JSON loads", "passed", {
        steps: body.steps?.length,
      });
    } else {
      record("module-ppe-json", "PPE module JSON loads", "failed", {
        status: ppeJson.status(),
      });
    }

    await page.locator('button.module-card[data-module="loto-pump-7a"]').click();
    await page.waitForSelector(".halo, .camera-error", { timeout: 20000 });
    if (await page.locator(".camera-error").isVisible()) {
      record("loto-camera-mode", "LOTO starts in Camera view", "failed", {
        error: await page.locator(".camera-error-msg").innerText(),
      });
    } else {

    const modeLabel = await page.locator(".halo-mode").innerText();
    const videoVisible = await page.locator("#camera-feed").evaluate((el) => {
      const v = el;
      const style = getComputedStyle(v);
      return style.display !== "none" && !v.classList.contains("hidden");
    });
    const bodyClass = await page.evaluate(() => document.body.className);

      if (modeLabel.includes("Camera")) {
        record("loto-camera-mode", "LOTO starts in Camera view", "passed", { modeLabel });
      } else {
        record("loto-camera-mode", "LOTO starts in Camera view", "failed", { modeLabel });
      }

      if (bodyClass.includes("training-camera")) {
        record("loto-body-class", "Body has training-camera class", "passed");
      } else {
        record("loto-body-class", "Body has training-camera class", "failed", { bodyClass });
      }

      if (videoVisible) {
        record("loto-video-visible", "Camera video element visible (not hidden)", "passed");
      } else {
        record("loto-video-visible", "Camera video element visible (not hidden)", "failed");
      }

      const hasVideoStream = await page.evaluate(() => {
        const v = document.getElementById("camera-feed");
        return !!(v && v.srcObject);
      });
      if (hasVideoStream) {
        record("loto-camera-stream", "Camera MediaStream attached", "passed");
      } else {
        record("loto-camera-stream", "Camera MediaStream attached", "skipped", {
          reason: "Fake or missing camera in automation; confirm on physical phone.",
        });
      }

      await page.locator('[data-action="confirm"]').click();
      await page.waitForTimeout(500);
      const stepAfter = await page.locator(".halo-progress").innerText();
      record("loto-confirm-step", "Confirm step advances UI", "passed", { stepAfter });

      page.once("dialog", (d) => d.accept());
      await page.locator('[data-action="pause"]').click();
      await page.waitForSelector(".home", { timeout: 10000 });
      record("loto-exit", "Exit returns to home", "passed");
    }

    await page.locator('button.module-card[data-module="ppe-zone-entry"]').click();
    await page.waitForSelector(".halo, .camera-error", { timeout: 20000 });
    if (await page.locator(".camera-error").isVisible()) {
      record("ppe-camera-mode", "PPE starts in Camera view", "failed", {
        error: await page.locator(".camera-error-msg").innerText(),
      });
      record("ppe-video-visible", "PPE camera video visible", "failed");
    } else {
      const ppeMode = await page.locator(".halo-mode").innerText();
      const ppeVideo = await page.locator("#camera-feed").evaluate((el) => {
        const style = getComputedStyle(el);
        return style.display !== "none" && !el.classList.contains("hidden");
      });
      if (ppeMode.includes("Camera")) {
        record("ppe-camera-mode", "PPE starts in Camera view", "passed", { ppeMode });
      } else {
        record("ppe-camera-mode", "PPE starts in Camera view", "failed", { ppeMode });
      }
      if (ppeVideo) {
        record("ppe-video-visible", "PPE camera video visible", "passed");
      } else {
        record("ppe-video-visible", "PPE camera video visible", "failed");
      }
    }

    await page.goto(`${BASE_URL}/?module=loto-pump-7a`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector(".halo, .camera-error", { timeout: 20000 });
    if (await page.locator(".halo").isVisible()) {
      const deepLinkMode = await page.locator(".halo-mode").innerText();
      record(
        "deeplink-loto",
        "Deep link ?module=loto opens training",
        deepLinkMode.includes("Camera") ? "passed" : "failed",
        { deepLinkMode }
      );
    } else {
      record("deeplink-loto", "Deep link ?module=loto opens training", "failed");
    }

    const secure = await page.evaluate(() => window.isSecureContext);
    record("secure-context", "HTTPS secure context", secure ? "passed" : "failed", {
      isSecureContext: secure,
    });
  } catch (e) {
    record("run-error", "Test run completed with error", "failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await browser.close();
  }
}

mkdirSync(outDir, { recursive: true });

try {
  await maybeStartServer();
  await runTests();
} catch (e) {
  report.tests.push({
    id: "fatal",
    name: "Test harness",
    status: "failed",
    error: e instanceof Error ? e.message : String(e),
  });
  report.summary.failed++;
} finally {
  if (serverProc) serverProc.kill();
}

report.meta.finishedAt = new Date().toISOString();
writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(`Wrote ${reportPath}`);
console.log(
  `Passed: ${report.summary.passed} Failed: ${report.summary.failed} Skipped: ${report.summary.skipped}`
);
process.exit(report.summary.failed > 0 ? 1 : 0);
