# Customer Portal Modules

**Purpose**: Self-service portal for approved customers to track bookings, view invoices, manage documents, and upload payment receipts without contacting staff.  
**Routes**: `/portal/*` in `artifacts/frontend`  
**API prefix**: `/api/portal/*` and `/api/public/*`  
**Backend**: `artifacts/api-server/src/routes/portal.ts` (registration/admin) + `portal-customer.ts` (customer endpoints)  
**Auth middleware**: `src/middlewares/portal-auth.ts`  

---

## User Types

| Type | Code | Description |
|---|---|---|
| Party | `party` | Travel agencies. Can upload payment receipts. |
| Direct Customer | `dc` | Individual travellers. Standard portal access. |

## User Statuses

| Status | Description |
|---|---|
| `pending_approval` | Registered, awaiting ERP staff review |
| `approved` | Can log in and use the portal |
| `rejected` | Registration denied |
| `suspended` | Previously approved, now blocked |

---

## Registration Flow

```
Customer fills /portal-register
  → POST /api/portal/register
  → Creates portal_users record with status = 'pending_approval'
  → Password stored as bcrypt hash
  → ERP staff sees in Portal Users list
  → PATCH /api/portal/users/:id/status (approved)
  → Customer can now log in at /portal-login
```

---

## Authentication

**Login**: `POST /api/portal/login`
- Validates email + bcrypt password (with legacy plain-text fallback for pre-upgrade accounts)
- Returns `{ portalSessionToken, user }` on success
- Frontend stores both in `localStorage`

**Session check**: Frontend reads `localStorage` on each portal route mount; if no token → redirect to `/portal-login`.

**Backend validation**: `requirePortalAuth` middleware:
1. Reads `Authorization: Bearer <token>` header
2. Looks up `portal_users` by `portal_session_token`
3. Checks `status === 'approved'`
4. Attaches `req.portalUser = { id, type, clientId, ... }`

**Logout**: `POST /api/portal/logout` → clears token in DB; frontend clears localStorage.

---

## Data Isolation

Every portal customer endpoint is scoped to the authenticated user:

| Data Source | Isolation Mechanism |
|---|---|
| Bookings | `publicBookingInquiriesTable.portalUserId = req.portalUser.id` |
| Invoices | `invoicesTable.clientId = req.portalUser.clientId` |
| Statement | `voucherLinesTable` via client vouchers for linked `clientId` |
| Hotel Vouchers | `hotelInvoicesTable.clientId = req.portalUser.clientId` |
| Flight Tickets | `flightQuotationsTable.clientId = req.portalUser.clientId` |
| Visa Status | `visaApplicationsTable.clientId = req.portalUser.clientId` |
| Transport | `transportBookingsTable.clientId = req.portalUser.clientId` |
| Payments | `paymentReceiptsTable.portalUserId = req.portalUser.id` |
| Receipt Upload | `receipt.portalUserId === req.portalUser.id` (403 if mismatch — IDOR protection) |

**Important**: For invoice/voucher/hotel/flight/visa/transport data, `clientId` must be set by an ERP administrator (`PATCH /api/portal/users/:id`). If `clientId` is null, these endpoints return empty arrays with `hasClientLink: false`.

---

## Portal Pages

### Dashboard (`/portal`)
**API**: `GET /api/portal/dashboard`  
**Response shape**:
```json
{
  "openInquiries": 2,
  "pendingPayments": 1,
  "hasClientLink": true,
  "outstandingBalance": 15000,
  "nextFlight": {
    "date": "2025-03-15",
    "route": "KHI → JED",
    "pnr": "ABCDEF",
    "airline": "PK"
  }
}
```
**UI**: Stat cards + next flight info + warning if `hasClientLink = false`.

---

### Bookings (`/portal/bookings`)
**API**: `GET /api/portal/bookings`  
**Data**: Booking inquiries submitted via `/book-flight/:id`, with passenger list and receipt status.

**Payment upload flow** (for `party` type users):
1. GET inquiry list — identify those with `payment_status = 'pending'` and a deadline
2. User clicks "Upload Receipt"
3. `POST /api/storage/uploads/request-url` → `{ uploadURL, objectPath }`
4. `PUT objectPath` file directly to presigned GCS URL
5. `POST /api/public/payment-receipts { inquiryId, objectKey: objectPath }`
6. Server verifies `receipt.portalUserId === req.portalUser.id` before updating

**Deadline tiers** (from `deadline-calculator.ts`):
| Flight departure | Deadline |
|---|---|
| < 24 hours | 1 hour |
| 24–48 hours | 3 hours |
| 48 hours – 10 days | 12 hours |
| > 10 days | 24 hours |

---

### Invoices (`/portal/invoices`)
**API**: `GET /api/portal/invoices`  
**Data**: Umrah package invoices from the ERP `invoices` table, filtered by `clientId`.  
**Print view**: Full-screen print layout with company branding, invoice number, line items, amount, paid amount, status.

---

### Statement (`/portal/statement`)
**API**: `GET /api/portal/statement`  
**Data**: Running account statement derived from `voucher_lines` for the linked client.  
**Export**: CSV download with date, description, debit, credit, running balance columns.

---

### Hotel Vouchers (`/portal/hotel-vouchers`)
**API**: `GET /api/portal/hotel-vouchers`  
**Data**: `hotel_invoices` (DN records) where `clientId` matches.  
**Print view**: Hotel confirmation voucher with company logo, hotel name, dates, room type, pax, DN reference.

---

### Flight Tickets (`/portal/flight-tickets`)
**API**: `GET /api/portal/flight-tickets`  
**Data**: `flight_quotations` with `status = 'issued'` and `clientId` match.  
**Print view**: E-ticket itinerary — PNR, ticket number, route, departure date, airline, cabin class, passenger names.

---

### Visa Status (`/portal/visa`)
**API**: `GET /api/portal/visa-status`  
**Data**: `visa_applications` for linked client.  
**Shows**: Applicant name, visa type, status badge, applied date, expected date, processing notes, rejection reason.

---

### Transport (`/portal/transport`)
**API**: `GET /api/portal/transport`  
**Data**: `transport_bookings` for linked client.  
**Shows**: Pickup/dropoff locations, datetime, vehicle type, driver name, driver phone (tel: link), pax count.

---

### Payments (`/portal/payments`)
**API**: `GET /api/portal/payments`  
**Data**: `payment_receipts` for the portal user (by `portalUserId`, not `clientId`).  
**Shows**: Receipt upload date, deadline, payment status badge, ERP verification status.

---

### Profile (`/portal/profile`)
**API**: `PATCH /api/portal/me`, `POST /api/portal/change-password`  
**Editable fields**: full_name, phone, whatsapp, company_name (party accounts), address.  
**Password change flow**:
1. User enters current password + new password
2. `POST /api/portal/change-password { currentPassword, newPassword }`
3. Server validates current password (bcrypt + legacy plain-text fallback)
4. Updates `password_hash` with new bcrypt hash

---

### Downloads (`/portal/downloads`)
**API**: Calls all portal data endpoints in parallel  
**Purpose**: Central hub showing counts and links to all printable documents — invoices, vouchers, flight tickets, statement.

---

## Portal Layout

`src/components/portal-layout.tsx`:
- Reads company name and logo from `GET /api/website-config`
- Sidebar navigation with all portal routes
- Mobile: hamburger icon toggles sidebar overlay
- Sign-out: clears localStorage, redirects to `/portal-login`
- `use-mobile` hook for responsive behaviour

---

## ERP Admin — Portal User Management

**ERP page**: `/portal-users` in `artifacts/umrah-erp`  
**Route**: `artifacts/api-server/src/routes/portal.ts`

### Admin Actions

| Action | Endpoint | Effect |
|---|---|---|
| View all portal users | `GET /api/portal/users` | Lists with `clientId` and `status` |
| Approve user | `PATCH /api/portal/users/:id/status { status: 'approved' }` | User can now log in |
| Reject user | `PATCH /api/portal/users/:id/status { status: 'rejected' }` | Registration declined |
| Suspend user | `PATCH /api/portal/users/:id/status { status: 'suspended' }` | Block existing user |
| Link to ERP client | `PATCH /api/portal/users/:id { clientId }` | Unlocks invoices/vouchers/tickets |
| View documents | `GET /api/portal/users/:id` | Detail + uploaded identity docs |
| Trigger OCR | `POST /api/portal/users/:id/scan-doc/:docId` | Re-run OCR on uploaded document |

---

## Security Notes

- **IDOR protection**: Receipt upload (`POST /api/public/payment-receipts`) checks `receipt.portalUserId === req.portalUser.id` before allowing update. Returns 403 if mismatch.
- **Password hashing**: All new passwords stored as bcrypt hash (`bcryptjs`). Legacy plain-text passwords accepted on login/change-password for backward compatibility.
- **Session invalidation**: `POST /api/portal/logout` clears `portal_session_token` in DB.
- **Approval gate**: `requirePortalAuth` rejects users whose `status !== 'approved'`.

---

## Future Extension Points

- Email notifications on approval/rejection status changes
- Real-time payment deadline countdown (WebSocket or SSE)
- Document upload from portal (passport, travel docs)
- Notification preferences (WhatsApp vs email)
- Portal user self-registration approval emails
- Multi-language support (Arabic for Umrah context)
