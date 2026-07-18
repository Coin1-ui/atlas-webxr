const DEFAULT_CORS = process.env.ATLAS_CORS_ORIGIN || "*";

/**
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [extraHeaders]
 */
export function jsonResponse(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": DEFAULT_CORS,
      "Access-Control-Allow-Headers": "content-type,authorization,idempotency-key",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function optionsResponse() {
  return jsonResponse(204, "");
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export function parseJsonBody(event) {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

/**
 * Exact request body required for webhook signature verification.
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export function rawRequestBody(event) {
  if (typeof event.body !== "string") return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}
