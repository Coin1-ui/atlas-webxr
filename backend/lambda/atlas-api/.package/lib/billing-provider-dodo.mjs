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

/** Known test hybrid usage products (meters). Mapped so webhooks still resolve during migration. */
const KNOWN_USAGE_HYBRID_PRODUCTS = Object.freeze({
  pdt_0Njk5Xz9AdIoBNmgRoIEK: "starter",
  pdt_0Njk5QMJ8uCwSvseuHeo0: "launch",
  pdt_0Njk5Y261cDq9TWLto4dR: "growth",
});

function productIdForTier(tier) {
  if (!["starter", "launch", "growth"].includes(tier)) {
    throw new Error("Dodo checkout tier is not self-service");
  }
  // Prefer usage-hybrid catalog when configured (session meters at renewal).
  const usage = process.env[`DODO_PRODUCT_${tier.toUpperCase()}_USAGE`]?.trim();
  if (usage) return usage;
  if (process.env.ATLAS_DODO_USAGE_HYBRID === "true") {
    const hybridId = Object.entries(KNOWN_USAGE_HYBRID_PRODUCTS).find(([, t]) => t === tier)?.[0];
    if (hybridId) return hybridId;
  }
  return requiredEnv(`DODO_PRODUCT_${tier.toUpperCase()}_MONTHLY`);
}

function tierForProductId(productId) {
  const id = String(productId || "");
  for (const tier of ["starter", "launch", "growth"]) {
    const monthly = process.env[`DODO_PRODUCT_${tier.toUpperCase()}_MONTHLY`]?.trim();
    const usage = process.env[`DODO_PRODUCT_${tier.toUpperCase()}_USAGE`]?.trim();
    if (monthly === id || usage === id) return tier;
  }
  if (KNOWN_USAGE_HYBRID_PRODUCTS[id]) return KNOWN_USAGE_HYBRID_PRODUCTS[id];
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
      // Do NOT set subscription_data.on_demand — Dodo rejects change-plan on
      // on-demand subs (ON_DEMAND_PLAN_CHANGE_NOT_SUPPORTED). Overage card charge
      // requires on_demand; without it Accept & pay stores status "accepted".
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

/**
 * Clears a pending next-billing-date plan change (Dodo DELETE …/change-plan/scheduled).
 * @param {string} subscriptionId
 * @param {{ ignoreMissing?: boolean }} [options] When true, 404 SCHEDULED_PLAN_CHANGE_NOT_FOUND is OK.
 */
export async function cancelDodoScheduledPlanChange(subscriptionId, options = {}) {
  try {
    await dodoRequest(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan/scheduled`,
      { method: "DELETE" },
    );
  } catch (error) {
    if (options.ignoreMissing === true) {
      const msg = error instanceof Error ? error.message : String(error ?? "");
      // dodoRequest maps HTTP 404 → statusCode 400; match message / code text.
      if (/no scheduled plan change|SCHEDULED_PLAN_CHANGE_NOT_FOUND/i.test(msg)) return;
      if (Number(error?.statusCode) === 404) return;
    }
    throw error;
  }
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

/**
 * Schedule or apply a plan change in Dodo.
 * - next_billing_date: Dodo requires `full_immediately` proration with this effective_at
 *   (not `do_not_bill` — API rejects that combo). Product switches at period end; Atlas
 *   keeps the old tier until webhooks show the new product_id.
 * - immediately: charge the price difference now and switch product right away.
 */
export async function changeDodoPlan(subscriptionId, tier, effectiveAt = "next_billing_date") {
  const scheduled = effectiveAt === "next_billing_date";
  await dodoRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, {
    method: "POST",
    body: {
      product_id: productIdForTier(tier),
      quantity: 1,
      // Dodo: "Only full_immediately proration mode is allowed with effective_at: next_billing_date"
      proration_billing_mode: scheduled ? "full_immediately" : "difference_immediately",
      effective_at: effectiveAt,
      on_payment_failure: "prevent_change",
    },
  });
}

/**
 * Ingest usage meter events (sessions / models / storage). Best-effort for billing.
 * @param {Array<{ event_id: string; customer_id: string; event_name: string; timestamp?: string; metadata?: Record<string, string|number|boolean> }>} events
 */
export async function ingestDodoUsageEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return { ingested_count: 0 };
  return dodoRequest("/events/ingest", {
    method: "POST",
    body: { events },
  });
}

export { KNOWN_USAGE_HYBRID_PRODUCTS };

/**
 * Charge usage overage against an on-demand-capable Dodo subscription.
 * @param {string} subscriptionId
 * @param {{ amountMinor: number; month: string; workspaceId: string; operationId: string }} input
 */
export async function createDodoOverageCharge(subscriptionId, input) {
  const result = await dodoRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/charge`,
    {
      method: "POST",
      headers: { "Idempotency-Key": String(input.operationId) },
      body: {
        product_price: input.amountMinor,
        product_currency: "USD",
        product_description: `Atlas usage overage ${input.month}`,
        metadata: {
          atlas_overage_month: input.month,
          atlas_workspace_id: input.workspaceId,
          atlas_billing_operation_id: input.operationId,
        },
      },
    }
  );
  if (!result?.payment_id) {
    throw new Error("Dodo Payments did not return a payment id for overage charge");
  }
  return { paymentId: String(result.payment_id) };
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
