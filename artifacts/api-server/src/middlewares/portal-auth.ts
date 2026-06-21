import { Request, Response, NextFunction } from "express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface PortalAuthUser {
  id: number;
  type: string;
  status: string;
  fullName: string;
  email: string | null;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalAuthUser;
    }
  }
}

export async function requirePortalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const [user] = await db
    .select({
      id: portalUsersTable.id,
      type: portalUsersTable.type,
      status: portalUsersTable.status,
      fullName: portalUsersTable.fullName,
      email: portalUsersTable.email,
      phone: portalUsersTable.phone,
    })
    .from(portalUsersTable)
    .where(eq(portalUsersTable.portalSessionToken, token))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.portalUser = user;
  next();
}

export function requirePortalType(...types: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.portalUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!types.includes(req.portalUser.type)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    next();
  };
}
