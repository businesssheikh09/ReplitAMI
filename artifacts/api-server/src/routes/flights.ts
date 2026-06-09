import { Router } from "express";
import { db } from "@workspace/db";
import { flightQuotationsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/flight-quotations", async (req, res) => {
  try {
    const { clientId, status } = req.query as Record<string, string>;
    let flights = await db.select().from(flightQuotationsTable);
    if (clientId) flights = flights.filter(f => f.clientId === parseInt(clientId));
    if (status) flights = flights.filter(f => f.status === status);
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    return res.json(flights.map(f => ({
      ...f,
      clientName: clientMap.get(f.clientId) || "",
      amount: parseFloat(f.amount),
      departureDate: f.departureDate.toISOString(),
      returnDate: f.returnDate?.toISOString() || null,
    })));
  } catch (err) {
    req.log.error({ err }, "List flight quotations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flight-quotations", async (req, res) => {
  try {
    const [flight] = await db.insert(flightQuotationsTable).values({
      clientId: req.body.clientId,
      origin: req.body.origin,
      destination: req.body.destination,
      departureDate: new Date(req.body.departureDate),
      returnDate: req.body.returnDate ? new Date(req.body.returnDate) : null,
      passengers: req.body.passengers || 1,
      cabinClass: req.body.cabinClass || "economy",
      airline: req.body.airline,
      flightNumber: req.body.flightNumber,
      status: "draft",
      amount: req.body.amount.toString(),
      currency: req.body.currency || "USD",
      notes: req.body.notes,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    return res.status(201).json({
      ...flight,
      clientName: client?.name || "",
      amount: parseFloat(flight.amount),
      departureDate: flight.departureDate.toISOString(),
      returnDate: flight.returnDate?.toISOString() || null,
    });
  } catch (err) {
    req.log.error({ err }, "Create flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/flight-quotations/:id", async (req, res) => {
  try {
    const [flight] = await db.select().from(flightQuotationsTable).where(eq(flightQuotationsTable.id, parseInt(req.params.id)));
    if (!flight) return res.status(404).json({ error: "Flight quotation not found" });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, flight.clientId));
    return res.json({
      ...flight,
      clientName: client?.name || "",
      amount: parseFloat(flight.amount),
      departureDate: flight.departureDate.toISOString(),
      returnDate: flight.returnDate?.toISOString() || null,
    });
  } catch (err) {
    req.log.error({ err }, "Get flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flight-quotations/:id", async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "airline", "flightNumber", "notes"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.amount !== undefined) updates.amount = req.body.amount.toString();
    const [flight] = await db.update(flightQuotationsTable).set(updates).where(eq(flightQuotationsTable.id, parseInt(req.params.id))).returning();
    if (!flight) return res.status(404).json({ error: "Flight quotation not found" });
    return res.json({
      ...flight,
      clientName: "",
      amount: parseFloat(flight.amount),
      departureDate: flight.departureDate.toISOString(),
      returnDate: flight.returnDate?.toISOString() || null,
    });
  } catch (err) {
    req.log.error({ err }, "Update flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/flight-quotations/:id", async (req, res) => {
  try {
    await db.delete(flightQuotationsTable).where(eq(flightQuotationsTable.id, parseInt(req.params.id)));
    return res.json({ message: "Flight quotation deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
