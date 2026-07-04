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
  mustChangePassword: boolean;
}

// Endpoints a user with a pending forced password change may still reach.
const MUST_CHANGE_ALLOWLIST = [
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);

  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    isActive: usersTable.isActive,
    canIssueTickets: usersTable.canIssueTickets,
    ticketingPin: usersTable.ticketingPin,
    mustChangePassword: usersTable.mustChangePassword,
  }).from(usersTable).where(eq(usersTable.sessionToken, token)).limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;

  // Force a pending password change: block every endpoint except the
  // allowlisted auth endpoints until the user sets a new password.
  if (user.mustChangePassword) {
    const path = req.originalUrl.split("?")[0];
    if (!MUST_CHANGE_ALLOWLIST.includes(path)) {
      res.status(403).json({ error: "Password change required", mustChangePassword: true });
      return;
    }
  }

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
