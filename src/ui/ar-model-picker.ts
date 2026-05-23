import type { CatalogModel } from "../data/model-catalog";

export type ModelPickerItem = CatalogModel & {
  iconSrc: string;
};

export function renderArScanning(
  root: HTMLElement,
  message: string,
  onExit: () => void
): void {
  root.innerHTML = `
    <div class="ar-panel ar-panel-scan">
      <p class="ar-panel-title">Finding the floor…</p>
      <p class="ar-panel-msg">${escapeHtml(message)}</p>
      <p class="ar-panel-hint">Point the phone at the floor and move slowly until the blue ring appears.</p>
      <button type="button" class="btn btn-ghost btn-block" data-action="exit">Exit AR</button>
    </div>
  `;
  root.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-action="exit"]')) onExit();
  };
}

export function renderArModelPicker(
  root: HTMLElement,
  options: {
    items: ModelPickerItem[];
    activeId: string | null;
    statusText: string;
    floorReady: boolean;
    onSelect: (id: string) => void;
    onDownloadLog: () => void;
    onExit: () => void;
  }
): void {
  const tiles = options.items
    .map(
      (m) => `
      <button type="button" class="model-tile ${options.activeId === m.id ? "active" : ""}" data-model-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(m.name)}">
        <img class="model-tile-icon" src="${escapeHtml(m.iconSrc)}" alt="" />
        <span class="model-tile-name">${escapeHtml(m.name)}</span>
      </button>`
    )
    .join("");

  root.innerHTML = `
    <div class="ar-panel ar-panel-picker">
      <p class="ar-panel-title">${options.floorReady ? "Choose a model" : "Floor not detected yet"}</p>
      <p class="ar-panel-msg">${escapeHtml(options.statusText)}</p>
      <div class="model-tile-row" role="list">${tiles || "<p class='ar-panel-hint'>No models on server — upload on PC first.</p>"}</div>
      <div class="ar-panel-actions">
        <button type="button" class="btn btn-ghost" data-action="log">Download session log (JSON)</button>
        <button type="button" class="btn btn-ghost" data-action="exit">Exit AR</button>
      </div>
    </div>
  `;

  root.onclick = (e) => {
    const t = (e.target as HTMLElement).closest("[data-action],[data-model-id]");
    if (!t) return;
    const modelId = t.getAttribute("data-model-id");
    if (modelId) options.onSelect(modelId);
    if (t.getAttribute("data-action") === "log") options.onDownloadLog();
    if (t.getAttribute("data-action") === "exit") options.onExit();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
