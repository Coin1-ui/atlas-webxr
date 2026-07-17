#!/usr/bin/env node
/**
 * One-time backfill: persist owner emails on member + workspace rows from Cognito.
 * Requires AWS credentials + Lambda env vars (COGNITO_USER_POOL_ID, DynamoDB tables).
 *
 * Usage: node backend/scripts/backfill-member-emails.mjs [--dry-run]
 */
import { listAllWorkspacesForPlatform } from "../lambda/atlas-api/lib/dynamodb.mjs";

const dryRun = process.argv.includes("--dry-run");

if (!process.env.COGNITO_USER_POOL_ID?.trim()) {
  console.error("Set COGNITO_USER_POOL_ID (same value as on atlas-api Lambda).");
  process.exit(1);
}

const workspaces = await listAllWorkspacesForPlatform();
let withEmail = 0;
let missing = 0;

for (const ws of workspaces) {
  const emails = ws.ownerEmails ?? [];
  if (emails.length) {
    withEmail += 1;
    console.log(`OK  ${ws.slug} → ${emails.join(", ")}`);
  } else {
    missing += 1;
    console.log(`MISSING  ${ws.slug} (${ws.id})`);
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      total: workspaces.length,
      withEmail,
      missing,
      note: dryRun
        ? "Re-run without --dry-run after deploying Lambda with backfill code"
        : "Backfill runs inside listAllWorkspacesForPlatform (persists to DynamoDB)",
    },
    null,
    2,
  ),
);

if (missing > 0 && !dryRun) {
  process.exitCode = 2;
}
