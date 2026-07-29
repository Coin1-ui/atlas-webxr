#!/usr/bin/env node
/**
 * Unit tests: workspace onboarding normalize/merge + FE progress helpers.
 */
import assert from "node:assert/strict";
import {
  normalizeWorkspaceOnboarding,
  mergeWorkspaceOnboarding,
} from "../backend/lambda/atlas-api/lib/dynamodb.mjs";

// --- Backend normalize / merge ---
assert.equal(normalizeWorkspaceOnboarding(null), undefined);
assert.equal(normalizeWorkspaceOnboarding("x"), undefined);

const n = normalizeWorkspaceOnboarding({
  steps: { upload: true, share: 1, preview: false },
  dismissed: true,
  completedAt: "2026-07-29T10:00:00.000Z",
});
assert.deepEqual(n.steps, { upload: true, share: false, preview: false });
assert.equal(n.dismissed, true);
assert.equal(n.completedAt, "2026-07-29T10:00:00.000Z");

const merged = mergeWorkspaceOnboarding(
  { steps: { upload: true, share: false, preview: false } },
  { steps: { upload: false, share: true, preview: true } }
);
assert.deepEqual(merged.steps, { upload: true, share: true, preview: true });
assert.ok(merged.completedAt);

// --- FE helpers with mock localStorage ---
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
};

const {
  hydrateOnboardingFromWorkspace,
  isOnboardingComplete,
  loadOnboarding,
  markOnboardingStep,
  onboardingToServerPayload,
  shouldShowOnboardingBanner,
  shouldSkipGetStartedWizard,
  setOnboardingServerPersist,
} = await import("../src/shared/onboarding-progress.ts");

const wsId = "ws-test-onboard-1";
store.clear();

assert.equal(shouldSkipGetStartedWizard(wsId, 0), false);
assert.equal(shouldSkipGetStartedWizard(wsId, 2), true, "models skip forced wizard");
assert.equal(shouldShowOnboardingBanner(wsId, 2), true, "banner until complete/dismiss");

markOnboardingStep(wsId, "share");
const afterShare = loadOnboarding(wsId);
assert.equal(afterShare.steps.share, true);

const hydrated = hydrateOnboardingFromWorkspace({
  id: wsId,
  onboarding: {
    steps: { upload: true, share: false, preview: true },
    completedAt: undefined,
  },
});
assert.equal(hydrated.steps.upload, true);
assert.equal(hydrated.steps.share, true, "local share OR server");
assert.equal(hydrated.steps.preview, true);
assert.ok(hydrated.completedAt);
assert.equal(isOnboardingComplete(wsId, 0), true);
assert.equal(shouldShowOnboardingBanner(wsId, 1), false);

const payload = onboardingToServerPayload(hydrated);
assert.deepEqual(payload.steps, { upload: true, share: true, preview: true });

let persisted = null;
setOnboardingServerPersist((id, state) => {
  persisted = { id, state };
});
store.clear();
markOnboardingStep(wsId, "upload");
assert.equal(persisted?.id, wsId);
assert.equal(persisted?.state.steps.upload, true);

// Backfill: local-only progress should PATCH once when server is empty/stale.
store.clear();
persisted = null;
markOnboardingStep("ws-backfill", "share");
markOnboardingStep("ws-backfill", "preview");
hydrateOnboardingFromWorkspace({ id: "ws-backfill", onboarding: undefined });
assert.equal(persisted?.id, "ws-backfill");
assert.equal(persisted?.state.steps.share, true);
assert.equal(persisted?.state.steps.preview, true);
hydrateOnboardingFromWorkspace({
  id: "ws-backfill",
  onboarding: onboardingToServerPayload(persisted.state),
});
assert.equal(
  persisted?.state.steps.preview,
  true,
  "second hydrate with matching server should not reset payload"
);

console.log("test-onboarding-cross-browser: OK");
