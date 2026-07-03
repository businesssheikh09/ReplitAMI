import { Router } from "express";
import { db } from "@workspace/db";
import {
  financialYearsTable,
  openingBalancesTable,
  chartOfAccountsTable,
  generalJournalTable,
} from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { nextEntryNumber } from "../services/journal-poster.js";

const router = Router();

// ── List financial years ──────────────────────────────────────────────────────

router.get("/accounting/financial-years", requireAuth, async (req, res) => {
  try {
    const years = await db
      .select()
      .from(financialYearsTable)
      .orderBy(financialYearsTable.startDate);
    return res.json(years);
  } catch (err) {
    req.log.error({ err }, "List financial years error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create financial year ─────────────────────────────────────────────────────

router.post("/accounting/financial-years", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Only management or admin can create financial years" });
    }

    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "name, startDate, endDate are required" });
    }

    // Ensure no open year overlaps
    const existingOpen = await db
      .select()
      .from(financialYearsTable)
      .where(eq(financialYearsTable.status, "open"));

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);
    const overlapping = existingOpen.filter((y) => {
      const ys = new Date(y.startDate);
      const ye = new Date(y.endDate);
      return newStart <= ye && newEnd >= ys;
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ error: "A financial year already exists for this period" });
    }

    const [year] = await db
      .insert(financialYearsTable)
      .values({ name, startDate, endDate, status: "open", createdBy: user.id })
      .returning();

    return res.status(201).json(year);
  } catch (err) {
    req.log.error({ err }, "Create financial year error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get financial year ────────────────────────────────────────────────────────

router.get("/accounting/financial-years/:id", requireAuth, async (req, res) => {
  try {
    const [year] = await db
      .select()
      .from(financialYearsTable)
      .where(eq(financialYearsTable.id, parseInt(String(req.params.id))));
    if (!year) return res.status(404).json({ error: "Financial year not found" });
    return res.json(year);
  } catch (err) {
    req.log.error({ err }, "Get financial year error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get opening balances for a year ──────────────────────────────────────────

router.get("/accounting/financial-years/:id/opening-balances", requireAuth, async (req, res) => {
  try {
    const yearId = parseInt(String(req.params.id));
    const [year] = await db
      .select()
      .from(financialYearsTable)
      .where(eq(financialYearsTable.id, yearId));
    if (!year) return res.status(404).json({ error: "Financial year not found" });

    const balances = await db
      .select()
      .from(openingBalancesTable)
      .where(eq(openingBalancesTable.financialYearId, yearId));

    const accounts = await db.select().from(chartOfAccountsTable);

    // Return all accounts with their opening balances (0 if not set)
    const balanceMap = new Map(balances.map((b) => [b.accountId, b]));

    return res.json(
      accounts.map((a) => {
        const bal = balanceMap.get(a.id);
        return {
          accountId: a.id,
          account: a,
          debitAmount: bal ? parseFloat(bal.debitAmount) : 0,
          creditAmount: bal ? parseFloat(bal.creditAmount) : 0,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Get opening balances error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Save opening balances for a year ─────────────────────────────────────────

router.put("/accounting/financial-years/:id/opening-balances", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin", "accounts"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const yearId = parseInt(String(req.params.id));
    const [year] = await db
      .select()
      .from(financialYearsTable)
      .where(eq(financialYearsTable.id, yearId));
    if (!year) return res.status(404).json({ error: "Financial year not found" });
    if (year.status === "closed") {
      return res.status(400).json({ error: "Cannot modify opening balances for a closed year" });
    }

    const { balances } = req.body; // Array of { accountId, debitAmount, creditAmount }
    if (!Array.isArray(balances)) {
      return res.status(400).json({ error: "balances array required" });
    }

    // Upsert each balance
    for (const b of balances) {
      const existing = await db
        .select()
        .from(openingBalancesTable)
        .where(
          and(
            eq(openingBalancesTable.financialYearId, yearId),
            eq(openingBalancesTable.accountId, parseInt(String(b.accountId))),
          )!,
        );

      if (existing.length > 0) {
        await db
          .update(openingBalancesTable)
          .set({
            debitAmount: String(parseFloat(b.debitAmount) || 0),
            creditAmount: String(parseFloat(b.creditAmount) || 0),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(openingBalancesTable.financialYearId, yearId),
              eq(openingBalancesTable.accountId, parseInt(String(b.accountId))),
            )!,
          );
      } else {
        await db.insert(openingBalancesTable).values({
          financialYearId: yearId,
          accountId: parseInt(String(b.accountId)),
          debitAmount: String(parseFloat(b.debitAmount) || 0),
          creditAmount: String(parseFloat(b.creditAmount) || 0),
        });
      }
    }

    return res.json({ success: true, saved: balances.length });
  } catch (err) {
    req.log.error({ err }, "Save opening balances error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Close a financial year ────────────────────────────────────────────────────

router.post("/accounting/financial-years/:id/close", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Only management or admin can close a financial year" });
    }

    const yearId = parseInt(String(req.params.id));
    const [year] = await db
      .select()
      .from(financialYearsTable)
      .where(eq(financialYearsTable.id, yearId));
    if (!year) return res.status(404).json({ error: "Financial year not found" });
    if (year.status === "closed") {
      return res.status(400).json({ error: "Financial year is already closed" });
    }

    // Compute P&L for the year — revenue minus expense totals
    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    const startDate = new Date(year.startDate);
    const endDate = new Date(year.endDate);
    endDate.setHours(23, 59, 59, 999);

    const journalEntries = await db
      .select()
      .from(generalJournalTable)
      .where(and(gte(generalJournalTable.date, startDate), lte(generalJournalTable.date, endDate))!);

    // Calculate net by account
    const accountBalances: Record<number, number> = {};
    for (const e of journalEntries) {
      const amt = parseFloat(e.amount);
      accountBalances[e.debitAccountId] = (accountBalances[e.debitAccountId] ?? 0) + amt;
      accountBalances[e.creditAccountId] = (accountBalances[e.creditAccountId] ?? 0) - amt;
    }

    // Revenue accounts have CR-normal balance; expense accounts have DR-normal balance
    let totalRevenue = 0;
    let totalExpense = 0;
    for (const [acctId, netDebit] of Object.entries(accountBalances)) {
      const acct = acctMap.get(parseInt(acctId));
      if (!acct) continue;
      if (acct.type === "revenue") totalRevenue += -netDebit; // revenue reduces debit side
      if (acct.type === "expense") totalExpense += netDebit;
    }

    const netProfit = totalRevenue - totalExpense;

    // Post closing journal entry if there's a profit/loss
    if (Math.abs(netProfit) > 0.01) {
      const profitAcct = accounts.find((a) => a.code === "PROFIT");
      const revenueAcct = accounts.find((a) => a.code === "UMRA") ?? accounts.find((a) => a.type === "revenue");

      if (profitAcct && revenueAcct) {
        const entryNumber = await nextEntryNumber("JE");
        await db.insert(generalJournalTable).values({
          entryNumber,
          date: endDate,
          description: `Year-end close — ${year.name} — Net ${netProfit >= 0 ? "Profit" : "Loss"} ${Math.abs(netProfit).toFixed(2)}`,
          debitAccountId: netProfit >= 0 ? revenueAcct.id : profitAcct.id,
          creditAccountId: netProfit >= 0 ? profitAcct.id : revenueAcct.id,
          amount: String(Math.abs(netProfit)),
          currency: "SAR",
          sourceType: "year_close",
          sourceId: yearId,
        });
      }
    }

    // Mark year closed
    const [updated] = await db
      .update(financialYearsTable)
      .set({ status: "closed", closedBy: user.id, closedAt: new Date() })
      .where(eq(financialYearsTable.id, yearId))
      .returning();

    return res.json({
      ...updated,
      summary: { totalRevenue, totalExpense, netProfit },
    });
  } catch (err) {
    req.log.error({ err }, "Close financial year error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── P&L Statement ─────────────────────────────────────────────────────────────

router.get("/accounting/pnl", requireAuth, async (req, res) => {
  try {
    const { yearId, from, to } = req.query as Record<string, string>;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (yearId) {
      const [year] = await db
        .select()
        .from(financialYearsTable)
        .where(eq(financialYearsTable.id, parseInt(yearId)));
      if (!year) return res.status(404).json({ error: "Financial year not found" });
      startDate = new Date(year.startDate);
      endDate = new Date(year.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      if (from) startDate = new Date(from);
      if (to) { endDate = new Date(to); endDate.setHours(23, 59, 59, 999); }
    }

    const accounts = await db.select().from(chartOfAccountsTable);

    const filters: any[] = [];
    if (startDate) filters.push(gte(generalJournalTable.date, startDate));
    if (endDate) filters.push(lte(generalJournalTable.date, endDate));

    const entries = filters.length > 0
      ? await db.select().from(generalJournalTable).where(and(...filters)!)
      : await db.select().from(generalJournalTable);

    // Compute net per account (DR - CR)
    const acctBalances: Record<number, number> = {};
    for (const e of entries) {
      const amt = parseFloat(e.amount);
      acctBalances[e.debitAccountId] = (acctBalances[e.debitAccountId] ?? 0) + amt;
      acctBalances[e.creditAccountId] = (acctBalances[e.creditAccountId] ?? 0) - amt;
    }

    const revenue: { account: any; amount: number }[] = [];
    const expenses: { account: any; amount: number }[] = [];

    for (const acct of accounts) {
      const netDebit = acctBalances[acct.id] ?? 0;
      if (acct.type === "revenue") {
        revenue.push({ account: acct, amount: -netDebit }); // revenue is CR normal
      } else if (acct.type === "expense") {
        expenses.push({ account: acct, amount: netDebit });
      }
    }

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

    return res.json({
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      period: { from: startDate?.toISOString() ?? null, to: endDate?.toISOString() ?? null },
    });
  } catch (err) {
    req.log.error({ err }, "P&L statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Balance Sheet ─────────────────────────────────────────────────────────────

router.get("/accounting/balance-sheet", requireAuth, async (req, res) => {
  try {
    const { yearId, asOf } = req.query as Record<string, string>;

    let endDate: Date | undefined;
    let startDate: Date | undefined;
    let yearData: any = null;

    if (yearId) {
      const [year] = await db
        .select()
        .from(financialYearsTable)
        .where(eq(financialYearsTable.id, parseInt(yearId)));
      if (!year) return res.status(404).json({ error: "Financial year not found" });
      startDate = new Date(year.startDate);
      endDate = new Date(year.endDate);
      endDate.setHours(23, 59, 59, 999);
      yearData = year;
    } else if (asOf) {
      endDate = new Date(asOf);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
    }

    const accounts = await db.select().from(chartOfAccountsTable);

    const entries = endDate
      ? await db.select().from(generalJournalTable).where(lte(generalJournalTable.date, endDate))
      : await db.select().from(generalJournalTable);

    // Opening balances for the year
    let openingMap: Record<number, { dr: number; cr: number }> = {};
    if (yearId) {
      const obEntries = await db
        .select()
        .from(openingBalancesTable)
        .where(eq(openingBalancesTable.financialYearId, parseInt(yearId)));
      for (const ob of obEntries) {
        openingMap[ob.accountId] = {
          dr: parseFloat(ob.debitAmount),
          cr: parseFloat(ob.creditAmount),
        };
      }
    }

    const acctBalances: Record<number, number> = {};
    for (const e of entries) {
      const amt = parseFloat(e.amount);
      acctBalances[e.debitAccountId] = (acctBalances[e.debitAccountId] ?? 0) + amt;
      acctBalances[e.creditAccountId] = (acctBalances[e.creditAccountId] ?? 0) - amt;
    }

    const assets: { account: any; balance: number; opening: number }[] = [];
    const liabilities: { account: any; balance: number; opening: number }[] = [];
    const equity: { account: any; balance: number; opening: number }[] = [];

    for (const acct of accounts) {
      const netDebit = acctBalances[acct.id] ?? 0;
      const ob = openingMap[acct.id];
      const opening = ob ? ob.dr - ob.cr : 0;

      if (acct.type === "asset") {
        assets.push({ account: acct, balance: netDebit + opening, opening });
      } else if (acct.type === "liability") {
        liabilities.push({ account: acct, balance: -netDebit + opening, opening });
      } else if (acct.type === "equity") {
        equity.push({ account: acct, balance: -netDebit + opening, opening });
      }
    }

    const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
    const totalEquity = equity.reduce((s, r) => s + r.balance, 0);
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return res.json({
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
      asOf: endDate?.toISOString() ?? null,
      year: yearData,
    });
  } catch (err) {
    req.log.error({ err }, "Balance sheet error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
