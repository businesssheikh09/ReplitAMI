import { Router } from "express";
import { db, botCampaignsTable, botCampaignSendsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getLiveContacts } from "../services/whatsapp.js";

const router = Router();
const canManage = requireRole("admin", "management");

/**
 * GET /api/bot/contacts
 * Returns all unique individual contact JIDs extracted from group participant lists.
 * Contacts are @s.whatsapp.net JIDs de-duplicated across all groups the phone belongs to.
 * Results are cached on connect and cleared on disconnect so they always reflect the
 * currently linked phone.
 * Returns 503 if WhatsApp is not connected.
 */
router.get("/bot/contacts", requireAuth, canManage, async (req, res) => {
  try {
    const contacts = await getLiveContacts();
    return res.json(contacts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not connected")) {
      return res.status(503).json({ error: "WhatsApp is not connected" });
    }
    req.log.error({ err }, "bot/contacts: failed to fetch live contacts");
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

/**
 * GET /api/bot/campaign/active
 * Returns the single most-recent campaign that is idle/running/paused,
 * plus live progress counts and last-sent contact.
 * Returns null when no active campaign exists.
 */
router.get("/bot/campaign/active", requireAuth, canManage, async (req, res) => {
  try {
    const [campaign] = await db
      .select()
      .from(botCampaignsTable)
      .where(sql`status IN ('idle', 'running', 'paused')`)
      .orderBy(desc(botCampaignsTable.createdAt))
      .limit(1);

    if (!campaign) return res.json(null);

    const contacts = campaign.contacts as Array<{ jid: string; name: string | null }>;

    const [lastSend] = await db
      .select()
      .from(botCampaignSendsTable)
      .where(eq(botCampaignSendsTable.campaignId, campaign.id))
      .orderBy(desc(botCampaignSendsTable.sentAt))
      .limit(1);

    return res.json({
      id: campaign.id,
      message: campaign.message,
      status: campaign.status,
      total: contacts.length,
      sent: campaign.currentIndex,
      nextSendAt: campaign.nextSendAt,
      lastSent: lastSend
        ? { jid: lastSend.jid, name: lastSend.name, sentAt: lastSend.sentAt }
        : null,
      createdAt: campaign.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "bot/campaign/active: query failed");
    return res.status(500).json({ error: "Failed to fetch active campaign" });
  }
});

/**
 * POST /api/bot/campaign
 * Creates a new campaign (status: idle). Stops any existing active campaign first.
 */
router.post("/bot/campaign", requireAuth, canManage, async (req, res) => {
  const { message, contacts } = req.body as {
    message: string;
    contacts: Array<{ jid: string; name: string | null }>;
  };

  if (!message?.trim()) return res.status(400).json({ error: "message is required" });
  if (!Array.isArray(contacts) || contacts.length === 0)
    return res.status(400).json({ error: "contacts list is required" });

  try {
    await db
      .update(botCampaignsTable)
      .set({ status: "stopped", nextSendAt: null })
      .where(sql`status IN ('idle', 'running', 'paused')`);

    const [campaign] = await db
      .insert(botCampaignsTable)
      .values({ message: message.trim(), contacts, status: "idle", currentIndex: 0 })
      .returning();

    req.log.info({ campaignId: campaign.id, total: contacts.length }, "Bot campaign created");
    return res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "bot/campaign POST: failed");
    return res.status(500).json({ error: "Failed to create campaign" });
  }
});

/**
 * POST /api/bot/campaign/:id/start
 * Sets status to running and schedules the first send (random 20-40s from now).
 */
router.post("/bot/campaign/:id/start", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const delay = Math.floor(Math.random() * 20_000) + 20_000;
  try {
    const [updated] = await db
      .update(botCampaignsTable)
      .set({ status: "running", nextSendAt: new Date(Date.now() + delay) })
      .where(eq(botCampaignsTable.id, id))
      .returning();
    req.log.info({ campaignId: id, delaySec: Math.round(delay / 1000) }, "Bot campaign started");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "bot/campaign/start: failed");
    return res.status(500).json({ error: "Failed to start campaign" });
  }
});

/**
 * POST /api/bot/campaign/:id/pause
 */
router.post("/bot/campaign/:id/pause", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [updated] = await db
      .update(botCampaignsTable)
      .set({ status: "paused", nextSendAt: null })
      .where(eq(botCampaignsTable.id, id))
      .returning();
    req.log.info({ campaignId: id }, "Bot campaign paused");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "bot/campaign/pause: failed");
    return res.status(500).json({ error: "Failed to pause campaign" });
  }
});

/**
 * POST /api/bot/campaign/:id/resume
 * Picks up from current index with a fresh random 20-40s delay.
 */
router.post("/bot/campaign/:id/resume", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const delay = Math.floor(Math.random() * 20_000) + 20_000;
  try {
    const [updated] = await db
      .update(botCampaignsTable)
      .set({ status: "running", nextSendAt: new Date(Date.now() + delay) })
      .where(eq(botCampaignsTable.id, id))
      .returning();
    req.log.info({ campaignId: id }, "Bot campaign resumed");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "bot/campaign/resume: failed");
    return res.status(500).json({ error: "Failed to resume campaign" });
  }
});

/**
 * POST /api/bot/campaign/:id/stop
 */
router.post("/bot/campaign/:id/stop", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [updated] = await db
      .update(botCampaignsTable)
      .set({ status: "stopped", nextSendAt: null })
      .where(eq(botCampaignsTable.id, id))
      .returning();
    req.log.info({ campaignId: id }, "Bot campaign stopped");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "bot/campaign/stop: failed");
    return res.status(500).json({ error: "Failed to stop campaign" });
  }
});

export default router;
