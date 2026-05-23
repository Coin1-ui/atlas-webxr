export function renderHomeMinimal(
  root: HTMLElement,
  handlers: {
    cameraWarning?: string;
    onStartAr: () => void;
    onRunDeviceCheck: () => void;
    onManageModels?: () => void;
  }
): void {
  root.innerHTML = `
    <div class="home home-minimal">
      <header class="home-header">
        <h1>Atlas Field AR</h1>
        <p class="home-sub">Place your 3D models on the floor in AR.</p>
      </header>
      ${
        handlers.cameraWarning
          ? `<div class="camera-warning" role="alert"><strong>Setup.</strong> ${escapeHtml(handlers.cameraWarning)}</div>`
          : ""
      }
      <button type="button" class="btn btn-primary btn-block" data-action="start-ar">Start AR</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="device-check">Run camera + AR check</button>
      ${
        handlers.onManageModels
          ? `<button type="button" class="btn btn-ghost btn-block" data-action="manage-pc">Manage 3D models (PC only)</button>`
          : ""
      }
      <footer class="home-footer">
        <p>HTTPS required on phone · Android Chrome recommended for AR</p>
      </footer>
    </div>
  `;
  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest("[data-action]");
    if (!el) return;
    if (el.getAttribute("data-action") === "start-ar") handlers.onStartAr();
    if (el.getAttribute("data-action") === "device-check") handlers.onRunDeviceCheck();
    if (el.getAttribute("data-action") === "manage-pc") handlers.onManageModels?.();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
