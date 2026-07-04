import bcrypt from "bcryptjs";
import { db, usersTable, portalUsersTable, authAuditLogTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Request } from "express";
import { logger } from "./logger";

const BCRYPT_ROUNDS = 10;

export function isBcryptHash(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\$2[aby]?\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored value. Uses bcrypt.compare and,
 * for not-yet-migrated legacy rows, falls back to a plaintext equality check.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored).catch(() => false);
  }
  return stored === plain;
}

export type AuthAuditEvent =
  | "login_success"
  | "login_failed"
  | "password_reset"
  | "password_change"
  | "user_created";

export async function writeAuthAudit(entry: {
  event: AuthAuditEvent;
  userId?: number | null;
  email?: string | null;
  performedBy?: number | null;
  detail?: string | null;
  req?: Request;
}): Promise<void> {
  try {
    const ipAddress = entry.req
      ? (entry.req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || entry.req.ip || null)
      : null;
    await db.insert(authAuditLogTable).values({
      event: entry.event,
      userId: entry.userId ?? null,
      email: entry.email ?? null,
      performedBy: entry.performedBy ?? null,
      detail: entry.detail ?? null,
      ipAddress,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write auth audit log entry");
  }
}

/**
 * Idempotent migration: converts any plaintext passwords in the users and
 * portal_users tables into bcrypt hashes. Safe to run repeatedly — rows that
 * are already bcrypt hashes are left untouched, preserving each user's password.
 */
export async function migratePlaintextPasswords(): Promise<void> {
  try {
    let migrated = 0;
    for (const table of [usersTable, portalUsersTable]) {
      const rows = await db
        .select({ id: table.id, passwordHash: table.passwordHash })
        .from(table);
      for (const row of rows) {
        if (!isBcryptHash(row.passwordHash)) {
          const hashed = await hashPassword(row.passwordHash);
          await db
            .update(table)
            .set({ passwordHash: hashed })
            .where(sql`${table.id} = ${row.id}`);
          migrated++;
        }
      }
    }
    if (migrated > 0) {
      logger.info({ migrated }, "Migrated plaintext passwords to bcrypt");
    }
  } catch (err) {
    logger.warn({ err }, "Password migration encountered an error — continuing startup");
  }
}
