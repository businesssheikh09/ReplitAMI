import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, quotationsTable, invoicesTable, visaApplicationsTable,
  followUpsTable, transportBookingsTable, expensesTable, usersTable, activityLogsTable
} from "@workspace/db";

const router = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [
      clients, quotations, invoices, visas, followUps, transport, expenses
    ] = await Promise.all([
      db.select().from(clientsTable),
      db.select().from(quotationsTable),
      db.select().from(invoicesTable),
      db.select().from(visaApplicationsTable),
      db.select().from(followUpsTable),
      db.select().from(transportBookingsTable),
      db.select().from(expensesTable),
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

    const revenueByService: Record<string, number> = {
      hotel: 0,
      flight: 0,
      transport: 0,
      visa: 0,
      custom: 0,
    };

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

router.get("/dashboard/recent-activity", async (req, res) => {
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

router.get("/dashboard/revenue-chart", async (req, res) => {
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

router.get("/dashboard/staff-performance", async (req, res) => {
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

export default router;
