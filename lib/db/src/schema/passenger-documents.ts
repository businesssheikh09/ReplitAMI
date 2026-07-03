import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const passengerDocumentsTable = pgTable("passenger_documents", {
  id: serial("id").primaryKey(),
  flightRequestId: integer("flight_request_id"),
  flightQuotationId: integer("flight_quotation_id"),
  passengerName: text("passenger_name"),
  passportNumber: text("passport_number"),
  cnicNumber: text("cnic_number"),
  nationality: text("nationality"),
  dateOfBirth: text("date_of_birth"),
  passportExpiry: text("passport_expiry"),
  fatherName: text("father_name"),
  passportKey: text("passport_key"),
  cnicKey: text("cnic_key"),
  // Auto-detected document type
  documentType: text("document_type"),
  // OCR fields
  ocrProvider: text("ocr_provider"),
  ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 2 }),
  // Original OCR result (before staff correction)
  ocrOriginal: text("ocr_original"),
  // Latest OCR result
  ocrResult: text("ocr_result"),
  ocrCorrected: boolean("ocr_corrected").notNull().default(false),
  // MRZ checksum validation result
  mrzChecksumValid: boolean("mrz_checksum_valid"),
  // Staff verification
  verifiedBy: integer("verified_by"),
  verifiedByName: text("verified_by_name"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PassengerDocument = typeof passengerDocumentsTable.$inferSelect;
