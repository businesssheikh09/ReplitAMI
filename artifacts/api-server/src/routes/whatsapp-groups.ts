import { Router } from "express";
import { db, whatsappMonitoredGroupsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getLiveGroups } from "../services/whatsapp.js";

const router = Router();

const canManage = requireRole("admin", "management", "accounts");

/** Pre-filter: only return groups whose name contains one of these business keywords. */
const BUSINESS_KEYWORDS = [
  "travel", "tours", "al musafir", "fast star",
  "bookings", "umrah", "tickets",
];

function isBusinessGroup(name: string): boolean {
  const lower = name.toLowerCase();
  return BUSINESS_KEYWORDS.some((kw) => lower.includes(kw));
}

/** GET /api/whatsapp-groups/live
 * Returns all WhatsApp groups the linked phone is currently in.
 * Only @g.us JIDs are returned (group chats, never personal chats).
 * 409 if WhatsApp is not connected.
 */
router.get("/whatsapp-groups/live", requireAuth, canManage, async (req, res) => {
  try {
    const groups = await getLiveGroups();
    const filtered = groups.filter((g) => isBusinessGroup(g.name));
    return res.json(filtered);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "WhatsApp not connected") {
      return res.status(409).json({ error: "WhatsApp is not connected. Link your phone first." });
    }
    req.log.error({ err }, "Failed to fetch live WhatsApp groups");
    return res.status(500).json({ error: "Failed to fetch groups" });
  }
});

/** GET /api/whatsapp-groups
 * Returns the saved monitored-groups list from the database.
 */
router.get("/whatsapp-groups", requireAuth, canManage, async (req, res) => {
  try {
    const rows = await db.select().from(whatsappMonitoredGroupsTable);
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list monitored groups");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT /api/whatsapp-groups/:jid
 * Upsert a group: enable/disable it and store/update its name.
 * JID must end in @g.us (enforced by DB CHECK and validated here).
 */
router.put("/whatsapp-groups/:jid", requireAuth, canManage, async (req, res) => {
  const jid = decodeURIComponent(String(req.params.jid));
  const { name, enabled } = req.body as { name?: string; enabled?: boolean };

  if (!jid.endsWith("@g.us")) {
    return res.status(400).json({ error: "Invalid JID: must end with @g.us" });
  }
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" });
  }
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name (string) is required" });
  }

  try {
    const [row] = await db
      .insert(whatsappMonitoredGroupsTable)
      .values({ jid, name, enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: whatsappMonitoredGroupsTable.jid,
        set: { name, enabled, updatedAt: new Date() },
      })
      .returning();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to upsert monitored group");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/whatsapp-groups/:jid
 * Remove a group from the monitored list.
 */
router.delete("/whatsapp-groups/:jid", requireAuth, canManage, async (req, res) => {
  const jid = decodeURIComponent(String(req.params.jid));
  try {
    await db
      .delete(whatsappMonitoredGroupsTable)
      .where(eq(whatsappMonitoredGroupsTable.jid, jid));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete monitored group");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
