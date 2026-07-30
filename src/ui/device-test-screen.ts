import type { DeviceTestProgress, DeviceTestReport, DeviceTestStep } from "../device-test/types";
import { arCtaLabel } from "../shared/ar-cta";
import { isIOS } from "../utils/platform";
import { MKT } from "./marketing-copy";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The check runner names its steps for engineers reading the JSON report, so on
 * iOS they arrive as "Quick Look AR (manual)" and friends. Shoppers running the
 * readiness check must not be shown Quick Look / WebXR / ARCore vocabulary, so
 * the iOS names are relabelled here — presentation only. The report keeps the
 * runner's names, and Android already reads in plain language.
 */
const IOS_STEP_LABELS: Record<string, string> = {
  "HTTPS secure context": "Secure connection (HTTPS)",
  "Camera API available": "Camera available in Safari",
  "Live camera stream": "Live camera view",
  "Camera visible behind UI": "Camera visible in the app",
  "Safari Quick Look AR": "Safari AR support",
  "Quick Look AR (manual)": "Safari AR opens from View in AR",
  "Quick Look placement (manual)": "Tap to place on the floor",
  "LOTO module with camera view": "Guided module with camera view",
};

function stepLabel(name: string): string {
  if (!isIOS()) return name;
  return IOS_STEP_LABELS[name] ?? name;
}

/** Hand-off CTA: iOS opens Safari AR, Android starts an immersive session. */
function arStartLabel(): string {
  return arCtaLabel(isIOS() ? "landing-ios" : "landing-android");
}

function platformBadge(): string {
  return isIOS() ? MKT.catalogTrust3 : MKT.catalogTrust2;
}

function statusGlyph(status: DeviceTestStep["status"]): string {
  if (status === "passed") return "✓";
  if (status === "failed") return "!";
  return "–";
}

function renderRows(steps: DeviceTestStep[]): string {
  return steps
    .map(
      (s) => `<li class="device-test-row status-${s.status}">
        <span class="device-test-dot" aria-hidden="true">${statusGlyph(s.status)}</span>
        <span class="device-test-row-main">
          <span class="device-test-row-name">${escapeHtml(stepLabel(s.name))}</span>
          ${s.error ? `<span class="device-test-row-note">${escapeHtml(s.error)}</span>` : ""}
        </span>
        <span class="device-test-row-status">${s.status}</span>
      </li>`
    )
    .join("");
}

export function renderDeviceTestRunning(
  root: HTMLElement,
  progress: DeviceTestProgress,
  onCancel: () => void,
  options?: { arHint?: string }
): void {
  const pct = Math.round((progress.stepIndex / progress.totalSteps) * 100);

  root.innerHTML = `
    <div class="home device-test-screen device-test-page">
      <header class="device-test-head">
        <span class="a-badge a-badge--accent">${platformBadge()}</span>
        <h2>Device hardware check</h2>
        <p class="home-sub">Testing camera and AR on this phone. Keep the app open.</p>
      </header>
      <div class="device-test-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="device-test-progress-bar" style="width:${pct}%"></div>
      </div>
      <p class="device-test-current">Step ${progress.stepIndex} of ${progress.totalSteps}: ${escapeHtml(stepLabel(progress.currentName))}</p>
      ${options?.arHint ? `<p class="device-test-ar-hint">${escapeHtml(options.arHint)}</p>` : ""}
      <ul class="device-test-list">${renderRows(progress.steps)}</ul>
      <div class="device-test-actions">
        <button type="button" class="btn btn-ghost btn-block" data-action="cancel">Cancel</button>
      </div>
    </div>
  `;
  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-action="cancel"]')) onCancel();
  };
}

/** Shown immediately before AR — must be a direct tap to grant camera + WebXR on Android. */
export function renderDeviceTestArStart(
  root: HTMLElement,
  onStart: () => void,
  onCancel: () => void,
  title = isIOS() ? "AR view check" : "AR camera check",
  subtitle = isIOS()
    ? "Safari AR opens in its own view. Move your phone to find the floor, then tap to place."
    : "Android needs a direct tap to open the AR camera in fullscreen. Scan the floor for the blue ring."
): void {
  root.innerHTML = `
    <div class="home device-test-screen device-test-page">
      <header class="device-test-head">
        <span class="a-badge a-badge--accent">${platformBadge()}</span>
        <h2>${escapeHtml(title)}</h2>
        <p class="home-sub">${escapeHtml(subtitle)}</p>
      </header>
      <div class="device-test-actions">
        <button type="button" class="btn btn-primary btn-block" data-action="start-ar">${escapeHtml(arStartLabel())}</button>
        <button type="button" class="btn btn-ghost btn-block" data-action="cancel">Cancel</button>
      </div>
    </div>
  `;
  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest("[data-action]");
    if (!el) return;
    if (el.getAttribute("data-action") === "start-ar") onStart();
    if (el.getAttribute("data-action") === "cancel") onCancel();
  };
}

export function renderDeviceTestComplete(
  root: HTMLElement,
  report: DeviceTestReport,
  onExport: () => void,
  onHome: () => void
): void {
  const overall = report.summary.overall;
  const passed = overall === "pass";

  root.innerHTML = `
    <div class="home device-test-screen device-test-page">
      <header class="device-test-head">
        <span class="a-badge ${passed ? "a-badge--ok" : "a-badge--warn"}">${platformBadge()}</span>
        <h2>Check ${passed ? "passed" : "needs attention"}</h2>
        <p class="home-sub">${
          passed
            ? "This phone is ready for AR."
            : "Some checks did not pass. The report below has the details."
        }</p>
      </header>
      <ul class="device-test-summary">
        <li>${report.summary.passed} passed</li>
        <li>${report.summary.failed} failed</li>
        <li>${report.summary.skipped} skipped</li>
        <li>${Math.round(report.meta.durationMs / 1000)}s</li>
      </ul>
      <ul class="device-test-list">${renderRows(report.steps)}</ul>
      <div class="device-test-actions">
        <p class="device-test-export-note">Tap below to download your test report (JSON).</p>
        <button type="button" class="btn btn-primary btn-block" data-action="export">Download report (JSON)</button>
        <button type="button" class="btn btn-ghost btn-block" data-action="home">Back to home</button>
      </div>
    </div>
  `;
  root.onclick = (e) => {
    const t = (e.target as HTMLElement).closest("[data-action]");
    if (!t) return;
    if (t.getAttribute("data-action") === "export") onExport();
    if (t.getAttribute("data-action") === "home") onHome();
  };
}
