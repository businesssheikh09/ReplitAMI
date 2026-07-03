import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

export interface MrzCheckResult {
  valid: boolean;
  field: string;
  expected: number;
  got: number;
}

export interface LocalOcrResult {
  rawText: string;
  confidence: number;
  detectedDocumentType: "passport" | "cnic" | "unknown";
  mrzChecksums: MrzCheckResult[];
  mrzChecksumValid: boolean;
  fields: Record<string, string | null>;
}

// MRZ character values: 0-9 → face value, A-Z → 10-35, < → 0
function mrzCharValue(c: string): number {
  if (c >= "0" && c <= "9") return parseInt(c);
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // '<' and others
}

function mrzCheckDigit(str: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += mrzCharValue(str[i]) * weights[i % 3];
  }
  return sum % 10;
}

function validateMrzChecksums(line1: string, line2: string): MrzCheckResult[] {
  const results: MrzCheckResult[] = [];

  // Document number (positions 0-8, check at 9)
  if (line2.length >= 10) {
    const docNum = line2.slice(0, 9);
    const expected = parseInt(line2[9]);
    const got = mrzCheckDigit(docNum);
    results.push({ field: "documentNumber", valid: got === expected, expected, got });
  }

  // Date of birth (positions 13-18, check at 19)
  if (line2.length >= 20) {
    const dob = line2.slice(13, 19);
    const expected = parseInt(line2[19]);
    const got = mrzCheckDigit(dob);
    results.push({ field: "dateOfBirth", valid: got === expected, expected, got });
  }

  // Expiry date (positions 21-26, check at 27)
  if (line2.length >= 28) {
    const exp = line2.slice(21, 27);
    const expected = parseInt(line2[27]);
    const got = mrzCheckDigit(exp);
    results.push({ field: "expiryDate", valid: got === expected, expected, got });
  }

  // Composite check (positions 0-9, 13-19, 21-42) at position 43
  if (line2.length >= 44) {
    const composite =
      line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43);
    const expected = parseInt(line2[43]);
    const got = mrzCheckDigit(composite);
    results.push({ field: "composite", valid: got === expected, expected, got });
  }

  return results;
}

function detectDocumentType(text: string): "passport" | "cnic" | "unknown" {
  const upper = text.toUpperCase();
  const lines = upper.split("\n").map((l) => l.trim()).filter(Boolean);

  // MRZ detection: line starting with P< or P followed by country code = passport
  const mrzLines = lines.filter((l) => /^[A-Z0-9<]{30,}$/.test(l.replace(/\s/g, "")));
  if (mrzLines.length >= 2) {
    if (/^P[A-Z<]/.test(mrzLines[0])) return "passport";
    if (/^I[A-Z<]/.test(mrzLines[0])) return "cnic"; // ID card
  }

  // CNIC pattern: 13-digit Pakistani format
  if (/\b\d{5}[-\s]?\d{7}[-\s]?\d{1}\b/.test(upper)) return "cnic";

  // Passport number pattern: XX1234567 or similar
  if (/(?:PASSPORT|PASS(?:PORT)?)\s*(?:NO|NUMBER)?/.test(upper)) return "passport";

  return "unknown";
}

function extractPassportFields(text: string): Record<string, string | null> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const upper = text.toUpperCase();

  let documentNumber: string | null = null;
  let fullName: string | null = null;
  let nationality: string | null = null;
  let dateOfBirth: string | null = null;
  let expiryDate: string | null = null;

  const mrzLines = lines.filter((l) => /^[A-Z0-9<]{30,}$/.test(l.replace(/\s/g, "")));
  if (mrzLines.length >= 2) {
    const td3Line1 = mrzLines[0].replace(/\s/g, "").padEnd(44, "<");
    const td3Line2 = mrzLines[1].replace(/\s/g, "").padEnd(44, "<");

    const nameField = td3Line1.slice(5, 44);
    const nameParts = nameField.split("<<");
    if (nameParts.length >= 2) {
      const surname = nameParts[0].replace(/</g, " ").trim();
      const given = nameParts[1].replace(/</g, " ").trim();
      fullName = `${given} ${surname}`.trim() || null;
    }
    nationality = td3Line2.slice(2, 5).replace(/</g, "").trim() || null;
    documentNumber = td3Line2.slice(0, 9).replace(/</g, "").trim() || null;
    const dob = td3Line2.slice(13, 19);
    if (/^\d{6}$/.test(dob)) {
      const y = parseInt(dob.slice(0, 2));
      const m = dob.slice(2, 4);
      const d = dob.slice(4, 6);
      const year = y > 30 ? `19${y < 10 ? "0" + y : y}` : `20${y < 10 ? "0" + y : y}`;
      dateOfBirth = `${year}-${m}-${d}`;
    }
    const exp = td3Line2.slice(21, 27);
    if (/^\d{6}$/.test(exp)) {
      const y = parseInt(exp.slice(0, 2));
      const m = exp.slice(2, 4);
      const d = exp.slice(4, 6);
      expiryDate = `20${y < 10 ? "0" + y : y}-${m}-${d}`;
    }
  }

  if (!documentNumber) {
    const m = upper.match(/(?:PASSPORT\s*(?:NO|NUMBER|#)[:\s]*|NO[:\s]+)([A-Z]{2}\d{7}|\d{8}[A-Z]?)/);
    if (m) documentNumber = m[1];
  }
  if (!dateOfBirth) {
    const m = upper.match(/(?:DATE\s+OF\s+BIRTH|DOB|BORN)[:\s]+(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/);
    if (m) dateOfBirth = m[1];
  }
  if (!expiryDate) {
    const m = upper.match(/(?:DATE\s+OF\s+EXPIRY|EXPIRY|EXPIRATION|EXPIRES?)[:\s]+(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/);
    if (m) expiryDate = m[1];
  }

  return { documentNumber, fullName, nationality, dateOfBirth, expiryDate, fatherName: null };
}

function extractCnicFields(text: string): Record<string, string | null> {
  const upper = text.toUpperCase();
  let cnicNumber: string | null = null;
  let fullName: string | null = null;
  let fatherName: string | null = null;
  let dateOfBirth: string | null = null;

  // CNIC format: 12345-6789012-3 (with or without dashes)
  const cnicMatch = upper.match(/\b(\d{5}[-\s]?\d{7}[-\s]?\d{1})\b/);
  if (cnicMatch) cnicNumber = cnicMatch[1].replace(/\s/g, "");

  const nameMatch = upper.match(/(?:NAME|HOLDER)[:\s]+([A-Z][A-Z\s]+?)(?:\n|$|FATHER|F\/)/);
  if (nameMatch) fullName = nameMatch[1].trim();

  const fatherMatch = upper.match(/(?:FATHER(?:'?S)?\s+(?:NAME)?|F\/N)[:\s]+([A-Z][A-Z\s]+?)(?:\n|$|DATE|DOB)/);
  if (fatherMatch) fatherName = fatherMatch[1].trim();

  const dobMatch = upper.match(/(?:DATE\s+OF\s+BIRTH|DOB|D\.O\.B)[:\s]+(\d{2}[\-\.\/]\d{2}[\-\.\/]\d{2,4})/);
  if (dobMatch) dateOfBirth = dobMatch[1];

  return { documentNumber: cnicNumber, fullName, fatherName, dateOfBirth, nationality: "Pakistani", expiryDate: null };
}

export async function runLocalOcr(
  objectKey: string,
  documentType?: "passport" | "cnic"
): Promise<LocalOcrResult> {
  try {
    const storage = new ObjectStorageService();
    const file = await storage.getObjectEntityFile(objectKey);
    const [buffer] = await file.download();

    const Tesseract = (await import("tesseract.js")).default;
    const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
    const {
      data: { text, confidence },
    } = await worker.recognize(buffer);
    await worker.terminate();

    const rawText = text.trim();

    // Auto-detect document type if not specified
    const detectedDocumentType =
      documentType ?? (detectDocumentType(rawText) !== "unknown"
        ? detectDocumentType(rawText)
        : "passport");

    // Extract fields based on detected type
    const fields =
      detectedDocumentType === "cnic"
        ? extractCnicFields(rawText)
        : extractPassportFields(rawText);

    // MRZ checksum validation (passport only)
    let mrzChecksums: MrzCheckResult[] = [];
    let mrzChecksumValid = false;
    if (detectedDocumentType === "passport") {
      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[A-Z0-9<]{30,}$/.test(l));
      if (lines.length >= 2) {
        mrzChecksums = validateMrzChecksums(lines[0], lines[1]);
        mrzChecksumValid = mrzChecksums.length > 0 && mrzChecksums.every((c) => c.valid);
      }
    }

    return {
      rawText,
      confidence,
      detectedDocumentType,
      mrzChecksums,
      mrzChecksumValid,
      fields,
    };
  } catch (err) {
    logger.error({ err }, "Local OCR failed");
    return {
      rawText: "",
      confidence: 0,
      detectedDocumentType: "unknown",
      mrzChecksums: [],
      mrzChecksumValid: false,
      fields: { documentNumber: null, fullName: null, nationality: null, dateOfBirth: null, expiryDate: null, fatherName: null },
    };
  }
}
