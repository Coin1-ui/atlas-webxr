/** Platform operator emails (Atlas AR owner — not workspace role "owner"). */

export function platformOwnerEmails() {
  const raw = process.env.ATLAS_PLATFORM_OWNER_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {{ email?: string; sub?: string }} user
 */
export function devSubFromPlatformOwnerEmail(email) {
  return `dev-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

export function emailFromDevSub(sub) {
  if (!sub?.startsWith("dev-")) return undefined;
  for (const email of platformOwnerEmails()) {
    if (devSubFromPlatformOwnerEmail(email) === sub) return email;
  }
  return undefined;
}

export function isPlatformOwnerUser(user) {
  const allowed = platformOwnerEmails();
  if (!allowed.length || !user) return false;
  if (user.email && allowed.includes(user.email.trim().toLowerCase())) return true;
  if (user.sub?.startsWith("dev-")) {
    for (const email of allowed) {
      if (user.sub === devSubFromPlatformOwnerEmail(email)) return true;
    }
  }
  return false;
}
