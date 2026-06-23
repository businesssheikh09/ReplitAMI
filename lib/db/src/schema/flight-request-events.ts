import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const flightRequestEventsTable = pgTable("flight_request_events", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FlightRequestEvent = typeof flightRequestEventsTable.$inferSelect;
