import { Router } from "express";
import { db } from "@workspace/db";
import { currencySettingsTable, currencyDailyRatesTable, currencyTransactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function serializeRate(r: typeof currencyDailyRatesTable.$inferSelect) {
  return {
    ...r,
    vendorRate: parseNum(r.vendorRate),
    guestRate: parseNum(r.guestRate),
    clientRate: parseNum(r.clientRate),
  };
}

function serializeTx(t: typeof currencyTransactionsTable.$inferSelect) {
  return {
    ...t,
    amount: parseNum(t.amount),
    vendorRate: parseNum(t.vendorRate),
    clientRate: parseNum(t.clientRate),
    vendorCost: parseNum(t.vendorCost),
    clientRevenue: parseNum(t.clientRevenue),
    profit: parseNum(t.profit),
    date: t.date instanceof Date ? t.date.toISOString() : t.date,
  };
}

// ── Home Currency Settings ────────────────────────────────────────────────────

router.get("/currency/settings", async (req, res) => {
  try {
    const rows = await db.select().from(currencySettingsTable).limit(1);
    if (rows.length === 0) {
      const [row] = await db.insert(currencySettingsTable).values({ homeCurrency: "PKR" }).returning();
      return res.json(row);
    }
    return res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Get currency settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/currency/settings", async (req, res) => {
  try {
    const { homeCurrency } = req.body;
    if (!homeCurrency) return res.status(400).json({ error: "homeCurrency required" });
    const rows = await db.select().from(currencySettingsTable).limit(1);
    if (rows.length === 0) {
      const [row] = await db.insert(currencySettingsTable).values({ homeCurrency, updatedAt: new Date() }).returning();
      return res.json(row);
    }
    const [row] = await db.update(currencySettingsTable)
      .set({ homeCurrency, updatedAt: new Date() })
      .where(eq(currencySettingsTable.id, rows[0].id))
      .returning();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update currency settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Daily Rates ───────────────────────────────────────────────────────────────

router.get("/currency/daily-rates", async (req, res) => {
  try {
    const { date } = req.query as Record<string, string>;
    let rows = await db.select().from(currencyDailyRatesTable).orderBy(desc(currencyDailyRatesTable.date));
    if (date) rows = rows.filter(r => r.date === date);
    return res.json(rows.map(serializeRate));
  } catch (err) {
    req.log.error({ err }, "List daily rates error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/currency/daily-rates", async (req, res) => {
  try {
    const { currency, date, vendorRate, guestRate, clientRate, notes } = req.body;
    if (!currency || !date || vendorRate == null || guestRate == null || clientRate == null) {
      return res.status(400).json({ error: "currency, date, vendorRate, guestRate, clientRate required" });
    }
    // Upsert: if same currency + date already exists, update it
    const existing = await db.select().from(currencyDailyRatesTable)
      .where(and(eq(currencyDailyRatesTable.currency, currency), eq(currencyDailyRatesTable.date, date)));
    if (existing.length > 0) {
      const [row] = await db.update(currencyDailyRatesTable)
        .set({
          vendorRate: String(vendorRate),
          guestRate: String(guestRate),
          clientRate: String(clientRate),
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(currencyDailyRatesTable.id, existing[0].id))
        .returning();
      return res.json(serializeRate(row));
    }
    const [row] = await db.insert(currencyDailyRatesTable).values({
      currency,
      date,
      vendorRate: String(vendorRate),
      guestRate: String(guestRate),
      clientRate: String(clientRate),
      notes: notes || null,
    }).returning();
    return res.status(201).json(serializeRate(row));
  } catch (err) {
    req.log.error({ err }, "Save daily rate error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/currency/daily-rates/:id", async (req, res) => {
  try {
    const { vendorRate, guestRate, clientRate, notes } = req.body;
    const [row] = await db.update(currencyDailyRatesTable)
      .set({
        vendorRate: String(vendorRate),
        guestRate: String(guestRate),
        clientRate: String(clientRate),
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(currencyDailyRatesTable.id, parseInt(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(serializeRate(row));
  } catch (err) {
    req.log.error({ err }, "Update daily rate error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/currency/daily-rates/:id", async (req, res) => {
  try {
    await db.delete(currencyDailyRatesTable).where(eq(currencyDailyRatesTable.id, parseInt(req.params.id)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete daily rate error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Currency Transactions ─────────────────────────────────────────────────────

router.get("/currency/transactions", async (req, res) => {
  try {
    const rows = await db.select().from(currencyTransactionsTable).orderBy(desc(currencyTransactionsTable.date));
    return res.json(rows.map(serializeTx));
  } catch (err) {
    req.log.error({ err }, "List currency transactions error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/currency/transactions", async (req, res) => {
  try {
    const { currency, amount, vendorRate, clientRate, rateTier, date, notes } = req.body;
    if (!currency || amount == null || vendorRate == null || clientRate == null || !date) {
      return res.status(400).json({ error: "currency, amount, vendorRate, clientRate, date required" });
    }
    const amt = parseNum(amount);
    const vr = parseNum(vendorRate);
    const cr = parseNum(clientRate);
    const vendorCost = amt * vr;
    const clientRevenue = amt * cr;
    const profit = clientRevenue - vendorCost;
    const [row] = await db.insert(currencyTransactionsTable).values({
      currency,
      amount: String(amt),
      vendorRate: String(vr),
      clientRate: String(cr),
      vendorCost: String(vendorCost),
      clientRevenue: String(clientRevenue),
      profit: String(profit),
      date: new Date(date),
      notes: notes ? `[${rateTier ?? "client"}] ${notes}` : `[${rateTier ?? "client"}]`,
    }).returning();
    return res.status(201).json(serializeTx(row));
  } catch (err) {
    req.log.error({ err }, "Create currency transaction error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/currency/transactions/:id", async (req, res) => {
  try {
    await db.delete(currencyTransactionsTable).where(eq(currencyTransactionsTable.id, parseInt(req.params.id)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete currency transaction error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Profit Report ─────────────────────────────────────────────────────────────

router.get("/currency/profit-report", async (req, res) => {
  try {
    const rows = await db.select().from(currencyTransactionsTable).orderBy(desc(currencyTransactionsTable.date));
    const byCurrency: Record<string, { currency: string; totalAmount: number; totalVendorCost: number; totalClientRevenue: number; totalProfit: number; count: number }> = {};
    for (const row of rows) {
      const k = row.currency;
      if (!byCurrency[k]) byCurrency[k] = { currency: k, totalAmount: 0, totalVendorCost: 0, totalClientRevenue: 0, totalProfit: 0, count: 0 };
      byCurrency[k].totalAmount += parseNum(row.amount);
      byCurrency[k].totalVendorCost += parseNum(row.vendorCost);
      byCurrency[k].totalClientRevenue += parseNum(row.clientRevenue);
      byCurrency[k].totalProfit += parseNum(row.profit);
      byCurrency[k].count += 1;
    }
    const totalProfit = Object.values(byCurrency).reduce((s, r) => s + r.totalProfit, 0);
    const totalVendorCost = Object.values(byCurrency).reduce((s, r) => s + r.totalVendorCost, 0);
    const totalClientRevenue = Object.values(byCurrency).reduce((s, r) => s + r.totalClientRevenue, 0);
    return res.json({ summary: Object.values(byCurrency), totalProfit, totalVendorCost, totalClientRevenue });
  } catch (err) {
    req.log.error({ err }, "Profit report error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
