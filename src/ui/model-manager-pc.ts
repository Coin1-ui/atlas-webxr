import type { CatalogModel } from "../data/model-catalog";
import { uploadModelToServer, deleteModelOnServer } from "../data/model-admin-api";

export function renderPcModelManager(
  root: HTMLElement,
  models: CatalogModel[],
  handlers: { onBack: () => void; onChanged: () => void }
): void {
  const userModels = models.filter((m) => !m.id.startsWith("builtin-"));
  const list = userModels
    .map(
      (m) => `
      <li class="model-manage-row">
        <span>${escapeHtml(m.name)} <small class="muted-id">${escapeHtml(m.id)}</small></span>
        <button type="button" class="btn btn-ghost btn-sm" data-delete="${escapeHtml(m.id)}">Delete</button>
      </li>`
    )
    .join("");

  root.innerHTML = `
    <div class="home model-admin-pc">
      <header class="home-header">
        <h1>Manage 3D models (PC)</h1>
        <p class="home-sub">Upload here on your computer. Your phone loads models from this dev server over Wi‑Fi — run <code>npm run dev:phone</code> and open the same URL on both devices.</p>
      </header>
      <form class="model-upload-form" id="model-upload-form">
        <label class="field-label">Name</label>
        <input type="text" name="name" class="field-input" placeholder="Pump valve" required maxlength="40" />
        <label class="field-label">Icon image</label>
        <input type="file" name="icon" accept="image/png,image/jpeg,image/webp" required />
        <label class="field-label">3D model (.glb)</label>
        <input type="file" name="glb" accept=".glb,model/gltf-binary" required />
        <button type="submit" class="btn btn-primary btn-block">Upload to server</button>
      </form>
      <p class="upload-status" id="upload-status" aria-live="polite"></p>
      ${userModels.length ? `<ul class="model-manage-list">${list}</ul>` : "<p class='home-sub'>No custom models yet.</p>"}
      <button type="button" class="btn btn-ghost btn-block" data-action="back">Back to home</button>
    </div>
  `;

  const statusEl = root.querySelector("#upload-status") as HTMLElement;
  const form = root.querySelector("#model-upload-form") as HTMLFormElement;
  form.onsubmit = (e) => {
    e.preventDefault();
    void (async () => {
      const fd = new FormData(form);
      const name = String(fd.get("name") ?? "");
      const icon = fd.get("icon");
      const glb = fd.get("glb");
      if (!(icon instanceof File) || !(glb instanceof File)) return;
      statusEl.textContent = "Uploading…";
      const result = await uploadModelToServer(name, icon, glb);
      if (result.ok) {
        statusEl.textContent = `Saved “${name}”. Open Start AR on your phone to use it.`;
        form.reset();
        handlers.onChanged();
      } else {
        statusEl.textContent = result.error ?? "Upload failed";
      }
    })();
  };

  root.onclick = (e) => {
    const del = (e.target as HTMLElement).closest("[data-delete]");
    if (del) {
      const id = del.getAttribute("data-delete");
      if (id && confirm("Delete this model from the server?")) {
        void (async () => {
          await deleteModelOnServer(id);
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
