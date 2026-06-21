---
name: OCR Stub Pattern
description: How document scanning is stubbed and activated
---

`scanDocument()` in `artifacts/api-server/src/services/document-scan.ts` checks:
- `process.env.AI_INTEGRATIONS_OPENAI_API_KEY` — the key
- `process.env.AI_INTEGRATIONS_OPENAI_BASE_URL` — the base URL

If either is missing, returns a stub result with `rawText: "OCR not configured — add OpenAI API key in AI Settings"`.

**Activation:** ERP → Admin → AI Settings page (`/ai-settings`). The form POSTs to `/api/ai-settings` which sets `process.env.AI_INTEGRATIONS_OPENAI_API_KEY` at runtime. For persistence across restarts, the key must be added as a Replit Secret named `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.

**Why:** OpenAI requires phone verification to create an account. Stubbing allows the system to work fully without OCR; the AI Settings page is the same pattern as GDS Settings — a config form in the ERP with a clear note about Replit Secrets for persistence.
