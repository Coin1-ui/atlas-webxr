import { escapeHtml } from "../shared/escape-html";
import { MKT_ASSETS } from "./marketing-assets";

export type AuthShellVariant = "signin" | "signup" | "verify" | "onboard" | "forgot" | "reset";

const VARIANT_COPY: Record<
  AuthShellVariant,
  { title: string; subtitle: string; image: string; perks?: string[] }
> = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to manage models, branding, and your customer AR link.",
    image: MKT_ASSETS.authHero,
    perks: ["Browser-based floor AR", "No app install for shoppers", "Unlimited field reps"],
  },
  signup: {
    title: "Start placing furniture in AR",
    subtitle: "Create your workspace in minutes — 14-day Growth trial, then subscribe to Starter ($5/mo) to stay live.",
    image: MKT_ASSETS.authHero,
    perks: ["14-day Growth trial · no card", "Subscribe before trial ends to keep your showroom", "Share /w/your-brand link"],
  },
  verify: {
    title: "Check your inbox",
    subtitle: "Enter the verification code we sent to activate your account.",
    image: MKT_ASSETS.authHero,
  },
  onboard: {
    title: "Name your showroom",
    subtitle: "Pick a brand name and URL slug — your customer link goes live instantly.",
    image: MKT_ASSETS.authWorkspace,
    perks: ["Branded customer catalog", "Floor placement on phone", "Session analytics in admin"],
  },
  forgot: {
    title: "Reset password",
    subtitle: "We will email you a verification code to choose a new password.",
    image: MKT_ASSETS.authHero,
  },
  reset: {
    title: "Choose a new password",
    subtitle: "Enter the code from your email and set a secure password.",
    image: MKT_ASSETS.authHero,
  },
};

/** Footer legal links for auth panels (matches marketing footer). */
export function authShellLegalFooterHtml(): string {
  return `
        <nav class="auth-shell-legal" aria-label="Legal">
          <button type="button" class="auth-inline-link" data-action="legal-terms">Terms</button>
          <span aria-hidden="true">·</span>
          <button type="button" class="auth-inline-link" data-action="legal-privacy">Privacy</button>
        </nav>`;
}

/** Split-panel auth layout matching marketing visual system. */
export function authShellHtml(
  variant: AuthShellVariant,
  bodyHtml: string,
  options?: { backLabel?: string; backAction?: string; legalFooter?: string }
): string {
  const copy = VARIANT_COPY[variant];
  const perks =
    copy.perks?.length ?
      `<ul class="auth-shell-perks" aria-label="Highlights">
        ${copy.perks.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
      </ul>`
    : "";

  const back =
    options?.backLabel ?
      `<button type="button" class="auth-shell-back" data-action="${escapeHtml(options.backAction ?? "back")}">← ${escapeHtml(options.backLabel)}</button>`
    : "";

  return `
    <div class="auth-shell">
      <div class="auth-shell-visual" aria-hidden="true">
        <div class="auth-shell-visual-bg" style="background-image: url('${copy.image}')"></div>
        <div class="auth-shell-visual-overlay"></div>
        <div class="auth-shell-visual-content">
          <p class="auth-shell-brand">Atlas <span>AR</span></p>
          <h2 class="auth-shell-visual-title">${escapeHtml(copy.title)}</h2>
          <p class="auth-shell-visual-sub">${escapeHtml(copy.subtitle)}</p>
          ${perks}
        </div>
      </div>
      <div class="auth-shell-panel">
        ${back}
        <div class="auth-shell-card">
          ${bodyHtml}
        </div>
        ${options?.legalFooter ?? ""}
      </div>
    </div>`;
}
