import { Router } from "express";
import { db } from "@workspace/db";
import { hotelsTable, vendorsTable, hotelRequestsTable, vendorQuotesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Hotels DB
router.get("/hotels", async (req, res) => {
  try {
    const { city, stars, search } = req.query as Record<string, string>;
    let hotels = await db.select().from(hotelsTable);
    if (city) hotels = hotels.filter(h => h.city === city);
    if (stars) hotels = hotels.filter(h => h.stars === parseInt(stars));
    if (search) {
      const s = search.toLowerCase();
      hotels = hotels.filter(h => h.name.toLowerCase().includes(s));
    }
    return res.json(hotels);
  } catch (err) {
    req.log.error({ err }, "List hotels error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotels", async (req, res) => {
  try {
    const [hotel] = await db.insert(hotelsTable).values({
      name: req.body.name,
      city: req.body.city,
      stars: req.body.stars || 3,
      distanceFromHaram: req.body.distanceFromHaram,
      roomTypes: req.body.roomTypes || [],
      mealPlans: req.body.mealPlans || [],
      notes: req.body.notes,
      imageUrl: req.body.imageUrl,
      googleImageUrl: req.body.googleImageUrl,
      vendorWhatsapp: req.body.vendorWhatsapp,
      vendorWhatsappGroupId: req.body.vendorWhatsappGroupId,
    }).returning();
    return res.status(201).json(hotel);
  } catch (err) {
    req.log.error({ err }, "Create hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hotels/:id", async (req, res) => {
  try {
    const [hotel] = await db.select().from(hotelsTable).where(eq(hotelsTable.id, parseInt(req.params.id)));
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });
    return res.json(hotel);
  } catch (err) {
    req.log.error({ err }, "Get hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotels/:id", async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["name", "city", "stars", "distanceFromHaram", "roomTypes", "mealPlans", "notes", "imageUrl", "googleImageUrl", "vendorWhatsapp", "vendorWhatsappGroupId", "isActive"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const [hotel] = await db.update(hotelsTable).set(updates).where(eq(hotelsTable.id, parseInt(req.params.id))).returning();
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });
    return res.json(hotel);
  } catch (err) {
    req.log.error({ err }, "Update hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hotels/:id", async (req, res) => {
  try {
    await db.delete(hotelsTable).where(eq(hotelsTable.id, parseInt(req.params.id)));
    return res.json({ message: "Hotel deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete hotel error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Hotel Requests
router.get("/hotel-requests", async (req, res) => {
  try {
    const { status, clientId } = req.query as Record<string, string>;
    let requests = await db.select().from(hotelRequestsTable);
    if (status) requests = requests.filter(r => r.status === status);
    if (clientId) requests = requests.filter(r => r.clientId === parseInt(clientId));
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    return res.json(requests.map(r => ({
      ...r,
      clientName: clientMap.get(r.clientId) || null,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List hotel requests error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotel-requests", async (req, res) => {
  try {
    const [request] = await db.insert(hotelRequestsTable).values({
      clientId: req.body.clientId,
      hotelName: req.body.hotelName,
      city: req.body.city,
      checkIn: new Date(req.body.checkIn),
      checkOut: new Date(req.body.checkOut),
      rooms: req.body.rooms || 1,
      roomType: req.body.roomType,
      mealPlan: req.body.mealPlan,
      specialNotes: req.body.specialNotes,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    return res.status(201).json({
      ...request,
      clientName: client?.name || null,
      checkIn: request.checkIn.toISOString(),
      checkOut: request.checkOut.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/hotel-requests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [request] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Hotel request not found" });
    const [quotes, clients, vendors] = await Promise.all([
      db.select().from(vendorQuotesTable).where(eq(vendorQuotesTable.requestId, id)),
      db.select().from(clientsTable),
      db.select().from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
    return res.json({
      ...request,
      clientName: clientMap.get(request.clientId) || null,
      checkIn: request.checkIn.toISOString(),
      checkOut: request.checkOut.toISOString(),
      quotes: quotes.map(q => ({
        ...q,
        vendorName: vendorMap.get(q.vendorId) || "Unknown",
        pricePerRoom: q.pricePerRoom / 100,
        totalPrice: q.totalPrice ? q.totalPrice / 100 : null,
        respondedAt: q.respondedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/hotel-requests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.specialNotes !== undefined) updates.specialNotes = req.body.specialNotes;
    const [request] = await db.update(hotelRequestsTable).set(updates).where(eq(hotelRequestsTable.id, id)).returning();
    if (!request) return res.status(404).json({ error: "Hotel request not found" });
    return res.json({
      ...request,
      clientName: null,
      checkIn: request.checkIn.toISOString(),
      checkOut: request.checkOut.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update hotel request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotel-requests/:id/quotes", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const [quote] = await db.insert(vendorQuotesTable).values({
      requestId,
      vendorId: req.body.vendorId,
      pricePerRoom: Math.round(req.body.pricePerRoom * 100),
      totalPrice: req.body.totalPrice ? Math.round(req.body.totalPrice * 100) : null,
      currency: req.body.currency || "USD",
      notes: req.body.notes,
    }).returning();
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, req.body.vendorId));
    return res.status(201).json({
      ...quote,
      vendorName: vendor?.name || "Unknown",
      pricePerRoom: quote.pricePerRoom / 100,
      totalPrice: quote.totalPrice ? quote.totalPrice / 100 : null,
      respondedAt: quote.respondedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Add vendor quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/hotel-requests/:id/send-to-vendor", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [request] = await db.select().from(hotelRequestsTable).where(eq(hotelRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Hotel request not found" });

    // Look up the hotel by name to get vendor WhatsApp info
    const hotels = await db.select().from(hotelsTable);
    const hotel = hotels.find(h => h.name.toLowerCase() === request.hotelName.toLowerCase());

    const vendorJid = hotel?.vendorWhatsappGroupId || hotel?.vendorWhatsapp;
    if (!vendorJid) {
      return res.status(400).json({ error: "No vendor WhatsApp configured for this hotel. Please add vendor WhatsApp in the Hotels section first." });
    }

    const checkIn = new Date(request.checkIn).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    const checkOut = new Date(request.checkOut).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

    const message =
      `*Hotel Booking Enquiry*\n\n` +
      `Hotel Name: ${request.hotelName}\n` +
      `Check In: ${checkIn}\n` +
      `Check Out: ${checkOut}\n` +
      `No of Rooms: ${request.rooms}\n` +
      `Type of Room: ${request.roomType}\n` +
      `Meal Type: ${request.mealPlan}\n` +
      (request.specialNotes ? `Special Requests: ${request.specialNotes}\n` : "") +
      `\n_Sent via Al Musafir International ERP_`;

    await sendWhatsAppMessage(vendorJid, message);

    const [updated] = await db
      .update(hotelRequestsTable)
      .set({ status: "sent_to_vendor", updatedAt: new Date() })
      .where(eq(hotelRequestsTable.id, id))
      .returning();

    return res.json({
      ...updated,
      clientName: null,
      checkIn: updated.checkIn.toISOString(),
      checkOut: updated.checkOut.toISOString(),
      vendorJid,
    });
  } catch (err: any) {
    req.log.error({ err }, "Send to vendor error");
    return res.status(500).json({ error: err?.message ?? "Failed to send WhatsApp message" });
  }
});

router.patch("/hotel-requests/:id/quotes/:quoteId/select", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const quoteId = parseInt(req.params.quoteId);
    // Deselect all quotes for this request
    await db.update(vendorQuotesTable).set({ isSelected: false }).where(eq(vendorQuotesTable.requestId, requestId));
    // Select the chosen quote
    const [quote] = await db.update(vendorQuotesTable).set({ isSelected: true }).where(eq(vendorQuotesTable.id, quoteId)).returning();
    await db.update(hotelRequestsTable).set({ selectedQuoteId: quoteId, status: "confirmed" }).where(eq(hotelRequestsTable.id, requestId));
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, quote.vendorId));
    return res.json({
      ...quote,
      vendorName: vendor?.name || "Unknown",
      pricePerRoom: quote.pricePerRoom / 100,
      totalPrice: quote.totalPrice ? quote.totalPrice / 100 : null,
      respondedAt: quote.respondedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Select vendor quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Vendors
router.get("/vendors", async (req, res) => {
  try {
    const { type, search } = req.query as Record<string, string>;
    let vendors = await db.select().from(vendorsTable);
    if (type) vendors = vendors.filter(v => v.type === type);
    if (search) {
      const s = search.toLowerCase();
      vendors = vendors.filter(v => v.name.toLowerCase().includes(s));
    }
    return res.json(vendors.map(v => ({
      ...v,
      rating: v.rating ? v.rating / 10 : null,
    })));
  } catch (err) {
    req.log.error({ err }, "List vendors error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vendors", async (req, res) => {
  try {
    const [vendor] = await db.insert(vendorsTable).values({
      name: req.body.name,
      type: req.body.type,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      country: req.body.country,
    }).returning();
    return res.status(201).json({ ...vendor, rating: null });
  } catch (err) {
    req.log.error({ err }, "Create vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vendors/:id", async (req, res) => {
  try {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, parseInt(req.params.id)));
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    return res.json({ ...vendor, rating: vendor.rating ? vendor.rating / 10 : null });
  } catch (err) {
    req.log.error({ err }, "Get vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vendors/:id", async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["name", "type", "contactName", "email", "phone", "country", "isActive"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.rating !== undefined) updates.rating = Math.round(req.body.rating * 10);
    const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, parseInt(req.params.id))).returning();
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    return res.json({ ...vendor, rating: vendor.rating ? vendor.rating / 10 : null });
  } catch (err) {
    req.log.error({ err }, "Update vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vendors/:id", async (req, res) => {
  try {
    await db.delete(vendorsTable).where(eq(vendorsTable.id, parseInt(req.params.id)));
    return res.json({ message: "Vendor deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete vendor error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
