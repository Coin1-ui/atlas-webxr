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

function checkoutRequestKey(workspaceId, idempotencyKey) {
  return {
    pk: `WORKSPACE#${workspaceId}`,
    sk: `CHECKOUT_REQUEST#${idempotencyKey}`,
  };
}

function providerCustomerKey(provider, customerId) {
  return { pk: `PROVIDER#${provider}#CUSTOMER#${customerId}`, sk: "BINDING" };
}

function providerSubscriptionKey(provider, subscriptionId) {
  return { pk: `PROVIDER#${provider}#SUBSCRIPTION#${subscriptionId}`, sk: "BINDING" };
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

export async function createBillingCheckoutOperation(input) {
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
    if (!winner.Item?.operationId) throw error;
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
  ];
  if (customerId) {
    writes.push({
      Put: {
        TableName: billingTable(),
        Item: {
          ...providerCustomerKey(provider, customerId),
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

async function resolveBillingWorkspace(input) {
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

  if (input.providerCustomerId) {
    const customerId = mappingId(input.providerCustomerId, "providerCustomerId");
    const customerRow = await client.send(
      new GetCommand({
        TableName: billingTable(),
        Key: providerCustomerKey(input.provider, customerId),
        ConsistentRead: true,
      })
    );
    if (customerRow.Item?.workspaceId) candidates.push(String(customerRow.Item.workspaceId));
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
  await client.send(
    new PutCommand({
      TableName: billingTable(),
      Item: {
        ...providerSubscriptionKey(provider, subscriptionId),
        entityType: "billing_subscription_binding",
        provider,
        providerSubscriptionId: subscriptionId,
        workspaceId,
        operationId: input.checkoutOperationId || null,
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
      Put: {
        TableName: billingTable(),
        Item: {
          ...keys.binding,
          entityType: "billing_subscription_binding",
          provider: event.provider,
          providerSubscriptionId: event.providerSubscriptionId,
          workspaceId: event.workspaceId,
          updatedAt: receivedAt,
        },
        ConditionExpression: "attribute_not_exists(pk) OR workspaceId = :workspaceId",
        ExpressionAttributeValues: { ":workspaceId": event.workspaceId },
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
  if (!transition.applied) return eventWrites;

  const subscription = transition.subscription;
  const previous = transition.previous;
  const entitlementTier = billingEntitlementTier(subscription, receivedAt);
  const workspaceSet = [
    "billingProvider = :provider",
    "billingStatus = :status",
    "billingSubscriptionId = :subscriptionId",
    "billingCurrentPeriodEnd = :periodEnd",
    "billingGraceUntil = :graceUntil",
    "billingCancelAtPeriodEnd = :cancelAtPeriodEnd",
    "billingLastEventId = :eventId",
    "billingUpdatedAt = :eventAt",
    "updatedAt = :receivedAt",
  ];
  if (entitlementTier) workspaceSet.push("billingEntitlementTier = :entitlementTier");

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
        ExpressionAttributeValues: {
          ":provider": event.provider,
          ":status": subscription.status,
          ":subscriptionId": event.providerSubscriptionId,
          ":periodEnd": subscription.currentPeriodEnd,
          ":graceUntil": subscription.graceUntil,
          ":cancelAtPeriodEnd": subscription.cancelAtPeriodEnd,
          ":eventId": event.eventId,
          ":eventAt": event.occurredAt,
          ":receivedAt": receivedAt,
          ...(entitlementTier ? { ":entitlementTier": entitlementTier } : {}),
        },
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
