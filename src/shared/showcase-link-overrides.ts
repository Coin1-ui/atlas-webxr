/**
 * Session-local overrides for showcase Direct AR + Back to catalog demos.
 * Mirrors admin model link fields so sales can edit and show the loop live.
 */

export type ShowcaseLinkConfig = {
  /** Share / open path or absolute URL for Direct AR (default `/ar/{id}`). */
  directArUrl: string;
  /** Destination when viewer taps Back to catalog on the AR landing. */
  arExitUrl: string;
};

const STORAGE_KEY = "atlas.showcase.linkOverrides.v1";

type OverrideMap = Record<string, Partial<ShowcaseLinkConfig>>;

function readMap(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as OverrideMap;
  } catch {
    return {};
  }
}

function writeMap(map: OverrideMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function defaultShowcaseLinkConfig(productId: string): ShowcaseLinkConfig {
  return {
    directArUrl: `/ar/${encodeURIComponent(productId)}`,
    arExitUrl: `/sales-deck/showcase/${encodeURIComponent(productId)}`,
  };
}

export function getShowcaseLinkConfig(productId: string): ShowcaseLinkConfig {
  const defaults = defaultShowcaseLinkConfig(productId);
  const override = readMap()[productId.toLowerCase()] ?? {};
  return {
    directArUrl: (override.directArUrl ?? defaults.directArUrl).trim() || defaults.directArUrl,
    arExitUrl: (override.arExitUrl ?? defaults.arExitUrl).trim() || defaults.arExitUrl,
  };
}

export function setShowcaseLinkConfig(
  productId: string,
  patch: Partial<ShowcaseLinkConfig>,
): ShowcaseLinkConfig {
  const key = productId.toLowerCase();
  const map = readMap();
  map[key] = { ...(map[key] ?? {}), ...patch };
  writeMap(map);
  return getShowcaseLinkConfig(productId);
}

export function resetShowcaseLinkConfig(productId: string): ShowcaseLinkConfig {
  const key = productId.toLowerCase();
  const map = readMap();
  delete map[key];
  writeMap(map);
  return defaultShowcaseLinkConfig(productId);
}
