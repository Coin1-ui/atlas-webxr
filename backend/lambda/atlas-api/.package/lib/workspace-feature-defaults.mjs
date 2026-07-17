/** @typedef {"starter" | "launch" | "growth" | "scale"} BillingTierId */

/**
 * @param {BillingTierId} tier
 */
export function sessionLogDownloadDefaultForTier(tier) {
  return tier === "growth" || tier === "scale";
}
