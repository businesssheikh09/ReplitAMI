import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const { role, search } = req.query as Record<string, string>;
    let users = await db.select().from(usersTable);
    if (role) users = users.filter(u => u.role === role);
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }
    return res.json(users.map(({ passwordHash, ticketingPin, ...u }) => ({
      ...u,
      password: passwordHash,
      hasTicketingPin: !!ticketingPin,
    })));
  } catch (err) {
    req.log.error({ err }, "List users error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, phone, canIssueTickets, ticketingPin } = req.body;
    const [user] = await db.insert(usersTable).values({
      name, email, passwordHash: password || "admin123", role: role || "sales", phone,
      canIssueTickets: canIssueTickets || false,
      ticketingPin: ticketingPin || null,
    }).returning();
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.status(201).json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Create user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, role, phone, isActive, canIssueTickets, ticketingPin } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;
    if (canIssueTickets !== undefined) updates.canIssueTickets = canIssueTickets;
    if (ticketingPin !== undefined) updates.ticketingPin = ticketingPin || null;
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
