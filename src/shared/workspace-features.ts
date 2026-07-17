/** Per-workspace viewer controls — toggled by platform owner. */

export type WorkspaceFeatures = {
  /** Show “Download session log (JSON)” in AR panels. */
  sessionLogDownload: boolean;
  /** Show Start AR on customer landings; blocks AR entry when off. */
  startAr: boolean;
  /** Show Run camera + AR check on customer landings. */
  cameraCheck: boolean;
};

/** New workspaces: only Start AR on by default. */
export const DEFAULT_WORKSPACE_FEATURES: WorkspaceFeatures = {
  sessionLogDownload: false,
  startAr: true,
  cameraCheck: false,
};

/** @deprecated legacy single flag — maps to both startAr and cameraCheck */
type LegacyWorkspaceFeatures = Partial<WorkspaceFeatures> & {
  arControls?: boolean;
};

export function normalizeWorkspaceFeatures(
  input?: LegacyWorkspaceFeatures | null,
): WorkspaceFeatures {
  const legacyOff = input?.arControls === false;
  const merged = { ...DEFAULT_WORKSPACE_FEATURES, ...input };

  return {
    sessionLogDownload: merged.sessionLogDownload === true,
    startAr: legacyOff ? false : merged.startAr !== false,
    cameraCheck: legacyOff ? false : merged.cameraCheck === true,
  };
}
