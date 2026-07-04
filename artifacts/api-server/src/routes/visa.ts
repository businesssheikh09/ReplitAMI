import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { visaApplicationsTable, clientsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/visa-applications", requireAuth, async (req, res) => {
  try {
    const { status, clientId, assignedTo } = req.query as Record<string, string>;
    let applications = await db.select().from(visaApplicationsTable);
    if (status) applications = applications.filter(a => a.status === status);
    if (clientId) applications = applications.filter(a => a.clientId === parseInt(clientId));
    if (assignedTo) applications = applications.filter(a => a.assignedTo === parseInt(assignedTo));
    const [clients, users] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(usersTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json(applications.map(a => ({
      ...a,
      clientName: clientMap.get(a.clientId) || "",
      assignedToName: a.assignedTo ? userMap.get(a.assignedTo) || null : null,
      passportExpiry: a.passportExpiry?.toISOString() || null,
      submittedAt: a.submittedAt?.toISOString() || null,
      approvedAt: a.approvedAt?.toISOString() || null,
    })));
  } catch (err) {
    req.log.error({ err }, "List visa applications error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/visa-applications", requireAuth, async (req, res) => {
  try {
    if (!req.body.clientId) return res.status(400).json({ error: "clientId is required" });
    const [application] = await db.insert(visaApplicationsTable).values({
      clientId: req.body.clientId,
      passportNumber: req.body.passportNumber,
      nationality: req.body.nationality,
      passportExpiry: req.body.passportExpiry ? new Date(req.body.passportExpiry) : null,
      status: "documents_required",
      assignedTo: req.body.assignedTo || null,
      notes: req.body.notes,
    }).returning();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.body.clientId));
    return res.status(201).json({
      ...application,
      clientName: client?.name || "",
      assignedToName: null,
      passportExpiry: application.passportExpiry?.toISOString() || null,
      submittedAt: null,
      approvedAt: null,
    });
  } catch (err) {
    req.log.error({ err }, "Create visa application error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/visa-applications/:id", requireAuth, async (req, res) => {
  try {
    const [application] = await db.select().from(visaApplicationsTable).where(eq(visaApplicationsTable.id, parseInt(String(req.params.id))));
    if (!application) return res.status(404).json({ error: "Visa application not found" });
    const [clients, users] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(usersTable),
    ]);
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));
    return res.json({
      ...application,
      clientName: clientMap.get(application.clientId) || "",
      assignedToName: application.assignedTo ? userMap.get(application.assignedTo) || null : null,
      passportExpiry: application.passportExpiry?.toISOString() || null,
      submittedAt: application.submittedAt?.toISOString() || null,
      approvedAt: application.approvedAt?.toISOString() || null,
    });
  } catch (err) {
    req.log.error({ err }, "Get visa application error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/visa-applications/:id", requireAuth, async (req, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["status", "assignedTo", "rejectionReason", "notes"];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.submittedAt) updates.submittedAt = new Date(req.body.submittedAt);
    if (req.body.approvedAt) updates.approvedAt = new Date(req.body.approvedAt);
    const [application] = await db.update(visaApplicationsTable).set(updates).where(eq(visaApplicationsTable.id, parseInt(String(req.params.id)))).returning();
    if (!application) return res.status(404).json({ error: "Visa application not found" });
    return res.json({
      ...application,
      clientName: "",
      assignedToName: null,
      passportExpiry: application.passportExpiry?.toISOString() || null,
      submittedAt: application.submittedAt?.toISOString() || null,
      approvedAt: application.approvedAt?.toISOString() || null,
    });
  } catch (err) {
    req.log.error({ err }, "Update visa application error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
