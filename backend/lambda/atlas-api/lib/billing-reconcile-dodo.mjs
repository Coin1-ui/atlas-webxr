import { randomUUID } from "node:crypto";
import {
  getDodoSubscription,
  normalizeDodoSubscriptionSnapshot,
  scheduledPlanChangeFromDodoSubscription,
} from "./billing-provider-dodo.mjs";
import { providerTimestampSequence } from "./billing-state.mjs";
import {
  applyVerifiedBillingEvent,
  getBillingSubscription,
  withBillingReconciliationLock,
} from "./billing-store.mjs";

/**
 * True when live Dodo cancel/terminal state disagrees with Atlas Dynamo projection.
 * @param {Record<string, unknown> | null} atlas
 * @param {Record<string, unknown>} live
 */
export function dodoLiveDivergesFromAtlas(atlas, live) {
  if (!atlas || !live) return false;
  const liveStatus = String(live.status || "").toLowerCase();
  const atlasStatus = String(atlas.status || "").toLowerCase();
  const liveCancelNext = live.cancel_at_next_billing_date === true;
  const atlasCancelNext = atlas.cancelAtPeriodEnd === true;

  if (["cancelled", "canceled", "expired", "failed"].includes(liveStatus)) {
    if (!["canceled", "expired"].includes(atlasStatus)) return true;
  }
  if (["active", "on_hold"].includes(liveStatus) && liveCancelNext !== atlasCancelNext) {
    return true;
  }
  return false;
}

/**
 * Pull live Dodo subscription and apply into Atlas when cancel/terminal drift is detected.
 * @param {{
 *   workspaceId: string;
 *   providerSubscriptionId: string;
 *   current?: Record<string, unknown> | null;
 * }} input
 */
export async function reconcileDodoSubscriptionIfDrifted(input) {
  const current =
    input.current ?? (await getBillingSubscription(input.workspaceId));
  const live = await getDodoSubscription(input.providerSubscriptionId);
  const scheduledPlanChange = scheduledPlanChangeFromDodoSubscription(live);

  if (!dodoLiveDivergesFromAtlas(current, live)) {
    return {
      subscription: current,
      scheduledPlanChange,
      reconciled: false,
      applied: false,
    };
  }

  const result = await withBillingReconciliationLock(
    "dodo",
    input.providerSubscriptionId,
    async () => {
      const fresh = await getBillingSubscription(input.workspaceId);
      const liveAgain = await getDodoSubscription(input.providerSubscriptionId);
      if (!dodoLiveDivergesFromAtlas(fresh, liveAgain)) {
        return {
          subscription: fresh,
          scheduledPlanChange: scheduledPlanChangeFromDodoSubscription(liveAgain),
          reconciled: false,
          applied: false,
        };
      }

      const authoritativeTimestamp = liveAgain.updated_at
        ? Date.parse(String(liveAgain.updated_at))
        : liveAgain.cancelled_at
          ? Date.parse(String(liveAgain.cancelled_at))
          : Date.now();
      if (!Number.isSafeInteger(authoritativeTimestamp) || authoritativeTimestamp < 0) {
        throw new Error("Dodo subscription revision time is invalid");
      }

      const providerSequence = providerTimestampSequence(
        authoritativeTimestamp,
        fresh?.provider === "dodo" &&
          fresh?.providerSubscriptionId === input.providerSubscriptionId
          ? fresh.providerSequence
          : null,
      );

      const liveStatus = String(liveAgain.status || "").toLowerCase();
      const eventType =
        liveStatus === "cancelled" || liveStatus === "canceled"
          ? "subscription.cancelled"
          : liveStatus === "expired" || liveStatus === "failed"
            ? "subscription.expired"
            : liveAgain.cancel_at_next_billing_date === true
              ? "subscription.updated"
              : "subscription.updated";

      const normalized = normalizeDodoSubscriptionSnapshot({
        subscription: liveAgain,
        eventId: `reconcile-${input.providerSubscriptionId}-${authoritativeTimestamp}-${randomUUID().slice(0, 8)}`,
        eventType,
        occurredAt: new Date(authoritativeTimestamp).toISOString(),
        providerSequence,
      });

      const applied = await applyVerifiedBillingEvent(normalized);
      const subscription =
        (await getBillingSubscription(input.workspaceId)) ?? applied?.subscription ?? fresh;
      return {
        subscription,
        scheduledPlanChange: scheduledPlanChangeFromDodoSubscription(liveAgain),
        reconciled: true,
        applied: applied?.applied === true,
      };
    },
  );

  return result;
}
