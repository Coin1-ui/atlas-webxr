/**
 * Stuck Dodo payment policy: processing longer than N hours → immediate cancel + resubscribe.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  cancelDodoSubscriptionImmediately,
  getDodoPayment,
  getDodoSubscription,
  listDodoPayments,
} from "./billing-provider-dodo.mjs";
import { reconcileDodoSubscriptionIfDrifted } from "./billing-reconcile-dodo.mjs";
import {
  getBillingSubscription,
  resolveBillingWorkspace,
} from "./billing-store.mjs";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function billingTable() {
  return process.env.ATLAS_BILLING_TABLE || "atlas-billing";
}

function workspacesTable() {
  return process.env.ATLAS_WORKSPACES_TABLE || "atlas-workspaces";
}

/** @returns {number} hours */
export function stuckPaymentThresholdHours() {
  const raw = Number(process.env.ATLAS_STUCK_PAYMENT_HOURS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 1;
}

/**
 * @param {Record<string, unknown> | null | undefined} payment
 * @param {number | Date} [now]
 * @param {number} [hours]
 */
export function isStuckProcessingPayment(payment, now = Date.now(), hours = stuckPaymentThresholdHours()) {
  if (!payment || typeof payment !== "object") return false;
  if (String(payment.status || "").toLowerCase() !== "processing") return false;
  const created = Date.parse(String(payment.created_at || ""));
  if (!Number.isFinite(created)) return false;
  const nowMs = typeof now === "number" ? now : now.getTime();
  return nowMs - created >= hours * 60 * 60 * 1000;
}

function stuckCancelKey(paymentId) {
  return { pk: `STUCK_PAYMENT_CANCEL#${paymentId}`, sk: "META" };
}

async function alreadyCancelledForPayment(paymentId) {
  const row = await doc.send(
    new GetCommand({
      TableName: billingTable(),
      Key: stuckCancelKey(paymentId),
      ConsistentRead: true,
    })
  );
  return Boolean(row.Item);
}

async function markStuckCancelClaim(paymentId, meta) {
  const now = new Date().toISOString();
  try {
    await doc.send(
      new PutCommand({
        TableName: billingTable(),
        Item: {
          ...stuckCancelKey(paymentId),
          entityType: "stuck_payment_cancel",
          paymentId,
          ...meta,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
    return { claimed: true };
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return { claimed: false };
    }
    throw error;
  }
}

async function flagWorkspaceStuckPaymentCancel(workspaceId, paymentId) {
  const now = new Date().toISOString();
  try {
    await doc.send(
      new UpdateCommand({
        TableName: workspacesTable(),
        Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
        UpdateExpression:
          "SET billingCancelReason = :reason, billingStuckPaymentId = :payId, billingStuckPaymentCancelAt = :at, updatedAt = :at",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: {
          ":reason": "stuck_payment",
          ":payId": paymentId,
          ":at": now,
        },
      })
    );
  } catch (error) {
    console.warn("stuck payment: workspace flag failed", {
      workspaceId,
      paymentId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Read workspace stuck-payment cancel reason (Account UX).
 * @param {string} workspaceId
 */
export async function workspaceStuckPaymentCancelInfo(workspaceId) {
  try {
    const row = await doc.send(
      new GetCommand({
        TableName: workspacesTable(),
        Key: { pk: `WORKSPACE#${workspaceId}`, sk: "META" },
        ConsistentRead: true,
      })
    );
    if (String(row.Item?.billingCancelReason || "") !== "stuck_payment") return null;
    return {
      cancelReason: "stuck_payment",
      paymentId: row.Item?.billingStuckPaymentId
        ? String(row.Item.billingStuckPaymentId)
        : null,
      cancelledAt: row.Item?.billingStuckPaymentCancelAt
        ? String(row.Item.billingStuckPaymentCancelAt)
        : null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   workspaceId?: string | null;
 *   providerSubscriptionId: string;
 *   payment: Record<string, unknown>;
 * }} input
 */
export async function enforceStuckPaymentCancel(input) {
  const paymentId = String(input.payment?.payment_id || "").trim();
  const subscriptionId = String(
    input.providerSubscriptionId || input.payment?.subscription_id || ""
  ).trim();
  if (!paymentId || !subscriptionId) {
    return { cancelled: false, reason: "missing_ids" };
  }
  if (!isStuckProcessingPayment(input.payment)) {
    return { cancelled: false, reason: "not_stuck" };
  }
  if (await alreadyCancelledForPayment(paymentId)) {
    return { cancelled: false, reason: "already_enforced", paymentId };
  }

  let livePayment;
  try {
    livePayment = await getDodoPayment(paymentId);
  } catch (error) {
    return {
      cancelled: false,
      reason: "payment_fetch_failed",
      error: error instanceof Error ? error.message : "unknown",
    };
  }
  if (!isStuckProcessingPayment(livePayment)) {
    return { cancelled: false, reason: "no_longer_processing", paymentId };
  }

  const claim = await markStuckCancelClaim(paymentId, {
    providerSubscriptionId: subscriptionId,
    workspaceId: input.workspaceId || null,
    reason: "STUCK_PAYMENT_CANCEL",
  });
  if (!claim.claimed) {
    return { cancelled: false, reason: "already_enforced", paymentId };
  }

  let workspaceId = input.workspaceId || null;
  if (!workspaceId) {
    try {
      workspaceId = await resolveBillingWorkspace({
        provider: "dodo",
        providerSubscriptionId: subscriptionId,
        providerCustomerId: livePayment.customer?.customer_id || livePayment.customer_id,
      });
    } catch {
      workspaceId = null;
    }
  }

  try {
    const liveSub = await getDodoSubscription(subscriptionId);
    const liveStatus = String(liveSub?.status || "").toLowerCase();
    if (!["cancelled", "canceled", "expired", "failed"].includes(liveStatus)) {
      await cancelDodoSubscriptionImmediately(subscriptionId);
    }
  } catch (error) {
    console.error("STUCK_PAYMENT_CANCEL dodo cancel failed", {
      paymentId,
      subscriptionId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      cancelled: false,
      reason: "dodo_cancel_failed",
      paymentId,
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  if (workspaceId) {
    await flagWorkspaceStuckPaymentCancel(workspaceId, paymentId);
    try {
      await reconcileDodoSubscriptionIfDrifted({
        workspaceId,
        providerSubscriptionId: subscriptionId,
      });
    } catch (error) {
      console.warn("STUCK_PAYMENT_CANCEL reconcile failed", {
        workspaceId,
        subscriptionId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  console.info("STUCK_PAYMENT_CANCEL", {
    paymentId,
    subscriptionId,
    workspaceId,
    thresholdHours: stuckPaymentThresholdHours(),
  });

  return {
    cancelled: true,
    paymentId,
    subscriptionId,
    workspaceId,
    reason: "STUCK_PAYMENT_CANCEL",
  };
}

/**
 * Check recent payments for one subscription; cancel if any stuck processing.
 * @param {{ workspaceId: string; providerSubscriptionId: string; providerCustomerId?: string | null }} input
 */
export async function enforceStuckPaymentsForSubscription(input) {
  const subscriptionId = String(input.providerSubscriptionId || "").trim();
  if (!subscriptionId) return { cancelled: false, reason: "missing_subscription" };

  let pages = 0;
  let cursor = null;
  const outcomes = [];
  do {
    const res = await listDodoPayments({
      subscriptionId,
      customerId: input.providerCustomerId || undefined,
      status: "processing",
      pageSize: 50,
      cursor,
    });
    const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    for (const payment of items) {
      if (!isStuckProcessingPayment(payment)) continue;
      // Prefer payments that match this subscription when list is customer-scoped.
      const paySub = String(payment.subscription_id || "").trim();
      if (paySub && paySub !== subscriptionId) continue;
      outcomes.push(
        await enforceStuckPaymentCancel({
          workspaceId: input.workspaceId,
          providerSubscriptionId: subscriptionId,
          payment,
        })
      );
    }
    cursor = res?.iterator || res?.cursor || null;
    pages += 1;
  } while (cursor && pages < 3);

  const cancelled = outcomes.find((o) => o.cancelled === true);
  return cancelled || { cancelled: false, reason: "none_stuck", checked: outcomes.length };
}

/**
 * EventBridge / schedule sweeper: list processing payments, cancel when stuck.
 */
export async function sweepStuckDodoPayments() {
  if (process.env.ATLAS_BILLING_ENABLED !== "true") {
    return { ok: true, skipped: true, reason: "billing_disabled" };
  }
  if (!process.env.DODO_PAYMENTS_API_KEY?.trim()) {
    return { ok: true, skipped: true, reason: "no_dodo_key" };
  }

  const results = [];
  let pages = 0;
  let cursor = null;
  do {
    let res;
    try {
      res = await listDodoPayments({ status: "processing", pageSize: 50, cursor });
    } catch (error) {
      // Some Dodo envs may not filter by status — fall back to unfiltered recent page.
      console.warn("stuck payment sweeper: status filter failed, using recent payments", {
        error: error instanceof Error ? error.message : "unknown",
      });
      res = await listDodoPayments({ pageSize: 50, cursor });
    }
    const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    for (const payment of items) {
      if (!isStuckProcessingPayment(payment)) continue;
      const subscriptionId = String(payment.subscription_id || "").trim();
      if (!subscriptionId) continue;
      let workspaceId = null;
      try {
        workspaceId = await resolveBillingWorkspace({
          provider: "dodo",
          providerSubscriptionId: subscriptionId,
          providerCustomerId: payment.customer?.customer_id || payment.customer_id,
        });
      } catch {
        // Not an Atlas-bound subscription — skip.
        continue;
      }
      const atlas = await getBillingSubscription(workspaceId);
      if (atlas && ["expired", "canceled"].includes(String(atlas.status || ""))) {
        continue;
      }
      results.push(
        await enforceStuckPaymentCancel({
          workspaceId,
          providerSubscriptionId: subscriptionId,
          payment,
        })
      );
    }
    cursor = res?.iterator || res?.cursor || null;
    pages += 1;
  } while (cursor && pages < 5);

  return {
    ok: true,
    checkedPages: pages,
    cancelled: results.filter((r) => r.cancelled).length,
    results,
  };
}
