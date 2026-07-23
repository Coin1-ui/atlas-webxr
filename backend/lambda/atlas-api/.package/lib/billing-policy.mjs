const TIER_ORDER = ["starter", "launch", "growth"];

/**
 * Route billing country → provider.
 * India (IN) uses Zoho only when ATLAS_ZOHO_CHECKOUT_ENABLED=true; otherwise Dodo (USD).
 */
export function providerForBillingCountry(country) {
  const code = String(country || "").toUpperCase();
  if (code === "IN" && process.env.ATLAS_ZOHO_CHECKOUT_ENABLED === "true") return "zoho";
  return "dodo";
}

export function billingCurrencyForProvider(provider) {
  if (provider === "dodo") return "USD";
  if (provider === "zoho") return "INR";
  throw new Error("Unsupported billing provider");
}

export function assertProviderPaymentCurrency(provider, currency) {
  const expected = billingCurrencyForProvider(provider);
  if (String(currency || "").toUpperCase() !== expected) {
    throw new Error(`${provider} payment currency must be ${expected}`);
  }
  return expected;
}

export function planChangeEffectiveAt(currentTier, targetTier) {
  const current = TIER_ORDER.indexOf(String(currentTier));
  const target = TIER_ORDER.indexOf(String(targetTier));
  if (current < 0 || target < 0 || current === target) {
    throw new Error("Plan change tiers are invalid or unchanged");
  }
  return "next_billing_date";
}
