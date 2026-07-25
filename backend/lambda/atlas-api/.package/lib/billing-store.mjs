import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import {
  applyBillingEvent,
  billingEntitlementTier,
  normalizeBillingEvent,
} from "./billing-state.mjs";
import {
  getPlatformCouponByCode,
  incrementPlatformCouponUse,
} from "./dynamodb.mjs";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function billingTable() {
  return process.env.ATLAS_BILLING_TABLE || "atlas-billing";
}

function workspacesTable() {
  return process.env.ATLAS_WORKSPACES_TABLE || "atlas-workspaces";
}

function checkoutKey(operationId) {
  return { pk: `CHECKOUT#${operationId}`, sk: "OPERATION" };
}

function workspacePlanForBillingTier(tier) {
  if (tier === "growth") return "pro";
  if (tier === "scale") return "enterprise";
  return "starter";
}

/** @param {string} operationId */
export async function getBillingCheckoutOperation(operationId) {
  const normalized = mappingId(operationId, "operationId");
  const row = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: checkoutKey(normalized),
      ConsistentRead: true,
    })
  );
  return row.Item ?? null;
}

/**
 * Idempotently increment Atlas coupon use after a successful checkout payment.
 * @param {string | null | undefined} operationId
 * @param {string} eventId
 */
async function redeemCheckoutCoupon(operationId, eventId) {
  if (!operationId) return;
  const operation = await getBillingCheckoutOperation(operationId);
  const couponCode =
    typeof operation?.couponCode === "string" ? operation.couponCode.trim().toUpperCase() : "";
  if (!couponCode) return;
  const atlasCoupon = await getPlatformCouponByCode(couponCode);
  if (!atlasCoupon) {
    console.info("Checkout coupon skipped (no Atlas platform coupon record)", { couponCode, operationId });
    return;
  }
  const now = new Date().toISOString();
  try {
    await client.send(
      new UpdateCommand({
        TableName: billingTable(),
        Key: checkoutKey(String(operation.operationId)),
        UpdateExpression: "SET couponRedeemedEventId = :eventId, updatedAt = :now",
        ConditionExpression: "attribute_not_exists(couponRedeemedEventId)",
        ExpressionAttributeValues: { ":eventId": eventId, ":now": now },
      })
    );
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") return;
    throw error;
  }
  await incrementPlatformCouponUse(couponCode);
  console.info("Atlas coupon redeemed", { couponCode, operationId, eventId });
}

function refundKey(provider, paymentId, idempotencyKey) {
  return {
    pk: `REFUND#${provider}#PAYMENT#${paymentId}`,
    sk: `REQUEST#${idempotencyKey}`,
  };
}

function checkoutRequestKey(workspaceId, idempotencyKey) {
  return {
    pk: `WORKSPACE#${workspaceId}`,
    sk: `CHECKOUT_REQUEST#${idempotencyKey}`,
  };
}

function checkoutLeaseKey(workspaceId) {
  return { pk: `WORKSPACE#${workspaceId}`, sk: "CHECKOUT#ACTIVE" };
}

/** Expire the workspace checkout lease so a fresh hosted session can be created. */
export async function releaseCheckoutLease(workspaceId, operationId) {
  const now = new Date().toISOString();
  try {
    await client.send(
      new UpdateCommand({
        TableName: billingTable(),
        Key: checkoutLeaseKey(workspaceId),
        UpdateExpression: "SET leaseUntil = :leaseUntil, updatedAt = :now",
        ConditionExpression: "operationId = :operationId",
        ExpressionAttributeValues: {
          ":operationId": String(operationId),
          ":leaseUntil": Math.floor(Date.now() / 1000) - 1,
          ":now": now,
        },
      })
    );
  } catch (error) {
    if (error?.name !== "ConditionalCheckFailedException") throw error;
  }
}

function providerCustomerKey(provider, customerId, workspaceId) {
  return {
    pk: `PROVIDER#${provider}#CUSTOMER#${customerId}`,
    sk: `WORKSPACE#${workspaceId}`,
  };
}

function providerSubscriptionKey(provider, subscriptionId) {
  return { pk: `PROVIDER#${provider}#SUBSCRIPTION#${subscriptionId}`, sk: "BINDING" };
}

function providerPaymentKey(provider, paymentId) {
  return { pk: `PROVIDER#${provider}#PAYMENT#${paymentId}`, sk: "PAYMENT" };
}

function reconciliationLockKey(provider, subscriptionId) {
  return { pk: `LOCK#${provider}#SUBSCRIPTION#${subscriptionId}`, sk: "RECONCILIATION" };
}

function mappingId(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error(`${field} is invalid`);
  }
  return normalized;
}

export function providerCheckoutUrl(value, provider) {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  const allowed =
    provider === "dodo"
      ? host === "dodopayments.com" || host.endsWith(".dodopayments.com")
      : host === "zoho.com" ||
        host.endsWith(".zoho.com") ||
        host === "zoho.in" ||
        host.endsWith(".zoho.in");
  if (url.protocol !== "https:" || !allowed) {
    throw new Error("provider checkout URL is not allowlisted");
  }
  return url;
}

export async function createBillingCheckoutOperation(input, options = {}) {
  const allowStaleLeaseRetry = options.allowStaleLeaseRetry !== false;
  const workspaceId = mappingId(input.workspaceId, "workspaceId");
  const idempotencyKey = mappingId(input.idempotencyKey, "idempotencyKey");
  const requestHash = String(input.requestHash || "");
  if (!/^[a-f0-9]{64}$/.test(requestHash)) throw new Error("requestHash is invalid");
  const provider = String(input.provider || "").toLowerCase();
  if (!["dodo", "zoho"].includes(provider)) throw new Error("Invalid billing provider");
  const tier = String(input.tier || "").toLowerCase();
  if (!["starter", "launch", "growth"].includes(tier)) throw new Error("Invalid checkout tier");
  const billingCountry = String(input.billingCountry || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(billingCountry)) throw new Error("Invalid billing country");

  const requestKey = checkoutRequestKey(workspaceId, idempotencyKey);
  const existingRequest = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: requestKey,
      ConsistentRead: true,
    })
  );
  if (existingRequest.Item?.operationId) {
    const existingOperation = await client.send(
      new GetCommand({
        TableName: billingTable(),
        Key: checkoutKey(String(existingRequest.Item.operationId)),
        ConsistentRead: true,
      })
    );
    if (existingOperation.Item) return { ...existingOperation.Item, reused: true };
  }

  const operationId = randomUUID();
  const now = new Date().toISOString();
  const nowEpoch = Math.floor(Date.now() / 1000);
  const item = {
    ...checkoutKey(operationId),
    entityType: "billing_checkout_operation",
    operationId,
    idempotencyKey,
    requestHash,
    workspaceId,
    provider,
    tier,
    billingCountry,
    couponCode: input.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
    status: "pending_provider",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: billingTable(),
              Item: item,
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: billingTable(),
              Item: {
                ...requestKey,
                entityType: "billing_checkout_request",
                operationId,
                workspaceId,
                idempotencyKey,
                createdAt: now,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Update: {
              TableName: billingTable(),
              Key: checkoutLeaseKey(workspaceId),
              UpdateExpression:
                "SET operationId = :operationId, leaseUntil = :leaseUntil, updatedAt = :now",
              ConditionExpression:
                "attribute_not_exists(leaseUntil) OR leaseUntil < :nowEpoch",
              ExpressionAttributeValues: {
                ":operationId": operationId,
                ":leaseUntil": nowEpoch + 15 * 60,
                ":nowEpoch": nowEpoch,
                ":now": now,
              },
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error?.name !== "TransactionCanceledException") throw error;
    const winner = await client.send(
      new GetCommand({
        TableName: billingTable(),
        Key: requestKey,
        ConsistentRead: true,
      })
    );
    if (!winner.Item?.operationId) {
      const lease = await client.send(
        new GetCommand({
          TableName: billingTable(),
          Key: checkoutLeaseKey(workspaceId),
          ConsistentRead: true,
        })
      );
      if (lease.Item?.operationId) {
        const leasedOperation = await client.send(
          new GetCommand({
            TableName: billingTable(),
            Key: checkoutKey(String(lease.Item.operationId)),
            ConsistentRead: true,
          })
        );
        if (
          leasedOperation.Item?.requestHash === requestHash &&
          leasedOperation.Item?.workspaceId === workspaceId
        ) {
          // Only reuse in-flight checkouts. Dodo checkout_url is single-use; returning a
          // completed provider_created session causes "payment link expired" on retry.
          const leasedStatus = String(leasedOperation.Item.status || "");
          if (leasedStatus === "pending_provider" || leasedStatus === "provider_call_started") {
            return { ...leasedOperation.Item, reused: true };
          }
          if (leasedStatus === "provider_created" && allowStaleLeaseRetry) {
            await releaseCheckoutLease(workspaceId, String(lease.Item.operationId));
            return createBillingCheckoutOperation(input, { allowStaleLeaseRetry: false });
          }
        }
      }
      throw Object.assign(new Error("Another checkout is already in progress"), {
        statusCode: 409,
      });
    }
    const existingOperation = await client.send(
      new GetCommand({
        TableName: billingTable(),
        Key: checkoutKey(String(winner.Item.operationId)),
        ConsistentRead: true,
      })
    );
    if (!existingOperation.Item) throw error;
    return { ...existingOperation.Item, reused: true };
  }
  return item;
}

export async function recordProviderCheckout(input) {
  const operationId = mappingId(input.operationId, "operationId");
  const provider = String(input.provider || "").toLowerCase();
  const operationRow = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: checkoutKey(operationId),
      ConsistentRead: true,
    })
  );
  const operation = operationRow.Item;
  if (!operation || operation.provider !== provider || operation.status !== "provider_call_started") {
    throw new Error("Checkout operation is missing or provider creation was not started");
  }

  const customerId = input.providerCustomerId
    ? mappingId(input.providerCustomerId, "providerCustomerId")
    : null;
  const subscriptionId = input.providerSubscriptionId
    ? mappingId(input.providerSubscriptionId, "providerSubscriptionId")
    : null;
  const checkoutId = mappingId(input.providerCheckoutId, "providerCheckoutId");
  const checkoutUrl = providerCheckoutUrl(input.checkoutUrl, provider);
  const now = new Date().toISOString();
  const writes = [
    {
      Update: {
        TableName: billingTable(),
        Key: checkoutKey(operationId),
        UpdateExpression:
          "SET #status = :created, providerCheckoutId = :checkoutId, checkoutUrl = :checkoutUrl, providerCustomerId = :customerId, providerSubscriptionId = :subscriptionId, updatedAt = :now",
        ConditionExpression: "#status = :pending AND #provider = :provider",
        ExpressionAttributeNames: { "#status": "status", "#provider": "provider" },
        ExpressionAttributeValues: {
          ":created": "provider_created",
          ":pending": "provider_call_started",
          ":provider": provider,
          ":checkoutId": checkoutId,
          ":checkoutUrl": checkoutUrl.toString(),
          ":customerId": customerId,
          ":subscriptionId": subscriptionId,
          ":now": now,
        },
      },
    },
    {
      // Release the workspace lease immediately. Hosted checkout URLs (especially Dodo)
      // are single-use; holding the lease for 30m caused retries to reuse an expired link.
      Update: {
        TableName: billingTable(),
        Key: checkoutLeaseKey(operation.workspaceId),
        UpdateExpression: "SET leaseUntil = :leaseUntil, updatedAt = :now",
        ConditionExpression: "operationId = :operationId",
        ExpressionAttributeValues: {
          ":operationId": operationId,
          ":leaseUntil": Math.floor(Date.now() / 1000) - 1,
          ":now": now,
        },
      },
    },
    {
      Update: {
        TableName: workspacesTable(),
        Key: { pk: `WORKSPACE#${operation.workspaceId}`, sk: "META" },
        UpdateExpression:
          "SET billingLastCheckoutOperationId = :operationId, updatedAt = :now",
        ExpressionAttributeValues: {
          ":operationId": operationId,
          ":now": now,
        },
      },
    },
  ];
  if (customerId) {
    writes.push({
      Put: {
        TableName: billingTable(),
        Item: {
          ...providerCustomerKey(provider, customerId, operation.workspaceId),
          entityType: "billing_customer_binding",
          provider,
          providerCustomerId: customerId,
          workspaceId: operation.workspaceId,
          operationId,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": operation.workspaceId },
      },
    });
  }
  if (subscriptionId) {
    writes.push({
      Put: {
        TableName: billingTable(),
        Item: {
          ...providerSubscriptionKey(provider, subscriptionId),
          entityType: "billing_subscription_binding",
          provider,
          providerSubscriptionId: subscriptionId,
          workspaceId: operation.workspaceId,
          operationId,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": operation.workspaceId },
      },
    });
  }
  await client.send(new TransactWriteCommand({ TransactItems: writes }));
  return {
    ...operation,
    status: "provider_created",
    providerCheckoutId: checkoutId,
    checkoutUrl: checkoutUrl.toString(),
  };
}

export async function markBillingCheckoutProviderCallStarted(operationId, provider) {
  const normalizedOperationId = mappingId(operationId, "operationId");
  try {
    await client.send(
      new UpdateCommand({
        TableName: billingTable(),
        Key: checkoutKey(normalizedOperationId),
        UpdateExpression: "SET #status = :started, providerCallStartedAt = :now, updatedAt = :now",
        ConditionExpression: "#status = :pending AND #provider = :provider",
        ExpressionAttributeNames: { "#status": "status", "#provider": "provider" },
        ExpressionAttributeValues: {
          ":started": "provider_call_started",
          ":pending": "pending_provider",
          ":provider": provider,
          ":now": new Date().toISOString(),
        },
      })
    );
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      throw Object.assign(new Error("Checkout provider call is already in progress"), {
        statusCode: 409,
      });
    }
    throw error;
  }
}

export async function markBillingCheckoutReconciliationFailed(operationId) {
  const normalizedOperationId = mappingId(operationId, "operationId");
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  try {
    await client.send(
      new UpdateCommand({
        TableName: billingTable(),
        Key: checkoutKey(normalizedOperationId),
        UpdateExpression: "SET #status = :failed, updatedAt = :now",
        ConditionExpression:
          "#status = :started AND providerCallStartedAt <= :cutoff",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":started": "provider_call_started",
          ":failed": "reconciliation_failed",
          ":cutoff": cutoff,
          ":now": new Date().toISOString(),
        },
      })
    );
    return true;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

export async function createBillingRefundOperation(input) {
  const provider = String(input.provider || "").toLowerCase();
  if (!["dodo", "zoho"].includes(provider)) throw new Error("Invalid billing provider");
  const paymentId = mappingId(input.paymentId, "paymentId");
  const idempotencyKey = mappingId(input.idempotencyKey, "idempotencyKey");
  const amountMinor = Number(input.amountMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("amountMinor must be a positive integer");
  }
  const key = refundKey(provider, paymentId, idempotencyKey);
  const existing = await client.send(
    new GetCommand({ TableName: billingTable(), Key: key, ConsistentRead: true })
  );
  if (existing.Item) {
    if (
      existing.Item.amountMinor !== amountMinor ||
      existing.Item.provider !== provider
    ) {
      throw Object.assign(new Error("Idempotency key was reused with different refund data"), {
        statusCode: 409,
      });
    }
    return { ...existing.Item, reused: true };
  }
  const paymentRow = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: providerPaymentKey(provider, paymentId),
      ConsistentRead: true,
    })
  );
  const payment = paymentRow.Item;
  if (!payment || payment.status !== "succeeded") {
    throw Object.assign(new Error("Refund payment is not a captured Atlas payment"), {
      statusCode: 404,
    });
  }
  const capturedAmountMinor = Number(payment.capturedAmountMinor);
  const refundedMinor = Number(payment.refundedMinor || 0);
  if (
    !Number.isSafeInteger(capturedAmountMinor) ||
    amountMinor > capturedAmountMinor - refundedMinor
  ) {
    throw Object.assign(new Error("Refund exceeds the remaining captured amount"), {
      statusCode: 409,
    });
  }
  const item = {
    ...key,
    entityType: "billing_refund_operation",
    operationId: randomUUID(),
    provider,
    paymentId,
    amountMinor,
    reason: String(input.reason || "").slice(0, 500),
    status: "approved",
    approvedBy: String(input.approvedBy || "platform-owner"),
    createdAt: new Date().toISOString(),
  };
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: billingTable(),
              Item: item,
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Update: {
              TableName: billingTable(),
              Key: providerPaymentKey(provider, paymentId),
              UpdateExpression: "ADD refundedMinor :amount",
              ConditionExpression:
                "#status = :succeeded AND refundedMinor <= :remainingLimit",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":succeeded": "succeeded",
                ":amount": amountMinor,
                ":remainingLimit": capturedAmountMinor - amountMinor,
              },
            },
          },
        ],
      })
    );
    return { ...item, reused: false };
  } catch (error) {
    if (error?.name !== "TransactionCanceledException") throw error;
    const winner = await client.send(
      new GetCommand({ TableName: billingTable(), Key: key, ConsistentRead: true })
    );
    if (
      !winner.Item ||
      winner.Item.amountMinor !== amountMinor ||
      winner.Item.provider !== provider
    ) {
      throw Object.assign(new Error("Refund exceeds the remaining captured amount"), {
        statusCode: 409,
      });
    }
    return { ...winner.Item, reused: true };
  }
}

export async function markBillingRefundStarted(operation) {
  await client.send(
    new UpdateCommand({
      TableName: billingTable(),
      Key: { pk: operation.pk, sk: operation.sk },
      UpdateExpression: "SET #status = :started, providerCallStartedAt = :now",
      ConditionExpression: "#status = :approved",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":approved": "approved",
        ":started": "provider_call_started",
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function markBillingRefundCompleted(operation, providerRefundId) {
  await client.send(
    new UpdateCommand({
      TableName: billingTable(),
      Key: { pk: operation.pk, sk: operation.sk },
      UpdateExpression: "SET #status = :completed, providerRefundId = :refundId, completedAt = :now",
      ConditionExpression: "#status = :started",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":started": "provider_call_started",
        ":completed": "completed",
        ":refundId": mappingId(providerRefundId, "providerRefundId"),
        ":now": new Date().toISOString(),
      },
    })
  );
}

export function billingLedgerKeys(event) {
  return {
    event: {
      pk: `PROVIDER#${event.provider}#EVENT#${event.eventId}`,
      sk: "EVENT",
    },
    timeline: {
      pk: `WORKSPACE#${event.workspaceId}`,
      sk: `EVENT#${event.occurredAt}#${event.provider}#${event.eventId}`,
    },
    binding: {
      ...providerSubscriptionKey(event.provider, event.providerSubscriptionId),
    },
    current: {
      pk: `WORKSPACE#${event.workspaceId}`,
      sk: "SUBSCRIPTION#CURRENT",
    },
  };
}

function subscriptionFromItem(item) {
  if (!item) return null;
  return {
    workspaceId: String(item.workspaceId),
    provider: String(item.provider),
    providerSubscriptionId: String(item.providerSubscriptionId),
    providerCustomerId: item.providerCustomerId ? String(item.providerCustomerId) : null,
    tier: String(item.tier),
    status: String(item.status),
    currentPeriodEnd: item.currentPeriodEnd ? String(item.currentPeriodEnd) : null,
    graceUntil: item.graceUntil ? String(item.graceUntil) : null,
    cancelAtPeriodEnd: item.cancelAtPeriodEnd === true,
    lastEventAt: String(item.lastEventAt),
    lastEventId: String(item.lastEventId),
    providerSequence: Number(item.providerSequence),
    updatedAt: String(item.updatedAt),
  };
}

export async function getBillingSubscription(workspaceId) {
  const row = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: { pk: `WORKSPACE#${workspaceId}`, sk: "SUBSCRIPTION#CURRENT" },
      ConsistentRead: true,
    })
  );
  return subscriptionFromItem(row.Item);
}

/** Optimistically mark cancel-at-period-end after provider API succeeds. */
export async function markBillingCancelScheduled(workspaceId) {
  const now = new Date().toISOString();
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: billingTable(),
            Key: { pk: `WORKSPACE#${workspaceId}`, sk: "SUBSCRIPTION#CURRENT" },
            UpdateExpression: "SET cancelAtPeriodEnd = :true, updatedAt = :now",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":true": true, ":now": now },
          },
        },
        {
          Update: {
            TableName: workspacesTable(),
            Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
            UpdateExpression:
              "SET billingCancelAtPeriodEnd = :true, billingUpdatedAt = :now, updatedAt = :now",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":true": true, ":now": now },
          },
        },
      ],
    })
  );
}

/** Clears cancel-at-period-end after provider uncancel succeeds. */
export async function markBillingCancelCleared(workspaceId) {
  const now = new Date().toISOString();
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: billingTable(),
            Key: { pk: `WORKSPACE#${workspaceId}`, sk: "SUBSCRIPTION#CURRENT" },
            UpdateExpression: "SET cancelAtPeriodEnd = :false, updatedAt = :now",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":false": false, ":now": now },
          },
        },
        {
          Update: {
            TableName: workspacesTable(),
            Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
            UpdateExpression:
              "SET billingCancelAtPeriodEnd = :false, billingUpdatedAt = :now, updatedAt = :now",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":false": false, ":now": now },
          },
        },
      ],
    })
  );
}

async function getBillingEvent(provider, eventId) {
  const row = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: { pk: `PROVIDER#${provider}#EVENT#${eventId}`, sk: "EVENT" },
      ConsistentRead: true,
    })
  );
  return row.Item ?? null;
}

export async function workspaceRecordExists(workspaceId) {
  const normalizedWorkspaceId = mappingId(workspaceId, "workspaceId");
  const row = await client.send(
    new GetCommand({
      TableName: workspacesTable(),
      Key: { pk: `WORKSPACE#${normalizedWorkspaceId}`, sk: "META" },
      ConsistentRead: true,
    })
  );
  return Boolean(row.Item);
}

export async function resolveBillingWorkspace(input) {
  const candidates = [];
  const subscriptionRow = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: providerSubscriptionKey(input.provider, input.providerSubscriptionId),
      ConsistentRead: true,
    })
  );
  if (subscriptionRow.Item?.workspaceId) candidates.push(String(subscriptionRow.Item.workspaceId));

  if (input.checkoutOperationId) {
    const operationId = mappingId(input.checkoutOperationId, "checkoutOperationId");
    const operationRow = await client.send(
      new GetCommand({
        TableName: billingTable(),
        Key: checkoutKey(operationId),
        ConsistentRead: true,
      })
    );
    if (
      operationRow.Item?.provider === input.provider &&
      operationRow.Item?.status === "provider_created" &&
      operationRow.Item?.workspaceId
    ) {
      candidates.push(String(operationRow.Item.workspaceId));
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(
      unique.length > 1
        ? "Provider billing mappings disagree"
        : "No server-owned billing mapping exists"
    );
  }
  return unique[0];
}

export async function ensureProviderSubscriptionBinding(input) {
  const provider = String(input.provider || "").toLowerCase();
  const subscriptionId = mappingId(input.providerSubscriptionId, "providerSubscriptionId");
  const workspaceId = await resolveBillingWorkspace({
    ...input,
    provider,
    providerSubscriptionId: subscriptionId,
  });
  const bindingKey = providerSubscriptionKey(provider, subscriptionId);
  const existing = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: bindingKey,
      ConsistentRead: true,
    })
  );
  const operationId =
    input.checkoutOperationId || existing.Item?.operationId || null;
  await client.send(
    new PutCommand({
      TableName: billingTable(),
      Item: {
        ...bindingKey,
        entityType: "billing_subscription_binding",
        provider,
        providerSubscriptionId: subscriptionId,
        workspaceId,
        operationId,
        updatedAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
      ExpressionAttributeValues: { ":workspaceId": workspaceId },
    })
  );
  return workspaceId;
}

export async function withBillingReconciliationLock(provider, subscriptionId, work) {
  const normalizedProvider = String(provider || "").toLowerCase();
  const normalizedSubscriptionId = mappingId(subscriptionId, "providerSubscriptionId");
  const workspaceId = await resolveBillingWorkspace({
    provider: normalizedProvider,
    providerSubscriptionId: normalizedSubscriptionId,
  });
  const key = reconciliationLockKey(normalizedProvider, normalizedSubscriptionId);
  const token = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  try {
    await client.send(
      new UpdateCommand({
        TableName: billingTable(),
        Key: key,
        UpdateExpression: "SET reconciliationLockToken = :token, reconciliationLockUntil = :until",
        ConditionExpression:
          "attribute_not_exists(reconciliationLockUntil) OR reconciliationLockUntil < :now",
        ExpressionAttributeValues: {
          ":token": token,
          ":until": now + 30,
          ":now": now,
        },
      })
    );
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      throw Object.assign(new Error("Billing reconciliation is already in progress"), {
        statusCode: 503,
      });
    }
    throw error;
  }

  try {
    return await work({ workspaceId });
  } finally {
    try {
      await client.send(
        new UpdateCommand({
          TableName: billingTable(),
          Key: key,
          UpdateExpression: "REMOVE reconciliationLockToken, reconciliationLockUntil",
          ConditionExpression: "reconciliationLockToken = :token",
          ExpressionAttributeValues: { ":token": token },
        })
      );
    } catch (error) {
      if (error?.name !== "ConditionalCheckFailedException") throw error;
    }
  }
}

export function buildBillingTransactionItems(event, transition, receivedAt) {
  const keys = billingLedgerKeys(event);
  const outcome = transition.applied ? "applied" : "ignored_stale";
  const eventRecord = {
    ...keys.event,
    entityType: "billing_event",
    provider: event.provider,
    eventId: event.eventId,
    eventType: event.eventType,
    workspaceId: event.workspaceId,
    providerSubscriptionId: event.providerSubscriptionId,
    providerCustomerId: event.providerCustomerId,
    providerPaymentId: event.providerPaymentId,
    tier: event.tier,
    status: event.status,
    occurredAt: event.occurredAt,
    providerSequence: event.providerSequence,
    receivedAt,
    outcome,
    ...(event.amountMinor == null
      ? {}
      : { amountMinor: event.amountMinor, currency: event.currency }),
  };
  const timelineRecord = { ...eventRecord, ...keys.timeline, entityType: "billing_timeline_event" };
  const eventWrites = [
    {
      Put: {
        TableName: billingTable(),
        Item: eventRecord,
        ConditionExpression: "attribute_not_exists(pk)",
      },
    },
    {
      Update: {
        TableName: billingTable(),
        Key: keys.binding,
        UpdateExpression:
          "SET entityType = :entityType, provider = :provider, providerSubscriptionId = :subscriptionId, workspaceId = :workspaceId, updatedAt = :updatedAt",
        ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
        ExpressionAttributeValues: {
          ":entityType": "billing_subscription_binding",
          ":provider": event.provider,
          ":subscriptionId": event.providerSubscriptionId,
          ":workspaceId": event.workspaceId,
          ":updatedAt": receivedAt,
        },
      },
    },
    {
      Put: {
        TableName: billingTable(),
        Item: timelineRecord,
        ConditionExpression: "attribute_not_exists(pk)",
      },
    },
  ];
  if (event.providerCustomerId) {
    eventWrites.push({
      Put: {
        TableName: billingTable(),
        Item: {
          ...providerCustomerKey(
            event.provider,
            event.providerCustomerId,
            event.workspaceId
          ),
          entityType: "billing_customer_binding",
          provider: event.provider,
          providerCustomerId: event.providerCustomerId,
          workspaceId: event.workspaceId,
          updatedAt: receivedAt,
        },
        ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": event.workspaceId },
      },
    });
  }
  if (event.amountMinor != null && event.providerPaymentId) {
    eventWrites.push({
      Update: {
        TableName: billingTable(),
        Key: providerPaymentKey(event.provider, event.providerPaymentId),
        UpdateExpression:
          "SET entityType = if_not_exists(entityType, :entityType), provider = if_not_exists(provider, :provider), providerPaymentId = if_not_exists(providerPaymentId, :paymentId), workspaceId = if_not_exists(workspaceId, :workspaceId), firstEventId = if_not_exists(firstEventId, :eventId), #status = if_not_exists(#status, :succeeded), capturedAmountMinor = if_not_exists(capturedAmountMinor, :amount), refundedMinor = if_not_exists(refundedMinor, :zero), currency = if_not_exists(currency, :currency), occurredAt = if_not_exists(occurredAt, :occurredAt)",
        ConditionExpression:
          "attribute_not_exists(capturedAmountMinor) OR (capturedAmountMinor = :amount AND currency = :currency AND workspaceId = :workspaceId)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":entityType": "billing_payment",
          ":provider": event.provider,
          ":paymentId": event.providerPaymentId,
          ":workspaceId": event.workspaceId,
          ":eventId": event.eventId,
          ":succeeded": "succeeded",
          ":amount": event.amountMinor,
          ":zero": 0,
          ":currency": event.currency,
          ":occurredAt": event.occurredAt,
        },
      },
    });
    eventWrites.push({
      Update: {
        TableName: billingTable(),
        Key: {
          pk: "ACCOUNTING#ZOHO_BOOKS",
          sk: `PAYMENT#${event.provider}#${event.providerPaymentId}`,
        },
        UpdateExpression:
          "SET entityType = if_not_exists(entityType, :entityType), #status = if_not_exists(#status, :pending), attempts = if_not_exists(attempts, :zero), provider = if_not_exists(provider, :provider), eventId = if_not_exists(eventId, :eventId), workspaceId = if_not_exists(workspaceId, :workspaceId), providerCustomerId = if_not_exists(providerCustomerId, :customerId), providerPaymentId = if_not_exists(providerPaymentId, :paymentId), amountMinor = if_not_exists(amountMinor, :amount), currency = if_not_exists(currency, :currency), occurredAt = if_not_exists(occurredAt, :occurredAt), createdAt = if_not_exists(createdAt, :createdAt)",
        ConditionExpression:
          "attribute_not_exists(amountMinor) OR (amountMinor = :amount AND currency = :currency AND workspaceId = :workspaceId)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":entityType": "billing_accounting_job",
          ":pending": "pending",
          ":zero": 0,
          ":provider": event.provider,
          ":eventId": event.eventId,
          ":workspaceId": event.workspaceId,
          ":customerId": event.providerCustomerId,
          ":paymentId": event.providerPaymentId,
          ":amount": event.amountMinor,
          ":currency": event.currency,
          ":occurredAt": event.occurredAt,
          ":createdAt": receivedAt,
        },
      },
    });
  }
  if (!transition.applied) return eventWrites;

  const subscription = transition.subscription;
  const previous = transition.previous;
  const entitlementTier = billingEntitlementTier(subscription, receivedAt);
  const workspaceSet = [
    "billingProvider = :provider",
    "billingStatus = :status",
    "billingSubscriptionId = :subscriptionId",
    "billingCustomerId = :customerId",
    "billingCurrentPeriodEnd = :periodEnd",
    "billingGraceUntil = :graceUntil",
    "billingCancelAtPeriodEnd = :cancelAtPeriodEnd",
    "billingLastEventId = :eventId",
    "billingUpdatedAt = :eventAt",
    "updatedAt = :receivedAt",
  ];
  if (entitlementTier) workspaceSet.push("billingEntitlementTier = :entitlementTier");
  /** @type {Record<string, unknown>} */
  const workspaceValues = {
    ":provider": event.provider,
    ":status": subscription.status,
    ":subscriptionId": event.providerSubscriptionId,
    ":customerId": subscription.providerCustomerId,
    ":periodEnd": subscription.currentPeriodEnd,
    ":graceUntil": subscription.graceUntil,
    ":cancelAtPeriodEnd": subscription.cancelAtPeriodEnd,
    ":eventId": event.eventId,
    ":eventAt": event.occurredAt,
    ":receivedAt": receivedAt,
    ...(entitlementTier ? { ":entitlementTier": entitlementTier } : {}),
  };
  if (entitlementTier) {
    workspaceSet.push(
      "purchasedBillingTier = :entitlementTier",
      "billingTier = :entitlementTier",
      "#plan = :workspacePlan",
      "trialEndsAt = :trialEndsAt",
      "trialPlan = :trialPlan"
    );
    workspaceValues[":workspacePlan"] = workspacePlanForBillingTier(entitlementTier);
    workspaceValues[":trialEndsAt"] = null;
    workspaceValues[":trialPlan"] = null;
  }

  return [
    ...eventWrites,
    {
      Put: {
        TableName: billingTable(),
        Item: {
          ...keys.current,
          entityType: "billing_subscription",
          ...subscription,
        },
        ConditionExpression: previous
          ? "lastEventId = :previousEventId AND providerSequence = :previousSequence"
          : "attribute_not_exists(pk)",
        ExpressionAttributeValues: previous
          ? {
              ":previousEventId": previous.lastEventId,
              ":previousSequence": previous.providerSequence,
            }
          : undefined,
      },
    },
    {
      Update: {
        TableName: workspacesTable(),
        Key: { pk: `WORKSPACE#${event.workspaceId}`, sk: "META" },
        UpdateExpression: entitlementTier
          ? `SET ${workspaceSet.join(", ")}`
          : `SET ${workspaceSet.join(", ")} REMOVE billingEntitlementTier`,
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: entitlementTier ? { "#plan": "plan" } : undefined,
        ExpressionAttributeValues: workspaceValues,
      },
    },
  ];
}

/**
 * Persist an event only after its provider adapter has verified the raw webhook.
 * The immutable ledger, subscription projection, and workspace entitlement update
 * are committed atomically.
 */
export async function applyVerifiedBillingEvent(input) {
  const unboundEvent = normalizeBillingEvent({ ...input, workspaceId: "unresolved" });
  const workspaceId = await resolveBillingWorkspace({
    ...input,
    provider: unboundEvent.provider,
    providerSubscriptionId: unboundEvent.providerSubscriptionId,
  });
  const event = normalizeBillingEvent({ ...unboundEvent, workspaceId });
  if (await getBillingEvent(event.provider, event.eventId)) {
    return { duplicate: true, applied: false };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await getBillingSubscription(event.workspaceId);
    const transition = applyBillingEvent(current, event);
    const receivedAt = new Date().toISOString();
    try {
      await client.send(
        new TransactWriteCommand({
          TransactItems: buildBillingTransactionItems(event, transition, receivedAt),
        })
      );
      if (
        transition.applied &&
        (event.eventType === "subscription.active" || event.eventType === "payment.succeeded")
      ) {
        const binding = await client.send(
          new GetCommand({
            TableName: billingTable(),
            Key: providerSubscriptionKey(event.provider, event.providerSubscriptionId),
            ConsistentRead: true,
          })
        );
        let checkoutOperationId =
          input.checkoutOperationId ?? binding.Item?.operationId ?? null;
        if (!checkoutOperationId) {
          const workspaceRow = await client.send(
            new GetCommand({
              TableName: workspacesTable(),
              Key: { pk: `WORKSPACE#${event.workspaceId}`, sk: "META" },
              ConsistentRead: true,
            })
          );
          checkoutOperationId = workspaceRow.Item?.billingLastCheckoutOperationId ?? null;
        }
        await redeemCheckoutCoupon(checkoutOperationId, event.eventId);
      }
      return {
        duplicate: false,
        applied: transition.applied,
        subscription: transition.subscription,
      };
    } catch (error) {
      if (error?.name !== "TransactionCanceledException") throw error;
      if (await getBillingEvent(event.provider, event.eventId)) {
        return { duplicate: true, applied: false };
      }
      if (attempt === 1) throw error;
    }
  }
}

function overageRecordKey(workspaceId, month) {
  return { pk: `WORKSPACE#${workspaceId}`, sk: `OVERAGE#${month}` };
}

/**
 * @param {string} workspaceId
 * @param {string} month YYYY-MM
 */
export async function getWorkspaceOverage(workspaceId, month) {
  const row = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: overageRecordKey(workspaceId, month),
      ConsistentRead: true,
    })
  );
  const item = row.Item ?? null;
  // Soft-cleared sandbox rows stay in Dynamo (no DeleteItem on shared tables).
  if (item?.status === "cleared") return null;
  return item;
}

/**
 * Soft-clear monthly overage (sandbox / test). Prefer Put over DeleteItem on shared tables.
 * @param {string} workspaceId
 * @param {string} month YYYY-MM
 */
export async function deleteWorkspaceOverage(workspaceId, month) {
  const existing = await client.send(
    new GetCommand({
      TableName: billingTable(),
      Key: overageRecordKey(workspaceId, month),
      ConsistentRead: true,
    })
  );
  const prev = existing.Item ?? null;
  if (!prev || prev.status === "cleared") {
    return { ok: true, month, cleared: false };
  }
  if (prev.status === "paid" && prev.providerPaymentId) {
    throw Object.assign(
      new Error("Paid overage with a provider payment id cannot be cleared here"),
      { statusCode: 403 },
    );
  }
  const now = new Date().toISOString();
  await client.send(
    new PutCommand({
      TableName: billingTable(),
      Item: {
        ...overageRecordKey(workspaceId, month),
        entityType: "OVERAGE",
        workspaceId,
        month,
        amountUsd: prev.amountUsd ?? null,
        status: "cleared",
        provider: prev.provider ?? null,
        providerPaymentId: null,
        operationId: prev.operationId ?? null,
        paidAt: null,
        note: "sandbox-soft-clear",
        createdAt: prev.createdAt ?? now,
        updatedAt: now,
        clearedAt: now,
      },
    })
  );
  return { ok: true, month, cleared: true };
}

/**
 * @param {{
 *   workspaceId: string;
 *   month: string;
 *   amountUsd: number;
 *   status: "paid" | "accepted" | "failed";
 *   provider?: string | null;
 *   providerPaymentId?: string | null;
 *   operationId?: string | null;
 *   paidAt?: string | null;
 *   note?: string | null;
 * }} input
 */
export async function recordWorkspaceOverageCharge(input) {
  const now = new Date().toISOString();
  const item = {
    entityType: "OVERAGE",
    workspaceId: input.workspaceId,
    month: input.month,
    amountUsd: input.amountUsd,
    status: input.status,
    provider: input.provider ?? null,
    providerPaymentId: input.providerPaymentId ?? null,
    operationId: input.operationId ?? null,
    paidAt: input.paidAt ?? (input.status === "paid" ? now : null),
    note: input.note ?? null,
    updatedAt: now,
    createdAt: now,
  };
  await client.send(
    new PutCommand({
      TableName: billingTable(),
      Item: { ...overageRecordKey(input.workspaceId, input.month), ...item },
      ConditionExpression: "attribute_not_exists(#status) OR #status <> :paid",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":paid": "paid" },
    })
  );
  return item;
}

/**
 * Mark overage paid from a Dodo payment.succeeded webhook.
 * @param {string} workspaceId
 * @param {string} month
 * @param {string} paymentId
 */
export async function markWorkspaceOveragePaidFromWebhook(workspaceId, month, paymentId) {
  const existing = await getWorkspaceOverage(workspaceId, month);
  if (existing?.status === "paid") return existing;
  const now = new Date().toISOString();
  await client.send(
    new PutCommand({
      TableName: billingTable(),
      Item: {
        ...overageRecordKey(workspaceId, month),
        entityType: "OVERAGE",
        workspaceId,
        month,
        amountUsd: existing?.amountUsd ?? null,
        status: "paid",
        provider: "dodo",
        providerPaymentId: paymentId,
        operationId: existing?.operationId ?? null,
        paidAt: now,
        note: existing?.note ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
    })
  );
  return getWorkspaceOverage(workspaceId, month);
}

