import { authShellHtml, authShellLegalFooterHtml } from "./auth-shell";
import { beginAuthSubmitLoading } from "./nav-loading";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type AuthLegalHandlers = {
  onLegalTerms: () => void;
  onLegalPrivacy: () => void;
};

function bindAuthLegalLinks(root: HTMLElement, handlers: AuthLegalHandlers): void {
  root.querySelector("[data-action=legal-terms]")?.addEventListener("click", handlers.onLegalTerms);
  root.querySelector("[data-action=legal-privacy]")?.addEventListener("click", handlers.onLegalPrivacy);
}

const RESEND_COOLDOWN_MS = 60_000;

export function renderAuthSignup(
  root: HTMLElement,
  handlers: {
    cognitoEnabled: boolean;
    error?: string;
    info?: string;
    needsVerification?: boolean;
    prefillEmail?: string;
    subtitle?: string;
    onRegister: (email: string, password: string) => void | Promise<void>;
    onConfirm: (email: string, code: string) => void | Promise<void>;
    onResendCode?: (email: string) => void | Promise<void>;
    onSignIn: () => void;
    onBack: () => void;
    onLegalTerms: () => void;
    onLegalPrivacy: () => void;
  }
): void {
  if (handlers.needsVerification) {
    const body = `
      <header class="auth-card-header">
        <h1>Verify email</h1>
        <p class="auth-card-sub">Enter the code sent to your inbox. Check your spam or junk folder if it does not arrive within a few minutes.</p>
      </header>
      ${handlers.error ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>` : ""}
      ${handlers.info ? `<p class="auth-info" role="status">${escapeHtml(handlers.info)}</p>` : ""}
      <form class="auth-form" data-form="confirm">
        <label class="auth-label">Email<input class="auth-input" type="email" name="email" autocomplete="username" required placeholder="you@company.com" /></label>
        <label class="auth-label">Verification code<input class="auth-input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" required placeholder="123456" /></label>
        <button type="submit" class="a-btn a-btn--primary a-btn--block auth-submit">Confirm account</button>
      </form>
      <div class="auth-resend-row">
        <button type="button" class="a-btn a-btn--ghost a-btn--block auth-resend" data-action="resend-code">Resend verification code</button>
        <p class="auth-resend-hint" data-resend-hint aria-live="polite"></p>
      </div>
      <p class="auth-card-footer">
        <button type="button" class="auth-inline-link" data-action="signin">Back to sign in</button>
      </p>`;

    root.innerHTML = authShellHtml("verify", body, { legalFooter: authShellLegalFooterHtml() });
    bindAuthLegalLinks(root, handlers);
    const emailInput = root.querySelector<HTMLInputElement>('form[data-form="confirm"] [name="email"]');
    if (emailInput && handlers.prefillEmail) {
      emailInput.value = handlers.prefillEmail;
    }
    root.querySelector("[data-action=signin]")?.addEventListener("click", handlers.onSignIn);
    root.querySelector("[data-form=confirm]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const submitBtn = form.querySelector<HTMLElement>(".auth-submit");
      beginAuthSubmitLoading(submitBtn);
      const email = (form.elements.namedItem("email") as HTMLInputElement).value;
      const code = (form.elements.namedItem("code") as HTMLInputElement).value;
      void handlers.onConfirm(email, code);
    });

    const resendBtn = root.querySelector<HTMLButtonElement>("[data-action=resend-code]");
    const resendHint = root.querySelector<HTMLElement>("[data-resend-hint]");
    let cooldownTimer: number | undefined;
    const setCooldown = (until: number) => {
      const tick = () => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (!resendBtn) return;
        if (left <= 0) {
          resendBtn.disabled = false;
          resendBtn.textContent = "Resend verification code";
          if (cooldownTimer !== undefined) window.clearInterval(cooldownTimer);
          cooldownTimer = undefined;
          return;
        }
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend available in ${left}s`;
      };
      tick();
      if (cooldownTimer !== undefined) window.clearInterval(cooldownTimer);
      cooldownTimer = window.setInterval(tick, 500);
    };
    resendBtn?.addEventListener("click", () => {
      const email =
        emailInput?.value.trim() ||
        handlers.prefillEmail?.trim() ||
        "";
      if (!email) {
        if (resendHint) resendHint.textContent = "Enter your email above, then resend.";
        emailInput?.focus();
        return;
      }
      if (!handlers.onResendCode) return;
      resendBtn.disabled = true;
      if (resendHint) resendHint.textContent = "Sending…";
      void Promise.resolve(handlers.onResendCode(email))
        .then(() => {
          if (resendHint) resendHint.textContent = "";
          setCooldown(Date.now() + RESEND_COOLDOWN_MS);
        })
        .catch(() => {
          resendBtn.disabled = false;
          resendBtn.textContent = "Resend verification code";
        });
    });
    if (handlers.info?.toLowerCase().includes("code sent")) {
      setCooldown(Date.now() + RESEND_COOLDOWN_MS);
    }
    return;
  }

  const body = `
    <header class="auth-card-header">
      <h1>Create account</h1>
      <p class="auth-card-sub">${
        handlers.subtitle
          ? escapeHtml(handlers.subtitle)
          : "Starter from <strong>$5/mo incl. tax</strong> · 14-day Growth trial — subscribe before it ends to keep service"
      }</p>
    </header>
    ${handlers.error ? `<div class="camera-warning" role="alert">${escapeHtml(handlers.error)}</div>` : ""}
    ${
      handlers.cognitoEnabled
        ? ""
        : `<p class="auth-dev-hint">Dev mode: account is stored locally in this browser.</p>`
    }
    <form class="auth-form" data-form="signup">
      <label class="auth-label">Work email<input class="auth-input" type="email" name="email" autocomplete="username" required placeholder="you@store.com" /></label>
      <label class="auth-label">Password<input class="auth-input" type="password" name="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters" /></label>
      <label class="auth-legal-consent">
        <input type="checkbox" name="acceptTerms" required />
        <span>I agree to the <button type="button" class="auth-inline-link" data-action="legal-terms">Terms of Service</button> and <button type="button" class="auth-inline-link" data-action="legal-privacy">Privacy Policy</button>.</span>
      </label>
      <button type="submit" class="a-btn a-btn--primary a-btn--block auth-submit">Create account</button>
    </form>
    <p class="auth-card-footer">
      Already have an account?
      <button type="button" class="auth-inline-link" data-action="signin">Sign in</button>
    </p>`;

  root.innerHTML = authShellHtml("signup", body, {
    backLabel: "Back to home",
    backAction: "back",
    legalFooter: authShellLegalFooterHtml(),
  });

  bindAuthLegalLinks(root, handlers);
  root.querySelector("[data-action=signin]")?.addEventListener("click", handlers.onSignIn);
  root.querySelector("[data-action=back]")?.addEventListener("click", handlers.onBack);
  root.querySelector("[data-form=signup]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const submitBtn = form.querySelector<HTMLElement>(".auth-submit");
    beginAuthSubmitLoading(submitBtn);
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const termsBox = form.elements.namedItem("acceptTerms") as HTMLInputElement;
    if (!termsBox.checked) {
      termsBox.reportValidity();
      return;
    }
    void handlers.onRegister(email, password);
  });
}
