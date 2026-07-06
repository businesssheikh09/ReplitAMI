import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { hotelInvoicesTable, clientsTable, vendorsTable, usersTable, hotelsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { postHotelInvoice } from "../services/journal-poster.js";

const router = Router();

// ── DN sequence helper ────────────────────────────────────────────────────────

async function getNextDnNumber(): Promise<string> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(REPLACE(dn_number, 'DN-', '') AS INTEGER)), 2186) + 1 AS seq FROM hotel_invoices`,
  );
  const seq = (result.rows[0] as any)?.seq ?? 2187;
  return `DN-${seq}`;
}

function parseNumericField(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function serializeInvoice(
  inv: typeof hotelInvoicesTable.$inferSelect,
  lookup: {
    clientMap: Map<number, string>;
    vendorMap: Map<number, string>;
    userMap: Map<number, string>;
    hotelMap: Map<number, string>;
  }
) {
  return {
    ...inv,
    partyName: inv.partyId ? lookup.clientMap.get(inv.partyId) ?? null : null,
    vendorName: inv.vendorId ? lookup.vendorMap.get(inv.vendorId) ?? null : null,
    salesmanName: inv.salesmanId ? lookup.userMap.get(inv.salesmanId) ?? null : null,
    receivableSar: parseNumericField(inv.receivableSar),
    payableSar: parseNumericField(inv.payableSar),
    receivablePkr: parseNumericField(inv.receivablePkr),
    payablePkr: parseNumericField(inv.payablePkr),
    receivableCurrency: inv.receivableCurrency ?? "SAR",
    payableCurrency: inv.payableCurrency ?? "SAR",
  };
}

async function buildLookup() {
  const [clients, vendors, users, hotels] = await Promise.all([
    db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
    db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
    db.select({ id: hotelsTable.id, name: hotelsTable.name }).from(hotelsTable),
  ]);
  return {
    clientMap: new Map(clients.map(c => [c.id, c.name])),
    vendorMap: new Map(vendors.map(v => [v.id, v.name])),
    userMap: new Map(users.map(u => [u.id, u.name])),
    hotelMap: new Map(hotels.map(h => [h.id, h.name])),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/invoices/hotel/next-dn", requireAuth, async (req, res) => {
  try {
    const nextDn = await getNextDnNumber();
    return res.json({ dnNumber: nextDn });
  } catch (err) {
    req.log.error({ err }, "Get next DN error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/hotel", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(hotelInvoicesTable).orderBy(desc(hotelInvoicesTable.id));
    const lookup = await buildLookup();
    return res.json(rows.map(r => serializeInvoice(r, lookup)));
  } catch (err) {
    req.log.error({ err }, "List hotel invoices error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/hotel/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [inv] = await db.select().from(hotelInvoicesTable).where(eq(hotelInvoicesTable.id, id));
    if (!inv) return res.status(404).json({ error: "Not found" });
    const lookup = await buildLookup();
    return res.json(serializeInvoice(inv, lookup));
  } catch (err) {
    req.log.error({ err }, "Get hotel invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices/hotel", requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const dnNumber = body.dnNumber || (await getNextDnNumber());

    const [row] = await db.insert(hotelInvoicesTable).values({
      dnNumber,
      invoiceDate: body.invoiceDate,
      partyId: body.partyId ? Number(body.partyId) : null,
      vendorId: body.vendorId ? Number(body.vendorId) : null,
      passengerName: body.passengerName || null,
      nationality: body.nationality || null,
      noOfPax: body.noOfPax ? Number(body.noOfPax) : 1,
      detail: body.detail || null,
      voucherType: body.voucherType || null,
      optionDate: body.optionDate || null,
      hotelId: body.hotelId ? Number(body.hotelId) : null,
      hotelName: body.hotelName || null,
      hotelView: body.hotelView || null,
      roomType: body.roomType || null,
      bedType: body.bedType || null,
      checkIn: body.checkIn || null,
      checkOut: body.checkOut || null,
      noOfNights: body.noOfNights ? Number(body.noOfNights) : null,
      noOfRooms: body.noOfRooms ? Number(body.noOfRooms) : 1,
      reference: body.reference || dnNumber,
      cnfNumber: body.cnfNumber || null,
      roomNumber: body.roomNumber || null,
      remarks: body.remarks || null,
      contactNumber: body.contactNumber || null,
      receivableSar: body.receivableSar != null ? String(body.receivableSar) : null,
      payableSar: body.payableSar != null ? String(body.payableSar) : null,
      receivablePkr: body.receivablePkr != null ? String(body.receivablePkr) : null,
      payablePkr: body.payablePkr != null ? String(body.payablePkr) : null,
      receivableCurrency: body.receivableCurrency || "SAR",
      payableCurrency: body.payableCurrency || "SAR",
      incomeHead: body.incomeHead || "Hotel Income",
      salesmanId: body.salesmanId ? Number(body.salesmanId) : null,
      status: body.status || "tentative",
    }).returning();

    const lookup = await buildLookup();
    // Post journal entries (fire-and-forget)
    postHotelInvoice({
      invoiceId: row.id,
      receivableSar: row.receivableSar != null ? parseFloat(row.receivableSar) : null,
      payableSar: row.payableSar != null ? parseFloat(row.payableSar) : null,
      dnNumber: row.dnNumber,
    }).catch(() => {});
    return res.status(201).json(serializeInvoice(row, lookup));
  } catch (err) {
    req.log.error({ err }, "Create hotel invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/invoices/hotel/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const body = req.body;

    const [row] = await db.update(hotelInvoicesTable).set({
      invoiceDate: body.invoiceDate,
      partyId: body.partyId ? Number(body.partyId) : null,
      vendorId: body.vendorId ? Number(body.vendorId) : null,
      passengerName: body.passengerName || null,
      nationality: body.nationality || null,
      noOfPax: body.noOfPax ? Number(body.noOfPax) : 1,
      detail: body.detail || null,
      voucherType: body.voucherType || null,
      optionDate: body.optionDate || null,
      hotelId: body.hotelId ? Number(body.hotelId) : null,
      hotelName: body.hotelName || null,
      hotelView: body.hotelView || null,
      roomType: body.roomType || null,
      bedType: body.bedType || null,
      checkIn: body.checkIn || null,
      checkOut: body.checkOut || null,
      noOfNights: body.noOfNights ? Number(body.noOfNights) : null,
      noOfRooms: body.noOfRooms ? Number(body.noOfRooms) : 1,
      reference: body.reference || null,
      cnfNumber: body.cnfNumber || null,
      roomNumber: body.roomNumber || null,
      remarks: body.remarks || null,
      contactNumber: body.contactNumber || null,
      receivableSar: body.receivableSar != null ? String(body.receivableSar) : null,
      payableSar: body.payableSar != null ? String(body.payableSar) : null,
      receivablePkr: body.receivablePkr != null ? String(body.receivablePkr) : null,
      payablePkr: body.payablePkr != null ? String(body.payablePkr) : null,
      receivableCurrency: body.receivableCurrency || "SAR",
      payableCurrency: body.payableCurrency || "SAR",
      incomeHead: body.incomeHead || "Hotel Income",
      salesmanId: body.salesmanId ? Number(body.salesmanId) : null,
      status: body.status || "tentative",
      updatedAt: new Date(),
    }).where(eq(hotelInvoicesTable.id, id)).returning();

    if (!row) return res.status(404).json({ error: "Not found" });
    const lookup = await buildLookup();
    return res.json(serializeInvoice(row, lookup));
  } catch (err) {
    req.log.error({ err }, "Update hotel invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
