import { db } from "@workspace/db";
import { chartOfAccountsTable, generalJournalTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── Account codes (seeded once) ───────────────────────────────────────────────

export const ACCOUNTS = {
  VENDOR: "VENDOR",
  PARTY: "PARTY",
  UMRA: "UMRA",
  AIR: "AIR",
  HOTEL: "HOTEL",
  MSFR: "MSFR",
  FOREX: "FOREX",
  PROFIT: "PROFIT",
} as const;

type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

// ── Seed the 8 named accounts if they don't exist ────────────────────────────

const SEED_ACCOUNTS: {
  code: AccountCode;
  name: string;
  type: string;
  description: string;
}[] = [
  { code: "VENDOR", name: "Vendor Accounts",                     type: "liability", description: "Amounts payable to vendors/suppliers" },
  { code: "PARTY",  name: "Party Accounts",                      type: "asset",     description: "Amounts receivable from parties/clients" },
  { code: "UMRA",   name: "Umra Account",                        type: "revenue",   description: "Umrah package revenue" },
  { code: "AIR",    name: "Air Booking Account",                  type: "revenue",   description: "Flight / air ticket revenue" },
  { code: "HOTEL",  name: "Hotel Booking Account",                type: "revenue",   description: "Hotel accommodation revenue" },
  { code: "MSFR",   name: "MSFR Account",                        type: "asset",     description: "Main company cash / bank account" },
  { code: "FOREX",  name: "Currency Conversion Difference Account", type: "revenue", description: "FX spread / currency conversion gain or loss" },
  { code: "PROFIT", name: "Profit Account",                       type: "equity",   description: "Retained earnings / net profit" },
];

let seeded = false;
export async function ensureAccounts(): Promise<Map<AccountCode, number>> {
  const rows = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code }).from(chartOfAccountsTable);
  const map = new Map<AccountCode, number>(rows.map((r) => [r.code as AccountCode, r.id]));

  if (!seeded || map.size < SEED_ACCOUNTS.length) {
    for (const acct of SEED_ACCOUNTS) {
      if (!map.has(acct.code)) {
        const [inserted] = await db
          .insert(chartOfAccountsTable)
          .values(acct)
          .onConflictDoNothing()
          .returning({ id: chartOfAccountsTable.id });
        if (inserted) map.set(acct.code, inserted.id);
        else {
          const [existing] = await db
            .select({ id: chartOfAccountsTable.id })
            .from(chartOfAccountsTable)
            .where(eq(chartOfAccountsTable.code, acct.code));
          if (existing) map.set(acct.code, existing.id);
        }
      }
    }
    seeded = true;
  }
  return map;
}

// ── Entry number generator ────────────────────────────────────────────────────

let entrySeq = 0;
function nextEntryNumber(): string {
  entrySeq++;
  const yr = new Date().getFullYear();
  return `JE-${yr}-${String(entrySeq).padStart(5, "0")}`;
}

// ── Core posting helper ───────────────────────────────────────────────────────

interface JournalLine {
  debitCode: AccountCode;
  creditCode: AccountCode;
  amount: number;
  description: string;
  currency?: string;
  sourceType?: string;
  sourceId?: number;
}

export async function postJournalEntries(lines: JournalLine[]): Promise<void> {
  try {
    const acctMap = await ensureAccounts();
    for (const line of lines) {
      if (line.amount <= 0) continue;
      const debitAccountId = acctMap.get(line.debitCode);
      const creditAccountId = acctMap.get(line.creditCode);
      if (!debitAccountId || !creditAccountId) {
        logger.warn({ line }, "Journal poster: account not found, skipping entry");
        continue;
      }
      await db.insert(generalJournalTable).values({
        entryNumber: nextEntryNumber(),
        date: new Date(),
        description: line.description,
        debitAccountId,
        creditAccountId,
        amount: String(line.amount),
        currency: line.currency ?? "SAR",
        sourceType: line.sourceType ?? null,
        sourceId: line.sourceId ?? null,
      });
    }
  } catch (err) {
    logger.error({ err }, "Journal poster: failed to post entries (non-fatal)");
  }
}

// ── Domain-specific posting functions ─────────────────────────────────────────

/** Called when a customer invoice payment is recorded */
export async function postInvoicePayment(opts: {
  invoiceId: number;
  amount: number;
  currency?: string;
  invoiceType?: string;
}): Promise<void> {
  const revenueAccount: AccountCode =
    opts.invoiceType === "air" ? "AIR" : opts.invoiceType === "umra" ? "UMRA" : "HOTEL";

  await postJournalEntries([
    {
      debitCode: "MSFR",
      creditCode: "PARTY",
      amount: opts.amount,
      description: `Payment received for invoice #${opts.invoiceId}`,
      currency: opts.currency ?? "SAR",
      sourceType: "invoice_payment",
      sourceId: opts.invoiceId,
    },
  ]);
}

/** Called when a hotel DN invoice is created */
export async function postHotelInvoice(opts: {
  invoiceId: number;
  receivableSar?: number | null;
  payableSar?: number | null;
  dnNumber?: string;
}): Promise<void> {
  const lines: JournalLine[] = [];

  if (opts.receivableSar && opts.receivableSar > 0) {
    lines.push({
      debitCode: "PARTY",
      creditCode: "HOTEL",
      amount: opts.receivableSar,
      description: `Hotel receivable – ${opts.dnNumber ?? `DN#${opts.invoiceId}`}`,
      currency: "SAR",
      sourceType: "hotel_invoice",
      sourceId: opts.invoiceId,
    });
  }

  if (opts.payableSar && opts.payableSar > 0) {
    lines.push({
      debitCode: "HOTEL",
      creditCode: "VENDOR",
      amount: opts.payableSar,
      description: `Hotel payable – ${opts.dnNumber ?? `DN#${opts.invoiceId}`}`,
      currency: "SAR",
      sourceType: "hotel_invoice",
      sourceId: opts.invoiceId,
    });
  }

  await postJournalEntries(lines);
}

/** Called when a currency transaction is created */
export async function postCurrencyTransaction(opts: {
  txId: number;
  vendorCost: number;
  clientRevenue: number;
  profit: number;
  currency?: string;
}): Promise<void> {
  const lines: JournalLine[] = [];

  if (opts.vendorCost > 0) {
    lines.push({
      debitCode: "MSFR",
      creditCode: "VENDOR",
      amount: opts.vendorCost,
      description: `Currency purchase – tx#${opts.txId}`,
      currency: opts.currency ?? "PKR",
      sourceType: "currency_tx",
      sourceId: opts.txId,
    });
  }

  if (opts.profit > 0) {
    lines.push({
      debitCode: "PARTY",
      creditCode: "FOREX",
      amount: opts.profit,
      description: `FX spread gain – tx#${opts.txId}`,
      currency: opts.currency ?? "PKR",
      sourceType: "currency_tx",
      sourceId: opts.txId,
    });
  } else if (opts.profit < 0) {
    lines.push({
      debitCode: "FOREX",
      creditCode: "MSFR",
      amount: Math.abs(opts.profit),
      description: `FX spread loss – tx#${opts.txId}`,
      currency: opts.currency ?? "PKR",
      sourceType: "currency_tx",
      sourceId: opts.txId,
    });
  }

  await postJournalEntries(lines);
}
