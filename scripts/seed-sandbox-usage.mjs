#!/usr/bin/env node
/**
 * Seed or reset sandbox usage counters for overage testing (BILL-3).
 * Does not upload models or run AR sessions — writes atlas-usage directly.
 *
 * Prerequisites: AWS credentials with dynamodb:PutItem/UpdateItem on atlas-usage
 * (and atlas-workspaces read for --preset overage).
 *
 * Usage:
 *   node scripts/seed-sandbox-usage.mjs WORKSPACE_ID --preset overage
 *   node scripts/seed-sandbox-usage.mjs WORKSPACE_ID --sessions 650
 *   node scripts/seed-sandbox-usage.mjs WORKSPACE_ID --reset
 *   node scripts/seed-sandbox-usage.mjs WORKSPACE_ID --reset-overage
 *
 * Env: ATLAS_USAGE_TABLE (default atlas-usage), ATLAS_WORKSPACES_TABLE, ATLAS_BILLING_TABLE
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getWorkspaceById } from "../backend/lambda/atlas-api/lib/dynamodb.mjs";
import { limitsForWorkspace } from "../backend/lambda/atlas-api/lib/plan-limits.mjs";
import { effectiveBillingTier } from "../backend/lambda/atlas-api/lib/trial.mjs";
import { estimateOverageUsd } from "../backend/lambda/atlas-api/lib/overage-estimate.mjs";

/** AWS SDK lives under backend/lambda/atlas-api — not the repo root package.json. */
const requireFromLambda = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../backend/lambda/atlas-api/package.json")
);
const { DynamoDBClient } = requireFromLambda("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand } =
  requireFromLambda("@aws-sdk/lib-dynamodb");

// Atlas DynamoDB tables live in ap-south-1 (same as API Gateway / Lambda).
if (!process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) {
  process.env.AWS_REGION = "ap-south-1";
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

function usageTable() {
  return process.env.ATLAS_USAGE_TABLE || "atlas-usage";
}

function billingTable() {
  return process.env.ATLAS_BILLING_TABLE || "atlas-billing";
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseArgs(argv) {
  const positional = [];
  const flags = { preset: null, sessions: null, reset: false, resetOverage: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--reset") flags.reset = true;
    else if (arg === "--reset-overage") flags.resetOverage = true;
    else if (arg === "--preset") {
      flags.preset = argv[++i];
    } else if (arg === "--sessions") {
      flags.sessions = Number(argv[++i]);
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }
  return { workspaceId: positional[0] || "", flags };
}

async function readUsage(workspaceId, month) {
  const row = await client.send(
    new GetCommand({
      TableName: usageTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: `MONTH#${month}` },
    })
  );
  return {
    month,
    modelCount: Number(row.Item?.modelCount ?? 0),
    sessionCount: Number(row.Item?.sessionCount ?? 0),
    storageBytes: Number(row.Item?.storageBytes ?? 0),
  };
}

async function seedSessions(workspaceId, sessionCount, month) {
  const now = new Date().toISOString();
  await client.send(
    new PutCommand({
      TableName: usageTable(),
      Item: {
        pk: `WORKSPACE#${workspaceId}`,
        sk: `MONTH#${month}`,
        workspaceId,
        month,
        sessionCount,
        modelCount: 0,
        storageBytes: 0,
        sandboxSeededAt: now,
        sandboxNote: "seed-sandbox-usage.mjs",
      },
    })
  );
}

async function resetUsage(workspaceId, month) {
  await client.send(
    new DeleteCommand({
      TableName: usageTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: `MONTH#${month}` },
    })
  );
}

async function resetOverageRecord(workspaceId, month) {
  await client.send(
    new DeleteCommand({
      TableName: billingTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: `OVERAGE#${month}` },
    })
  );
}

async function previewOverage(workspaceId, sessionCount) {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    console.error(`Workspace not found: ${workspaceId}`);
    process.exit(1);
  }
  const limits = limitsForWorkspace(workspace);
  const tier = effectiveBillingTier(workspace);
  const usage = { modelCount: 0, sessionCount, storageBytes: 0 };
  const estimated = estimateOverageUsd(tier, usage, limits);
  return { workspace, tier, limits, estimated };
}

const { workspaceId, flags } = parseArgs(process.argv);
if (!workspaceId) {
  console.error(
    "Usage: node scripts/seed-sandbox-usage.mjs WORKSPACE_ID [--preset overage] [--sessions N] [--reset] [--reset-overage]"
  );
  process.exit(1);
}

const month = monthKey();

if (flags.resetOverage) {
  await resetOverageRecord(workspaceId, month);
  console.log(JSON.stringify({ ok: true, action: "reset-overage", workspaceId, month }, null, 2));
  process.exit(0);
}

if (flags.reset) {
  await resetUsage(workspaceId, month);
  console.log(JSON.stringify({ ok: true, action: "reset-usage", workspaceId, month }, null, 2));
  process.exit(0);
}

let sessionCount = flags.sessions;
if (flags.preset === "overage") {
  const preview = await previewOverage(workspaceId, 0);
  const overSessions = 150;
  sessionCount = preview.limits.sessionsPerMonth + overSessions;
  console.log(
    `Preset overage: tier=${preview.tier}, limit=${preview.limits.sessionsPerMonth}, seeding sessions=${sessionCount}`
  );
} else if (!Number.isFinite(sessionCount) || sessionCount < 0) {
  console.error("Provide --sessions N or --preset overage");
  process.exit(1);
}

await seedSessions(workspaceId, sessionCount, month);
const preview = await previewOverage(workspaceId, sessionCount);
const current = await readUsage(workspaceId, month);

console.log(
  JSON.stringify(
    {
      ok: true,
      action: "seed",
      workspaceId,
      month,
      usage: current,
      billingTier: preview.tier,
      limits: preview.limits,
      estimatedOverageUsd: preview.estimated,
      nextSteps: [
        "Open Account in Amplify — Usage overage should show estimated USD > 0",
        "Click Accept & pay overage (requires Lambda + API Gateway overage routes)",
        "Cleanup: node scripts/seed-sandbox-usage.mjs WORKSPACE_ID --reset --reset-overage",
      ],
    },
    null,
    2
  )
);
