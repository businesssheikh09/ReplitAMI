import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flightRequestsTable = pgTable("flight_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  requestType: text("request_type").notNull().default("direct"),
  source: text("source").notNull().default("website"),

  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone").notNull(),
  clientWhatsapp: text("client_whatsapp"),

  tripType: text("trip_type").notNull().default("one_way"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),

  departureDate: text("departure_date").notNull(),
  returnDate: text("return_date"),

  passengerCount: integer("passenger_count").notNull().default(1),
  cabinClass: text("cabin_class").notNull().default("economy"),

  airline: text("airline"),
  fare: text("fare"),
  actualFare: numeric("actual_fare", { precision: 12, scale: 2 }),
  bookingFare: numeric("booking_fare", { precision: 12, scale: 2 }),
  flightDataJson: jsonb("flight_data_json"),

  holdExpiresAt: timestamp("hold_expires_at"),
  holdMinutes: integer("hold_minutes").notNull().default(120),
  paymentDeadlineAt: timestamp("payment_deadline_at"),
  paymentProofKey: text("payment_proof_key"),

  status: text("status").notNull().default("pending"),
  assignedTo: integer("assigned_to"),
  adminNotes: text("admin_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFlightRequestSchema = createInsertSchema(flightRequestsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertFlightRequest = z.infer<typeof insertFlightRequestSchema>;
export type FlightRequest = typeof flightRequestsTable.$inferSelect;
