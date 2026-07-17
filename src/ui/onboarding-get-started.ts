import type { Workspace } from "../shared/tenant";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import {
  loadOnboarding,
  onboardingProgressPercent,
  type OnboardingState,
} from "../shared/onboarding-progress";
import { MKT } from "./marketing-copy";
import { MKT_ASSETS } from "./marketing-assets";
import { pcAdminDiagramIconHtml, phoneArDiagramIconHtml } from "./device-diagram-icons";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stepRow(
  id: string,
  done: boolean,
  title: string,
  body: string,
  actionHtml: string,
): string {
  return `
    <li class="onboard-step ${done ? "onboard-step--done" : ""}" data-step="${escapeHtml(id)}">
      <span class="onboard-step-check" aria-hidden="true">${done ? "✓" : ""}</span>
      <div class="onboard-step-body">
        <h3>${escapeHtml(title)}</h3>
        <p>${body}</p>
        ${actionHtml}
      </div>
    </li>`;
}

export function renderOnboardingGetStarted(
  root: HTMLElement,
  workspace: Workspace,
  opts: {
    email: string;
    modelCount: number;
    showroomUrl: string;
    onUpload: () => void;
    onCopyLink: () => void | Promise<void>;
    onOpenShowroom: () => void;
    onPreviewAr: () => void;
    onAdmin: () => void;
    onHelp?: () => void;
    onDismiss: () => void;
    onBack: () => void;
  },
): void {
  const state = loadOnboarding(workspace.id);
  const uploadDone = state.steps.upload || opts.modelCount > 0;
  const shareDone = state.steps.share;
  const previewDone = state.steps.preview;
  const pct = onboardingProgressPercent(
    { ...state, steps: { upload: uploadDone, share: shareDone, preview: previewDone } },
    opts.modelCount,
  );

  root.innerHTML = `
    <div class="admin-shell onboard-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card onboard-card">
          ${brandedHeaderHtml("Get started", `${MKT.onboardingTarget} · ${escapeHtml(workspace.name)}`)}
          <p class="auth-hint">Signed in as <strong>${escapeHtml(opts.email)}</strong></p>

          <div class="onboard-progress-wrap" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="onboard-progress-bar"><div class="onboard-progress-fill" style="width:${pct}%"></div></div>
            <p class="onboard-progress-label">${pct}% complete · ${MKT.onboardingTarget}</p>
          </div>

          <div class="onboard-diagram" aria-label="How Atlas AR works">
            <div class="onboard-diagram-col">
              <span class="onboard-diagram-icon diagram-icon-wrap">${pcAdminDiagramIconHtml()}</span>
              <strong>PC admin</strong>
              <span>Upload GLB · brand · copy link</span>
            </div>
            <div class="onboard-diagram-arrow" aria-hidden="true">→</div>
            <div class="onboard-diagram-col">
              <span class="onboard-diagram-icon diagram-icon-wrap">${phoneArDiagramIconHtml()}</span>
              <strong>${MKT.howItWorksPhoneLabel}</strong>
              <span>${MKT.howItWorksPhoneDetail}</span>
            </div>
          </div>

          <p class="onboard-upload-faq">${MKT.onboardingUploadFaq}</p>
          <p class="auth-hint onboard-ar-3d-note">${MKT.productStoryAr3dLead}</p>

          <ol class="onboard-steps">
            ${stepRow(
              "upload",
              uploadDone,
              "1. Upload your first 3D model",
              "Desktop admin only — drag a GLB and icon. USDZ for iOS is generated automatically.",
              `<button type="button" class="btn btn-primary btn-sm" data-action="upload">${uploadDone ? "Add another model" : "Upload model"}</button>`,
            )}
            ${stepRow(
              "share",
              shareDone,
              "2. Copy your showroom link",
              `Share <code>${escapeHtml(`/w/${workspace.slug}`)}</code> with associates or shoppers — no login required.`,
              `<div class="onboard-share-row">
                 <code class="admin-code onboard-share-url">${escapeHtml(opts.showroomUrl)}</code>
                 <button type="button" class="btn btn-ghost btn-sm" data-action="copy">Copy link</button>
               </div>`,
            )}
            ${stepRow(
              "preview",
              previewDone,
              "3. Place on a real floor",
              "Open the showroom on a phone, tap <strong>Start AR</strong>, scan the floor, and place at true scale. Tap <strong>3D</strong> anytime to rotate and zoom the same model.",
              `<div class="onboard-preview-actions">
                 <button type="button" class="btn btn-primary btn-sm" data-action="showroom">Open showroom</button>
                 <button type="button" class="btn btn-ghost btn-sm" data-action="preview-ar">Preview AR (this device)</button>
               </div>`,
            )}
          </ol>

          <p class="auth-hint onboard-roi-note">${MKT.onboardingRoiNote}</p>

          <div class="admin-footer-actions">
            <button type="button" class="mkt-btn mkt-btn-primary" data-action="admin">Go to admin dashboard</button>
            ${opts.onHelp ? `<button type="button" class="mkt-btn mkt-btn-ghost" data-action="help">Admin help</button>` : ""}
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="dismiss">Skip for now</button>
            <button type="button" class="mkt-btn mkt-btn-ghost" data-action="back">← Back to home</button>
          </div>
        </div>
      </div>
    </div>`;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);

  root.querySelector("[data-action=upload]")?.addEventListener("click", opts.onUpload);
  root.querySelector("[data-action=copy]")?.addEventListener("click", () => void opts.onCopyLink());
  root.querySelector("[data-action=showroom]")?.addEventListener("click", opts.onOpenShowroom);
  root.querySelector("[data-action=preview-ar]")?.addEventListener("click", opts.onPreviewAr);
  root.querySelector("[data-action=admin]")?.addEventListener("click", opts.onAdmin);
  root.querySelector("[data-action=help]")?.addEventListener("click", () => opts.onHelp?.());
  root.querySelector("[data-action=dismiss]")?.addEventListener("click", opts.onDismiss);
  root.querySelector("[data-action=back]")?.addEventListener("click", opts.onBack);
}

export function onboardingBannerHtml(state: OnboardingState, modelCount: number): string {
  const pct = onboardingProgressPercent(state, modelCount);
  if (pct >= 100) return "";
  return `
    <div class="onboard-banner" role="status">
      <div>
        <strong>${MKT.onboardingTarget}</strong>
        <span class="auth-hint"> · ${pct}% complete — upload, share link, place on floor</span>
      </div>
      <button type="button" class="btn btn-primary btn-sm" data-action="get-started">Continue setup</button>
    </div>`;
}
