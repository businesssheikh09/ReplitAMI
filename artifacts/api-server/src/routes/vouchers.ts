import { Router } from "express";
import { db } from "@workspace/db";
import {
  vouchersTable,
  voucherLinesTable,
  chartOfAccountsTable,
  generalJournalTable,
  clientsTable,
  vendorsTable,
  hotelInvoicesTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, or, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { nextEntryNumber } from "../services/journal-poster.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOUCHER_TYPES = ["RV", "PV", "JV", "CV"] as const;
type VoucherType = typeof VOUCHER_TYPES[number];

function voucherPrefix(type: VoucherType): string {
  return type;
}

async function enrichVoucher(v: any, lines: any[], acctMap: Map<number, any>) {
  return {
    ...v,
    lines: lines.map((l) => ({
      ...l,
      debitAmount: parseFloat(l.debitAmount),
      creditAmount: parseFloat(l.creditAmount),
      account: acctMap.get(l.accountId) ?? null,
    })),
    totalDebit: lines.reduce((s, l) => s + parseFloat(l.debitAmount), 0),
    totalCredit: lines.reduce((s, l) => s + parseFloat(l.creditAmount), 0),
  };
}

// ── List vouchers ─────────────────────────────────────────────────────────────

router.get("/accounting/vouchers", requireAuth, async (req, res) => {
  try {
    const { type, status, from, to, search } = req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(vouchersTable)
      .orderBy(desc(vouchersTable.createdAt));

    if (type) rows = rows.filter((r) => r.type === type);
    if (status) rows = rows.filter((r) => r.status === status);
    if (from) rows = rows.filter((r) => r.date >= from);
    if (to) rows = rows.filter((r) => r.date <= to);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.voucherNumber.toLowerCase().includes(q) ||
          r.narration.toLowerCase().includes(q),
      );
    }

    // Enrich with party/vendor names
    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return res.json(
      rows.map((r) => ({
        ...r,
        partyName: r.partyId ? clientMap.get(r.partyId) ?? null : null,
        vendorName: r.vendorId ? vendorMap.get(r.vendorId) ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "List vouchers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get single voucher with lines ─────────────────────────────────────────────

router.get("/accounting/vouchers/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [voucher] = await db
      .select()
      .from(vouchersTable)
      .where(eq(vouchersTable.id, id));
    if (!voucher) return res.status(404).json({ error: "Voucher not found" });

    const lines = await db
      .select()
      .from(voucherLinesTable)
      .where(eq(voucherLinesTable.voucherId, id))
      .orderBy(voucherLinesTable.sortOrder);

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    const [clients, vendors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable),
      db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable),
    ]);

    return res.json({
      ...(await enrichVoucher(voucher, lines, acctMap)),
      partyName: voucher.partyId ? clients.find((c) => c.id === voucher.partyId)?.name ?? null : null,
      vendorName: voucher.vendorId ? vendors.find((v) => v.id === voucher.vendorId)?.name ?? null : null,
    });
  } catch (err) {
    req.log.error({ err }, "Get voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create voucher (draft) ────────────────────────────────────────────────────

router.post("/accounting/vouchers", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      type, date, narration, lines,
      partyId, vendorId, hotelInvoiceId, flightRequestId, transportId, visaId,
    } = req.body;

    if (!VOUCHER_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${VOUCHER_TYPES.join(", ")}` });
    }
    if (!date || !narration) {
      return res.status(400).json({ error: "date and narration are required" });
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: "At least 2 lines required (one DR, one CR)" });
    }

    // Validate each line uses debitAmount/creditAmount format
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.accountId) return res.status(400).json({ error: `Line ${i + 1}: accountId is required` });
      const dr = parseFloat(l.debitAmount);
      const cr = parseFloat(l.creditAmount);
      const hasDebit  = !isNaN(dr) && dr > 0;
      const hasCredit = !isNaN(cr) && cr > 0;
      if (!hasDebit && !hasCredit) {
        return res.status(400).json({
          error: `Line ${i + 1}: each line must have a positive debitAmount or creditAmount (not both zero). Use { debitAmount: "X", creditAmount: "0" } format.`,
        });
      }
    }

    // Validate balance
    const totalDr = lines.reduce((s: number, l: any) => s + (parseFloat(l.debitAmount) || 0), 0);
    const totalCr = lines.reduce((s: number, l: any) => s + (parseFloat(l.creditAmount) || 0), 0);
    if (Math.abs(totalDr - totalCr) > 0.01) {
      return res.status(400).json({ error: `Voucher does not balance (DR ${totalDr.toFixed(2)} ≠ CR ${totalCr.toFixed(2)})` });
    }

    const voucherNumber = await nextEntryNumber(type);

    const [voucher] = await db
      .insert(vouchersTable)
      .values({
        voucherNumber,
        type,
        date,
        narration,
        status: "draft",
        partyId: partyId ?? null,
        vendorId: vendorId ?? null,
        hotelInvoiceId: hotelInvoiceId ?? null,
        flightRequestId: flightRequestId ?? null,
        transportId: transportId ?? null,
        visaId: visaId ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    // Insert lines
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await db.insert(voucherLinesTable).values({
        voucherId: voucher.id,
        accountId: parseInt(String(l.accountId)),
        description: l.description ?? null,
        debitAmount: String(parseFloat(l.debitAmount) || 0),
        creditAmount: String(parseFloat(l.creditAmount) || 0),
        currency: l.currency ?? "PKR",
        sortOrder: i,
      });
    }

    return res.status(201).json({ ...voucher, voucherNumber });
  } catch (err) {
    req.log.error({ err }, "Create voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update voucher (draft only) ───────────────────────────────────────────────

router.patch("/accounting/vouchers/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = parseInt(String(req.params.id));
    const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Voucher not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ error: "Only draft vouchers can be edited" });
    }

    const { date, narration, lines, partyId, vendorId, hotelInvoiceId, flightRequestId, transportId, visaId } = req.body;

    if (lines !== undefined) {
      const totalDr = lines.reduce((s: number, l: any) => s + (parseFloat(l.debitAmount) || 0), 0);
      const totalCr = lines.reduce((s: number, l: any) => s + (parseFloat(l.creditAmount) || 0), 0);
      if (Math.abs(totalDr - totalCr) > 0.01) {
        return res.status(400).json({ error: `Voucher does not balance (DR ${totalDr.toFixed(2)} ≠ CR ${totalCr.toFixed(2)})` });
      }
      // Replace lines
      await db.delete(voucherLinesTable).where(eq(voucherLinesTable.voucherId, id));
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await db.insert(voucherLinesTable).values({
          voucherId: id,
          accountId: parseInt(String(l.accountId)),
          description: l.description ?? null,
          debitAmount: String(parseFloat(l.debitAmount) || 0),
          creditAmount: String(parseFloat(l.creditAmount) || 0),
          currency: l.currency ?? "PKR",
          sortOrder: i,
        });
      }
    }

    const updates: Record<string, any> = { updatedAt: new Date(), updatedBy: user.id };
    if (date !== undefined) updates.date = date;
    if (narration !== undefined) updates.narration = narration;
    if (partyId !== undefined) updates.partyId = partyId ?? null;
    if (vendorId !== undefined) updates.vendorId = vendorId ?? null;
    if (hotelInvoiceId !== undefined) updates.hotelInvoiceId = hotelInvoiceId ?? null;
    if (flightRequestId !== undefined) updates.flightRequestId = flightRequestId ?? null;
    if (transportId !== undefined) updates.transportId = transportId ?? null;
    if (visaId !== undefined) updates.visaId = visaId ?? null;

    const [updated] = await db
      .update(vouchersTable)
      .set(updates)
      .where(eq(vouchersTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Approve voucher ───────────────────────────────────────────────────────────

router.post("/accounting/vouchers/:id/approve", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Only management or admin can approve vouchers" });
    }

    const id = parseInt(String(req.params.id));
    const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Voucher not found" });
    if (existing.status !== "draft") {
      return res.status(400).json({ error: `Voucher must be in 'draft' status to approve (current: ${existing.status})` });
    }

    const [updated] = await db
      .update(vouchersTable)
      .set({
        status: "approved",
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(vouchersTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Approve voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Post voucher to general journal ──────────────────────────────────────────

router.post("/accounting/vouchers/:id/post", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = parseInt(String(req.params.id));

    const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!voucher) return res.status(404).json({ error: "Voucher not found" });
    if (voucher.status !== "approved") {
      return res.status(400).json({ error: `Voucher must be 'approved' before posting (current: ${voucher.status})` });
    }

    const lines = await db
      .select()
      .from(voucherLinesTable)
      .where(eq(voucherLinesTable.voucherId, id))
      .orderBy(voucherLinesTable.sortOrder);

    if (lines.length < 2) {
      return res.status(400).json({ error: "Voucher has no lines to post" });
    }

    const accounts = await db.select().from(chartOfAccountsTable);
    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    // Waterfall allocation: pair DR and CR lines sequentially, consuming remainders.
    // Each line's full amount is posted exactly once — no double-counting.
    const drLines = lines
      .filter((l) => parseFloat(l.debitAmount) > 0)
      .map((l) => ({ ...l, remaining: parseFloat(l.debitAmount) }));
    const crLines = lines
      .filter((l) => parseFloat(l.creditAmount) > 0)
      .map((l) => ({ ...l, remaining: parseFloat(l.creditAmount) }));

    let ci = 0;
    for (const dr of drLines) {
      while (dr.remaining > 0.001 && ci < crLines.length) {
        const cr = crLines[ci];
        const matched = Math.min(dr.remaining, cr.remaining);
        if (matched > 0.001) {
          const entryNumber = await nextEntryNumber("JE");
          await db.insert(generalJournalTable).values({
            entryNumber,
            date: new Date(voucher.date),
            description: `${voucher.voucherNumber} — ${voucher.narration}`,
            debitAccountId: dr.accountId,
            creditAccountId: cr.accountId,
            amount: String(matched.toFixed(2)),
            currency: dr.currency,
            sourceType: `voucher_${voucher.type.toLowerCase()}`,
            sourceId: voucher.id,
          });
          dr.remaining -= matched;
          cr.remaining -= matched;
        }
        if (cr.remaining <= 0.001) ci++;
      }
    }

    const [updated] = await db
      .update(vouchersTable)
      .set({
        status: "posted",
        postedBy: user.id,
        postedAt: new Date(),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(vouchersTable.id, id))
      .returning();

    // If PV linked to a hotel DN, update its vendor paidAmount/paidStatus
    if (voucher.type === "PV" && voucher.hotelInvoiceId) {
      try {
        const voucherTotal = drLines.reduce((s, l) => s + parseFloat(l.debitAmount), 0);
        const [dnInv] = await db.select().from(hotelInvoicesTable).where(eq(hotelInvoicesTable.id, voucher.hotelInvoiceId));
        if (dnInv) {
          const newPaid = parseFloat(dnInv.paidAmount ?? "0") + voucherTotal;
          const payable = parseFloat(dnInv.payableSar ?? "0");
          const newPaidStatus = payable > 0
            ? (newPaid >= payable - 0.01 ? "paid" : newPaid > 0 ? "partial" : "unpaid")
            : "paid";
          await db.update(hotelInvoicesTable)
            .set({ paidAmount: newPaid.toString(), paidStatus: newPaidStatus, updatedAt: new Date() })
            .where(eq(hotelInvoicesTable.id, voucher.hotelInvoiceId));
        }
      } catch (dnErr) {
        req.log.warn({ dnErr }, "Could not update DN paidAmount (non-fatal)");
      }
    }

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Post voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Cancel voucher (soft) ─────────────────────────────────────────────────────

router.post("/accounting/vouchers/:id/cancel", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Only management or admin can cancel vouchers" });
    }

    const id = parseInt(String(req.params.id));
    const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Voucher not found" });
    if (existing.status === "posted") {
      return res.status(400).json({ error: "Posted vouchers cannot be cancelled — create a reversal instead" });
    }
    if (existing.status === "cancelled") {
      return res.status(400).json({ error: "Voucher is already cancelled" });
    }

    const [updated] = await db
      .update(vouchersTable)
      .set({
        status: "cancelled",
        cancelledBy: user.id,
        cancelledAt: new Date(),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(vouchersTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Cancel voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reverse posted voucher ────────────────────────────────────────────────────

router.post("/accounting/vouchers/:id/reverse", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!["management", "admin"].includes(user?.role ?? "")) {
      return res.status(403).json({ error: "Only management or admin can reverse vouchers" });
    }

    const id = parseInt(String(req.params.id));
    const [original] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!original) return res.status(404).json({ error: "Voucher not found" });
    if (original.status !== "posted") {
      return res.status(400).json({ error: "Only posted vouchers can be reversed" });
    }

    const originalLines = await db
      .select()
      .from(voucherLinesTable)
      .where(eq(voucherLinesTable.voucherId, id))
      .orderBy(voucherLinesTable.sortOrder);

    // Create reversal voucher
    const reversalNumber = await nextEntryNumber(original.type as VoucherType);
    const today = new Date().toISOString().slice(0, 10);

    const [reversal] = await db
      .insert(vouchersTable)
      .values({
        voucherNumber: reversalNumber,
        type: original.type,
        date: today,
        narration: `REVERSAL of ${original.voucherNumber} — ${original.narration}`,
        status: "draft",
        partyId: original.partyId,
        vendorId: original.vendorId,
        reversalOf: original.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    // Mirror lines with DR/CR swapped
    for (let i = 0; i < originalLines.length; i++) {
      const l = originalLines[i];
      await db.insert(voucherLinesTable).values({
        voucherId: reversal.id,
        accountId: l.accountId,
        description: `Reversal: ${l.description ?? ""}`,
        debitAmount: l.creditAmount,
        creditAmount: l.debitAmount,
        currency: l.currency,
        sortOrder: i,
      });
    }

    return res.status(201).json({ ...reversal, message: "Reversal voucher created in draft — approve and post to finalise" });
  } catch (err) {
    req.log.error({ err }, "Reverse voucher error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
