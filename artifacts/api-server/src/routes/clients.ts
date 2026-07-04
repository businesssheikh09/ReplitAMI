import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { clientsTable, clientNotesTable, followUpsTable, usersTable, quotationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const { search, status, country, assignedTo } = req.query as Record<string, string>;
    let clients = await db.select().from(clientsTable);
    if (search) {
      const s = search.toLowerCase();
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s)
      );
    }
    if (status) clients = clients.filter(c => c.leadStatus === status);
    if (country) clients = clients.filter(c => c.country === country);
    if (assignedTo) clients = clients.filter(c => c.assignedTo === parseInt(assignedTo));

    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const quotations = await db.select().from(quotationsTable);
    const bookingCounts = new Map<number, number>();
    quotations.forEach(q => {
      bookingCounts.set(q.clientId, (bookingCounts.get(q.clientId) || 0) + 1);
    });

    return res.json(clients.map(c => ({
      ...c,
      assignedToName: c.assignedTo ? userMap.get(c.assignedTo) || null : null,
      totalBookings: bookingCounts.get(c.id) || 0,
    })));
  } catch (err) {
    req.log.error({ err }, "List clients error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, async (req, res) => {
  try {
    const [client] = await db.insert(clientsTable).values({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      whatsapp: req.body.whatsapp,
      country: req.body.country,
      city: req.body.city,
      leadStatus: req.body.leadStatus || "new",
      assignedTo: req.body.assignedTo || null,
    }).returning();
    return res.status(201).json({ ...client, assignedToName: null, totalBookings: 0 });
  } catch (err) {
    req.log.error({ err }, "Create client error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) return res.status(404).json({ error: "Client not found" });

    const [notes, followUps, quotations, users] = await Promise.all([
      db.select().from(clientNotesTable).where(eq(clientNotesTable.clientId, id)),
      db.select().from(followUpsTable).where(eq(followUpsTable.clientId, id)),
      db.select().from(quotationsTable).where(eq(quotationsTable.clientId, id)),
      db.select().from(usersTable),
    ]);

    const userMap = new Map(users.map(u => [u.id, u.name]));
    const totalRevenue = quotations
      .filter(q => q.status === "accepted")
      .reduce((sum, q) => sum + parseFloat(q.totalAmount), 0);

    return res.json({
      ...client,
      assignedToName: client.assignedTo ? userMap.get(client.assignedTo) || null : null,
      notes: notes.map(n => ({ ...n, createdByName: userMap.get(n.createdBy) || "Unknown" })),
      followUps: followUps.map(f => ({
        ...f,
        clientName: client.name,
        assignedToName: userMap.get(f.assignedTo) || null,
        dueDate: f.dueDate.toISOString(),
      })),
      quotations: quotations.map(q => ({
        ...q,
        clientName: client.name,
        createdByName: userMap.get(q.createdBy) || null,
        totalAmount: parseFloat(q.totalAmount),
        validUntil: q.validUntil.toISOString(),
        createdAt: q.createdAt.toISOString(),
      })),
      totalBookings: quotations.length,
      totalRevenue,
    });
  } catch (err) {
    req.log.error({ err }, "Get client error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["name", "email", "phone", "whatsapp", "country", "city", "leadStatus", "assignedTo"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f === "leadStatus" ? "leadStatus" : f] = req.body[f]; });
    const [client] = await db.update(clientsTable).set(updates).where(eq(clientsTable.id, id)).returning();
    if (!client) return res.status(404).json({ error: "Client not found" });
    return res.json({ ...client, assignedToName: null, totalBookings: 0 });
  } catch (err) {
    req.log.error({ err }, "Update client error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(clientsTable).where(eq(clientsTable.id, parseInt(req.params.id)));
    return res.json({ message: "Client deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete client error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/notes", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notes = await db.select().from(clientNotesTable).where(eq(clientNotesTable.clientId, id));
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json(notes.map(n => ({ ...n, createdByName: userMap.get(n.createdBy) || "Unknown" })));
  } catch (err) {
    req.log.error({ err }, "List notes error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients/:id/notes", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [note] = await db.insert(clientNotesTable).values({
      clientId: id,
      content: req.body.content,
      createdBy: req.body.createdBy || 1,
    }).returning();
    return res.status(201).json({ ...note, createdByName: "Admin" });
  } catch (err) {
    req.log.error({ err }, "Create note error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/followups", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [followUps, client, users] = await Promise.all([
      db.select().from(followUpsTable).where(eq(followUpsTable.clientId, id)),
      db.select().from(clientsTable).where(eq(clientsTable.id, id)),
      db.select().from(usersTable),
    ]);
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json(followUps.map(f => ({
      ...f,
      clientName: client[0]?.name || "",
      assignedToName: userMap.get(f.assignedTo) || null,
      dueDate: f.dueDate.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List followups error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients/:id/followups", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [followUp] = await db.insert(followUpsTable).values({
      clientId: id,
      dueDate: new Date(req.body.dueDate),
      type: req.body.type,
      status: "pending",
      notes: req.body.notes,
      assignedTo: req.body.assignedTo || 1,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    return res.status(201).json({
      ...followUp,
      clientName: client?.name || "",
      assignedToName: null,
      dueDate: followUp.dueDate.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create followup error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/followups", requireAuth, async (req, res) => {
  try {
    const { assignedTo, dueBefore } = req.query as Record<string, string>;
    let followUps = await db.select().from(followUpsTable);
    if (assignedTo) followUps = followUps.filter(f => f.assignedTo === parseInt(assignedTo));
    if (dueBefore) followUps = followUps.filter(f => f.dueDate <= new Date(dueBefore));
    const [clients, users] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(usersTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json(followUps.map(f => ({
      ...f,
      clientName: clientMap.get(f.clientId) || "",
      assignedToName: userMap.get(f.assignedTo) || null,
      dueDate: f.dueDate.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "List all followups error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
