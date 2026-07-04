# Changelog

All significant development phases and features added to the Al Musafir International ERP system. Entries are listed in chronological order from initial build to current state.

---

## Phase 1 — Foundation (Initial Build)

**Scope**: Project scaffolding, database schema, authentication, and core CRM.

### Added
- pnpm monorepo setup with workspaces: `api-server`, `frontend`, `umrah-erp`, `lib/db`, `lib/api-spec`
- PostgreSQL + Drizzle ORM schema (initial migration `0000_amused_shen`)
- Express 5 API with Pino logging, `requireAuth` middleware
- ERP user management (CRUD, roles: sales/accounts/operations/management)
- Session-based authentication with UUID tokens
- CRM: clients, client notes, follow-ups
- Basic `quotations` table and CRUD
- Replit workflows for all four artifacts
- TypeScript 5.9, `tsconfig.base.json`, full typecheck pipeline
- OpenAPI spec + Orval codegen (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)

---

## Phase 2a — Accounting Foundation

**Scope**: Double-entry accounting system — chart of accounts, general journal, and auto-posting.

### Added
- `chart_of_accounts` table with 8 seeded accounts (VENDOR, PARTY, UMRA, AIR, HOTEL, MSFR, FOREX, PROFIT)
- `general_journal` table with crash-safe `journal_counters` sequence
- `journal-poster.ts` service with auto-posting for invoices and payments
- `GET/POST /api/accounting/accounts` — chart of accounts management
- `GET/POST /api/accounting/journal` — journal entry listing and manual creation
- `GET /api/accounting/ledger` — per-account ledger with running balance
- `GET /api/accounting/trial-balance` — balanced DR/CR verification
- `invoices` and `payments` tables; invoice creation auto-posts `DR PARTY / CR UMRA`
- Payment recording auto-posts `DR MSFR / CR PARTY`

---

## Phase 2b — Voucher Engine

**Scope**: Manual accounting vouchers with approval workflow.

### Added
- `vouchers` and `voucher_lines` tables
- Voucher types: RV (Receipt), PV (Payment), JV (Journal), CV (Contra)
- Voucher lifecycle: draft → approved → posted → (reversed)
- Waterfall posting algorithm: pairs DR/CR lines sequentially into journal entries
- `POST /api/accounting/vouchers/:id/approve` — management approval gate
- `POST /api/accounting/vouchers/:id/post` — posts to general journal
- `POST /api/accounting/vouchers/:id/reverse` — mirrored reversal draft

---

## Phase 2c — Ledger, Trial Balance, Party/Vendor Statements

**Scope**: Reporting layer for accounting.

### Added
- `GET /api/accounting/reports/party-statement` — full client ledger
- `GET /api/accounting/reports/vendor-statement` — full vendor ledger
- `GET /api/accounting/reports/cash-book` — MSFR account cash flow
- `GET /api/accounting/reports/receipt-book` — RV vouchers + auto-payment entries
- Accounting reports ERP pages

---

## Phase 2d — Financial Year Management

**Scope**: Accounting period management and financial statements.

### Added
- `financial_years` and `opening_balances` tables
- `POST /api/accounting/financial-years` with overlap validation
- `PUT .../opening-balances` — per-account opening balances
- `POST .../close` — year closing with P&L computation, posts to PROFIT account
- `GET /api/accounting/pnl` — P&L statement by year or date range
- `GET /api/accounting/balance-sheet` — assets/liabilities/equity snapshot

---

## Phase 3 — Business Reports

**Scope**: Operational and flight reporting.

### Added
- `GET /api/bsp-report` — BSP airline settlement report
- `GET /api/staff-ticket-log` — ticket issuance audit trail
- `GET /api/dashboard/operational` — operational metrics API
- ERP Dashboard page with stat cards and operational overview
- `GET /api/accounting/reports/dn-report` — Debit Note report

---

## Phase 4 — Hotel Procurement

**Scope**: Full hotel booking and vendor management system.

### Added
- `hotels`, `vendors`, `hotel_vendors` tables
- `hotel_requests` and `vendor_quotes` tables (migration `0002_hotel_invoices` → hotel_invoices)
- Hotel request workflow: create → send-to-vendor → receive quotes → select quote → invoice
- `hotel_invoices` table with dual-currency (SAR/PKR) amounts
- DN number sequence (`DN-XXXX`)
- `POST /api/hotel-requests/:id/send-to-vendor` — WhatsApp broadcast to vendors
- `postHotelInvoice()` in journal-poster — auto-posts two journal entries per DN
- Hotel invoice ERP page with print view
- Hotel vendor follow-up automation (`hotel-vendor-followup.ts`)
- Hotel check-in reminder automation (`hotel-checkin-reminder.ts`)

---

## Phase 5 — Flight Operations

**Scope**: GDS live search, group ticket inventory, booking requests, ticketing.

### Added
- `flight_quotations`, `flight_ticket_events` tables
- `flight_requests`, `flight_request_events` tables
- `group_tickets` table (migration `0004_group_tickets`)
- `gds_settings` and `local_airline_settings` tables
- GDS adapter pattern (`adapters/registry.ts`, `types.ts`, `stub.ts`)
- Multi-GDS live search (Amadeus/Sabre/Galileo) with result aggregation
- Group ticket scraper (`scheduler.ts` + `groupTicketParser.ts`)
- Flight request status workflow (pending → on_hold → payment_pending → issued)
- PIN-protected ticket issuance (`can_issue_tickets` flag + `ticketing_pin`)
- 4-step refund workflow (request → approve → reject → pay)
- `hold-expiry.ts` — auto-expires GDS holds after 2 hours
- Flight reminder automation (`flight-reminder.ts`)
- BSP report and staff ticket log ERP pages
- Real-time exchange rate scraping from forex.pk

---

## Phase 6 — CRM Enhancement

**Scope**: Full CRM with follow-ups, notes, and client linking.

### Added
- `client_notes` and `follow_ups` tables
- Client detail page with Notes and Follow-ups tabs
- Follow-up creation, completion, and deletion
- Client-to-user assignment
- Lead status pipeline (new, contacted, qualified, closed)
- Package inquiries (`package_inquiries` table) — public website enquiry flow
- Pending inquiries ERP page (convert web enquiries to quotations)

---

## Phase 7 — Dashboards & Reporting

**Scope**: Operational dashboards, currency module, and management visibility.

### Added
- `currency_daily_rates` and `currency_transactions` tables
- Daily rate management (vendor/guest/client rates)
- Currency transaction logging with automatic FOREX journal entry
- FX profit report
- Management summary automation (`management-summary.ts`)
- Pending approvals automation (`pending-approvals.ts`)
- Dashboard automation health panel

---

## Phase 8 — Automation Engine & WhatsApp

**Scope**: Full automation system, WhatsApp inbox, bot campaigns, media library.

### Added
- `whatsapp_monitored_groups`, `whatsapp_group_names` tables (migration `0005_whatsapp_groups`)
- `whatsapp_messages`, `whatsapp_group_links` tables (migration `0006_whatsapp_inbox`)
- `media_library` table (migration `0007_media_library`)
- `bot_campaigns`, `bot_campaign_sends` tables (migration `0008_bot_recipient_mode`)
- `automation_configs`, `automation_logs` tables
- WhatsApp Baileys integration (`whatsapp.ts` service)
- WhatsApp group inbox with unread counts, message threading, send capability
- Group-to-entity linking (link WhatsApp groups to clients, quotations, etc.)
- Bot campaign system: create → start → pause/resume → stop
- Dynamic send-rate calculation for campaigns
- 8 automations: payment_reminder, hotel_checkin_reminder, hotel_vendor_followup, flight_reminder, passport_expiry, visa_expiry, management_summary, pending_approvals
- Automation engine with concurrency control and logging
- `automation-scheduler.ts` with node-cron for all 8 types
- Media library ERP page with upload, replace, download, delete
- OCR service: Tesseract.js local + OpenAI GPT-4o-mini AI provider
- `document-scan.ts` orchestrator with confidence threshold
- Passenger documents management with OCR and manual verification
- `ocr_settings` table; AI settings ERP page

---

## Phase 9 — Customer Portal Completion

**Scope**: Full self-service customer portal for approved portal users.

### Added
- `portal_users.client_id` column (nullable FK → clients) — links portal accounts to ERP clients
- `portal_users.password_hash` upgraded to bcrypt (with legacy plain-text fallback on login)
- `requirePortalAuth` middleware updated to expose `clientId` to route handlers
- **11 portal customer API endpoints** (`portal-customer.ts`):
  - `GET /portal/dashboard` — account overview with upcoming flight
  - `GET /portal/bookings` — booking inquiries with receipt status
  - `GET /portal/invoices` — ERP invoices for linked client
  - `GET /portal/statement` — running ledger with CSV export capability
  - `GET /portal/hotel-vouchers` — hotel confirmation vouchers
  - `GET /portal/flight-tickets` — issued e-tickets
  - `GET /portal/visa-status` — visa applications
  - `GET /portal/transport` — transport bookings
  - `GET /portal/payments` — payment receipt history
  - `PATCH /portal/me` — profile update
  - `POST /portal/change-password` — bcrypt password change
- **IDOR fix** on `POST /api/public/payment-receipts`: added ownership check (`receipt.portalUserId === req.portalUser.id`) — returns 403 on mismatch
- `GET /portal/users` list now includes `clientId` (fixes ERP "Client Linked" column)
- `PATCH /portal/users/:id` ERP endpoint for setting `clientId` (client link)
- **Portal frontend** (`artifacts/frontend`):
  - `PortalLayout` component — responsive sidebar, mobile hamburger, company branding
  - 11 portal pages with full UI: dashboard, bookings, invoices, statement, hotel-vouchers, flight-tickets, visa, transport, payments, profile, downloads
  - Print views for invoices, hotel vouchers, and flight tickets
  - 2-step receipt upload flow (presigned URL → GCS PUT → POST receipt)
  - CSV export on statement page
  - `/my-bookings` redirects to `/portal/bookings` (backward-compat)
- **ERP portal-users page** (`artifacts/umrah-erp`):
  - "Client Linked" status column
  - Link to ERP Client panel in user detail modal with client selector
  - ERP client search queries `/api/clients`

---

## Security Fixes

- **Phase 9**: Fixed IDOR vulnerability on payment receipt upload. Before this fix, any authenticated portal user could submit a receipt for another user's booking by guessing `inquiryId`. Fix: server checks `receipt.portalUserId === req.portalUser.id` before update.
- **Phase 8**: Password hashing with bcrypt introduced for ERP users and portal users.
- **Phase 5**: Ticketing PIN hashing — `ticketing_pin` stored as bcrypt hash.
- Authorization and Cookie headers redacted from all Pino log output.
