import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, quotationsTable, invoicesTable, visaApplicationsTable,
  followUpsTable, transportBookingsTable, expensesTable, usersTable, activityLogsTable,
  hotelInvoicesTable, flightQuotationsTable, whatsappMessagesTable,
  portalUsersTable, flightRequestsTable, vouchersTable, publicBookingInquiriesTable,
  generalJournalTable, chartOfAccountsTable, paymentsTable, hotelRequestsTable,
} from "@workspace/db";
import { eq, and, gte, lte, or, sql, lt, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const [
      clients, quotations, invoices, visas, followUps, transport,
      revAccounts, allJournal,
    ] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(quotationsTable),
      db.select().from(invoicesTable),
      db.select().from(visaApplicationsTable),
      db.select().from(followUpsTable),
      db.select().from(transportBookingsTable),
      db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
        .from(chartOfAccountsTable)
        .where(eq(chartOfAccountsTable.type, "revenue")),
      db.select({ creditAccountId: generalJournalTable.creditAccountId, amount: generalJournalTable.amount })
        .from(generalJournalTable),
    ]);

    const totalRevenue = invoices
      .filter(i => i.status === "paid" || i.status === "partial")
      .reduce((sum, i) => sum + parseFloat(i.paidAmount), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = invoices
      .filter(i => i.createdAt >= monthStart && (i.status === "paid" || i.status === "partial"))
      .reduce((sum, i) => sum + parseFloat(i.paidAmount), 0);

    const pendingVisas = visas.filter(v =>
      ["documents_required", "documents_received", "submitted"].includes(v.status)
    ).length;

    const pendingFollowUps = followUps.filter(f => f.status === "pending").length;

    const activeTransport = transport.filter(t =>
      ["pending", "confirmed", "in_progress"].includes(t.status)
    ).length;

    const wonDeals = quotations.filter(q => q.status === "accepted").length;
    const conversionRate = quotations.length > 0 ? (wonDeals / quotations.length) * 100 : 0;

    // Revenue by service — computed from general journal credits to revenue accounts
    const revAcctMap = new Map(revAccounts.map(a => [a.id, a.code]));
    const revenueByService: Record<string, number> = { hotel: 0, flight: 0, transport: 0, visa: 0, custom: 0 };
    for (const entry of allJournal) {
      const code = revAcctMap.get(entry.creditAccountId ?? -1);
      if (!code) continue;
      const amt = parseFloat(entry.amount ?? "0");
      if (code === "HOTEL") revenueByService.hotel += amt;
      else if (code === "AIR") revenueByService.flight += amt;
      else if (code === "TRANS") revenueByService.transport += amt;
      else if (code === "VISA") revenueByService.visa += amt;
      else revenueByService.custom += amt;
    }

    return res.json({
      totalClients: clients.length,
      totalQuotations: quotations.length,
      totalInvoices: invoices.length,
      totalRevenue,
      pendingVisas,
      pendingFollowUps,
      activeTransport,
      monthlyRevenue,
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenueByService,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "20");
    const activities = await db.select().from(activityLogsTable);
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u.name]));
    const sorted = activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return res.json(sorted.map(a => ({
      ...a,
      userName: userMap.get(a.userId) || "System",
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/revenue-chart", requireAuth, async (req, res) => {
  try {
    const months = parseInt((req.query.months as string) || "6");
    const invoices = await db.select().from(invoicesTable);
    const expenses = await db.select().from(expensesTable);

    const data: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLabel = d.toLocaleString("default", { month: "short", year: "numeric" });

      const revenue = invoices
        .filter(inv => inv.createdAt >= d && inv.createdAt <= monthEnd && (inv.status === "paid" || inv.status === "partial"))
        .reduce((sum, inv) => sum + parseFloat(inv.paidAmount), 0);

      const expense = expenses
        .filter(exp => exp.date >= d && exp.date <= monthEnd)
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      data.push({ month: monthLabel, revenue, expenses: expense, profit: revenue - expense });
    }

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Revenue chart error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/staff-performance", requireAuth, async (req, res) => {
  try {
    const [users, quotations] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(quotationsTable),
    ]);

    const performance = users
      .filter(u => u.isActive && u.role === "sales")
      .map(u => {
        const userQuotations = quotations.filter(q => q.createdBy === u.id);
        const won = userQuotations.filter(q => q.status === "accepted");
        const revenue = won.reduce((sum, q) => sum + parseFloat(q.totalAmount), 0);
        const conversionRate = userQuotations.length > 0 ? (won.length / userQuotations.length) * 100 : 0;
        return {
          userId: u.id,
          userName: u.name,
          role: u.role,
          quotationsSent: userQuotations.filter(q => q.status !== "draft").length,
          dealsWon: won.length,
          revenue,
          conversionRate: Math.round(conversionRate * 10) / 10,
        };
      });

    return res.json(performance);
  } catch (err) {
    req.log.error({ err }, "Staff performance error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Operational Summary (role-based widgets) ──────────────────────────────────

router.get("/dashboard/operational",requireAuth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date(todayStr + "T00:00:00.000Z");
    const todayEnd = new Date(todayStr + "T23:59:59.999Z");

    const [
      checkInsToday,
      checkOutsToday,
      pendingFlightRequests,
      refundsPending,
      flightsIssuedToday,
      whatsappUnread,
      portalPending,
      bookingInquiriesNew,
      recentVouchers,
      recentHotelInvoices,
    ] = await Promise.all([
      // Hotel check-ins today
      db.select({ id: hotelInvoicesTable.id })
        .from(hotelInvoicesTable)
        .where(eq(hotelInvoicesTable.checkIn, todayStr)),
      // Hotel check-outs today
      db.select({ id: hotelInvoicesTable.id })
        .from(hotelInvoicesTable)
        .where(eq(hotelInvoicesTable.checkOut, todayStr)),
      // Pending flight requests
      db.select({ id: flightRequestsTable.id })
        .from(flightRequestsTable)
        .where(eq(flightRequestsTable.status, "pending")),
      // Refunds pending (any refund stage)
      db.select({ id: flightQuotationsTable.id })
        .from(flightQuotationsTable)
        .where(
          or(
            eq(flightQuotationsTable.status, "refund_requested"),
            eq(flightQuotationsTable.status, "refund_approved"),
            eq(flightQuotationsTable.status, "refund_pending"),
          )
        ),
      // Flight tickets issued today
      db.select({ id: flightQuotationsTable.id })
        .from(flightQuotationsTable)
        .where(
          and(
            or(
              eq(flightQuotationsTable.status, "ticketed"),
              eq(flightQuotationsTable.status, "issued"),
            ),
            gte(flightQuotationsTable.issuedAt, todayStart),
            lte(flightQuotationsTable.issuedAt, todayEnd),
          )
        ),
      // WhatsApp unread messages — last 7 days only to avoid accumulation
      db.select({ id: whatsappMessagesTable.id })
        .from(whatsappMessagesTable)
        .where(and(
          eq(whatsappMessagesTable.isRead, false),
          gte(whatsappMessagesTable.createdAt, new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")),
        )),
      // Portal users pending approval
      db.select({ id: portalUsersTable.id })
        .from(portalUsersTable)
        .where(eq(portalUsersTable.status, "pending_approval")),
      // New booking inquiries
      db.select({ id: publicBookingInquiriesTable.id })
        .from(publicBookingInquiriesTable)
        .where(eq(publicBookingInquiriesTable.status, "new")),
      // Recent vouchers (last 5)
      db.select({
        id: vouchersTable.id,
        voucherNumber: vouchersTable.voucherNumber,
        type: vouchersTable.type,
        status: vouchersTable.status,
        narration: vouchersTable.narration,
        createdAt: vouchersTable.createdAt,
      })
        .from(vouchersTable)
        .orderBy(sql`${vouchersTable.createdAt} DESC`)
        .limit(5),
      // Recent hotel invoices (last 5)
      db.select({
        id: hotelInvoicesTable.id,
        dnNumber: hotelInvoicesTable.dnNumber,
        passengerName: hotelInvoicesTable.passengerName,
        receivablePkr: hotelInvoicesTable.receivablePkr,
        status: hotelInvoicesTable.status,
        checkIn: hotelInvoicesTable.checkIn,
        checkOut: hotelInvoicesTable.checkOut,
        createdAt: hotelInvoicesTable.createdAt,
      })
        .from(hotelInvoicesTable)
        .orderBy(sql`${hotelInvoicesTable.createdAt} DESC`)
        .limit(5),
    ]);

    return res.json({
      checkInsToday: checkInsToday.length,
      checkOutsToday: checkOutsToday.length,
      pendingFlightRequests: pendingFlightRequests.length,
      refundsPending: refundsPending.length,
      flightsIssuedToday: flightsIssuedToday.length,
      whatsappUnread: whatsappUnread.length,
      portalPending: portalPending.length,
      bookingInquiriesNew: bookingInquiriesNew.length,
      recentVouchers: recentVouchers.map((v) => ({
        id: v.id,
        voucherNumber: v.voucherNumber,
        type: v.type,
        status: v.status,
        narration: v.narration,
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      })),
      recentHotelInvoices: recentHotelInvoices
        .filter(h => !h.dnNumber?.startsWith("REGDN-"))
        .map((h) => ({
          id: h.id,
          dnNumber: h.dnNumber,
          passengerName: h.passengerName,
          receivablePkr: h.receivablePkr ? parseFloat(h.receivablePkr) : 0,
          status: h.status,
          checkIn: h.checkIn,
          checkOut: h.checkOut,
          createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : h.createdAt,
        })),
    });
  } catch (err) {
    req.log.error({ err }, "Operational dashboard error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Owner Morning Dashboard ───────────────────────────────────────────────────
router.get("/dashboard/owner", requireAuth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date(todayStr + "T00:00:00.000Z");
    const todayEnd = new Date(todayStr + "T23:59:59.999Z");

    // Fetch everything we need in one round-trip
    const [
      allAccounts,
      allJournal,
      todayVouchers,
      draftVouchers,
      allQuotations,
      pendingInvoices,
      todayPayments,
      pendingHotelRequests,
    ] = await Promise.all([
      db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code, type: chartOfAccountsTable.type })
        .from(chartOfAccountsTable),
      db.select({
        debitAccountId: generalJournalTable.debitAccountId,
        creditAccountId: generalJournalTable.creditAccountId,
        amount: generalJournalTable.amount,
      }).from(generalJournalTable),
      db.select({ type: vouchersTable.type, status: vouchersTable.status, createdAt: vouchersTable.createdAt })
        .from(vouchersTable)
        .where(and(
          gte(vouchersTable.createdAt, todayStart),
          lte(vouchersTable.createdAt, todayEnd),
          eq(vouchersTable.status, "posted"),
        )),
      db.select({ id: vouchersTable.id })
        .from(vouchersTable)
        .where(eq(vouchersTable.status, "draft")),
      db.select({
        status: quotationsTable.status,
        createdAt: quotationsTable.createdAt,
        updatedAt: quotationsTable.updatedAt,
      }).from(quotationsTable),
      db.select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(or(eq(invoicesTable.status, "pending"), eq(invoicesTable.status, "partial"))),
      db.select({ amount: paymentsTable.amount })
        .from(paymentsTable)
        .where(and(
          gte(paymentsTable.paidAt, todayStart),
          lte(paymentsTable.paidAt, todayEnd),
        )),
      db.select({ id: hotelRequestsTable.id })
        .from(hotelRequestsTable)
        .where(or(
          eq(hotelRequestsTable.status, "pending"),
          eq(hotelRequestsTable.status, "sent_to_vendor"),
        )),
    ]);

    // Build account maps
    const msfrAcct = allAccounts.find(a => a.code === "MSFR");
    const partyAcctIds = new Set(allAccounts.filter(a => a.type === "party_ledger").map(a => a.id));
    const vendorAcctIds = new Set(allAccounts.filter(a => a.type === "vendor_ledger").map(a => a.id));

    // Compute cash balance, receivables, payables from general journal
    let cashBalance = 0;
    let totalReceivables = 0;
    let totalPayables = 0;
    for (const e of allJournal) {
      const amt = parseFloat(e.amount ?? "0");
      if (msfrAcct) {
        if (e.debitAccountId === msfrAcct.id) cashBalance += amt;
        if (e.creditAccountId === msfrAcct.id) cashBalance -= amt;
      }
      if (partyAcctIds.has(e.debitAccountId ?? -1)) totalReceivables += amt;
      if (partyAcctIds.has(e.creditAccountId ?? -1)) totalReceivables -= amt;
      if (vendorAcctIds.has(e.creditAccountId ?? -1)) totalPayables += amt;
      if (vendorAcctIds.has(e.debitAccountId ?? -1)) totalPayables -= amt;
    }

    // Today's customer collections (RV vouchers posted today)
    const todayRvCount = todayVouchers.filter(v => v.type === "RV").length;
    // Today's vendor payments (PV vouchers posted today)
    const todayPvCount = todayVouchers.filter(v => v.type === "PV").length;

    // Today's revenue = payments received today (from invoice payments)
    const todayRevenue = todayPayments.reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);

    // Today's quotations
    const todayQuotations = allQuotations.filter(q =>
      q.createdAt >= todayStart && q.createdAt <= todayEnd
    ).length;
    const todayAcceptedQuotations = allQuotations.filter(q =>
      q.status === "accepted" && q.updatedAt >= todayStart && q.updatedAt <= todayEnd
    ).length;

    return res.json({
      cashBalance: Math.round(cashBalance * 100) / 100,
      totalReceivables: Math.round(Math.max(0, totalReceivables) * 100) / 100,
      totalPayables: Math.round(Math.max(0, totalPayables) * 100) / 100,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      todayCustomerCollections: todayRvCount,
      todayVendorPayments: todayPvCount,
      pendingCollections: pendingInvoices.length,
      draftVouchersCount: draftVouchers.length,
      todayQuotations,
      todayAcceptedQuotations,
      pendingHotelRequests: pendingHotelRequests.length,
    });
  } catch (err) {
    req.log.error({ err }, "Owner dashboard error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
