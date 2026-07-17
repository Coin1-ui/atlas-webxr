#!/usr/bin/env node
/**
 * Ensure legacy workspace row exists in DynamoDB for v1 S3 migration.
 * Usage: node backend/scripts/migrate-legacy-workspace.mjs
 */
import { ensureLegacyWorkspace } from "../lambda/atlas-api/lib/dynamodb.mjs";

const ownerSub = process.argv[2] || "system";
const ws = await ensureLegacyWorkspace(ownerSub);
console.log("Legacy workspace ready:", ws?.slug, ws?.id);
