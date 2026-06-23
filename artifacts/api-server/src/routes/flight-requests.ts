import { Router } from "express";
import { db, flightRequestsTable, flightRequestEventsTable, usersTable } from "@workspace/db";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

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
      requestType, source,
    } = req.body;

    if (!clientName || !clientPhone || !origin || !destination || !departureDate) {
      return res.status(400).json({
        error: "clientName, clientPhone, origin, destination and departureDate are required",
      });
    }

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
      flightDataJson: flightDataJson ?? null,
      status: "pending",
    }).returning();

    await db.insert(flightRequestEventsTable).values({
      requestId: request.id,
      userId: null,
      userName: null,
      action: "created",
      metadata: { source: source ?? "website" },
    });

    return res.status(201).json({
      id: request.id,
      requestNumber: request.requestNumber,
    });
  } catch (err) {
    req.log.error({ err }, "Create flight request error");
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

    if (status && status !== "all") {
      rows = rows.filter((r) => r.status === status);
    }
    if (dateFrom) {
      rows = rows.filter((r) => r.departureDate >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((r) => r.departureDate <= dateTo);
    }
    if (airline) {
      const a = airline.toLowerCase();
      rows = rows.filter((r) => r.airline?.toLowerCase().includes(a));
    }
    if (origin) {
      const o = origin.toUpperCase();
      rows = rows.filter((r) => r.origin.toUpperCase().includes(o));
    }
    if (destination) {
      const d = destination.toUpperCase();
      rows = rows.filter((r) => r.destination.toUpperCase().includes(d));
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.clientName.toLowerCase().includes(s) ||
          r.clientPhone.includes(s) ||
          (r.clientEmail?.toLowerCase() ?? "").includes(s) ||
          r.requestNumber.toLowerCase().includes(s)
      );
    }

    const assigneeIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))] as number[];
    const userMap: Record<number, string> = {};
    if (assigneeIds.length > 0) {
      const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
      users.filter((u) => assigneeIds.includes(u.id)).forEach((u) => {
        userMap[u.id] = u.name;
      });
    }

    const enriched = rows.map((r) => ({
      ...r,
      assignedToName: r.assignedTo ? (userMap[r.assignedTo] ?? null) : null,
    }));

    return res.json(enriched);
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

    return res.json({ ...row, assignedToName, events });
  } catch (err) {
    req.log.error({ err }, "Get flight request error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/flight-requests/:id", requireAuth, async (req, res) => {
  try {
    const { status, assignedTo, adminNotes } = req.body;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (status !== undefined) update.status = status;
    if (assignedTo !== undefined) update.assignedTo = assignedTo ? Number(assignedTo) : null;
    if (adminNotes !== undefined) update.adminNotes = adminNotes;

    const [updated] = await db
      .update(flightRequestsTable)
      .set(update)
      .where(eq(flightRequestsTable.id, parseInt(String(req.params.id))))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    const reqUser = (req as any).user;
    const action = status ?? "updated";
    await db.insert(flightRequestEventsTable).values({
      requestId: updated.id,
      userId: reqUser?.id ?? null,
      userName: reqUser?.name ?? null,
      action,
      metadata: req.body,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update flight request error");
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
