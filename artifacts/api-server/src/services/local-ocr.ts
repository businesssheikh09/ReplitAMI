import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

export interface LocalOcrResult {
  rawText: string;
  confidence: number;
  fields: Record<string, string | null>;
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
      const year = y > 30 ? `19${y}` : `20${y < 10 ? "0" + y : y}`;
      dateOfBirth = `${year}-${m}-${d}`;
    }
    const exp = td3Line2.slice(19, 25);
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
  documentType: "passport" | "cnic" = "passport"
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
    const fields =
      documentType === "cnic"
        ? extractCnicFields(rawText)
        : extractPassportFields(rawText);

    return { rawText, confidence, fields };
  } catch (err) {
    logger.error({ err }, "Local OCR failed");
    return {
      rawText: "",
      confidence: 0,
      fields: { documentNumber: null, fullName: null, nationality: null, dateOfBirth: null, expiryDate: null, fatherName: null },
    };
  }
}
