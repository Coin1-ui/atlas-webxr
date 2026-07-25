import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function usageTable() {
  return process.env.ATLAS_USAGE_TABLE || "atlas-usage";
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {string} workspaceId
 * @param {{ modelDelta?: number; storageBytesDelta?: number; sessionDelta?: number }} deltas
 */
export async function incrementUsage(workspaceId, deltas) {
  const month = monthKey();
  const expr = [];
  const names = { "#month": "month" };
  const values = { ":zero": 0, ":wsId": workspaceId, ":monthVal": month };
  const pk = `WORKSPACE#${workspaceId}`;
  const sk = `MONTH#${month}`;

  if (deltas.modelDelta) {
    expr.push("modelCount = if_not_exists(modelCount, :zero) + :modelDelta");
    values[":modelDelta"] = deltas.modelDelta;
  }
  if (deltas.storageBytesDelta) {
    expr.push("storageBytes = if_not_exists(storageBytes, :zero) + :storageDelta");
    values[":storageDelta"] = deltas.storageBytesDelta;
  }
  if (deltas.sessionDelta) {
    expr.push("sessionCount = if_not_exists(sessionCount, :zero) + :sessionDelta");
    values[":sessionDelta"] = deltas.sessionDelta;
  }
  if (!expr.length) return;

  await client.send(
    new UpdateCommand({
      TableName: usageTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: `MONTH#${month}` },
      UpdateExpression: `SET workspaceId = :wsId, #month = :monthVal, ${expr.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: {
        ...values,
      },
    })
  );
}

/**
 * @param {string} workspaceId
 */
export async function incrementModelCount(workspaceId) {
  await incrementUsage(workspaceId, { modelDelta: 1 });
}

/**
 * @param {string} workspaceId
 */
export async function getMonthlyUsage(workspaceId) {
  const month = monthKey();
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
    sandboxSeededAt: row.Item?.sandboxSeededAt ?? null,
    sandboxNote: row.Item?.sandboxNote ?? null,
    sandboxDodoSeedRunId: row.Item?.sandboxDodoSeedRunId ?? null,
  };
}

/**
 * Count one AR session when session_end includes at least one placement.
 * Dedupes by sessionId for 48h.
 *
 * @param {string} workspaceId
 * @param {string} sessionId
 * @param {number} placementCount
 */
export async function recordQualifiedSession(workspaceId, sessionId, placementCount) {
  if (!sessionId || placementCount < 1) return { counted: false };

  const dedupeKey = {
    pk: `WORKSPACE#${workspaceId}`,
    sk: `SESSION#${sessionId}`,
  };
  const ttl = Math.floor(Date.now() / 1000) + 48 * 3600;

  try {
    await client.send(
      new PutCommand({
        TableName: usageTable(),
        Item: {
          ...dedupeKey,
          workspaceId,
          sessionId,
          placementCount,
          recordedAt: new Date().toISOString(),
          ttl,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") {
      return { counted: false, duplicate: true };
    }
    throw e;
  }

  await incrementUsage(workspaceId, { sessionDelta: 1 });
  // Fire-and-forget meter ingest — never block session analytics.
  import("./dodo-usage-ingest.mjs")
    .then(({ ingestDodoArSession }) => ingestDodoArSession(workspaceId, sessionId))
    .catch(() => {});
  return { counted: true };
}

/**
 * Absolute write of monthly usage counters for sandbox overage testing.
 * Prefer this over inventing fake S3/manifest rows — GET /usage reads these
 * when `sandboxSeededAt` is set.
 *
 * @param {string} workspaceId
 * @param {{
 *   sessionCount: number;
 *   modelCount?: number;
 *   storageBytes?: number;
 *   month?: string;
 *   sandboxDodoSeedRunId?: string | null;
 * }} input
 */
export async function setSandboxOverageUsage(workspaceId, input) {
  const month = input.month || monthKey();
  const sessionCount = Math.max(0, Math.floor(Number(input.sessionCount) || 0));
  const modelCount = Math.max(0, Math.floor(Number(input.modelCount) || 0));
  const storageBytes = Math.max(0, Math.floor(Number(input.storageBytes) || 0));
  const now = new Date().toISOString();
  const seedRunId =
    typeof input.sandboxDodoSeedRunId === "string" && input.sandboxDodoSeedRunId.trim()
      ? input.sandboxDodoSeedRunId.trim()
      : null;
  const item = {
    pk: `WORKSPACE#${workspaceId}`,
    sk: `MONTH#${month}`,
    workspaceId,
    month,
    sessionCount,
    modelCount,
    storageBytes,
    sandboxSeededAt: now,
    sandboxNote: "api-sandbox-seed",
    updatedAt: now,
  };
  if (seedRunId) item.sandboxDodoSeedRunId = seedRunId;
  await client.send(
    new PutCommand({
      TableName: usageTable(),
      Item: item,
    })
  );
  return { month, sessionCount, modelCount, storageBytes, sandboxDodoSeedRunId: seedRunId };
}

/**
 * @deprecated Prefer setSandboxOverageUsage — kept for older callers.
 * @param {string} workspaceId
 * @param {number} sessionCount
 * @param {{ month?: string; modelCount?: number; storageBytes?: number }} [opts]
 */
export async function setMonthlySessionCount(workspaceId, sessionCount, opts = {}) {
  return setSandboxOverageUsage(workspaceId, {
    sessionCount,
    modelCount: opts.modelCount,
    storageBytes: opts.storageBytes,
    month: opts.month,
  });
}

/**
 * Billing-period reset: zero AR sessions only. Models/storage stay (live catalog/S3).
 * Called on Dodo subscription.renewed and hybrid remount/resubscribe.
 *
 * @param {string} workspaceId
 * @param {string} [month]
 * @param {string} [nowIso]
 */
export function buildMonthlySessionResetUpdate(workspaceId, month = monthKey(), nowIso = new Date().toISOString()) {
  return {
    TableName: usageTable(),
    Key: { pk: `WORKSPACE#${workspaceId}`, sk: `MONTH#${month}` },
    UpdateExpression:
      "SET workspaceId = :wsId, #month = :monthVal, sessionCount = :zero, sessionsResetAt = :now",
    ExpressionAttributeNames: { "#month": "month" },
    ExpressionAttributeValues: {
      ":wsId": workspaceId,
      ":monthVal": month,
      ":zero": 0,
      ":now": nowIso,
    },
  };
}

/**
 * @param {string} workspaceId
 * @param {string} [month]
 * @returns {Promise<{ month: string; reset: true }>}
 */
export async function resetMonthlySessionCount(workspaceId, month = monthKey()) {
  await client.send(new UpdateCommand(buildMonthlySessionResetUpdate(workspaceId, month)));
  return { month, reset: true };
}

/**
 * @param {string} workspaceId
 * @param {string} [month]
 */
export async function clearMonthlyUsage(workspaceId, month = monthKey()) {
  const pk = `WORKSPACE#${workspaceId}`;
  const sk = `MONTH#${month}`;
  try {
    await client.send(
      new DeleteCommand({
        TableName: usageTable(),
        Key: { pk, sk },
      })
    );
    return { month, cleared: true, method: "delete" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const accessDenied =
      err?.name === "AccessDeniedException" ||
      /not authorized|AccessDenied|dynamodb:DeleteItem/i.test(msg);
    if (!accessDenied) throw err;
    // PutItem is on the Lambda role; zero the counters instead of deleting.
    await client.send(
      new PutCommand({
        TableName: usageTable(),
        Item: {
          pk,
          sk,
          workspaceId,
          month,
          modelCount: 0,
          sessionCount: 0,
          storageBytes: 0,
          updatedAt: new Date().toISOString(),
        },
      })
    );
    return { month, cleared: true, method: "soft-clear" };
  }
}
