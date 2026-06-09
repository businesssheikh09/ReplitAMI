import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transportBookingsTable = pgTable("transport_bookings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  pickupLocation: text("pickup_location").notNull(),
  dropoffLocation: text("dropoff_location").notNull(),
  date: timestamp("date").notNull(),
  passengers: integer("passengers").notNull().default(1),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  status: text("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  vendorId: integer("vendor_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransportBookingSchema = createInsertSchema(transportBookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransportBooking = z.infer<typeof insertTransportBookingSchema>;
export type TransportBooking = typeof transportBookingsTable.$inferSelect;
