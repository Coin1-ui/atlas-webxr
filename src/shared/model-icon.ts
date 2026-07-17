import type { CatalogModel } from "../data/model-catalog";
import { defaultIconForBuiltin, getEffectiveCatalogAssetSlug, resolveCatalogAssets } from "../data/model-catalog";

export const MODEL_ICON_FALLBACK = defaultIconForBuiltin("pad");

/** Resolve icon URL for tenant or demo catalog rows (pass workspace slug on admin screens). */
export function modelIconSrc(
  model: CatalogModel,
  tenantSlug?: string | null,
  opts?: { bustCache?: boolean },
): string {
  const slug = getEffectiveCatalogAssetSlug(tenantSlug);
  const assets = resolveCatalogAssets(model, slug);
  const base =
    assets.iconUrl ??
    (model.builtinType ? defaultIconForBuiltin(model.builtinType) : MODEL_ICON_FALLBACK);
  if (!opts?.bustCache || base.startsWith("data:")) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${encodeURIComponent(model.id)}`;
}

/** Swap broken icon URLs to the pad placeholder after S3/CDN failures. */
export function bindModelIconFallbacks(root: HTMLElement): void {
  const selector = "img.model-tile-icon, img.model-manage-thumb, .catalog-card-media img";
  root.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
    if (img.dataset.iconFallbackBound === "1") return;
    img.dataset.iconFallbackBound = "1";
    const fallback = img.getAttribute("data-icon-fallback") || MODEL_ICON_FALLBACK;
    img.addEventListener(
      "error",
      () => {
        if (img.src !== fallback) img.src = fallback;
      },
      { once: true },
    );
  });
}
