import { createHash } from "node:crypto";

let cachedToken = null;
let tokenExpiresAt = 0;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function accessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const body = new URLSearchParams({
    refresh_token: requiredEnv("ZOHO_BOOKS_REFRESH_TOKEN"),
    client_id: requiredEnv("ZOHO_CLIENT_ID"),
    client_secret: requiredEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const response = await fetch(
    `${process.env.ZOHO_ACCOUNTS_URL?.trim() || "https://accounts.zoho.in"}/oauth/v2/token`,
    { method: "POST", body, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) throw new Error("Zoho Books OAuth refresh failed");
  const json = await response.json();
  if (!json.access_token) throw new Error("Zoho Books OAuth response omitted access_token");
  cachedToken = String(json.access_token);
  tokenExpiresAt = Date.now() + Number(json.expires_in || 3600) * 1000;
  return cachedToken;
}

async function booksRequest(path, options = {}) {
  const base = process.env.ZOHO_BOOKS_API_URL?.trim() || "https://www.zohoapis.in/books/v3";
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `${base}${path}${separator}organization_id=${encodeURIComponent(requiredEnv("ZOHO_BOOKS_ORGANIZATION_ID"))}`,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${await accessToken()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(options.headers || {}),
      },
      body:
        options.body == null
          ? undefined
          : new URLSearchParams({ JSONString: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(12_000),
    }
  );
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || (json.code != null && Number(json.code) !== 0)) {
    throw Object.assign(new Error("Zoho Books request failed"), { statusCode: 502 });
  }
  return json;
}

export async function mirrorPaymentToZohoBooks(job) {
  const currency = String(job.currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Accounting job currency is invalid");
  const contactId =
    process.env[`ZOHO_BOOKS_CLEARING_CONTACT_${currency}`]?.trim() ||
    (currency === "INR" ? process.env.ZOHO_BOOKS_CLEARING_CONTACT_ID?.trim() : "");
  if (!contactId) throw new Error(`Zoho Books clearing contact for ${currency} is required`);
  const rawReference = `ATLAS-${job.provider}-${job.providerPaymentId}`;
  const reference =
    rawReference.length <= 100
      ? rawReference
      : `ATLAS-${createHash("sha256").update(rawReference).digest("hex")}`;
  const invoiceFieldApi = requiredEnv("ZOHO_BOOKS_INVOICE_UNIQUE_FIELD_API_NAME");
  const invoiceFieldId = requiredEnv("ZOHO_BOOKS_INVOICE_UNIQUE_FIELD_ID");
  const paymentFieldApi = requiredEnv("ZOHO_BOOKS_PAYMENT_UNIQUE_FIELD_API_NAME");
  const paymentFieldId = requiredEnv("ZOHO_BOOKS_PAYMENT_UNIQUE_FIELD_ID");
  const existing = await booksRequest(
    `/invoices?reference_number=${encodeURIComponent(reference)}&per_page=1`
  );
  let invoice = Array.isArray(existing.invoices) ? existing.invoices[0] : null;
  if (
    invoice &&
    (String(invoice.customer_id || "") !== contactId ||
      Number(invoice.total) !== Number(job.amountMinor) / 100)
  ) {
    throw new Error("Zoho Books invoice reference matched different payment data");
  }
  if (!invoice) {
    const created = await booksRequest("/invoices", {
      method: "PUT",
      headers: {
        "X-Unique-Identifier-Key": invoiceFieldApi,
        "X-Unique-Identifier-Value": reference,
        "X-Upsert": "true",
      },
      body: {
        customer_id: contactId,
        date: String(job.occurredAt).slice(0, 10),
        reference_number: reference,
        notes: `Atlas ${job.workspaceId}; ${job.provider} payment ${job.providerPaymentId}`,
        custom_fields: [{ customfield_id: invoiceFieldId, value: reference }],
        line_items: [
          {
            item_id: requiredEnv("ZOHO_BOOKS_SUBSCRIPTION_ITEM_ID"),
            quantity: 1,
            rate: Number(job.amountMinor) / 100,
          },
        ],
      },
    });
    invoice = created.invoice;
  }
  if (!invoice?.invoice_id) throw new Error("Zoho Books did not return an invoice ID");
  const existingPayments = await booksRequest(
    `/customerpayments?reference_number=${encodeURIComponent(reference)}&per_page=1`
  );
  const existingPayment = Array.isArray(existingPayments.customerpayments)
    ? existingPayments.customerpayments[0]
    : null;
  if (existingPayment?.payment_id) {
    if (
      String(existingPayment.customer_id || "") !== contactId ||
      Number(existingPayment.amount) !== Number(job.amountMinor) / 100
    ) {
      throw new Error("Zoho Books payment reference matched different payment data");
    }
    return {
      invoiceId: String(invoice.invoice_id),
      paymentId: String(existingPayment.payment_id),
    };
  }
  const payment = await booksRequest("/customerpayments", {
    method: "PUT",
    headers: {
      "X-Unique-Identifier-Key": paymentFieldApi,
      "X-Unique-Identifier-Value": reference,
      "X-Upsert": "true",
    },
    body: {
      customer_id: contactId,
      payment_mode: String(job.provider),
      amount: Number(job.amountMinor) / 100,
      date: String(job.occurredAt).slice(0, 10),
      reference_number: reference,
      custom_fields: [{ customfield_id: paymentFieldId, value: reference }],
      invoices: [
        {
          invoice_id: String(invoice.invoice_id),
          amount_applied: Number(job.amountMinor) / 100,
        },
      ],
    },
  });
  return {
    invoiceId: String(invoice.invoice_id),
    paymentId: String(payment.payment?.payment_id || ""),
  };
}
