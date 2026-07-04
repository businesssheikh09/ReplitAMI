import { Router } from "express";
import { db } from "@workspace/db";
import {
  portalUsersTable,
  paymentReceiptsTable,
  publicBookingInquiriesTable,
  publicBookingPassengersTable,
  invoicesTable,
  hotelInvoicesTable,
  flightQuotationsTable,
  visaApplicationsTable,
  transportBookingsTable,
  vouchersTable,
  voucherLinesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requirePortalAuth } from "../middlewares/portal-auth.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeUser(u: typeof portalUsersTable.$inferSelect) {
  const { passwordHash: _p, portalSessionToken: _t, ...safe } = u;
  return safe;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/portal/dashboard", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;

    // Booking inquiries for this portal user
    const inquiries = await db
      .select()
      .from(publicBookingInquiriesTable)
      .where(eq(publicBookingInquiriesTable.portalUserId, u.id))
      .orderBy(desc(publicBookingInquiriesTable.createdAt))
      .limit(100);

    const openInquiries = inquiries.filter((i) => !["cancelled"].includes(i.status)).length;

    // Payment receipts
    const receipts = await db
      .select()
      .from(paymentReceiptsTable)
      .where(eq(paymentReceiptsTable.portalUserId, u.id))
      .orderBy(desc(paymentReceiptsTable.createdAt))
      .limit(50);

    const pendingPayments = receipts.filter((r) => r.paymentStatus === "pending_receipt").length;

    // ERP data (requires clientId)
    let nextFlight: null | { origin: string; destination: string; departureDate: string; airline: string | null; pnr: string | null } = null;
    let outstandingBalance = "0.00";
    let invoiceCount = 0;

    if (u.clientId) {
      const flights = await db
        .select()
        .from(flightQuotationsTable)
        .where(and(eq(flightQuotationsTable.clientId, u.clientId), eq(flightQuotationsTable.status, "issued")))
        .orderBy(flightQuotationsTable.departureDate)
        .limit(5);

      const upcoming = flights.find((f) => new Date(f.departureDate) > new Date());
      if (upcoming) {
        nextFlight = {
          origin: upcoming.origin,
          destination: upcoming.destination,
          departureDate: upcoming.departureDate.toISOString(),
          airline: upcoming.airline,
          pnr: upcoming.pnr,
        };
      }

      const invoices = await db
        .select()
        .from(invoicesTable)
        .where(and(eq(invoicesTable.clientId, u.clientId), eq(invoicesTable.type, "customer")))
        .limit(100);

      invoiceCount = invoices.length;
      const outstanding = invoices
        .filter((i) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (parseFloat(i.amount) - parseFloat(i.paidAmount)), 0);
      outstandingBalance = outstanding.toFixed(2);
    }

    // Recent activity
    const recentReceipts = receipts.slice(0, 5).map((r) => ({
      type: "payment",
      label: `Payment receipt — ${r.paymentStatus.replace(/_/g, " ")}`,
      date: r.createdAt.toISOString(),
    }));
    const recentInquiries = inquiries.slice(0, 5).map((i) => ({
      type: "booking",
      label: `Booking #${i.referenceNumber} — ${i.status.replace(/_/g, " ")}`,
      date: i.createdAt.toISOString(),
    }));
    const activity = [...recentReceipts, ...recentInquiries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return res.json({
      openInquiries,
      pendingPayments,
      invoiceCount,
      outstandingBalance,
      nextFlight,
      activity,
      hasClientLink: !!u.clientId,
    });
  } catch (err) {
    req.log.error({ err }, "Portal dashboard error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bookings ──────────────────────────────────────────────────────────────────

router.get("/portal/bookings", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    const inquiries = await db
      .select()
      .from(publicBookingInquiriesTable)
      .where(eq(publicBookingInquiriesTable.portalUserId, u.id))
      .orderBy(desc(publicBookingInquiriesTable.createdAt));

    const withData = await Promise.all(
      inquiries.map(async (inq) => {
        const passengers = await db
          .select()
          .from(publicBookingPassengersTable)
          .where(eq(publicBookingPassengersTable.inquiryId, inq.id));
        const [receipt] = await db
          .select()
          .from(paymentReceiptsTable)
          .where(eq(paymentReceiptsTable.inquiryId, inq.id))
          .limit(1);
        return { ...inq, passengers, paymentReceipt: receipt ?? null };
      }),
    );

    return res.json({ bookings: withData });
  } catch (err) {
    req.log.error({ err }, "Portal bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Invoices ──────────────────────────────────────────────────────────────────

router.get("/portal/invoices", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ invoices: [] });

    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.clientId, u.clientId), eq(invoicesTable.type, "customer")))
      .orderBy(desc(invoicesTable.createdAt));

    return res.json({ invoices });
  } catch (err) {
    req.log.error({ err }, "Portal invoices error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Statement (party ledger via vouchers) ─────────────────────────────────────

router.get("/portal/statement", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ entries: [], closingBalance: "0.00" });

    const vouchers = await db
      .select()
      .from(vouchersTable)
      .where(and(eq(vouchersTable.partyId, u.clientId), eq(vouchersTable.status, "posted")))
      .orderBy(vouchersTable.date);

    // For each voucher get the lines
    const entries = await Promise.all(
      vouchers.map(async (v) => {
        const lines = await db
          .select()
          .from(voucherLinesTable)
          .where(eq(voucherLinesTable.voucherId, v.id));
        const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debitAmount), 0);
        const totalCredit = lines.reduce((s, l) => s + parseFloat(l.creditAmount), 0);
        return {
          id: v.id,
          date: v.date,
          voucherNumber: v.voucherNumber,
          type: v.type,
          narration: v.narration,
          debit: totalDebit.toFixed(2),
          credit: totalCredit.toFixed(2),
        };
      }),
    );

    // Running balance
    let balance = 0;
    const withBalance = entries.map((e) => {
      balance += parseFloat(e.debit) - parseFloat(e.credit);
      return { ...e, balance: balance.toFixed(2) };
    });

    return res.json({ entries: withBalance, closingBalance: balance.toFixed(2) });
  } catch (err) {
    req.log.error({ err }, "Portal statement error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Hotel Vouchers ────────────────────────────────────────────────────────────

router.get("/portal/hotel-vouchers", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ vouchers: [] });

    const vouchers = await db
      .select()
      .from(hotelInvoicesTable)
      .where(eq(hotelInvoicesTable.partyId, u.clientId))
      .orderBy(desc(hotelInvoicesTable.createdAt));

    return res.json({ vouchers });
  } catch (err) {
    req.log.error({ err }, "Portal hotel vouchers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Flight Tickets ────────────────────────────────────────────────────────────

router.get("/portal/flight-tickets", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ tickets: [] });

    const tickets = await db
      .select()
      .from(flightQuotationsTable)
      .where(and(eq(flightQuotationsTable.clientId, u.clientId), eq(flightQuotationsTable.status, "issued")))
      .orderBy(desc(flightQuotationsTable.issuedAt));

    return res.json({ tickets });
  } catch (err) {
    req.log.error({ err }, "Portal flight tickets error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Visa Status ───────────────────────────────────────────────────────────────

router.get("/portal/visa-status", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ applications: [] });

    const applications = await db
      .select()
      .from(visaApplicationsTable)
      .where(eq(visaApplicationsTable.clientId, u.clientId))
      .orderBy(desc(visaApplicationsTable.createdAt));

    return res.json({ applications });
  } catch (err) {
    req.log.error({ err }, "Portal visa error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Transport ─────────────────────────────────────────────────────────────────

router.get("/portal/transport", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    if (!u.clientId) return res.json({ bookings: [] });

    const bookings = await db
      .select()
      .from(transportBookingsTable)
      .where(eq(transportBookingsTable.clientId, u.clientId))
      .orderBy(desc(transportBookingsTable.date));

    return res.json({ bookings });
  } catch (err) {
    req.log.error({ err }, "Portal transport error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payments ──────────────────────────────────────────────────────────────────

router.get("/portal/payments", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    const receipts = await db
      .select()
      .from(paymentReceiptsTable)
      .where(eq(paymentReceiptsTable.portalUserId, u.id))
      .orderBy(desc(paymentReceiptsTable.createdAt));

    return res.json({ payments: receipts });
  } catch (err) {
    req.log.error({ err }, "Portal payments error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────

router.patch("/portal/me", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    const { fullName, phone, email, companyName, ownerName, address, whatsapp } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (fullName !== undefined) updates.fullName = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (companyName !== undefined) updates.companyName = companyName;
    if (ownerName !== undefined) updates.ownerName = ownerName;
    if (address !== undefined) updates.address = address;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp;

    const [updated] = await db
      .update(portalUsersTable)
      .set(updates)
      .where(eq(portalUsersTable.id, u.id))
      .returning();

    return res.json(safeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Portal me update error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Change Password ───────────────────────────────────────────────────────────

router.post("/portal/change-password", requirePortalAuth, async (req, res) => {
  try {
    const u = req.portalUser!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Fetch current hash
    const [row] = await db
      .select({ passwordHash: portalUsersTable.passwordHash })
      .from(portalUsersTable)
      .where(eq(portalUsersTable.id, u.id))
      .limit(1);

    // Support both bcrypt hashes (new) and plain-text legacy accounts
    const valid = await bcrypt.compare(currentPassword, row.passwordHash).catch(() => false) ||
      row.passwordHash === currentPassword;
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(portalUsersTable).set({ passwordHash: newHash }).where(eq(portalUsersTable.id, u.id));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Portal change password error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
