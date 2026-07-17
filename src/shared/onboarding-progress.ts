export type OnboardingStepId = "upload" | "share" | "preview";

export type OnboardingState = {
  workspaceId: string;
  steps: Record<OnboardingStepId, boolean>;
  dismissed?: boolean;
  completedAt?: string;
};

const STORAGE_PREFIX = "atlas-onboarding-";

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

export function loadOnboarding(workspaceId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) {
      return {
        workspaceId,
        steps: { upload: false, share: false, preview: false },
      };
    }
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
    return {
      workspaceId,
      steps: { upload: false, share: false, preview: false },
    };
  }
}

export function saveOnboarding(state: OnboardingState): void {
  const allDone = state.steps.upload && state.steps.share && state.steps.preview;
  const next: OnboardingState = {
    ...state,
    completedAt: allDone ? state.completedAt ?? new Date().toISOString() : undefined,
  };
  localStorage.setItem(storageKey(state.workspaceId), JSON.stringify(next));
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

export function isOnboardingComplete(workspaceId: string, modelCount = 0): boolean {
  const state = loadOnboarding(workspaceId);
  if (state.dismissed) return true;
  if (state.completedAt) return true;
  const steps = { ...state.steps };
  if (modelCount > 0) steps.upload = true;
  return steps.upload && steps.share && steps.preview;
}

export function onboardingProgressPercent(state: OnboardingState, modelCount = 0): number {
  let done = 0;
  if (state.steps.upload || modelCount > 0) done += 1;
  if (state.steps.share) done += 1;
  if (state.steps.preview) done += 1;
  return Math.round((done / 3) * 100);
}
