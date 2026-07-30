import type { CatalogModel } from "../data/model-catalog";
import { isDemoCatalogModel } from "../data/model-catalog";
import { bindModelIconFallbacks, MODEL_ICON_FALLBACK, modelIconSrc } from "../shared/model-icon";
import { getCurrentUser } from "../auth/flow";
import {
  canUploadDemoRemote,
  demoDualUploadAvailable,
  uploadBlockedReason,
} from "../config/api";
import {
  uploadModelToServer,
  deleteModelOnServer,
  adminApiHint,
  type AdminCatalogModel,
  type DemoModelStorage,
} from "../data/model-admin-api";
import {
  deleteWorkspaceModel,
  tenantAdminApiHint,
  uploadModelToWorkspace,
} from "../data/tenant-model-api";
import { modelArUrl } from "../shared/model-ar-url";
import { markOnboardingStep } from "../shared/onboarding-progress";
import {
  convertGlbToUsdz,
  preloadGlbToUsdzModules,
  usdzFileFromGlbName,
} from "../data/glb-to-usdz";
import { USDZ_MIME } from "../xr/ios/quick-look-ar";
import { globalModelArUrl } from "../shared/model-ar-url";
import {
  checkModelUploadSizes,
  uploadSizeNoteHtml,
} from "../shared/upload-size-limits";

function storageBadge(model: CatalogModel): string {
  const storage = (model as AdminCatalogModel).demoStorage;
  if (storage === "local") return ` <span class="model-storage-badge model-storage-badge--local">Local repo</span>`;
  if (storage === "remote") return ` <span class="model-storage-badge model-storage-badge--remote">AWS S3</span>`;
  return "";
}

function uploadDestinationHtml(): string {
  if (demoDualUploadAvailable()) {
    return `
        <fieldset class="model-upload-dest">
          <legend class="field-label">Save to</legend>
          <label class="model-upload-dest-option">
            <input type="radio" name="uploadTarget" value="local" checked />
            Local repo <span class="auth-hint">(public/custom-models/ · commit to GitHub)</span>
          </label>
          <label class="model-upload-dest-option">
            <input type="radio" name="uploadTarget" value="remote" />
            AWS S3 <span class="auth-hint">(live demo on production)</span>
          </label>
        </fieldset>`;
  }
  if (canUploadDemoRemote()) {
    return `<p class="home-sub auth-hint">Uploads save to <strong>AWS S3</strong> and appear in live demo AR after deploy.</p>`;
  }
  return "";
}

function selectedUploadTarget(form: HTMLFormElement): DemoModelStorage {
  const checked = form.querySelector('input[name="uploadTarget"]:checked') as HTMLInputElement | null;
  if (checked?.value === "remote") return "remote";
  if (checked?.value === "local") return "local";
  return canUploadDemoRemote() ? "remote" : "local";
}

export function renderPcModelManager(
  root: HTMLElement,
  models: CatalogModel[],
  handlers: {
    onBack: () => void;
    onChanged: () => void;
    embedded?: boolean;
    workspace?: { id: string; slug: string };
  }
): void {
  const workspace = handlers.workspace;
  const userModels = models.filter((m) => !isDemoCatalogModel(m));
  const list = userModels
    .map((m) => {
      const shareUrl = workspace ? modelArUrl(workspace.slug, m.id) : globalModelArUrl(m.id);
      const iconUrl = modelIconSrc(m, workspace?.slug ?? null, { bustCache: true });
      return `
      <li class="model-manage-row model-manage-row--share">
        <div class="model-manage-card-head">
          <img class="model-manage-thumb" src="${escapeHtml(iconUrl)}" alt="" width="48" height="48" loading="lazy" decoding="async" data-icon-fallback="${escapeHtml(MODEL_ICON_FALLBACK)}" />
          <div class="model-manage-main">
          <span class="model-manage-name">${escapeHtml(m.name)} <small class="muted-id">${escapeHtml(m.id)}</small>${storageBadge(m)}${m.usdz || m.usdzUrl ? " · USDZ" : ""}</span>
          <code class="admin-code model-share-url">${escapeHtml(shareUrl)}</code>
          </div>
        </div>
        <div class="model-manage-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-copy-url="${escapeHtml(shareUrl)}">Copy AR link</button>
          <button type="button" class="btn btn-ghost btn-sm" data-delete="${escapeHtml(m.id)}" data-storage="${escapeHtml((m as AdminCatalogModel).demoStorage ?? "remote")}">Delete</button>
        </div>
      </li>`;
    })
    .join("");

  root.innerHTML = `
    <div class="home model-admin-pc ${handlers.embedded ? "model-admin-pc--embedded" : ""}">
      <header class="home-header">
        <h1>${handlers.embedded ? "Global demo catalog" : "Manage 3D models (PC)"}</h1>
        <p class="home-sub">${escapeHtml(workspace ? tenantAdminApiHint(workspace.slug) : adminApiHint())}</p>
        <p class="home-sub auth-hint">Share links open ${workspace ? `<code>/w/${escapeHtml(workspace.slug)}/ar/{modelId}</code>` : "<code>/ar/{modelId}</code>"} on this site.</p>
      </header>
      <form class="model-upload-form" id="model-upload-form">
        <p class="home-sub auth-hint model-upload-size-note">${uploadSizeNoteHtml()}</p>
        <label class="field-label">Name</label>
        <input type="text" name="name" class="field-input" placeholder="Pump valve" required maxlength="40" />
        <label class="field-label">Icon image</label>
        <input type="file" name="icon" accept="image/png,image/jpeg,image/webp" required />
        <label class="field-label">3D model (.glb)</label>
        <input type="file" name="glb" accept=".glb,model/gltf-binary" required />
        <label class="field-label">iOS AR model (.usdz) <span class="muted-id">optional — Safari Quick Look</span></label>
        <input type="file" name="usdz" accept=".usdz,model/vnd.usdz+zip" />
        <p class="home-sub">Leave USDZ empty to auto-generate from GLB, or upload one from Apple Reality Converter for best iOS texture quality.</p>
        <p class="upload-status camera-warning hidden" id="upload-size-warning" role="status" aria-live="polite"></p>
        ${workspace ? `<p class="home-sub auth-hint">Uploads save to your <strong>operator workspace</strong> catalog (powers Try live demo AR).</p>` : uploadDestinationHtml()}
        <div class="upload-progress-wrap hidden" id="upload-progress-wrap">
          <div class="upload-progress-bar"><div class="upload-progress-fill" id="upload-progress-fill"></div></div>
          <p class="upload-progress-label" id="upload-progress-label">0%</p>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="upload-submit-btn">Upload to server</button>
      </form>
      <p class="upload-status" id="upload-status" aria-live="polite"></p>
      ${userModels.length ? `<ul class="model-manage-list">${list}</ul>` : "<p class='home-sub'>No custom models yet.</p>"}
      ${handlers.embedded ? "" : `<button type="button" class="btn btn-ghost btn-block" data-action="back">Back to owner dashboard</button>`}
    </div>
  `;

  bindModelIconFallbacks(root);

  const statusEl = root.querySelector("#upload-status") as HTMLElement;
  const sizeWarningEl = root.querySelector("#upload-size-warning") as HTMLElement;
  const progressWrap = root.querySelector("#upload-progress-wrap") as HTMLElement;
  const progressFill = root.querySelector("#upload-progress-fill") as HTMLElement;
  const progressLabel = root.querySelector("#upload-progress-label") as HTMLElement;
  const submitBtn = root.querySelector("#upload-submit-btn") as HTMLButtonElement;
  const form = root.querySelector("#model-upload-form") as HTMLFormElement;
  const uploadBlock = workspace ? null : uploadBlockedReason();

  if (uploadBlock) {
    submitBtn.disabled = true;
    statusEl.textContent = uploadBlock;
  }

  preloadGlbToUsdzModules();

  const showSizeFeedback = (check: ReturnType<typeof checkModelUploadSizes>) => {
    if (check.error) {
      sizeWarningEl.classList.remove("hidden");
      sizeWarningEl.textContent = check.error;
      statusEl.textContent = check.error;
      return;
    }
    if (check.warning) {
      sizeWarningEl.classList.remove("hidden");
      sizeWarningEl.textContent = check.warning;
      return;
    }
    sizeWarningEl.classList.add("hidden");
    sizeWarningEl.textContent = "";
  };

  const previewUploadSizes = () => {
    const glbInput = form.elements.namedItem("glb") as HTMLInputElement;
    const usdzInput = form.elements.namedItem("usdz") as HTMLInputElement;
    const iconInput = form.elements.namedItem("icon") as HTMLInputElement;
    const glb = glbInput.files?.[0];
    if (!glb) {
      sizeWarningEl.classList.add("hidden");
      sizeWarningEl.textContent = "";
      return;
    }
    const usdz = usdzInput.files?.[0] ?? null;
    showSizeFeedback(
      checkModelUploadSizes({
        glb,
        usdz,
        icon: iconInput.files?.[0] ?? null,
        willAutoConvertUsdz: !(usdz && usdz.size > 0),
      }),
    );
  };

  form.querySelector('input[name="glb"]')?.addEventListener("change", previewUploadSizes);
  form.querySelector('input[name="usdz"]')?.addEventListener("change", previewUploadSizes);
  form.querySelector('input[name="icon"]')?.addEventListener("change", previewUploadSizes);

  form.onsubmit = (e) => {
    e.preventDefault();
    if (!workspace && uploadBlockedReason()) {
      statusEl.textContent = uploadBlockedReason()!;
      return;
    }
    if (workspace && !getCurrentUser()) {
      statusEl.textContent = "Sign in to upload models to your demo workspace.";
      return;
    }
    void (async () => {
      const fd = new FormData(form);
      const name = String(fd.get("name") ?? "");
      const icon = fd.get("icon");
      const glb = fd.get("glb");
      const manualUsdz = fd.get("usdz");
      if (!(icon instanceof File) || !(glb instanceof File)) return;
      const sizeCheck = checkModelUploadSizes({
        glb,
        usdz: manualUsdz instanceof File ? manualUsdz : null,
        icon,
        willAutoConvertUsdz: !(manualUsdz instanceof File && manualUsdz.size > 0),
      });
      showSizeFeedback(sizeCheck);
      if (sizeCheck.blocked) return;
      const target = workspace ? ("remote" as const) : selectedUploadTarget(form);
      submitBtn.disabled = true;
      progressWrap.classList.remove("hidden");
      progressFill.style.width = "0%";
      progressLabel.textContent = "0%";
      statusEl.textContent = "";
      const onProgress = (pct: number, phase: string) => {
        const clamped = Math.min(100, Math.max(0, Math.round(pct)));
        progressFill.style.width = `${clamped}%`;
        progressLabel.textContent = `${clamped}%`;
        statusEl.textContent = phase;
      };
      let usdzFile: File | null = null;
      if (manualUsdz instanceof File && manualUsdz.size > 0) {
        usdzFile = manualUsdz;
        onProgress(10, `Using your USDZ (${Math.round(manualUsdz.size / 1024)} KB) for iOS Quick Look`);
      } else {
        onProgress(2, "Generating iOS USDZ from GLB (optional)…");
        const usdzResult = await convertGlbToUsdz(glb, (phase) => {
          onProgress(8, phase);
        });
        if (usdzResult.ok) {
          usdzFile = new File([usdzResult.blob], usdzFileFromGlbName(glb.name), {
            type: USDZ_MIME,
          });
          const usdzSizeCheck = checkModelUploadSizes({
            glb,
            usdz: usdzFile,
            willAutoConvertUsdz: false,
          });
          if (usdzSizeCheck.blocked) {
            showSizeFeedback(usdzSizeCheck);
            statusEl.textContent = `${usdzSizeCheck.error} Uploading GLB only — add a smaller manual USDZ for iOS.`;
            usdzFile = null;
          } else {
            onProgress(10, `USDZ ready (${Math.round(usdzResult.byteLength / 1024)} KB)`);
          }
        } else {
          onProgress(10, `USDZ failed: ${usdzResult.error}`);
          statusEl.textContent = `USDZ conversion failed: ${usdzResult.error}. Uploading GLB only — add a manual .usdz from Reality Converter for iOS, or retry in Chrome on desktop.`;
        }
      }
      try {
        const result = workspace
          ? await uploadModelToWorkspace(
              workspace.id,
              name,
              icon,
              glb,
              onProgress,
              usdzFile,
            )
          : await uploadModelToServer(name, icon, glb, onProgress, usdzFile, { target });
        if (result.ok) {
          progressFill.style.width = "100%";
          progressLabel.textContent = "100%";
          const destLabel = workspace ? `workspace ${workspace.slug}` : target === "local" ? "local repo" : "AWS S3";
          statusEl.textContent = usdzFile
            ? `Saved “${name}” to ${destLabel} with USDZ for iOS Quick Look.`
            : `Saved “${name}” to ${destLabel} (GLB only — iOS Quick Look unavailable for this model).`;
          form.reset();
          handlers.onChanged();
        } else {
          statusEl.textContent = result.error ?? "Upload failed";
        }
      } catch (e) {
        statusEl.textContent = e instanceof Error ? e.message : "Upload failed";
      } finally {
        submitBtn.disabled = false;
      }
    })();
  };

  root.onclick = (e) => {
    const copyBtn = (e.target as HTMLElement).closest("[data-copy-url]");
    if (copyBtn) {
      const url = copyBtn.getAttribute("data-copy-url");
      if (!url) return;
      if (workspace) markOnboardingStep(workspace.id, "share");
      void navigator.clipboard.writeText(url).then(() => {
        statusEl.textContent = "AR link copied to clipboard.";
      }).catch(() => {
        statusEl.textContent = url;
      });
      return;
    }
    const del = (e.target as HTMLElement).closest("[data-delete]");
    if (del) {
      const id = del.getAttribute("data-delete");
      const storage = del.getAttribute("data-storage") as DemoModelStorage | null;
      if (id && confirm("Delete this model from the server?")) {
        void (async () => {
          if (workspace) {
            await deleteWorkspaceModel(workspace.id, id);
          } else {
            await deleteModelOnServer(id, storage ?? undefined);
          }
          handlers.onChanged();
        })();
      }
      return;
    }
    if ((e.target as HTMLElement).closest('[data-action="back"]')) handlers.onBack();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
