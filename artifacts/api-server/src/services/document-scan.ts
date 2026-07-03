import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { runLocalOcr } from "./local-ocr.js";

export type OcrProvider = "ai" | "local" | "manual";

export interface ScanResult {
  rawText: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  nationality: string | null;
  fatherName: string | null;
  confidence: number | null;
  provider: OcrProvider;
  lowConfidence: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 60;

const STUB_RESULT: ScanResult = {
  rawText: "OCR not configured — add OpenAI API key in AI Settings or enable Local OCR",
  firstName: null,
  lastName: null,
  fullName: null,
  dateOfBirth: null,
  documentNumber: null,
  expiryDate: null,
  nationality: null,
  fatherName: null,
  confidence: null,
  provider: "manual",
  lowConfidence: false,
};

async function runAiOcr(objectKey: string): Promise<ScanResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const storage = new ObjectStorageService();
  const file = await storage.getObjectEntityFile(objectKey);
  const [buffer] = await file.download();
  const base64 = buffer.toString("base64");
  const [metadata] = await file.getMetadata();
  const mimeType = (metadata.contentType as string) || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract the following fields from this travel document image and return ONLY valid JSON with keys: firstName, lastName, fullName, dateOfBirth (YYYY-MM-DD), documentNumber, expiryDate (YYYY-MM-DD), nationality, fatherName. If a field is not visible return null.`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 400,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${errText}`);
  }

  const data = (await resp.json()) as any;
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    rawText: raw,
    firstName: parsed.firstName ?? null,
    lastName: parsed.lastName ?? null,
    fullName: parsed.fullName ?? (parsed.firstName && parsed.lastName ? `${parsed.firstName} ${parsed.lastName}` : null),
    dateOfBirth: parsed.dateOfBirth ?? null,
    documentNumber: parsed.documentNumber ?? null,
    expiryDate: parsed.expiryDate ?? null,
    nationality: parsed.nationality ?? null,
    fatherName: parsed.fatherName ?? null,
    confidence: 95,
    provider: "ai",
    lowConfidence: false,
  };
}

export async function scanDocument(
  objectKey: string,
  provider: OcrProvider = "ai",
  documentType: "passport" | "cnic" = "passport"
): Promise<ScanResult> {
  if (provider === "local") {
    try {
      const result = await runLocalOcr(objectKey, documentType);
      const f = result.fields;
      const nameParts = (f.fullName ?? "").split(" ").filter(Boolean);
      const lowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;
      return {
        rawText: result.rawText,
        firstName: nameParts[0] ?? null,
        lastName: nameParts.slice(1).join(" ") || null,
        fullName: f.fullName ?? null,
        dateOfBirth: f.dateOfBirth ?? null,
        documentNumber: f.documentNumber ?? null,
        expiryDate: f.expiryDate ?? null,
        nationality: f.nationality ?? null,
        fatherName: f.fatherName ?? null,
        confidence: result.confidence,
        provider: "local",
        lowConfidence,
      };
    } catch (err) {
      logger.error({ err }, "Local OCR failed");
      return { ...STUB_RESULT, rawText: "Local OCR failed — upload image and retry", provider: "local" };
    }
  }

  if (provider === "ai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn("AI OCR skipped — OpenAI not configured. Add OPENAI_API_KEY in ERP → AI Settings.");
      return STUB_RESULT;
    }
    try {
      return await runAiOcr(objectKey);
    } catch (err) {
      logger.error({ err }, "AI OCR failed");
      return { ...STUB_RESULT, rawText: "AI OCR failed — check AI Settings and retry", provider: "ai" };
    }
  }

  return STUB_RESULT;
}
