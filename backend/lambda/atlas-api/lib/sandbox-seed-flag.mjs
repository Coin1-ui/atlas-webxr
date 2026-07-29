/**
 * Feature flag: Cognito sandbox usage seed UI + API.
 * Accepts true/TRUE/1 with optional whitespace (Console paste quirks).
 * @param {string | undefined} raw
 */
export function isSandboxUsageSeedEnabled(raw = process.env.ATLAS_SANDBOX_USAGE_SEED) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Feature flag: Seed overage also ingests real Dodo meter events.
 * Requires ATLAS_SANDBOX_USAGE_SEED path; Clear does not reverse meters.
 * @param {string | undefined} raw
 */
export function isSandboxDodoIngestEnabled(raw = process.env.ATLAS_SANDBOX_DODO_INGEST) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Feature flag: Account "Clear test overage" / soft-clear tooling.
 * Default **off** (false) — must opt in with ATLAS_CLEAR_TEST_OVERAGE=true.
 * @param {string | undefined} raw
 */
export function isClearTestOverageEnabled(raw = process.env.ATLAS_CLEAR_TEST_OVERAGE) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
