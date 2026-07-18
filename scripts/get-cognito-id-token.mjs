#!/usr/bin/env node
/**
 * Sign in to prod Cognito and print an ID token for API smoke tests (no DevTools).
 *
 * Usage:
 *   $env:COGNITO_TEST_PASSWORD = "your-password"
 *   npm run get:id-token -- you@company.com
 *
 * Env (optional — auto-fetched from live Amplify bundle if missing):
 *   VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_REGION
 *   COGNITO_TEST_PASSWORD — account password (do not commit)
 */
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const email = process.argv[2]?.trim().toLowerCase();
const password = process.env.COGNITO_TEST_PASSWORD?.trim() || "";

if (!email || !email.includes("@")) {
  console.error("Usage: npm run get:id-token -- you@company.com");
  console.error("Set password: $env:COGNITO_TEST_PASSWORD = \"your-password\"");
  process.exit(1);
}

if (!password) {
  console.error("Missing COGNITO_TEST_PASSWORD environment variable.");
  console.error('Example: $env:COGNITO_TEST_PASSWORD = "your-password"');
  process.exit(1);
}

async function loadCognitoConfig() {
  let poolId = process.env.VITE_COGNITO_USER_POOL_ID?.trim();
  let clientId = process.env.VITE_COGNITO_CLIENT_ID?.trim();
  let region = process.env.VITE_COGNITO_REGION?.trim();

  if (poolId && clientId) {
    return { poolId, clientId, region: region || "ap-south-1" };
  }

  const deploy = process.env.ATLAS_DEPLOY_URL?.replace(/\/$/, "") || "https://main.d7vfdpujdozkj.amplifyapp.com";
  const home = await fetch(`${deploy}/`).then((r) => r.text());
  const scriptMatch = home.match(/src="(\/assets\/main-[^"]+\.js)"/) || home.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!scriptMatch) throw new Error("Could not read Cognito config from deploy bundle");
  const js = await fetch(`${deploy}${scriptMatch[1]}`).then((r) => r.text());
  const poolMatch = js.match(/ap-[a-z0-9-]+_[A-Za-z0-9]+/);
  poolId = poolId || poolMatch?.[0];
  region = region || poolMatch?.[0]?.match(/^(ap-[a-z0-9-]+)_/)?.[1] || "ap-south-1";
  if (poolMatch) {
    const i = js.indexOf(poolMatch[0]);
    const slice = js.slice(Math.max(0, i - 200), i + 400);
    const candidates = [...slice.matchAll(/"([a-z0-9]{26})"/g)].map((m) => m[1]);
    clientId = clientId || candidates.find((id) => !poolMatch[0].includes(id)) || candidates[0];
  }
  if (!poolId || !clientId) throw new Error("Cognito pool/client not found — set VITE_COGNITO_* env vars");
  return { poolId, clientId, region };
}

const cfg = await loadCognitoConfig();
const pool = new CognitoUserPool({ UserPoolId: cfg.poolId, ClientId: cfg.clientId });
const user = new CognitoUser({ Username: email, Pool: pool });
const authDetails = new AuthenticationDetails({ Username: email, Password: password });

const session = await new Promise((resolve, reject) => {
  user.authenticateUser(authDetails, {
    onSuccess: resolve,
    onFailure: reject,
  });
}).catch((err) => {
  const code = err?.code || err?.name || "";
  if (code === "NotAuthorizedException") {
    console.error("\nCognito rejected email/password.");
    console.error("If you are already signed in on https://main.d7vfdpujdozkj.amplifyapp.com , skip CLI login:");
    console.error("  1. Open the site (stay logged in)");
    console.error("  2. DevTools → Console, run:");
    console.error("     JSON.parse(localStorage.getItem('atlas-auth-session')).idToken");
    console.error("  3. $env:ATLAS_TEST_ID_TOKEN = \"<paste eyJ...>\"");
    console.error("     npm run test:batch28");
    console.error("\nOtherwise: confirm password at /login, or use Forgot password on the site.\n");
  } else if (code === "UserNotConfirmedException") {
    console.error("\nEmail not verified. Open the verification email or sign up again.\n");
  }
  throw err;
});

const idToken = session.getIdToken().getJwtToken();
console.log("\n# Cognito ID token (starts with eyJ):\n");
console.log(idToken);
console.log("\n# Run Batch 28 smoke test:\n");
console.log(`$env:ATLAS_TEST_ID_TOKEN = "${idToken.slice(0, 24)}..."  # paste full token above`);
console.log('$env:ATLAS_TEST_WORKSPACE_ID = "e2c1091e-8801-4025-9ec4-ddd81790a66d"  # or omit to use first workspace');
console.log("npm run test:batch28   # existing workspace (signup trial check)");
console.log("npm run test:eng36     # create fresh throwaway workspace");
