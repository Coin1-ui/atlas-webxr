import { createRemoteJWKSet, jwtVerify } from "jose";

/** @type {ReturnType<typeof createRemoteJWKSet> | null} */
let jwks = null;

function cognitoConfig() {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!poolId || !clientId) return null;
  return { region, poolId, clientId, issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}` };
}

function getJwks() {
  const cfg = cognitoConfig();
  if (!cfg) return null;
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${cfg.issuer}/.well-known/jwks.json`));
  }
  return { jwks, cfg };
}

function emailFromPayload(payload) {
  if (payload.email) return String(payload.email).trim().toLowerCase();
  const username = payload["cognito:username"];
  if (typeof username === "string" && username.includes("@")) {
    return username.trim().toLowerCase();
  }
  return undefined;
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 * @returns {Promise<{ sub: string; email?: string } | null>}
 */
export async function getAuthUser(event) {
  const jwtClaims = event.requestContext?.authorizer?.jwt?.claims;
  if (jwtClaims?.sub) {
    return {
      sub: String(jwtClaims.sub),
      email: jwtClaims.email
        ? String(jwtClaims.email).trim().toLowerCase()
        : jwtClaims["cognito:username"] && String(jwtClaims["cognito:username"]).includes("@")
          ? String(jwtClaims["cognito:username"]).trim().toLowerCase()
          : undefined,
    };
  }

  const cfg = cognitoConfig();
  const token = event.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
    event.headers?.Authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  if (process.env.ATLAS_DEV_MODE === "true" && process.env.ATLAS_ALLOW_DEV_AUTH === "true" && token.startsWith("dev:")) {
    const sub = token.slice(4);
    return sub ? { sub } : null;
  }

  if (!cfg) return null;

  const keys = getJwks();
  if (!keys) return null;
  try {
    const { payload } = await jwtVerify(token, keys.jwks, {
      issuer: keys.cfg.issuer,
      audience: keys.cfg.clientId,
    });
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: emailFromPayload(payload),
    };
  } catch {
    return null;
  }
}

/**
 * @param {import("aws-lambda").APIGatewayProxyEventV2} event
 */
export async function requireAuthUser(event) {
  const user = await getAuthUser(event);
  if (!user) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return user;
}
