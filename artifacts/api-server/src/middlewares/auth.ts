import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  canIssueTickets: boolean;
  ticketingPin: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function parseUserIdFromToken(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).split("_");
  if (parts.length < 3 || parts[0] !== "token") return null;
  const id = parseInt(parts[1], 10);
  return Number.isNaN(id) || id <= 0 ? null : id;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = parseUserIdFromToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    isActive: usersTable.isActive,
    canIssueTickets: usersTable.canIssueTickets,
    ticketingPin: usersTable.ticketingPin,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Required role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}
