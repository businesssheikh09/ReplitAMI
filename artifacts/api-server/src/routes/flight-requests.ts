import { Router } from "express";
import { db, flightRequestsTable, flightRequestEventsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { calculatePaymentDeadline } from "../services/deadline-calculator.js";
import { postFlightIssued } from "../services/journal-poster.js";

const router = Router();

const PKR_MARKUP = 2000;

function generateRequestNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `FR-${date}-${rand}`;
}

// ── Public ───────────────────────────────────────────────────────────────────

router.post("/public/flight-requests", async (req, res) => {
  try {
    const {
      clientName, clientPhone, clientEmail, clientWhatsapp,
      tripType, origin, destination, departureDate, returnDate,
      passengerCount, cabinClass, airline, fare, flightDataJson,
      requestType, source, holdMinutes,
    } = req.body;

    if (!clientName || !clientPhone || !origin || !destination || !departureDate) {
      return res.status(400).json({
        error: "clientName, clientPhone, origin, destination and departureDate are required",
      });
    }

    const isGdsHold = !!flightDataJson;
    const holdMins = Number(holdMinutes ?? 120);

    let resolvedActual: string | null = null;
    let resolvedBooking: string | null = null;
    if (fare) {
      const fareNum = Number(fare);
      if (!isNaN(fareNum) && fareNum > 0) {
        if (requestType === "group") {
          resolvedBooking = String(fareNum);
          resolvedActual = String(Math.max(0, fareNum - PKR_MARKUP));
        } else {
          resolvedActual = String(fareNum);
          resolvedBooking = String(fareNum + PKR_MARKUP);
        }
      }
    }

    const now = new Date();
    const holdExpiresAt = isGdsHold ? new Date(now.getTime() + holdMins * 60_000) : null;

    const [request] = await db.insert(flightRequestsTable).values({
      requestNumber: generateRequestNumber(),
      requestType: requestType ?? "direct",
      source: source ?? "website",
      clientName,
      clientPhone,
      clientEmail: clientEmail ?? null,
      clientWhatsapp: clientWhatsapp ?? null,
      tripType: tripType ?? "one_way",
      origin,
      destination,
      departureDate,
      returnDate: returnDate ?? null,
      passengerCount: Number(passengerCount ?? 1),
      cabinClass: cabinClass ?? "economy",
      airline: airline ?? null,
      fare: fare ?? null,
      actualFare: resolvedActual,
      bookingFare: resolvedBooking,
      flightDataJson: flightDataJson ?? null,
      holdMinutes: holdMins,
      holdExpiresAt,
      status: isGdsHold ? "on_hold" : "pending",
    }).returning();

    await db.insert(flightRequestEventsTable).values({
      requestId: request.id,
      userId: null,
      userName: null,
      action: isGdsHold ? "on_hold" : "created",
      metadata: { source: source ?? "website", holdMinutes: holdMins },
    });

    return res.status(201).json({
      id: request.id,
      requestNumber: request.requestNumber,
      status: request.status,
      holdExpiresAt: request.holdExpiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Create flight request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Public status lookup — returns safe subset only (no PII beyond masked name)
router.get("/public/flight-requests/:referenceNumber", async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const [row] = await db
      .select()
      .from(flightRequestsTable)
      .where(eq(flightRequestsTable.requestNumber, referenceNumber))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Booking not found" });

    return res.json({
      requestNumber: row.requestNumber,
      status: row.status,
      holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
      paymentDeadlineAt: row.paymentDeadlineAt?.toISOString() ?? null,
      hasPaymentProof: !!row.paymentProofKey,
      origin: row.origin,
      destination: row.destination,
      departureDate: row.departureDate,
      airline: row.airline,
      createdAt: row.createdAt.toISOString(),
      clientFirstName: row.clientName.split(" ")[0],
    });
  } catch (err) {
    req.log.error({ err }, "Public flight request lookup error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Public payment proof submission
router.post("/public/flight-requests/:referenceNumber/payment-proof", async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const { objectKey } = req.body;

    if (!objectKey) {
      return res.status(400).json({ error: "objectKey is required" });
    }

    const [row] = await db
      .select()
      .from(flightRequestsTable)
      .where(eq(flightRequestsTable.requestNumber, referenceNumber))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Booking not found" });

    const terminalStatuses = ["expired", "cancelled", "issued"];
    if (terminalStatuses.includes(row.status)) {
      return res.status(400).json({ error: `Cannot submit proof for a booking with status: ${row.status}` });
    }

    const newStatus = row.status === "on_hold" ? "payment_pending" : row.status;

    const [updated] = await db
      .update(flightRequestsTable)
      .set({
        paymentProofKey: objectKey,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(flightRequestsTable.id, row.id))
      .returning();

    await db.insert(flightRequestEventsTable).values({
      requestId: row.id,
      userId: null,
      userName: null,
      action: "payment_proof_submitted",
      metadata: { objectKey },
    });

    return res.json({
      success: true,
      status: updated.status,
      message: "Payment proof received. Our team will verify and update your booking.",
    });
  } catch (err) {
    req.log.error({ err }, "Payment proof submission error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── ERP-gated ────────────────────────────────────────────────────────────────

router.get("/flight-requests/count", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(flightRequestsTable)
      .where(eq(flightRequestsTable.status, "pending"));
    return res.json({ count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Count flight requests error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/flight-requests", requireAuth, async (req, res) => {
  try {
    const { status, dateFrom, dateTo, airline, origin, destination, search } =
      req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(flightRequestsTable)
      .orderBy(desc(flightRequestsTable.createdAt));

    if (status && status !== "all") rows = rows.filter((r) => r.status === status);
    if (dateFrom) rows = rows.filter((r) => r.departureDate >= dateFrom);
    if (dateTo) rows = rows.filter((r) => r.departureDate <= dateTo);
    if (airline) { const a = airline.toLowerCase(); rows = rows.filter((r) => r.airline?.toLowerCase().includes(a)); }
    if (origin) { const o = origin.toUpperCase(); rows = rows.filter((r) => r.origin.toUpperCase().includes(o)); }
    if (destination) { const d = destination.toUpperCase(); rows = rows.filter((r) => r.destination.toUpperCase().includes(d)); }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) =>
        r.clientName.toLowerCase().includes(s) ||
        r.clientPhone.includes(s) ||
        (r.clientEmail?.toLowerCase() ?? "").includes(s) ||
        r.requestNumber.toLowerCase().includes(s),
      );
    }

    const assigneeIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))] as number[];
    const userMap: Record<number, string> = {};
    if (assigneeIds.length > 0) {
      const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
      users.filter((u) => assigneeIds.includes(u.id)).forEach((u) => { userMap[u.id] = u.name; });
    }

    return res.json(
      rows.map((r) => ({
        ...r,
        actualFare: r.actualFare != null ? parseFloat(r.actualFare) : null,
        bookingFare: r.bookingFare != null ? parseFloat(r.bookingFare) : null,
        holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
        paymentDeadlineAt: r.paymentDeadlineAt?.toISOString() ?? null,
        assignedToName: r.assignedTo ? (userMap[r.assignedTo] ?? null) : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "List flight requests error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/flight-requests/:id", requireAuth, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(flightRequestsTable)
      .where(eq(flightRequestsTable.id, parseInt(String(req.params.id))))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Not found" });

    const events = await db
      .select()
      .from(flightRequestEventsTable)
      .where(eq(flightRequestEventsTable.requestId, row.id))
      .orderBy(desc(flightRequestEventsTable.createdAt));

    let assignedToName: string | null = null;
    if (row.assignedTo) {
      const [u] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, row.assignedTo))
        .limit(1);
      assignedToName = u?.name ?? null;
    }

    return res.json({
      ...row,
      actualFare: row.actualFare != null ? parseFloat(row.actualFare) : null,
      bookingFare: row.bookingFare != null ? parseFloat(row.bookingFare) : null,
      holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
      paymentDeadlineAt: row.paymentDeadlineAt?.toISOString() ?? null,
      hasPaymentProof: !!row.paymentProofKey,
      paymentProofKey: row.paymentProofKey ?? null,
      assignedToName,
      events,
    });
  } catch (err) {
    req.log.error({ err }, "Get flight request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flight-requests/:id", requireAuth, async (req, res) => {
  try {
    const { status, assignedTo, adminNotes, actualFare, bookingFare, paymentDeadlineAt, holdExpiresAt } = req.body;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (status !== undefined) update.status = status;
    if (assignedTo !== undefined) update.assignedTo = assignedTo ? Number(assignedTo) : null;
    if (adminNotes !== undefined) update.adminNotes = adminNotes;
    if (actualFare !== undefined) update.actualFare = actualFare != null ? String(Number(actualFare)) : null;
    if (bookingFare !== undefined) update.bookingFare = bookingFare != null ? String(Number(bookingFare)) : null;
    if (paymentDeadlineAt !== undefined) update.paymentDeadlineAt = paymentDeadlineAt ? new Date(paymentDeadlineAt) : null;
    if (holdExpiresAt !== undefined) update.holdExpiresAt = holdExpiresAt ? new Date(holdExpiresAt) : null;

    // Auto-compute paymentDeadlineAt when moving to payment_pending (if not already set)
    if (status === "payment_pending" && !update.paymentDeadlineAt) {
      const [existing] = await db
        .select({ departureDate: flightRequestsTable.departureDate, paymentDeadlineAt: flightRequestsTable.paymentDeadlineAt })
        .from(flightRequestsTable)
        .where(eq(flightRequestsTable.id, parseInt(String(req.params.id))))
        .limit(1);

      if (existing && !existing.paymentDeadlineAt && existing.departureDate) {
        const flightDate = new Date(existing.departureDate + "T00:00:00");
        const { deadline } = calculatePaymentDeadline(flightDate, new Date());
        update.paymentDeadlineAt = deadline;
      }
    }

    const [updated] = await db
      .update(flightRequestsTable)
      .set(update)
      .where(eq(flightRequestsTable.id, parseInt(String(req.params.id))))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    const reqUser = (req as any).user;
    await db.insert(flightRequestEventsTable).values({
      requestId: updated.id,
      userId: reqUser?.id ?? null,
      userName: reqUser?.name ?? null,
      action: status ?? "updated",
      metadata: req.body,
    });

    if (status === "issued" && updated.bookingFare) {
      const bf = parseFloat(updated.bookingFare);
      const af = updated.actualFare ? parseFloat(updated.actualFare) : Math.max(0, bf - PKR_MARKUP);
      await postFlightIssued({ requestId: updated.id, requestNumber: updated.requestNumber, bookingFare: bf, actualFare: af });
    }

    return res.json({
      ...updated,
      actualFare: updated.actualFare != null ? parseFloat(updated.actualFare) : null,
      bookingFare: updated.bookingFare != null ? parseFloat(updated.bookingFare) : null,
      holdExpiresAt: updated.holdExpiresAt?.toISOString() ?? null,
      paymentDeadlineAt: updated.paymentDeadlineAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Update flight request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PIN-protected ticket issuance (status must be ready_to_issue)
router.post("/flight-requests/:id/issue-ticket", requireAuth, async (req, res) => {
  try {
    const principal = (req as any).user;

    if (!principal.canIssueTickets) {
      return res.status(403).json({ error: "You are not authorised to issue tickets" });
    }

    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN is required" });
    if (!principal.ticketingPin || principal.ticketingPin !== pin) {
      return res.status(401).json({ error: "Invalid ticketing PIN" });
    }

    const [row] = await db
      .select()
      .from(flightRequestsTable)
      .where(eq(flightRequestsTable.id, parseInt(String(req.params.id))))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status !== "ready_to_issue") {
      return res.status(400).json({
        error: `Request must be in 'ready_to_issue' status to issue ticket (current: ${row.status})`,
      });
    }

    const [updated] = await db
      .update(flightRequestsTable)
      .set({ status: "issued", updatedAt: new Date() })
      .where(eq(flightRequestsTable.id, row.id))
      .returning();

    await db.insert(flightRequestEventsTable).values({
      requestId: row.id,
      userId: principal.id ?? null,
      userName: principal.name ?? null,
      action: "issued",
      metadata: { issuedBy: principal.name },
    });

    if (updated.bookingFare) {
      const bf = parseFloat(updated.bookingFare);
      const af = updated.actualFare ? parseFloat(updated.actualFare) : Math.max(0, bf - PKR_MARKUP);
      await postFlightIssued({ requestId: updated.id, requestNumber: updated.requestNumber, bookingFare: bf, actualFare: af });
    }

    return res.json({ success: true, requestNumber: updated.requestNumber, message: "Ticket issued successfully" });
  } catch (err) {
    req.log.error({ err }, "Issue ticket error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/flight-requests/:id/events", requireAuth, async (req, res) => {
  try {
    const { action, metadata } = req.body;
    const reqUser = (req as any).user;

    const [event] = await db.insert(flightRequestEventsTable).values({
      requestId: parseInt(String(req.params.id)),
      userId: reqUser?.id ?? null,
      userName: reqUser?.name ?? null,
      action: action ?? "noted",
      metadata: metadata ?? null,
    }).returning();

    return res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "Add flight request event error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/assignable", requireAuth, async (req, res) => {
  try {
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable);
    return res.json(users);
  } catch (err) {
    req.log.error({ err }, "List assignable users error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
