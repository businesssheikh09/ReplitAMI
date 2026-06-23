import { Router } from "express";
import { db, packageInquiriesTable, hotelsTable, quotationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function generateRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PQ-${date}-${rand}`;
}

// ── Public ──────────────────────────────────────────────────────────────────

router.get("/public/hotels", async (req, res) => {
  try {
    const { city } = req.query as Record<string, string>;
    let hotels = await db.select({
      id: hotelsTable.id,
      name: hotelsTable.name,
      city: hotelsTable.city,
      stars: hotelsTable.stars,
      distanceFromHaram: hotelsTable.distanceFromHaram,
    }).from(hotelsTable).where(eq(hotelsTable.isActive, true));

    if (city) hotels = hotels.filter((h) => h.city === city);
    return res.json(hotels);
  } catch (err) {
    req.log.error({ err }, "Public hotels error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/public/package-inquiries", async (req, res) => {
  try {
    const { departureDate, returnDate, makkahHotelId, madinahHotelId, transportType,
      adults, children, infants, contactName, contactPhone, notes, portalUserId } = req.body;

    if (!departureDate || !contactName || !contactPhone) {
      return res.status(400).json({ error: "departureDate, contactName and contactPhone are required" });
    }

    const a = Number(adults ?? 1);
    const c = Number(children ?? 0);
    const i = Number(infants ?? 0);

    const [inquiry] = await db.insert(packageInquiriesTable).values({
      referenceNumber: generateRef(),
      departureDate,
      returnDate: returnDate ?? null,
      makkahHotelId: makkahHotelId ? Number(makkahHotelId) : null,
      madinahHotelId: madinahHotelId ? Number(madinahHotelId) : null,
      transportType: transportType ?? null,
      adults: a,
      children: c,
      infants: i,
      totalPax: a + c + i,
      contactName,
      contactPhone,
      notes: notes ?? null,
      portalUserId: portalUserId ? Number(portalUserId) : null,
    }).returning();

    return res.status(201).json({ id: inquiry.id, referenceNumber: inquiry.referenceNumber });
  } catch (err) {
    req.log.error({ err }, "Create package inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── ERP-gated ───────────────────────────────────────────────────────────────

router.get("/package-inquiries", requireAuth, async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    let rows = await db.select().from(packageInquiriesTable).orderBy(desc(packageInquiriesTable.createdAt));
    if (status && status !== "all") rows = rows.filter((r) => r.status === status);
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List package inquiries error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/package-inquiries/count", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(packageInquiriesTable).where(eq(packageInquiriesTable.status, "pending"));
    return res.json({ count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Count package inquiries error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/package-inquiries/:id", requireAuth, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(packageInquiriesTable)
      .where(eq(packageInquiriesTable.id, parseInt(String(req.params.id))))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });

    const hotels: Record<string, any> = {};
    if (row.makkahHotelId) {
      const [h] = await db.select().from(hotelsTable).where(eq(hotelsTable.id, row.makkahHotelId)).limit(1);
      if (h) hotels.makkah = h;
    }
    if (row.madinahHotelId) {
      const [h] = await db.select().from(hotelsTable).where(eq(hotelsTable.id, row.madinahHotelId)).limit(1);
      if (h) hotels.madinah = h;
    }
    return res.json({ ...row, hotels });
  } catch (err) {
    req.log.error({ err }, "Get package inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/package-inquiries/:id", requireAuth, async (req, res) => {
  try {
    const { status, notes, quotationId } = req.body;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (quotationId !== undefined) update.quotationId = quotationId;

    const [updated] = await db
      .update(packageInquiriesTable)
      .set(update)
      .where(eq(packageInquiriesTable.id, parseInt(String(req.params.id))))
      .returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update package inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
