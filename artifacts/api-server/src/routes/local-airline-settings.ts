import { Router } from "express";
import { db, localAirlineSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const canManage = requireRole("admin", "management");

const DEFAULT_AIRLINES = [
  { code: "PK", name: "PIA (Pakistan International Airlines)" },
  { code: "PA", name: "Airblue" },
  { code: "E4", name: "AirSial" },
  { code: "9P", name: "Fly Jinnah" },
  { code: "OQ", name: "Salam Air" },
  { code: "EK", name: "Emirates" },
  { code: "QR", name: "Qatar Airways" },
  { code: "SV", name: "Saudia" },
  { code: "G9", name: "Air Arabia" },
  { code: "FZ", name: "Flydubai" },
];

async function ensureDefaults() {
  for (const a of DEFAULT_AIRLINES) {
    const existing = await db
      .select({ id: localAirlineSettingsTable.id })
      .from(localAirlineSettingsTable)
      .where(eq(localAirlineSettingsTable.code, a.code))
      .limit(1);
    if (!existing.length) {
      await db.insert(localAirlineSettingsTable).values({
        code: a.code,
        name: a.name,
        status: "coming_soon",
        environment: "test",
        isEnabled: false,
      });
    }
  }
}

router.get("/local-airline-settings", requireAuth, async (req, res) => {
  try {
    await ensureDefaults();
    const rows = await db.select().from(localAirlineSettingsTable).orderBy(localAirlineSettingsTable.code);
    // Never return raw credentials to non-admin
    const user = (req as any).user;
    const isAdmin = user?.role === "admin" || user?.role === "management";
    return res.json(
      rows.map((r) => ({
        ...r,
        credentials: isAdmin ? r.credentials : undefined,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "List local airline settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/local-airline-settings/:code", requireAuth, canManage, async (req, res) => {
  try {
    const code = req.params.code as string;
    const { status, environment, credentials, notes, isEnabled } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (environment !== undefined) updates.environment = environment;
    if (credentials !== undefined) updates.credentials = typeof credentials === "object" ? JSON.stringify(credentials) : credentials;
    if (notes !== undefined) updates.notes = notes;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;

    const [row] = await db
      .update(localAirlineSettingsTable)
      .set(updates)
      .where(eq(localAirlineSettingsTable.code, code))
      .returning();
    if (!row) return res.status(404).json({ error: "Airline not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update local airline settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/local-airline-settings/:code/test", requireAuth, canManage, async (req, res) => {
  try {
    const code = req.params.code as string;
    // Stub: actual API integration not implemented
    const testResult = `Test not available yet — ${code} direct API integration is coming soon.`;
    await db
      .update(localAirlineSettingsTable)
      .set({ testedAt: new Date(), testResult, updatedAt: new Date() })
      .where(eq(localAirlineSettingsTable.code, code));
    return res.json({ ok: false, message: testResult });
  } catch (err) {
    req.log.error({ err }, "Test local airline error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
