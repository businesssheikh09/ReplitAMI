import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const gdsSettingsTable = pgTable("gds_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  username: text("username"),
  password: text("password"),
  pcc: text("pcc"),
  iataCode: text("iata_code"),
  environment: text("environment").notNull().default("test"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GdsSetting = typeof gdsSettingsTable.$inferSelect;
