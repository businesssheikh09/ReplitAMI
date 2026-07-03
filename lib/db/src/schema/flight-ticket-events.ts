import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const flightTicketEventsTable = pgTable("flight_ticket_events", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  eventType: text("event_type").notNull(),
  statusBefore: text("status_before"),
  statusAfter: text("status_after"),
  notes: text("notes"),
  userId: integer("user_id"),
  userName: text("user_name"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FlightTicketEvent = typeof flightTicketEventsTable.$inferSelect;
