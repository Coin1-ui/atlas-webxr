import { StepEngine } from "../procedure/step-engine";

export type HaloHandlers = {
  onConfirm: () => void;
  onHelp: () => void;
  onPause: () => void;
  onFullScreen?: () => void;
  onSwitchToCamera?: () => void;
  onSwitchToAR?: () => void;
  onPlaceOnFloor?: () => void;
  showPlaceOnFloor?: boolean;
  placementHint?: string;
};

export function renderTrainingHalo(
  root: HTMLElement,
  engine: StepEngine,
  modeLabel: string,
  handlers: HaloHandlers,
  hint?: string
): () => void {
  const mod = engine.getModule();
  const step = engine.getCurrentStep();
  const idx = engine.getCurrentIndex();
  const total = mod.steps.length;
  const statuses = engine.getStatuses();

  root.innerHTML = `
    <div class="halo" role="region" aria-label="Training interface">
      <header class="halo-rail">
        <div class="halo-rail-top">
          <span class="halo-badge ${step?.safetyClass === "critical" ? "critical" : ""}">
            ${step?.safetyClass === "critical" ? "SAFETY" : "STEP"}
          </span>
          <span class="halo-mode">${modeLabel}</span>
        </div>
        <h2 class="halo-title">${step ? escapeHtml(step.title) : "Complete"}</h2>
        <p class="halo-progress">Step ${Math.min(idx + 1, total)} of ${total}</p>
        <div class="halo-bar" aria-hidden="true">
          ${statuses
            .map((s, i) => `<span class="seg seg-${s} ${i === idx ? "current" : ""}"></span>`)
            .join("")}
        </div>
      </header>
      <main class="halo-body">
        <p class="halo-instruction">${step ? escapeHtml(step.instruction) : "Training complete."}</p>
        ${
          hint
            ? `<p class="halo-hint" role="alert">${escapeHtml(hint)}</p>`
            : step?.hint
              ? `<p class="halo-hint-muted">${escapeHtml(step.hint)}</p>`
              : ""
        }
      </main>
      ${
        handlers.showPlaceOnFloor
          ? `<p class="halo-place-hint">${escapeHtml(
              handlers.placementHint ??
                "Point at the floor beside the real object. When the blue ring appears, tap Place on floor."
            )}</p>
           <button type="button" class="btn btn-place" data-action="place">Place on floor</button>`
          : ""
      }
      <footer class="halo-shelf halo-shelf-wrap">
        <button type="button" class="btn btn-primary" data-action="confirm" ${
          engine.isComplete() ? "disabled" : ""
        }>Confirm step</button>
        <button type="button" class="btn btn-ghost" data-action="help">Help</button>
        <button type="button" class="btn btn-ghost" data-action="fullscreen">Full screen</button>
        ${
          handlers.onSwitchToAR
            ? `<button type="button" class="btn btn-ghost" data-action="ar">AR + floor</button>`
            : ""
        }
        ${
          handlers.onSwitchToCamera
            ? `<button type="button" class="btn btn-ghost" data-action="camera">Camera view</button>`
            : ""
        }
        <button type="button" class="btn btn-ghost" data-action="pause">Exit</button>
      </footer>
    </div>
  `;

  const onClick = (e: Event) => {
    const t = (e.target as HTMLElement).closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    if (action === "confirm") handlers.onConfirm();
    if (action === "help") handlers.onHelp();
    if (action === "pause") handlers.onPause();
    if (action === "place") handlers.onPlaceOnFloor?.();
    if (action === "fullscreen") handlers.onFullScreen?.();
    if (action === "ar") handlers.onSwitchToAR?.();
    if (action === "camera") handlers.onSwitchToCamera?.();
  };
  root.addEventListener("click", onClick);

  return () => root.removeEventListener("click", onClick);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderHome(
  root: HTMLElement,
  handlers: {
    cameraWarning?: string;
    arAvailable?: boolean;
    onSelectModule: (id: string) => void;
    onSelectModuleAR?: (id: string) => void;
    onTestCamera: () => void;
    onRunDeviceCheck?: () => void;
    onScanQr: () => void;
    onExport: () => void;
  }
): void {
  const modules = [
    { id: "loto-pump-7a", title: "LOTO — Pump 7A Disconnect", min: 12 },
    { id: "ppe-zone-entry", title: "PPE Zone Entry", min: 5 },
  ];

  root.innerHTML = `
    <div class="home">
      <header class="home-header">
        <h1>Atlas Field AR</h1>
        <p class="home-sub">Free browser training for Android and iOS. Works offline after first load.</p>
      </header>
      ${
        handlers.cameraWarning
          ? `<div class="camera-warning" role="alert"><strong>Camera setup needed.</strong> ${escapeHtml(handlers.cameraWarning)}</div>`
          : ""
      }
      <section class="home-section">
        <h2>Device check</h2>
        ${
          handlers.onRunDeviceCheck
            ? `<button type="button" class="btn btn-primary btn-block" data-action="device-check">Run camera + AR check</button>
        <p class="home-or">Runs on this phone, then downloads a JSON report.</p>`
            : ""
        }
      </section>
      <section class="home-section">
        <h2>Start training</h2>
        <button type="button" class="btn btn-ghost btn-block" data-action="test-camera">Test camera only</button>
        <button type="button" class="btn btn-primary btn-block" data-action="scan">Scan asset QR</button>
        <p class="home-or">Choose a module — camera view (recommended)</p>
        <ul class="module-list">
          ${modules
            .map(
              (m) => `
            <li>
              <button type="button" class="module-card" data-module="${m.id}">
                <span class="module-title">${escapeHtml(m.title)}</span>
                <span class="module-meta">~${m.min} min · live camera</span>
              </button>
              ${
                handlers.arAvailable && handlers.onSelectModuleAR
                  ? `<button type="button" class="module-card module-card-ar" data-module-ar="${m.id}">
                <span class="module-title">${escapeHtml(m.title)} — AR mode</span>
                <span class="module-meta">3D on floor · may need full screen</span>
              </button>`
                  : ""
              }
            </li>`
            )
            .join("")}
        </ul>
      </section>
      <section class="home-section">
        <h2>History</h2>
        <button type="button" class="btn btn-ghost btn-block" data-action="export">Export completions (JSON)</button>
      </section>
      <footer class="home-footer">
        <p>Best AR: Android Chrome · iOS: guided camera mode</p>
      </footer>
    </div>
  `;

  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest(
      "[data-action],[data-module],[data-module-ar]"
    );
    if (!el) return;
    if (el.hasAttribute("data-module")) {
      handlers.onSelectModule(el.getAttribute("data-module")!);
    }
    if (el.hasAttribute("data-module-ar") && handlers.onSelectModuleAR) {
      handlers.onSelectModuleAR(el.getAttribute("data-module-ar")!);
    }
    if (el.getAttribute("data-action") === "device-check") handlers.onRunDeviceCheck?.();
    if (el.getAttribute("data-action") === "test-camera") handlers.onTestCamera();
    if (el.getAttribute("data-action") === "scan") handlers.onScanQr();
    if (el.getAttribute("data-action") === "export") handlers.onExport();
  };
}

export function renderComplete(
  root: HTMLElement,
  title: string,
  onDone: () => void
): void {
  root.innerHTML = `
    <div class="home complete-screen">
      <h1>Module complete</h1>
      <p>${escapeHtml(title)}</p>
      <p class="home-sub">Completion saved on this device.</p>
      <button type="button" class="btn btn-primary btn-block" data-action="done">Back to home</button>
    </div>
  `;
  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-action="done"]')) onDone();
  };
}
