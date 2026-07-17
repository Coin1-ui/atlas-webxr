import { authShellHtml } from "./auth-shell";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAuthForgotPassword(
  root: HTMLElement,
  handlers: {
    cognitoEnabled: boolean;
    error?: string;
    info?: string;
    needsCode?: boolean;
    onRequestCode: (email: string) => void | Promise<void>;
    onConfirm: (email: string, code: string, password: string) => void | Promise<void>;
    onSignIn: () => void;
    onBack: () => void;
  }
): void {
  if (!handlers.cognitoEnabled) {
    const body = `
      <header class="auth-card-header">
        <h1>Reset password</h1>
        <p class="auth-card-sub">Password reset requires Cognito (production build).</p>
      </header>
      <button type="button" class="mkt-btn mkt-btn-ghost auth-submit" data-action="signin">Back to sign in</button>`;
    root.innerHTML = authShellHtml("forgot", body);
    root.querySelector("[data-action=signin]")?.addEventListener("click", handlers.onSignIn);
    return;
  }

  if (handlers.needsCode) {
    const body = `
      <header class="auth-card-header">
        <h1>Set new password</h1>
        <p class="auth-card-sub">Enter the code from your email</p>
      </header>
      ${handlers.error ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>` : ""}
      ${handlers.info ? `<div class="camera-success" role="status">${escapeHtml(handlers.info)}</div>` : ""}
      <form class="auth-form" data-form="confirm">
        <label class="auth-label">Email<input class="auth-input" type="email" name="email" autocomplete="username" required /></label>
        <label class="auth-label">Verification code<input class="auth-input" type="text" name="code" inputmode="numeric" required /></label>
        <label class="auth-label">New password<input class="auth-input" type="password" name="password" autocomplete="new-password" minlength="8" required /></label>
        <button type="submit" class="mkt-btn mkt-btn-primary auth-submit">Update password</button>
      </form>
      <p class="auth-card-footer">
        <button type="button" class="auth-inline-link" data-action="signin">Back to sign in</button>
      </p>`;
    root.innerHTML = authShellHtml("reset", body);
    root.querySelector("[data-action=signin]")?.addEventListener("click", handlers.onSignIn);
    root.querySelector("[data-form=confirm]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const email = (form.elements.namedItem("email") as HTMLInputElement).value;
      const code = (form.elements.namedItem("code") as HTMLInputElement).value;
      const password = (form.elements.namedItem("password") as HTMLInputElement).value;
      void handlers.onConfirm(email, code, password);
    });
    return;
  }

  const body = `
    <header class="auth-card-header">
      <h1>Reset password</h1>
      <p class="auth-card-sub">We will email you a verification code</p>
    </header>
    ${handlers.error ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>` : ""}
    ${handlers.info ? `<div class="camera-success" role="status">${escapeHtml(handlers.info)}</div>` : ""}
    <form class="auth-form" data-form="request">
      <label class="auth-label">Email<input class="auth-input" type="email" name="email" autocomplete="username" required placeholder="you@company.com" /></label>
      <button type="submit" class="mkt-btn mkt-btn-primary auth-submit">Send reset code</button>
    </form>
    <p class="auth-card-footer">
      <button type="button" class="auth-inline-link" data-action="signin">Back to sign in</button>
    </p>`;

  root.innerHTML = authShellHtml("forgot", body, { backLabel: "Back", backAction: "back" });

  root.querySelector("[data-action=signin]")?.addEventListener("click", handlers.onSignIn);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-form=request]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    void handlers.onRequestCode(email);
  });
}
