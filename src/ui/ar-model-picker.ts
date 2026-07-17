import type { CatalogModel } from "../data/model-catalog";
import { MODEL_ICON_FALLBACK, bindModelIconFallbacks } from "../shared/model-icon";
import { bindArPanelTouch } from "./ar-panel-touch";

export type ModelPickerItem = CatalogModel & {
  iconSrc: string;
  glbReady: boolean;
};

export type ArModelPickerOptions = {
  items: ModelPickerItem[];
  activeId: string | null;
  loadingId?: string | null;
  statusText: string;
  floorReady: boolean;
  floorState?: {
    ready: boolean;
    hitReady?: boolean;
    liveHit: boolean;
    graceActive: boolean;
    reticleVisible: boolean;
    ringPlaceable?: boolean;
  };
  floorScanComplete?: boolean;
  dimensionsVisible?: boolean;
  objectModeActive?: boolean;
  objectModeAvailable?: boolean;
  sessionLogDownload?: boolean;
  onSelect: (id: string) => void;
  onDownloadLog: () => void;
  onExit: () => void;
  onCancelLoad?: () => void;
  onSkipFloor?: () => void;
  onToggleDimensions?: () => void;
  onToggleObjectMode?: () => void;
};

export type ArScanningOptions = {
  phase?: "starting" | "scanning";
  showContinue?: boolean;
  onContinue?: () => void;
  onSkipFloor?: () => void;
  onDownloadLog?: () => void;
  sessionLogDownload?: boolean;
};

export type ArModeHandlers = {
  objectModeActive?: boolean;
  onToggleObjectMode?: () => void;
};

export function arPickerPanelTitle(floorScanComplete: boolean, singleModelName?: string): string {
  if (singleModelName && floorScanComplete) return singleModelName;
  return floorScanComplete ? "Choose a model" : "Scanning the floor…";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function floorBadgeHtml(options: ArModelPickerOptions): string {
  if (options.floorReady) {
    if (options.floorState?.ringPlaceable === false) {
      return `<span class="ar-floor-pill ar-floor-pill-warn">Red — blocked</span>`;
    }
    if (options.floorState?.hitReady === false && options.floorState?.ready) {
      return `<span class="ar-floor-pill ar-floor-pill-warn">Skipped scan</span>`;
    }
    return `<span class="ar-floor-pill ar-floor-pill-ok">Cyan — ready</span>`;
  }
  if (options.floorState?.graceActive) {
    return `<span class="ar-floor-pill ar-floor-pill-warn">Floor lost</span>`;
  }
  return `<span class="ar-floor-pill ar-floor-pill-scan">Scanning…</span>`;
}

function renderModelTiles(options: ArModelPickerOptions): string {
  const loading = options.loadingId;
  return options.items
    .map((m) => {
      const isLoading = loading === m.id;
      const blocked = Boolean(loading && !isLoading);
      const hasModelFile = Boolean(m.glb || m.glbUrl || m.builtinType);
      const notReady = hasModelFile && !m.builtinType && !m.glbReady;
      const disabled = blocked;
      return `
      <button type="button" class="model-tile ${options.activeId === m.id ? "active" : ""} ${isLoading || notReady ? "loading" : ""} ${notReady ? "not-ready" : ""}" data-model-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(m.name)}" ${disabled ? "disabled" : ""} ${isLoading || notReady ? 'aria-busy="true"' : ""}>
        ${isLoading || notReady ? '<span class="model-tile-spinner" aria-hidden="true"></span>' : ""}
        <img class="model-tile-icon" src="${escapeHtml(m.iconSrc)}" alt="" data-icon-fallback="${escapeHtml(MODEL_ICON_FALLBACK)}" data-icon-src="${escapeHtml(m.iconSrc)}" />
        <span class="model-tile-name">${escapeHtml(m.name)}${notReady ? " …" : ""}</span>
      </button>`;
    })
    .join("");
}

export function arModeSegmentHtml(objectModeActive: boolean, show3d: boolean): string {
  if (!show3d) return "";
  return `
    <div class="ar-mode-segment" role="group" aria-label="View mode" data-mode="${objectModeActive ? "3d" : "ar"}">
      <span class="ar-mode-segment-thumb" aria-hidden="true"></span>
      <button type="button" class="ar-mode-segment-btn ${!objectModeActive ? "active" : ""}" data-action="mode-ar" aria-pressed="${!objectModeActive}">AR</button>
      <button type="button" class="ar-mode-segment-btn ${objectModeActive ? "active" : ""}" data-action="mode-3d" aria-pressed="${objectModeActive}">3D</button>
    </div>`;
}

export function bindArModeSegment(root: HTMLElement, handlers: ArModeHandlers): void {
  bindArPanelTouch(root, (action) => {
    if (action === "mode-3d" && !handlers.objectModeActive) handlers.onToggleObjectMode?.();
    if (action === "mode-ar" && handlers.objectModeActive) handlers.onToggleObjectMode?.();
  });
}

function createPickerTouchBinder(options: ArModelPickerOptions) {
  return (root: HTMLElement) => {
    bindArPanelTouch(root, (action, modelId) => {
      if (action === "log") {
        options.onDownloadLog();
        return;
      }
      if (action === "exit") {
        options.onExit();
        return;
      }
      if (action === "cancel") {
        options.onCancelLoad?.();
        return;
      }
      if (action === "skip-floor") {
        options.onSkipFloor?.();
        return;
      }
      if (action === "toggle-dimensions") {
        options.onToggleDimensions?.();
        return;
      }
      if (action === "mode-3d" && !options.objectModeActive) {
        options.onToggleObjectMode?.();
        return;
      }
      if (action === "mode-ar" && options.objectModeActive) {
        options.onToggleObjectMode?.();
        return;
      }
      if (action === "select" && modelId) options.onSelect(modelId);
    });
  };
}

function patchJsonLogButton(
  foot: Element | null,
  show: boolean,
  onDownloadLog?: () => void,
): void {
  if (!foot) return;
  let logBtn = foot.querySelector<HTMLButtonElement>("[data-action=log]");
  if (show && onDownloadLog) {
    if (!logBtn) {
      const exitBtn = foot.querySelector("[data-action=exit]");
      const html = `<button type="button" class="ar-action-btn ar-action-btn-log" data-action="log">JSON</button>`;
      if (exitBtn) exitBtn.insertAdjacentHTML("beforebegin", html);
      else foot.insertAdjacentHTML("afterbegin", html);
      logBtn = foot.querySelector("[data-action=log]");
    }
  } else {
    logBtn?.remove();
  }
}

export function patchArScanning(
  root: HTMLElement,
  message: string,
  phase?: ArScanningOptions["phase"],
  options?: ArScanningOptions,
): boolean {
  const panel = root.querySelector(".ar-panel-scan");
  if (!panel) return false;
  const msg = panel.querySelector(".ar-panel-msg");
  if (msg) msg.textContent = message;
  if (phase) {
    const title = panel.querySelector(".ar-panel-title");
    if (title) {
      title.textContent = phase === "starting" ? "Starting AR…" : "Scanning the floor…";
    }
  }
  if (options) {
    patchJsonLogButton(
      panel.querySelector(".ar-panel-dock-foot"),
      options.sessionLogDownload === true && Boolean(options.onDownloadLog),
      options.onDownloadLog,
    );
  }
  return true;
}

function patchModeSegment(panel: Element, objectModeActive: boolean, show3d: boolean): void {
  const headRow = panel.querySelector(".ar-panel-dock-head-row");
  if (!show3d) {
    panel.querySelector(".ar-mode-segment")?.remove();
    return;
  }
  let segment = panel.querySelector(".ar-mode-segment");
  if (!segment && headRow) {
    headRow.insertAdjacentHTML("beforeend", arModeSegmentHtml(objectModeActive, true));
    segment = panel.querySelector(".ar-mode-segment");
  }
  if (!segment) return;
  segment.setAttribute("data-mode", objectModeActive ? "3d" : "ar");
  segment.querySelector("[data-action=mode-ar]")?.classList.toggle("active", !objectModeActive);
  segment.querySelector("[data-action=mode-3d]")?.classList.toggle("active", objectModeActive);
}

export function patchArModelPicker(root: HTMLElement, options: ArModelPickerOptions): boolean {
  const panel = root.querySelector(".ar-panel-picker");
  if (!panel) return false;

  const bindPicker = createPickerTouchBinder(options);
  const row = panel.querySelector(".model-tile-row") as HTMLElement | null;
  const scrollLeft = row?.scrollLeft ?? 0;
  const itemKey = options.items
    .map((m) => `${m.id}:${m.glbReady ? 1 : 0}:${m.iconSrc}`)
    .join("|");
  const prevKey = panel.getAttribute("data-item-key") ?? "";

  const pill = panel.querySelector(".ar-floor-pill");
  if (pill) pill.outerHTML = floorBadgeHtml(options);

  const msg = panel.querySelector(".ar-panel-msg");
  if (msg) msg.textContent = options.statusText;

  const title = panel.querySelector(".ar-panel-title");
  if (title) {
    const single = options.items.length === 1 ? options.items[0]?.name : undefined;
    title.textContent = arPickerPanelTitle(Boolean(options.floorScanComplete), single);
  }

  const show3d = options.objectModeAvailable === true && Boolean(options.onToggleObjectMode);
  patchModeSegment(panel, Boolean(options.objectModeActive), show3d);

  const dimBtn = panel.querySelector<HTMLButtonElement>("[data-action=toggle-dimensions]");
  if (dimBtn) {
    const on = options.dimensionsVisible === true;
    dimBtn.classList.toggle("ar-action-btn-log--on", on);
    dimBtn.setAttribute("aria-pressed", String(on));
    dimBtn.textContent = on ? "Dims on" : "Dimensions";
  }

  const logFoot = panel.querySelector(".ar-panel-dock-foot");
  patchJsonLogButton(
    logFoot,
    options.sessionLogDownload === true && Boolean(options.onDownloadLog),
    options.onDownloadLog,
  );

  if (itemKey !== prevKey && row) {
    row.innerHTML =
      renderModelTiles(options) || "<p class='ar-panel-hint'>Loading models…</p>";
    panel.setAttribute("data-item-key", itemKey);
    row.scrollLeft = scrollLeft;
  } else if (row) {
    const loading = options.loadingId;
    for (const tile of row.querySelectorAll<HTMLButtonElement>(".model-tile")) {
      const id = tile.getAttribute("data-model-id");
      if (!id) continue;
      const item = options.items.find((m) => m.id === id);
      if (!item) continue;
      const isLoading = loading === id;
      const blocked = Boolean(loading && !isLoading);
      const hasModelFile = Boolean(item.glb || item.glbUrl || item.builtinType);
      const notReady = hasModelFile && !item.builtinType && !item.glbReady;
      tile.classList.toggle("active", options.activeId === id);
      tile.classList.toggle("loading", isLoading || notReady);
      tile.classList.toggle("not-ready", notReady);
      tile.toggleAttribute("aria-busy", isLoading || notReady);
      let spinner = tile.querySelector(".model-tile-spinner");
      if ((isLoading || notReady) && !spinner) {
        tile.insertAdjacentHTML("afterbegin", '<span class="model-tile-spinner" aria-hidden="true"></span>');
      } else if (!isLoading && !notReady) {
        spinner?.remove();
      }
      tile.disabled = blocked;
      const nameEl = tile.querySelector(".model-tile-name");
      if (nameEl) nameEl.textContent = `${item.name}${notReady ? " …" : ""}`;
      const iconEl = tile.querySelector<HTMLImageElement>(".model-tile-icon");
      if (iconEl && iconEl.dataset.iconSrc !== item.iconSrc) {
        iconEl.dataset.iconSrc = item.iconSrc;
        iconEl.src = item.iconSrc;
      }
    }
  }

  bindPicker(root);
  bindModelIconFallbacks(root);
  return true;
}

export function renderArScanning(
  root: HTMLElement,
  message: string,
  onExit: () => void,
  options?: ArScanningOptions,
): void {
  const title = options?.phase === "starting" ? "Starting AR…" : "Scanning the floor…";
  const showLog = options?.sessionLogDownload === true && Boolean(options?.onDownloadLog);
  root.innerHTML = `
    <div class="ar-panel ar-panel-scan ar-panel-dock ar-panel-touch">
      <div class="ar-panel-dock-handle" aria-hidden="true"></div>
      <p class="ar-panel-title">${title}</p>
      ${options?.phase === "starting" ? `<div class="ar-start-progress" aria-hidden="true"><div class="ar-start-progress-bar"></div></div>` : ""}
      <p class="ar-panel-msg">${escapeHtml(message)}</p>
      <p class="ar-panel-hint">Point at the floor — cyan ring = placeable. Tap Skip when ready.</p>
      <div class="ar-panel-dock-foot">
        ${options?.showContinue ? `<button type="button" class="ar-action-btn ar-action-btn-primary" data-action="continue">Show models</button>` : ""}
        ${options?.onSkipFloor ? `<button type="button" class="ar-action-btn ar-action-btn-muted" data-action="skip-floor">Skip scan</button>` : ""}
        ${showLog ? `<button type="button" class="ar-action-btn ar-action-btn-log" data-action="log">JSON</button>` : ""}
        <button type="button" class="ar-action-btn ar-action-btn-log" data-action="exit">Exit</button>
      </div>
    </div>`;
  bindArPanelTouch(root, (action) => {
    if (action === "exit") onExit();
    if (action === "continue") options?.onContinue?.();
    if (action === "skip-floor") options?.onSkipFloor?.();
    if (action === "log") options?.onDownloadLog?.();
  });
}

export function renderArModelPicker(root: HTMLElement, options: ArModelPickerOptions): void {
  const tiles = renderModelTiles(options);
  const itemKey = options.items
    .map((m) => `${m.id}:${m.glbReady ? 1 : 0}:${m.iconSrc}`)
    .join("|");
  const singleModelName = options.items.length === 1 ? options.items[0]?.name : undefined;
  const panelTitle = arPickerPanelTitle(Boolean(options.floorScanComplete), singleModelName);
  const show3d = options.objectModeAvailable === true && Boolean(options.onToggleObjectMode);
  const dimsOn = options.dimensionsVisible === true;
  const showLog = options.sessionLogDownload === true;

  const row = root.querySelector(".model-tile-row") as HTMLElement | null;
  const scrollLeft = row?.scrollLeft ?? 0;

  root.innerHTML = `
    <div class="ar-panel ar-panel-picker ar-panel-dock ar-panel-touch" data-item-key="${escapeHtml(itemKey)}">
      <div class="ar-panel-dock-handle" aria-hidden="true"></div>
      <div class="ar-panel-dock-head">
        <div class="ar-panel-dock-head-row">
          ${floorBadgeHtml(options)}
          <p class="ar-panel-title">${escapeHtml(panelTitle)}</p>
          ${arModeSegmentHtml(Boolean(options.objectModeActive), show3d)}
        </div>
        <p class="ar-panel-msg">${escapeHtml(options.statusText)}</p>
      </div>
      <div class="model-tile-row" role="list">${tiles || "<p class='ar-panel-hint'>Loading models…</p>"}</div>
      <div class="ar-panel-dock-foot">
        ${
          options.onToggleDimensions
            ? `<button type="button" class="ar-action-btn ar-action-btn-log${dimsOn ? " ar-action-btn-log--on" : ""}" data-action="toggle-dimensions" aria-pressed="${dimsOn}">${dimsOn ? "Dims on" : "Dimensions"}</button>`
            : ""
        }
        ${!options.floorReady && options.onSkipFloor ? `<button type="button" class="ar-action-btn ar-action-btn-muted" data-action="skip-floor">Skip</button>` : ""}
        ${options.loadingId ? `<button type="button" class="ar-action-btn ar-action-btn-muted" data-action="cancel">Cancel</button>` : ""}
        ${showLog ? `<button type="button" class="ar-action-btn ar-action-btn-log" data-action="log">JSON</button>` : ""}
        <button type="button" class="ar-action-btn ar-action-btn-log" data-action="exit">Exit</button>
      </div>
    </div>`;

  const newRow = root.querySelector(".model-tile-row") as HTMLElement | null;
  if (newRow && scrollLeft > 0) newRow.scrollLeft = scrollLeft;

  createPickerTouchBinder(options)(root);
  bindModelIconFallbacks(root);
}
