import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publicBookingInquiriesTable = pgTable("public_booking_inquiries", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  ticketId: integer("ticket_id").notNull(),
  portalUserId: integer("portal_user_id"),
  userType: text("user_type").notNull().default("guest"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const publicBookingPassengersTable = pgTable("public_booking_passengers", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id").notNull(),
  title: text("title").notNull().default("MR"),
  passengerType: text("passenger_type").notNull().default("adult"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date("dob"),
  nationality: text("nationality"),
  docNumber: text("doc_number"),
  docExpiry: date("doc_expiry"),
  remarks: text("remarks"),
  documentObjectKey: text("document_object_key"),
  scanRawText: text("scan_raw_text"),
  scanFirstName: text("scan_first_name"),
  scanLastName: text("scan_last_name"),
  scanDob: text("scan_dob"),
  scanDocNumber: text("scan_doc_number"),
  scanExpiry: text("scan_expiry"),
  scanNationality: text("scan_nationality"),
  scanStatus: text("scan_status").notNull().default("none"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingInquirySchema = createInsertSchema(publicBookingInquiriesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertBookingInquiry = z.infer<typeof insertBookingInquirySchema>;
export type BookingInquiry = typeof publicBookingInquiriesTable.$inferSelect;

export const insertBookingPassengerSchema = createInsertSchema(publicBookingPassengersTable).omit({
  id: true, createdAt: true,
});
export type InsertBookingPassenger = z.infer<typeof insertBookingPassengerSchema>;
export type BookingPassenger = typeof publicBookingPassengersTable.$inferSelect;
