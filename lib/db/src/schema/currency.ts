import { pgTable, serial, text, numeric, timestamp, date } from "drizzle-orm/pg-core";

export const currencySettingsTable = pgTable("currency_settings", {
  id: serial("id").primaryKey(),
  homeCurrency: text("home_currency").notNull().default("PKR"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const currencyDailyRatesTable = pgTable("currency_daily_rates", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull(),
  date: date("date").notNull(),
  clientRate: numeric("client_rate", { precision: 12, scale: 4 }).notNull(),
  vendorRate: numeric("vendor_rate", { precision: 12, scale: 4 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const currencyTransactionsTable = pgTable("currency_transactions", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  vendorRate: numeric("vendor_rate", { precision: 12, scale: 4 }).notNull(),
  clientRate: numeric("client_rate", { precision: 12, scale: 4 }).notNull(),
  vendorCost: numeric("vendor_cost", { precision: 14, scale: 2 }).notNull(),
  clientRevenue: numeric("client_revenue", { precision: 14, scale: 2 }).notNull(),
  profit: numeric("profit", { precision: 14, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CurrencySetting = typeof currencySettingsTable.$inferSelect;
export type CurrencyDailyRate = typeof currencyDailyRatesTable.$inferSelect;
export type CurrencyTransaction = typeof currencyTransactionsTable.$inferSelect;
