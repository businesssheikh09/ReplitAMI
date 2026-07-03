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
  ocrProvider: text("ocr_provider"),
  ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 2 }),
  ocrResult: text("ocr_result"),
  ocrCorrected: boolean("ocr_corrected").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PassengerDocument = typeof passengerDocumentsTable.$inferSelect;
