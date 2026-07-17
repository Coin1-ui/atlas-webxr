import { authShellHtml } from "./auth-shell";
import { beginAuthSubmitLoading } from "./nav-loading";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAuthLogin(
  root: HTMLElement,
  handlers: {
    cognitoEnabled: boolean;
    error?: string;
    subtitle?: string;
    onSubmit: (email: string, password: string) => void | Promise<void>;
    onForgotPassword?: () => void;
    onSignUp: () => void;
    onBack: () => void;
  }
): void {
  const body = `
    <header class="auth-card-header">
      <h1>Sign in</h1>
      <p class="auth-card-sub">${escapeHtml(handlers.subtitle ?? "Access your workspace admin")}</p>
    </header>
    ${
      handlers.error
        ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>`
        : ""
    }
    ${
      handlers.cognitoEnabled
        ? ""
        : `<p class="auth-dev-hint">Dev mode: Cognito not configured — any email/password creates a local session.</p>`
    }
    <form class="auth-form" data-form="login">
      <label class="auth-label">Email<input class="auth-input" type="email" name="email" autocomplete="username" required placeholder="you@company.com" /></label>
      <label class="auth-label">Password<input class="auth-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••" /></label>
      ${
        handlers.cognitoEnabled && handlers.onForgotPassword
          ? `<button type="button" class="btn-link auth-forgot" data-action="forgot">Forgot password?</button>`
          : ""
      }
      <button type="submit" class="mkt-btn mkt-btn-primary auth-submit">Sign in</button>
    </form>
    <p class="auth-card-footer">
      New to Atlas AR?
      <button type="button" class="auth-inline-link" data-action="signup">Create account</button>
    </p>`;

  root.innerHTML = authShellHtml("signin", body, { backLabel: "Back to home", backAction: "back" });

  root.querySelector("[data-action=signup]")?.addEventListener("click", handlers.onSignUp);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-action=forgot]")?.addEventListener("click", () => handlers.onForgotPassword?.());
  root.querySelector("[data-form=login]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const submitBtn = form.querySelector<HTMLElement>(".auth-submit");
    beginAuthSubmitLoading(submitBtn);
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    void handlers.onSubmit(email, password);
  });
}
