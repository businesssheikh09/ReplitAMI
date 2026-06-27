# API Roadmap

Base path: `/api` (all routes are prefixed with `/api` via the shared proxy).

---

## Authentication Methods

### ERP Staff Auth

1. `POST /api/auth/login` — submit `{ email, password }` → receive `{ token, user }`.
2. Store token client-side (localStorage / React context).
3. Send `Authorization: Bearer <token>` on every subsequent request.
4. Verified server-side by `requireAuth` middleware which reads `users.sessionToken`.

### Portal User Auth

1. `POST /api/portal/login` — submit `{ emailOrPhone, password }` → receive `{ token, user }`.
2. Store token client-side.
3. Send `Authorization: Bearer <token>` on every portal-auth-required request.
4. Verified server-side by `requirePortalAuth` middleware which reads `portal_users.portalSessionToken`.

### Public Routes

No authentication required. Available to any caller.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | Port the API server binds to (injected by workflow) |
| `BASE_PATH` | Yes | URL base path (injected by workflow, e.g. `/api`) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Optional | Enables OCR/document scanning via OpenAI Vision |
| `OBJECT_STORAGE_*` | Optional | Replit Object Storage credentials for passport/document uploads |

---

## Route Reference

### `health.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness check — returns `{ status: "ok" }` |

---

### `auth.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Staff login; returns session token |
| POST | `/api/auth/logout` | ERP | Clears session token |
| GET | `/api/auth/me` | ERP | Returns current authenticated user |

---

### `users.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/users` | ERP | List all staff users |
| POST | `/api/users` | ERP | Create user |
| PATCH | `/api/users/:id` | ERP | Update user (role, permissions, PIN) |
| DELETE | `/api/users/:id` | ERP | Delete user |

---

### `clients.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/clients` | ERP | List clients |
| POST | `/api/clients` | ERP | Create client |
| GET | `/api/clients/:id` | ERP | Get client detail |
| PATCH | `/api/clients/:id` | ERP | Update client |
| DELETE | `/api/clients/:id` | ERP | Delete client |
| GET | `/api/clients/:id/notes` | ERP | List notes for client |
| POST | `/api/clients/:id/notes` | ERP | Add note to client |
| GET | `/api/follow-ups` | ERP | List follow-ups |
| POST | `/api/follow-ups` | ERP | Create follow-up |
| PATCH | `/api/follow-ups/:id` | ERP | Update follow-up |
| DELETE | `/api/follow-ups/:id` | ERP | Delete follow-up |

---

### `hotels.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/hotels` | ERP | List hotels |
| POST | `/api/hotels` | ERP | Create hotel |
| PATCH | `/api/hotels/:id` | ERP | Update hotel |
| DELETE | `/api/hotels/:id` | ERP | Delete hotel |
| GET | `/api/vendors` | ERP | List vendors |
| POST | `/api/vendors` | ERP | Create vendor |
| PATCH | `/api/vendors/:id` | ERP | Update vendor |
| DELETE | `/api/vendors/:id` | ERP | Delete vendor |
| GET | `/api/hotel-requests` | ERP | List hotel requests |
| POST | `/api/hotel-requests` | ERP | Create hotel request |
| PATCH | `/api/hotel-requests/:id` | ERP | Update hotel request |
| GET | `/api/vendor-quotes` | ERP | List vendor quotes |
| POST | `/api/vendor-quotes` | ERP | Create vendor quote |
| PATCH | `/api/vendor-quotes/:id` | ERP | Update vendor quote |

---

### `hotel-invoices.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/hotel-invoices` | ERP | List hotel invoices |
| POST | `/api/hotel-invoices` | ERP | Create hotel invoice |
| GET | `/api/hotel-invoices/:id` | ERP | Get single invoice |
| PATCH | `/api/hotel-invoices/:id` | ERP | Update invoice |
| DELETE | `/api/hotel-invoices/:id` | ERP | Delete invoice |
| PATCH | `/api/hotel-invoices/:id/accept` | ERP | Accept invoice (status → accepted) |
| GET | `/api/hotel-invoices/next-dn` | ERP | Get next DN number in sequence |

---

### `flights.ts` — ERP Flight Quotations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/flight-quotations` | ERP | List flight quotations; filterable by clientId, status, fromDate |
| POST | `/api/flight-quotations` | ERP | Create quotation (status defaults to draft) |
| GET | `/api/flight-quotations/:id` | ERP | Get single quotation with client name |
| PATCH | `/api/flight-quotations/:id` | ERP | Update status, airline, flightNumber, amount, notes |
| DELETE | `/api/flight-quotations/:id` | ERP | Delete quotation |

---

### `flight-search.ts` — Search, Issue, Currency

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/currency/rates` | Public | Live forex rates (forex.pk scraper, 1h in-memory cache; fallback to hardcoded rates) |
| POST | `/api/flights/search` | Public | Search flights via GDS adapters (Amadeus/Sabre/Galileo) or mock fallback |
| POST | `/api/flights/issue-ticket` | ERP + canIssueTickets + PIN | Issue ticket; verifies PIN against user record, sets quotation status → ticketed |

---

### `flight-requests.ts` — Public Requests & ERP Review

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/flight-requests` | Public | Submit flight request from website; auto-derives actualFare/bookingFare |
| GET | `/api/flight-requests/count` | ERP | Count of requests with status=pending (for nav badge) |
| GET | `/api/flight-requests` | ERP | List all requests; filterable by status, dateFrom, dateTo, airline, origin, destination, search |
| GET | `/api/flight-requests/:id` | ERP | Get single request including events array |
| PATCH | `/api/flight-requests/:id` | ERP | Update status, assignedTo, adminNotes, actualFare, bookingFare; auto-posts journal entry on status=issued |
| POST | `/api/flight-requests/:id/events` | ERP | Append manual audit event |
| GET | `/api/users/assignable` | ERP | List all staff users for assignment dropdown |

---

### `gds-settings.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/gds-settings` | ERP | List GDS configurations |
| POST | `/api/gds-settings` | ERP | Create GDS config |
| PATCH | `/api/gds-settings/:id` | ERP | Update GDS config (credentials, isActive, environment) |
| DELETE | `/api/gds-settings/:id` | ERP | Delete GDS config |

---

### `group-tickets.ts`

Note: this file also contains `POST /api/whatsapp/logout` (see WhatsApp section).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/public/group-tickets` | Public | List group tickets with `flightDate >= today`; used by public website |
| GET | `/api/public/group-tickets/:id` | Public | Get single group ticket by id |
| GET | `/api/group-tickets` | ERP | List all group tickets (all dates); filterable by origin, destination, date, fromDate |
| POST | `/api/group-tickets/sync` | ERP (management) | Trigger scrape/sync from monitored WhatsApp groups |
| GET | `/api/group-tickets/status` | ERP | Get WhatsApp connection status (used to show sync readiness) |
| GET | `/api/group-tickets/qr` | ERP | Get current QR code string for WhatsApp linking; 404 if none pending |

---

### `booking-inquiries.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/booking-inquiries` | Public (optional portal token in body) | Submit group ticket booking with passenger list; auto-creates payment receipt for Party users |
| POST | `/api/public/scan-document` | Public | OCR a document by objectKey; returns parsed passport fields |
| GET | `/api/public/booking-inquiries/mine` | Portal | List authenticated portal user's bookings with payment receipt |
| POST | `/api/public/payment-receipts` | Portal (Party only) | Upload payment receipt for a booking; validates deadline not passed |
| GET | `/api/booking-inquiries` | ERP | List all booking inquiries |
| GET | `/api/booking-inquiries/:id` | ERP | Get single inquiry with passengers, ticket, and payment receipt |
| PATCH | `/api/booking-inquiries/:id` | ERP | Update status and/or notes |
| PATCH | `/api/payment-receipts/:id/verify` | ERP | Verify or reject a payment receipt; records verifiedBy + verifiedAt |

---

### `package-inquiries.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/package-inquiries` | Public | Submit package inquiry from website |
| GET | `/api/package-inquiries` | ERP | List package inquiries |
| GET | `/api/package-inquiries/:id` | ERP | Get single inquiry |
| PATCH | `/api/package-inquiries/:id` | ERP | Update status, link quotationId, etc. |

---

### `portal.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/portal/register` | Public | Register new portal user (type: party or dc); accepts documentKeys array for file uploads |
| POST | `/api/portal/login` | Public | Portal user login with emailOrPhone + password; returns session token |
| POST | `/api/portal/logout` | Portal | Clears portal session token |
| GET | `/api/portal/me` | Portal | Get current portal user profile (requires valid token) |
| GET | `/api/portal/users` | ERP | List portal users; filterable by type and status |
| GET | `/api/portal/users/:id` | ERP | Get single portal user with their uploaded documents |
| PATCH | `/api/portal/users/:id/status` | ERP | Update portal user status and optional rejectionReason |
| POST | `/api/portal/users/:id/scan-doc/:docId` | ERP | Run OCR on a portal user's uploaded document; updates scan fields |
| GET | `/api/inventory-sweep/status` | ERP | Get current inventory sweep (group-ticket scraper) status |

---

### `quotations.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/quotations` | ERP | List quotations |
| POST | `/api/quotations` | ERP | Create quotation |
| GET | `/api/quotations/:id` | ERP | Get quotation with line items |
| PATCH | `/api/quotations/:id` | ERP | Update quotation |
| DELETE | `/api/quotations/:id` | ERP | Delete quotation |
| POST | `/api/quotations/:id/items` | ERP | Add line item |
| PATCH | `/api/quotations/:id/items/:itemId` | ERP | Update line item |
| DELETE | `/api/quotations/:id/items/:itemId` | ERP | Delete line item |

---

### `transport.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/transport-bookings` | ERP | List transport bookings |
| POST | `/api/transport-bookings` | ERP | Create booking |
| PATCH | `/api/transport-bookings/:id` | ERP | Update booking |
| DELETE | `/api/transport-bookings/:id` | ERP | Delete booking |

---

### `visa.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/visa-applications` | ERP | List visa applications |
| POST | `/api/visa-applications` | ERP | Create application |
| PATCH | `/api/visa-applications/:id` | ERP | Update application / status |
| DELETE | `/api/visa-applications/:id` | ERP | Delete application |

---

### `accounting.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/accounting/summary` | ERP | Revenue/expense summary totals |
| GET | `/api/chart-of-accounts` | ERP | List chart of accounts |
| POST | `/api/chart-of-accounts` | ERP | Create account |
| GET | `/api/general-journal` | ERP | List journal entries |
| POST | `/api/general-journal` | ERP | Create journal entry |
| GET | `/api/invoices` | ERP | List invoices |
| POST | `/api/invoices` | ERP | Create invoice |
| PATCH | `/api/invoices/:id` | ERP | Update invoice |
| POST | `/api/payments` | ERP | Record payment for invoice |
| GET | `/api/expenses` | ERP | List expenses |
| POST | `/api/expenses` | ERP | Create expense |
| PATCH | `/api/expenses/:id` | ERP | Update expense |

---

### `dashboard.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/dashboard/stats` | ERP | Summary counts and totals |
| GET | `/api/dashboard/revenue-chart` | ERP | Revenue data for chart |
| GET | `/api/dashboard/recent-activity` | ERP | Recent activity log |

---

### `currency-settings.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/currency-settings` | ERP | Get global currency settings |
| PUT | `/api/currency-settings` | ERP | Update settings |
| GET | `/api/currency-daily-rates` | ERP | List daily rates |
| POST | `/api/currency-daily-rates` | ERP | Create/update daily rate |
| GET | `/api/currency-transactions` | ERP | List currency transactions |
| POST | `/api/currency-transactions` | ERP | Record transaction |

---

### `website-config.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/website-config` | Public | Read website config key-value pairs |
| PUT | `/api/website-config` | ERP | Update config values |

---

### `whatsapp.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/whatsapp/status` | ERP (management) | Connection status — `{ status, connected, connecting }` |
| GET | `/api/whatsapp/qr` | ERP (management) | Latest QR code string for scanning; 404 when no QR pending |
| POST | `/api/whatsapp/disconnect` | ERP (management) | Disconnect and clear WhatsApp session |

Also in `group-tickets.ts`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/whatsapp/logout` | ERP (management) | Alias disconnect: logs out active session |

---

### `whatsapp-groups.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/whatsapp/groups` | ERP | List monitored groups (ticket-scraping targets) |
| POST | `/api/whatsapp/groups` | ERP | Add group to monitoring list |
| PATCH | `/api/whatsapp/groups/:id` | ERP | Update group (enable/disable) |

---

### `whatsapp-inbox.ts`

All routes require ERP auth with management role.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/whatsapp-inbox/groups` | ERP (management) | List inbox groups matching business keywords, with unread counts and last message preview |
| GET | `/api/whatsapp-inbox/messages/:jid` | ERP (management) | Paginated messages for a group (query: page, limit) |
| POST | `/api/whatsapp-inbox/mark-read` | ERP (management) | Mark all messages in a group as read; body: `{ groupJid }` |
| GET | `/api/whatsapp-inbox/unread-count` | ERP (management) | Total unread count across all keyword-matching groups (for nav badge) |
| GET | `/api/whatsapp-inbox/links/:jid` | ERP (management) | All entity links for a group JID |
| POST | `/api/whatsapp-inbox/links` | ERP (management) | Create entity link; body: `{ groupJid, entityType, entityId }` |
| DELETE | `/api/whatsapp-inbox/links/:id` | ERP (management) | Delete entity link by link id |
| POST | `/api/whatsapp-inbox/send` | ERP (management) | Send message to a group; body: `{ jid, text, quote? }` |
| POST | `/api/whatsapp-inbox/backfill` | ERP (management) | Import messages from local JSON store into DB; idempotent |
| POST | `/api/whatsapp-inbox/sync-group-names` | ERP (management) | Pull group subjects from WhatsApp and upsert into `whatsapp_group_names` |

---

### `bot.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/bot/campaigns` | ERP | List campaigns |
| POST | `/api/bot/campaigns` | ERP | Create campaign |
| PATCH | `/api/bot/campaigns/:id` | ERP | Update campaign |
| DELETE | `/api/bot/campaigns/:id` | ERP | Delete campaign |
| POST | `/api/bot/start` | ERP | Start a campaign |
| POST | `/api/bot/stop` | ERP | Stop / pause a campaign |

---

### `storage.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/storage/uploads/request-url` | Public | Get pre-signed upload URL for Replit Object Storage |
| GET | `/api/storage/uploads/:key` | ERP (or portal) | Get signed read URL for an uploaded file |

---

### `ai-settings.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/ai-settings` | ERP | Returns whether `AI_INTEGRATIONS_OPENAI_API_KEY` is set (never returns the key value) |
| POST | `/api/ai-settings` | ERP | Store API key in `process.env` (in-memory, session-scoped) |

---

## Planned Routes (Not Yet Built)

These routes are planned in upcoming tasks and do not exist yet.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/accounting/reports/party` | ERP | Party ledger report |
| GET | `/api/accounting/reports/vendor` | ERP | Vendor ledger report |
| GET | `/api/accounting/reports/flight` | ERP | Flight revenue report |

---

## Integration & Sandbox Status

| Integration | Status | Notes |
|---|---|---|
| Amadeus GDS | Sandbox | `test` env via `amadeus` npm; switch `environment` to `production` in `gds_settings` when live creds available |
| Sabre GDS | Sandbox | Endpoint: `api.cert.sabre.com`; production: `api.sabre.com`; uses OAuth2 token exchange |
| Galileo / Travelport | Sandbox | Endpoint: `americas.universal-api.pp.travelport.com`; production: `americas.universal-api.travelport.com` |
| All GDS adapters | **Mock by default** | `mockFlights()` used when `isActive = false` OR `clientId` is blank for that provider |
| forex.pk currency scraper | Live | Parses open market rates; falls back to hardcoded rates on parse failure or network error |
| OpenAI Vision (OCR) | Live when key set | Stub (returns empty fields) when `AI_INTEGRATIONS_OPENAI_API_KEY` is absent |
| WhatsApp (Baileys) | Live after QR scan | All WA features non-functional until a phone is linked; session persisted in `whatsapp-session/` |
| Replit Object Storage | Live | Used for passport and document file uploads via pre-signed URLs |
