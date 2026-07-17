import type { CustomModelRecord } from "../data/custom-model-store";

export function renderModelManager(
  root: HTMLElement,
  models: CustomModelRecord[],
  handlers: {
    onSave: (name: string, iconFile: File, glbFile: File) => void;
    onDelete: (id: string) => void;
    onBack: () => void;
  }
): void {
  const userModels = models.filter((m) => !m.builtinType && !m.id.startsWith("builtin-"));
  const list = userModels
    .map(
      (m) => `
      <li class="model-manage-row">
        <span>${escapeHtml(m.name)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-delete="${escapeHtml(m.id)}">Delete</button>
      </li>`
    )
    .join("");

  root.innerHTML = `
    <div class="ar-panel ar-panel-manage">
      <p class="ar-panel-title">Manage 3D models</p>
      <p class="ar-panel-hint">Upload a <strong>.glb</strong> file and a square <strong>icon</strong> (PNG/JPG).</p>
      <form class="model-upload-form" id="model-upload-form">
        <label class="field-label">Name</label>
        <input type="text" name="name" class="field-input" placeholder="Pump valve" required maxlength="40" />
        <label class="field-label">Icon image</label>
        <input type="file" name="icon" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
        <label class="field-label">3D model (.glb)</label>
        <input type="file" name="glb" accept=".glb,model/gltf-binary" required />
        <button type="submit" class="btn btn-primary btn-block">Upload model</button>
      </form>
      ${userModels.length ? `<ul class="model-manage-list">${list}</ul>` : ""}
      <button type="button" class="btn btn-ghost btn-block" data-action="back">Back to models</button>
    </div>
  `;

  const form = root.querySelector("#model-upload-form") as HTMLFormElement;
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "");
    const icon = fd.get("icon");
    const glb = fd.get("glb");
    if (!(icon instanceof File) || !(glb instanceof File)) return;
    handlers.onSave(name, icon, glb);
    form.reset();
  };

  root.onclick = (e) => {
    const del = (e.target as HTMLElement).closest("[data-delete]");
    if (del) {
      const id = del.getAttribute("data-delete");
      if (id && confirm("Delete this model?")) handlers.onDelete(id);
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
