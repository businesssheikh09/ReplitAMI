import { Router } from "express";
import { db, whatsappMessagesTable, whatsappGroupLinksTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { triggerBackfill, syncGroupNamesToDB, sendWhatsAppMessage } from "../services/whatsapp.js";

const router = Router();
const canManage = requireRole("admin", "management");

/**
 * Business keywords — a group must match at least one to appear in the inbox.
 * ilike  → substring match (safe for multi-char words unlikely to be substrings)
 * regex  → PostgreSQL ~* with \y word boundaries (use for short words like "ami"
 *           that would otherwise match inside "family", "sami", "amirah", etc.)
 */
const INBOX_KEYWORDS: Array<{ ilike?: string; regex?: string }> = [
  { ilike: "travel" },
  { ilike: "tours" },
  { ilike: "al musafir" },
  { ilike: "fast star" },
  { ilike: "bookings" },
  { ilike: "umrah" },
  { ilike: "tickets" },
  { regex: "\\yami\\y" },   // word-boundary: matches "AMI" alone, not "fAMIly" or "SAMi"
  { ilike: "invoices" },
  { ilike: "hotels" },
  { ilike: "internal" },
  { ilike: "umra" },
  { ilike: "air" },
  { ilike: "hotel" },
  { ilike: "booking" },
  { ilike: "account" },
];

/** SQL fragment: one condition per keyword, OR-joined. */
function keywordFilter(alias: string): string {
  return INBOX_KEYWORDS.map((kw) => {
    if (kw.ilike) return `${alias}.subject ILIKE '%${kw.ilike.replace(/'/g, "''")}%'`;
    if (kw.regex) return `${alias}.subject ~* '${kw.regex}'`;
    return "false";
  }).join(" OR ");
}

/**
 * GET /api/whatsapp-inbox/groups
 * Groups that (a) have at least one stored message, (b) have a known name in
 * whatsapp_group_names, and (c) whose name matches a business keyword.
 * Returns unread counts and a preview of the last message.
 */
router.get("/whatsapp-inbox/groups", requireAuth, canManage, async (req, res) => {
  try {
    const rows = await db.execute(sql.raw(`
      SELECT
        m.group_jid,
        n.subject                                                  AS group_name,
        COUNT(*)::int                                              AS total,
        SUM(CASE WHEN m.is_read = false THEN 1 ELSE 0 END)::int   AS unread,
        MAX(m.timestamp)                                           AS last_ts,
        (SELECT text FROM whatsapp_messages m2
         WHERE m2.group_jid = m.group_jid
         ORDER BY m2.timestamp DESC LIMIT 1)                      AS last_text,
        (SELECT sender_name FROM whatsapp_messages m3
         WHERE m3.group_jid = m.group_jid
         ORDER BY m3.timestamp DESC LIMIT 1)                      AS last_sender
      FROM whatsapp_messages m
      INNER JOIN whatsapp_group_names n ON n.jid = m.group_jid
      WHERE (${keywordFilter("n")})
      GROUP BY m.group_jid, n.subject
      ORDER BY MAX(m.timestamp) DESC
    `));
    return res.json(rows.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list inbox groups");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/whatsapp-inbox/messages/:jid
 * Paginated messages for a specific group (newest first).
 * Query params: page (1-based), limit (default 50)
 */
router.get("/whatsapp-inbox/messages/:jid", requireAuth, canManage, async (req, res) => {
  const jid = decodeURIComponent(String(req.params.jid));
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  try {
    const messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.groupJid, jid))
      .orderBy(desc(whatsappMessagesTable.timestamp))
      .limit(limit)
      .offset(offset);

    return res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch inbox messages");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/whatsapp-inbox/mark-read
 * Body: { groupJid: string }  — marks all messages in the group as read.
 */
router.post("/whatsapp-inbox/mark-read", requireAuth, canManage, async (req, res) => {
  const { groupJid } = req.body as { groupJid?: string };
  if (!groupJid) return res.status(400).json({ error: "groupJid required" });

  try {
    await db
      .update(whatsappMessagesTable)
      .set({ isRead: true })
      .where(and(eq(whatsappMessagesTable.groupJid, groupJid), eq(whatsappMessagesTable.isRead, false)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark messages read");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/whatsapp-inbox/unread-count
 * Total unread count — only across keyword-matching groups (for the nav badge).
 */
router.get("/whatsapp-inbox/unread-count", requireAuth, canManage, async (req, res) => {
  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*)::int AS total
      FROM whatsapp_messages m
      INNER JOIN whatsapp_group_names n ON n.jid = m.group_jid
      WHERE m.is_read = false
        AND (${keywordFilter("n")})
    `));
    return res.json({ total: (result.rows[0] as any)?.total ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get unread count");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/whatsapp-inbox/links/:jid
 * All transaction links for a group.
 */
router.get("/whatsapp-inbox/links/:jid", requireAuth, canManage, async (req, res) => {
  const jid = decodeURIComponent(String(req.params.jid));
  try {
    const links = await db
      .select()
      .from(whatsappGroupLinksTable)
      .where(eq(whatsappGroupLinksTable.groupJid, jid))
      .orderBy(desc(whatsappGroupLinksTable.linkedAt));
    return res.json(links);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch group links");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/whatsapp-inbox/links
 * Body: { groupJid, entityType, entityId }
 */
router.post("/whatsapp-inbox/links", requireAuth, canManage, async (req, res) => {
  const { groupJid, entityType, entityId } = req.body as {
    groupJid?: string;
    entityType?: string;
    entityId?: number;
  };
  if (!groupJid || !entityType || !entityId) {
    return res.status(400).json({ error: "groupJid, entityType, entityId required" });
  }

  const user = (req as any).user as { id?: number } | undefined;

  try {
    const [link] = await db
      .insert(whatsappGroupLinksTable)
      .values({ groupJid, entityType, entityId, linkedBy: user?.id ?? null })
      .onConflictDoNothing()
      .returning();
    return res.json(link ?? { ok: true, duplicate: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create group link");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/whatsapp-inbox/links/:id
 */
router.delete("/whatsapp-inbox/links/:id", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    await db.delete(whatsappGroupLinksTable).where(eq(whatsappGroupLinksTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete group link");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/whatsapp-inbox/send
 * Body: { jid, text?, quote?, mediaLibraryId?, caption? }
 * Sends a text or media message from the ERP and saves it to the inbox DB.
 * Either text or mediaLibraryId must be provided.
 */
router.post("/whatsapp-inbox/send", requireAuth, canManage, async (req, res) => {
  const { jid, text, quote, mediaLibraryId, caption } = req.body as {
    jid?: string;
    text?: string;
    quote?: { waId: string; text: string; senderJid: string; senderName?: string | null } | null;
    mediaLibraryId?: number;
    caption?: string | null;
  };

  if (!jid) {
    return res.status(400).json({ error: "jid is required" });
  }
  if (!text?.trim() && !mediaLibraryId) {
    return res.status(400).json({ error: "Either text or mediaLibraryId is required" });
  }

  try {
    const result = await sendWhatsAppMessage(
      jid,
      text?.trim() ?? "",
      quote ?? null,
      mediaLibraryId ? { mediaLibraryId, caption: caption ?? null } : null,
    );
    return res.json({ ok: true, waMessageId: result.waMessageId });
  } catch (err) {
    req.log.error({ err }, "Failed to send WhatsApp message");
    const message = err instanceof Error ? err.message : "Send failed";
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/whatsapp-inbox/backfill
 * Imports all messages from the local JSON store into the DB inbox.
 * Safe to call multiple times — already-imported rows are skipped.
 */
router.post("/whatsapp-inbox/backfill", requireAuth, canManage, async (req, res) => {
  try {
    const result = await triggerBackfill();
    req.log.info({ ...result }, "WhatsApp inbox backfill triggered via API");
    return res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err }, "Backfill failed");
    return res.status(500).json({ error: "Backfill failed" });
  }
});

/**
 * POST /api/whatsapp-inbox/sync-group-names
 * Pulls all group subjects from WhatsApp and upserts them into
 * whatsapp_group_names. Called by the refresh button in the inbox toolbar.
 * Returns { ok, upserted } — 409 if WhatsApp is not connected.
 */
router.post("/whatsapp-inbox/sync-group-names", requireAuth, canManage, async (req, res) => {
  try {
    const result = await syncGroupNamesToDB();
    return res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err }, "sync-group-names failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
