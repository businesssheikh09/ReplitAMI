import { db, flightRequestsTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export function startHoldExpiry(): void {
  setInterval(async () => {
    try {
      const now = new Date();
      const expired = await db
        .update(flightRequestsTable)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(flightRequestsTable.status, "on_hold"),
            lt(flightRequestsTable.holdExpiresAt, now),
          ),
        )
        .returning({ id: flightRequestsTable.id });

      if (expired.length > 0) {
        logger.info({ count: expired.length }, "Hold expiry sweep: expired holds");
      }
    } catch (err) {
      logger.error({ err }, "Hold expiry sweep failed");
    }
  }, SWEEP_INTERVAL_MS);
}
