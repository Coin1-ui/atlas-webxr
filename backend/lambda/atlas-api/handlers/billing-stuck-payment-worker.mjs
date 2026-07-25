/**
 * Scheduled stuck-payment cancel worker (Dodo processing > threshold → hard cancel).
 */
import { sweepStuckDodoPayments } from "../lib/billing-stuck-payment.mjs";

export async function handleStuckPaymentSweeper() {
  try {
    const result = await sweepStuckDodoPayments();
    console.info("stuck payment sweeper finished", {
      skipped: result.skipped === true,
      cancelled: result.cancelled ?? 0,
      checkedPages: result.checkedPages ?? 0,
      reason: result.reason || null,
    });
    return result;
  } catch (error) {
    console.error("stuck payment sweeper failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
