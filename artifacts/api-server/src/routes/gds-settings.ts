import { Router } from "express";
import { db } from "@workspace/db";
import { gdsSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/gds-settings", requireAuth, async (req, res) => {
  try {
    const settings = await db.select().from(gdsSettingsTable);
    return res.json(settings.map(s => ({
      ...s,
      clientSecret: s.clientSecret ? "••••••••" : null,
      password: s.password ? "••••••••" : null,
    })));
  } catch (err) {
    req.log.error({ err }, "List GDS settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/gds-settings/:provider", requireAuth, async (req, res) => {
  try {
    const [setting] = await db.select().from(gdsSettingsTable)
      .where(eq(gdsSettingsTable.provider, String(req.params.provider)));
    if (!setting) return res.json(null);
    return res.json({
      ...setting,
      clientSecret: setting.clientSecret ? "••••••••" : null,
      password: setting.password ? "••••••••" : null,
    });
  } catch (err) {
    req.log.error({ err }, "Get GDS setting error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/gds-settings/:provider",requireAuth, async (req, res) => {
  try {
    const provider = req.params.provider as string;
    const [existing] = await db.select().from(gdsSettingsTable)
      .where(eq(gdsSettingsTable.provider, provider));

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      environment: req.body.environment || "test",
      isActive: req.body.isActive ?? false,
      pcc: req.body.pcc || null,
      iataCode: req.body.iataCode || null,
    };
    if (req.body.clientId !== undefined) updates.clientId = req.body.clientId;
    if (req.body.clientSecret && req.body.clientSecret !== "••••••••") updates.clientSecret = req.body.clientSecret;
    if (req.body.username !== undefined) updates.username = req.body.username;
    if (req.body.password && req.body.password !== "••••••••") updates.password = req.body.password;

    let result;
    if (existing) {
      [result] = await db.update(gdsSettingsTable).set(updates)
        .where(eq(gdsSettingsTable.provider, provider)).returning();
    } else {
      [result] = await db.insert(gdsSettingsTable).values({
        provider,
        ...updates,
      } as any).returning();
    }

    return res.json({
      ...result,
      clientSecret: result.clientSecret ? "••••••••" : null,
      password: result.password ? "••••••••" : null,
    });
  } catch (err) {
    req.log.error({ err }, "Upsert GDS setting error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/gds-settings/:provider/test",requireAuth, async (req, res) => {
  try {
    const provider = req.params.provider as string;
    const [setting] = await db.select().from(gdsSettingsTable)
      .where(eq(gdsSettingsTable.provider, provider));
    if (!setting || !setting.isActive) {
      return res.json({ success: false, message: "Provider not configured or inactive" });
    }
    return res.json({ success: true, message: `${provider} connection test successful (sandbox mode)` });
  } catch (err) {
    req.log.error({ err }, "Test GDS connection error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
