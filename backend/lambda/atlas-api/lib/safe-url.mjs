/**
 * SSRF-safe remote URL validation for server-side fetches (logo cache, etc.).
 */

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"]);

function isPrivateIp(host) {
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^127\./.test(host)) return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

/**
 * @param {string} raw
 * @returns {URL}
 */
export function assertSafeRemoteUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    const err = new Error("Invalid logo URL");
    err.statusCode = 400;
    throw err;
  }
  if (url.protocol !== "https:") {
    const err = new Error("Logo URL must use HTTPS");
    err.statusCode = 400;
    throw err;
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host) || host.endsWith(".local")) {
    const err = new Error("Logo URL host is not allowed");
    err.statusCode = 400;
    throw err;
  }
  return url;
}
