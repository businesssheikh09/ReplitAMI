import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp"),
  country: text("country").notNull(),
  city: text("city"),
  leadStatus: text("lead_status").notNull().default("new"),
  assignedTo: integer("assigned_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientNotesTable = pgTable("client_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  content: text("content").notNull(),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followUpsTable = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  dueDate: timestamp("due_date").notNull(),
  type: text("type").notNull().default("call"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  assignedTo: integer("assigned_to").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

export const insertClientNoteSchema = createInsertSchema(clientNotesTable).omit({ id: true, createdAt: true });
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;

export const insertFollowUpSchema = createInsertSchema(followUpsTable).omit({ id: true, createdAt: true });
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
