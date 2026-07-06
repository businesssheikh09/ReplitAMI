import { Router } from "express";
import { db, groupTicketsTable } from "@workspace/db";
import { eq, desc, ilike, and, gte, SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { scrapeAndUpsert } from "../services/scheduler.js";
import { getStatusPayload, getConnectionStatus, getQRCode, disconnectWhatsApp } from "../services/whatsapp.js";

const router = Router();

// ── Public (no auth) ────────────────────────────────────────────────────────

router.get("/public/group-tickets", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select()
      .from(groupTicketsTable)
      .where(gte(groupTicketsTable.flightDate, today))
      .orderBy(groupTicketsTable.flightDate);

    return res.json(
      rows.map((r) => ({
        ...r,
        fareAmount: r.fareAmount ? parseFloat(String(r.fareAmount)) : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Public group tickets error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/public/group-tickets/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(groupTicketsTable)
      .where(eq(groupTicketsTable.id, parseInt(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({ ...row, fareAmount: row.fareAmount ? parseFloat(String(row.fareAmount)) : null });
  } catch (err) {
    req.log.error({ err }, "Public group ticket by id error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Auth-gated ───────────────────────────────────────────────────────────────

router.get("/group-tickets", requireAuth, async (req, res) => {
  try {
    const { origin, destination, date, fromDate } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (origin) conditions.push(ilike(groupTicketsTable.origin, origin));
    if (destination) conditions.push(ilike(groupTicketsTable.destination, destination));
    if (date) conditions.push(eq(groupTicketsTable.flightDate, date));
    if (fromDate) conditions.push(gte(groupTicketsTable.flightDate, fromDate));

    const rows = await db
      .select()
      .from(groupTicketsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(groupTicketsTable.flightDate));

    return res.json(rows.map((r) => ({ ...r, fareAmount: r.fareAmount ? parseFloat(String(r.fareAmount)) : null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list group tickets");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/group-tickets/sync", requireAuth, requireRole("admin", "management", "accounts"), async (req, res) => {
  try {
    await scrapeAndUpsert();
    return res.json({ ok: true, message: "Sync complete", whatsappStatus: getConnectionStatus() });
  } catch (err) {
    req.log.error({ err }, "Manual sync failed");
    return res.status(500).json({ error: "Sync failed" });
  }
});

router.get("/group-tickets/status", requireAuth, (_req, res) => {
  const { status, qrReady, reason } = getStatusPayload();
  res.json({ whatsappStatus: status, qrReady, reason });
});

router.get("/group-tickets/qr", requireAuth, (_req, res) => {
  res.json({ qr: getQRCode(), status: getConnectionStatus() });
});

router.post("/whatsapp/logout", requireAuth, requireRole("admin", "management"), async (req, res) => {
  try {
    await disconnectWhatsApp();
    return res.json({ ok: true, message: "WhatsApp disconnected — scan QR to re-link." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to disconnect WhatsApp");
    return res.status(500).json({ error: msg });
  }
});

export default router;
