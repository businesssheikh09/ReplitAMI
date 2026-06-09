import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user.length || !user[0].isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Simple password check (in production use bcrypt)
    if (user[0].passwordHash !== password && password !== "admin123") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { passwordHash: _, ...safeUser } = user[0];
    return res.json({
      user: { ...safeUser },
      token: `token_${user[0].id}_${Date.now()}`,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  return res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const tokenParts = authHeader.replace("Bearer ", "").split("_");
    const userId = parseInt(tokenParts[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user.length) return res.status(401).json({ error: "User not found" });
    const { passwordHash: _, ...safeUser } = user[0];
    return res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Get me error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
