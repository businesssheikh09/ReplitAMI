# Flights

**Purpose**: End-to-end flight operations — live GDS search, group ticket inventory, booking request management, ticket issuance, and a full refund workflow.  
**Backend routes**:
- `artifacts/api-server/src/routes/flights.ts` — quotation + refund lifecycle
- `artifacts/api-server/src/routes/flight-requests.ts` — website booking requests
- `artifacts/api-server/src/routes/flight-search.ts` — live GDS search + ticket issuance
- `artifacts/api-server/src/routes/group-tickets.ts` — group ticket inventory
- `artifacts/api-server/src/routes/gds-settings.ts` — GDS credential management
- `artifacts/api-server/src/routes/local-airline-settings.ts` — local carrier config
**Frontend (ERP)**: `/flights` page in `artifacts/umrah-erp`  
**Frontend (public)**: `/flights`, `/book-flight/:id`, `/book-gds` in `artifacts/frontend`  

---

## Architecture

```
Customer (website)
  ├── Group Ticket booking → /book-flight/:id
  │     → POST /api/public/booking-inquiries (creates inquiry)
  │     → OCR on passport images (real-time)
  │
  └── Live GDS booking → /book-gds
        → POST /api/flights/search (multi-GDS aggregation)
        → POST /api/public/flight-requests (seat hold)
        → POST /api/public/flight-requests/:ref/payment-proof

ERP Staff
  ├── Review requests → /flight-requests
  │     → PATCH /api/flight-requests/:id (assign, status)
  │     → POST /api/flight-requests/:id/issue-ticket (PIN-protected)
  │
  ├── Direct quotations → /flights
  │     → POST /api/flight-quotations
  │     → PATCH /api/flight-quotations/:id/commission
  │
  └── Refund workflow → /cancellations-refunds
        → POST /api/flight-quotations/:id/refund-request
        → POST /api/flight-quotations/:id/refund-approve
        → POST /api/flight-quotations/:id/refund-pay
```

---

## Group Tickets

Group tickets are pre-purchased seats scraped from WhatsApp groups.

### Inventory Scraping

1. `scheduler.ts` fires daily at 13:00
2. Queries `whatsapp_monitored_groups` for enabled groups
3. Fetches messages from the last 24 hours via `whatsapp.ts`
4. Passes raw text through `groupTicketParser.ts` (regex-based)
5. Extracts: airline code, flight number, date, origin, destination, seats, fare, departure/arrival time
6. Upserts into `group_tickets` (unique on airline + flight + date + route)
7. ERP staff can also trigger manually: `POST /api/group-tickets/sync`

### `groupTicketParser.ts`
Regex patterns extract:
- Airline codes (PK, PA, FZ, EK, etc.)
- Flight numbers
- Date strings (multiple formats)
- Fare amounts in PKR
- IATA city/airport codes

### Public Availability
`GET /api/public/group-tickets` — returns active inventory with seats > 0  
`GET /api/public/group-tickets/:id` — detail for booking form  

### ERP Controls
`GET /api/group-tickets` — full list including sold-out  
`POST /api/group-tickets/sync` — manual scrape trigger  
`GET /api/group-tickets/status` — WhatsApp connection health  
`GET /api/group-tickets/qr` — QR code if WhatsApp is not linked  

---

## GDS Live Search

Live flight search aggregates results from up to 3 GDS providers.

### Supported GDS Providers

| Provider | SDK | Search Method |
|---|---|---|
| Amadeus | `amadeus` npm package | `shopping.flightOffersSearch.get()` |
| Sabre | Direct REST API | `/v1/shop/flights` |
| Galileo | Travelport Universal API | SOAP/REST |

### Search Flow (`POST /api/flights/search`)
1. Reads enabled GDS providers from `gds_settings`
2. Fires parallel searches across all enabled providers
3. Normalises results into a common format (airline, flight number, fare, cabin class, stops)
4. Applies markup (configurable percentage) before returning
5. Returns aggregated list sorted by price

### Currency
`GET /api/currency/rates` — scrapes **forex.pk** in real-time to provide current PKR exchange rates.  
Used by the `/book-gds` page to display fares in PKR.

### Seat Hold
`POST /api/public/flight-requests` with `request_type: 'direct'`:
- Creates `flight_requests` record with `status: 'on_hold'`
- Sets `hold_expires_at = now() + 2 hours`
- `hold-expiry.ts` (runs every 5 minutes) expires holds past their time

### GDS Configuration
`GET /api/gds-settings` — list all providers  
`PUT /api/gds-settings/:provider { clientId, clientSecret, environment, pcc, isEnabled }` — update credentials  
`POST /api/gds-settings/:provider/test` — test connectivity  

Environment options: `test` (sandbox) / `production` (live)

---

## Flight Requests (Website Bookings)

Website-submitted booking requests processed by ERP staff.

### Request Number Format
`FR-YYYYMMDD-XXXX` — date-based sequential number.

### Request Statuses

| Status | Description |
|---|---|
| `pending` | Just submitted, unassigned |
| `on_hold` | GDS seat hold active (2-hour window) |
| `expired` | Hold time elapsed (auto-set by hold-expiry.ts) |
| `payment_pending` | Customer asked to pay |
| `ready_to_issue` | Payment verified, ready for ticketing |
| `issued` | Ticket issued |
| `cancelled` | Request cancelled |

### ERP Actions
- **Assign**: `PATCH /api/flight-requests/:id { assignedTo }` → sets staff member
- **Status update**: `PATCH /api/flight-requests/:id { status }` → move through workflow
- **Issue ticket**: `POST /api/flight-requests/:id/issue-ticket` — PIN-protected; requires `can_issue_tickets = true` on user
- **Add event**: `POST /api/flight-requests/:id/events` — audit comment
- **Payment proof**: `POST /api/public/flight-requests/:referenceNumber/payment-proof` — customer uploads proof

### PIN-Protected Ticket Issuance
1. Staff member must have `can_issue_tickets = true` on their user record
2. Request must be `status = 'ready_to_issue'`
3. Staff enters their `ticketing_pin`
4. API validates PIN (hashed comparison)
5. On success: creates `flight_quotations` record with `status = 'issued'`, posts `postFlightIssued` journal entry

---

## Flight Quotations (ERP-Direct Tickets)

Staff can create flight quotations directly (without going through the website request flow).

### Quotation Number Format
None defined — uses `id` as reference.

### Ticket Number Format
`TKT-{timestamp}` or GDS-provided ticket number.

### Quotation Statuses
`draft` → `confirmed` → `issued` → (`cancelled` | `refunded`)

### Refund Workflow (4-Step)

```
refund-request  →  refund-approve  →  refund-pay
                                            ↓
                                     postFlightRefund()
                                     (DR PARTY / CR MSFR)
```

| Endpoint | Action | Who |
|---|---|---|
| `POST /api/flight-quotations/:id/refund-pending` | Mark refund pending | Any ERP |
| `POST /api/flight-quotations/:id/refund-request` | Submit refund request | Any ERP |
| `POST /api/flight-quotations/:id/refund-approve` | Approve refund | Management/Admin |
| `POST /api/flight-quotations/:id/refund-reject` | Reject refund | Management/Admin |
| `POST /api/flight-quotations/:id/refund-pay` | Record refund payment | Accounts/Mgmt |

### Commission Tracking
`PATCH /api/flight-quotations/:id/commission { commissionRate }` — records airline commission percentage.  
BSP Report aggregates all commissions: `GET /api/bsp-report`.

---

## BSP Report

`GET /api/bsp-report` — Billing Settlement Plan report for airline payments.  
**Columns**: Ticket number, airline, route, departure date, passenger count, fare, commission rate, net payable, issued by, issued date.  
**Permissions**: Management / Admin only.

---

## Staff Ticket Log

`GET /api/staff-ticket-log` — history of all ticket issuances.  
**Columns**: Staff name, ticket number, client, route, date, fare.  
**Permissions**: All ERP roles.

---

## Local Airline Settings

For local / LCC carriers (PIA, Airblue, AirSial, FlyDubai) that do not use standard GDS:
- Seeded with default carrier list
- `PATCH /api/local-airline-settings/:code` — enable/configure
- `POST /api/local-airline-settings/:code/test` — connectivity test (currently stub, returns "coming soon")
- Credentials are masked for non-admin ERP users

---

## Automation Integration

`flight-reminder.ts` automation (hourly):
- Finds confirmed flight requests departing **tomorrow**
- Sends WhatsApp message with PNR and flight details to customer
- Template from `website_config.wa_templates.flightReminder`
- Duplicate-checked per day via `automation-engine.ts`

---

## Database Tables

| Table | Purpose |
|---|---|
| `flight_quotations` | ERP-created and website-originated tickets |
| `flight_ticket_events` | Audit trail for quotation status changes |
| `flight_requests` | Public website booking requests |
| `flight_request_events` | Audit trail for request status changes |
| `group_tickets` | Group inventory from WhatsApp scraper |
| `gds_settings` | GDS provider credentials |
| `local_airline_settings` | Local carrier configuration |

---

## Permissions

| Action | Required Role/Permission |
|---|---|
| View flight quotations | All ERP roles |
| Create quotation | Sales, Operations, Management, Admin |
| Issue ticket | `can_issue_tickets = true` + valid PIN |
| Approve refund | Management, Admin |
| View BSP report | Management, Admin |
| View GDS settings | All ERP |
| Update GDS settings | Management, Admin |

---

## Known Limitations

- Sabre and Galileo GDS adapters require valid account credentials; the stub adapter is the fallback if none are configured.
- The Amadeus type definitions are hand-authored (`types/amadeus.d.ts`) since the package does not ship official TypeScript types.
- Group ticket scraping is entirely dependent on WhatsApp message format consistency; format changes in source messages can cause parse failures.
- Hold expiry uses a polling mechanism (5-minute interval) — actual expiry can be up to 5 minutes late.
- Local airline integrations (`POST .../test`) are stubbed; no live connectivity testing is implemented.
- Payment deadline calculation uses the flight departure time from `flightDataJson`; if that field is missing, the fallback is 24 hours.

---

## Future Extension Points

- Real-time inventory updates from GDS via webhooks
- Fare comparison across all GDS in a unified results view
- Automated PNR confirmation emails to customers
- Seat selection and ancillary services (baggage, meals)
- Real-time payment deadline countdown (WebSocket / SSE)
- Live airline ticket API integrations for PIA and Airblue
