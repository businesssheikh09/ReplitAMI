import { Router } from "express";
import { db, passengerDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { scanDocument } from "../services/document-scan.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Roles that can see/change sensitive document data
const SENSITIVE_ROLES = ["admin", "management", "operations"];

function canViewDocument(user: any) {
  return SENSITIVE_ROLES.includes(user?.role ?? "");
}
function canDeleteDocument(user: any) {
  return ["admin", "management"].includes(user?.role ?? "");
}
function canChangeOcr(user: any) {
  return ["admin", "management", "operations"].includes(user?.role ?? "");
}

// ── List ──────────────────────────────────────────────────────────────────────

router.get("/passenger-documents", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!canViewDocument(user)) return res.status(403).json({ error: "Not authorised to view passenger documents" });

    const { flightRequestId, flightQuotationId } = req.query as Record<string, string>;
    let rows;
    if (flightRequestId) {
      rows = await db.select().from(passengerDocumentsTable).where(eq(passengerDocumentsTable.flightRequestId, parseInt(flightRequestId)));
    } else if (flightQuotationId) {
      rows = await db.select().from(passengerDocumentsTable).where(eq(passengerDocumentsTable.flightQuotationId, parseInt(flightQuotationId)));
    } else {
      rows = await db.select().from(passengerDocumentsTable);
    }

    // Annotate with warnings
    const now = new Date();
    const annotated = rows.map((doc) => {
      const warnings: string[] = [];
      if (!doc.passportNumber && !doc.cnicNumber) warnings.push("Missing document number");
      if (!doc.passportKey && !doc.cnicKey) warnings.push("No document image uploaded");
      if (!doc.nationality) warnings.push("Missing nationality");
      if (!doc.dateOfBirth) warnings.push("Missing date of birth");
      if (doc.passportExpiry) {
        const expiry = new Date(doc.passportExpiry);
        const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) warnings.push("Passport EXPIRED");
        else if (daysUntilExpiry < 180) warnings.push(`Passport expires in ${daysUntilExpiry} days`);
      } else if (doc.passportKey) {
        warnings.push("Passport expiry not recorded");
      }
      return { ...doc, warnings };
    });

    return res.json(annotated);
  } catch (err) {
    req.log.error({ err }, "List passenger documents error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post("/passenger-documents", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!canViewDocument(user)) return res.status(403).json({ error: "Not authorised" });

    const { flightRequestId, flightQuotationId, passengerName, passportNumber, cnicNumber, nationality, dateOfBirth, passportExpiry, fatherName } = req.body;

    const [doc] = await db.insert(passengerDocumentsTable).values({
      flightRequestId: flightRequestId ? parseInt(flightRequestId) : null,
      flightQuotationId: flightQuotationId ? parseInt(flightQuotationId) : null,
      passengerName: passengerName ?? null,
      passportNumber: passportNumber ?? null,
      cnicNumber: cnicNumber ?? null,
      nationality: nationality ?? null,
      dateOfBirth: dateOfBirth ?? null,
      passportExpiry: passportExpiry ?? null,
      fatherName: fatherName ?? null,
    }).returning();

    return res.status(201).json({ ...doc, warnings: [] });
  } catch (err) {
    req.log.error({ err }, "Create passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Upload + OCR ──────────────────────────────────────────────────────────────

router.post(
  "/passenger-documents/:id/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      if (!canViewDocument(user)) return res.status(403).json({ error: "Not authorised" });

      const docId = parseInt(req.params.id as string);
      const docType = (req.query.docType as string) ?? "passport";
      const provider = (req.query.provider as string) ?? undefined;

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
        updates.documentType = scan.detectedDocumentType;
        updates.mrzChecksumValid = scan.mrzChecksumValid;
        // Save original OCR result (only if not already set)
        const [existing] = await db.select({ ocrOriginal: passengerDocumentsTable.ocrOriginal })
          .from(passengerDocumentsTable).where(eq(passengerDocumentsTable.id, docId));
        if (!existing?.ocrOriginal) {
          updates.ocrOriginal = JSON.stringify(scan);
        }
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

        const [doc] = await db.update(passengerDocumentsTable).set(updates).where(eq(passengerDocumentsTable.id, docId)).returning();
        return res.json({ doc, scan, needsReview: scan.lowConfidence, message: scan.lowConfidence ? "Low confidence — please review" : "Scanned successfully" });
      }

      const [doc] = await db.update(passengerDocumentsTable).set(updates).where(eq(passengerDocumentsTable.id, docId)).returning();
      return res.json({ doc, scan: null, needsReview: false, message: "File uploaded (manual entry mode)" });
    } catch (err) {
      req.log.error({ err }, "Upload passenger document error");
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── Re-scan ───────────────────────────────────────────────────────────────────

router.post("/passenger-documents/:id/scan", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!canChangeOcr(user)) return res.status(403).json({ error: "Not authorised to run OCR" });

    const docId = parseInt(req.params.id as string);
    const { docType = "passport", provider } = req.body;

    const [existing] = await db.select().from(passengerDocumentsTable).where(eq(passengerDocumentsTable.id, docId));
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const key = docType === "cnic" ? existing.cnicKey : existing.passportKey;
    if (!key) return res.status(400).json({ error: `No ${docType} image uploaded yet` });

    const scan = await scanDocument(key, provider as any, docType as "passport" | "cnic");

    const updates: Record<string, unknown> = {
      ocrProvider: scan.provider,
      ocrConfidence: scan.confidence?.toString() ?? null,
      documentType: scan.detectedDocumentType,
      mrzChecksumValid: scan.mrzChecksumValid,
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

    const [doc] = await db.update(passengerDocumentsTable).set(updates).where(eq(passengerDocumentsTable.id, docId)).returning();
    return res.json({ doc, scan, needsReview: scan.lowConfidence });
  } catch (err) {
    req.log.error({ err }, "Re-scan document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Verify (staff sign-off) ───────────────────────────────────────────────────

router.post("/passenger-documents/:id/verify", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!canViewDocument(user)) return res.status(403).json({ error: "Not authorised" });

    const docId = parseInt(req.params.id as string);
    const { verified } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (verified) {
      updates.verifiedBy = user?.id ?? null;
      updates.verifiedByName = user?.name ?? null;
      updates.verifiedAt = new Date();
    } else {
      updates.verifiedBy = null;
      updates.verifiedByName = null;
      updates.verifiedAt = null;
    }

    const [doc] = await db.update(passengerDocumentsTable).set(updates).where(eq(passengerDocumentsTable.id, docId)).returning();
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Verify passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Patch (manual correction) ─────────────────────────────────────────────────

router.patch("/passenger-documents/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!canViewDocument(user)) return res.status(403).json({ error: "Not authorised" });

    const docId = parseInt(req.params.id as string);
    const fields = ["passengerName", "passportNumber", "cnicNumber", "nationality", "dateOfBirth", "passportExpiry", "fatherName"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    let hasField = false;
    fields.forEach((f) => { if (req.body[f] !== undefined) { updates[f] = req.body[f]; hasField = true; } });
    if (hasField) updates.ocrCorrected = true;

    const [doc] = await db.update(passengerDocumentsTable).set(updates).where(eq(passengerDocumentsTable.id, docId)).returning();
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
    const user = (req as any).user;
    if (!canDeleteDocument(user)) return res.status(403).json({ error: "Not authorised to delete documents" });

    await db.delete(passengerDocumentsTable).where(eq(passengerDocumentsTable.id, parseInt(req.params.id as string)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete passenger document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
