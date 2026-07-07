import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { transportBookingsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/transport", requireAuth, async (req, res) => {
  try {
    const { type, clientId, status } = req.query as Record<string, string>;
    let bookings = await db.select().from(transportBookingsTable);
    if (type) bookings = bookings.filter(b => b.type === type);
    if (clientId) bookings = bookings.filter(b => b.clientId === parseInt(clientId));
    if (status) bookings = bookings.filter(b => b.status === status);
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    return res.json(bookings.map(b => ({
      ...b,
      clientName: clientMap.get(b.clientId) || null,
      amount: parseFloat(b.amount),
      date: b.date.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transport", requireAuth, async (req, res) => {
  try {
    const required = ["clientId", "type", "vehicleType", "pickupLocation", "dropoffLocation", "date"] as const;
    const missing = required.filter(f => {
      const v = req.body[f];
      return v === undefined || v === null || String(v).trim() === "";
    });
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });

    const [booking] = await db.insert(transportBookingsTable).values({
      clientId: req.body.clientId,
      type: req.body.type,
      vehicleType: req.body.vehicleType,
      pickupLocation: req.body.pickupLocation,
      dropoffLocation: req.body.dropoffLocation,
      date: new Date(req.body.date),
      passengers: req.body.passengers || 1,
      driverName: req.body.driverName,
      driverPhone: req.body.driverPhone,
      status: "pending",
      amount: (req.body.amount ?? 0).toString(),
      currency: req.body.currency || "USD",
      vendorId: req.body.vendorId || null,
      notes: req.body.notes,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    return res.status(201).json({
      ...booking,
      clientName: client?.name || null,
      amount: parseFloat(booking.amount),
      date: booking.date.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/transport/:id", requireAuth, async (req, res) => {
  try {
    const [booking] = await db.select().from(transportBookingsTable).where(eq(transportBookingsTable.id, parseInt(String(req.params.id))));
    if (!booking) return res.status(404).json({ error: "Transport booking not found" });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, booking.clientId));
    return res.json({
      ...booking,
      clientName: client?.name || null,
      amount: parseFloat(booking.amount),
      date: booking.date.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Get transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/transport/:id", requireAuth, async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "driverName", "driverPhone", "notes"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.amount !== undefined) updates.amount = req.body.amount.toString();
    const [booking] = await db.update(transportBookingsTable).set(updates).where(eq(transportBookingsTable.id, parseInt(String(req.params.id)))).returning();
    if (!booking) return res.status(404).json({ error: "Transport booking not found" });
    return res.json({
      ...booking,
      clientName: null,
      amount: parseFloat(booking.amount),
      date: booking.date.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/transport/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(transportBookingsTable).where(eq(transportBookingsTable.id, parseInt(String(req.params.id))));
    return res.json({ message: "Transport booking deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
