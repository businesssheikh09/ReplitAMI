import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const packageInquiriesTable = pgTable("package_inquiries", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  departureDate: date("departure_date").notNull(),
  returnDate: date("return_date"),
  makkahHotelId: integer("makkah_hotel_id"),
  madinahHotelId: integer("madinah_hotel_id"),
  transportType: text("transport_type"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  infants: integer("infants").notNull().default(0),
  totalPax: integer("total_pax").notNull().default(1),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  quotationId: integer("quotation_id"),
  portalUserId: integer("portal_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPackageInquirySchema = createInsertSchema(packageInquiriesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertPackageInquiry = z.infer<typeof insertPackageInquirySchema>;
export type PackageInquiry = typeof packageInquiriesTable.$inferSelect;
