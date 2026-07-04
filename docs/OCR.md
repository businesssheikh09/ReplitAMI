# OCR — Document Scanning

**Purpose**: Automated extraction of structured data from passport and CNIC images to reduce manual data entry errors and speed up passenger processing.  
**Services**:
- `artifacts/api-server/src/services/document-scan.ts` — orchestrator
- `artifacts/api-server/src/services/local-ocr.ts` — Tesseract.js (offline)
**Routes**:
- `artifacts/api-server/src/routes/passenger-documents.ts` — ERP document management
- `artifacts/api-server/src/routes/booking-inquiries.ts` — public booking scan
**ERP page**: `/passenger-documents`, `/ai-settings`  
**Public page**: `/book-flight/:id` (real-time scan during booking)  

---

## Architecture

```
Image uploaded to Object Storage
         │
         ▼
  document-scan.ts (orchestrator)
  ├── Reads ocr_settings (provider, confidence threshold)
  ├── provider = 'local'  → local-ocr.ts (Tesseract.js)
  ├── provider = 'ai'     → OpenAI GPT-4o-mini vision
  └── provider = 'both'   → run both, pick higher confidence
         │
         ▼
  Structured result:
  { firstName, lastName, passportNumber, expiry, nationality, confidence }
         │
         ▼
  Stored in passenger_documents / public_booking_passengers
         │
         ▼
  Manual verification by ERP operations staff
```

---

## OCR Providers

### Local OCR (`local-ocr.ts`) — Tesseract.js

**Library**: `tesseract.js` — JavaScript port of Google's Tesseract OCR engine (runs fully offline, no API calls).

**Process**:
1. Downloads image from Object Storage (via signed URL)
2. Runs Tesseract with language set to English
3. Post-processes raw text with regex patterns:
   - **MRZ parsing**: extracts data from Machine Readable Zone (two lines of < and alphanumeric characters)
   - **Passport fields**: first name, last name, document number, expiry date, nationality code
   - **CNIC fields**: ID number pattern (XXXXX-XXXXXXX-X)
4. Calculates confidence score from Tesseract's per-word confidence values
5. Returns structured result or `null` if confidence is below threshold

**MRZ Format** (TD3 — standard passport):
```
Line 1: PMKHANMUHAMMAD<<ALI<<<<<<<<<<<<<<<<<<<<<<<
         └─ type └─ nationality └─ surname << given names
Line 2: AB1234567PAK8501012M2601015<<<<<<<<<<<<<<6
         └─ document number └─ nationality └─ DOB └─ expiry
```

### AI OCR — OpenAI GPT-4o-mini Vision

**Requirement**: `AI_INTEGRATIONS_OPENAI_API_KEY` must be set (via ERP AI Settings page or Replit Secrets).

**Process**:
1. Downloads image from Object Storage
2. Converts to base64
3. Sends to OpenAI Chat Completions API with system prompt instructing extraction of passport fields
4. Parses JSON response for structured fields
5. AI-assigned confidence score from response metadata

**Fallback**: If the API key is not set, `scanDocument()` returns `{ provider: 'none', error: 'AI not configured' }`. The ERP AI Settings page shows a warning.

### Provider Selection

Configured via `ocr_settings` table (single row, id=1):

| Setting | Description |
|---|---|
| `provider` | `local` / `ai` / `both` |
| `confidence_threshold` | Minimum confidence to accept result (0.0–1.0) |
| `ai_model` | OpenAI model identifier (default: `gpt-4o-mini`) |

When `provider = 'both'`:
- Both local and AI OCR run in parallel
- Result with higher confidence score is used
- If both are below threshold, the higher-confidence result is returned with a low-confidence flag

---

## ERP Document Management

### Passenger Documents (`/api/passenger-documents`)

Full lifecycle management for ERP-linked passenger identity documents.

**Create**: `POST /api/passenger-documents { flightRequestId | flightQuotationId, passengerName, documentType }`  
**Upload + Scan**: `POST /api/passenger-documents/:id/upload`
1. Accepts multipart form data (image file)
2. Uploads to Object Storage
3. Optionally triggers `scanDocument()` immediately
4. Updates `passenger_documents` with OCR results

**Re-scan**: `POST /api/passenger-documents/:id/scan`
- Re-runs OCR on the already-uploaded image
- Useful when OCR settings change or first scan failed

**Manual correction**: `PATCH /api/passenger-documents/:id { firstName, lastName, passportNumber, expiry, nationality }`
- Sets `ocr_corrected = true` to flag manual override
- Does not re-run OCR

**Verify**: `POST /api/passenger-documents/:id/verify { verified: boolean }`
- Sets `is_verified = true/false`
- Operations staff confirm the document data is accurate

**Delete**: `DELETE /api/passenger-documents/:id` (management/admin only)

### Validation Warnings
`GET /api/passenger-documents` response includes warnings for:
- Missing expiry date
- Missing passport number
- Expiry date within 6 months of travel (passport validity check)
- Document not verified

---

## Public Booking — Real-Time OCR

During the website group ticket booking (`/book-flight/:id`), customers can scan their passports to auto-fill passenger forms.

### Flow
1. Customer uploads passport image in the booking form
2. Browser sends file to: `POST /api/public/scan-document` (multipart)
3. Server uploads to Object Storage
4. Runs `scanDocument()` with current OCR settings
5. Returns structured fields immediately
6. JavaScript auto-fills form fields (first name, last name, passport number, expiry)
7. Customer can correct any errors before submitting

### Booking Submission
`POST /api/public/booking-inquiries` includes the uploaded `document_key` for each passenger.  
A `public_booking_passengers` record is created with the OCR scan results.

ERP staff can view these results in the Booking Inquiries detail page and trigger re-scans.

---

## Portal Document Scanning

ERP staff can trigger OCR on documents uploaded by portal users during registration:

`POST /api/portal/users/:id/scan-doc/:docId`
- Retrieves the document from `portal_users` detail
- Runs `scanDocument()`
- Updates the passenger document record

---

## AI Settings Configuration

**ERP page**: `/ai-settings`

### Setting the API Key
1. Navigate to AI Settings
2. Enter OpenAI API key in the field
3. `POST /api/ai-settings { apiKey }` — stores in `process.env.AI_INTEGRATIONS_OPENAI_API_KEY` for the session
4. Note: For persistence across restarts, the key should be set as a Replit Secret

### Checking Status
`GET /api/ai-settings/status` → `{ configured: boolean, model: string }`

### OCR Settings
Separate from AI key — controls provider and threshold:
`GET /api/ocr-settings` → `{ provider, confidenceThreshold, aiModel }`  
`PATCH /api/ocr-settings { provider, confidenceThreshold, aiModel }` (admin/management only)

---

## Database Tables

| Table | Purpose |
|---|---|
| `passenger_documents` | ERP-linked document records with OCR results |
| `public_booking_passengers` | Portal booking passenger docs with scan results |
| `ocr_settings` | Global OCR configuration (single row) |

### `passenger_documents` OCR Columns
| Column | Description |
|---|---|
| `scan_status` | pending / scanning / done / failed |
| `ocr_first_name` | Extracted first name |
| `ocr_last_name` | Extracted last name |
| `ocr_passport_number` | Extracted document number |
| `ocr_expiry` | Extracted expiry date (raw string) |
| `ocr_nationality` | Extracted nationality code |
| `ocr_confidence` | Confidence score (0.0–1.0) |
| `ocr_corrected` | True if manually corrected after OCR |
| `is_verified` | True if verified by ERP staff |

---

## Permissions

| Action | Required Role |
|---|---|
| View passenger documents | Operations, Management, Admin |
| Upload + scan documents | Operations, Management, Admin |
| Manual correction | Operations, Management, Admin |
| Verify documents | Operations, Management, Admin |
| Delete documents | Management, Admin |
| Configure OCR settings | Management, Admin |
| Set AI API key | Management, Admin |

---

## Known Limitations

- Tesseract.js accuracy degrades significantly with:
  - Low-resolution images (< 300 DPI)
  - Glare, shadows, or image distortion
  - Handwritten fields (e.g., some older passports)
  - Non-English MRZ fonts
- AI OCR (GPT-4o-mini) is not available without an OpenAI API key; the key is stored in-process and does not persist across server restarts unless set as a Replit Secret.
- CNIC parsing is regex-based only — Tesseract accuracy on ID card text varies by card design.
- There is no image pre-processing (deskew, contrast enhancement) before OCR; image quality is as uploaded.
- The local OCR confidence threshold applies to the average Tesseract word confidence, which can be misleadingly high even when key fields are mis-read.

---

## Future Extension Points

- Image pre-processing pipeline (deskew, contrast, resize) before OCR
- AWS Textract or Google Document AI as additional providers
- Automated MRZ checksum validation
- CNIC barcode scanning as a more reliable data extraction method
- Batch OCR processing for multiple passengers in one request
- Confidence-based auto-verification (skip manual review above threshold)
- Passport photo extraction (face crop) for passenger ID cards
