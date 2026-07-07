import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  generalJournalTable,
  journalCountersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── Account codes (seeded once) ───────────────────────────────────────────────

export const ACCOUNTS = {
  VENDOR: "VENDOR",
  PARTY:  "PARTY",
  UMRA:   "UMRA",
  AIR:    "AIR",
  HOTEL:  "HOTEL",
  MSFR:   "MSFR",
  FOREX:  "FOREX",
  PROFIT: "PROFIT",
} as const;

type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

// ── Seed the 8 named accounts if they don't exist ────────────────────────────

const SEED_ACCOUNTS: { code: AccountCode; name: string; type: string; description: string }[] = [
  { code: "VENDOR", name: "Vendor Accounts",                       type: "liability", description: "Amounts payable to vendors/suppliers" },
  { code: "PARTY",  name: "Party Accounts",                        type: "asset",     description: "Amounts receivable from parties/clients" },
  { code: "UMRA",   name: "Umra Account",                          type: "revenue",   description: "Umrah package revenue" },
  { code: "AIR",    name: "Air Booking Account",                    type: "revenue",   description: "Flight / air ticket revenue" },
  { code: "HOTEL",  name: "Hotel Booking Account",                  type: "revenue",   description: "Hotel accommodation revenue" },
  { code: "MSFR",   name: "MSFR Account",                          type: "asset",     description: "Main company cash / bank account" },
  { code: "FOREX",  name: "Currency Conversion Difference Account", type: "revenue",   description: "FX spread / currency conversion gain or loss" },
  { code: "PROFIT", name: "Profit Account",                         type: "equity",    description: "Retained earnings / net profit" },
];

let seeded = false;
export async function ensureAccounts(): Promise<Map<AccountCode, number>> {
  const rows = await db
    .select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable);
  const map = new Map<AccountCode, number>(rows.map((r) => [r.code as AccountCode, r.id]));

  if (!seeded || map.size < SEED_ACCOUNTS.length) {
    for (const acct of SEED_ACCOUNTS) {
      if (!map.has(acct.code)) {
        const [inserted] = await db
          .insert(chartOfAccountsTable)
          .values(acct)
          .onConflictDoNothing()
          .returning({ id: chartOfAccountsTable.id });
        if (inserted) {
          map.set(acct.code, inserted.id);
        } else {
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

// ── Crash-safe DB sequence (survives restarts, no duplicates) ─────────────────

export async function nextEntryNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const key  = `${prefix}-${year}`;
  const width = prefix === "JE" ? 5 : 4;

  const [row] = await db
    .insert(journalCountersTable)
    .values({ type: key, lastSeq: 1 })
    .onConflictDoUpdate({
      target: journalCountersTable.type,
      set: { lastSeq: sql`journal_counters.last_seq + 1` },
    })
    .returning({ lastSeq: journalCountersTable.lastSeq });

  return `${prefix}-${year}-${String(row.lastSeq).padStart(width, "0")}`;
}

// ── Sub-ledger helpers (C-{id} for clients, V-{id} for vendors) ──────────────
// Creates the account on-the-fly if it hasn't been seeded yet.

async function resolveSubLedger(
  code: string,
  name: string,
  type: "party_ledger" | "vendor_ledger",
  description: string,
): Promise<number | null> {
  try {
    const [existing] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, code));
    if (existing) return existing.id;

    const [inserted] = await db
      .insert(chartOfAccountsTable)
      .values({ code, name, type, description, isActive: true })
      .onConflictDoUpdate({ target: chartOfAccountsTable.code, set: { name: sql`EXCLUDED.name` } })
      .returning({ id: chartOfAccountsTable.id });
    return inserted?.id ?? null;
  } catch {
    return null;
  }
}

export async function getClientSubLedger(clientId: number, clientName?: string): Promise<number | null> {
  return resolveSubLedger(
    `C-${clientId}`,
    clientName ?? `Client #${clientId}`,
    "party_ledger",
    "Client sub-ledger",
  );
}

export async function getVendorSubLedger(vendorId: number, vendorName?: string): Promise<number | null> {
  return resolveSubLedger(
    `V-${vendorId}`,
    vendorName ?? `Vendor #${vendorId}`,
    "vendor_ledger",
    "Vendor sub-ledger",
  );
}

// ── Low-level raw entry (account IDs, no code lookup) ─────────────────────────

async function postRawEntry(opts: {
  debitAccountId:  number;
  creditAccountId: number;
  amount:          number;
  description:     string;
  currency?:       string;
  sourceType?:     string;
  sourceId?:       number;
}): Promise<void> {
  if (opts.amount <= 0) return;
  const entryNumber = await nextEntryNumber("JE");
  await db.insert(generalJournalTable).values({
    entryNumber,
    date:            new Date(),
    description:     opts.description,
    debitAccountId:  opts.debitAccountId,
    creditAccountId: opts.creditAccountId,
    amount:          String(opts.amount),
    currency:        opts.currency  ?? "SAR",
    sourceType:      opts.sourceType ?? null,
    sourceId:        opts.sourceId   ?? null,
  });
}

// ── Core posting helper (code-based, used by legacy callers) ──────────────────

interface JournalLine {
  debitCode:   AccountCode;
  creditCode:  AccountCode;
  amount:      number;
  description: string;
  currency?:   string;
  sourceType?: string;
  sourceId?:   number;
}

export async function postJournalEntries(lines: JournalLine[]): Promise<void> {
  try {
    const acctMap = await ensureAccounts();
    for (const line of lines) {
      if (line.amount <= 0) continue;
      const debitAccountId  = acctMap.get(line.debitCode);
      const creditAccountId = acctMap.get(line.creditCode);
      if (!debitAccountId || !creditAccountId) {
        logger.warn({ line }, "Journal poster: account not found, skipping entry");
        continue;
      }
      await postRawEntry({
        debitAccountId,
        creditAccountId,
        amount:      line.amount,
        description: line.description,
        currency:    line.currency  ?? "SAR",
        sourceType:  line.sourceType ?? null,
        sourceId:    line.sourceId   ?? null,
      });
    }
  } catch (err) {
    logger.error({ err }, "Journal poster: failed to post entries (non-fatal)");
  }
}

// ── Domain-specific posting functions ─────────────────────────────────────────

/**
 * Called when a customer invoice is CREATED (revenue recognition).
 * DR C-{clientId} (sub-ledger) or PARTY / CR revenue account (UMRA | AIR | HOTEL)
 */
export async function postInvoiceCreated(opts: {
  invoiceId:    number;
  amount:       number;
  currency?:    string;
  invoiceType?: string;
  clientId?:    number;
  clientName?:  string;
}): Promise<void> {
  try {
    const revenueCode: AccountCode =
      opts.invoiceType === "air"  ? "AIR"  :
      opts.invoiceType === "umra" ? "UMRA" : "HOTEL";

    const acctMap = await ensureAccounts();
    const creditAccountId = acctMap.get(revenueCode);
    if (!creditAccountId) return;

    const debitAccountId =
      opts.clientId
        ? ((await getClientSubLedger(opts.clientId, opts.clientName)) ?? acctMap.get("PARTY"))
        : acctMap.get("PARTY");
    if (!debitAccountId) return;

    await postRawEntry({
      debitAccountId,
      creditAccountId,
      amount:      opts.amount,
      description: `Invoice #${opts.invoiceId} — ${revenueCode} revenue recognised`,
      currency:    opts.currency ?? "SAR",
      sourceType:  "invoice_created",
      sourceId:    opts.invoiceId,
    });
  } catch (err) {
    logger.error({ err }, "Journal poster: postInvoiceCreated failed (non-fatal)");
  }
}

/**
 * Called when a customer invoice PAYMENT is received.
 * DR MSFR (cash/bank) / CR C-{clientId} (sub-ledger) or PARTY
 */
export async function postInvoicePayment(opts: {
  invoiceId:    number;
  amount:       number;
  currency?:    string;
  invoiceType?: string;
  clientId?:    number;
  clientName?:  string;
}): Promise<void> {
  try {
    const acctMap = await ensureAccounts();
    const debitAccountId = acctMap.get("MSFR");
    if (!debitAccountId) return;

    const creditAccountId =
      opts.clientId
        ? ((await getClientSubLedger(opts.clientId, opts.clientName)) ?? acctMap.get("PARTY"))
        : acctMap.get("PARTY");
    if (!creditAccountId) return;

    await postRawEntry({
      debitAccountId,
      creditAccountId,
      amount:      opts.amount,
      description: `Payment received for invoice #${opts.invoiceId}`,
      currency:    opts.currency ?? "SAR",
      sourceType:  "invoice_payment",
      sourceId:    opts.invoiceId,
    });
  } catch (err) {
    logger.error({ err }, "Journal poster: postInvoicePayment failed (non-fatal)");
  }
}

/**
 * Called when a hotel DN invoice is created.
 * DR C-{partyId} (or PARTY) / CR HOTEL  — receivable from client
 * DR HOTEL / CR V-{vendorId} (or VENDOR) — payable to vendor
 */
export async function postHotelInvoice(opts: {
  invoiceId:      number;
  receivableSar?: number | null;
  payableSar?:    number | null;
  dnNumber?:      string;
  partyId?:       number;
  partyName?:     string;
  vendorId?:      number;
  vendorName?:    string;
}): Promise<void> {
  try {
    const acctMap = await ensureAccounts();
    const hotelAccountId = acctMap.get("HOTEL");
    if (!hotelAccountId) return;

    const desc = opts.dnNumber ?? `DN#${opts.invoiceId}`;

    if (opts.receivableSar && opts.receivableSar > 0) {
      const debitAccountId =
        opts.partyId
          ? ((await getClientSubLedger(opts.partyId, opts.partyName)) ?? acctMap.get("PARTY"))
          : acctMap.get("PARTY");
      if (debitAccountId) {
        await postRawEntry({
          debitAccountId,
          creditAccountId: hotelAccountId,
          amount:      opts.receivableSar,
          description: `Hotel receivable – ${desc}`,
          currency:    "SAR",
          sourceType:  "hotel_invoice",
          sourceId:    opts.invoiceId,
        });
      }
    }

    if (opts.payableSar && opts.payableSar > 0) {
      const creditAccountId =
        opts.vendorId
          ? ((await getVendorSubLedger(opts.vendorId, opts.vendorName)) ?? acctMap.get("VENDOR"))
          : acctMap.get("VENDOR");
      if (creditAccountId) {
        await postRawEntry({
          debitAccountId:  hotelAccountId,
          creditAccountId,
          amount:      opts.payableSar,
          description: `Hotel payable – ${desc}`,
          currency:    "SAR",
          sourceType:  "hotel_invoice",
          sourceId:    opts.invoiceId,
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Journal poster: postHotelInvoice failed (non-fatal)");
  }
}

/**
 * Called when a currency transaction is created.
 */
export async function postCurrencyTransaction(opts: {
  txId:          number;
  vendorCost:    number;
  clientRevenue: number;
  profit:        number;
  currency?:     string;
}): Promise<void> {
  const lines: JournalLine[] = [];

  if (opts.vendorCost > 0) {
    lines.push({
      debitCode:   "MSFR",
      creditCode:  "VENDOR",
      amount:      opts.vendorCost,
      description: `Currency purchase – tx#${opts.txId}`,
      currency:    opts.currency ?? "PKR",
      sourceType:  "currency_tx",
      sourceId:    opts.txId,
    });
  }

  if (opts.profit > 0) {
    lines.push({
      debitCode:   "PARTY",
      creditCode:  "FOREX",
      amount:      opts.profit,
      description: `FX spread gain – tx#${opts.txId}`,
      currency:    opts.currency ?? "PKR",
      sourceType:  "currency_tx",
      sourceId:    opts.txId,
    });
  } else if (opts.profit < 0) {
    lines.push({
      debitCode:   "FOREX",
      creditCode:  "MSFR",
      amount:      Math.abs(opts.profit),
      description: `FX spread loss – tx#${opts.txId}`,
      currency:    opts.currency ?? "PKR",
      sourceType:  "currency_tx",
      sourceId:    opts.txId,
    });
  }

  await postJournalEntries(lines);
}

/**
 * Called when a flight request is issued.
 * DR C-{clientId} (or PARTY) / CR AIR (flight revenue)
 */
export async function postFlightIssued(opts: {
  requestId:     number;
  requestNumber: string;
  bookingFare:   number;
  actualFare:    number;
  clientId?:     number;
  clientName?:   string;
}): Promise<void> {
  try {
    const markup = opts.bookingFare - opts.actualFare;
    const acctMap = await ensureAccounts();
    const creditAccountId = acctMap.get("AIR");
    if (!creditAccountId) return;

    const debitAccountId =
      opts.clientId
        ? ((await getClientSubLedger(opts.clientId, opts.clientName)) ?? acctMap.get("PARTY"))
        : acctMap.get("PARTY");
    if (!debitAccountId) return;

    await postRawEntry({
      debitAccountId,
      creditAccountId,
      amount:      opts.bookingFare,
      description: `Flight issued: ${opts.requestNumber} — PKR ${opts.bookingFare.toLocaleString()} (cost PKR ${opts.actualFare.toLocaleString()}, markup PKR ${markup.toLocaleString()})`,
      currency:    "PKR",
      sourceType:  "flight_issued",
      sourceId:    opts.requestId,
    });
  } catch (err) {
    logger.error({ err }, "Journal poster: postFlightIssued failed (non-fatal)");
  }
}

/**
 * Called when a flight ticket is cancelled.
 * DR AIR (reversal of revenue) / CR PARTY (cancel receivable)
 */
export async function postFlightCancelled(opts: {
  ticketId:     number;
  ticketNumber: string;
  amount:       number;
  currency?:    string;
}): Promise<void> {
  await postJournalEntries([
    {
      debitCode:   "AIR",
      creditCode:  "PARTY",
      amount:      opts.amount,
      description: `Flight cancelled: ${opts.ticketNumber} — revenue reversed PKR ${opts.amount.toLocaleString()}`,
      currency:    opts.currency ?? "PKR",
      sourceType:  "flight_cancelled",
      sourceId:    opts.ticketId,
    },
  ]);
}

/**
 * Called when a flight refund is processed.
 * DR PARTY (refund liability cleared) / CR MSFR (cash paid out)
 */
export async function postFlightRefund(opts: {
  ticketId:     number;
  ticketNumber: string;
  refundAmount: number;
  currency?:    string;
}): Promise<void> {
  await postJournalEntries([
    {
      debitCode:   "PARTY",
      creditCode:  "MSFR",
      amount:      opts.refundAmount,
      description: `Flight refund: ${opts.ticketNumber} — PKR ${opts.refundAmount.toLocaleString()} paid to client`,
      currency:    opts.currency ?? "PKR",
      sourceType:  "flight_refund",
      sourceId:    opts.ticketId,
    },
  ]);
}
