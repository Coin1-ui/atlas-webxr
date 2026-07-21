import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { mirrorPaymentToZohoBooks } from "../lib/billing-zoho-books.mjs";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

function tableName() {
  return process.env.ATLAS_BILLING_TABLE || "atlas-billing";
}

async function deliverDeadLetter(job) {
  const queueUrl = process.env.ATLAS_BILLING_DLQ_URL?.trim();
  if (!queueUrl) throw new Error("ATLAS_BILLING_DLQ_URL is required");
  const fifo = queueUrl.endsWith(".fifo");
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        type: "zoho_books_accounting_dead_letter",
        idempotencyKey: `zoho-books-${job.provider}-${job.providerPaymentId}`,
        eventId: job.eventId,
        workspaceId: job.workspaceId,
        error: job.lastError || "Accounting retries exhausted",
      }),
      ...(fifo
        ? {
            MessageGroupId: "zoho-books-accounting",
            MessageDeduplicationId: `zoho-books-${job.provider}-${job.providerPaymentId}`,
          }
        : {}),
    })
  );
  await client.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { pk: job.pk, sk: job.sk },
      UpdateExpression: "SET #status = :dead, dlqSentAt = :now",
      ConditionExpression: "#status = :pending",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pending": "dead_letter_pending",
        ":dead": "dead_letter",
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function handleBillingAccountingWorker() {
  if (process.env.ATLAS_ZOHO_BOOKS_SYNC_ENABLED !== "true") {
    return { ok: true, skipped: true };
  }
  const now = new Date().toISOString();
  const jobs = [];
  let cursor;
  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk",
        FilterExpression:
          "#status = :pending OR (#status = :retry AND nextAttemptAt <= :now) OR (#status = :processing AND leaseUntil <= :now) OR #status = :deadPending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": "ACCOUNTING#ZOHO_BOOKS",
          ":pending": "pending",
          ":retry": "retry",
          ":processing": "processing",
          ":deadPending": "dead_letter_pending",
          ":now": now,
        },
        ExclusiveStartKey: cursor,
      })
    );
    jobs.push(...(page.Items || []));
    cursor = page.LastEvaluatedKey;
  } while (cursor && jobs.length < 25);
  const outcomes = [];
  for (const job of jobs.slice(0, 25)) {
    if (job.status === "dead_letter_pending") {
      await deliverDeadLetter(job);
      outcomes.push({ eventId: job.eventId, status: "dead_letter" });
      continue;
    }
    let claimed = false;
    const claimToken = randomUUID();
    const leaseUntil = new Date(Date.now() + 2 * 60_000).toISOString();
    try {
      await client.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { pk: job.pk, sk: job.sk },
          UpdateExpression:
            "SET #status = :processing, attempts = if_not_exists(attempts, :zero) + :one, startedAt = :now, leaseUntil = :lease, claimToken = :token",
          ConditionExpression:
            "#status = :pending OR (#status = :retry AND nextAttemptAt <= :now) OR (#status = :processing AND leaseUntil <= :now)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":pending": "pending",
            ":retry": "retry",
            ":processing": "processing",
            ":zero": 0,
            ":one": 1,
            ":now": now,
            ":lease": leaseUntil,
            ":token": claimToken,
          },
        })
      );
      claimed = true;
      const mirrored = await mirrorPaymentToZohoBooks(job);
      await client.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { pk: job.pk, sk: job.sk },
          UpdateExpression:
            "SET #status = :completed, zohoBooksInvoiceId = :invoice, zohoBooksPaymentId = :payment, completedAt = :now REMOVE lastError, nextAttemptAt, leaseUntil, claimToken",
          ConditionExpression: "#status = :processing AND claimToken = :token",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":processing": "processing",
            ":completed": "completed",
            ":invoice": mirrored.invoiceId,
            ":payment": mirrored.paymentId,
            ":now": new Date().toISOString(),
            ":token": claimToken,
          },
        })
      );
      outcomes.push({ eventId: job.eventId, status: "completed" });
    } catch (error) {
      if (!claimed && error?.name === "ConditionalCheckFailedException") continue;
      if (!claimed) throw error;
      const attempts = Number(job.attempts || 0) + 1;
      const dead = attempts >= 5;
      const nextAttemptAt = new Date(
        Date.now() + Math.min(60, 2 ** attempts) * 60_000
      ).toISOString();
      await client.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { pk: job.pk, sk: job.sk },
          UpdateExpression:
            "SET #status = :status, lastError = :error, nextAttemptAt = :next, updatedAt = :now REMOVE leaseUntil, claimToken",
          ConditionExpression: "claimToken = :token",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": dead ? "dead_letter_pending" : "retry",
            ":error": error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
            ":next": nextAttemptAt,
            ":now": new Date().toISOString(),
            ":token": claimToken,
          },
        })
      );
      if (dead) {
        await deliverDeadLetter({
          ...job,
          status: "dead_letter_pending",
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        });
      }
      outcomes.push({ eventId: job.eventId, status: dead ? "dead_letter" : "retry" });
    }
  }
  return { ok: true, processed: outcomes.length, outcomes };
}
