import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portalUsersTable = pgTable("portal_users", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending_approval"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp"),
  companyName: text("company_name"),
  ownerName: text("owner_name"),
  address: text("address"),
  dtsNumber: text("dts_number"),
  passwordHash: text("password_hash").notNull(),
  portalSessionToken: text("portal_session_token"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const portalUserDocumentsTable = pgTable("portal_user_documents", {
  id: serial("id").primaryKey(),
  portalUserId: integer("portal_user_id").notNull(),
  documentType: text("document_type").notNull().default("other"),
  objectKey: text("object_key").notNull(),
  originalFilename: text("original_filename"),
  scanRawText: text("scan_raw_text"),
  scanStatus: text("scan_status").notNull().default("none"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const paymentReceiptsTable = pgTable("payment_receipts", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id").notNull(),
  portalUserId: integer("portal_user_id").notNull(),
  objectKey: text("object_key"),
  paymentStatus: text("payment_status").notNull().default("pending_receipt"),
  deadlineAt: timestamp("deadline_at").notNull(),
  deadlineTier: text("deadline_tier").notNull().default("24h"),
  hoursUntilFlight: text("hours_until_flight"),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  uploadedAt: timestamp("uploaded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPortalUserSchema = createInsertSchema(portalUsersTable).omit({
  id: true, createdAt: true, updatedAt: true, portalSessionToken: true,
});
export type InsertPortalUser = z.infer<typeof insertPortalUserSchema>;
export type PortalUser = typeof portalUsersTable.$inferSelect;
export type PaymentReceipt = typeof paymentReceiptsTable.$inferSelect;
export type PortalUserDocument = typeof portalUserDocumentsTable.$inferSelect;
