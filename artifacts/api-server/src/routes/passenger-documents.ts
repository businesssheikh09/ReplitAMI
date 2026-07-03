import { Router } from "express";
import { db, passengerDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { scanDocument } from "../services/document-scan.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── List passenger documents ──────────────────────────────────────────────────

router.get("/passenger-documents", requireAuth, async (req, res) => {
  try {
    const { flightRequestId, flightQuotationId } = req.query as Record<string, string>;
    let rows;
    if (flightRequestId) {
      rows = await db
        .select()
        .from(passengerDocumentsTable)
        .where(eq(passengerDocumentsTable.flightRequestId, parseInt(flightRequestId)));
    } else if (flightQuotationId) {
      rows = await db
        .select()
        .from(passengerDocumentsTable)
        .where(eq(passengerDocumentsTable.flightQuotationId, parseInt(flightQuotationId)));
    } else {
      rows = await db.select().from(passengerDocumentsTable);
    }
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List passenger documents error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create passenger document record ─────────────────────────────────────────

router.post("/passenger-documents", requireAuth, async (req, res) => {
  try {
    const {
      flightRequestId, flightQuotationId, passengerName,
      passportNumber, cnicNumber, nationality, dateOfBirth,
      passportExpiry, fatherName,
    } = req.body;

    const [doc] = await db
      .insert(passengerDocumentsTable)
      .values({
        flightRequestId: flightRequestId ? parseInt(flightRequestId) : null,
        flightQuotationId: flightQuotationId ? parseInt(flightQuotationId) : null,
        passengerName: passengerName ?? null,
        passportNumber: passportNumber ?? null,
        cnicNumber: cnicNumber ?? null,
        nationality: nationality ?? null,
        dateOfBirth: dateOfBirth ?? null,
        passportExpiry: passportExpiry ?? null,
        fatherName: fatherName ?? null,
      })
      .returning();

    return res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Create passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Upload document image (passport or CNIC) ──────────────────────────────────

router.post(
  "/passenger-documents/:id/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const docId = parseInt(req.params.id as string);
      const docType = (req.query.docType as string) ?? "passport";
      const provider = (req.query.provider as string) ?? "ai";

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const storage = new ObjectStorageService();
      const key = `passenger-docs/${docId}-${docType}-${Date.now()}.jpg`;
      await storage.uploadBuffer(key, req.file.buffer, req.file.mimetype || "image/jpeg");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (docType === "cnic") updates.cnicKey = key;
      else updates.passportKey = key;

      if (provider !== "manual") {
        const scan = await scanDocument(key, provider as any, docType as "passport" | "cnic");
        updates.ocrProvider = scan.provider;
        updates.ocrConfidence = scan.confidence?.toString() ?? null;
        updates.ocrResult = JSON.stringify(scan);
        updates.ocrCorrected = false;

        if (!scan.lowConfidence) {
          if (docType === "cnic") {
            if (scan.documentNumber) updates.cnicNumber = scan.documentNumber;
            if (scan.fullName) updates.passengerName = scan.fullName;
            if (scan.fatherName) updates.fatherName = scan.fatherName;
            if (scan.dateOfBirth) updates.dateOfBirth = scan.dateOfBirth;
          } else {
            if (scan.documentNumber) updates.passportNumber = scan.documentNumber;
            if (scan.fullName) updates.passengerName = scan.fullName;
            if (scan.nationality) updates.nationality = scan.nationality;
            if (scan.dateOfBirth) updates.dateOfBirth = scan.dateOfBirth;
            if (scan.expiryDate) updates.passportExpiry = scan.expiryDate;
          }
        }

        const [doc] = await db
          .update(passengerDocumentsTable)
          .set(updates)
          .where(eq(passengerDocumentsTable.id, docId))
          .returning();

        return res.json({
          doc,
          scan,
          needsReview: scan.lowConfidence,
          message: scan.lowConfidence
            ? "OCR confidence is low — please review and correct the extracted fields"
            : "Document scanned successfully",
        });
      }

      const [doc] = await db
        .update(passengerDocumentsTable)
        .set(updates)
        .where(eq(passengerDocumentsTable.id, docId))
        .returning();
      return res.json({ doc, scan: null, needsReview: false, message: "File uploaded (manual entry mode)" });
    } catch (err) {
      req.log.error({ err }, "Upload passenger document error");
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── Re-scan an existing document ─────────────────────────────────────────────

router.post("/passenger-documents/:id/scan", requireAuth, async (req, res) => {
  try {
    const docId = parseInt(req.params.id as string);
    const { docType = "passport", provider = "ai" } = req.body;

    const [existing] = await db
      .select()
      .from(passengerDocumentsTable)
      .where(eq(passengerDocumentsTable.id, docId));
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const key = docType === "cnic" ? existing.cnicKey : existing.passportKey;
    if (!key) return res.status(400).json({ error: `No ${docType} image uploaded yet` });

    const scan = await scanDocument(key, provider as any, docType as "passport" | "cnic");

    const updates: Record<string, unknown> = {
      ocrProvider: scan.provider,
      ocrConfidence: scan.confidence?.toString() ?? null,
      ocrResult: JSON.stringify(scan),
      ocrCorrected: false,
      updatedAt: new Date(),
    };

    if (!scan.lowConfidence) {
      if (docType === "cnic") {
        if (scan.documentNumber) updates.cnicNumber = scan.documentNumber;
        if (scan.fullName) updates.passengerName = scan.fullName;
        if (scan.fatherName) updates.fatherName = scan.fatherName;
        if (scan.dateOfBirth) updates.dateOfBirth = scan.dateOfBirth;
      } else {
        if (scan.documentNumber) updates.passportNumber = scan.documentNumber;
        if (scan.fullName) updates.passengerName = scan.fullName;
        if (scan.nationality) updates.nationality = scan.nationality;
        if (scan.dateOfBirth) updates.dateOfBirth = scan.dateOfBirth;
        if (scan.expiryDate) updates.passportExpiry = scan.expiryDate;
      }
    }

    const [doc] = await db
      .update(passengerDocumentsTable)
      .set(updates)
      .where(eq(passengerDocumentsTable.id, docId))
      .returning();

    return res.json({ doc, scan, needsReview: scan.lowConfidence });
  } catch (err) {
    req.log.error({ err }, "Re-scan document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Manual correction ─────────────────────────────────────────────────────────

router.patch("/passenger-documents/:id", requireAuth, async (req, res) => {
  try {
    const docId = parseInt(req.params.id as string);
    const fields = [
      "passengerName", "passportNumber", "cnicNumber", "nationality",
      "dateOfBirth", "passportExpiry", "fatherName",
    ];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    let hasField = false;
    fields.forEach((f) => {
      if (req.body[f] !== undefined) { updates[f] = req.body[f]; hasField = true; }
    });
    if (hasField) updates.ocrCorrected = true;

    const [doc] = await db
      .update(passengerDocumentsTable)
      .set(updates)
      .where(eq(passengerDocumentsTable.id, docId))
      .returning();
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Patch passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/passenger-documents/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(passengerDocumentsTable).where(eq(passengerDocumentsTable.id, parseInt(req.params.id as string)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
