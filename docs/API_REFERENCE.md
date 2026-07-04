# API Reference

**Base path**: `/api`  
**Server**: `artifacts/api-server` (Express 5)  
**Auth**: `Authorization: Bearer <token>` for ERP routes; same header with portal token for portal routes  
**Logging**: All requests logged with Pino; Authorization and Cookie headers redacted  

---

## Authentication

### ERP Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Authenticates ERP user; returns session token |
| POST | `/api/auth/logout` | ERP | Invalidates current session token |
| GET | `/api/auth/me` | ERP | Returns current user profile |

### Portal Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/portal/register` | None | Register new portal user (party/dc) |
| POST | `/api/portal/login` | None | Authenticate portal user; returns portal session token |
| POST | `/api/portal/logout` | Portal | Invalidate portal session |
| GET | `/api/portal/me` | Portal | Current portal user profile |

---

## System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/healthz` | None | Health check — returns `{ status: "ok" }` |

---

## ERP Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | ERP | List users with role/search filter |
| POST | `/api/users` | ERP (admin/mgmt) | Create ERP user |
| GET | `/api/users/:id` | ERP | Get user detail |
| PATCH | `/api/users/:id` | ERP (admin/mgmt) | Update profile, role, ticketing PIN |
| DELETE | `/api/users/:id` | ERP (admin/mgmt) | Delete user |
| GET | `/api/users/assignable` | ERP | List staff assignable to requests |

---

## CRM — Clients

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/clients` | ERP | List clients (search, lead_status filter) |
| POST | `/api/clients` | ERP | Create client |
| GET | `/api/clients/:id` | ERP | Client detail |
| PATCH | `/api/clients/:id` | ERP | Update client |
| DELETE | `/api/clients/:id` | ERP | Delete client |
| GET | `/api/clients/:id/notes` | ERP | List client notes |
| POST | `/api/clients/:id/notes` | ERP | Add note |
| DELETE | `/api/clients/:id/notes/:noteId` | ERP | Delete note |
| GET | `/api/follow-ups` | ERP | List follow-ups (filter by client/status) |
| POST | `/api/follow-ups` | ERP | Create follow-up |
| PATCH | `/api/follow-ups/:id` | ERP | Update follow-up |
| DELETE | `/api/follow-ups/:id` | ERP | Delete follow-up |

---

## Quotations

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/quotations` | ERP | List quotations |
| POST | `/api/quotations` | ERP | Create quotation |
| GET | `/api/quotations/:id` | ERP | Quotation detail |
| PATCH | `/api/quotations/:id` | ERP | Update quotation |
| DELETE | `/api/quotations/:id` | ERP | Delete quotation |

---

## Hotels & Vendors

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hotels` | ERP | List hotels |
| POST | `/api/hotels` | ERP | Create hotel |
| GET | `/api/hotels/:id` | ERP | Hotel detail |
| PATCH | `/api/hotels/:id` | ERP | Update hotel |
| DELETE | `/api/hotels/:id` | ERP | Delete hotel |
| GET | `/api/hotels/:id/vendors` | ERP | List hotel vendors |
| POST | `/api/hotels/:id/vendors` | ERP | Add vendor to hotel |
| DELETE | `/api/hotels/:id/vendors/:vendorId` | ERP | Remove vendor from hotel |
| GET | `/api/vendors` | ERP | List vendors |
| POST | `/api/vendors` | ERP | Create vendor |
| GET | `/api/vendors/:id` | ERP | Vendor detail |
| PATCH | `/api/vendors/:id` | ERP | Update vendor |
| DELETE | `/api/vendors/:id` | ERP | Delete vendor |
| GET | `/api/public/hotels` | None | Public hotel list for inquiry forms |

---

## Hotel Requests (Procurement)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hotel-requests` | ERP | List hotel requests |
| POST | `/api/hotel-requests` | ERP | Create hotel request |
| GET | `/api/hotel-requests/:id` | ERP | Request detail with quotes |
| PATCH | `/api/hotel-requests/:id` | ERP | Update request |
| DELETE | `/api/hotel-requests/:id` | ERP | Delete request |
| POST | `/api/hotel-requests/:id/send-to-vendor` | ERP | Broadcast request to vendors via WhatsApp |
| POST | `/api/hotel-requests/:id/quotes` | ERP | Add vendor quote |
| PATCH | `/api/hotel-requests/:id/quotes/:quoteId` | ERP | Update quote |
| PATCH | `/api/hotel-requests/:id/quotes/:quoteId/select` | ERP | Select winning quote |

---

## Hotel Invoices (DN)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/invoices/hotel/next-dn` | ERP | Preview next DN number |
| GET | `/api/invoices/hotel` | ERP | List hotel invoices |
| GET | `/api/invoices/hotel/:id` | ERP | Hotel invoice detail |
| POST | `/api/invoices/hotel` | ERP | Create hotel invoice (posts journal entry) |
| PUT | `/api/invoices/hotel/:id` | ERP | Update hotel invoice |

---

## Accounting — Invoices & Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/invoices` | ERP | List invoices |
| POST | `/api/invoices` | ERP | Create invoice; auto-posts DR PARTY / CR revenue |
| POST | `/api/invoices/:id/payments` | ERP | Record payment; auto-posts DR MSFR / CR PARTY |
| GET | `/api/expenses` | ERP | List expenses |
| POST | `/api/expenses` | ERP | Create expense |
| PATCH | `/api/expenses/:id` | ERP | Update expense |
| DELETE | `/api/expenses/:id` | ERP | Delete expense |

---

## Accounting — Chart of Accounts & Journal

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/accounting/accounts` | ERP | Chart of Accounts |
| GET | `/api/accounting/journal` | ERP | General journal entries (paginated) |
| POST | `/api/accounting/journal` | ERP (accounts/mgmt) | Manual journal entry |
| GET | `/api/accounting/ledger` | ERP | Ledger for a specific account with running balance |
| GET | `/api/accounting/trial-balance` | ERP | Trial balance (DR/CR totals per account) |

---

## Accounting — Vouchers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/accounting/vouchers` | ERP | List vouchers |
| POST | `/api/accounting/vouchers` | ERP | Create draft voucher (RV/PV/JV/CV) |
| GET | `/api/accounting/vouchers/:id` | ERP | Voucher detail with lines |
| POST | `/api/accounting/vouchers/:id/approve` | ERP (mgmt/admin) | Approve voucher |
| POST | `/api/accounting/vouchers/:id/post` | ERP (accounts/mgmt) | Post to general journal (waterfall allocation) |
| POST | `/api/accounting/vouchers/:id/reverse` | ERP (mgmt/admin) | Reverse posted voucher |
| PATCH | `/api/accounting/vouchers/:id` | ERP | Update draft voucher |
| DELETE | `/api/accounting/vouchers/:id` | ERP | Delete draft voucher |

---

## Accounting — Financial Years & Reporting

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/accounting/financial-years` | ERP | List financial years |
| POST | `/api/accounting/financial-years` | ERP (mgmt/admin) | Create financial year (no overlap check) |
| GET | `/api/accounting/financial-years/:id` | ERP | Financial year detail |
| GET | `/api/accounting/financial-years/:id/opening-balances` | ERP | Opening balances for year |
| PUT | `/api/accounting/financial-years/:id/opening-balances` | ERP (accounts/mgmt) | Save opening balances |
| POST | `/api/accounting/financial-years/:id/close` | ERP (mgmt/admin) | Close year; posts P&L to PROFIT account |
| GET | `/api/accounting/pnl` | ERP | P&L statement (by yearId or date range) |
| GET | `/api/accounting/balance-sheet` | ERP | Balance sheet (by yearId or asOf date) |

---

## Accounting — Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/accounting/reports/party-statement` | ERP | Full client (PARTY) ledger statement |
| GET | `/api/accounting/reports/vendor-statement` | ERP | Full vendor ledger statement |
| GET | `/api/accounting/reports/cash-book` | ERP | All MSFR (cash/bank) transactions |
| GET | `/api/accounting/reports/receipt-book` | ERP | RV vouchers + auto-posted payment entries |
| GET | `/api/accounting/reports/dn-report` | ERP | Debit Note report for hotel procurement |

---

## Currency

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/currency/settings` | ERP | Home currency setting |
| PUT | `/api/currency/settings` | ERP (mgmt/admin) | Update home currency |
| GET | `/api/currency/rates` | None | Live PKR exchange rates (scraped from forex.pk) |
| GET | `/api/currency/daily-rates` | ERP | Daily rate records (filter by date) |
| POST | `/api/currency/daily-rates` | ERP | Upsert daily rate |
| PUT | `/api/currency/daily-rates/:id` | ERP | Update rate |
| DELETE | `/api/currency/daily-rates/:id` | ERP | Delete rate |
| GET | `/api/currency/transactions` | ERP | List currency transactions |
| POST | `/api/currency/transactions` | ERP | Record transaction (posts FOREX journal entry) |
| DELETE | `/api/currency/transactions/:id` | ERP | Delete transaction |
| GET | `/api/currency/profit-report` | ERP | FX profit/loss summary |

---

## Flights — GDS Search & Ticketing

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/flights/search` | ERP | Multi-GDS flight search (Amadeus/Sabre/Galileo) |
| POST | `/api/flights/issue-ticket` | ERP (can_issue_tickets + PIN) | Issue ticket through GDS |

---

## Flights — Quotations & Tickets

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/flight-quotations` | ERP | List flight quotations |
| POST | `/api/flight-quotations` | ERP | Create flight quotation |
| GET | `/api/flight-quotations/:id` | ERP | Quotation detail |
| PATCH | `/api/flight-quotations/:id` | ERP | Update quotation |
| DELETE | `/api/flight-quotations/:id` | ERP | Delete quotation |
| GET | `/api/flight-quotations/:id/events` | ERP | Audit events for quotation |
| PATCH | `/api/flight-quotations/:id/notes` | ERP | Update notes |
| PATCH | `/api/flight-quotations/:id/commission` | ERP | Update commission rate |
| POST | `/api/flight-quotations/:id/cancel` | ERP | Cancel quotation |
| POST | `/api/flight-quotations/:id/refund` | ERP | Record refund |
| POST | `/api/flight-quotations/:id/refund-pending` | ERP | Mark refund pending |
| POST | `/api/flight-quotations/:id/refund-request` | ERP | Submit refund request |
| POST | `/api/flight-quotations/:id/refund-approve` | ERP (mgmt/admin) | Approve refund |
| POST | `/api/flight-quotations/:id/refund-reject` | ERP (mgmt/admin) | Reject refund |
| POST | `/api/flight-quotations/:id/refund-pay` | ERP | Record refund payment |
| GET | `/api/bsp-report` | ERP (mgmt/admin) | BSP ticket sales report |
| GET | `/api/staff-ticket-log` | ERP | Staff ticket issuance log |

---

## Flights — Website Requests

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/public/flight-requests` | None | Submit public booking request |
| GET | `/api/public/flight-requests/:referenceNumber` | None | Check request status by reference |
| POST | `/api/public/flight-requests/:referenceNumber/payment-proof` | None | Upload payment proof |
| GET | `/api/flight-requests` | ERP | List all flight requests |
| GET | `/api/flight-requests/count` | ERP | Count of pending requests |
| GET | `/api/flight-requests/:id` | ERP | Flight request detail |
| PATCH | `/api/flight-requests/:id` | ERP | Update request (status, assignment) |
| POST | `/api/flight-requests/:id/issue-ticket` | ERP (can_issue_tickets + PIN) | Issue ticket for request |
| POST | `/api/flight-requests/:id/events` | ERP | Add audit event |

---

## Group Tickets

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/public/group-tickets` | None | Public list of available group tickets |
| GET | `/api/public/group-tickets/:id` | None | Group ticket detail |
| GET | `/api/group-tickets` | ERP | ERP list of group tickets |
| POST | `/api/group-tickets/sync` | ERP | Trigger WhatsApp group scrape |
| GET | `/api/group-tickets/status` | ERP | WhatsApp connection status |
| GET | `/api/group-tickets/qr` | ERP | WhatsApp QR code for linking |

---

## Transport

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/transport` | ERP | List transport bookings |
| POST | `/api/transport` | ERP | Create booking |
| GET | `/api/transport/:id` | ERP | Booking detail |
| PATCH | `/api/transport/:id` | ERP | Update booking |
| DELETE | `/api/transport/:id` | ERP | Delete booking |

---

## Visa

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/visa-applications` | ERP | List visa applications |
| POST | `/api/visa-applications` | ERP | Create application |
| GET | `/api/visa-applications/:id` | ERP | Application detail |
| PATCH | `/api/visa-applications/:id` | ERP | Update status/notes |
| DELETE | `/api/visa-applications/:id` | ERP | Delete application |

---

## Passenger Documents (OCR)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/passenger-documents` | ERP (ops/mgmt/admin) | List documents (filter by request/quotation) |
| POST | `/api/passenger-documents` | ERP (ops/mgmt/admin) | Create document record |
| POST | `/api/passenger-documents/:id/upload` | ERP (ops/mgmt/admin) | Upload file + run OCR |
| POST | `/api/passenger-documents/:id/scan` | ERP (ops/mgmt/admin) | Re-run OCR on existing image |
| POST | `/api/passenger-documents/:id/verify` | ERP (ops/mgmt/admin) | Verify/reject document |
| PATCH | `/api/passenger-documents/:id` | ERP (ops/mgmt/admin) | Manual correction (sets ocr_corrected=true) |
| DELETE | `/api/passenger-documents/:id` | ERP (mgmt/admin) | Delete document |

---

## Booking Inquiries (Portal Bookings)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/public/booking-inquiries` | None | Create inquiry + OCR passenger docs |
| POST | `/api/public/scan-document` | None | Real-time document OCR during booking |
| GET | `/api/public/booking-inquiries/mine` | Portal | Current user's inquiries + receipt status |
| POST | `/api/public/payment-receipts` | Portal (party only) | Upload payment receipt (ownership-checked) |
| GET | `/api/booking-inquiries` | ERP | List all inquiries |
| GET | `/api/booking-inquiries/:id` | ERP | Inquiry detail with passengers + tickets |
| PATCH | `/api/booking-inquiries/:id` | ERP | Update inquiry status |
| PATCH | `/api/payment-receipts/:id/verify` | ERP | Verify or reject payment receipt |

---

## Package Inquiries

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/public/package-inquiries` | None | Submit Umrah package enquiry |
| GET | `/api/package-inquiries` | ERP | List all package inquiries |
| GET | `/api/package-inquiries/count` | ERP | Count of pending inquiries |
| GET | `/api/package-inquiries/:id` | ERP | Inquiry detail |
| PATCH | `/api/package-inquiries/:id` | ERP | Update status / link quotation |

---

## WhatsApp

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/whatsapp/status` | ERP | Connection status |
| GET | `/api/whatsapp/qr` | ERP | QR code string for phone linking |
| POST | `/api/whatsapp/disconnect` | ERP (admin) | Logout and clear session |
| GET | `/api/whatsapp-groups/live` | ERP | Live groups the phone is in |
| GET | `/api/whatsapp-groups` | ERP | Monitored groups in DB |
| PUT | `/api/whatsapp-groups/:jid` | ERP | Add/update monitored group |
| DELETE | `/api/whatsapp-groups/:jid` | ERP | Remove monitored group |
| GET | `/api/whatsapp-inbox/groups` | ERP | Groups with unread counts + last message |
| GET | `/api/whatsapp-inbox/messages/:jid` | ERP | Paginated messages for group |
| POST | `/api/whatsapp-inbox/mark-read` | ERP | Mark group messages as read |
| GET | `/api/whatsapp-inbox/unread-count` | ERP | Total unread across all groups |
| GET | `/api/whatsapp-inbox/links/:jid` | ERP | Entity links for a group |
| POST | `/api/whatsapp-inbox/links` | ERP | Link group to ERP entity |
| DELETE | `/api/whatsapp-inbox/links/:id` | ERP | Remove entity link |
| POST | `/api/whatsapp-inbox/send` | ERP | Send text or media message |
| POST | `/api/whatsapp-inbox/backfill` | ERP | Import messages from local store to DB |
| POST | `/api/whatsapp-inbox/sync-group-names` | ERP | Sync group names from WhatsApp to DB |

---

## Bot Campaigns

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/bot/contacts` | ERP | Extract contacts from group participant lists |
| GET | `/api/bot/campaigns` | ERP | Last 20 campaign records |
| GET | `/api/bot/campaign/active` | ERP | Active campaign with progress stats |
| POST | `/api/bot/campaign` | ERP | Create campaign (text or media) |
| POST | `/api/bot/campaign/:id/start` | ERP | Start campaign (calculate send delay) |
| POST | `/api/bot/campaign/:id/pause` | ERP | Pause campaign |
| POST | `/api/bot/campaign/:id/resume` | ERP | Resume campaign |
| POST | `/api/bot/campaign/:id/stop` | ERP | Stop campaign permanently |

---

## Automations

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/automations` | ERP | List all automations with config + status |
| GET | `/api/automations/:type` | ERP | Single automation detail |
| PATCH | `/api/automations/:type` | ERP | Update enabled/cron/template |
| POST | `/api/automations/:type/run` | ERP | Trigger manual run |
| GET | `/api/automations/:type/logs` | ERP | Logs for automation type |
| GET | `/api/automation-logs` | ERP | All automation logs (paginated) |
| GET | `/api/automations-summary` | ERP | Dashboard summary of automation health |

---

## Media Library

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/media-library` | ERP | List media assets (type/search filter) |
| POST | `/api/media-library` | ERP | Register new upload |
| PUT | `/api/media-library/:id` | ERP | Replace media item |
| GET | `/api/media-library/:id/download-url` | ERP | Temporary signed download URL |
| DELETE | `/api/media-library/:id` | ERP | Delete asset + storage object |

---

## Storage

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/storage/uploads/request-url` | ERP / Portal | Get presigned upload URL → `{ uploadURL, objectPath }` |
| GET | `/api/storage/public-objects/*filePath` | None | Serve public storage file |
| GET | `/api/storage/objects/*path` | ERP | Serve private storage file |

---

## Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/operational` | ERP | Operational metrics (arrivals, check-ins, pending) |

---

## AI & OCR Settings

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/ai-settings/status` | ERP | OpenAI key status + model info |
| POST | `/api/ai-settings` | ERP (admin/mgmt) | Set OpenAI API key (session-only) |
| GET | `/api/ocr-settings` | ERP | OCR global settings |
| PATCH | `/api/ocr-settings` | ERP (admin/mgmt) | Update OCR settings |

---

## GDS & Local Airline Settings

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/gds-settings` | ERP | All GDS provider configs |
| GET | `/api/gds-settings/:provider` | ERP | Single provider config |
| PUT | `/api/gds-settings/:provider` | ERP (admin/mgmt) | Update GDS credentials |
| POST | `/api/gds-settings/:provider/test` | ERP (admin/mgmt) | Test GDS connection |
| GET | `/api/local-airline-settings` | ERP | Local airline settings (credentials masked) |
| PATCH | `/api/local-airline-settings/:code` | ERP (admin/mgmt) | Update airline settings |
| POST | `/api/local-airline-settings/:code/test` | ERP (admin/mgmt) | Test airline connection (stub) |

---

## Website Configuration

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/website-config` | None | Branding, contact info, announcement |
| PUT | `/api/website-config` | ERP (admin/mgmt) | Update config and WA templates |

---

## Portal Administration (ERP-side)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/portal/users` | ERP | List all portal users with clientId |
| GET | `/api/portal/users/:id` | ERP | Portal user detail + uploaded documents |
| PATCH | `/api/portal/users/:id/status` | ERP | Approve / reject / suspend portal user |
| PATCH | `/api/portal/users/:id` | ERP | Link portal user to ERP client (clientId) |
| POST | `/api/portal/users/:id/scan-doc/:docId` | ERP | Trigger OCR on portal user document |
| GET | `/api/inventory-sweep/status` | ERP | Inventory sweep service status |

---

## Customer Portal (Portal-auth required)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/portal/dashboard` | Portal | Dashboard summary: counts, balance, next flight |
| GET | `/api/portal/bookings` | Portal | Booking inquiries + receipt status |
| GET | `/api/portal/invoices` | Portal | ERP invoices for linked client |
| GET | `/api/portal/statement` | Portal | Ledger statement with running balance |
| GET | `/api/portal/hotel-vouchers` | Portal | Hotel vouchers for linked client |
| GET | `/api/portal/flight-tickets` | Portal | Issued flight tickets for linked client |
| GET | `/api/portal/visa-status` | Portal | Visa applications for linked client |
| GET | `/api/portal/transport` | Portal | Transport bookings for linked client |
| GET | `/api/portal/payments` | Portal | Payment receipt history |
| PATCH | `/api/portal/me` | Portal | Update portal user profile |
| POST | `/api/portal/change-password` | Portal | Change password (bcrypt-verified) |
