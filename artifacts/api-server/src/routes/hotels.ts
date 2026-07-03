import { Router } from "express";
import { db } from "@workspace/db";
import {
  hotelsTable,
  vendorsTable,
  hotelVendorsTable,
  hotelRequestsTable,
  vendorQuotesTable,
  hotelRequestEventsTable,
  hotelInvoicesTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { requireAuth } from "../middlewares/auth.js";
import { postHotelInvoice } from "../services/journal-poster.js";

const router = Router();

const pid = (p: string | string[]): number => parseInt(Array.isArray(p) ? p[0] : p);
const ps = (p: string | string[]): string => Array.isArray(p) ? p[0] : p;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getNextDnNumber(): Promise<string> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(REPLACE(dn_number, 'DN-', '') AS INTEGER)), 2186) + 1 AS seq FROM hotel_invoices`,
  );
  const seq = (result.rows[0] as any)?.seq ?? 2187;
  return `DN-${seq}`;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function buildEnquiryMessage(req: typeof hotelRequestsTable.$inferSelect): string {
  const nights = Math.round((req.checkOut.getTime() - req.checkIn.getTime()) / 86_400_000);
  return (
    `*Hotel Booking Enquiry*\n\n` +
    `Hotel Name: ${req.hotelName}\n` +
    `Reference: ${req.referenceNumber ?? `REQ-${req.id}`}\n` +
    `Check-In: ${fmtDate(req.checkIn)}\n` +
    `Check-Out: ${fmtDate(req.checkOut)}\n` +
    `Nights: ${nights}\n` +
    `No. of Rooms: ${req.rooms}\n` +
    `Room Type: ${req.roomType}\n` +
    `Meal Plan: ${req.mealPlan}\n` +
    `Guests: ${req.noOfPax}\n` +
    (req.specialNotes ? `Special Requests: ${req.specialNotes}\n` : "") +
    `\n_Sent via Al Musafir International ERP_`
  );
}

function serializeRequest(r: typeof hotelRequestsTable.$inferSelect, extras: Record<string, unknown> = {}) {
  return {
    ...r,
    checkIn: r.checkIn.toISOString(),
    checkOut: r.checkOut.toISOString(),
    notifiedAt: r.notifiedAt ? r.notifiedAt.toISOString() : null,
    ...extras,
  };
}

function quoteOut(q: typeof vendorQuotesTable.$inferSelect, vendorName?: string) {
  return {
    ...q,
    vendorName: vendorName ?? "Unknown",
    pricePerRoom: q.pricePerRoom / 100,
    totalPrice: q.totalPrice ? q.totalPrice / 100 : null,
    respondedAt: q.respondedAt.toISOString(),
  };
}

// ── Hotels CRUD ───────────────────────────────────────────────────────────────

router.get("/hotels", async (req, res) => {
  try {
    const { city, stars, search } = req.query as Record<string, string>;
    let hotels = await db.select().from(hotelsTable);
    if (city) hotels = hotels.filter((h) => h.city === city);
    if (stars) hotels = hotels.filter((h) => h.stars === parseInt(stars));
    if (search) {
      const s = search.toLowerCase();
      hotels = hotels.filter((h) => h.name.toLowerCase().includes(s));
    }
    return res.json(hotels);
  } catch (err) {
    req.log.error({ err }, "List hotels error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotels", requireAuth, async (req, res) => {
  try {
    const [hotel] = await db
      .insert(hotelsTable)
      .values({
        name: req.body.name,
        city: req.body.city,
        stars: req.body.stars || 3,
        distanceFromHaram: req.body.distanceFromHaram,
        roomTypes: req.body.roomTypes || [],
        mealPlans: req.body.mealPlans || [],
        notes: req.body.notes ?? null,
        description: req.body.description ?? null,
        category: req.body.category ?? null,
        defaultVendorId: req.body.defaultVendorId ? parseInt(req.body.defaultVendorId) : null,
        imageUrl: req.body.imageUrl ?? null,
        googleImageUrl: req.body.googleImageUrl ?? null,
        vendorWhatsapp: req.body.vendorWhatsapp ?? null,
        vendorWhatsappGroupId: req.body.vendorWhatsappGroupId ?? null,
      })
      .returning();
    return res.status(201).json(hotel);
  } catch (err) {
    req.log.error({ err }, "Create hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hotels/:id", async (req, res) => {
  try {
    const id = pid(req.params.id);
    const [hotel] = await db.select().from(hotelsTable).where(eq(hotelsTable.id, id));
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    const hotelVendors = await db
      .select()
      .from(hotelVendorsTable)
      .where(eq(hotelVendorsTable.hotelId, id));
    const vendorIds = hotelVendors.map((hv) => hv.vendorId);
    const allVendors = vendorIds.length
      ? await db.select().from(vendorsTable)
      : [];
    const vendorMap = new Map(allVendors.map((v) => [v.id, v]));

    return res.json({
      ...hotel,
      vendors: hotelVendors.map((hv) => ({
        ...hv,
        vendor: vendorMap.get(hv.vendorId) ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotels/:id", requireAuth, async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = [
      "name", "city", "stars", "distanceFromHaram", "roomTypes", "mealPlans",
      "notes", "description", "category", "defaultVendorId",
      "imageUrl", "googleImageUrl", "vendorWhatsapp", "vendorWhatsappGroupId", "isActive",
    ];
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const [hotel] = await db
      .update(hotelsTable)
      .set(updates)
      .where(eq(hotelsTable.id, pid(req.params.id)))
      .returning();
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });
    return res.json(hotel);
  } catch (err) {
    req.log.error({ err }, "Update hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hotels/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(hotelsTable).where(eq(hotelsTable.id, pid(req.params.id)));
    return res.json({ message: "Hotel deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Hotel Vendors ─────────────────────────────────────────────────────────────

router.get("/hotels/:id/vendors", async (req, res) => {
  try {
    const hotelId = pid(req.params.id);
    const rows = await db
      .select()
      .from(hotelVendorsTable)
      .where(eq(hotelVendorsTable.hotelId, hotelId));
    const vendorIds = rows.map((r) => r.vendorId);
    const allVendors = vendorIds.length ? await db.select().from(vendorsTable) : [];
    const vendorMap = new Map(allVendors.map((v) => [v.id, v]));
    return res.json(rows.map((r) => ({ ...r, vendor: vendorMap.get(r.vendorId) ?? null })));
  } catch (err) {
    req.log.error({ err }, "List hotel vendors error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotels/:id/vendors", requireAuth, async (req, res) => {
  try {
    const hotelId = pid(req.params.id);
    const [row] = await db
      .insert(hotelVendorsTable)
      .values({
        hotelId,
        vendorId: parseInt(req.body.vendorId),
        priority: req.body.priority ?? 0,
        whatsapp: req.body.whatsapp ?? null,
        whatsappGroupId: req.body.whatsappGroupId ?? null,
      })
      .returning();
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, row.vendorId));
    return res.status(201).json({ ...row, vendor: vendor ?? null });
  } catch (err) {
    req.log.error({ err }, "Add hotel vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotels/:id/vendors/:hvId", requireAuth, async (req, res) => {
  try {
    const hvId = pid(req.params.hvId);
    const updates: Record<string, unknown> = {};
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.whatsapp !== undefined) updates.whatsapp = req.body.whatsapp;
    if (req.body.whatsappGroupId !== undefined) updates.whatsappGroupId = req.body.whatsappGroupId;
    const [row] = await db.update(hotelVendorsTable).set(updates).where(eq(hotelVendorsTable.id, hvId)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update hotel vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hotels/:id/vendors/:hvId", requireAuth, async (req, res) => {
  try {
    await db.delete(hotelVendorsTable).where(eq(hotelVendorsTable.id, pid(req.params.hvId)));
    return res.json({ message: "Removed" });
  } catch (err) {
    req.log.error({ err }, "Remove hotel vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Hotel Requests ────────────────────────────────────────────────────────────

router.get("/hotel-requests", async (req, res) => {
  try {
    const { status, clientId } = req.query as Record<string, string>;
    let requests = await db.select().from(hotelRequestsTable).orderBy(desc(hotelRequestsTable.createdAt));
    if (status) requests = requests.filter((r) => r.status === status);
    if (clientId) requests = requests.filter((r) => r.clientId === parseInt(clientId));
    const clients = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return res.json(
      requests.map((r) => serializeRequest(r, { clientName: clientMap.get(r.clientId) ?? null })),
    );
  } catch (err) {
    req.log.error({ err }, "List hotel requests error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotel-requests", requireAuth, async (req, res) => {
  try {
    const [request] = await db
      .insert(hotelRequestsTable)
      .values({
        clientId: parseInt(req.body.clientId),
        hotelName: req.body.hotelName,
        city: req.body.city,
        checkIn: new Date(req.body.checkIn),
        checkOut: new Date(req.body.checkOut),
        rooms: req.body.rooms || 1,
        noOfPax: req.body.noOfPax || 1,
        roomType: req.body.roomType,
        mealPlan: req.body.mealPlan,
        specialNotes: req.body.specialNotes ?? null,
        hotelId: req.body.hotelId ? parseInt(req.body.hotelId) : null,
        createdByUserId: (req as any).user?.id ?? null,
      })
      .returning();

    // Generate reference number from ID
    const refNum = `HR-${String(request.id).padStart(4, "0")}`;
    const [updated] = await db
      .update(hotelRequestsTable)
      .set({ referenceNumber: refNum })
      .where(eq(hotelRequestsTable.id, request.id))
      .returning();

    // Add created event
    const userName = (req as any).user?.name ?? "System";
    await db.insert(hotelRequestEventsTable).values({
      requestId: updated.id,
      eventType: "created",
      statusBefore: null,
      statusAfter: "pending",
      notes: `Request created for ${updated.hotelName}`,
      userId: (req as any).user?.id ?? null,
      userName,
    });

    const [client] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, updated.clientId));
    return res.status(201).json(serializeRequest(updated, { clientName: client?.name ?? null }));
  } catch (err) {
    req.log.error({ err }, "Create hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hotel-requests/:id", async (req, res) => {
  try {
    const id = pid(req.params.id);
    const [request] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Hotel request not found" });

    const [quotes, clients, vendors, events] = await Promise.all([
      db.select().from(vendorQuotesTable).where(eq(vendorQuotesTable.requestId, id)),
      db.select({ id: clientsTable.id, name: clientsTable.name, whatsapp: clientsTable.whatsapp, phone: clientsTable.phone }).from(clientsTable),
      db.select().from(vendorsTable),
      db.select().from(hotelRequestEventsTable).where(eq(hotelRequestEventsTable.requestId, id)).orderBy(desc(hotelRequestEventsTable.createdAt)),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const client = clientMap.get(request.clientId);

    return res.json({
      ...serializeRequest(request),
      clientName: client?.name ?? null,
      clientWhatsapp: client?.whatsapp ?? client?.phone ?? null,
      quotes: quotes.map((q) => quoteOut(q, vendorMap.get(q.vendorId)?.name)),
      events,
    });
  } catch (err) {
    req.log.error({ err }, "Get hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotel-requests/:id", requireAuth, async (req, res) => {
  try {
    const id = pid(req.params.id);
    const [existing] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Hotel request not found" });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "specialNotes", "hotelName", "city", "rooms", "noOfPax", "roomType", "mealPlan", "hotelId"];
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const [request] = await db.update(hotelRequestsTable).set(updates).where(eq(hotelRequestsTable.id, id)).returning();

    if (req.body.status && req.body.status !== existing.status) {
      await db.insert(hotelRequestEventsTable).values({
        requestId: id,
        eventType: "status_changed",
        statusBefore: existing.status,
        statusAfter: req.body.status,
        notes: req.body.statusNote ?? null,
        userId: (req as any).user?.id ?? null,
        userName: (req as any).user?.name ?? "System",
      });
    }

    return res.json(serializeRequest(request));
  } catch (err) {
    req.log.error({ err }, "Update hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Request Events ────────────────────────────────────────────────────────────

router.get("/hotel-requests/:id/events", requireAuth, async (req, res) => {
  try {
    const events = await db
      .select()
      .from(hotelRequestEventsTable)
      .where(eq(hotelRequestEventsTable.requestId, pid(req.params.id)))
      .orderBy(desc(hotelRequestEventsTable.createdAt));
    return res.json(events);
  } catch (err) {
    req.log.error({ err }, "List request events error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotel-requests/:id/events", requireAuth, async (req, res) => {
  try {
    const [event] = await db
      .insert(hotelRequestEventsTable)
      .values({
        requestId: pid(req.params.id),
        eventType: req.body.eventType ?? "note",
        statusBefore: req.body.statusBefore ?? null,
        statusAfter: req.body.statusAfter ?? null,
        notes: req.body.notes ?? null,
        userId: (req as any).user?.id ?? null,
        userName: (req as any).user?.name ?? "System",
      })
      .returning();
    return res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "Add event error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Send to Vendor ────────────────────────────────────────────────────────────

router.post("/hotel-requests/:id/send-to-vendor", requireAuth, async (req, res) => {
  try {
    const id = pid(req.params.id);
    const [request] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Hotel request not found" });

    const message = req.body.message ?? buildEnquiryMessage(request);

    // Preview mode — just return the message
    if (req.body.preview) return res.json({ message });

    // Targets: [{jid, vendorId?, vendorName?}]
    const targets: Array<{ jid: string; vendorId?: number; vendorName?: string }> = req.body.targets ?? [];

    // Fallback to hotel's default WhatsApp
    if (!targets.length) {
      const hotels = await db.select().from(hotelsTable);
      const hotel = hotels.find((h) => h.name.toLowerCase() === request.hotelName.toLowerCase());
      const jid = hotel?.vendorWhatsappGroupId || hotel?.vendorWhatsapp;
      if (!jid) return res.status(400).json({ error: "No vendor WhatsApp configured. Add targets or configure hotel WhatsApp." });
      targets.push({ jid });
    }

    const userName = (req as any).user?.name ?? "System";
    const userId = (req as any).user?.id ?? null;
    const results: Array<{ jid: string; vendorName?: string; sent: boolean; error?: string }> = [];

    for (const target of targets) {
      try {
        await sendWhatsAppMessage(target.jid, message);
        results.push({ jid: target.jid, vendorName: target.vendorName, sent: true });
        await db.insert(hotelRequestEventsTable).values({
          requestId: id,
          eventType: "sent_to_vendor",
          statusBefore: request.status,
          statusAfter: "sent_to_vendors",
          notes: `Sent to ${target.vendorName ?? target.jid}`,
          userId,
          userName,
        });
      } catch (e: any) {
        results.push({ jid: target.jid, vendorName: target.vendorName, sent: false, error: e?.message });
      }
    }

    const [updated] = await db
      .update(hotelRequestsTable)
      .set({ status: "sent_to_vendors", updatedAt: new Date() })
      .where(eq(hotelRequestsTable.id, id))
      .returning();

    return res.json({ ...serializeRequest(updated), results, message });
  } catch (err: any) {
    req.log.error({ err }, "Send to vendor error");
    return res.status(500).json({ error: err?.message ?? "Failed to send" });
  }
});

// ── Vendor Quotes ─────────────────────────────────────────────────────────────

router.post("/hotel-requests/:id/quotes", requireAuth, async (req, res) => {
  try {
    const requestId = pid(req.params.id);
    const pricePerRoom = Math.round(parseFloat(req.body.pricePerRoom) * 100);
    const totalRooms = req.body.totalRooms ?? (await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, requestId)))[0]?.rooms ?? 1;
    const totalPrice = req.body.totalPrice
      ? Math.round(parseFloat(req.body.totalPrice) * 100)
      : Math.round(pricePerRoom * totalRooms);

    const [quote] = await db
      .insert(vendorQuotesTable)
      .values({
        requestId,
        vendorId: parseInt(req.body.vendorId),
        pricePerRoom,
        totalPrice,
        currency: req.body.currency || "SAR",
        mealPlan: req.body.mealPlan ?? null,
        roomType: req.body.roomType ?? null,
        distance: req.body.distance ?? null,
        availability: req.body.availability ?? null,
        cancellationPolicy: req.body.cancellationPolicy ?? null,
        receivedBy: (req as any).user?.id ?? null,
        status: req.body.status || "received",
        vendorWhatsapp: req.body.vendorWhatsapp ?? null,
        notes: req.body.notes ?? null,
      })
      .returning();

    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, quote.vendorId));

    // Auto-advance request to quotes_received
    const [reqRow] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, requestId));
    if (reqRow && !["vendor_selected", "invoice_generated", "customer_notified"].includes(reqRow.status)) {
      await db.update(hotelRequestsTable).set({ status: "quotes_received", updatedAt: new Date() }).where(eq(hotelRequestsTable.id, requestId));
      await db.insert(hotelRequestEventsTable).values({
        requestId,
        eventType: "quote_received",
        statusBefore: reqRow.status,
        statusAfter: "quotes_received",
        notes: `Quote received from ${vendor?.name ?? "vendor"}: ${req.body.currency ?? "SAR"} ${req.body.pricePerRoom}/room`,
        userId: (req as any).user?.id ?? null,
        userName: (req as any).user?.name ?? "System",
      });
    }

    return res.status(201).json(quoteOut(quote, vendor?.name));
  } catch (err) {
    req.log.error({ err }, "Add vendor quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotel-requests/:id/quotes/:quoteId", requireAuth, async (req, res) => {
  try {
    const quoteId = pid(req.params.quoteId);
    const updates: Record<string, unknown> = {};
    if (req.body.pricePerRoom !== undefined) updates.pricePerRoom = Math.round(parseFloat(req.body.pricePerRoom) * 100);
    if (req.body.totalPrice !== undefined) updates.totalPrice = Math.round(parseFloat(req.body.totalPrice) * 100);
    const fields = ["currency", "mealPlan", "roomType", "distance", "availability", "cancellationPolicy", "notes", "status", "vendorWhatsapp"];
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const [quote] = await db.update(vendorQuotesTable).set(updates).where(eq(vendorQuotesTable.id, quoteId)).returning();
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, quote.vendorId));
    return res.json(quoteOut(quote, vendor?.name));
  } catch (err) {
    req.log.error({ err }, "Update quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotel-requests/:id/quotes/:quoteId/select", requireAuth, async (req, res) => {
  try {
    const requestId = pid(req.params.id);
    const quoteId = pid(req.params.quoteId);
    const userName = (req as any).user?.name ?? "System";
    const userId = (req as any).user?.id ?? null;

    const [[request], quotes] = await Promise.all([
      db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, requestId)),
      db.select().from(vendorQuotesTable).where(eq(vendorQuotesTable.requestId, requestId)),
    ]);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    // Deselect all, select chosen
    await db.update(vendorQuotesTable).set({ isSelected: false }).where(eq(vendorQuotesTable.requestId, requestId));
    await db.update(vendorQuotesTable).set({ isSelected: true }).where(eq(vendorQuotesTable.id, quoteId));

    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, quote.vendorId));

    // ── Generate Hotel Invoice ────────────────────────────────────────────────
    const dnNumber = await getNextDnNumber();
    const checkIn = request.checkIn.toISOString().slice(0, 10);
    const checkOut = request.checkOut.toISOString().slice(0, 10);
    const nights = Math.round((request.checkOut.getTime() - request.checkIn.getTime()) / 86_400_000);
    const payableSar = (quote.totalPrice ?? quote.pricePerRoom * request.rooms) / 100;

    const [invoice] = await db
      .insert(hotelInvoicesTable)
      .values({
        dnNumber,
        invoiceDate: checkIn,
        partyId: request.clientId,
        vendorId: quote.vendorId,
        hotelName: request.hotelName,
        hotelId: request.hotelId ?? null,
        checkIn,
        checkOut,
        noOfNights: nights,
        noOfRooms: request.rooms,
        noOfPax: request.noOfPax,
        roomType: quote.roomType ?? request.roomType,
        payableSar: String(payableSar),
        receivableSar: null,
        incomeHead: "Hotel Income",
        reference: request.referenceNumber ?? `REQ-${requestId}`,
        status: "draft",
      })
      .returning();

    // Post journal (fire-and-forget)
    postHotelInvoice({
      invoiceId: invoice.id,
      receivableSar: null,
      payableSar,
      dnNumber,
    }).catch(() => {});

    // Update request
    await db.update(hotelRequestsTable).set({
      selectedQuoteId: quoteId,
      invoiceId: invoice.id,
      status: "invoice_generated",
      updatedAt: new Date(),
    }).where(eq(hotelRequestsTable.id, requestId));

    // Record events
    await db.insert(hotelRequestEventsTable).values([
      {
        requestId,
        eventType: "vendor_selected",
        statusBefore: request.status,
        statusAfter: "vendor_selected",
        notes: `Vendor selected: ${vendor?.name ?? "Unknown"} @ ${quote.currency} ${((quote.totalPrice ?? quote.pricePerRoom * request.rooms) / 100).toFixed(2)}`,
        userId,
        userName,
      },
      {
        requestId,
        eventType: "invoice_generated",
        statusBefore: "vendor_selected",
        statusAfter: "invoice_generated",
        notes: `Hotel invoice ${dnNumber} created`,
        userId,
        userName,
      },
    ]);

    const [updatedRequest] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, requestId));
    return res.json({
      request: serializeRequest(updatedRequest),
      quote: quoteOut(quote, vendor?.name),
      invoice: { id: invoice.id, dnNumber: invoice.dnNumber, status: invoice.status },
    });
  } catch (err) {
    req.log.error({ err }, "Select vendor quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Customer Notification ─────────────────────────────────────────────────────

router.post("/hotel-requests/:id/notify-client", requireAuth, async (req, res) => {
  try {
    const id = pid(req.params.id);
    const [[request], clients] = await Promise.all([
      db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id)),
      db.select({ id: clientsTable.id, name: clientsTable.name, whatsapp: clientsTable.whatsapp, phone: clientsTable.phone }).from(clientsTable),
    ]);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!request.invoiceId) return res.status(400).json({ error: "No invoice generated yet" });

    const client = clients.find((c) => c.id === request.clientId);
    const rawPhone = client?.whatsapp || client?.phone || "";
    const clientJid = rawPhone.includes("@") ? rawPhone : rawPhone.replace(/\D/g, "") + "@s.whatsapp.net";

    if (!rawPhone) return res.status(400).json({ error: "No WhatsApp number on client record" });

    // Get invoice
    const [invoice] = await db.select().from(hotelInvoicesTable).where(eq(hotelInvoicesTable.id, request.invoiceId!));
    const ci = request.checkIn.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    const co = request.checkOut.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

    const customMsg = req.body.message;
    const message = customMsg ?? (
      `*Hotel Booking Confirmation*\n\n` +
      `Dear ${client?.name ?? "Guest"},\n\n` +
      `Your hotel booking has been confirmed.\n\n` +
      `Hotel: ${request.hotelName}\n` +
      `Check-In: ${ci}\n` +
      `Check-Out: ${co}\n` +
      `Rooms: ${request.rooms} × ${request.roomType}\n` +
      `Meal Plan: ${request.mealPlan}\n` +
      `Guests: ${request.noOfPax}\n` +
      `Reference: ${request.referenceNumber ?? `REQ-${id}`}\n` +
      (invoice ? `Confirmation #: ${invoice.dnNumber}\n` : "") +
      `\nThank you for choosing Al Musafir International.\n` +
      `_Al Musafir International ERP_`
    );

    if (req.body.preview) return res.json({ message, clientJid });

    await sendWhatsAppMessage(clientJid, message);

    const [updated] = await db
      .update(hotelRequestsTable)
      .set({ notifiedAt: new Date(), status: "customer_notified", updatedAt: new Date() })
      .where(eq(hotelRequestsTable.id, id))
      .returning();

    await db.insert(hotelRequestEventsTable).values({
      requestId: id,
      eventType: "customer_notified",
      statusBefore: request.status,
      statusAfter: "customer_notified",
      notes: `WhatsApp confirmation sent to ${client?.name ?? "client"}`,
      userId: (req as any).user?.id ?? null,
      userName: (req as any).user?.name ?? "System",
    });

    return res.json({ ...serializeRequest(updated), clientJid, message });
  } catch (err: any) {
    req.log.error({ err }, "Notify client error");
    return res.status(500).json({ error: err?.message ?? "Failed to notify" });
  }
});

// ── Vendors CRUD ──────────────────────────────────────────────────────────────

router.get("/vendors", async (req, res) => {
  try {
    const { type, search } = req.query as Record<string, string>;
    let vendors = await db.select().from(vendorsTable);
    if (type) vendors = vendors.filter((v) => v.type === type);
    if (search) {
      const s = search.toLowerCase();
      vendors = vendors.filter((v) => v.name.toLowerCase().includes(s));
    }
    return res.json(vendors.map((v) => ({ ...v, rating: v.rating ? v.rating / 10 : null })));
  } catch (err) {
    req.log.error({ err }, "List vendors error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors", requireAuth, async (req, res) => {
  try {
    const [vendor] = await db
      .insert(vendorsTable)
      .values({
        name: req.body.name,
        type: req.body.type,
        contactName: req.body.contactName,
        email: req.body.email,
        phone: req.body.phone,
        country: req.body.country,
      })
      .returning();
    return res.status(201).json({ ...vendor, rating: null });
  } catch (err) {
    req.log.error({ err }, "Create vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/:id", async (req, res) => {
  try {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, pid(req.params.id)));
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    return res.json({ ...vendor, rating: vendor.rating ? vendor.rating / 10 : null });
  } catch (err) {
    req.log.error({ err }, "Get vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["name", "type", "contactName", "email", "phone", "country", "isActive"];
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.rating !== undefined) updates.rating = Math.round(req.body.rating * 10);
    const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, pid(req.params.id))).returning();
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    return res.json({ ...vendor, rating: vendor.rating ? vendor.rating / 10 : null });
  } catch (err) {
    req.log.error({ err }, "Update vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendors/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(vendorsTable).where(eq(vendorsTable.id, pid(req.params.id)));
    return res.json({ message: "Vendor deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
