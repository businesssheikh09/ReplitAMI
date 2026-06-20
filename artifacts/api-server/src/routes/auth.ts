import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = randomBytes(32).toString("hex");
    await db.update(usersTable).set({ sessionToken: token }).where(eq(usersTable.id, user.id));

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
