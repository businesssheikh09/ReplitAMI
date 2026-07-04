import { Router } from "express";
import { db, publicBookingInquiriesTable, publicBookingPassengersTable, groupTicketsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { requirePortalAuth } from "../middlewares/portal-auth.js";
import { scanDocument } from "../services/document-scan.js";
import { calculatePaymentDeadline } from "../services/deadline-calculator.js";
import { paymentReceiptsTable } from "@workspace/db";

const router = Router();

function generateRef(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `${prefix}-${date}-${rand}`;
}

// ── Public ──────────────────────────────────────────────────────────────────

router.post("/public/booking-inquiries", async (req, res) => {
  try {
    const { ticketId, passengers, portalUserId, userType } = req.body;
    if (!ticketId || !passengers?.length) {
      return res.status(400).json({ error: "ticketId and passengers are required" });
    }

    const [inquiry] = await db
      .insert(publicBookingInquiriesTable)
      .values({
        referenceNumber: generateRef("BI"),
        ticketId: Number(ticketId),
        portalUserId: portalUserId ? Number(portalUserId) : null,
        userType: userType ?? "guest",
      })
      .returning();

    await db.insert(publicBookingPassengersTable).values(
      passengers.map((p: any) => ({
        inquiryId: inquiry.id,
        title: p.title ?? "MR",
        passengerType: p.passengerType ?? "adult",
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob ?? null,
        nationality: p.nationality ?? null,
        docNumber: p.docNumber ?? null,
        docExpiry: p.docExpiry ?? null,
        remarks: p.remarks ?? null,
        documentObjectKey: p.documentObjectKey ?? null,
      })),
    );

    // If this is a Party booking, create payment receipt with dynamic deadline
    if (userType === "party" && portalUserId) {
      const [ticket] = await db
        .select()
        .from(groupTicketsTable)
        .where(eq(groupTicketsTable.id, Number(ticketId)))
        .limit(1);

      if (ticket) {
        const flightDate = new Date(ticket.flightDate);
        const { deadline, tier, hoursUntilFlight } = calculatePaymentDeadline(flightDate, new Date());
        await db.insert(paymentReceiptsTable).values({
          inquiryId: inquiry.id,
          portalUserId: Number(portalUserId),
          deadlineAt: deadline,
          deadlineTier: tier,
          hoursUntilFlight: String(hoursUntilFlight),
        });
      }
    }

    // Fire async OCR for any passengers with uploaded docs
    setImmediate(async () => {
      for (const p of passengers) {
        if (p.documentObjectKey) {
          const result = await scanDocument(p.documentObjectKey);
          await db
            .update(publicBookingPassengersTable)
            .set({
              scanRawText: result.rawText,
              scanFirstName: result.firstName,
              scanLastName: result.lastName,
              scanDob: result.dateOfBirth,
              scanDocNumber: result.documentNumber,
              scanExpiry: result.expiryDate,
              scanNationality: result.nationality,
              scanStatus: result.firstName ? "done" : "failed",
            })
            .where(eq(publicBookingPassengersTable.inquiryId, inquiry.id));
        }
      }
    });

    return res.status(201).json({ id: inquiry.id, referenceNumber: inquiry.referenceNumber });
  } catch (err) {
    req.log.error({ err }, "Create booking inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/public/scan-document", async (req, res) => {
  try {
    const { objectKey } = req.body;
    if (!objectKey) return res.status(400).json({ error: "objectKey required" });
    const result = await scanDocument(objectKey);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Scan document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Portal-auth: my bookings ────────────────────────────────────────────────

router.get("/public/booking-inquiries/mine", requirePortalAuth, async (req, res) => {
  try {
    const userId = req.portalUser!.id;
    const inquiries = await db
      .select()
      .from(publicBookingInquiriesTable)
      .where(eq(publicBookingInquiriesTable.portalUserId, userId))
      .orderBy(desc(publicBookingInquiriesTable.createdAt));

    const withReceipts = await Promise.all(
      inquiries.map(async (inq) => {
        const [receipt] = await db
          .select()
          .from(paymentReceiptsTable)
          .where(eq(paymentReceiptsTable.inquiryId, inq.id))
          .limit(1);
        return { ...inq, paymentReceipt: receipt ?? null };
      }),
    );

    return res.json(withReceipts);
  } catch (err) {
    req.log.error({ err }, "My bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Portal-auth: upload receipt ─────────────────────────────────────────────

router.post("/public/payment-receipts", requirePortalAuth, async (req, res) => {
  try {
    if (req.portalUser!.type !== "party") {
      return res.status(403).json({ error: "Only Party accounts can upload payment receipts" });
    }
    const { inquiryId, objectKey } = req.body;
    if (!inquiryId || !objectKey) return res.status(400).json({ error: "inquiryId and objectKey required" });

    const [receipt] = await db
      .select()
      .from(paymentReceiptsTable)
      .where(eq(paymentReceiptsTable.inquiryId, Number(inquiryId)))
      .limit(1);

    if (!receipt) return res.status(404).json({ error: "Receipt record not found" });

    // Ownership check — portal user may only upload against their own receipt
    if (receipt.portalUserId !== req.portalUser!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (new Date() > receipt.deadlineAt) {
      return res.status(410).json({ error: "Payment deadline has passed", tier: receipt.deadlineTier });
    }

    await db
      .update(paymentReceiptsTable)
      .set({ objectKey, paymentStatus: "receipt_uploaded", uploadedAt: new Date() })
      .where(eq(paymentReceiptsTable.id, receipt.id));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Upload receipt error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── ERP-gated ───────────────────────────────────────────────────────────────

router.get("/booking-inquiries", requireAuth, async (req, res) => {
  try {
    const inquiries = await db
      .select()
      .from(publicBookingInquiriesTable)
      .orderBy(desc(publicBookingInquiriesTable.createdAt));
    return res.json(inquiries);
  } catch (err) {
    req.log.error({ err }, "List booking inquiries error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/booking-inquiries/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [inquiry] = await db
      .select()
      .from(publicBookingInquiriesTable)
      .where(eq(publicBookingInquiriesTable.id, id))
      .limit(1);
    if (!inquiry) return res.status(404).json({ error: "Not found" });

    const passengers = await db
      .select()
      .from(publicBookingPassengersTable)
      .where(eq(publicBookingPassengersTable.inquiryId, id));

    const [ticket] = await db
      .select()
      .from(groupTicketsTable)
      .where(eq(groupTicketsTable.id, inquiry.ticketId))
      .limit(1);

    const receipts = await db
      .select()
      .from(paymentReceiptsTable)
      .where(eq(paymentReceiptsTable.inquiryId, id));

    return res.json({ ...inquiry, passengers, ticket, paymentReceipt: receipts[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "Get booking inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/booking-inquiries/:id", requireAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const [updated] = await db
      .update(publicBookingInquiriesTable)
      .set({ status, notes, updatedAt: new Date() })
      .where(eq(publicBookingInquiriesTable.id, parseInt(String(req.params.id))))
      .returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update booking inquiry error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/payment-receipts/:id/verify", requireAuth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const [updated] = await db
      .update(paymentReceiptsTable)
      .set({
        paymentStatus: status,
        rejectionReason: rejectionReason ?? null,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      })
      .where(eq(paymentReceiptsTable.id, parseInt(String(req.params.id))))
      .returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Verify receipt error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
