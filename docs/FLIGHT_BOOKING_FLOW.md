# Flight Booking Flow — Full Module Reference

The flight module has three parallel tracks that serve different purposes and follow different flows.

---

## Track A — Flight Requests (Public Inquiry → ERP Review)

A visitor or portal user submits a flight request from the public website. Agency staff review it in the ERP, set fares, and mark it issued.

```
Public Website (/frontend/flights → Custom Request tab)
    │
    │  POST /api/public/flight-requests
    ▼
flight_requests table (status: pending)
    │
    │  ERP staff open /flight-requests
    │  Assign to user, set actualFare + bookingFare
    │  status → reviewing → issued
    ▼
flight_request_events table (audit log)
    │
    │  status = issued → auto-post journal entry
    ▼
general_journal table
  debit:  AR-FLIGHT (Accounts Receivable — Flights, ASSET)
  credit: FLIGHT-REV (Flight Revenue, REVENUE)
  amount: bookingFare in PKR
```

### Status Values — `flight_requests`

| Status | Meaning |
|---|---|
| `pending` | Just submitted, awaiting staff attention |
| `reviewing` | Assigned to a staff member, being worked on |
| `issued` | Fare confirmed and ticket issued; journal entry auto-posted |
| `cancelled` | Request cancelled (by staff or client) |

---

## Track B — Flight Quotations (ERP-Created)

Staff create flight quotations directly in the ERP for known clients. These can be escalated to ticket issuance with a PIN.

```
ERP staff open /flights
    │
    │  POST /api/flight-quotations (status: draft)
    ▼
flight_quotations table
    │
    │  Staff confirm booking
    │  status → booked
    │
    │  Staff issue ticket (canIssueTickets = true + PIN match)
    │  POST /api/flights/issue-ticket
    │  status → ticketed, ticketNumber = TKT-<base36>-<rand4>
    ▼
flight_quotations table (ticketed)
```

### Status Values — `flight_quotations`

| Status | Meaning |
|---|---|
| `draft` | Quotation created, not yet confirmed |
| `booked` | Booking confirmed with airline; eligible for ticket issuance |
| `ticketed` | Ticket issued; `ticketNumber` and `issuedBy` set |

---

## Track C — Group Tickets (Seat Inventory + Public Booking)

Agency sources bulk group seats (often via WhatsApp from airlines). These are listed publicly for direct booking.

```
WhatsApp message or manual entry
    │
    │  POST /api/group-tickets/sync (scrapes monitored WA groups)
    ▼
group_tickets table
    │
    │  Public Website /frontend/flights → Group Tickets tab
    │  GET /api/public/group-tickets
    │  Visitor clicks Book → /frontend/book-flight/:id
    │
    │  POST /api/public/booking-inquiries
    ▼
public_booking_inquiries + public_booking_passengers tables
    │   (for Party portal users: payment_receipts row created with deadline)
    │
    │  ERP /booking-inquiries — staff review & confirm
    │  PATCH /api/booking-inquiries/:id
    ▼
Portal user uploads receipt
    │  POST /api/public/payment-receipts
    │  PATCH /api/payment-receipts/:id/verify (ERP verifies)
    ▼
booking confirmed
```

---

## Database Tables

### `flight_quotations`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `client_id` | integer | → `clients.id` |
| `trip_type` | text | `one_way` / `round_trip` / `multi_city` |
| `origin` | text | IATA code |
| `destination` | text | IATA code |
| `departure_date` | timestamp | |
| `return_date` | timestamp | null for one-way |
| `legs` | text | multi-city leg descriptions |
| `passengers` | integer | default 1 |
| `cabin_class` | text | `economy` / `business` / `first` |
| `airline` | text | |
| `flight_number` | text | |
| `status` | text | `draft` / `booked` / `ticketed` |
| `amount` | numeric(12,2) | Total price |
| `currency` | text | default `USD` |
| `ticket_number` | text | `TKT-*`; set on issuance |
| `issued_by` | integer | → `users.id` |
| `issued_at` | timestamp | |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `flight_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `request_number` | text UNIQUE | e.g. `FR-20250627-1234` |
| `request_type` | text | `direct` / `group` |
| `source` | text | `website` / `portal` |
| `client_name` | text | |
| `client_email` | text | |
| `client_phone` | text | |
| `client_whatsapp` | text | |
| `trip_type` | text | `one_way` / `round_trip` |
| `origin` | text | |
| `destination` | text | |
| `departure_date` | text | ISO date string |
| `return_date` | text | |
| `passenger_count` | integer | |
| `cabin_class` | text | |
| `airline` | text | optional; from GDS search result |
| `fare` | text | raw fare string from GDS |
| `actual_fare` | numeric(12,2) | net cost to agency (PKR) |
| `booking_fare` | numeric(12,2) | customer-facing price (PKR) |
| `flight_data_json` | jsonb | full GDS response snapshot |
| `status` | text | `pending` / `reviewing` / `issued` / `cancelled` |
| `assigned_to` | integer | → `users.id` |
| `admin_notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `flight_request_events`

Audit log for every status change or action on a flight request.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `request_id` | integer | → `flight_requests.id` |
| `user_id` | integer | → `users.id`; null for system events |
| `user_name` | text | denormalised for display |
| `action` | text | e.g. `created`, `status_changed`, `issued`, `updated` |
| `metadata` | jsonb | action-specific payload |
| `created_at` | timestamp | |

### `gds_settings`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `provider` | text | `amadeus` / `sabre` / `galileo` |
| `client_id` | text | OAuth client ID (Amadeus) or username (Sabre) |
| `client_secret` | text | OAuth secret or password |
| `username` | text | Galileo/Travelport username |
| `password` | text | Galileo/Travelport password |
| `pcc` | text | Sabre PCC / Galileo XAUTH group |
| `iata_code` | text | agency IATA code |
| `environment` | text | `test` / `production` |
| `is_active` | boolean | false → `mockFlights()` used as fallback |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

## Backend Routes

### `flights.ts` — ERP Flight Quotations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/flight-quotations` | ERP | List all quotations; filterable by clientId, status, fromDate |
| POST | `/api/flight-quotations` | ERP | Create quotation (status defaults to draft) |
| GET | `/api/flight-quotations/:id` | ERP | Get single quotation with client name |
| PATCH | `/api/flight-quotations/:id` | ERP | Update status, airline, flightNumber, amount, notes |
| DELETE | `/api/flight-quotations/:id` | ERP | Delete quotation |

### `flight-search.ts` — Search, Issue, Currency

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/currency/rates` | Public | Live forex rates scraped from forex.pk (1h in-memory cache) |
| POST | `/api/flights/search` | Public | Search via GDS adapters or mock fallback; supports one-way, round-trip, multi-city |
| POST | `/api/flights/issue-ticket` | ERP + canIssueTickets + PIN | Issue ticket; verifies PIN, sets status → ticketed, generates TKT-* number |

### `flight-requests.ts` — Public Requests & ERP Review

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/flight-requests` | Public | Submit flight request; auto-derives actualFare + bookingFare from fare + requestType |
| GET | `/api/flight-requests/count` | ERP | Count of pending requests (for ERP nav badge) |
| GET | `/api/flight-requests` | ERP | List all requests; filterable by status, dates, airline, origin, destination, search |
| GET | `/api/flight-requests/:id` | ERP | Get single request with events array |
| PATCH | `/api/flight-requests/:id` | ERP | Update status, assignedTo, adminNotes, actualFare, bookingFare; posts journal entry on issued |
| POST | `/api/flight-requests/:id/events` | ERP | Append manual audit event |
| GET | `/api/users/assignable` | ERP | List all staff for assignment dropdown |

---

## Frontend Pages

### Public Website (`artifacts/frontend`)

| Path | Purpose |
|---|---|
| `/frontend/flights` | Two tabs: **Group Tickets** (seat inventory list + Book button) and **Custom Request** (freeform flight request form). GDS search is triggered from here. |
| `/frontend/book-flight/:id` | Booking page for a specific group ticket; collects passenger details, supports optional passport upload + OCR, submits to `POST /api/public/booking-inquiries` |

### ERP (`artifacts/umrah-erp`)

| Path | Purpose |
|---|---|
| `/flights` | Flight quotation CRUD; create/edit/issue quotations for known clients |
| `/flight-requests` | Review inbound flight requests; assign staff, set fares, change status |
| `/booking-inquiries` | Group ticket booking inquiries; confirm/cancel, view passenger details and payment receipts |
| `/gds-settings` | Configure Amadeus / Sabre / Galileo credentials; toggle active/inactive |

---

## Fare Logic

### Direct Flight Request (`requestType: "direct"`)

The `fare` value sent by the frontend is the **net cost** to the agency.

```
actualFare  = fare            (net cost to agency in PKR)
bookingFare = fare + PKR 2,000   (customer-facing price)
```

### Group Ticket Booking (`requestType: "group"`)

The `fare` value already includes the PKR 2,000 markup (fare is displayed to customer).

```
bookingFare = fare            (customer-facing, already includes markup)
actualFare  = fare - PKR 2,000   (net cost to agency)
```

### Journal Entry on Issue (auto-posted)

When a flight request is PATCH'd to `status = "issued"`, the server auto-posts:

- **Debit**: `AR-FLIGHT` — Accounts Receivable — Flights (ASSET)
- **Credit**: `FLIGHT-REV` — Flight Revenue (REVENUE)
- **Amount**: `bookingFare` in PKR
- **entryNumber**: `JE-FL-<year>-<seq>`
- **sourceType**: `flight_request`, **sourceId**: request id

Both accounts are auto-created if they don't exist in `chart_of_accounts`.

---

## GDS Adapters

| Provider | Auth Method | Sandbox URL | Production URL |
|---|---|---|---|
| Amadeus | OAuth2 (clientId + clientSecret) | `test.api.amadeus.com` via `amadeus` npm | `api.amadeus.com` |
| Sabre | OAuth2 token exchange (clientId:clientSecret → Basic Auth) | `api.cert.sabre.com` | `api.sabre.com` |
| Galileo / Travelport | HTTP Basic Auth (username:password) + XAUTH group header | `americas.universal-api.pp.travelport.com` | `americas.universal-api.travelport.com` |

**Mock fallback**: `mockFlights()` is used whenever `isActive = false` OR `clientId` is blank for the matching provider. All three adapters currently default to mock. If a live GDS call fails at runtime, it also falls back to mock (non-fatal, logged as WARN).

---

## Currency

- `GET /api/currency/rates` parses open-market rates from `forex.pk`, converts all currencies to a USD base using mid-rate `(buying + selling) / 2`.
- Results are cached for 1 hour in a module-level variable.
- If the scrape fails or returns fewer than 5 currencies, hardcoded fallback rates are merged in. No error is surfaced to the caller.

---

## Ticket Issuance Guard

`POST /api/flights/issue-ticket` enforces three conditions:

1. User's `role` is NOT `accounts` (accounts dept is blocked)
2. `user.canIssueTickets === true` (per-user flag set in `/users`)
3. `req.body.pin` matches `user.ticketingPin` exactly

The booking must also be in `booked` status (not `draft` or already `ticketed`).

On success:
- `status` → `ticketed`
- `ticketNumber` = `TKT-<timestamp_base36>-<random4>`
- `issuedBy` + `issuedAt` set

---

## Known Stubs / Unfinished Areas

| Area | Status |
|---|---|
| GDS live credentials | Not wired to production — mock is the default for all three providers |
| Group booking seat deduction | `seats` column in `group_tickets` is NOT decremented when a booking inquiry is confirmed |
| Email / SMS confirmation | No outbound notification on flight request submission |
| `book-flight.tsx` submission target | Submits to `POST /api/public/booking-inquiries` (group-ticket flow), **not** `POST /api/public/flight-requests` — these are two separate inquiry flows not yet unified |
| Payment receipt deadline enforcement | Deadline is calculated and stored; portal user upload is blocked after deadline; but no automated reminder or ERP escalation when deadline expires |
