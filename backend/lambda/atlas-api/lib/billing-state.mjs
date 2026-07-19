const PROVIDERS = new Set(["dodo", "zoho"]);
const TIERS = new Set(["starter", "launch", "growth", "scale"]);
const STATUSES = new Set(["pending", "active", "past_due", "canceled", "expired"]);

function requiredString(value, field, maxLength = 200) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} is required and must be at most ${maxLength} characters`);
  }
  return normalized;
}

function optionalIso(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error(`${field} must be a canonical UTC ISO timestamp`);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(timestamp).toISOString();
}

function requiredIdentifier(value, field) {
  const normalized = requiredString(value, field);
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error(`${field} contains unsupported characters`);
  }
  return normalized;
}

/**
 * Provider adapters must emit this normalized state snapshot only after
 * verifying the provider webhook signature. providerSequence must be a
 * provider-defined monotonic subscription revision from an authoritative
 * subscription read, not an arrival counter or event-ID guess.
 * @param {Record<string, unknown>} input
 */
export function normalizeBillingEvent(input) {
  if (!input || typeof input !== "object") throw new Error("Billing event must be an object");

  const provider = requiredString(input.provider, "provider", 20).toLowerCase();
  if (!PROVIDERS.has(provider)) throw new Error("provider must be dodo or zoho");

  const tier = requiredString(input.tier, "tier", 20).toLowerCase();
  if (!TIERS.has(tier)) throw new Error("Invalid billing tier");

  const status = requiredString(input.status, "status", 30).toLowerCase();
  if (!STATUSES.has(status)) throw new Error("Invalid billing status");

  const occurredAt = optionalIso(input.occurredAt, "occurredAt");
  if (!occurredAt) throw new Error("occurredAt is required");
  const providerSequence = input.providerSequence;
  if (!Number.isSafeInteger(providerSequence) || providerSequence < 0) {
    throw new Error("providerSequence must be a non-negative safe integer");
  }

  const currentPeriodEnd = optionalIso(input.currentPeriodEnd, "currentPeriodEnd");
  const graceUntil = optionalIso(input.graceUntil, "graceUntil");
  const amountMinor =
    input.amountMinor == null || input.amountMinor === ""
      ? null
      : input.amountMinor;
  if (amountMinor != null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0)) {
    throw new Error("amountMinor must be a non-negative safe integer");
  }
  const currency =
    input.currency == null || input.currency === ""
      ? null
      : requiredString(input.currency, "currency", 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a three-letter ISO code");
  }
  if ((amountMinor == null) !== (currency == null)) {
    throw new Error("amountMinor and currency must be provided together");
  }

  return Object.freeze({
    provider,
    eventId: requiredIdentifier(input.eventId, "eventId"),
    eventType: requiredString(input.eventType, "eventType", 100),
    workspaceId: requiredIdentifier(input.workspaceId, "workspaceId"),
    providerSubscriptionId: requiredIdentifier(
      input.providerSubscriptionId,
      "providerSubscriptionId"
    ),
    providerCustomerId:
      input.providerCustomerId == null || input.providerCustomerId === ""
        ? null
        : requiredIdentifier(input.providerCustomerId, "providerCustomerId"),
    providerPaymentId:
      input.providerPaymentId == null || input.providerPaymentId === ""
        ? null
        : requiredIdentifier(input.providerPaymentId, "providerPaymentId"),
    tier,
    status,
    occurredAt,
    providerSequence,
    currentPeriodEnd,
    graceUntil,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd === true,
    amountMinor,
    currency,
  });
}

export function compareBillingEventOrder(left, right) {
  return Number(left.providerSequence) - Number(right.providerSequence);
}

/**
 * Provider event time is the primary order. A local counter is used only when
 * two different authoritative snapshots share the same provider timestamp.
 */
export function providerTimestampSequence(timestampMilliseconds, currentSequence = null) {
  if (!Number.isSafeInteger(timestampMilliseconds) || timestampMilliseconds < 0) {
    throw new Error("Provider timestamp must be a non-negative safe integer");
  }
  const base = timestampMilliseconds * 1000;
  if (!Number.isSafeInteger(base)) throw new Error("Provider timestamp is too large");
  if (
    Number.isSafeInteger(currentSequence) &&
    Math.floor(Number(currentSequence) / 1000) === timestampMilliseconds
  ) {
    return Number(currentSequence) + 1;
  }
  return base;
}

/**
 * Apply an already verified provider snapshot without allowing stale events to
 * regress state. Rebinding is allowed only after a terminal entitlement ends.
 * @param {Record<string, unknown> | null} current
 * @param {Record<string, unknown>} input
 */
export function applyBillingEvent(current, input) {
  const event = normalizeBillingEvent(input);
  if (current) {
    const sameSubscription =
      current.provider === event.provider &&
      current.providerSubscriptionId === event.providerSubscriptionId;
    if (!sameSubscription) {
      const terminal = ["canceled", "expired"].includes(String(current.status));
      const ended = billingEntitlementTier(current, event.occurredAt) === null;
      if (!terminal || !ended || !["pending", "active"].includes(event.status)) {
        throw new Error("Billing provider can change only after the prior subscription has ended");
      }
    }
    if (sameSubscription && compareBillingEventOrder(event, current) <= 0) {
      return { applied: false, reason: "stale", subscription: current, event };
    }
  }

  return {
    applied: true,
    reason: "applied",
    event,
    subscription: Object.freeze({
      workspaceId: event.workspaceId,
      provider: event.provider,
      providerSubscriptionId: event.providerSubscriptionId,
      providerCustomerId: event.providerCustomerId,
      tier: event.tier,
      status: event.status,
      currentPeriodEnd: event.currentPeriodEnd,
      graceUntil: event.graceUntil,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
      lastEventAt: event.occurredAt,
      lastEventId: event.eventId,
      providerSequence: event.providerSequence,
      updatedAt: event.occurredAt,
    }),
    previous: current,
  };
}

/**
 * Return the tier currently authorized by paid billing, or null.
 * Every paid entitlement is time-bounded; no provider event grants permanent access.
 * @param {Record<string, unknown> | null} subscription
 * @param {string} [at]
 */
export function billingEntitlementTier(subscription, at = new Date().toISOString()) {
  if (!subscription) return null;
  const now = Date.parse(at);
  if (Number.isNaN(now)) throw new Error("at must be an ISO timestamp");

  const status = String(subscription.status || "");
  const entitlementEnd =
    status === "past_due" ? subscription.graceUntil : subscription.currentPeriodEnd;
  if (!["active", "past_due", "canceled"].includes(status) || !entitlementEnd) return null;

  const end = Date.parse(String(entitlementEnd));
  if (Number.isNaN(end) || now >= end) return null;
  const tier = String(subscription.tier || "");
  return TIERS.has(tier) ? tier : null;
}
