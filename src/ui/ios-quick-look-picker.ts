import { resolveCatalogAssets, type CatalogModel } from "../data/model-catalog";
import { logArEvent } from "../ar-session/logger";
import { bindModelIconFallbacks, MODEL_ICON_FALLBACK, modelIconSrc } from "../shared/model-icon";
import { openQuickLookFromGlbOrUsdz, prefetchQuickLookGlbs } from "../xr/ios/quick-look-open";

export type QuickLookPickerItem = Omit<CatalogModel, "usdzUrl"> & {
  iconSrc: string;
  modelUrl: string | null;
  usdzUrl: string | null;
};

export function renderIosQuickLookPicker(
  root: HTMLElement,
  items: QuickLookPickerItem[],
  handlers: {
    onBack: () => void;
    sessionLogDownload?: boolean;
    onDownloadLog?: () => void;
  }
): void {
  const withAr = items.filter((m) => m.modelUrl || m.usdzUrl);
  const tiles = withAr
    .map(
      (m) => `
      <button type="button" class="model-tile" data-usdz-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(m.name)}">
        <img class="model-tile-icon" src="${escapeHtml(m.iconSrc)}" alt="" data-icon-fallback="${escapeHtml(MODEL_ICON_FALLBACK)}" />
        <span class="model-tile-name">${escapeHtml(m.name)}</span>
      </button>`
    )
    .join("");

  root.innerHTML = `
    <div class="home ios-quick-look-home">
      <header class="home-header">
        <h1>View in AR</h1>
        <p class="home-sub">Safari AR on iPhone and iPad — tap a model to place it in your space.</p>
      </header>
      <ol class="quick-look-steps home-sub">
        <li>Tap a model below — Safari AR opens.</li>
        <li>Move your phone slowly so the camera finds a flat floor.</li>
        <li>Tap the screen to place the model. Pinch to resize, drag with one finger to move.</li>
      </ol>
      ${
        withAr.length
          ? `<div class="model-tile-row quick-look-row" role="list">${tiles}</div>`
          : `<p class="home-sub">No AR models yet. On a PC, upload a GLB in Manage 3D models.</p>`
      }
      ${
        handlers.sessionLogDownload && handlers.onDownloadLog
          ? `<button type="button" class="btn btn-ghost btn-block ar-action-btn-log" data-action="session-log">Download session log (JSON)</button>`
          : ""
      }
      <p class="home-sub ios-session-log-status hidden" data-ios-log-status aria-live="polite"></p>
      <button type="button" class="btn btn-ghost btn-block" data-action="back">Back</button>
    </div>
  `;

  bindModelIconFallbacks(root);

  prefetchQuickLookGlbs(withAr.map((m) => m.modelUrl));

  const statusEl = root.querySelector("[data-ios-log-status]") as HTMLElement | null;

  root.onclick = (e) => {
    const tile = (e.target as HTMLElement).closest("[data-usdz-id]");
    if (tile) {
      const id = tile.getAttribute("data-usdz-id");
      const item = withAr.find((m) => m.id === id);
      if (item && (item.modelUrl || item.usdzUrl)) {
        void (async () => {
          tile.setAttribute("aria-busy", "true");
          if (statusEl) {
            statusEl.classList.remove("hidden");
            statusEl.textContent = "Preparing Safari AR model…";
          }
          try {
            await openQuickLookFromGlbOrUsdz({
              modelId: item.id,
              modelUrl: item.modelUrl,
              usdzUrl: item.usdzUrl,
              posterUrl: item.iconSrc,
              onPreparing: (msg) => {
                if (statusEl) statusEl.textContent = msg;
              },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not open Safari AR.";
            if (statusEl) statusEl.textContent = msg;
            logArEvent("ios-quick-look-open", "Safari AR model failed", "fail", {
              error: msg,
              details: { modelId: item.id },
            });
          } finally {
            tile.removeAttribute("aria-busy");
          }
        })();
      }
      return;
    }
    const action = (e.target as HTMLElement).closest("[data-action]")?.getAttribute("data-action");
    if (action === "session-log") handlers.onDownloadLog?.();
    if (action === "back") handlers.onBack();
  };
}

export function catalogToQuickLookItems(records: CatalogModel[], tenantSlug?: string | null): QuickLookPickerItem[] {
  return records.map((r) => {
    const assets = resolveCatalogAssets(r, tenantSlug);
    const iconSrc = modelIconSrc(r, tenantSlug);
    return { ...r, iconSrc, modelUrl: assets.modelUrl, usdzUrl: assets.usdzUrl };
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
