export type AuthUser = {
  sub: string;
  email: string;
  idToken: string;
  /** Dev-only bearer when Cognito is not configured. */
  devToken?: string;
};

const SESSION_KEY = "atlas-auth-session";

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed.sub || !parsed.idToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function authBearerToken(user: AuthUser | null): string | null {
  if (!user) return null;
  return user.devToken ? user.devToken : user.idToken;
}
