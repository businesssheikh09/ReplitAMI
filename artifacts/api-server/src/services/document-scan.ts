import { logger } from "../lib/logger.js";

export interface ScanResult {
  rawText: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  nationality: string | null;
}

const STUB_RESULT: ScanResult = {
  rawText: "OCR not configured — add OpenAI API key in AI Settings",
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  documentNumber: null,
  expiryDate: null,
  nationality: null,
};

export async function scanDocument(_objectKey: string): Promise<ScanResult> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey || !baseUrl) {
    logger.warn("OCR skipped — OpenAI not configured. Add key in ERP → AI Settings.");
    return STUB_RESULT;
  }

  try {
    const pathPart = _objectKey.replace(/^\/objects\//, "");
    const imageUrl = `${process.env.API_BASE_URL ?? ""}/api/storage/objects/${pathPart}`;
    const body = {
      model: "gpt-5.1",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the following fields from this travel document image and return ONLY valid JSON with keys: firstName, lastName, dateOfBirth (YYYY-MM-DD), documentNumber, expiryDate (YYYY-MM-DD), nationality. If a field is not visible return null.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
    };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
    const data = await resp.json() as any;
    const raw = data.choices?.[0]?.message?.content ?? "";

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      rawText: raw,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      dateOfBirth: parsed.dateOfBirth ?? null,
      documentNumber: parsed.documentNumber ?? null,
      expiryDate: parsed.expiryDate ?? null,
      nationality: parsed.nationality ?? null,
    };
  } catch (err) {
    logger.error({ err }, "Document scan failed");
    return { ...STUB_RESULT, rawText: "Scan failed — check AI Settings and retry" };
  }
}
