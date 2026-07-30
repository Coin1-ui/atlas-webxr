import type { Workspace } from "../shared/tenant";
import { isDemoCatalogModel } from "../data/model-catalog";
import type { CatalogModel } from "../data/model-catalog";
import { bindModelIconFallbacks, MODEL_ICON_FALLBACK, modelIconSrc } from "../shared/model-icon";
import { modelUploadGate } from "../shared/model-upload-gate";
import { modelArUrl } from "../shared/model-ar-url";
import { markOnboardingStep } from "../shared/onboarding-progress";
import { brandedHeaderHtml, mountWorkspaceLogo } from "../branding/workspace-theme";
import { tenantAdminApiHint } from "../data/tenant-model-api";
import {
  deleteWorkspaceModel,
  uploadModelToWorkspace,
} from "../data/tenant-model-api";
import {
  convertGlbToUsdz,
  preloadGlbToUsdzModules,
  usdzFileFromGlbName,
} from "../data/glb-to-usdz";
import { USDZ_MIME } from "../xr/ios/quick-look-ar";
import { validateGlbFile } from "../shared/glb-validate";
import {
  checkModelUploadSizes,
  uploadSizeNoteHtml,
} from "../shared/upload-size-limits";
import { MKT_ASSETS } from "./marketing-assets";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function modelIconUrl(model: CatalogModel, workspaceSlug: string): string {
  return modelIconSrc(model, workspaceSlug, { bustCache: true });
}

export function renderAdminModels(
  root: HTMLElement,
  workspace: Workspace,
  models: CatalogModel[],
  handlers: {
    onBack: () => void;
    onChanged: () => void;
    onHelp?: () => void;
    onSaveArExitUrl: (url: string) => void | Promise<void>;
    onSaveModelArExitUrl: (modelId: string, url: string) => void | Promise<void>;
    onUpgrade?: () => void;
    /** Live workspace storage used (bytes) for storage upload gate. */
    storageBytesUsed?: number;
  }
): void {
  const userModels = models.filter((m) => !isDemoCatalogModel(m));
  const uploadGate = modelUploadGate(
    workspace,
    userModels.length,
    handlers.storageBytesUsed ?? 0,
  );
  const list = userModels
    .map((m) => {
      const shareUrl = modelArUrl(workspace.slug, m.id);
      const iconUrl = modelIconUrl(m, workspace.slug);
      return `
      <li class="model-manage-card">
        <div class="model-manage-card-head">
          <img class="model-manage-thumb" src="${escapeHtml(iconUrl)}" alt="" width="56" height="56" loading="lazy" decoding="async" data-icon-fallback="${escapeHtml(MODEL_ICON_FALLBACK)}" />
          <div class="model-manage-card-meta">
            <h3 class="model-manage-name">${escapeHtml(m.name)}</h3>
            <p class="model-manage-id">${escapeHtml(m.id)}${m.usdz || m.usdzUrl ? ' · <span class="model-manage-badge">USDZ</span>' : ""}</p>
          </div>
        </div>
        <div class="model-manage-link-block">
          <p class="model-manage-link-label">Direct AR link</p>
          <code class="admin-code model-share-url">${escapeHtml(shareUrl)}</code>
          <div class="model-manage-toolbar" role="group" aria-label="Model actions for ${escapeHtml(m.name)}">
            <button type="button" class="btn btn-ghost btn-sm model-toolbar-btn" data-copy-url="${escapeHtml(shareUrl)}">Copy link</button>
            <button type="button" class="btn btn-ghost btn-sm model-toolbar-btn model-toolbar-btn-accent" data-open-url="${escapeHtml(shareUrl)}">Open AR</button>
            <button type="button" class="btn btn-ghost btn-sm model-toolbar-btn model-toolbar-btn-danger" data-delete="${escapeHtml(m.id)}">Delete</button>
          </div>
        </div>
        <details class="model-manage-exit-details">
          <summary>Back to catalog destination</summary>
          <p class="home-sub auth-hint">When a viewer taps <strong>Back to catalog</strong> on the Start AR page, open this URL. <strong>Exit AR</strong> returns to that Start AR page.</p>
          <div class="model-exit-row admin-share-row">
            <input type="text" class="field-input" data-model-exit-input="${escapeHtml(m.id)}" placeholder="https://shop.example.com/product/${escapeHtml(m.id)}" value="${escapeHtml(m.arExitUrl ?? "")}" />
            <button type="button" class="btn btn-ghost btn-sm" data-save-model-exit="${escapeHtml(m.id)}">Save</button>
          </div>
        </details>
      </li>`;
    })
    .join("");

  root.innerHTML = `
    <div class="admin-shell model-admin-shell">
      <div class="admin-shell-hero" style="background-image: url('${MKT_ASSETS.authWorkspace}')" aria-hidden="true">
        <div class="admin-shell-hero-overlay"></div>
      </div>
      <div class="admin-shell-body">
        <div class="admin-shell-card model-admin-card">
          ${brandedHeaderHtml("3D models", `${workspace.name} · ${tenantAdminApiHint(workspace.slug)}`)}

          <div class="admin-card admin-card-highlight model-admin-default-exit">
            <p class="admin-label">Default Back to catalog destination</p>
            <p class="home-sub auth-hint">Used when a model does not set its own product page below.</p>
            <form class="model-exit-url-form admin-share-row" id="ar-exit-url-form">
              <input type="text" name="arExitUrl" class="field-input" placeholder="https://yoursite.com/catalog or /w/${escapeHtml(workspace.slug)}" value="${escapeHtml(workspace.arExitUrl ?? "")}" />
              <button type="submit" class="btn btn-ghost btn-sm">Save default catalog URL</button>
            </form>
            <p class="upload-status" id="exit-url-status" aria-live="polite"></p>
          </div>

          <section class="admin-section model-upload-section">
            <div class="model-manage-section-head">
              <h2 class="admin-section-title">Upload model</h2>
              ${handlers.onHelp ? `<button type="button" class="btn btn-ghost btn-sm" data-action="help">Upload help</button>` : ""}
            </div>
            ${
              uploadGate.blocked
                ? `<div class="camera-warning model-upload-blocked" role="alert">
                    <p>${escapeHtml(uploadGate.message ?? "Upload limit reached.")}</p>
                    ${handlers.onUpgrade ? `<button type="button" class="btn btn-primary btn-block" data-action="upgrade">Upgrade on Account</button>` : ""}
                  </div>`
                : `<p class="home-sub auth-hint">${uploadGate.used} / ${uploadGate.limit} models on your plan.</p>`
            }
            <form class="model-upload-form model-upload-form-card${uploadGate.blocked ? " model-upload-form--disabled" : ""}" id="model-upload-form">
              <p class="home-sub auth-hint model-upload-size-note">${uploadSizeNoteHtml()}</p>
              <div class="model-upload-field">
                <label class="field-label">Name</label>
                <input type="text" name="name" class="field-input" placeholder="Bar chair" required maxlength="40" ${uploadGate.blocked ? "disabled" : ""} />
              </div>
              <div class="model-upload-field">
                <label class="field-label">Icon image</label>
                <input type="file" name="icon" class="field-input field-input--file" accept="image/png,image/jpeg,image/webp" required ${uploadGate.blocked ? "disabled" : ""} />
              </div>
              <div class="model-upload-field">
                <label class="field-label">3D model (.glb)</label>
                <input type="file" name="glb" class="field-input field-input--file" accept=".glb,model/gltf-binary" required ${uploadGate.blocked ? "disabled" : ""} />
              </div>
              <div class="model-upload-field">
                <label class="field-label">iOS AR model (.usdz) <span class="muted-id">optional — Safari Quick Look</span></label>
                <input type="file" name="usdz" class="field-input field-input--file" accept=".usdz,model/vnd.usdz+zip" ${uploadGate.blocked ? "disabled" : ""} />
                <p class="home-sub model-upload-field-hint">Auto-generate USDZ from GLB, or upload a Reality Converter USDZ for best iOS textures.</p>
              </div>
              <p class="upload-status camera-warning hidden" id="upload-size-warning" role="status" aria-live="polite"></p>
              <div class="upload-progress-wrap hidden" id="upload-progress-wrap">
                <div class="upload-progress-bar"><div class="upload-progress-fill" id="upload-progress-fill"></div></div>
                <p class="upload-progress-label" id="upload-progress-label">0%</p>
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="upload-submit-btn" ${uploadGate.blocked ? "disabled" : ""}>Upload model</button>
            </form>
            <p class="upload-status" id="upload-status" aria-live="polite"></p>
          </section>

          <section class="admin-section">
            <div class="model-manage-section-head">
              <h2 class="admin-section-title">Your models</h2>
              <span class="model-manage-count">${userModels.length} uploaded</span>
            </div>
            ${userModels.length ? `<ul class="model-manage-list">${list}</ul>` : "<p class='model-manage-empty'>No models yet — upload your first GLB above.</p>"}
          </section>

          <button type="button" class="btn btn-ghost btn-block" data-action="back">← Back to admin</button>
        </div>
      </div>
    </div>
  `;

  mountWorkspaceLogo(root, workspace.slug, workspace.branding);
  bindModelIconFallbacks(root);

  const statusEl = root.querySelector("#upload-status") as HTMLElement;
  const sizeWarningEl = root.querySelector("#upload-size-warning") as HTMLElement;
  const exitUrlStatus = root.querySelector("#exit-url-status") as HTMLElement;
  const progressWrap = root.querySelector("#upload-progress-wrap") as HTMLElement;
  const progressFill = root.querySelector("#upload-progress-fill") as HTMLElement;
  const progressLabel = root.querySelector("#upload-progress-label") as HTMLElement;
  const submitBtn = root.querySelector("#upload-submit-btn") as HTMLButtonElement;
  const form = root.querySelector("#model-upload-form") as HTMLFormElement;

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
    const glb = (form.elements.namedItem("glb") as HTMLInputElement).files?.[0];
    const icon = (form.elements.namedItem("icon") as HTMLInputElement).files?.[0];
    const usdz = (form.elements.namedItem("usdz") as HTMLInputElement).files?.[0] ?? null;
    if (!glb) {
      sizeWarningEl.classList.add("hidden");
      sizeWarningEl.textContent = "";
      return;
    }
    showSizeFeedback(
      checkModelUploadSizes({
        glb,
        icon: icon ?? null,
        usdz,
        willAutoConvertUsdz: !(usdz && usdz.size > 0),
      }),
    );
  };

  form.querySelector('input[name="glb"]')?.addEventListener("change", previewUploadSizes);
  form.querySelector('input[name="usdz"]')?.addEventListener("change", previewUploadSizes);
  form.querySelector('input[name="icon"]')?.addEventListener("change", previewUploadSizes);

  root.querySelector("#ar-exit-url-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const arExitUrl = (form.elements.namedItem("arExitUrl") as HTMLInputElement).value.trim();
    void (async () => {
      try {
        await handlers.onSaveArExitUrl(arExitUrl);
        exitUrlStatus.textContent = arExitUrl
          ? "Default Back to catalog URL saved."
          : "Default Back to catalog URL cleared.";
      } catch (err) {
        exitUrlStatus.textContent = err instanceof Error ? err.message : "Could not save exit URL";
      }
    })();
  });

  root.querySelectorAll("[data-save-model-exit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modelId = btn.getAttribute("data-save-model-exit");
      if (!modelId) return;
      const input = root.querySelector(`[data-model-exit-input="${CSS.escape(modelId)}"]`) as HTMLInputElement | null;
      const url = input?.value.trim() ?? "";
      void (async () => {
        try {
          await handlers.onSaveModelArExitUrl(modelId, url);
          statusEl.textContent = url
            ? `Back to catalog URL saved for “${modelId}”.`
            : `Back to catalog URL cleared for “${modelId}” — uses workspace default.`;
        } catch (err) {
          statusEl.textContent = err instanceof Error ? err.message : "Could not save model exit URL";
        }
      })();
    });
  });

  form.onsubmit = (e) => {
    e.preventDefault();
    if (uploadGate.blocked) return;
    void (async () => {
      const fd = new FormData(form);
      const name = String(fd.get("name") ?? "");
      const icon = fd.get("icon");
      const glb = fd.get("glb");
      const manualUsdz = fd.get("usdz");
      if (!(icon instanceof File) || !(glb instanceof File)) return;
      const sizeCheck = checkModelUploadSizes({
        glb,
        icon,
        usdz: manualUsdz instanceof File ? manualUsdz : null,
        willAutoConvertUsdz: !(manualUsdz instanceof File && manualUsdz.size > 0),
      });
      showSizeFeedback(sizeCheck);
      if (sizeCheck.blocked) return;
      const glbCheck = await validateGlbFile(glb);
      if (!glbCheck.ok) {
        statusEl.textContent = glbCheck.error;
        return;
      }
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
        onProgress(2, "Generating iOS USDZ from GLB…");
        const usdzResult = await convertGlbToUsdz(glb, (phase) => onProgress(8, phase));
        if (usdzResult.ok) {
          usdzFile = new File([usdzResult.blob], usdzFileFromGlbName(glb.name), {
            type: USDZ_MIME,
          });
          onProgress(10, `USDZ ready (${Math.round(usdzResult.byteLength / 1024)} KB)`);
        } else {
          onProgress(10, `USDZ failed: ${usdzResult.error}`);
          statusEl.textContent = `USDZ conversion failed: ${usdzResult.error}. Uploading GLB only — add a manual .usdz from Reality Converter for iOS.`;
        }
      }
      try {
        const result = await uploadModelToWorkspace(
          workspace.id,
          name,
          icon,
          glb,
          onProgress,
          usdzFile
        );
        if (result.ok) {
          statusEl.textContent = usdzFile
            ? `Saved “${name}” with USDZ for iOS Quick Look.`
            : `Saved “${name}” (GLB only).`;
          form.reset();
          handlers.onChanged();
        } else {
          statusEl.textContent = result.error ?? "Upload failed";
        }
      } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : "Upload failed";
      } finally {
        submitBtn.disabled = false;
      }
    })();
  };

  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=help]")?.addEventListener("click", () => handlers.onHelp?.());
  root.querySelector("[data-action=upgrade]")?.addEventListener("click", () => handlers.onUpgrade?.());
  root.querySelectorAll("[data-copy-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-copy-url");
      if (!url) return;
      markOnboardingStep(workspace.id, "share");
      void navigator.clipboard.writeText(url).then(() => {
        statusEl.textContent = "AR link copied to clipboard.";
      }).catch(() => {
        statusEl.textContent = url;
      });
    });
  });
  root.querySelectorAll("[data-open-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-open-url");
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
  root.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete");
      if (!id) return;
      void (async () => {
        if (!confirm(`Delete model “${id}”?`)) return;
        if (await deleteWorkspaceModel(workspace.id, id)) handlers.onChanged();
        else statusEl.textContent = "Delete failed";
      })();
    });
  });
}
