/**
 * Marketing / sales showcase catalog — static GLBs under /showcase/*.glb
 * Used to demo Direct AR links + Back to catalog (arExitUrl → product page).
 */
import type { CatalogModel } from "../data/model-catalog";
import { getShowcaseLinkConfig } from "./showcase-link-overrides";

const base = import.meta.env.BASE_URL || "/";

export type ShowcaseProduct = {
  id: string;
  name: string;
  eyebrow: string;
  summary: string;
  details: string[];
  /** Filename under public/showcase/ */
  glbFile: string;
};

export const SHOWCASE_PRODUCTS: ShowcaseProduct[] = [
  {
    id: "bar-chair-v3",
    name: "Bar Chair",
    eyebrow: "Seating",
    summary: "Counter-height stool with chrome wire and leather seat — true floor scale in browser AR.",
    details: ["GLB catalog SKU", "Chrome + Safari AR", "Direct link ready"],
    glbFile: "bar-chair-v3.glb",
  },
  {
    id: "cv108",
    name: "CV108",
    eyebrow: "Sofa",
    summary: "Compact sofa silhouette for living-room placement demos on a shopper’s floor.",
    details: ["Living room scale", "Direct AR landing", "Back to catalog exit"],
    glbFile: "cv108.glb",
  },
  {
    id: "ct202",
    name: "CT202 Sofa",
    eyebrow: "Sofa",
    summary: "Larger sofa SKU — share one link so buyers see footprint before they buy.",
    details: ["Floor plane lock", "No app install", "Sales-ready Direct AR"],
    glbFile: "ct202.glb",
  },
  {
    id: "module-x-double",
    name: "Module X Double",
    eyebrow: "Modular",
    summary: "Double modular unit from the Inkoopboek set — catalog + Direct AR loop demo.",
    details: ["Modular furniture", "White-label ready", "Exit returns to PDP"],
    glbFile: "module-x-double.glb",
  },
];

export function getShowcaseProduct(id: string): ShowcaseProduct | undefined {
  const key = decodeURIComponent(id).trim().toLowerCase();
  return SHOWCASE_PRODUCTS.find((p) => p.id.toLowerCase() === key);
}

export function showcaseCatalogPath(): string {
  return "/sales-deck/showcase";
}

export function showcaseProductPath(id: string): string {
  return `/sales-deck/showcase/${encodeURIComponent(id)}`;
}

export function showcaseGlbUrl(glbFile: string): string {
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}showcase/${encodeURIComponent(glbFile)}`;
}

/** CatalogModel for AR / picker — arExitUrl from link demo overrides (or PDP default). */
export function showcaseToCatalogModel(product: ShowcaseProduct): CatalogModel {
  const links = getShowcaseLinkConfig(product.id);
  return {
    id: product.id,
    name: product.name,
    glbUrl: showcaseGlbUrl(product.glbFile),
    arExitUrl: links.arExitUrl,
    demoStorage: "local",
  };
}

export function findShowcaseCatalogModel(modelId: string): CatalogModel | undefined {
  const product = getShowcaseProduct(modelId);
  return product ? showcaseToCatalogModel(product) : undefined;
}

export function allShowcaseCatalogModels(): CatalogModel[] {
  return SHOWCASE_PRODUCTS.map(showcaseToCatalogModel);
}
