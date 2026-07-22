/** Reliable tap handling for AR HTML panels on iOS immersive AR (immersive mode blocks click bubbling). */
const touchAbortKey = "__arPanelTouchAbort";

/** Horizontal drag beyond this is treated as scroll, not tile selection. */
const TILE_DRAG_THRESHOLD_PX = 10;

/** Survives re-bind during patchArModelPicker — blocks pointerup+click double fire. */
const ACTION_DEBOUNCE_MS = 420;
const lastActionFireAt = new Map<string, number>();
/** pointerup on Android AR dom-overlay also emits click ~4ms later — suppress duplicate. */
const suppressClickAfterPointerUntil = new Map<string, number>();

type RowTouchStart = {
  x: number;
  y: number;
  scrollLeft: number;
};

export function bindArPanelTouch(
  root: HTMLElement,
  handler: (action: string, modelId?: string) => void
): void {
  const prior = (root as HTMLElement & { [touchAbortKey]?: AbortController })[
    touchAbortKey
  ];
  prior?.abort();

  const ac = new AbortController();
  (root as HTMLElement & { [touchAbortKey]?: AbortController })[touchAbortKey] = ac;

  const rowTouchStarts = new WeakMap<HTMLElement, RowTouchStart>();

  root.addEventListener(
    "pointerdown",
    (e) => {
      const row = (e.target as HTMLElement).closest(".model-tile-row") as HTMLElement | null;
      if (!row) return;
      rowTouchStarts.set(row, {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: row.scrollLeft,
      });
    },
    { capture: true, signal: ac.signal }
  );

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = (e.target as HTMLElement).closest(
      "[data-action],[data-model-id]"
    ) as HTMLElement | null;
    if (!target) return;
    if (
      target.hasAttribute("disabled") ||
      (target as HTMLButtonElement).disabled
    ) {
      return;
    }

    const modelTile = target.closest("[data-model-id]") as HTMLElement | null;
    if (modelTile) {
      const row = modelTile.closest(".model-tile-row") as HTMLElement | null;
      const start = row ? rowTouchStarts.get(row) : undefined;
      if (row && start) {
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        const scrollDelta = Math.abs(row.scrollLeft - start.scrollLeft);
        if (
          scrollDelta > 2 ||
          dx > TILE_DRAG_THRESHOLD_PX ||
          dy > TILE_DRAG_THRESHOLD_PX
        ) {
          rowTouchStarts.delete(row);
          return;
        }
      }
    }

    const action = target.getAttribute("data-action");
    const modelId = target.getAttribute("data-model-id");
    const actionKey = action ? `a:${action}` : modelId ? `m:${modelId}` : "";
    if (!actionKey) return;
    const now = performance.now();
    if (e.type === "click") {
      const suppressUntil = suppressClickAfterPointerUntil.get(actionKey) ?? 0;
      if (now < suppressUntil) return;
    }
    const lastAt = lastActionFireAt.get(actionKey) ?? 0;
    if (now - lastAt < ACTION_DEBOUNCE_MS) return;
    lastActionFireAt.set(actionKey, now);
    if (e.type === "pointerup") {
      suppressClickAfterPointerUntil.set(actionKey, now + 600);
    }
    e.preventDefault();
    e.stopPropagation();
    if (action) {
      handler(action);
      return;
    }
    if (modelId) handler("select", modelId);
  };

  root.addEventListener("pointerup", onPointerUp, {
    capture: true,
    signal: ac.signal,
  });
  // Android Chrome AR dom-overlay: click fallback when pointerup is swallowed.
  root.addEventListener("click", onPointerUp as (e: Event) => void, {
    capture: true,
    signal: ac.signal,
  });
}
