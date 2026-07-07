import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, writeAuthAudit } from "../lib/security.js";

const router = Router();

router.get("/users", requireAuth, async (req, res) => {
  try {
    const { role, search } = req.query as Record<string, string>;
    let users = await db.select().from(usersTable);
    if (role) users = users.filter(u => u.role === role);
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }
    return res.json(users.map(({ passwordHash: _, ticketingPin, ...u }) => ({
      ...u,
      hasTicketingPin: !!ticketingPin,
    })));
  } catch (err) {
    req.log.error({ err }, "List users error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", requireAuth, async (req, res) => {
  try {
    const { name, email, password, role, phone, canIssueTickets, ticketingPin, mustChangePassword } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
    if (!email || !String(email).trim()) return res.status(400).json({ error: "email is required" });

    // Check for duplicate email
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) return res.status(409).json({ error: "A user with this email already exists" });

    const [user] = await db.insert(usersTable).values({
      name, email, passwordHash: await hashPassword(password || "admin123"), role: role || "sales", phone,
      canIssueTickets: canIssueTickets || false,
      ticketingPin: ticketingPin || null,
      mustChangePassword: mustChangePassword === true,
    }).returning();
    await writeAuthAudit({ event: "user_created", userId: user.id, email: user.email, performedBy: req.user!.id, req });
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.status(201).json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Create user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/reset-password", requireAuth, requireRole("management"), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { temporaryPassword } = req.body;
    if (!temporaryPassword || typeof temporaryPassword !== "string" || temporaryPassword.length < 6) {
      return res.status(400).json({ error: "temporaryPassword must be at least 6 characters" });
    }
    const [user] = await db.update(usersTable)
      .set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    await writeAuthAudit({ event: "password_reset", userId: user.id, email: user.email, performedBy: req.user!.id, req });
    return res.json({ message: "Password reset. User must change password on next login." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, email, role, phone, isActive, canIssueTickets, ticketingPin, mustChangePassword } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;
    if (canIssueTickets !== undefined) updates.canIssueTickets = canIssueTickets;
    if (ticketingPin !== undefined) updates.ticketingPin = ticketingPin || null;
    if (mustChangePassword !== undefined) updates.mustChangePassword = mustChangePassword;
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ticketingPin: __, ...safeUser } = user;
    return res.json({ ...safeUser, hasTicketingPin: !!__ });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete user error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
