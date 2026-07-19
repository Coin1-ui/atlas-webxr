#!/usr/bin/env node
/**
 * Deploy atlas-api Lambda zip via AWS CLI.
 * Prerequisite: npm run package (or npm run package:atlas-api from repo root)
 *
 * Usage:
 *   node scripts/deploy.mjs
 *   ATLAS_LAMBDA_FUNCTION=atlas-api node scripts/deploy.mjs
 *   node scripts/deploy.mjs --function atlas-api --region ap-south-1
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lambdaRoot = path.join(__dirname, "..");
const zipPath = path.join(lambdaRoot, "..", "atlas-api-deploy.zip");
const billingValidator = path.join(lambdaRoot, "..", "..", "..", "scripts", "verify-billing-env.mjs");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const region =
  argValue("--region") || process.env.AWS_REGION || process.env.ATLAS_AWS_REGION || "ap-south-1";
const functionName =
  argValue("--function") || process.env.ATLAS_LAMBDA_FUNCTION || "atlas-api";

function hasAwsCli() {
  const r = spawnSync("aws", ["--version"], { shell: true, encoding: "utf8" });
  return r.status === 0;
}

if (!fs.existsSync(zipPath)) {
  console.error(`Missing ${zipPath}. Run: npm run package:atlas-api`);
  process.exit(1);
}

if (!hasAwsCli()) {
  const stat = fs.statSync(zipPath);
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "AWS CLI not found",
        zip: zipPath,
        mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
        consoleSteps: [
          `Open Lambda (ap-south-1): https://ap-south-1.console.aws.amazon.com/lambda/home?region=ap-south-1#/functions/${functionName}`,
          "Code → Upload from → .zip file",
          `Select: ${zipPath}`,
          "Save → wait for update to complete",
          "Test: GET /health on API Gateway",
        ],
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

const remoteEnvironment = JSON.parse(
  execSync(
    `aws lambda get-function-configuration --function-name "${functionName}" --region "${region}" --query Environment.Variables --output json`,
    { encoding: "utf8", shell: true }
  ) || "{}"
);
const validation = spawnSync(process.execPath, [billingValidator], {
  stdio: "inherit",
  env: { ...process.env, ...remoteEnvironment },
});
if (validation.status !== 0) {
  console.error("Billing environment validation failed; deployment aborted.");
  process.exit(1);
}

console.log(`Uploading ${zipPath} → ${functionName} (${region})…`);
execSync(
  `aws lambda update-function-code --function-name "${functionName}" --zip-file "fileb://${zipPath.replace(/\\/g, "/")}" --region "${region}"`,
  { stdio: "inherit", shell: true },
);

console.log("Waiting for function update…");
for (let i = 0; i < 30; i++) {
  const out = execSync(
    `aws lambda get-function-configuration --function-name "${functionName}" --region "${region}" --query LastUpdateStatus --output text`,
    { encoding: "utf8", shell: true },
  ).trim();
  if (out === "Successful") {
    console.log(JSON.stringify({ ok: true, functionName, region, zip: zipPath }));
    process.exit(0);
  }
  if (out === "Failed") {
    console.error("Lambda update failed. Check CloudWatch / Lambda console.");
    process.exit(1);
  }
  await sleep(2000);
}

console.error("Timed out waiting for Lambda update.");
process.exit(1);
