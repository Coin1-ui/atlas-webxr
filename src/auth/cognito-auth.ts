import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { cognitoClientId, cognitoConfigured, cognitoUserPoolId } from "../config/cognito";
import { AuthUser, saveSession } from "./session";

function userPool(): CognitoUserPool {
  return new CognitoUserPool({
    UserPoolId: cognitoUserPoolId(),
    ClientId: cognitoClientId(),
  });
}

function sessionToUser(email: string, session: CognitoUserSession): AuthUser {
  const idToken = session.getIdToken().getJwtToken();
  const sub = session.getIdToken().payload.sub as string;
  return { sub, email, idToken };
}

export function isCognitoAuthEnabled(): boolean {
  return cognitoConfigured();
}

export async function signUp(email: string, password: string): Promise<{ needsVerification: boolean }> {
  if (!cognitoConfigured()) {
    throw new Error("Cognito is not configured for this build.");
  }
  const pool = userPool();
  return new Promise((resolve, reject) => {
    pool.signUp(
      email.trim().toLowerCase(),
      password,
      [new CognitoUserAttribute({ Name: "email", Value: email.trim().toLowerCase() })],
      [],
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ needsVerification: !result?.userConfirmed });
      }
    );
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code.trim(), true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Resend signup confirmation code (Cognito email provider — works in SES sandbox). */
export async function resendSignUpCode(email: string): Promise<void> {
  if (!cognitoConfigured()) {
    throw new Error("Cognito is not configured for this build.");
  }
  const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });
  return new Promise((resolve, reject) => {
    user.resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!cognitoConfigured()) {
    return devSignIn(email);
  }
  const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });
  const authDetails = new AuthenticationDetails({
    Username: email.trim().toLowerCase(),
    Password: password,
  });
  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const authUser = sessionToUser(email, session);
        saveSession(authUser);
        resolve(authUser);
      },
      onFailure: (err) => reject(err),
    });
  });
}

/** Local dev auth when Cognito env vars are absent. */
export async function devSignIn(email: string): Promise<AuthUser> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const sub = `dev-${normalized.replace(/[^a-z0-9]/g, "-")}`;
  const user: AuthUser = {
    sub,
    email: normalized,
    idToken: `dev:${sub}`,
    devToken: `dev:${sub}`,
  };
  saveSession(user);
  return user;
}

export async function devSignUp(email: string, _password: string): Promise<{ needsVerification: boolean }> {
  await devSignIn(email);
  return { needsVerification: false };
}

export function signOutLocal(): void {
  if (cognitoConfigured()) {
    const pool = userPool();
    pool.getCurrentUser()?.signOut();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!cognitoConfigured()) {
    throw new Error("Password reset requires Cognito.");
  }
  const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });
  return new Promise((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  if (!cognitoConfigured()) {
    throw new Error("Password reset requires Cognito.");
  }
  const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });
  return new Promise((resolve, reject) => {
    user.confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!cognitoConfigured()) {
    throw new Error("Dev mode: password is not stored server-side.");
  }
  const pool = userPool();
  const user = pool.getCurrentUser();
  if (!user) {
    throw new Error("Session expired. Sign in again.");
  }
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | undefined, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        reject(err ?? new Error("Session expired. Sign in again."));
        return;
      }
      user.changePassword(oldPassword, newPassword, (changeErr) => {
        if (changeErr) reject(changeErr);
        else resolve();
      });
    });
  });
}
