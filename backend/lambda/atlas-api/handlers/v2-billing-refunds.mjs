import { requirePlatformOwner } from "../lib/platform-authz.mjs";
import { jsonResponse, parseJsonBody } from "../lib/http.mjs";
import {
  createBillingRefundOperation,
  markBillingRefundCompleted,
  markBillingRefundStarted,
} from "../lib/billing-store.mjs";
import { createDodoRefund } from "../lib/billing-provider-dodo.mjs";
import {
  createZohoRefund,
  findZohoRefundByReference,
} from "../lib/billing-provider-zoho.mjs";

function header(event, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (key.toLowerCase() === target) return String(value || "");
  }
  return "";
}

export async function handlePlatformBillingRefund(event) {
  try {
    if (process.env.ATLAS_BILLING_ENABLED !== "true") {
      return jsonResponse(503, { error: "Billing is not enabled" });
    }
    const owner = await requirePlatformOwner(event);
    const idempotencyKey = header(event, "idempotency-key").trim();
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
      return jsonResponse(400, { error: "A valid Idempotency-Key header is required" });
    }
    const body = parseJsonBody(event);
    const operation = await createBillingRefundOperation({
      provider: body.provider,
      paymentId: body.paymentId,
      amountMinor: body.amountMinor,
      reason: body.reason,
      idempotencyKey,
      approvedBy: owner.email || owner.sub,
    });
    if (operation.status === "completed") {
      return jsonResponse(200, {
        ok: true,
        reused: true,
        providerRefundId: operation.providerRefundId,
      });
    }
    if (operation.status === "reconciliation_failed") {
      return jsonResponse(409, {
        error: "Refund requires authoritative manual reconciliation",
        operationId: operation.operationId,
      });
    }
    if (operation.status === "provider_call_started") {
      if (operation.provider === "zoho") {
        const existing = await findZohoRefundByReference(
          operation.paymentId,
          operation.operationId
        );
        const existingId = existing?.refund_id || existing?.id;
        if (!existingId) {
          return jsonResponse(409, {
            error:
              "Zoho refund outcome remains ambiguous; retain the reservation and reconcile manually",
            operationId: operation.operationId,
          });
        }
        await markBillingRefundCompleted(operation, String(existingId));
        return jsonResponse(200, {
          ok: true,
          reconciled: true,
          operationId: operation.operationId,
          providerRefundId: String(existingId),
        });
      }
    }
    if (operation.status === "approved") await markBillingRefundStarted(operation);
    const result =
      operation.provider === "dodo"
        ? await createDodoRefund(
            operation.paymentId,
            operation.amountMinor,
            operation.reason,
            operation.operationId
          )
        : await createZohoRefund(
            operation.paymentId,
            operation.amountMinor,
            operation.reason,
            operation.operationId
          );
    const providerRefundId = String(
      result?.refund_id || result?.refund?.refund_id || result?.id || ""
    );
    if (!providerRefundId) throw new Error("Provider did not return a refund ID");
    await markBillingRefundCompleted(operation, providerRefundId);
    return jsonResponse(202, {
      ok: true,
      reused: operation.reused,
      operationId: operation.operationId,
      providerRefundId,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error("Billing refund failed", error);
    return jsonResponse(status, {
      error: status >= 500 ? "Unable to process refund" : error.message,
    });
  }
}
