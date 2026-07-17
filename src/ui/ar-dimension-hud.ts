import type { PlacedDimensionHudState } from "../xr/shared/webxr-ar-types";

const HUD_ID = "ar-dimension-hud";

export function ensureArDimensionHud(): HTMLElement {
  let el = document.getElementById(HUD_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = HUD_ID;
  el.className = "ar-dimension-hud ar-dimension-hud--dock hidden";
  el.setAttribute("aria-live", "polite");
  document.getElementById("ar-overlay")?.appendChild(el);
  return el;
}

export function updateArDimensionHud(state: PlacedDimensionHudState | null): void {
  const el = ensureArDimensionHud();
  if (!state?.visible) {
    el.classList.add("hidden");
    return;
  }
  el.textContent = state.label;
  el.classList.remove("ar-dimension-hud--fixed", "ar-dimension-hud--projected");
  if (state.dock || state.fixed) {
    el.classList.add("ar-dimension-hud--dock");
    el.style.removeProperty("left");
    el.style.removeProperty("top");
  } else {
    el.classList.add("ar-dimension-hud--projected");
    el.style.left = `${state.x}px`;
    el.style.top = `${state.y}px`;
  }
  el.classList.remove("hidden");
}

export function hideArDimensionHud(): void {
  document.getElementById(HUD_ID)?.classList.add("hidden");
}
