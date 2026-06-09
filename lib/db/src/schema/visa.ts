import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visaApplicationsTable = pgTable("visa_applications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  passportNumber: text("passport_number").notNull(),
  nationality: text("nationality").notNull(),
  passportExpiry: timestamp("passport_expiry"),
  status: text("status").notNull().default("documents_required"),
  assignedTo: integer("assigned_to"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVisaApplicationSchema = createInsertSchema(visaApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisaApplication = z.infer<typeof insertVisaApplicationSchema>;
export type VisaApplication = typeof visaApplicationsTable.$inferSelect;
