import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
export const SPRINT3_REPORT_DIR = join(dir, "..", "..", "test-results");

/**
 * @param {string} name
 * @param {{ meta?: Record<string, unknown> }} [opts]
 */
export function createReport(name, opts = {}) {
  /** @type {{ meta: Record<string, unknown>; summary: { passed: number; failed: number; skipped: number }; tests: Array<Record<string, unknown>> }} */
  const report = {
    meta: {
      suite: name,
      startedAt: new Date().toISOString(),
      ...opts.meta,
    },
    summary: { passed: 0, failed: 0, skipped: 0 },
    tests: [],
  };

  return {
    report,
    record(id, title, status, details = {}) {
      report.tests.push({ id, title, status, ...details });
      if (status === "passed") report.summary.passed += 1;
      else if (status === "skipped") report.summary.skipped += 1;
      else report.summary.failed += 1;
    },
    finish(exitOnFail = true) {
      report.meta.finishedAt = new Date().toISOString();
      mkdirSync(SPRINT3_REPORT_DIR, { recursive: true });
      const file = join(SPRINT3_REPORT_DIR, `${name}.json`);
      writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
      console.log(`Wrote ${file}`);
      console.log(
        `Passed: ${report.summary.passed} Failed: ${report.summary.failed} Skipped: ${report.summary.skipped}`
      );
      if (exitOnFail && report.summary.failed > 0) process.exit(1);
      return report;
    },
  };
}

/**
 * @param {string} base
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function fetchJson(base, path, init) {
  const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { url, status: res.status, ok: res.ok, body };
}
