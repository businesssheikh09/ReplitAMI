import { Router } from "express";
import { db } from "@workspace/db";
import {
  generalJournalTable,
  chartOfAccountsTable,
  vouchersTable,
  voucherLinesTable,
  clientsTable,
  vendorsTable,
  hotelInvoicesTable,
  hotelsTable,
  transportBookingsTable,
  currencyTransactionsTable,
} from "@workspace/db";
import { eq, desc, gte, lte, and, sql, or, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// ── Shared helpers ─────────────────────────────────────────────────────────────

function dateFilter(field: any, from?: string, to?: string) {
  const filters = [];
  if (from) filters.push(gte(field, new Date(from)));
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    filters.push(lte(field, t));
  }
  return filters;
}

// ── Party Statement ───────────────────────────────────────────────────────────
// Shows all journal entries that touched the PARTY account for a specific client

router.get("/accounting/reports/party-statement", requireAuth, async (req, res) => {
  try {
    const { partyId, from, to } = req.query as Record<string, string>;

    // Get PARTY account id
    const [partyAcct] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, "PARTY"));

    if (!partyAcct) return res.json({ entries: [], totalDebit: 0, totalCredit: 0, balance: 0 });

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, partyAcct.id),
          eq(generalJournalTable.creditAccountId, partyAcct.id),
        )!,
      )
      .orderBy(asc(generalJournalTable.date));

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }
    if (partyId) entries = entries.filter((e) => e.sourceId === parseInt(partyId));

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    let runningBalance = 0;
    const enriched = entries.map((e) => {
      const amt = parseFloat(e.amount);
      const isDebit = e.debitAccountId === partyAcct.id;
      if (isDebit) runningBalance += amt; else runningBalance -= amt;
      return {
        ...e,
        amount: amt,
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        debitAccount: acctMap.get(e.debitAccountId) ?? null,
        creditAccount: acctMap.get(e.creditAccountId) ?? null,
        side: isDebit ? "DR" : "CR",
        runningBalance,
      };
    });

    const totalDebit = enriched.filter((e) => e.side === "DR").reduce((s, e) => s + e.amount, 0);
    const totalCredit = enriched.filter((e) => e.side === "CR").reduce((s, e) => s + e.amount, 0);

    return res.json({ entries: enriched, totalDebit, totalCredit, balance: runningBalance });
  } catch (err) {
    req.log.error({ err }, "Party statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Vendor Statement ──────────────────────────────────────────────────────────

router.get("/accounting/reports/vendor-statement", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    const [vendorAcct] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, "VENDOR"));

    if (!vendorAcct) return res.json({ entries: [], totalDebit: 0, totalCredit: 0, balance: 0 });

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, vendorAcct.id),
          eq(generalJournalTable.creditAccountId, vendorAcct.id),
        )!,
      )
      .orderBy(asc(generalJournalTable.date));

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    let runningBalance = 0;
    const enriched = entries.map((e) => {
      const amt = parseFloat(e.amount);
      const isCredit = e.creditAccountId === vendorAcct.id;
      if (isCredit) runningBalance += amt; else runningBalance -= amt;
      return {
        ...e,
        amount: amt,
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        debitAccount: acctMap.get(e.debitAccountId) ?? null,
        creditAccount: acctMap.get(e.creditAccountId) ?? null,
        side: isCredit ? "CR" : "DR",
        runningBalance,
      };
    });

    const totalDebit = enriched.filter((e) => e.side === "DR").reduce((s, e) => s + e.amount, 0);
    const totalCredit = enriched.filter((e) => e.side === "CR").reduce((s, e) => s + e.amount, 0);
    return res.json({ entries: enriched, totalDebit, totalCredit, balance: runningBalance });
  } catch (err) {
    req.log.error({ err }, "Vendor statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Party Summary ─────────────────────────────────────────────────────────────

router.get("/accounting/reports/party-summary", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    const [partyAcct] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, "PARTY"));

    if (!partyAcct) return res.json({ rows: [], totalDr: 0, totalCr: 0 });

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, partyAcct.id),
          eq(generalJournalTable.creditAccountId, partyAcct.id),
        )!,
      );

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }

    // Group by sourceType
    const grouped: Record<string, { dr: number; cr: number; count: number }> = {};
    for (const e of entries) {
      const key = e.sourceType ?? "other";
      if (!grouped[key]) grouped[key] = { dr: 0, cr: 0, count: 0 };
      const amt = parseFloat(e.amount);
      if (e.debitAccountId === partyAcct.id) grouped[key].dr += amt;
      else grouped[key].cr += amt;
      grouped[key].count++;
    }

    const rows = Object.entries(grouped).map(([sourceType, v]) => ({
      sourceType, ...v, net: v.dr - v.cr,
    }));
    const totalDr = rows.reduce((s, r) => s + r.dr, 0);
    const totalCr = rows.reduce((s, r) => s + r.cr, 0);
    return res.json({ rows, totalDr, totalCr, net: totalDr - totalCr });
  } catch (err) {
    req.log.error({ err }, "Party summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Vendor Summary ────────────────────────────────────────────────────────────

router.get("/accounting/reports/vendor-summary", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    const [vendorAcct] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, "VENDOR"));

    if (!vendorAcct) return res.json({ rows: [], totalDr: 0, totalCr: 0 });

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, vendorAcct.id),
          eq(generalJournalTable.creditAccountId, vendorAcct.id),
        )!,
      );

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }

    const grouped: Record<string, { dr: number; cr: number; count: number }> = {};
    for (const e of entries) {
      const key = e.sourceType ?? "other";
      if (!grouped[key]) grouped[key] = { dr: 0, cr: 0, count: 0 };
      const amt = parseFloat(e.amount);
      if (e.debitAccountId === vendorAcct.id) grouped[key].dr += amt;
      else grouped[key].cr += amt;
      grouped[key].count++;
    }

    const rows = Object.entries(grouped).map(([sourceType, v]) => ({
      sourceType, ...v, net: v.cr - v.dr,
    }));
    const totalDr = rows.reduce((s, r) => s + r.dr, 0);
    const totalCr = rows.reduce((s, r) => s + r.cr, 0);
    return res.json({ rows, totalDr, totalCr, net: totalCr - totalDr });
  } catch (err) {
    req.log.error({ err }, "Vendor summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Cash Book ─────────────────────────────────────────────────────────────────
// All entries touching the MSFR (cash/bank) account

router.get("/accounting/reports/cash-book", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    const [msfrAcct] = await db
      .select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.code, "MSFR"));

    if (!msfrAcct) return res.json({ entries: [], totalReceipts: 0, totalPayments: 0, closingBalance: 0 });

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, msfrAcct.id),
          eq(generalJournalTable.creditAccountId, msfrAcct.id),
        )!,
      )
      .orderBy(asc(generalJournalTable.date));

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    let runningBalance = 0;
    const enriched = entries.map((e) => {
      const amt = parseFloat(e.amount);
      const isReceipt = e.debitAccountId === msfrAcct.id;
      if (isReceipt) runningBalance += amt; else runningBalance -= amt;
      return {
        ...e,
        amount: amt,
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        debitAccount: acctMap.get(e.debitAccountId) ?? null,
        creditAccount: acctMap.get(e.creditAccountId) ?? null,
        type: isReceipt ? "receipt" : "payment",
        runningBalance,
      };
    });

    const totalReceipts = enriched.filter((e) => e.type === "receipt").reduce((s, e) => s + e.amount, 0);
    const totalPayments = enriched.filter((e) => e.type === "payment").reduce((s, e) => s + e.amount, 0);
    return res.json({ entries: enriched, totalReceipts, totalPayments, closingBalance: runningBalance });
  } catch (err) {
    req.log.error({ err }, "Cash book error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Receipt Book ──────────────────────────────────────────────────────────────
// All Receipt Vouchers (RV) or all invoice_payment journal entries

router.get("/accounting/reports/receipt-book", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    // Combine: posted RV vouchers + auto-posted invoice_payment journal entries
    let vouchers = await db
      .select()
      .from(vouchersTable)
      .where(and(eq(vouchersTable.type, "RV"), eq(vouchersTable.status, "posted"))!)
      .orderBy(asc(vouchersTable.date));

    if (from) vouchers = vouchers.filter((v) => v.date >= from);
    if (to) vouchers = vouchers.filter((v) => v.date <= to);

    // Also fetch auto-posted invoice_payment entries
    let journalEntries = await db
      .select()
      .from(generalJournalTable)
      .where(eq(generalJournalTable.sourceType, "invoice_payment"))
      .orderBy(asc(generalJournalTable.date));

    if (from) journalEntries = journalEntries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); journalEntries = journalEntries.filter((e) => e.date <= t); }

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    const voucherRows = vouchers.map((v) => ({
      source: "voucher" as const,
      ref: v.voucherNumber,
      date: v.date,
      narration: v.narration,
      partyName: v.partyId ? clientMap.get(v.partyId) ?? null : null,
      vendorName: v.vendorId ? vendorMap.get(v.vendorId) ?? null : null,
      amount: null as number | null,
    }));

    const journalRows = journalEntries.map((e) => ({
      source: "journal" as const,
      ref: e.entryNumber,
      date: e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10),
      narration: e.description,
      partyName: null as string | null,
      vendorName: null as string | null,
      amount: parseFloat(e.amount),
    }));

    return res.json({ rows: [...voucherRows, ...journalRows].sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (err) {
    req.log.error({ err }, "Receipt book error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payment Book ──────────────────────────────────────────────────────────────

router.get("/accounting/reports/payment-book", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    let vouchers = await db
      .select()
      .from(vouchersTable)
      .where(and(eq(vouchersTable.type, "PV"), eq(vouchersTable.status, "posted"))!)
      .orderBy(asc(vouchersTable.date));

    if (from) vouchers = vouchers.filter((v) => v.date >= from);
    if (to) vouchers = vouchers.filter((v) => v.date <= to);

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json({
      rows: vouchers.map((v) => ({
        ref: v.voucherNumber,
        date: v.date,
        narration: v.narration,
        partyName: v.partyId ? clientMap.get(v.partyId) ?? null : null,
        vendorName: v.vendorId ? vendorMap.get(v.vendorId) ?? null : null,
        status: v.status,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Payment book error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Journal Book ──────────────────────────────────────────────────────────────
// All JV vouchers + manual general journal entries

router.get("/accounting/reports/journal-book", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    let entries = await db
      .select()
      .from(generalJournalTable)
      .orderBy(asc(generalJournalTable.date));

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23,59,59,999); entries = entries.filter((e) => e.date <= t); }

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    return res.json({
      entries: entries.map((e) => ({
        ...e,
        amount: parseFloat(e.amount),
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        debitAccount: acctMap.get(e.debitAccountId) ?? null,
        creditAccount: acctMap.get(e.creditAccountId) ?? null,
      })),
      totalAmount: entries.reduce((s, e) => s + parseFloat(e.amount), 0),
    });
  } catch (err) {
    req.log.error({ err }, "Journal book error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Voucher Search ────────────────────────────────────────────────────────────

router.get("/accounting/reports/voucher-search", requireAuth, async (req, res) => {
  try {
    const { type, status, from, to, search, partyId, vendorId } = req.query as Record<string, string>;

    let vouchers = await db
      .select()
      .from(vouchersTable)
      .orderBy(desc(vouchersTable.createdAt));

    if (type) vouchers = vouchers.filter((v) => v.type === type);
    if (status) vouchers = vouchers.filter((v) => v.status === status);
    if (from) vouchers = vouchers.filter((v) => v.date >= from);
    if (to) vouchers = vouchers.filter((v) => v.date <= to);
    if (partyId) vouchers = vouchers.filter((v) => v.partyId === parseInt(partyId));
    if (vendorId) vouchers = vouchers.filter((v) => v.vendorId === parseInt(vendorId));
    if (search) {
      const q = search.toLowerCase();
      vouchers = vouchers.filter(
        (v) =>
          v.voucherNumber.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q),
      );
    }

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json(
      vouchers.map((v) => ({
        ...v,
        partyName: v.partyId ? clientMap.get(v.partyId) ?? null : null,
        vendorName: v.vendorId ? vendorMap.get(v.vendorId) ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Voucher search error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DN Report ─────────────────────────────────────────────────────────────────

router.get("/accounting/reports/dn-report", requireAuth, async (req, res) => {
  try {
    const { from, to, partyId, status } = req.query as Record<string, string>;

    let invoices = await db
      .select()
      .from(hotelInvoicesTable)
      .orderBy(desc(hotelInvoicesTable.invoiceDate));

    if (from) invoices = invoices.filter((i) => i.invoiceDate >= from);
    if (to) invoices = invoices.filter((i) => i.invoiceDate <= to);
    if (partyId) invoices = invoices.filter((i) => i.partyId === parseInt(partyId));
    if (status) invoices = invoices.filter((i) => i.status === status);

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    const rows = invoices.map((i) => ({
      ...i,
      receivableSar: i.receivableSar ? parseFloat(i.receivableSar) : null,
      payableSar: i.payableSar ? parseFloat(i.payableSar) : null,
      receivablePkr: i.receivablePkr ? parseFloat(i.receivablePkr) : null,
      payablePkr: i.payablePkr ? parseFloat(i.payablePkr) : null,
      partyName: i.partyId ? clientMap.get(i.partyId) ?? null : null,
      vendorName: i.vendorId ? vendorMap.get(i.vendorId) ?? null : null,
    }));

    const totalRecvSar = rows.reduce((s, r) => s + (r.receivableSar ?? 0), 0);
    const totalPaySar = rows.reduce((s, r) => s + (r.payableSar ?? 0), 0);

    return res.json({ rows, totalRecvSar, totalPaySar, profitSar: totalRecvSar - totalPaySar });
  } catch (err) {
    req.log.error({ err }, "DN report error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Hotel Check-In / Check-Out Report ────────────────────────────────────────

router.get("/accounting/reports/hotel-checkin", requireAuth, async (req, res) => {
  try {
    const { from, to, type } = req.query as Record<string, string>;
    // type: "checkin" (default) | "checkout"

    let invoices = await db
      .select()
      .from(hotelInvoicesTable)
      .orderBy(asc(hotelInvoicesTable.checkIn));

    const dateField = type === "checkout" ? "checkOut" : "checkIn";
    if (from) invoices = invoices.filter((i) => (i as any)[dateField] >= from);
    if (to) invoices = invoices.filter((i) => (i as any)[dateField] <= to);

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json(
      invoices.map((i) => ({
        ...i,
        receivableSar: i.receivableSar ? parseFloat(i.receivableSar) : null,
        payableSar: i.payableSar ? parseFloat(i.payableSar) : null,
        partyName: i.partyId ? clientMap.get(i.partyId) ?? null : null,
        vendorName: i.vendorId ? vendorMap.get(i.vendorId) ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Hotel checkin report error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Booking Validation Report ─────────────────────────────────────────────────

router.get("/accounting/reports/booking-validation", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    let invoices = await db
      .select()
      .from(hotelInvoicesTable)
      .orderBy(desc(hotelInvoicesTable.createdAt));

    if (from) invoices = invoices.filter((i) => i.invoiceDate >= from);
    if (to) invoices = invoices.filter((i) => i.invoiceDate <= to);

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    // Flag issues: missing hotel, no CNF, zero receivable
    const rows = invoices.map((i) => {
      const issues: string[] = [];
      if (!i.hotelId && !i.hotelName) issues.push("No hotel assigned");
      if (!i.cnfNumber) issues.push("No CNF number");
      if (!i.receivableSar || parseFloat(i.receivableSar) === 0) issues.push("Zero receivable");
      if (!i.checkIn || !i.checkOut) issues.push("Missing check-in/out dates");
      return {
        ...i,
        receivableSar: i.receivableSar ? parseFloat(i.receivableSar) : null,
        payableSar: i.payableSar ? parseFloat(i.payableSar) : null,
        partyName: i.partyId ? clientMap.get(i.partyId) ?? null : null,
        vendorName: i.vendorId ? vendorMap.get(i.vendorId) ?? null : null,
        issues,
        hasIssues: issues.length > 0,
      };
    });

    return res.json({
      rows,
      totalWithIssues: rows.filter((r) => r.hasIssues).length,
      totalClean: rows.filter((r) => !r.hasIssues).length,
    });
  } catch (err) {
    req.log.error({ err }, "Booking validation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Search Hotel Invoice ──────────────────────────────────────────────────────

router.get("/accounting/reports/search-hotel-invoice", requireAuth, async (req, res) => {
  try {
    const { search, partyId, vendorId, from, to, status } = req.query as Record<string, string>;

    let invoices = await db
      .select()
      .from(hotelInvoicesTable)
      .orderBy(desc(hotelInvoicesTable.invoiceDate));

    if (status) invoices = invoices.filter((i) => i.status === status);
    if (partyId) invoices = invoices.filter((i) => i.partyId === parseInt(partyId));
    if (vendorId) invoices = invoices.filter((i) => i.vendorId === parseInt(vendorId));
    if (from) invoices = invoices.filter((i) => i.invoiceDate >= from);
    if (to) invoices = invoices.filter((i) => i.invoiceDate <= to);
    if (search) {
      const q = search.toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.dnNumber.toLowerCase().includes(q) ||
          (i.passengerName?.toLowerCase() ?? "").includes(q) ||
          (i.hotelName?.toLowerCase() ?? "").includes(q) ||
          (i.cnfNumber?.toLowerCase() ?? "").includes(q),
      );
    }

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json(
      invoices.map((i) => ({
        ...i,
        receivableSar: i.receivableSar ? parseFloat(i.receivableSar) : null,
        payableSar: i.payableSar ? parseFloat(i.payableSar) : null,
        receivablePkr: i.receivablePkr ? parseFloat(i.receivablePkr) : null,
        payablePkr: i.payablePkr ? parseFloat(i.payablePkr) : null,
        partyName: i.partyId ? clientMap.get(i.partyId) ?? null : null,
        vendorName: i.vendorId ? vendorMap.get(i.vendorId) ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Search hotel invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Search Transport Invoice ──────────────────────────────────────────────────

router.get("/accounting/reports/search-transport-invoice", requireAuth, async (req, res) => {
  try {
    const { search, clientId, vendorId, status } = req.query as Record<string, string>;

    let bookings = await db
      .select()
      .from(transportBookingsTable)
      .orderBy(desc(transportBookingsTable.createdAt));

    if (status) bookings = bookings.filter((b) => b.status === status);
    if (clientId) bookings = bookings.filter((b) => b.clientId === parseInt(clientId));
    if (vendorId) bookings = bookings.filter((b) => b.vendorId === parseInt(vendorId));
    if (search) {
      const q = search.toLowerCase();
      bookings = bookings.filter(
        (b) =>
          b.type.toLowerCase().includes(q) ||
          b.pickupLocation.toLowerCase().includes(q) ||
          b.dropoffLocation.toLowerCase().includes(q) ||
          (b.driverName?.toLowerCase() ?? "").includes(q),
      );
    }

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json(
      bookings.map((b) => ({
        ...b,
        fare: b.amount ? parseFloat(b.amount) : null,
        clientName: clientMap.get(b.clientId) ?? null,
        vendorName: b.vendorId ? vendorMap.get(b.vendorId) ?? null : null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Search transport invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Search Ref Invoice ────────────────────────────────────────────────────────
// Searches across hotel invoices, transport, and general invoices by reference

router.get("/accounting/reports/search-ref-invoice", requireAuth, async (req, res) => {
  try {
    const { ref } = req.query as Record<string, string>;
    if (!ref || ref.length < 2) {
      return res.status(400).json({ error: "ref query param required (min 2 chars)" });
    }
    const q = ref.toLowerCase();

    const [hotelInvs, transports] = await Promise.all([
      db.select().from(hotelInvoicesTable),
      db.select().from(transportBookingsTable),
    ]);

    const hotelResults = hotelInvs
      .filter(
        (i) =>
          i.dnNumber.toLowerCase().includes(q) ||
          (i.cnfNumber?.toLowerCase() ?? "").includes(q) ||
          (i.reference?.toLowerCase() ?? "").includes(q) ||
          (i.roomNumber?.toLowerCase() ?? "").includes(q),
      )
      .map((i) => ({
        type: "hotel_invoice",
        id: i.id,
        ref: i.dnNumber,
        secondary: i.cnfNumber ?? i.reference ?? null,
        date: i.invoiceDate,
        description: `${i.hotelName ?? "Hotel"} — ${i.passengerName ?? ""}`,
        status: i.status,
      }));

    const transportResults = transports
      .filter(
        (b) =>
          b.pickupLocation.toLowerCase().includes(q) ||
          b.dropoffLocation.toLowerCase().includes(q) ||
          (b.driverName?.toLowerCase() ?? "").includes(q),
      )
      .map((b) => ({
        type: "transport",
        id: b.id,
        ref: `TR-${b.id}`,
        secondary: null,
        date: b.createdAt.toISOString().slice(0, 10),
        description: `${b.type} — ${b.pickupLocation} → ${b.dropoffLocation}`,
        status: b.status,
      }));

    return res.json([...hotelResults, ...transportResults]);
  } catch (err) {
    req.log.error({ err }, "Search ref invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Room Occupancy Report ─────────────────────────────────────────────────────

router.get("/accounting/reports/room-occupancy", requireAuth, async (req, res) => {
  try {
    const { from, to, hotelId } = req.query as Record<string, string>;

    let invoices = await db
      .select()
      .from(hotelInvoicesTable)
      .orderBy(asc(hotelInvoicesTable.checkIn));

    if (from) invoices = invoices.filter((i) => !!i.checkIn && i.checkIn >= from);
    if (to) invoices = invoices.filter((i) => !!i.checkIn && i.checkIn <= to);
    if (hotelId) invoices = invoices.filter((i) => i.hotelId === parseInt(hotelId));

    // Group by hotelName + roomType to show occupancy stats
    const groups = new Map<string, {
      hotelName: string; hotelId: number | null; roomType: string;
      bookings: number; totalRoomNights: number; totalRooms: number; totalPax: number;
    }>();

    for (const inv of invoices) {
      if (!inv.checkIn || !inv.checkOut) continue;
      const hotelName = inv.hotelName ?? "Unknown Hotel";
      const roomType = inv.roomType ?? "Standard";
      const key = `${hotelName}__${roomType}`;
      const nights = inv.noOfNights ??
        Math.max(1, Math.ceil((new Date(inv.checkOut).getTime() - new Date(inv.checkIn).getTime()) / 86_400_000));
      const rooms = inv.noOfRooms ?? 1;

      const existing = groups.get(key) ?? {
        hotelName, hotelId: inv.hotelId ?? null, roomType,
        bookings: 0, totalRoomNights: 0, totalRooms: 0, totalPax: 0,
      };
      existing.bookings++;
      existing.totalRoomNights += nights * rooms;
      existing.totalRooms += rooms;
      existing.totalPax += inv.noOfPax ?? 1;
      groups.set(key, existing);
    }

    const rows = Array.from(groups.values()).sort((a, b) => a.hotelName.localeCompare(b.hotelName));
    return res.json({
      rows,
      totalBookings: invoices.filter((i) => i.checkIn && i.checkOut).length,
      totalRoomNights: rows.reduce((s, r) => s + r.totalRoomNights, 0),
    });
  } catch (err) {
    req.log.error({ err }, "Room occupancy error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Fortnight Ledger ──────────────────────────────────────────────────────────

router.get("/accounting/reports/fortnight-ledger", requireAuth, async (req, res) => {
  try {
    const { accountId, from, to } = req.query as Record<string, string>;
    if (!accountId) return res.status(400).json({ error: "accountId is required" });

    const acctId = parseInt(accountId);
    const accounts = await db.select().from(chartOfAccountsTable);
    const account = accounts.find((a) => a.id === acctId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    let entries = await db
      .select()
      .from(generalJournalTable)
      .where(
        or(
          eq(generalJournalTable.debitAccountId, acctId),
          eq(generalJournalTable.creditAccountId, acctId),
        )!,
      )
      .orderBy(asc(generalJournalTable.date));

    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); entries = entries.filter((e) => e.date <= t); }

    // Group into fortnight periods (1-15 and 16-end of month)
    const periodsMap = new Map<string, {
      label: string; from: string; to: string;
      dr: number; cr: number; count: number;
    }>();

    for (const e of entries) {
      const d = e.date instanceof Date ? e.date : new Date(e.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const half = day <= 15 ? 1 : 2;
      const key = `${year}-${String(month + 1).padStart(2, "0")}-H${half}`;

      if (!periodsMap.has(key)) {
        const pFrom = new Date(year, month, half === 1 ? 1 : 16);
        const pTo = half === 1 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
        periodsMap.set(key, {
          label: `${pFrom.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} – ${pTo.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}`,
          from: pFrom.toISOString().slice(0, 10),
          to: pTo.toISOString().slice(0, 10),
          dr: 0, cr: 0, count: 0,
        });
      }

      const p = periodsMap.get(key)!;
      const amt = parseFloat(e.amount);
      if (e.debitAccountId === acctId) p.dr += amt;
      else p.cr += amt;
      p.count++;
    }

    let running = 0;
    const rows = Array.from(periodsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, p]) => {
        const opening = running;
        running = running + p.dr - p.cr;
        return { ...p, opening, closing: running };
      });

    return res.json({
      rows,
      account: { ...account, debitAccount: acctMap.get(account.id) },
      totalDr: rows.reduce((s, r) => s + r.dr, 0),
      totalCr: rows.reduce((s, r) => s + r.cr, 0),
      closing: running,
    });
  } catch (err) {
    req.log.error({ err }, "Fortnight ledger error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Foreign Currency Ledger ───────────────────────────────────────────────────

router.get("/accounting/reports/fx-ledger", requireAuth, async (req, res) => {
  try {
    const { currency, from, to } = req.query as Record<string, string>;

    let txns = await db
      .select()
      .from(currencyTransactionsTable)
      .orderBy(asc(currencyTransactionsTable.date));

    if (currency) txns = txns.filter((t) => t.currency === currency);
    if (from) txns = txns.filter((t) => t.date >= new Date(from));
    if (to) { const t2 = new Date(to); t2.setHours(23, 59, 59, 999); txns = txns.filter((t) => t.date <= t2); }

    let runningFc = 0;
    let runningPkr = 0;
    const rows = txns.map((t) => {
      const fcAmt = parseFloat(t.amount);
      const pkrCost = parseFloat(t.vendorCost);
      const pkrRevenue = parseFloat(t.clientRevenue);
      runningFc += fcAmt;
      runningPkr += pkrRevenue;
      return {
        id: t.id,
        currency: t.currency,
        amount: fcAmt,
        vendorRate: parseFloat(t.vendorRate),
        clientRate: parseFloat(t.clientRate),
        vendorCost: pkrCost,
        clientRevenue: pkrRevenue,
        profit: parseFloat(t.profit),
        notes: t.notes ?? null,
        date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
        runningFc,
        runningPkr,
      };
    });

    const allCurrencies = [...new Set(
      (await db.select({ currency: currencyTransactionsTable.currency }).from(currencyTransactionsTable)).map((r) => r.currency),
    )];

    return res.json({
      rows,
      currencies: allCurrencies,
      totalFc: runningFc,
      totalPkr: runningPkr,
      totalProfit: rows.reduce((s, r) => s + r.profit, 0),
    });
  } catch (err) {
    req.log.error({ err }, "FX ledger error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
