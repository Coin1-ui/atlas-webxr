import { Webhook } from "standardwebhooks";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function dodoBaseUrl() {
  const environment = requiredEnv("DODO_PAYMENTS_ENV");
  if (environment === "test_mode") return "https://test.dodopayments.com";
  if (environment === "live_mode") return "https://live.dodopayments.com";
  throw new Error("DODO_PAYMENTS_ENV must be test_mode or live_mode");
}

function atlasBillingUrl(name) {
  const url = new URL(requiredEnv(name));
  const appOrigin = new URL(requiredEnv("ATLAS_BILLING_APP_ORIGIN"));
  if (url.protocol !== "https:" || appOrigin.protocol !== "https:" || url.origin !== appOrigin.origin) {
    throw new Error(`${name} must use the configured Atlas billing app origin`);
  }
  return url.toString();
}

function productIdForTier(tier) {
  const variable = {
    starter: "DODO_PRODUCT_STARTER_MONTHLY",
    launch: "DODO_PRODUCT_LAUNCH_MONTHLY",
    growth: "DODO_PRODUCT_GROWTH_MONTHLY",
  }[tier];
  if (!variable) throw new Error("Dodo checkout tier is not self-service");
  return requiredEnv(variable);
}

function tierForProductId(productId) {
  for (const tier of ["starter", "launch", "growth"]) {
    if (process.env[`DODO_PRODUCT_${tier.toUpperCase()}_MONTHLY`]?.trim() === productId) {
      return tier;
    }
  }
  throw new Error("Dodo product is not mapped to an Atlas tier");
}

async function dodoRequest(path, options = {}) {
  const response = await fetch(`${dodoBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${requiredEnv("DODO_PAYMENTS_API_KEY")}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const text = await response.text();
    let detail = "Dodo Payments request failed";
    try {
      const parsed = text ? JSON.parse(text) : null;
      const message =
        typeof parsed?.message === "string"
          ? parsed.message
          : typeof parsed?.error === "string"
            ? parsed.error
            : typeof parsed?.detail === "string"
              ? parsed.detail
              : null;
      if (message) detail = message;
    } catch {
      if (text.trim()) detail = text.trim().slice(0, 240);
    }
    throw Object.assign(new Error(detail), {
      statusCode: response.status >= 500 ? 502 : 400,
    });
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function optionalAddress(input) {
  const address = { country: String(input.billingCountry).toUpperCase() };
  for (const field of ["city", "state", "street", "zipcode"]) {
    if (typeof input[field] === "string" && input[field].trim()) {
      address[field] = input[field].trim();
    }
  }
  return address;
}

export function preflightDodoCheckout(tier) {
  dodoBaseUrl();
  requiredEnv("DODO_PAYMENTS_API_KEY");
  productIdForTier(tier);
  atlasBillingUrl("ATLAS_BILLING_RETURN_URL");
  atlasBillingUrl("ATLAS_BILLING_CANCEL_URL");
}

export async function createDodoCheckout(operation, input) {
  const result = await dodoRequest("/checkouts", {
    method: "POST",
    headers: { "Idempotency-Key": String(operation.operationId) },
    body: {
      product_cart: [{ product_id: productIdForTier(operation.tier), quantity: 1 }],
      customer: {
        email: String(input.email).trim().toLowerCase(),
        ...(input.name ? { name: String(input.name).trim() } : {}),
      },
      billing_address: optionalAddress({
        ...input.billingAddress,
        billingCountry: operation.billingCountry,
      }),
      return_url: atlasBillingUrl("ATLAS_BILLING_RETURN_URL"),
      cancel_url: atlasBillingUrl("ATLAS_BILLING_CANCEL_URL"),
      metadata: {
        atlas_billing_operation_id: operation.operationId,
      },
      ...(operation.couponCode ? { discount_codes: [operation.couponCode] } : {}),
    },
  });
  if (!result?.session_id || !result?.checkout_url) {
    throw new Error("Dodo Payments did not return a hosted checkout URL");
  }
  return {
    providerCheckoutId: String(result.session_id),
    checkoutUrl: String(result.checkout_url),
  };
}

export async function getDodoSubscription(subscriptionId) {
  return dodoRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function createDodoPortalSession(customerId) {
  const params = new URLSearchParams({
    return_url: atlasBillingUrl("ATLAS_BILLING_RETURN_URL"),
  });
  const result = await dodoRequest(
    `/customers/${encodeURIComponent(customerId)}/customer-portal/session?${params}`,
    { method: "POST" }
  );
  if (!result?.link) throw new Error("Dodo Payments did not return a portal link");
  const portalUrl = new URL(String(result.link));
  const host = portalUrl.hostname.toLowerCase();
  if (
    portalUrl.protocol !== "https:" ||
    !(host === "dodopayments.com" || host.endsWith(".dodopayments.com"))
  ) {
    throw new Error("Dodo Payments returned a non-allowlisted portal link");
  }
  return { portalUrl: portalUrl.toString() };
}

export async function cancelDodoSubscription(subscriptionId) {
  await dodoRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    body: { cancel_at_next_billing_date: true },
  });
}

/** Clears a pending next-billing-date plan change (Dodo DELETE …/change-plan/scheduled). */
export async function cancelDodoScheduledPlanChange(subscriptionId) {
  await dodoRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan/scheduled`,
    { method: "DELETE" },
  );
}

/**
 * @param {unknown} subscription Dodo subscription payload
 * @returns {{ tier: string; productId: string; effectiveAt: string | null } | null}
 */
export function scheduledPlanChangeFromDodoSubscription(subscription) {
  const change = subscription && typeof subscription === "object" ? subscription.scheduled_change : null;
  if (!change || typeof change !== "object") return null;
  const productId = typeof change.product_id === "string" ? change.product_id : "";
  if (!productId) return null;
  let tier = null;
  try {
    tier = tierForProductId(productId);
  } catch {
    return null;
  }
  return {
    tier,
    productId,
    effectiveAt:
      typeof change.effective_at === "string"
        ? change.effective_at
        : typeof change.scheduled_at === "string"
          ? change.scheduled_at
          : null,
  };
}

export async function changeDodoPlan(subscriptionId, tier, effectiveAt = "next_billing_date") {
  await dodoRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, {
    method: "POST",
    body: {
      product_id: productIdForTier(tier),
      quantity: 1,
      proration_billing_mode:
        effectiveAt === "immediately" ? "difference_immediately" : "full_immediately",
      effective_at: effectiveAt,
      on_payment_failure: "prevent_change",
    },
  });
}

export async function createDodoRefund(paymentId, amountMinor, reason, operationId) {
  return dodoRequest("/refunds", {
    method: "POST",
    headers: { "Idempotency-Key": String(operationId) },
    body: {
      payment_id: String(paymentId),
      amount: amountMinor,
      reason: String(reason || "Approved Atlas refund").slice(0, 3000),
      metadata: {
        atlas_billing_operation_id: String(operationId),
      },
    },
  });
}

/**
 * List Dodo discount codes (paginated).
 * @param {{ pageSize?: number; cursor?: string | null }} [opts]
 */
export async function listDodoDiscounts(opts = {}) {
  const params = new URLSearchParams({ page_size: String(opts.pageSize ?? 100) });
  if (opts.cursor) params.set("cursor", opts.cursor);
  return dodoRequest(`/discounts?${params}`);
}

/**
 * Find a Dodo discount by uppercase coupon code.
 * @param {string} code
 */
export async function findDodoDiscountByCode(code) {
  const target = String(code || "")
    .trim()
    .toUpperCase();
  if (!target) return null;
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await listDodoDiscounts({ cursor });
    const items = Array.isArray(result?.items) ? result.items : [];
    const match = items.find((row) => String(row.code || "").toUpperCase() === target);
    if (match) return match;
    cursor = result?.next_page_token ?? result?.next_cursor ?? result?.cursor ?? null;
    if (!cursor) break;
  }
  return null;
}

export async function createDodoDiscount(input) {
  return dodoRequest("/discounts", {
    method: "POST",
    body: input,
  });
}

export function verifyDodoWebhook(rawBody, headers) {
  const webhook = new Webhook(requiredEnv("DODO_PAYMENTS_WEBHOOK_SECRET"));
  return webhook.verify(rawBody, {
    "webhook-id": headers?.["webhook-id"] || headers?.["Webhook-Id"],
    "webhook-signature": headers?.["webhook-signature"] || headers?.["Webhook-Signature"],
    "webhook-timestamp": headers?.["webhook-timestamp"] || headers?.["Webhook-Timestamp"],
  });
}

export function normalizeDodoSubscriptionSnapshot(input) {
  const subscription = input.subscription;
  const status = String(subscription?.status || "");
  const normalizedStatus = {
    pending: "pending",
    active: "active",
    on_hold: "past_due",
    cancelled: "expired",
    failed: "expired",
    expired: "expired",
  }[status];
  if (!normalizedStatus) throw new Error("Unsupported Dodo subscription status");
  const providerPeriodEnd =
    subscription.next_billing_date || subscription.expires_at || subscription.cancelled_at || null;
  const periodEnd = providerPeriodEnd
    ? new Date(String(providerPeriodEnd)).toISOString()
    : null;
  const occurredAt = new Date(input.occurredAt).toISOString();
  const graceUntil =
    normalizedStatus === "past_due"
      ? new Date(Date.parse(occurredAt) + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  return {
    provider: "dodo",
    eventId: input.eventId,
    eventType: input.eventType,
    providerSubscriptionId: String(subscription.subscription_id),
    providerCustomerId: subscription.customer?.customer_id
      ? String(subscription.customer.customer_id)
      : undefined,
    providerPaymentId: input.providerPaymentId || undefined,
    checkoutOperationId: subscription.metadata?.atlas_billing_operation_id
      ? String(subscription.metadata.atlas_billing_operation_id)
      : undefined,
    tier: tierForProductId(String(subscription.product_id)),
    status: normalizedStatus,
    occurredAt,
    providerSequence: input.providerSequence,
    currentPeriodEnd: ["active", "past_due"].includes(normalizedStatus) ? periodEnd : null,
    graceUntil,
    cancelAtPeriodEnd:
      ["active", "past_due"].includes(normalizedStatus) &&
      subscription.cancel_at_next_billing_date === true,
    amountMinor: input.amountMinor ?? null,
    currency: input.currency ?? null,
  };
}
