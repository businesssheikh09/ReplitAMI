import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const localAirlineSettingsTable = pgTable("local_airline_settings", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("coming_soon"),
  environment: text("environment").notNull().default("test"),
  credentials: text("credentials"),
  notes: text("notes"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  testedAt: timestamp("tested_at"),
  testResult: text("test_result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LocalAirlineSetting = typeof localAirlineSettingsTable.$inferSelect;
