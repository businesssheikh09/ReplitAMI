import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hotelInvoicesTable = pgTable("hotel_invoices", {
  id: serial("id").primaryKey(),
  dnNumber: text("dn_number").notNull().unique(),
  invoiceDate: date("invoice_date").notNull(),
  // Passenger Information
  partyId: integer("party_id"),
  vendorId: integer("vendor_id"),
  passengerName: text("passenger_name"),
  nationality: text("nationality"),
  noOfPax: integer("no_of_pax").notNull().default(1),
  detail: text("detail"),
  // Hotel Voucher
  voucherType: text("voucher_type"),
  optionDate: date("option_date"),
  hotelId: integer("hotel_id"),
  hotelName: text("hotel_name"),
  hotelView: text("hotel_view"),
  roomType: text("room_type"),
  bedType: text("bed_type"),
  checkIn: date("check_in"),
  checkOut: date("check_out"),
  noOfNights: integer("no_of_nights"),
  noOfRooms: integer("no_of_rooms").notNull().default(1),
  reference: text("reference"),
  cnfNumber: text("cnf_number"),
  roomNumber: text("room_number"),
  remarks: text("remarks"),
  contactNumber: text("contact_number"),
  // Calculation
  receivableSar: numeric("receivable_sar", { precision: 14, scale: 2 }),
  payableSar: numeric("payable_sar", { precision: 14, scale: 2 }),
  receivablePkr: numeric("receivable_pkr", { precision: 14, scale: 2 }),
  payablePkr: numeric("payable_pkr", { precision: 14, scale: 2 }),
  incomeHead: text("income_head").notNull().default("Hotel Income"),
  salesmanId: integer("salesman_id"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHotelInvoiceSchema = createInsertSchema(hotelInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHotelInvoice = z.infer<typeof insertHotelInvoiceSchema>;
export type HotelInvoice = typeof hotelInvoicesTable.$inferSelect;
