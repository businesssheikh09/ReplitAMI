# Frontend Modules

**Application**: `artifacts/frontend`  
**Framework**: React 19, Vite 7, Wouter (routing), TanStack Query, Tailwind CSS  
**Entry**: `src/main.tsx` → `src/App.tsx`  
**Fonts**: Playfair Display (headings), Outfit (body)  
**Base path**: `/` (public internet root)  

---

## Route Map

| Route | Component | Auth | Description |
|---|---|---|---|
| `/` | `Landing` | None | Homepage |
| `/flights` | `FlightsPage` | None | Public flight browse + request |
| `/book-flight/:id` | `BookFlightPage` | None | Group ticket booking form |
| `/book-gds` | `BookGdsPage` | None | Live GDS search + reservation |
| `/packages/:id` | `PackageDetailPage` | None | Umrah package detail + enquiry |
| `/portal-login` | `PortalLoginPage` | None | Customer portal login |
| `/portal-register` | `PortalRegisterPage` | None | Customer portal registration |
| `/my-bookings` | `MyBookingsPage` | None | Redirect → `/portal/bookings` |
| `/admin` | `AdminRedirect` | None | Checks auth, redirects to ERP |
| `/portal` | `PortalDashboard` | Portal | Dashboard overview |
| `/portal/bookings` | `PortalBookingsPage` | Portal | Booking list + payment upload |
| `/portal/invoices` | `PortalInvoicesPage` | Portal | Invoice view + print |
| `/portal/statement` | `PortalStatementPage` | Portal | Account ledger + CSV export |
| `/portal/hotel-vouchers` | `PortalHotelVouchersPage` | Portal | Hotel voucher view + print |
| `/portal/flight-tickets` | `PortalFlightTicketsPage` | Portal | E-ticket view + print |
| `/portal/visa` | `PortalVisaPage` | Portal | Visa application status |
| `/portal/transport` | `PortalTransportPage` | Portal | Transport schedules |
| `/portal/payments` | `PortalPaymentsPage` | Portal | Payment receipt history |
| `/portal/profile` | `PortalProfilePage` | Portal | Profile update + password change |
| `/portal/downloads` | `PortalDownloadsPage` | Portal | All printable documents hub |

---

## Public Pages

### Landing (`/`)
**Purpose**: Company homepage and primary marketing surface.  
**API calls**: `GET /api/website-config`  
**Sections**:
- Hero with company name, tagline, CTA buttons
- About / company overview
- Umrah package cards (static data with configurable content)
- Group flight ticker / announcement banner (from `website_config.announcement`)
- Contact section with WhatsApp number  
**Special**: If `announcement` field is non-empty in website config, a dismissible banner appears at top.

---

### Flights Page (`/flights`)
**Purpose**: Browse available group tickets and submit custom flight requests.  
**API calls**:
- `GET /api/public/group-tickets` — available inventory
- `POST /api/public/flight-requests` — submit custom request
**Features**:
- Lists group tickets with airline, route, date, seats, and fare
- Markup applied to displayed fares (configurable percentage)
- "Book Now" links to `/book-flight/:id`
- "Request Custom Flight" form for non-group-ticket routes
**Dependencies**: No auth required; `portal_user_id` is null for anonymous requests.

---

### Book Flight Page (`/book-flight/:id`)
**Purpose**: Multi-passenger booking form for a specific group ticket.  
**API calls**:
- `GET /api/public/group-tickets/:id` — ticket details
- `POST /api/storage/uploads/request-url` → PUT to presigned URL — passport image upload
- `POST /api/public/scan-document` — real-time OCR to auto-fill passenger fields
- `POST /api/public/booking-inquiries` — submit booking with all passengers
**Special features**:
- **Passport OCR**: User uploads a passport photo; the server OCR response fills name, number, and expiry automatically
- Each passenger has an independent upload + scan
- Submission creates a `public_booking_inquiries` record and one `public_booking_passengers` row per passenger
**Dependencies**: Group ticket must be active and have available seats.

---

### Book GDS Page (`/book-gds`)
**Purpose**: Real-time live flight search and 2-hour seat hold reservation.  
**API calls**:
- `GET /api/currency/rates` — live PKR rates from forex.pk
- `POST /api/flights/search` — multi-GDS search (Amadeus/Sabre/Galileo)
- `POST /api/public/flight-requests` — submit hold request
- `POST /api/storage/uploads/request-url` → PUT — payment proof upload
- `POST /api/public/flight-requests/:referenceNumber/payment-proof` — attach proof
**Special features**:
- **GDS integration**: live search across all enabled GDS providers; results merged and displayed
- **2-hour hold countdown**: once a seat is held, a timer shows remaining hold time
- **Payment proof upload**: customer uploads bank transfer screenshot before hold expires
- Currency display uses live PKR rates scraped from forex.pk
**Dependencies**: At least one GDS must be enabled and configured.

---

### Package Detail Page (`/packages/:id`)
**Purpose**: Detailed view of a pre-built Umrah package with an enquiry form.  
**API calls**: `POST /api/public/package-inquiries`  
**Features**:
- Package itinerary, inclusions, hotel details
- Enquiry form: dates, pax count, special requests, contact info
- On submit, creates `package_inquiries` record for ERP follow-up
**Dependencies**: Package data is currently static; hotel list from `GET /api/public/hotels`.

---

### Portal Login (`/portal-login`)
**Purpose**: Sign-in for existing portal customers.  
**API calls**: `POST /api/portal/login`  
**Flow**: Enter email + password → receive `portal_session_token` → stored in `localStorage` → redirect to `/portal/bookings`  
**Dependencies**: Portal user must have `status = 'approved'`.

---

### Portal Register (`/portal-register`)
**Purpose**: New customer registration for the portal.  
**API calls**: `POST /api/portal/register`  
**Features**:
- Account type selection: "Party" (travel agency) or "DC" (direct customer)
- Party accounts enter company name, owner name, WhatsApp, address
- DC accounts enter personal details
- On submit: creates `portal_users` with `status = 'pending_approval'`
- Party accounts see "pending review" message; DC accounts may get immediate approval (configurable)
**Dependencies**: Email must be unique in `portal_users`.

---

### My Bookings (`/my-bookings`)
**Purpose**: Legacy URL backward-compatibility.  
**Behavior**: Renders briefly, then redirects to `/portal/bookings`.  
**API calls**: None (redirect only).

---

### Admin Redirect (`/admin`)
**Purpose**: Quick shortcut for staff — checks ERP auth and redirects.  
**API calls**: `GET /api/auth/me`  
**Behavior**: If ERP session valid → redirects to ERP website settings; otherwise → redirects to ERP login.

---

## Portal Pages (Protected)

All portal pages are wrapped in `PortalLayout`. The layout component:
- Reads portal auth from `localStorage`
- Redirects to `/portal-login` if no valid token
- Renders responsive sidebar with navigation
- Shows company branding from `GET /api/website-config`
- Mobile: hamburger menu collapses sidebar

### Portal Dashboard (`/portal`)
**API calls**: `GET /api/portal/dashboard`  
**Shows**:
- Open booking inquiries count
- Pending payment receipts count
- Outstanding ERP balance (if clientId linked)
- Next upcoming flight (date, route, PNR)
- Warning banner if `hasClientLink` is false (data limited until ERP staff links the account)

### Portal Bookings (`/portal/bookings`)
**API calls**: `GET /api/portal/bookings`, `POST /api/storage/uploads/request-url`, `POST /api/public/payment-receipts`  
**Features**:
- Lists all booking inquiries with status badges
- For bookings with `payment_status = 'pending'`: shows countdown to deadline and upload button
- **Payment receipt upload**: 2-step flow — presigned URL → PUT to GCS → `POST /api/public/payment-receipts`
- Ownership is server-enforced (403 if `receipt.portalUserId !== req.portalUser.id`)

### Portal Invoices (`/portal/invoices`)
**API calls**: `GET /api/portal/invoices`, `GET /api/website-config`  
**Features**:
- Lists ERP invoices for linked client
- **Print view**: full-screen printable invoice with company branding from website config
- Shows invoice number, date, amount, paid amount, and status
**Limitation**: Only shows invoices for the linked `clientId`; unlinked accounts see empty list.

### Portal Statement (`/portal/statement`)
**API calls**: `GET /api/portal/statement`  
**Features**:
- Running ledger (date, description, debit, credit, running balance)
- **CSV export**: downloads statement as comma-separated file
**Note**: Statement is derived from posted `voucher_lines`, not directly from `general_journal`.

### Portal Hotel Vouchers (`/portal/hotel-vouchers`)
**API calls**: `GET /api/portal/hotel-vouchers`, `GET /api/website-config`  
**Features**:
- Lists hotel invoices (DN records) for linked client
- **Print view**: full-screen printable hotel confirmation voucher with company branding
- Shows hotel name, check-in/out, room type, pax count, reference

### Portal Flight Tickets (`/portal/flight-tickets`)
**API calls**: `GET /api/portal/flight-tickets`, `GET /api/website-config`  
**Features**:
- Lists issued flight tickets (`status = 'issued'`) for linked client
- **Print view**: full-screen printable e-ticket itinerary with company branding
- Shows PNR, ticket number, route, date, airline, passenger names

### Portal Visa (`/portal/visa`)
**API calls**: `GET /api/portal/visa-status`  
**Features**:
- Lists visa applications for linked client
- Status badges: pending, submitted, approved, rejected
- Shows processing notes and rejection reasons if any

### Portal Transport (`/portal/transport`)
**API calls**: `GET /api/portal/transport`  
**Features**:
- Lists transport bookings for linked client
- Shows pickup/dropoff, datetime, vehicle type
- Clickable driver phone number (tel: link)

### Portal Payments (`/portal/payments`)
**API calls**: `GET /api/portal/payments`  
**Features**:
- Payment receipt history with status badges
- Shows upload date, deadline, and verification status

### Portal Profile (`/portal/profile`)
**API calls**: `PATCH /api/portal/me`, `POST /api/portal/change-password`  
**Features**:
- Edit name, phone, WhatsApp, company info
- Change password form: current password verification + bcrypt update
- Updates local user state in `localStorage` on success

### Portal Downloads (`/portal/downloads`)
**API calls**: `GET /api/portal/invoices`, `GET /api/portal/hotel-vouchers`, `GET /api/portal/flight-tickets`, `GET /api/portal/statement`  
**Purpose**: Central hub showing counts and links to all printable documents.

---

## Shared Components

### `src/components/layout/Navbar.tsx`
Public site navigation bar. Links: Home, Packages, Flights, Contact, Portal Login. Logo from website config.

### `src/components/layout/Footer.tsx`
Company name, address, phone, email from website config. Social links.

### `src/components/portal-layout.tsx`
Authenticated portal shell:
- Sidebar with all portal routes
- Mobile hamburger toggle
- Company logo from website config
- Sign-out button (clears localStorage, redirects to `/portal-login`)

### `src/lib/portal-auth.ts`
- `getPortalToken()` / `setPortalToken()` / `clearPortalToken()` — localStorage helpers
- `getPortalUser()` / `setPortalUser()` — user object cache
- `isPortalAuthenticated()` — checks token presence

### `src/lib/utils.ts`
- `cn(...classes)` — Tailwind class merging via `clsx` + `tailwind-merge`

---

## Styling

- **Tailwind CSS** with custom theme
- **Fonts**: Playfair Display (headings, loaded from CSS), Outfit (body)
- **Color palette**: defined in `tailwind.config.ts` with CSS variables for light/dark theming
- Print styles: `@media print` hides nav/sidebar, shows only printable content

---

## Build Configuration

**`vite.config.ts`**:
- `server.allowedHosts: true` — allows proxied preview (required for Replit iframe)
- `base` set to artifact `BASE_PATH` env var
- Output: `dist/public/`

---

## Dependencies

| Package | Purpose |
|---|---|
| `react` 19.1 | UI framework |
| `wouter` | Client-side routing |
| `@tanstack/react-query` | Server state + caching |
| `@workspace/api-client-react` | Generated React Query hooks |
| `lucide-react` | Icons |
| `zod` | Form validation |
| Radix UI primitives | Accessible UI components |
| `tailwind-merge`, `clsx` | Conditional class merging |

---

## Known Limitations

- Package detail pages use static package data; no CMS integration.
- Portal statement only reflects posted voucher lines, not auto-journal entries from invoices.
- GDS live search on BookGdsPage requires at least one enabled GDS provider; shows empty state otherwise.
- Portal profile update sends all editable fields on save — blank fields in form overwrite existing data.
