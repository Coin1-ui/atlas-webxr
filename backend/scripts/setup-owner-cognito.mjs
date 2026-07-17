#!/usr/bin/env node
/**
 * Create or reset the platform owner Cognito user (admin API — needs AWS credentials).
 *
 * Usage:
 *   $env:ATLAS_OWNER_EMAIL = "director@omnimanual.com"
 *   $env:ATLAS_OWNER_PASSWORD = "YourSecurePass123!"
 *   npm run setup:owner
 *
 * Reads pool/client from .env.local when COGNITO_* / VITE_COGNITO_* not set.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromApi = createRequire(resolve(root, "backend/lambda/atlas-api/package.json"));
const {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} = requireFromApi("@aws-sdk/client-cognito-identity-provider");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(resolve(root, ".env.local"));
loadDotEnv(resolve(root, ".env"));

const region =
  process.env.COGNITO_REGION ||
  process.env.VITE_COGNITO_REGION ||
  process.env.AWS_REGION ||
  "ap-south-1";
const poolId = process.env.COGNITO_USER_POOL_ID || process.env.VITE_COGNITO_USER_POOL_ID;
const email = (process.env.ATLAS_OWNER_EMAIL || "director@omnimanual.com").trim().toLowerCase();
let password = process.env.ATLAS_OWNER_PASSWORD?.trim();

if (!poolId) {
  console.error("Missing COGNITO_USER_POOL_ID / VITE_COGNITO_USER_POOL_ID.");
  console.error("Run: npm run env:from-deploy   then restart.");
  process.exit(1);
}

if (!password) {
  password = `Atlas-${randomBytes(9).toString("base64url")}!9`;
  console.log("ATLAS_OWNER_PASSWORD not set — generated a one-time password (save it now):");
}

const client = new CognitoIdentityProviderClient({ region });

async function userExists() {
  try {
    await client.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }));
    return true;
  } catch (e) {
    if (e?.name === "UserNotFoundException") return false;
    throw e;
  }
}

async function main() {
  const exists = await userExists();

  if (!exists) {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        MessageAction: "SUPPRESS",
      })
    );
    console.log(`Created Cognito user: ${email}`);
  } else {
    console.log(`User already exists: ${email} — resetting password`);
  }

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: email,
      Password: password,
      Permanent: true,
    })
  );

  console.log("");
  console.log("Owner account ready for AWS testing:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("");
  console.log("Sign in at:");
  console.log("  Live:  https://main.d3t9wmef56h86w.amplifyapp.com/login");
  console.log("  Local: npm run dev → https://localhost:5173/login");
  console.log("");
  console.log("Owner dashboard: /owner (desktop only, after sign-in)");
  console.log("");
  console.log("Lambda env (if not set yet):");
  console.log(`  ATLAS_PLATFORM_OWNER_EMAILS=${email}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  if (e?.name === "CredentialsProviderError" || /Could not load credentials/.test(String(e))) {
    console.error("");
    console.error("Configure AWS credentials first (AWS CLI profile, env keys, or SSO).");
    console.error("Example: aws configure   OR set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY");
  }
  process.exit(1);
});
