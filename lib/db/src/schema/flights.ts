import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flightQuotationsTable = pgTable("flight_quotations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  tripType: text("trip_type").notNull().default("one_way"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureDate: timestamp("departure_date").notNull(),
  returnDate: timestamp("return_date"),
  legs: text("legs"),
  passengers: integer("passengers").notNull().default(1),
  cabinClass: text("cabin_class").notNull().default("economy"),
  airline: text("airline"),
  flightNumber: text("flight_number"),
  pnr: text("pnr"),
  status: text("status").notNull().default("draft"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  ticketNumber: text("ticket_number"),
  issuedBy: integer("issued_by"),
  issuedByName: text("issued_by_name"),
  issuedAt: timestamp("issued_at"),
  notes: text("notes"),
  staffNotes: text("staff_notes"),
  airlineCommission: numeric("airline_commission", { precision: 12, scale: 2 }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: integer("cancelled_by"),
  cancelReason: text("cancel_reason"),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFlightQuotationSchema = createInsertSchema(flightQuotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFlightQuotation = z.infer<typeof insertFlightQuotationSchema>;
export type FlightQuotation = typeof flightQuotationsTable.$inferSelect;
