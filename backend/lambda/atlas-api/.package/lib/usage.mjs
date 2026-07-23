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
 * Absolute write of monthly session counter (sandbox overage testing).
 * Does not invent models/storage — those come from manifest/S3 in usage API.
 *
 * @param {string} workspaceId
 * @param {number} sessionCount
 * @param {{ month?: string }} [opts]
 */
export async function setMonthlySessionCount(workspaceId, sessionCount, opts = {}) {
  const month = opts.month || monthKey();
  const count = Math.max(0, Math.floor(Number(sessionCount) || 0));
  const now = new Date().toISOString();
  await client.send(
    new PutCommand({
      TableName: usageTable(),
      Item: {
        pk: `WORKSPACE#${workspaceId}`,
        sk: `MONTH#${month}`,
        workspaceId,
        month,
        sessionCount: count,
        modelCount: 0,
        storageBytes: 0,
        sandboxSeededAt: now,
        sandboxNote: "api-sandbox-seed",
      },
    })
  );
  return { month, sessionCount: count };
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
