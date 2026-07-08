import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/auth.js";
import { loginRateLimiter, authRateLimiter } from "../middlewares/rate-limit.js";
import { verifyPassword, hashPassword, writeAuthAudit } from "../lib/security.js";

const router = Router();

router.use("/auth", authRateLimiter);

router.post("/auth/login", loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.isActive) {
      await writeAuthAudit({ event: "login_failed", email, detail: "no active user", req });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await writeAuthAudit({ event: "login_failed", userId: user.id, email, detail: "bad password", req });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = randomBytes(32).toString("hex");
    await db.update(usersTable).set({ sessionToken: token }).where(eq(usersTable.id, user.id));

    await writeAuthAudit({ event: "login_success", userId: user.id, email, req });

    const { passwordHash: _, sessionToken: __, ...safeUser } = user;
    return res.json({ user: safeUser, token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await db.update(usersTable).set({ sessionToken: null }).where(eq(usersTable.sessionToken, token));
    }
  } catch (err) {
    logger.warn({ err }, "Logout cleanup error");
  }
  return res.json({ message: "Logged out" });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    await db.update(usersTable)
      .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await writeAuthAudit({ event: "password_change", userId: user.id, email: user.email, req });
    return res.json({ message: "Password changed" });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token)).limit(1);
    if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });
    const { passwordHash: _, sessionToken: __, ...safeUser } = user;
    return res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Get me error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
