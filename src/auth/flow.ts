import {
  confirmSignUp,
  confirmPasswordReset,
  devSignUp,
  isCognitoAuthEnabled,
  requestPasswordReset,
  signIn,
  signOutLocal,
  signUp,
} from "./cognito-auth";
import { clearSession, loadSession } from "./session";
import { createWorkspace, deleteMyAccount, fetchMyWorkspaces } from "../data/workspace-api";
import type { Workspace } from "../shared/tenant";

export function getCurrentUser() {
  return loadSession();
}

export function logout(): void {
  signOutLocal();
  clearSession();
}

export async function login(email: string, password: string): Promise<void> {
  await signIn(email, password);
}

export function isUserNotConfirmedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "UserNotConfirmedException"
  );
}

export async function register(email: string, password: string): Promise<{ needsVerification: boolean }> {
  if (isCognitoAuthEnabled()) {
    return signUp(email, password);
  }
  return devSignUp(email, password);
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  await confirmSignUp(email, code);
}

export async function forgotPassword(email: string): Promise<void> {
  await requestPasswordReset(email);
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(email, code, newPassword);
}

export async function ensureWorkspaceAfterAuth(): Promise<"onboard" | Workspace> {
  const workspaces = await fetchMyWorkspaces();
  if (!workspaces.length) return "onboard";
  return workspaces[0]!;
}

export async function onboardWorkspace(
  name: string,
  slug: string,
  trialPlan?: "growth" | "launch",
): Promise<Workspace> {
  return createWorkspace(name, slug, trialPlan);
}

export async function deleteAccount(): Promise<void> {
  const session = loadSession();
  if (!session) {
    throw new Error("Not signed in.");
  }

  await deleteMyAccount();

  signOutLocal();
  clearSession();
}
