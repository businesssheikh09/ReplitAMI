import { db, paymentReceiptsTable } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";
import { getEnabledAdapters } from "../adapters/registry.js";
import { logger } from "../lib/logger.js";

const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let lastSweepAt: Date | null = null;
let lastExpiredCount = 0;

export async function runSweep(): Promise<void> {
  const started = Date.now();
  try {
    const expired = await db
      .update(paymentReceiptsTable)
      .set({ paymentStatus: "expired" })
      .where(
        and(
          eq(paymentReceiptsTable.paymentStatus, "pending_receipt"),
          lt(paymentReceiptsTable.deadlineAt, sql`now()`),
        ),
      )
      .returning({ id: paymentReceiptsTable.id });

    lastExpiredCount = expired.length;

    const adapters = getEnabledAdapters();
    // When real adapters are enabled they will be called here to refresh seats/fares
    // Currently zero adapters are enabled — no-op
    for (const _adapter of adapters) {
      // adapter.fetchAvailability(flightNumber, date) and upsert
    }

    lastSweepAt = new Date();
    logger.info(
      { expiredReceipts: lastExpiredCount, adaptersQueried: adapters.length, durationMs: Date.now() - started },
      "Inventory sweep complete",
    );
  } catch (err) {
    logger.error({ err }, "Inventory sweep error");
  }
}

export function startInventorySweep(): void {
  if (sweepTimer) return;
  runSweep().catch(() => {});
  sweepTimer = setInterval(() => runSweep().catch(() => {}), SWEEP_INTERVAL_MS);
  logger.info("Inventory sweep started (10-min interval)");
}

export function getSweepStatus() {
  return { lastSweepAt, lastExpiredCount, intervalMs: SWEEP_INTERVAL_MS };
}
