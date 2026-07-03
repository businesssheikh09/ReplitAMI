import { pgTable, serial, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

export const ocrSettingsTable = pgTable("ocr_settings", {
  id: serial("id").primaryKey(),
  defaultProvider: text("default_provider").notNull().default("local"),
  ocrEnabled: boolean("ocr_enabled").notNull().default(true),
  minConfidence: numeric("min_confidence", { precision: 5, scale: 2 }).notNull().default("60"),
  autoReviewThreshold: numeric("auto_review_threshold", { precision: 5, scale: 2 }).notNull().default("80"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type OcrSettings = typeof ocrSettingsTable.$inferSelect;
