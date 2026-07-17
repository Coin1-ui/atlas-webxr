#!/usr/bin/env node
/**
 * Capture Atlas AR live pages for MKT-3 storyboard thumbnails.
 * Requires: npm i -D playwright (already in devDependencies)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "mkt-3-storyboard", "assets", "thumbs");
const baseUrl = process.env.ATLAS_CAPTURE_URL || "https://main.d3t9wmef56h86w.amplifyapp.com";

fs.mkdirSync(outDir, { recursive: true });

/** @type {{ name: string; path: string; viewport?: { width: number; height: number }; mobile?: boolean; waitMs?: number }[]} */
const shots = [
  { name: "capture-demo-desktop", path: "/demo", viewport: { width: 1280, height: 720 }, waitMs: 3000 },
  {
    name: "capture-demo-mobile",
    path: "/demo",
    viewport: { width: 390, height: 844 },
    mobile: true,
    waitMs: 3000,
  },
  {
    name: "capture-demo-mobile-safari",
    path: "/demo",
    viewport: { width: 390, height: 844 },
    mobile: true,
    waitMs: 3000,
  },
  {
    name: "capture-demo-start-ar",
    path: "/demo",
    viewport: { width: 390, height: 844 },
    mobile: true,
    waitMs: 3500,
  },
  {
    name: "capture-demo-3d-dock",
    path: "/demo",
    viewport: { width: 390, height: 844 },
    mobile: true,
    waitMs: 3500,
  },
  {
    name: "capture-demo-view-ar",
    path: "/demo",
    viewport: { width: 390, height: 844 },
    mobile: true,
    waitMs: 3500,
  },
];

async function capture() {
  const browser = await chromium.launch({ headless: true });
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      isMobile: shot.mobile ?? false,
      userAgent: shot.mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });
    const page = await context.newPage();
    const url = `${baseUrl}${shot.path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(shot.waitMs ?? 2000);
      const file = path.join(outDir, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`✓ ${shot.name} → ${path.relative(root, file)}`);
    } catch (e) {
      console.warn(`✗ ${shot.name} failed:`, e instanceof Error ? e.message : e);
    }
    await context.close();
  }

  const adminFallbacks = [
    ["capture-admin-dashboard", "sales-deck/assets/slide-04-how-it-works.png"],
    ["capture-admin-models", "sales-deck/assets/slide-04-how-it-works.png"],
    ["capture-admin-branding", "sales-deck/assets/slide-01-title-hero.png"],
    ["capture-admin-link", "sales-deck/assets/slide-10-cta.png"],
  ];
  for (const [name, relSrc] of adminFallbacks) {
    const dest = path.join(outDir, `${name}.png`);
    if (!fs.existsSync(dest)) {
      const alt = path.join(root, "public", relSrc);
      if (fs.existsSync(alt)) fs.copyFileSync(alt, dest);
      if (fs.existsSync(dest)) console.log(`↷ ${name} (fallback copy)`);
    }
  }

  await browser.close();
  console.log("Done.");
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
