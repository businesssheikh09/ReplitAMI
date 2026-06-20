import { Router } from "express";
import { db, groupTicketsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { scrapeAndUpsert } from "../services/scheduler.js";
import { getConnectionStatus } from "../services/whatsapp.js";

const router = Router();

router.get("/group-tickets", requireAuth, async (req, res) => {
  try {
    const { origin, destination, date } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(groupTicketsTable)
      .orderBy(desc(groupTicketsTable.flightDate));

    if (origin) rows = rows.filter((r) => r.origin.toLowerCase() === origin.toLowerCase());
    if (destination) rows = rows.filter((r) => r.destination.toLowerCase() === destination.toLowerCase());
    if (date) rows = rows.filter((r) => r.flightDate === date);

    return res.json(
      rows.map((r) => ({
        ...r,
        fareAmount: r.fareAmount ? parseFloat(String(r.fareAmount)) : null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list group tickets");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/group-tickets/sync",
  requireAuth,
  requireRole("admin", "management", "accounts"),
  async (req, res) => {
    try {
      await scrapeAndUpsert();
      const status = getConnectionStatus();
      return res.json({
        ok: true,
        message: "Sync complete",
        whatsappStatus: status,
      });
    } catch (err) {
      req.log.error({ err }, "Manual sync failed");
      return res.status(500).json({ error: "Sync failed" });
    }
  }
);

router.get("/group-tickets/status", requireAuth, (_req, res) => {
  res.json({ whatsappStatus: getConnectionStatus() });
});

export default router;
