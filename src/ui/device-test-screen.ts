import type { DeviceTestProgress, DeviceTestReport } from "../device-test/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderDeviceTestRunning(
  root: HTMLElement,
  progress: DeviceTestProgress,
  onCancel: () => void,
  options?: { arHint?: string }
): void {
  const pct = Math.round((progress.stepIndex / progress.totalSteps) * 100);
  const rows = progress.steps
    .map(
      (s) =>
        `<li class="device-test-row status-${s.status}"><span>${escapeHtml(s.name)}</span><span>${s.status}</span></li>`
    )
    .join("");

  root.innerHTML = `
    <div class="home device-test-screen">
      <h2>Device hardware check</h2>
      <p class="home-sub">Testing camera and AR on this phone. Keep the app open.</p>
      <div class="device-test-progress-bar" style="width:${pct}%"></div>
      <p class="device-test-current">Step ${progress.stepIndex} of ${progress.totalSteps}: ${escapeHtml(progress.currentName)}</p>
      ${options?.arHint ? `<p class="device-test-ar-hint">${escapeHtml(options.arHint)}</p>` : ""}
      <ul class="device-test-list">${rows}</ul>
      <button type="button" class="btn btn-ghost btn-block" data-action="cancel">Cancel</button>
    </div>
  `;
  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-action="cancel"]')) onCancel();
  };
}

/** Shown immediately before AR — must be a direct tap to grant camera + AR on Android. */
export function renderDeviceTestArStart(
  root: HTMLElement,
  onStart: () => void,
  onCancel: () => void,
  title = "AR camera check",
  subtitle = "Android needs a direct tap to open the AR camera in fullscreen. Scan the floor for the blue ring."
): void {
  root.innerHTML = `
    <div class="home device-test-screen">
      <h2>${escapeHtml(title)}</h2>
      <p class="home-sub">${escapeHtml(subtitle)}</p>
      <button type="button" class="btn btn-primary btn-block" data-action="start-ar">Start AR camera</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="cancel">Cancel</button>
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
  const rows = report.steps
    .map(
      (s) => `
      <li class="device-test-row status-${s.status}">
        <span>${escapeHtml(s.name)}</span>
        <span>${s.status}${s.error ? ` — ${escapeHtml(s.error)}` : ""}</span>
      </li>`
    )
    .join("");

  root.innerHTML = `
    <div class="home device-test-screen">
      <h2>Check ${overall === "pass" ? "passed" : "needs attention"}</h2>
      <p class="home-sub">
        ${report.summary.passed} passed · ${report.summary.failed} failed · ${report.summary.skipped} skipped
        · ${Math.round(report.meta.durationMs / 1000)}s
      </p>
      <p class="device-test-export-note">Tap below to download your test report (JSON).</p>
      <ul class="device-test-list">${rows}</ul>
      <button type="button" class="btn btn-primary btn-block" data-action="export">Download report (JSON)</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="home">Back to home</button>
    </div>
  `;
  root.onclick = (e) => {
    const t = (e.target as HTMLElement).closest("[data-action]");
    if (!t) return;
    if (t.getAttribute("data-action") === "export") onExport();
    if (t.getAttribute("data-action") === "home") onHome();
  };
}
