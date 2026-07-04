import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authAuditLogTable = pgTable("auth_audit_log", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  userId: integer("user_id"),
  email: text("email"),
  performedBy: integer("performed_by"),
  detail: text("detail"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuthAuditLogSchema = createInsertSchema(authAuditLogTable).omit({ id: true, createdAt: true });
export type InsertAuthAuditLog = z.infer<typeof insertAuthAuditLogSchema>;
export type AuthAuditLog = typeof authAuditLogTable.$inferSelect;
