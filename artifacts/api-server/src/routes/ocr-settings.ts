import { Router } from "express";
import { db, ocrSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const canManage = requireRole("admin", "management");

async function getOrCreate() {
  const [row] = await db.select().from(ocrSettingsTable).where(eq(ocrSettingsTable.id, 1));
  if (row) return row;
  const [created] = await db.insert(ocrSettingsTable).values({ id: 1 }).returning();
  return created;
}

router.get("/ocr-settings", requireAuth, async (req, res) => {
  try {
    const settings = await getOrCreate();
    return res.json({
      ...settings,
      minConfidence: parseFloat(settings.minConfidence ?? "60"),
      autoReviewThreshold: parseFloat(settings.autoReviewThreshold ?? "80"),
    });
  } catch (err) {
    req.log.error({ err }, "Get OCR settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/ocr-settings", requireAuth, canManage, async (req, res) => {
  try {
    const { defaultProvider, ocrEnabled, minConfidence, autoReviewThreshold } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (defaultProvider !== undefined) updates.defaultProvider = defaultProvider;
    if (ocrEnabled !== undefined) updates.ocrEnabled = ocrEnabled;
    if (minConfidence !== undefined) updates.minConfidence = String(minConfidence);
    if (autoReviewThreshold !== undefined) updates.autoReviewThreshold = String(autoReviewThreshold);

    // Upsert
    const existing = await db.select({ id: ocrSettingsTable.id }).from(ocrSettingsTable).where(eq(ocrSettingsTable.id, 1));
    let row;
    if (existing.length) {
      [row] = await db.update(ocrSettingsTable).set(updates).where(eq(ocrSettingsTable.id, 1)).returning();
    } else {
      [row] = await db.insert(ocrSettingsTable).values({ id: 1, ...updates }).returning();
    }
    return res.json({
      ...row,
      minConfidence: parseFloat(row!.minConfidence ?? "60"),
      autoReviewThreshold: parseFloat(row!.autoReviewThreshold ?? "80"),
    });
  } catch (err) {
    req.log.error({ err }, "Update OCR settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
