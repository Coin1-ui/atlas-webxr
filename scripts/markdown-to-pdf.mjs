#!/usr/bin/env node
/**
 * Convert a markdown file to PDF using Playwright (Chrome print).
 * Usage: node scripts/markdown-to-pdf.mjs <input.md> [output.pdf]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const input = resolve(process.argv[2] || "");
const output = resolve(
  process.argv[3] || input.replace(/\.md$/i, ".pdf")
);

if (!input || !existsSync(input)) {
  console.error("Usage: node scripts/markdown-to-pdf.mjs <input.md> [output.pdf]");
  process.exit(1);
}

const md = readFileSync(input, "utf8");
const htmlBody = spawnSync("npx", ["--yes", "marked", input], {
  encoding: "utf8",
  shell: true,
  cwd: dirname(fileURLToPath(import.meta.url)),
}).stdout;

if (!htmlBody?.trim()) {
  console.error("Failed to render markdown via marked");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${input.split(/[/\\]/).pop()}</title>
  <style>
    @page { margin: 14mm; }
    body {
      font-family: "Segoe UI", Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1a1a1a;
      max-width: 780px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { font-size: 22pt; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
    h2 { font-size: 15pt; margin-top: 1.4em; color: #111; }
    h3 { font-size: 12pt; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; }
    code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
    pre { background: #f8f8f8; padding: 10px; overflow-x: auto; border-radius: 4px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    strong { font-weight: 600; }
  </style>
</head>
<body>${htmlBody}</body>
</html>`;

const tmpHtml = join(dirname(output), `.tmp-${Date.now()}.html`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(tmpHtml, html, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${tmpHtml.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.pdf({
  path: output,
  format: "A4",
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
});
await browser.close();

try {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(tmpHtml);
} catch {
  /* ignore */
}

console.log("Wrote", output);
