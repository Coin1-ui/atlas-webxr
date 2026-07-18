import { createHmac, timingSafeEqual } from "node:crypto";

let tokenCache = { accessToken: "", expiresAt: 0 };

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function atlasBillingReturnUrl() {
  const url = new URL(requiredEnv("ATLAS_BILLING_RETURN_URL"));
  const appOrigin = new URL(requiredEnv("ATLAS_BILLING_APP_ORIGIN"));
  if (url.protocol !== "https:" || appOrigin.protocol !== "https:" || url.origin !== appOrigin.origin) {
    throw new Error("ATLAS_BILLING_RETURN_URL must use the configured Atlas billing app origin");
  }
  return url.toString();
}

function planCodeForTier(tier) {
  const variable = {
    starter: "ZOHO_PLAN_STARTER_MONTHLY",
    launch: "ZOHO_PLAN_LAUNCH_MONTHLY",
    growth: "ZOHO_PLAN_GROWTH_MONTHLY",
  }[tier];
  if (!variable) throw new Error("Zoho checkout tier is not self-service");
  return requiredEnv(variable);
}

function tierForPlanCode(planCode) {
  for (const tier of ["starter", "launch", "growth"]) {
    if (process.env[`ZOHO_PLAN_${tier.toUpperCase()}_MONTHLY`]?.trim() === planCode) {
      return tier;
    }
  }
  throw new Error("Zoho plan is not mapped to an Atlas tier");
}

async function zohoAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: requiredEnv("ZOHO_CLIENT_ID"),
    client_secret: requiredEnv("ZOHO_CLIENT_SECRET"),
    refresh_token: requiredEnv("ZOHO_REFRESH_TOKEN"),
  });
  const response = await fetch("https://accounts.zoho.in/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Zoho OAuth refresh failed");
  const result = await response.json();
  if (!result?.access_token) throw new Error("Zoho OAuth did not return an access token");
  tokenCache = {
    accessToken: String(result.access_token),
    expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
  };
  return tokenCache.accessToken;
}

async function zohoBillingRequest(path, options = {}) {
  const response = await fetch(`https://www.zohoapis.in/billing/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${await zohoAccessToken()}`,
      "Content-Type": "application/json",
      "X-com-zoho-subscriptions-organizationid": requiredEnv(
        "ZOHO_BILLING_ORGANIZATION_ID"
      ),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || (result?.code != null && Number(result.code) !== 0)) {
    throw Object.assign(new Error("Zoho Billing request failed"), {
      statusCode: response.status >= 500 ? 502 : 400,
    });
  }
  return result;
}

export async function preflightZohoCheckout(tier) {
  requiredEnv("ZOHO_BILLING_ORGANIZATION_ID");
  planCodeForTier(tier);
  atlasBillingReturnUrl();
  await zohoAccessToken();
}

export async function createZohoHostedCheckout(operation, input) {
  const customer = input.customerId
    ? undefined
    : {
        display_name: String(input.name || input.email).trim(),
        email: String(input.email).trim().toLowerCase(),
        billing_address: {
          country: "India",
          ...(input.billingAddress || {}),
        },
        ...(input.gstNo ? { gst_no: String(input.gstNo).trim().toUpperCase() } : {}),
        ...(input.gstTreatment ? { gst_treatment: String(input.gstTreatment) } : {}),
        ...(input.placeOfSupply
          ? { place_of_supply: String(input.placeOfSupply).trim().toUpperCase() }
          : {}),
      };
  const result = await zohoBillingRequest("/hostedpages/newsubscription", {
    method: "POST",
    body: {
      ...(input.customerId ? { customer_id: String(input.customerId) } : { customer }),
      plan: { plan_code: planCodeForTier(operation.tier), quantity: 1 },
      reference_id: operation.operationId,
      custom_fields: [{ label: "Atlas Billing Operation ID", value: operation.operationId }],
      redirect_url: atlasBillingReturnUrl(),
      ...(operation.couponCode ? { coupon_code: operation.couponCode } : {}),
    },
  });
  const hostedPage = result?.hostedpage;
  if (!hostedPage?.hostedpage_id || !hostedPage?.url) {
    throw new Error("Zoho Billing did not return a hosted checkout URL");
  }
  return {
    providerCheckoutId: String(hostedPage.hostedpage_id),
    checkoutUrl: String(hostedPage.url),
  };
}

export async function getZohoHostedPage(hostedPageId) {
  return zohoBillingRequest(`/hostedpages/${encodeURIComponent(hostedPageId)}`);
}

export async function getZohoSubscription(subscriptionId) {
  const result = await zohoBillingRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return result?.subscription || result;
}

export async function cancelZohoSubscription(subscriptionId) {
  await zohoBillingRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel?cancel_at_end=true`,
    { method: "POST" }
  );
}

export async function changeZohoPlan(subscriptionId, tier, endOfTerm = true) {
  await zohoBillingRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PUT",
    body: {
      plan: { plan_code: planCodeForTier(tier), quantity: 1 },
      end_of_term: endOfTerm,
    },
  });
}

function equalDigest(actual, expected) {
  const left = Buffer.from(String(actual));
  const right = Buffer.from(String(expected));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyZohoPaymentsWebhook(rawBody, signatureHeader, nowMilliseconds = Date.now()) {
  const match = /^t=(\d+),v=([A-Fa-f0-9]+)$/.exec(String(signatureHeader || ""));
  if (!match) throw new Error("Invalid Zoho Payments webhook signature header");
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMilliseconds - timestamp) > 300_000) {
    throw new Error("Zoho Payments webhook timestamp is outside tolerance");
  }
  const expected = createHmac("sha256", requiredEnv("ZOHO_PAYMENTS_WEBHOOK_SECRET"))
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  if (!equalDigest(match[2].toLowerCase(), expected)) {
    throw new Error("Invalid Zoho Payments webhook signature");
  }
}

function zohoBillingDate(value) {
  if (!value) return null;
  const text = String(value);
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T00:00:00+05:30`)
    : Date.parse(text);
  if (Number.isNaN(timestamp)) throw new Error("Zoho Billing returned an invalid date");
  return new Date(timestamp).toISOString();
}

export function normalizeZohoSubscriptionSnapshot(input) {
  const subscription = input.subscription;
  const status = String(subscription?.status || "").toLowerCase();
  const normalizedStatus = {
    live: "active",
    active: "active",
    trial: "active",
    future: "pending",
    non_renewing: "canceled",
    dunning: "past_due",
    unpaid: "past_due",
    paused: "past_due",
    cancelled: "expired",
    canceled: "expired",
    expired: "expired",
    creation_failed: "expired",
    cancelled_from_dunning: "expired",
    trial_expired: "expired",
  }[status];
  if (!normalizedStatus) throw new Error("Unsupported Zoho subscription status");
  const occurredAt = new Date(input.occurredAt).toISOString();
  const periodEnd = zohoBillingDate(
    subscription.current_term_ends_at || subscription.next_billing_at || null
  );
  const graceUntil =
    normalizedStatus === "past_due"
      ? new Date(Date.parse(occurredAt) + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const operationField = Array.isArray(subscription.custom_fields)
    ? subscription.custom_fields.find((field) => field.label === "Atlas Billing Operation ID")
    : null;
  return {
    provider: "zoho",
    eventId: input.eventId,
    eventType: input.eventType,
    providerSubscriptionId: String(subscription.subscription_id),
    providerCustomerId: subscription.customer_id ? String(subscription.customer_id) : undefined,
    checkoutOperationId:
      subscription.reference_id || operationField?.value
        ? String(subscription.reference_id || operationField.value)
        : undefined,
    tier: tierForPlanCode(String(subscription.plan?.plan_code || subscription.plan_code)),
    status: normalizedStatus,
    occurredAt,
    providerSequence: input.providerSequence,
    currentPeriodEnd: ["active", "past_due", "canceled"].includes(normalizedStatus)
      ? periodEnd
      : null,
    graceUntil,
    cancelAtPeriodEnd: normalizedStatus === "canceled",
    amountMinor: null,
    currency: null,
  };
}
