import type { Workspace, WorkspaceOnboarding } from "./tenant";

export type OnboardingStepId = "upload" | "share" | "preview";

export type OnboardingState = {
  workspaceId: string;
  steps: Record<OnboardingStepId, boolean>;
  dismissed?: boolean;
  completedAt?: string;
};

const STORAGE_PREFIX = "atlas-onboarding-";

/** Optional server persist hook (set from main / workspace-api). */
let persistToServer:
  | ((workspaceId: string, state: OnboardingState) => void | Promise<void>)
  | null = null;

export function setOnboardingServerPersist(
  fn: ((workspaceId: string, state: OnboardingState) => void | Promise<void>) | null
): void {
  persistToServer = fn;
}

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function emptyState(workspaceId: string): OnboardingState {
  return {
    workspaceId,
    steps: { upload: false, share: false, preview: false },
  };
}

export function loadOnboarding(workspaceId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return emptyState(workspaceId);
    const parsed = JSON.parse(raw) as OnboardingState;
    return {
      workspaceId,
      steps: {
        upload: Boolean(parsed.steps?.upload),
        share: Boolean(parsed.steps?.share),
        preview: Boolean(parsed.steps?.preview),
      },
      dismissed: Boolean(parsed.dismissed),
      completedAt: parsed.completedAt,
    };
  } catch {
    return emptyState(workspaceId);
  }
}

function schedulePersist(state: OnboardingState): void {
  if (!persistToServer) return;
  void Promise.resolve(persistToServer(state.workspaceId, state)).catch((err) => {
    console.warn("onboarding persist failed", err);
  });
}

export function saveOnboarding(state: OnboardingState, opts?: { skipServer?: boolean }): void {
  const allDone = state.steps.upload && state.steps.share && state.steps.preview;
  const toStore: OnboardingState = {
    workspaceId: state.workspaceId,
    steps: {
      upload: Boolean(state.steps.upload),
      share: Boolean(state.steps.share),
      preview: Boolean(state.steps.preview),
    },
    dismissed: state.dismissed ? true : undefined,
    completedAt: allDone
      ? state.completedAt ?? new Date().toISOString()
      : state.dismissed
        ? state.completedAt
        : undefined,
  };
  localStorage.setItem(storageKey(state.workspaceId), JSON.stringify(toStore));
  if (!opts?.skipServer) schedulePersist(toStore);
}

export function markOnboardingStep(workspaceId: string, step: OnboardingStepId): OnboardingState {
  const state = loadOnboarding(workspaceId);
  state.steps[step] = true;
  if (state.steps.upload && state.steps.share && state.steps.preview) {
    state.completedAt = state.completedAt ?? new Date().toISOString();
  }
  saveOnboarding(state);
  return state;
}

export function syncOnboardingUpload(workspaceId: string, modelCount: number): OnboardingState {
  if (modelCount <= 0) return loadOnboarding(workspaceId);
  return markOnboardingStep(workspaceId, "upload");
}

export function dismissOnboarding(workspaceId: string): void {
  const state = loadOnboarding(workspaceId);
  state.dismissed = true;
  saveOnboarding(state);
}

function serverOnboardingEquals(
  server: WorkspaceOnboarding | undefined | null,
  payload: WorkspaceOnboarding
): boolean {
  if (!server) return false;
  return (
    Boolean(server.steps?.upload) === payload.steps.upload &&
    Boolean(server.steps?.share) === payload.steps.share &&
    Boolean(server.steps?.preview) === payload.steps.preview &&
    Boolean(server.dismissed) === Boolean(payload.dismissed) &&
    (server.completedAt ?? "") === (payload.completedAt ?? "")
  );
}

/** Merge server ∪ local (per-step OR; dismissed/completedAt if either). Writes local cache. */
export function hydrateOnboardingFromWorkspace(
  workspace: Pick<Workspace, "id" | "onboarding">
): OnboardingState {
  const local = loadOnboarding(workspace.id);
  const server = workspace.onboarding;

  const merged: OnboardingState = {
    workspaceId: workspace.id,
    steps: {
      upload: Boolean(local.steps.upload || server?.steps?.upload),
      share: Boolean(local.steps.share || server?.steps?.share),
      preview: Boolean(local.steps.preview || server?.steps?.preview),
    },
    dismissed: Boolean(local.dismissed || server?.dismissed),
    completedAt: local.completedAt || server?.completedAt,
  };
  if (merged.steps.upload && merged.steps.share && merged.steps.preview && !merged.completedAt) {
    merged.completedAt = new Date().toISOString();
  }
  saveOnboarding(merged, { skipServer: true });

  // Backfill progress that only ever existed in this browser's localStorage,
  // otherwise a second browser can never learn about it. The equality check
  // keeps this to a single PATCH instead of one per admin load.
  const payload = onboardingToServerPayload(merged);
  const hasProgress =
    payload.steps.upload ||
    payload.steps.share ||
    payload.steps.preview ||
    Boolean(payload.dismissed) ||
    Boolean(payload.completedAt);
  if (hasProgress && !serverOnboardingEquals(server, payload)) {
    schedulePersist(merged);
  }
  return merged;
}

export function onboardingToServerPayload(state: OnboardingState): WorkspaceOnboarding {
  return {
    steps: {
      upload: Boolean(state.steps.upload),
      share: Boolean(state.steps.share),
      preview: Boolean(state.steps.preview),
    },
    ...(state.dismissed ? { dismissed: true } : {}),
    ...(state.completedAt ? { completedAt: state.completedAt } : {}),
  };
}

/** Fully done or dismissed (banner / checklist). */
export function isOnboardingComplete(workspaceId: string, modelCount = 0): boolean {
  const state = loadOnboarding(workspaceId);
  if (state.dismissed) return true;
  if (state.completedAt) return true;
  const steps = { ...state.steps };
  if (modelCount > 0) steps.upload = true;
  return steps.upload && steps.share && steps.preview;
}

/**
 * Admin entry: skip forced Get started wizard when catalog already has models
 * (cross-browser: share/preview may still be incomplete until hydrated/dismissed).
 */
export function shouldSkipGetStartedWizard(workspaceId: string, modelCount = 0): boolean {
  if (modelCount > 0) return true;
  return isOnboardingComplete(workspaceId, modelCount);
}

/** Dashboard banner: show until dismissed/completed even if models exist. */
export function shouldShowOnboardingBanner(workspaceId: string, modelCount = 0): boolean {
  const state = loadOnboarding(workspaceId);
  if (state.dismissed || state.completedAt) return false;
  return !isOnboardingComplete(workspaceId, modelCount);
}

export function onboardingProgressPercent(state: OnboardingState, modelCount = 0): number {
  let done = 0;
  if (state.steps.upload || modelCount > 0) done += 1;
  if (state.steps.share) done += 1;
  if (state.steps.preview) done += 1;
  return Math.round((done / 3) * 100);
}
