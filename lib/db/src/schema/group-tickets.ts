import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupTicketsTable = pgTable("group_tickets", {
  id: serial("id").primaryKey(),
  airlineCode: text("airline_code").notNull(),
  flightNumber: text("flight_number").notNull(),
  flightDate: date("flight_date").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  seats: integer("seats").notNull(),
  departureTime: text("departure_time"),
  arrivalTime: text("arrival_time"),
  fareAmount: numeric("fare_amount", { precision: 14, scale: 2 }),
  fareCurrency: text("fare_currency").notNull().default("PKR"),
  groupName: text("group_name"),
  rawMessage: text("raw_message"),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGroupTicketSchema = createInsertSchema(groupTicketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGroupTicket = z.infer<typeof insertGroupTicketSchema>;
export type GroupTicket = typeof groupTicketsTable.$inferSelect;
