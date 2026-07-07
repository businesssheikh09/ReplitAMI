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
  paymentsTable,
  invoicesTable,
} from "@workspace/db";
import { eq, desc, gte, lte, and, sql, or, asc, inArray, isNotNull } from "drizzle-orm";
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

// ── Shared: get voucher amounts per voucher-id ────────────────────────────────

async function getVoucherAmounts(voucherIds: number[]): Promise<Map<number, number>> {
  if (voucherIds.length === 0) return new Map();
  const lineRows = await db
    .select({ voucherId: voucherLinesTable.voucherId, debitAmount: voucherLinesTable.debitAmount })
    .from(voucherLinesTable)
    .where(inArray(voucherLinesTable.voucherId, voucherIds));
  const totByV = new Map<number, number>();
  for (const l of lineRows) {
    totByV.set(l.voucherId, (totByV.get(l.voucherId) ?? 0) + parseFloat(l.debitAmount));
  }
  return totByV;
}

// ── Shared: get voucher amounts + first line description per voucher-id ────────

async function getVoucherDetails(voucherIds: number[]): Promise<Map<number, { amount: number; detail: string | null }>> {
  if (voucherIds.length === 0) return new Map();
  const lineRows = await db
    .select({ voucherId: voucherLinesTable.voucherId, debitAmount: voucherLinesTable.debitAmount, description: voucherLinesTable.description })
    .from(voucherLinesTable)
    .where(inArray(voucherLinesTable.voucherId, voucherIds));
  const result = new Map<number, { amount: number; detail: string | null }>();
  for (const l of lineRows) {
    const cur = result.get(l.voucherId);
    if (!cur) {
      result.set(l.voucherId, { amount: parseFloat(l.debitAmount), detail: l.description ?? null });
    } else {
      cur.amount += parseFloat(l.debitAmount);
      if (!cur.detail && l.description) cur.detail = l.description;
    }
  }
  return result;
}

// ── Party Statement ───────────────────────────────────────────────────────────

router.get("/accounting/reports/party-statement", requireAuth, async (req, res) => {
  try {
    const { partyId, from, to, dateType } = req.query as Record<string, string>;

    const pid = partyId ? parseInt(String(partyId)) : null;
    const isAllMode = !pid;

    // Fetch specific party, or use synthetic "All Clients" header
    let party: Record<string, unknown> | null = null;
    if (pid) {
      const [found] = await db
        .select({ id: clientsTable.id, name: clientsTable.name, phone: clientsTable.phone, email: clientsTable.email, city: clientsTable.city, country: clientsTable.country })
        .from(clientsTable)
        .where(eq(clientsTable.id, pid));
      party = found ?? null;
    } else {
      party = { id: null, name: "All Clients", phone: null, email: null, city: null, country: null };
    }

    if (!party) {
      return res.json({ party: null, hotelBookings: [], vouchers: [], summary: { totalSales: 0, netVouchers: 0, closingBalance: 0, isAdvance: false } });
    }

    // Hotel bookings filtered by invoiceDate or checkIn
    const useCheckIn = dateType === "checkin";
    const hotelConds: ReturnType<typeof eq>[] = [
      (pid ? eq(hotelInvoicesTable.partyId, pid) : isNotNull(hotelInvoicesTable.partyId)) as ReturnType<typeof eq>,
    ];
    if (from) hotelConds.push((useCheckIn ? gte(hotelInvoicesTable.checkIn, from) : gte(hotelInvoicesTable.invoiceDate, from)) as ReturnType<typeof eq>);
    if (to) hotelConds.push((useCheckIn ? lte(hotelInvoicesTable.checkIn, to) : lte(hotelInvoicesTable.invoiceDate, to)) as ReturnType<typeof eq>);

    const hotelBookings = await db.select({
      id: hotelInvoicesTable.id,
      dnNumber: hotelInvoicesTable.dnNumber,
      invoiceDate: hotelInvoicesTable.invoiceDate,
      passengerName: hotelInvoicesTable.passengerName,
      nationality: hotelInvoicesTable.nationality,
      noOfPax: hotelInvoicesTable.noOfPax,
      hotelName: hotelInvoicesTable.hotelName,
      roomType: hotelInvoicesTable.roomType,
      roomNumber: hotelInvoicesTable.roomNumber,
      cnfNumber: hotelInvoicesTable.cnfNumber,
      checkIn: hotelInvoicesTable.checkIn,
      checkOut: hotelInvoicesTable.checkOut,
      noOfNights: hotelInvoicesTable.noOfNights,
      noOfRooms: hotelInvoicesTable.noOfRooms,
      receivableSar: hotelInvoicesTable.receivableSar,
      status: hotelInvoicesTable.status,
      partyName: clientsTable.name,
    })
      .from(hotelInvoicesTable)
      .leftJoin(clientsTable, eq(hotelInvoicesTable.partyId, clientsTable.id))
      .where(and(...hotelConds))
      .orderBy(asc(hotelInvoicesTable.invoiceDate));

    // Vouchers (RV/PV/JV only) — filter by party or all parties
    const vConds: ReturnType<typeof eq>[] = [
      (pid ? eq(vouchersTable.partyId, pid) : isNotNull(vouchersTable.partyId)) as ReturnType<typeof eq>,
      inArray(vouchersTable.type, ["RV", "PV", "JV"]) as ReturnType<typeof eq>,
    ];
    if (from) vConds.push(gte(vouchersTable.date, from) as ReturnType<typeof eq>);
    if (to) vConds.push(lte(vouchersTable.date, to) as ReturnType<typeof eq>);

    const rawVouchers = await db.select({
      id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, type: vouchersTable.type,
      date: vouchersTable.date, narration: vouchersTable.narration, status: vouchersTable.status,
      partyId: vouchersTable.partyId, vendorId: vouchersTable.vendorId, hotelInvoiceId: vouchersTable.hotelInvoiceId,
      partyName: clientsTable.name,
    })
      .from(vouchersTable)
      .leftJoin(clientsTable, eq(vouchersTable.partyId, clientsTable.id))
      .where(and(...vConds))
      .orderBy(asc(vouchersTable.date));
    const detailMap = await getVoucherDetails(rawVouchers.map((v) => v.id));
    const vouchers = rawVouchers.map((v) => { const d = detailMap.get(v.id) ?? { amount: 0, detail: null }; return { ...v, amount: d.amount, detail: d.detail }; });

    // Payments on this client's invoices (from the invoice payment system)
    let payments: {
      id: number; invoiceId: number; receiptNumber: string | null;
      amount: string; method: string; notes: string | null;
      collectedBy: number | null; paidAt: Date;
    }[] = [];
    if (pid) {
      const clientInvoices = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(eq(invoicesTable.clientId, pid));
      if (clientInvoices.length > 0) {
        const invIds = clientInvoices.map((i) => i.id);
        payments = await db
          .select({
            id: paymentsTable.id,
            invoiceId: paymentsTable.invoiceId,
            receiptNumber: paymentsTable.receiptNumber,
            amount: paymentsTable.amount,
            method: paymentsTable.method,
            notes: paymentsTable.notes,
            collectedBy: paymentsTable.collectedBy,
            paidAt: paymentsTable.paidAt,
          })
          .from(paymentsTable)
          .where(inArray(paymentsTable.invoiceId, invIds))
          .orderBy(asc(paymentsTable.paidAt));
        if (from) payments = payments.filter((p) => p.paidAt >= new Date(from));
        if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); payments = payments.filter((p) => p.paidAt <= t); }
      }
    }

    const totalSales = hotelBookings.reduce((s, h) => s + parseFloat(h.receivableSar ?? "0"), 0);
    const netVouchers = vouchers.reduce((s, v) => s + v.amount, 0);
    const totalPayments = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const closingBalance = totalSales - netVouchers - totalPayments;

    return res.json({
      party,
      isAllMode,
      hotelBookings,
      vouchers,
      payments,
      summary: { totalSales, netVouchers, totalPayments, closingBalance, isAdvance: closingBalance < 0 },
    });
  } catch (err) {
    req.log.error({ err }, "Party statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Vendor Statement ──────────────────────────────────────────────────────────

router.get("/accounting/reports/vendor-statement", requireAuth, async (req, res) => {
  try {
    const { vendorId, from, to, dateType, showPartyName } = req.query as Record<string, string>;

    const vid = vendorId ? parseInt(String(vendorId)) : null;
    const isAllMode = !vid;

    // Fetch specific vendor, or use synthetic "All Vendors" header
    let vendor: Record<string, unknown> | null = null;
    if (vid) {
      const [found] = await db
        .select({ id: vendorsTable.id, name: vendorsTable.name, phone: vendorsTable.phone, email: vendorsTable.email, country: vendorsTable.country })
        .from(vendorsTable)
        .where(eq(vendorsTable.id, vid));
      vendor = found ?? null;
    } else {
      vendor = { id: null, name: "All Vendors", phone: null, email: null, country: null };
    }

    if (!vendor) {
      return res.json({ vendor: null, hotelBookings: [], transportBookings: [], vouchers: [], summary: { totalPurchase: 0, netVouchers: 0, closingBalance: 0 } });
    }

    const useCheckIn = dateType === "checkin";
    const hotelConds: ReturnType<typeof eq>[] = [
      (vid ? eq(hotelInvoicesTable.vendorId, vid) : isNotNull(hotelInvoicesTable.vendorId)) as ReturnType<typeof eq>,
    ];
    if (from) hotelConds.push((useCheckIn ? gte(hotelInvoicesTable.checkIn, from) : gte(hotelInvoicesTable.invoiceDate, from)) as ReturnType<typeof eq>);
    if (to) hotelConds.push((useCheckIn ? lte(hotelInvoicesTable.checkIn, to) : lte(hotelInvoicesTable.invoiceDate, to)) as ReturnType<typeof eq>);

    // Hotel bookings — join clients for partyName, join vendors for vendorName (useful in all-mode)
    const hotelRows = await db.select({
      id: hotelInvoicesTable.id,
      dnNumber: hotelInvoicesTable.dnNumber,
      invoiceDate: hotelInvoicesTable.invoiceDate,
      passengerName: hotelInvoicesTable.passengerName,
      nationality: hotelInvoicesTable.nationality,
      noOfPax: hotelInvoicesTable.noOfPax,
      hotelName: hotelInvoicesTable.hotelName,
      roomType: hotelInvoicesTable.roomType,
      roomNumber: hotelInvoicesTable.roomNumber,
      cnfNumber: hotelInvoicesTable.cnfNumber,
      checkIn: hotelInvoicesTable.checkIn,
      checkOut: hotelInvoicesTable.checkOut,
      noOfNights: hotelInvoicesTable.noOfNights,
      noOfRooms: hotelInvoicesTable.noOfRooms,
      payableSar: hotelInvoicesTable.payableSar,
      status: hotelInvoicesTable.status,
      partyId: hotelInvoicesTable.partyId,
      partyName: clientsTable.name,
      vendorName: vendorsTable.name,
    })
      .from(hotelInvoicesTable)
      .leftJoin(clientsTable, eq(hotelInvoicesTable.partyId, clientsTable.id))
      .leftJoin(vendorsTable, eq(hotelInvoicesTable.vendorId, vendorsTable.id))
      .where(and(...hotelConds))
      .orderBy(asc(hotelInvoicesTable.invoiceDate));

    // Transport bookings — filter by vendor or all vendors
    const transConds: ReturnType<typeof eq>[] = [
      (vid ? eq(transportBookingsTable.vendorId, vid) : isNotNull(transportBookingsTable.vendorId)) as ReturnType<typeof eq>,
    ];
    if (from) transConds.push(gte(transportBookingsTable.date, new Date(from)) as ReturnType<typeof eq>);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); transConds.push(lte(transportBookingsTable.date, t) as ReturnType<typeof eq>); }

    const transportBookings = await db.select({
      id: transportBookingsTable.id,
      date: transportBookingsTable.date,
      type: transportBookingsTable.type,
      vehicleType: transportBookingsTable.vehicleType,
      pickupLocation: transportBookingsTable.pickupLocation,
      dropoffLocation: transportBookingsTable.dropoffLocation,
      passengers: transportBookingsTable.passengers,
      amount: transportBookingsTable.amount,
      currency: transportBookingsTable.currency,
      status: transportBookingsTable.status,
      clientId: transportBookingsTable.clientId,
      partyName: clientsTable.name,
      vendorName: vendorsTable.name,
    })
      .from(transportBookingsTable)
      .leftJoin(clientsTable, eq(transportBookingsTable.clientId, clientsTable.id))
      .leftJoin(vendorsTable, eq(transportBookingsTable.vendorId, vendorsTable.id))
      .where(and(...transConds))
      .orderBy(asc(transportBookingsTable.date));

    // Vouchers (RV/PV/JV only) — filter by vendor or all vendors
    const vConds: ReturnType<typeof eq>[] = [
      (vid ? eq(vouchersTable.vendorId, vid) : isNotNull(vouchersTable.vendorId)) as ReturnType<typeof eq>,
      inArray(vouchersTable.type, ["RV", "PV", "JV"]) as ReturnType<typeof eq>,
    ];
    if (from) vConds.push(gte(vouchersTable.date, from) as ReturnType<typeof eq>);
    if (to) vConds.push(lte(vouchersTable.date, to) as ReturnType<typeof eq>);

    const rawVouchers = await db.select({
      id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber, type: vouchersTable.type,
      date: vouchersTable.date, narration: vouchersTable.narration, status: vouchersTable.status,
      partyId: vouchersTable.partyId, vendorId: vouchersTable.vendorId, hotelInvoiceId: vouchersTable.hotelInvoiceId,
      vendorName: vendorsTable.name,
    })
      .from(vouchersTable)
      .leftJoin(vendorsTable, eq(vouchersTable.vendorId, vendorsTable.id))
      .where(and(...vConds))
      .orderBy(asc(vouchersTable.date));
    const detailMapV = await getVoucherDetails(rawVouchers.map((v) => v.id));
    const vouchers = rawVouchers.map((v) => { const d = detailMapV.get(v.id) ?? { amount: 0, detail: null }; return { ...v, amount: d.amount, detail: d.detail }; });

    const totalHotelPurchase = hotelRows.reduce((s, h) => s + parseFloat(h.payableSar ?? "0"), 0);
    const totalTransportPurchase = transportBookings.reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalPurchase = totalHotelPurchase + totalTransportPurchase;
    const netVouchers = vouchers.reduce((s, v) => s + v.amount, 0);
    const closingBalance = totalPurchase - netVouchers;

    const showParty = showPartyName === "true" || isAllMode;
    const hotelBookings = showParty ? hotelRows : hotelRows.map(({ partyName: _p, partyId: _pi, vendorName: _vn, ...rest }) => rest);

    return res.json({
      vendor,
      isAllMode,
      hotelBookings,
      transportBookings,
      vouchers,
      showPartyName: showParty,
      summary: { totalPurchase, totalHotelPurchase, totalTransportPurchase, netVouchers, closingBalance },
    });
  } catch (err) {
    req.log.error({ err }, "Vendor statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Party Summary ─────────────────────────────────────────────────────────────

router.get("/accounting/reports/party-summary", requireAuth, async (req, res) => {
  try {
    const { from, to, filter, dateType: summDateType } = req.query as Record<string, string>;

    // All clients
    const clients = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).orderBy(asc(clientsTable.name));

    // Hotel invoice totals by partyId
    const useCheckInPS = summDateType === "checkin";
    const hotelConds: ReturnType<typeof eq>[] = [isNotNull(hotelInvoicesTable.partyId) as ReturnType<typeof eq>];
    if (from) hotelConds.push((useCheckInPS ? gte(hotelInvoicesTable.checkIn, from) : gte(hotelInvoicesTable.invoiceDate, from)) as ReturnType<typeof eq>);
    if (to) hotelConds.push((useCheckInPS ? lte(hotelInvoicesTable.checkIn, to) : lte(hotelInvoicesTable.invoiceDate, to)) as ReturnType<typeof eq>);

    const hotelRows = await db.select({
      partyId: hotelInvoicesTable.partyId,
      receivableSar: hotelInvoicesTable.receivableSar,
      noOfPax: hotelInvoicesTable.noOfPax,
    }).from(hotelInvoicesTable).where(and(...hotelConds));

    const hotelByParty = new Map<number, { totalSar: number; paxCount: number }>();
    for (const h of hotelRows) {
      const pid = h.partyId!;
      const cur = hotelByParty.get(pid) ?? { totalSar: 0, paxCount: 0 };
      cur.totalSar += parseFloat(h.receivableSar ?? "0");
      cur.paxCount += h.noOfPax ?? 0;
      hotelByParty.set(pid, cur);
    }

    // Voucher amounts by partyId — type filtered by voucherType param (default: RV)
    const { voucherType: psVType } = req.query as Record<string, string>;
    const vConds: ReturnType<typeof eq>[] = [isNotNull(vouchersTable.partyId) as ReturnType<typeof eq>];
    if (psVType && psVType !== "all") {
      vConds.push(eq(vouchersTable.type, psVType) as ReturnType<typeof eq>);
    } else if (!psVType) {
      vConds.push(eq(vouchersTable.type, "RV") as ReturnType<typeof eq>);
    }
    if (from) vConds.push(gte(vouchersTable.date, from) as ReturnType<typeof eq>);
    if (to) vConds.push(lte(vouchersTable.date, to) as ReturnType<typeof eq>);

    const rvVouchers = await db.select({ id: vouchersTable.id, partyId: vouchersTable.partyId }).from(vouchersTable).where(and(...vConds));
    const amtMap = await getVoucherAmounts(rvVouchers.map((v) => v.id));

    const receivedByParty = new Map<number, number>();
    for (const v of rvVouchers) {
      const pid = v.partyId!;
      receivedByParty.set(pid, (receivedByParty.get(pid) ?? 0) + (amtMap.get(v.id) ?? 0));
    }

    // Build rows — filter=all returns every client; outstanding/negative apply threshold
    let rows = clients
      .map((c, i) => {
        const hotel = hotelByParty.get(c.id);
        const netAmount = hotel?.totalSar ?? 0;
        const paxCount = hotel?.paxCount ?? 0;
        const amountReceived = receivedByParty.get(c.id) ?? 0;
        const outstanding = netAmount - amountReceived;
        return { serial: i + 1, partyId: c.id, partyName: c.name, paxCount, opening: 0, netAmount, amountReceived, outstanding };
      })
      .filter((r) => {
        if (filter === "outstanding") return r.outstanding > 0;
        if (filter === "negative") return r.outstanding < 0;
        return true; // "all" or no filter — include every client
      })
      .map((r, i) => ({ ...r, serial: i + 1 }));

    const totals = {
      paxCount: rows.reduce((s, r) => s + r.paxCount, 0),
      netAmount: rows.reduce((s, r) => s + r.netAmount, 0),
      amountReceived: rows.reduce((s, r) => s + r.amountReceived, 0),
      outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    };

    return res.json({ rows, totals });
  } catch (err) {
    req.log.error({ err }, "Party summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Vendor Summary ────────────────────────────────────────────────────────────

router.get("/accounting/reports/vendor-summary", requireAuth, async (req, res) => {
  try {
    const { from, to, filter, dateType: summVDateType } = req.query as Record<string, string>;

    const vendors = await db.select({ id: vendorsTable.id, name: vendorsTable.name }).from(vendorsTable).orderBy(asc(vendorsTable.name));

    // Hotel payable totals by vendorId
    const useCheckInVS = summVDateType === "checkin";
    const hotelConds: ReturnType<typeof eq>[] = [isNotNull(hotelInvoicesTable.vendorId) as ReturnType<typeof eq>];
    if (from) hotelConds.push((useCheckInVS ? gte(hotelInvoicesTable.checkIn, from) : gte(hotelInvoicesTable.invoiceDate, from)) as ReturnType<typeof eq>);
    if (to) hotelConds.push((useCheckInVS ? lte(hotelInvoicesTable.checkIn, to) : lte(hotelInvoicesTable.invoiceDate, to)) as ReturnType<typeof eq>);

    const hotelRows = await db.select({
      vendorId: hotelInvoicesTable.vendorId,
      payableSar: hotelInvoicesTable.payableSar,
    }).from(hotelInvoicesTable).where(and(...hotelConds));

    const hotelByVendor = new Map<number, number>();
    for (const h of hotelRows) {
      const vid = h.vendorId!;
      hotelByVendor.set(vid, (hotelByVendor.get(vid) ?? 0) + parseFloat(h.payableSar ?? "0"));
    }

    // Voucher amounts by vendorId — type filtered by voucherType param (default: PV)
    const { voucherType: vsVType } = req.query as Record<string, string>;
    const vConds: ReturnType<typeof eq>[] = [isNotNull(vouchersTable.vendorId) as ReturnType<typeof eq>];
    if (vsVType && vsVType !== "all") {
      vConds.push(eq(vouchersTable.type, vsVType) as ReturnType<typeof eq>);
    } else if (!vsVType) {
      vConds.push(eq(vouchersTable.type, "PV") as ReturnType<typeof eq>);
    }
    if (from) vConds.push(gte(vouchersTable.date, from) as ReturnType<typeof eq>);
    if (to) vConds.push(lte(vouchersTable.date, to) as ReturnType<typeof eq>);

    const pvVouchers = await db.select({ id: vouchersTable.id, vendorId: vouchersTable.vendorId }).from(vouchersTable).where(and(...vConds));
    const amtMap = await getVoucherAmounts(pvVouchers.map((v) => v.id));

    const paidByVendor = new Map<number, number>();
    for (const v of pvVouchers) {
      const vid = v.vendorId!;
      paidByVendor.set(vid, (paidByVendor.get(vid) ?? 0) + (amtMap.get(v.id) ?? 0));
    }

    // filter=all returns every vendor; outstanding/negative apply threshold
    let rows = vendors
      .map((v, i) => {
        const netAmount = hotelByVendor.get(v.id) ?? 0;
        const amountPaid = paidByVendor.get(v.id) ?? 0;
        const outstanding = netAmount - amountPaid;
        return { serial: i + 1, vendorId: v.id, vendorName: v.name, opening: 0, netAmount, amountPaid, outstanding };
      })
      .filter((r) => {
        if (filter === "outstanding") return r.outstanding > 0;
        if (filter === "negative") return r.outstanding < 0;
        return true; // "all" or no filter — include every vendor
      })
      .map((r, i) => ({ ...r, serial: i + 1 }));

    const totals = {
      netAmount: rows.reduce((s, r) => s + r.netAmount, 0),
      amountPaid: rows.reduce((s, r) => s + r.amountPaid, 0),
      outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    };

    return res.json({ rows, totals });
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

    // Also fetch payments table entries (RCT-* receipt numbers)
    let paymentRecords = await db
      .select({
        id: paymentsTable.id,
        invoiceId: paymentsTable.invoiceId,
        receiptNumber: paymentsTable.receiptNumber,
        amount: paymentsTable.amount,
        method: paymentsTable.method,
        notes: paymentsTable.notes,
        collectedBy: paymentsTable.collectedBy,
        paidAt: paymentsTable.paidAt,
      })
      .from(paymentsTable)
      .orderBy(asc(paymentsTable.paidAt));

    if (from) paymentRecords = paymentRecords.filter((p) => p.paidAt >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); paymentRecords = paymentRecords.filter((p) => p.paidAt <= t); }

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

    const paymentRows = paymentRecords.map((p) => ({
      source: "payment" as const,
      ref: p.receiptNumber ?? `PMT-${p.id}`,
      date: p.paidAt instanceof Date ? p.paidAt.toISOString().slice(0, 10) : String(p.paidAt).slice(0, 10),
      narration: p.notes ?? `Invoice #${p.invoiceId} — ${p.method} payment`,
      partyName: null as string | null,
      vendorName: null as string | null,
      amount: parseFloat(p.amount),
    }));

    const allRows = [...voucherRows, ...journalRows, ...paymentRows].sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ rows: allRows });
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

// ── Profit & Loss ─────────────────────────────────────────────────────────────

router.get("/accounting/reports/profit-loss", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;

    const accounts = await db.select().from(chartOfAccountsTable);
    let entries = await db.select().from(generalJournalTable).orderBy(asc(generalJournalTable.date));
    if (from) entries = entries.filter((e) => e.date >= new Date(from));
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); entries = entries.filter((e) => e.date <= t); }

    const acctMap = new Map(accounts.map((a) => [a.id, a]));

    // Revenue = net CR in revenue-type accounts
    // Expense = net DR in expense-type accounts
    const revByAcct = new Map<number, number>();
    const expByAcct = new Map<number, number>();

    for (const e of entries) {
      const amt = parseFloat(e.amount);
      const crAcct = acctMap.get(e.creditAccountId);
      const drAcct = acctMap.get(e.debitAccountId);

      if (crAcct?.type === "revenue") {
        revByAcct.set(e.creditAccountId, (revByAcct.get(e.creditAccountId) ?? 0) + amt);
      }
      if (drAcct?.type === "revenue") {
        revByAcct.set(e.debitAccountId, (revByAcct.get(e.debitAccountId) ?? 0) - amt);
      }
      if (drAcct?.type === "expense") {
        expByAcct.set(e.debitAccountId, (expByAcct.get(e.debitAccountId) ?? 0) + amt);
      }
      if (crAcct?.type === "expense") {
        expByAcct.set(e.creditAccountId, (expByAcct.get(e.creditAccountId) ?? 0) - amt);
      }
    }

    // Cost of Sales = HOTEL DR side going to vendor/vendor_ledger accounts
    const hotelAcct = accounts.find((a) => a.code === "HOTEL");
    let costOfSales = 0;
    if (hotelAcct) {
      for (const e of entries) {
        if (e.debitAccountId === hotelAcct.id) {
          const crAcct = acctMap.get(e.creditAccountId);
          if (crAcct && (crAcct.type === "liability" || crAcct.type === "vendor_ledger")) {
            costOfSales += parseFloat(e.amount);
          }
        }
      }
    }

    const revenueLines = accounts
      .filter((a) => a.type === "revenue")
      .map((a) => ({ account: a, amount: revByAcct.get(a.id) ?? 0 }))
      .filter((l) => l.amount !== 0);

    const expenseLines = accounts
      .filter((a) => a.type === "expense")
      .map((a) => ({ account: a, amount: expByAcct.get(a.id) ?? 0 }))
      .filter((l) => l.amount !== 0);

    const totalRevenue = revenueLines.reduce((s, l) => s + l.amount, 0);
    const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);
    const grossProfit = totalRevenue - costOfSales;
    const netProfit = grossProfit - totalExpenses;

    return res.json({
      period: { from: from ?? null, to: to ?? null },
      revenue: revenueLines,
      expenses: expenseLines,
      totalRevenue,
      totalExpenses,
      costOfSales,
      grossProfit,
      netProfit,
    });
  } catch (err) {
    req.log.error({ err }, "Profit & Loss error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Balance Sheet ─────────────────────────────────────────────────────────────

router.get("/accounting/reports/balance-sheet", requireAuth, async (req, res) => {
  try {
    const { asAt } = req.query as Record<string, string>;

    const accounts = await db.select().from(chartOfAccountsTable);
    let entries = await db.select().from(generalJournalTable).orderBy(asc(generalJournalTable.date));
    if (asAt) { const t = new Date(asAt); t.setHours(23, 59, 59, 999); entries = entries.filter((e) => e.date <= t); }

    // Accumulate DR/CR per account
    const totals: Record<number, { dr: number; cr: number }> = {};
    for (const acct of accounts) totals[acct.id] = { dr: 0, cr: 0 };
    for (const e of entries) {
      const amt = parseFloat(e.amount);
      if (totals[e.debitAccountId])  totals[e.debitAccountId].dr  += amt;
      if (totals[e.creditAccountId]) totals[e.creditAccountId].cr += amt;
    }

    function netBalance(acct: (typeof accounts)[0]): number {
      const t = totals[acct.id] ?? { dr: 0, cr: 0 };
      const drNormal = ["asset", "expense", "party_ledger"].includes(acct.type);
      return drNormal ? t.dr - t.cr : t.cr - t.dr;
    }

    const assetTypes      = ["asset", "party_ledger"];
    const liabilityTypes  = ["liability", "vendor_ledger"];
    const equityTypes     = ["equity"];
    const revenueTypes    = ["revenue"];
    const expenseTypes    = ["expense"];

    const assets      = accounts.filter((a) => assetTypes.includes(a.type)).map((a) => ({ account: a, balance: netBalance(a) })).filter((l) => l.balance !== 0);
    const liabilities = accounts.filter((a) => liabilityTypes.includes(a.type)).map((a) => ({ account: a, balance: netBalance(a) })).filter((l) => l.balance !== 0);
    const equity      = accounts.filter((a) => equityTypes.includes(a.type)).map((a) => ({ account: a, balance: netBalance(a) })).filter((l) => l.balance !== 0);

    // P&L feeds retained earnings into equity
    const revTotal = accounts.filter((a) => revenueTypes.includes(a.type)).reduce((s, a) => s + netBalance(a), 0);
    const expTotal = accounts.filter((a) => expenseTypes.includes(a.type)).reduce((s, a) => s + netBalance(a), 0);
    const retainedEarnings = revTotal - expTotal;

    const totalAssets      = assets.reduce((s, l) => s + l.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquityBase  = equity.reduce((s, l) => s + l.balance, 0);
    const totalEquity      = totalEquityBase + retainedEarnings;
    const totalLE          = totalLiabilities + totalEquity;
    const difference       = totalAssets - totalLE;
    const isBalanced       = Math.abs(difference) < 1;

    return res.json({
      asAt: asAt ?? new Date().toISOString().slice(0, 10),
      assets,
      liabilities,
      equity: [
        ...equity,
        { account: { id: -1, code: "RETAINED_EARNINGS", name: "Retained Earnings (Net P&L)", type: "equity", isActive: true, description: null, createdAt: null }, balance: retainedEarnings },
      ],
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLE,
      isBalanced,
      difference,
    });
  } catch (err) {
    req.log.error({ err }, "Balance sheet error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
