#!/usr/bin/env node

const env = process.env;
const missing = [];
const requireKeys = (keys) => {
  for (const key of keys) if (!String(env[key] || "").trim()) missing.push(key);
};

if (env.ATLAS_BILLING_ENABLED === "true") {
  requireKeys([
    "ATLAS_BILLING_TABLE",
    "ATLAS_BILLING_APP_ORIGIN",
    "ATLAS_BILLING_RETURN_URL",
    "ATLAS_BILLING_CANCEL_URL",
    "DODO_PAYMENTS_ENV",
    "DODO_PAYMENTS_API_KEY",
    "DODO_PRODUCT_STARTER_MONTHLY",
    "DODO_PRODUCT_LAUNCH_MONTHLY",
    "DODO_PRODUCT_GROWTH_MONTHLY",
  ]);
}
if (env.ATLAS_DODO_WEBHOOK_ENABLED === "true") {
  requireKeys([
    "DODO_PAYMENTS_API_KEY",
    "DODO_PAYMENTS_WEBHOOK_SECRET",
    "DODO_PAYMENTS_BUSINESS_ID",
    "DODO_PRODUCT_STARTER_MONTHLY",
    "DODO_PRODUCT_LAUNCH_MONTHLY",
    "DODO_PRODUCT_GROWTH_MONTHLY",
    "DODO_PAYMENTS_ENV",
  ]);
}
if (env.ATLAS_ZOHO_CHECKOUT_ENABLED === "true" || env.ATLAS_ZOHO_WEBHOOK_ENABLED === "true") {
  requireKeys([
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_BILLING_REFRESH_TOKEN",
    "ZOHO_BILLING_ORGANIZATION_ID",
    "ZOHO_PAYMENTS_WEBHOOK_SECRET",
    "ZOHO_BILLING_PORTAL_URL",
    "ZOHO_PLAN_STARTER_MONTHLY",
    "ZOHO_PLAN_LAUNCH_MONTHLY",
    "ZOHO_PLAN_GROWTH_MONTHLY",
  ]);
}
if (env.ATLAS_ZOHO_BOOKS_SYNC_ENABLED === "true") {
  requireKeys([
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_BOOKS_REFRESH_TOKEN",
    "ZOHO_BOOKS_ORGANIZATION_ID",
    "ZOHO_BOOKS_SUBSCRIPTION_ITEM_ID",
    "ZOHO_BOOKS_INVOICE_UNIQUE_FIELD_API_NAME",
    "ZOHO_BOOKS_INVOICE_UNIQUE_FIELD_ID",
    "ZOHO_BOOKS_PAYMENT_UNIQUE_FIELD_API_NAME",
    "ZOHO_BOOKS_PAYMENT_UNIQUE_FIELD_ID",
    "ATLAS_BILLING_DLQ_URL",
  ]);
  if (
    !Object.keys(env).some(
      (key) => key === "ZOHO_BOOKS_CLEARING_CONTACT_ID" || key.startsWith("ZOHO_BOOKS_CLEARING_CONTACT_")
    )
  ) {
    missing.push("ZOHO_BOOKS_CLEARING_CONTACT_<CURRENCY>");
  }
}

const invalidUrls = [];
for (const key of ["ATLAS_BILLING_APP_ORIGIN", "ATLAS_BILLING_RETURN_URL", "ATLAS_BILLING_CANCEL_URL"]) {
  if (!env[key]) continue;
  try {
    if (new URL(env[key]).protocol !== "https:") invalidUrls.push(key);
  } catch {
    invalidUrls.push(key);
  }
}
try {
  const origin = new URL(env.ATLAS_BILLING_APP_ORIGIN || "");
  for (const key of ["ATLAS_BILLING_RETURN_URL", "ATLAS_BILLING_CANCEL_URL"]) {
    if (env[key] && new URL(env[key]).origin !== origin.origin) invalidUrls.push(key);
  }
} catch {
  if (env.ATLAS_BILLING_ENABLED === "true") invalidUrls.push("ATLAS_BILLING_APP_ORIGIN");
}
if (
  env.DODO_PAYMENTS_ENV &&
  !["test_mode", "live_mode"].includes(env.DODO_PAYMENTS_ENV)
) {
  invalidUrls.push("DODO_PAYMENTS_ENV");
}

if (missing.length || invalidUrls.length) {
  console.error(JSON.stringify({ ok: false, missing: [...new Set(missing)], invalidUrls }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, billingEnabled: env.ATLAS_BILLING_ENABLED === "true" }));
