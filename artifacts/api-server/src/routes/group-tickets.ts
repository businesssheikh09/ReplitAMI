import { Router } from "express";
import { db, groupTicketsTable } from "@workspace/db";
import { eq, desc, ilike, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { scrapeAndUpsert } from "../services/scheduler.js";
import { getConnectionStatus, getQRCode, disconnectWhatsApp } from "../services/whatsapp.js";

const router = Router();

router.get("/group-tickets", requireAuth, async (req, res) => {
  try {
    const { origin, destination, date } = req.query as Record<string, string>;

    const conditions: SQL[] = [];
    if (origin) conditions.push(ilike(groupTicketsTable.origin, origin));
    if (destination) conditions.push(ilike(groupTicketsTable.destination, destination));
    if (date) conditions.push(eq(groupTicketsTable.flightDate, date));

    const rows = await db
      .select()
      .from(groupTicketsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(groupTicketsTable.flightDate));

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

router.get("/group-tickets/qr", requireAuth, (_req, res) => {
  res.json({ qr: getQRCode(), status: getConnectionStatus() });
});

/**
 * POST /api/whatsapp/logout
 * Disconnects the active WhatsApp session and wipes the session directory.
 * The server then re-initialises and a fresh QR code becomes available.
 */
router.post(
  "/whatsapp/logout",
  requireAuth,
  requireRole("admin", "management"),
  async (req, res) => {
    try {
      await disconnectWhatsApp();
      return res.json({ ok: true, message: "WhatsApp disconnected — scan QR to re-link." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      req.log.error({ err }, "Failed to disconnect WhatsApp");
      return res.status(500).json({ error: msg });
    }
  }
);

export default router;
