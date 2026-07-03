import { pgTable, serial, text, integer, numeric, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  type: text("type").notNull().default("customer"),
  clientId: integer("client_id"),
  vendorId: integer("vendor_id"),
  quotationId: integer("quotation_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("draft"),
  dueDate: timestamp("due_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  vendorId: integer("vendor_id"),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  clientId: integer("client_id"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Double-Entry Accounting ───────────────────────────────────────────────────

export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const generalJournalTable = pgTable("general_journal", {
  id: serial("id").primaryKey(),
  entryNumber: text("entry_number").notNull().unique(),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  debitAccountId: integer("debit_account_id").notNull(),
  creditAccountId: integer("credit_account_id").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  sourceType: text("source_type"),
  sourceId: integer("source_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Crash-safe atomic sequence counters ──────────────────────────────────────
// Uses INSERT … ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq
// so numbers survive restarts and are free of race conditions.

export const journalCountersTable = pgTable("journal_counters", {
  type: text("type").primaryKey(), // e.g. "JE-2026", "RV-2026"
  lastSeq: integer("last_seq").notNull().default(0),
});

// ── Voucher system ────────────────────────────────────────────────────────────
// RV=Receipt, PV=Payment, JV=Journal, CV=Contra/Cash

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  voucherNumber: text("voucher_number").notNull().unique(),
  type: text("type").notNull(),          // RV | PV | JV | CV
  date: date("date").notNull(),
  narration: text("narration").notNull(),
  status: text("status").notNull().default("draft"), // draft | approved | posted | cancelled

  // Optional source record links
  partyId: integer("party_id"),
  vendorId: integer("vendor_id"),
  hotelInvoiceId: integer("hotel_invoice_id"),
  flightRequestId: integer("flight_request_id"),
  transportId: integer("transport_id"),
  visaId: integer("visa_id"),

  // Reversal tracking
  reversalOf: integer("reversal_of"),

  // Full audit trail
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  postedBy: integer("posted_by"),
  postedAt: timestamp("posted_at"),
  cancelledBy: integer("cancelled_by"),
  cancelledAt: timestamp("cancelled_at"),
});

export const voucherLinesTable = pgTable("voucher_lines", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull(),
  accountId: integer("account_id").notNull(),
  description: text("description"),
  debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  creditAmount: numeric("credit_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("PKR"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Financial Year ────────────────────────────────────────────────────────────

export const financialYearsTable = pgTable("financial_years", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),         // "FY 2024-25"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("open"), // open | closed
  closedBy: integer("closed_by"),
  closedAt: timestamp("closed_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const openingBalancesTable = pgTable("opening_balances", {
  id: serial("id").primaryKey(),
  financialYearId: integer("financial_year_id").notNull(),
  accountId: integer("account_id").notNull(),
  debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  creditAmount: numeric("credit_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Zod Schemas & Types ───────────────────────────────────────────────────────

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;

export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;
export type GeneralJournalEntry = typeof generalJournalTable.$inferSelect;
export type Voucher = typeof vouchersTable.$inferSelect;
export type VoucherLine = typeof voucherLinesTable.$inferSelect;
export type FinancialYear = typeof financialYearsTable.$inferSelect;
export type OpeningBalance = typeof openingBalancesTable.$inferSelect;
