import { Router } from "express";
import { db, whatsappMessagesTable, whatsappGroupLinksTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const canManage = requireRole("admin", "management");

/**
 * GET /api/whatsapp-inbox/groups
 * All groups that have at least one stored message, with unread counts
 * and a preview of the last message.
 */
router.get("/whatsapp-inbox/groups", requireAuth, canManage, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        m.group_jid,
        COALESCE(g.name, m.group_jid)                            AS group_name,
        COUNT(*)::int                                             AS total,
        SUM(CASE WHEN m.is_read = false THEN 1 ELSE 0 END)::int  AS unread,
        MAX(m.timestamp)                                          AS last_ts,
        (SELECT text FROM whatsapp_messages m2
         WHERE m2.group_jid = m.group_jid
         ORDER BY m2.timestamp DESC LIMIT 1)                     AS last_text,
        (SELECT sender_name FROM whatsapp_messages m3
         WHERE m3.group_jid = m.group_jid
         ORDER BY m3.timestamp DESC LIMIT 1)                     AS last_sender
      FROM whatsapp_messages m
      LEFT JOIN whatsapp_monitored_groups g ON g.jid = m.group_jid
      GROUP BY m.group_jid, g.name
      ORDER BY MAX(m.timestamp) DESC
    `);
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
 * Total unread count across all groups (for the nav badge).
 */
router.get("/whatsapp-inbox/unread-count", requireAuth, canManage, async (req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS total FROM whatsapp_messages WHERE is_read = false`
    );
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

export default router;
