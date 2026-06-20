import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const websiteConfigTable = pgTable("website_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebsiteConfigRow = typeof websiteConfigTable.$inferSelect;
