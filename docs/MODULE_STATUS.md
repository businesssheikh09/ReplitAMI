# Module Status — Al Musafir International ERP

Last updated: June 2026

Status key:
- ✅ Done — working and ready to use
- 🟡 Partial — works but has gaps
- 🔴 Not started / very basic

---

## 1. Flights

**Completion: ~75%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Search, quotation list, ticket issuance |
| Backend API | ✅ Done | GDS search (Amadeus/Sabre/Galileo), quotation CRUD, issue-ticket endpoint |
| Database | ✅ Done | `flight_quotations` table fully set up |
| Testing | 🟡 Partial | GDS on test/mock credentials — not tested with live airline data |

**What works:**
- Staff can search flights by route, date, cabin class, trip type (one-way, return, multi-city)
- Flights come from up to 3 GDS providers simultaneously; falls back to mock results if a GDS is not configured
- Quotations can be created, saved, and sent to clients
- Tickets can be issued by authorised staff using a PIN
- Currency conversion pulls live rates from forex.pk (with fallback hardcoded rates)

**Known issues / gaps:**
- GDS credentials not yet in production mode — all searches return test/mock data until live credentials are entered in GDS Settings
- No PDF quotation generation
- No automated notification to client when a quotation is created
- No automatic link between a flight quotation and an accounting invoice

**Priority: High** — Core revenue activity

---

## 2. Hotels

**Completion: ~60%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Hotel list, hotel requests, hotel invoices |
| Backend API | ✅ Done | Hotels, vendors, hotel requests, hotel invoices |
| Database | ✅ Done | `hotels`, `vendors`, `hotel_requests`, `hotel_invoices` tables |
| Testing | 🔴 Not done | Not tested end-to-end |

**What works:**
- Hotel and vendor records can be created and managed
- Hotel requests from clients can be logged and tracked
- Hotel invoices can be created (separate from the main invoicing module)
- Vendor quotes can be recorded

**Known issues / gaps:**
- No automated cost comparison between vendor quotes
- No link between hotel requests and main accounting invoices
- Hotel invoices are a separate screen from the main Accounting invoices — two places to look

**Priority: Medium**

---

## 3. Accounting

**Completion: ~70%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Invoices, payments, expenses, chart of accounts, general journal |
| Backend API | ✅ Done | Full CRUD; auto journal posting on payment |
| Database | ✅ Done | `invoices`, `payments`, `expenses`, `chart_of_accounts`, `general_journal` tables |
| Testing | 🟡 Partial | Basic flows tested; edge cases not verified |

**What works:**
- Customer invoices and vendor bills can be created (format: INV-YYYY-NNNN)
- Payments can be recorded against invoices
- When a payment is recorded, it is automatically posted to the general journal
- Expenses can be logged with categories
- Chart of accounts is configurable
- Currency transactions are tracked

**Known issues / gaps:**
- No PDF export for invoices — no way to send a formatted invoice to a client right now
- No bank reconciliation
- No profit & loss or balance sheet report
- **Invoice counter resets to 1001 on every server restart** — this can produce duplicate invoice numbers and must be fixed

**Priority: High** — Needed for daily financial operations

---

## 4. WhatsApp

**Completion: ~85%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Inbox, group monitoring, QR login |
| Backend API | ✅ Done | Read/send messages, group list, connect/disconnect |
| Database | ✅ Done | `whatsapp_messages`, `whatsapp_group_links`, `whatsapp_group_names` tables |
| Testing | ✅ Done | Tested with live WhatsApp connection |

**What works:**
- Staff can scan a QR code to connect the office WhatsApp number to the ERP
- Incoming messages from individuals and groups appear in the inbox
- Staff can reply from inside the ERP
- Groups are listed and can be monitored
- Contact list is built automatically from group participant lists

**Known issues / gaps:**
- Only one WhatsApp number can be connected at a time
- No message templates or quick replies
- No automatic reply or chatbot
- If WhatsApp disconnects, a staff member must manually reconnect by scanning the QR code again

**Priority: High** — In active daily use

---

## 5. Campaigns

**Completion: ~90%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Setup, progress tracker, contact selection, history |
| Backend API | ✅ Done | Create, start, pause, resume, stop; history endpoint |
| Database | ✅ Done | `bot_campaigns`, `bot_campaign_sends` tables |
| Testing | 🟡 Partial | Logic tested; large-scale send not stress-tested |

**What works:**
- Send a text message or media file (image, PDF, video) to all contacts or a manually selected list
- Contacts come from WhatsApp group participant lists
- Delay between messages is calculated automatically to spread sends across up to 48 hours
- Campaign can be paused, resumed, and stopped
- Campaign history shows the last 20 campaigns with media info and send counts
- Media previews (with image thumbnails) shown in active campaign panel

**Known issues / gaps:**
- Contact names rely on group membership — contacts not in any monitored group will not appear
- No campaign scheduling (campaigns start immediately when "Start" is clicked)

**Priority: Medium** — Used for marketing blasts

---

## 6. Portal

**Completion: ~65%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | 🟡 Partial | Public booking page and portal user management in ERP |
| Backend API | 🟡 Partial | Registration, login, booking inquiries, document upload, payment receipts |
| Database | ✅ Done | `portal_users`, `portal_user_documents`, `payment_receipts` tables |
| Testing | 🔴 Not done | Not tested with real customers |

**What works:**
- Party agents (travel agencies) and direct customers (DC) can self-register on the public website
- Party registration goes into "pending approval" — ERP staff must approve before they can book
- DC registration is approved automatically
- Registered users can submit booking inquiries for group tickets
- Payment deadline is calculated automatically based on how close the flight date is
- Documents (DTS certificate, visiting card, company registration) can be uploaded at registration
- Automatic OCR attempts to read uploaded documents

**Known issues / gaps:**
- **Passwords are stored as plain text** — critical security issue that must be fixed before real customers use the system
- No email notification when registration is approved or rejected
- No customer-facing booking history
- No payment confirmation message to customer after their receipt is verified
- Staff have no in-ERP alert when a new party registration is waiting for approval

**Priority: High** — Customer-facing; must be secured before launch

---

## 7. CRM (Clients & Follow-ups)

**Completion: ~60%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Client list, client detail, follow-ups list |
| Backend API | ✅ Done | Clients, notes, follow-ups CRUD |
| Database | ✅ Done | `clients`, `client_notes`, `follow_ups` tables |
| Testing | 🔴 Not done | |

**What works:**
- Client records can be created with contact info, lead status, and country
- Notes can be added to each client record
- Follow-up tasks can be created and assigned to staff members with due dates
- Lead status can be tracked (e.g. new lead, contacted, converted)

**Known issues / gaps:**
- No alerts or reminders when a follow-up task is due — staff must check manually
- No pipeline or kanban view — only a flat list
- No link between a client record and their flight quotations or invoices
- No bulk actions (e.g. reassign multiple leads at once)

**Priority: Medium**

---

## 8. Visa Applications

**Completion: ~40%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | 🟡 Partial | Basic application list and form |
| Backend API | 🟡 Partial | Basic CRUD only |
| Database | ✅ Done | `visa_applications` table |
| Testing | 🔴 Not done | |

**What works:**
- Visa applications can be logged with applicant details and status

**Known issues / gaps:**
- No document upload for visa applications
- No status workflow automation
- No link to client records
- No embassy submission tracking

**Priority: Medium** — Important for Umrah operations but very basic right now

---

## 9. Transport

**Completion: ~55%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | 🟡 Partial | Basic booking list and form |
| Backend API | 🟡 Partial | Basic CRUD only |
| Database | ✅ Done | `transport_bookings` table |
| Testing | 🔴 Not done | |

**What works:**
- Transport bookings can be logged with vehicle type, pickup/drop-off locations, date, driver info, and amount
- Bookings can be filtered by status

**Known issues / gaps:**
- No link to accounting or invoicing
- No driver or vehicle management
- No route or fleet tracking

**Priority: Medium**

---

## 10. Reports

**Completion: ~30%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | 🔴 No dedicated screen | Revenue chart and staff performance are embedded inside the Dashboard |
| Backend API | 🟡 Partial | Revenue chart, staff performance, and currency profit report endpoints exist |
| Database | ✅ Done | Data exists in other tables; no separate reporting tables |
| Testing | 🔴 Not done | |

**What works:**
- Revenue over time chart on the Dashboard
- Staff performance summary on the Dashboard
- Currency profit report in Currency Settings

**Known issues / gaps:**
- No dedicated Reports section
- No date range or currency filters
- No export to Excel or PDF
- No accounts receivable aging, no P&L, no Umrah package performance report

**Priority: Medium** — Management needs this for decision-making

---

## 11. Dashboard

**Completion: ~75%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Stats, recent activity, revenue chart, staff performance |
| Backend API | ✅ Done | All dashboard endpoints working |
| Database | ✅ Done | Reads from existing tables |
| Testing | ✅ Done | Working in daily use |

**What works:**
- Key business metrics at a glance (bookings, revenue, clients, pending follow-ups)
- Recent activity feed
- Revenue over time chart
- Staff performance breakdown

**Known issues / gaps:**
- Charts have no date range filters
- Clicking a metric does not navigate to the detail screen

**Priority: Low** — Working well enough for daily use

---

## 12. Media Library

**Completion: ~80%**

| Area | Status | Notes |
|---|---|---|
| Frontend screen | ✅ Done | Upload, browse, search, delete |
| Backend API | ✅ Done | Upload (signed URL), list, download link generation |
| Database | ✅ Done | `media_library` table |
| Testing | ✅ Done | In active use by WhatsApp Campaigns |

**What works:**
- Staff can upload files (images, PDFs, videos, audio)
- Files are stored securely in cloud object storage
- Download links are temporary (signed URLs that expire after a set time)
- Files can be tagged and categorised
- Used by WhatsApp Campaigns to attach media to messages

**Known issues / gaps:**
- No bulk upload
- No storage usage indicator

**Priority: Low** — Working well for current needs
