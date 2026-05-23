export function renderCameraError(
  root: HTMLElement,
  message: string,
  detail: string | undefined,
  onBack: () => void,
  onRetry?: () => void,
  onContinueWithoutCamera?: () => void
): void {
  root.innerHTML = `
    <div class="home camera-error">
      <h2>Camera not available</h2>
      <p class="camera-error-msg">${escapeHtml(message)}</p>
      ${
        detail
          ? `<p class="home-sub camera-error-detail">${escapeHtml(detail)}</p>`
          : ""
      }
      <div class="camera-error-actions">
        ${onRetry ? `<button type="button" class="btn btn-primary btn-block" data-action="retry">Try camera again</button>` : ""}
        ${
          onContinueWithoutCamera
            ? `<button type="button" class="btn btn-ghost btn-block" data-action="continue">Continue without camera (steps only)</button>`
            : ""
        }
        <button type="button" class="btn btn-ghost btn-block" data-action="back">Back to home</button>
      </div>
    </div>
  `;
  root.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest("[data-action]");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "retry" && onRetry) onRetry();
    if (btn.getAttribute("data-action") === "continue" && onContinueWithoutCamera) {
      onContinueWithoutCamera();
    }
    if (btn.getAttribute("data-action") === "back") onBack();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
