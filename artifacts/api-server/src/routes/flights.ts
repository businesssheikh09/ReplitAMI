import { Router } from "express";
import { db } from "@workspace/db";
import {
  flightQuotationsTable,
  clientsTable,
  flightTicketEventsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, desc, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { postFlightCancelled, postFlightRefund } from "../services/journal-poster.js";

const router = Router();

function fmtFlight(f: any, clientName = "") {
  return {
    ...f,
    clientName,
    amount: parseFloat(f.amount ?? "0"),
    airlineCommission: f.airlineCommission ? parseFloat(f.airlineCommission) : null,
    commissionRate: f.commissionRate ? parseFloat(f.commissionRate) : null,
    refundAmount: f.refundAmount ? parseFloat(f.refundAmount) : null,
    departureDate: f.departureDate instanceof Date ? f.departureDate.toISOString() : f.departureDate,
    returnDate: f.returnDate instanceof Date ? f.returnDate.toISOString() : (f.returnDate ?? null),
  };
}

// ── List / Create / Get / Update / Delete ────────────────────────────────────

router.get("/flight-quotations", requireAuth, async (req, res) => {
  try {
    const { clientId, status, fromDate } = req.query as Record<string, string>;
    const conditions = [];
    if (clientId) conditions.push(eq(flightQuotationsTable.clientId, parseInt(clientId)));
    if (status) conditions.push(eq(flightQuotationsTable.status, status));
    if (fromDate) conditions.push(gte(flightQuotationsTable.departureDate, new Date(fromDate)));
    const flights = await db
      .select()
      .from(flightQuotationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(flightQuotationsTable.createdAt));
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return res.json(flights.map((f) => fmtFlight(f, clientMap.get(f.clientId) ?? "")));
  } catch (err) {
    req.log.error({ err }, "List flight quotations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flight-quotations", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const [flight] = await db
      .insert(flightQuotationsTable)
      .values({
        clientId: req.body.clientId,
        origin: req.body.origin,
        destination: req.body.destination,
        departureDate: new Date(req.body.departureDate),
        returnDate: req.body.returnDate ? new Date(req.body.returnDate) : null,
        passengers: req.body.passengers || 1,
        cabinClass: req.body.cabinClass || "economy",
        airline: req.body.airline,
        flightNumber: req.body.flightNumber,
        pnr: req.body.pnr ?? null,
        status: "draft",
        amount: req.body.amount.toString(),
        currency: req.body.currency || "USD",
        notes: req.body.notes,
        airlineCommission: req.body.airlineCommission ? req.body.airlineCommission.toString() : null,
        commissionRate: req.body.commissionRate ? req.body.commissionRate.toString() : null,
        issuedBy: user?.id ?? null,
        issuedByName: user?.name ?? null,
      })
      .returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    await db.insert(flightTicketEventsTable).values({
      ticketId: flight.id,
      eventType: "created",
      statusBefore: null,
      statusAfter: "draft",
      notes: "Ticket quotation created",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
    });
    return res.status(201).json(fmtFlight(flight, client?.name ?? ""));
  } catch (err) {
    req.log.error({ err }, "Create flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/flight-quotations/:id", requireAuth, async (req, res) => {
  try {
    const [flight] = await db
      .select()
      .from(flightQuotationsTable)
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)));
    if (!flight) return res.status(404).json({ error: "Flight quotation not found" });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, flight.clientId));
    return res.json(fmtFlight(flight, client?.name ?? ""));
  } catch (err) {
    req.log.error({ err }, "Get flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flight-quotations/:id", requireAuth, async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "airline", "flightNumber", "pnr", "notes", "staffNotes", "ticketNumber"];
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.amount !== undefined) updates.amount = req.body.amount.toString();
    if (req.body.airlineCommission !== undefined) updates.airlineCommission = req.body.airlineCommission?.toString() ?? null;
    if (req.body.commissionRate !== undefined) updates.commissionRate = req.body.commissionRate?.toString() ?? null;
    const [flight] = await db
      .update(flightQuotationsTable)
      .set(updates)
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();
    if (!flight) return res.status(404).json({ error: "Flight quotation not found" });
    return res.json(fmtFlight(flight));
  } catch (err) {
    req.log.error({ err }, "Update flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/flight-quotations/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(flightQuotationsTable).where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)));
    return res.json({ message: "Flight quotation deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete flight quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Ticket Events (Audit Trail) ───────────────────────────────────────────────

router.get("/flight-quotations/:id/events", requireAuth, async (req, res) => {
  try {
    const events = await db
      .select()
      .from(flightTicketEventsTable)
      .where(eq(flightTicketEventsTable.ticketId, parseInt(req.params.id as string)))
      .orderBy(desc(flightTicketEventsTable.createdAt));
    return res.json(events);
  } catch (err) {
    req.log.error({ err }, "Get ticket events error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Staff Notes ───────────────────────────────────────────────────────────────

router.patch("/flight-quotations/:id/notes", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { staffNotes } = req.body;
    const [flight] = await db
      .update(flightQuotationsTable)
      .set({ staffNotes, updatedAt: new Date() })
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();
    if (!flight) return res.status(404).json({ error: "Not found" });
    await db.insert(flightTicketEventsTable).values({
      ticketId: flight.id,
      eventType: "note_added",
      notes: staffNotes,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
    });
    return res.json(fmtFlight(flight));
  } catch (err) {
    req.log.error({ err }, "Update staff notes error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Commission ────────────────────────────────────────────────────────────────

router.patch("/flight-quotations/:id/commission", requireAuth, async (req, res) => {
  try {
    const { airlineCommission, commissionRate } = req.body;
    const [flight] = await db
      .update(flightQuotationsTable)
      .set({
        airlineCommission: airlineCommission?.toString() ?? null,
        commissionRate: commissionRate?.toString() ?? null,
        updatedAt: new Date(),
      })
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();
    if (!flight) return res.status(404).json({ error: "Not found" });
    return res.json(fmtFlight(flight));
  } catch (err) {
    req.log.error({ err }, "Update commission error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Cancel ────────────────────────────────────────────────────────────────────

router.post("/flight-quotations/:id/cancel", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { cancelReason } = req.body;
    const [existing] = await db
      .select()
      .from(flightQuotationsTable)
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });

    const [flight] = await db
      .update(flightQuotationsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: user?.id ?? null,
        cancelReason: cancelReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();

    await db.insert(flightTicketEventsTable).values({
      ticketId: flight.id,
      eventType: "cancelled",
      statusBefore: existing.status,
      statusAfter: "cancelled",
      notes: cancelReason ?? null,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
    });

    if (existing.status === "ticketed" || existing.status === "issued") {
      await postFlightCancelled({
        ticketId: flight.id,
        ticketNumber: flight.ticketNumber ?? `TKT-${flight.id}`,
        amount: parseFloat(flight.amount),
        currency: "PKR",
      });
    }

    return res.json({ ok: true, flight: fmtFlight(flight) });
  } catch (err) {
    req.log.error({ err }, "Cancel flight error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Refund ────────────────────────────────────────────────────────────────────

router.post("/flight-quotations/:id/refund", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { refundAmount } = req.body;
    const [existing] = await db
      .select()
      .from(flightQuotationsTable)
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!["cancelled", "refund_pending"].includes(existing.status)) {
      return res.status(400).json({ error: "Ticket must be cancelled before refund" });
    }

    const amt = parseFloat(refundAmount ?? existing.amount ?? "0");
    const [flight] = await db
      .update(flightQuotationsTable)
      .set({
        status: "refunded",
        refundAmount: amt.toString(),
        refundedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();

    await db.insert(flightTicketEventsTable).values({
      ticketId: flight.id,
      eventType: "refunded",
      statusBefore: existing.status,
      statusAfter: "refunded",
      notes: `Refund PKR ${amt.toLocaleString()}`,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
    });

    await postFlightRefund({
      ticketId: flight.id,
      ticketNumber: flight.ticketNumber ?? `TKT-${flight.id}`,
      refundAmount: amt,
      currency: "PKR",
    });

    return res.json({ ok: true, flight: fmtFlight(flight) });
  } catch (err) {
    req.log.error({ err }, "Refund flight error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Mark Refund Pending ───────────────────────────────────────────────────────

router.post("/flight-quotations/:id/refund-pending", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const [existing] = await db
      .select()
      .from(flightQuotationsTable)
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const [flight] = await db
      .update(flightQuotationsTable)
      .set({ status: "refund_pending", updatedAt: new Date() })
      .where(eq(flightQuotationsTable.id, parseInt(req.params.id as string)))
      .returning();

    await db.insert(flightTicketEventsTable).values({
      ticketId: flight.id,
      eventType: "refund_pending",
      statusBefore: existing.status,
      statusAfter: "refund_pending",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
    });

    return res.json({ ok: true, flight: fmtFlight(flight) });
  } catch (err) {
    req.log.error({ err }, "Mark refund pending error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── BSP Settlement Report ─────────────────────────────────────────────────────

router.get("/bsp-report", requireAuth, async (req, res) => {
  try {
    const { fromDate, toDate, airline } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (fromDate) conditions.push(gte(flightQuotationsTable.issuedAt, new Date(fromDate)));
    if (airline) conditions.push(eq(flightQuotationsTable.airline, airline));
    const flights = await db
      .select()
      .from(flightQuotationsTable)
      .where(
        and(
          ...[
            ...(conditions.length > 0 ? conditions : []),
          ],
          or(
            eq(flightQuotationsTable.status, "ticketed"),
            eq(flightQuotationsTable.status, "issued"),
            eq(flightQuotationsTable.status, "cancelled"),
            eq(flightQuotationsTable.status, "refunded"),
          )
        )
      )
      .orderBy(desc(flightQuotationsTable.issuedAt));
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return res.json(
      flights.map((f) => ({
        id: f.id,
        ticketNumber: f.ticketNumber,
        pnr: f.pnr,
        airline: f.airline,
        passenger: clientMap.get(f.clientId) ?? "—",
        route: `${f.origin} → ${f.destination}`,
        origin: f.origin,
        destination: f.destination,
        departureDate: f.departureDate instanceof Date ? f.departureDate.toISOString() : f.departureDate,
        fare: parseFloat(f.amount ?? "0"),
        currency: f.currency,
        airlineCommission: f.airlineCommission ? parseFloat(f.airlineCommission) : 0,
        commissionRate: f.commissionRate ? parseFloat(f.commissionRate) : 0,
        netPayable: parseFloat(f.amount ?? "0") - (f.airlineCommission ? parseFloat(f.airlineCommission) : 0),
        issuedAt: f.issuedAt,
        issuedByName: f.issuedByName,
        status: f.status,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "BSP report error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Staff Ticket Log ──────────────────────────────────────────────────────────

router.get("/staff-ticket-log", requireAuth, async (req, res) => {
  try {
    const { userId, fromDate, status } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (status) conditions.push(eq(flightQuotationsTable.status, status));
    if (fromDate) conditions.push(gte(flightQuotationsTable.createdAt, new Date(fromDate)));
    const flights = await db
      .select()
      .from(flightQuotationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(flightQuotationsTable.createdAt));
    const clients = await db.select().from(clientsTable);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return res.json(
      flights.map((f) => ({
        id: f.id,
        ticketNumber: f.ticketNumber ?? "—",
        pnr: f.pnr ?? "—",
        airline: f.airline ?? "—",
        passenger: clientMap.get(f.clientId) ?? "—",
        route: `${f.origin} → ${f.destination}`,
        amount: parseFloat(f.amount ?? "0"),
        currency: f.currency,
        status: f.status,
        issuedByName: f.issuedByName ?? "—",
        issuedAt: f.issuedAt,
        cancelledAt: f.cancelledAt,
        refundedAt: f.refundedAt,
        createdAt: f.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Staff ticket log error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Local Airline Stubs ───────────────────────────────────────────────────────

router.get("/airlines/providers", requireAuth, async (_req, res) => {
  return res.json([
    { code: "PK", name: "PIA (Pakistan International Airlines)", status: "coming_soon", integrationType: "direct_api" },
    { code: "PA", name: "Airblue", status: "coming_soon", integrationType: "direct_api" },
    { code: "E4", name: "AirSial", status: "coming_soon", integrationType: "direct_api" },
    { code: "9P", name: "Fly Jinnah", status: "coming_soon", integrationType: "direct_api" },
    { code: "OQ", name: "Salam Air", status: "coming_soon", integrationType: "direct_api" },
  ]);
});

export default router;
