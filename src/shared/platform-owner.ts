/** Platform operator (Atlas AR owner) — not the same as workspace membership role "owner". */

export function platformOwnerEmails(): string[] {
  const raw = import.meta.env.VITE_PLATFORM_OWNER_EMAILS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformOwnerEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowed = platformOwnerEmails();
  if (!allowed.length) return false;
  return allowed.includes(email.trim().toLowerCase());
}
