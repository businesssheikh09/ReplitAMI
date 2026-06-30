import { Router } from "express";
import { db, botCampaignsTable, botCampaignSendsTable, mediaLibraryTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getLiveContacts } from "../services/whatsapp.js";

const router = Router();
const canManage = requireRole("admin", "management");

/** Extract a phone number from a WhatsApp JID. Returns null for @lid or unknown formats. */
function jidToPhone(jid: string): string | null {
  if (jid.endsWith("@s.whatsapp.net")) return jid.split("@")[0] ?? null;
  return null;
}

/**
 * GET /api/bot/contacts
 * Returns all unique individual contact JIDs extracted from group participant lists.
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
 * GET /api/bot/campaigns
 * Returns the last 20 campaigns for history display.
 */
router.get("/bot/campaigns", requireAuth, canManage, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: botCampaignsTable.id,
        message: botCampaignsTable.message,
        status: botCampaignsTable.status,
        currentIndex: botCampaignsTable.currentIndex,
        contacts: botCampaignsTable.contacts,
        createdAt: botCampaignsTable.createdAt,
        mediaLibraryId: botCampaignsTable.mediaLibraryId,
        mediaCaption: botCampaignsTable.mediaCaption,
        recipientMode: botCampaignsTable.recipientMode,
        mediaName: mediaLibraryTable.originalFilename,
        mediaMimeType: mediaLibraryTable.mimeType,
        mediaSizeBytes: mediaLibraryTable.sizeBytes,
      })
      .from(botCampaignsTable)
      .leftJoin(mediaLibraryTable, eq(botCampaignsTable.mediaLibraryId, mediaLibraryTable.id))
      .orderBy(desc(botCampaignsTable.createdAt))
      .limit(20);

    const history = rows.map((row) => ({
      id: row.id,
      status: row.status,
      message: row.message,
      total: (row.contacts as Array<unknown>).length,
      sent: row.currentIndex,
      recipientMode: row.recipientMode ?? "all",
      createdAt: row.createdAt,
      mediaLibraryId: row.mediaLibraryId ?? null,
      mediaCaption: row.mediaCaption ?? null,
      mediaName: row.mediaName ?? null,
      mediaMimeType: row.mediaMimeType ?? null,
      mediaSizeBytes: row.mediaSizeBytes ?? null,
    }));

    return res.json(history);
  } catch (err) {
    req.log.error({ err }, "bot/campaigns GET: failed");
    return res.status(500).json({ error: "Failed to fetch campaign history" });
  }
});

/**
 * GET /api/bot/campaign/active
 * Returns the single most-recent campaign that is idle/running/paused,
 * plus live progress counts, delaySeconds, estimatedFinishAt, media metadata,
 * and a phone-safe lastSent (never exposes raw JID).
 */
router.get("/bot/campaign/active", requireAuth, canManage, async (req, res) => {
  try {
    const rows = await db
      .select({
        campaign: botCampaignsTable,
        mediaName: mediaLibraryTable.originalFilename,
        mediaMimeType: mediaLibraryTable.mimeType,
        mediaSizeBytes: mediaLibraryTable.sizeBytes,
      })
      .from(botCampaignsTable)
      .leftJoin(mediaLibraryTable, eq(botCampaignsTable.mediaLibraryId, mediaLibraryTable.id))
      .where(sql`${botCampaignsTable.status} IN ('idle', 'running', 'paused')`)
      .orderBy(desc(botCampaignsTable.createdAt))
      .limit(1);

    if (rows.length === 0) return res.json(null);

    const { campaign, mediaName, mediaMimeType, mediaSizeBytes } = rows[0];
    const contacts = campaign.contacts as Array<{ jid: string; name: string | null; phone?: string | null }>;
    const delaySeconds = campaign.delaySeconds ?? 20;

    const remaining = contacts.length - campaign.currentIndex;
    const estimatedFinishAt =
      campaign.nextSendAt && remaining > 0
        ? new Date(
            new Date(campaign.nextSendAt).getTime() + (remaining - 1) * delaySeconds * 1000,
          ).toISOString()
        : null;

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
      delaySeconds,
      estimatedFinishAt,
      recipientMode: campaign.recipientMode ?? "all",
      lastSent: lastSend
        ? {
            name: lastSend.name ?? null,
            phone: jidToPhone(lastSend.jid),
            sentAt: lastSend.sentAt,
          }
        : null,
      createdAt: campaign.createdAt,
      mediaLibraryId: campaign.mediaLibraryId ?? null,
      mediaCaption: campaign.mediaCaption ?? null,
      media: campaign.mediaLibraryId && mediaName
        ? {
            id: campaign.mediaLibraryId,
            name: mediaName,
            mimeType: mediaMimeType ?? "",
            sizeBytes: mediaSizeBytes ?? 0,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "bot/campaign/active: query failed");
    return res.status(500).json({ error: "Failed to fetch active campaign" });
  }
});

/**
 * POST /api/bot/campaign
 * Creates a new campaign (status: idle). Stops any existing active campaign first.
 * Body: { message?, mediaLibraryId?, caption?, recipientMode?, contacts? }
 * When recipientMode='selected' and contacts[] is provided, uses that list directly.
 * Otherwise fetches all live contacts from WhatsApp.
 */
router.post("/bot/campaign", requireAuth, canManage, async (req, res) => {
  const { message, mediaLibraryId, caption, recipientMode, contacts: bodyContacts } = req.body as {
    message?: string;
    mediaLibraryId?: number | null;
    caption?: string | null;
    recipientMode?: "all" | "selected";
    contacts?: Array<{ jid: string; name: string | null; phone: string | null }>;
  };

  if (!message?.trim() && !mediaLibraryId) {
    return res.status(400).json({ error: "message or mediaLibraryId is required" });
  }

  const mode = recipientMode ?? "all";

  let contacts: Array<{ jid: string; name: string | null; phone: string | null }>;

  if (mode === "selected") {
    if (!bodyContacts || bodyContacts.length === 0) {
      return res.status(400).json({ error: "contacts[] is required when recipientMode=selected" });
    }
    contacts = bodyContacts;
  } else {
    try {
      contacts = await getLiveContacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not connected")) {
        return res.status(503).json({ error: "WhatsApp is not connected" });
      }
      req.log.error({ err }, "bot/campaign POST: failed to fetch contacts");
      return res.status(500).json({ error: "Failed to fetch contacts" });
    }

    if (contacts.length === 0) {
      return res.status(400).json({ error: "No contacts available — WhatsApp groups may be empty" });
    }
  }

  try {
    await db
      .update(botCampaignsTable)
      .set({ status: "stopped", nextSendAt: null })
      .where(sql`${botCampaignsTable.status} IN ('idle', 'running', 'paused')`);

    const [campaign] = await db
      .insert(botCampaignsTable)
      .values({
        message: message?.trim() ?? "",
        contacts,
        status: "idle",
        currentIndex: 0,
        mediaLibraryId: mediaLibraryId ?? null,
        mediaCaption: caption ?? null,
        recipientMode: mode,
      })
      .returning();

    req.log.info(
      { campaignId: campaign.id, total: contacts.length, mode, hasMedia: !!mediaLibraryId },
      "Bot campaign created",
    );
    return res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "bot/campaign POST: failed");
    return res.status(500).json({ error: "Failed to create campaign" });
  }
});

/**
 * POST /api/bot/campaign/:id/start
 * Computes dynamic delay = max(20, floor(172800 / totalContacts)) seconds,
 * saves it on the campaign row, sets status=running and schedules first send.
 */
router.post("/bot/campaign/:id/start", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [camp] = await db
      .select()
      .from(botCampaignsTable)
      .where(eq(botCampaignsTable.id, id));

    if (!camp) return res.status(404).json({ error: "Campaign not found" });

    const contacts = camp.contacts as Array<{ jid: string; name: string | null }>;
    const total = Math.max(contacts.length, 1);
    const delaySeconds = Math.max(20, Math.floor(172800 / total));

    const [updated] = await db
      .update(botCampaignsTable)
      .set({
        status: "running",
        delaySeconds,
        nextSendAt: new Date(Date.now() + delaySeconds * 1000),
      })
      .where(eq(botCampaignsTable.id, id))
      .returning();

    req.log.info(
      { campaignId: id, total, delaySeconds },
      "Bot campaign started — dynamic delay computed",
    );
    return res.json({ ...updated, delaySeconds });
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
 * Uses the stored delaySeconds — does NOT recalculate.
 */
router.post("/bot/campaign/:id/resume", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [camp] = await db
      .select()
      .from(botCampaignsTable)
      .where(eq(botCampaignsTable.id, id));

    if (!camp) return res.status(404).json({ error: "Campaign not found" });

    const delaySeconds = camp.delaySeconds ?? 20;

    const [updated] = await db
      .update(botCampaignsTable)
      .set({ status: "running", nextSendAt: new Date(Date.now() + delaySeconds * 1000) })
      .where(eq(botCampaignsTable.id, id))
      .returning();

    req.log.info({ campaignId: id, delaySeconds }, "Bot campaign resumed");
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
